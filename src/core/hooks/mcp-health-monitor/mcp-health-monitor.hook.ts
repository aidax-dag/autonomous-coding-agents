/**
 * MCP Health Monitor Hook
 *
 * Monitors MCP server health and manages auto-recovery.
 *
 * @module core/hooks/mcp-health-monitor
 */

import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult } from '../../interfaces/hook.interface.js';
import { createLogger, ILogger } from '../../services/logger.js';
import {
  MCPHealthMonitorConfig,
  MCPServerStatus,
  MCPServerStatusLevel,
  MCPServerConfig,
  HealthCheckResult,
  MCPServerStatistics,
  HealthWarning,
  StatusChangeEvent,
  MCPRecoveryOptions,
  MCPHealthMonitorEventData,
  MCPHealthMonitorSubscription,
  StatusChangeCallback,
  HealthWarningCallback,
  HealthCheckCallback,
  RecoveryCallback,
  IMCPHealthChecker,
  IMCPServerManager,
  DEFAULT_MCP_HEALTH_MONITOR_CONFIG,
  DEFAULT_MCP_RECOVERY_OPTIONS,
} from './mcp-health-monitor.interface.js';

/**
 * MCP Health Monitor Hook
 *
 * Monitors MCP server health and provides:
 * - Periodic health checks
 * - Status tracking (healthy/degraded/unhealthy/unknown)
 * - Auto-recovery with retry and fallback
 * - Statistics collection
 * - Event subscriptions for status changes and warnings
 */
export class MCPHealthMonitorHook extends BaseHook<unknown, MCPHealthMonitorEventData> {
  readonly name = 'mcp-health-monitor';
  readonly description = 'Monitors MCP server health and manages auto-recovery';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly config: Required<
    Omit<MCPHealthMonitorConfig, 'name' | 'description' | 'event' | 'conditions' | 'servers' | 'defaultRecoveryOptions'>
  > & {
    servers: MCPServerConfig[];
    defaultRecoveryOptions: MCPRecoveryOptions;
  };

  // Server state
  private serverStatuses: Map<string, MCPServerStatus> = new Map();
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private serverStatistics: Map<string, MCPServerStatistics> = new Map();
  private responseTimeHistory: Map<string, number[]> = new Map();

  // Recovery state
  private recoveriesInProgress: Set<string> = new Set();
  private recoveryAttempts: Map<string, number> = new Map();
  private lastRecoveryTime: Map<string, Date> = new Map();

  // Active warnings
  private activeWarnings: Map<string, HealthWarning[]> = new Map();

  // Dependencies
  private healthChecker?: IMCPHealthChecker;
  private serverManager?: IMCPServerManager;

  // Subscriptions
  private subscriptions: Map<string, MCPHealthMonitorSubscription> = new Map();
  private subscriptionCounter = 0;

  // Callbacks
  private statusChangeCallbacks: StatusChangeCallback[] = [];
  private healthWarningCallbacks: HealthWarningCallback[] = [];
  private healthCheckCallbacks: HealthCheckCallback[] = [];
  private recoveryCallbacks: RecoveryCallback[] = [];

  // Monitoring state
  private monitoringInterval?: ReturnType<typeof setInterval>;
  private isMonitoring = false;

  // Logger
  private readonly logger: ILogger;

  constructor(config?: MCPHealthMonitorConfig) {
    // Merge config with defaults BEFORE passing to super
    const mergedConfig = {
      ...DEFAULT_MCP_HEALTH_MONITOR_CONFIG,
      ...config,
    };

    super(mergedConfig);

    this.logger = createLogger('MCPHealthMonitor');

    this.config = {
      ...DEFAULT_MCP_HEALTH_MONITOR_CONFIG,
      ...config,
      servers: config?.servers ?? [],
      defaultRecoveryOptions: {
        ...DEFAULT_MCP_RECOVERY_OPTIONS,
        ...config?.defaultRecoveryOptions,
      },
    };

    // Initialize servers from config
    this.config.servers.forEach((server) => this.registerServer(server));
  }

  // === Dependency Injection ===

  /**
   * Set health checker implementation
   */
  setHealthChecker(checker: IMCPHealthChecker): void {
    this.healthChecker = checker;
  }

  /**
   * Set server manager implementation
   */
  setServerManager(manager: IMCPServerManager): void {
    this.serverManager = manager;
  }

  // === Server Registration ===

  /**
   * Register a server for monitoring
   */
  registerServer(config: MCPServerConfig): void {
    this.serverConfigs.set(config.serverId, config);

    // Initialize status
    const status: MCPServerStatus = {
      serverId: config.serverId,
      serverName: config.serverName,
      status: MCPServerStatusLevel.UNKNOWN,
      lastCheck: new Date(),
      responseTimeMs: 0,
      errorRate: 0,
      uptime: 1,
      consecutiveFailures: 0,
      capabilities: [],
      autoRecoveryEnabled: config.autoRecoveryEnabled,
    };
    this.serverStatuses.set(config.serverId, status);

    // Initialize statistics
    this.initializeStatistics(config.serverId);

    // Initialize response time history
    this.responseTimeHistory.set(config.serverId, []);
  }

  /**
   * Unregister a server
   */
  unregisterServer(serverId: string): void {
    this.serverConfigs.delete(serverId);
    this.serverStatuses.delete(serverId);
    this.serverStatistics.delete(serverId);
    this.responseTimeHistory.delete(serverId);
    this.activeWarnings.delete(serverId);
    this.recoveryAttempts.delete(serverId);
    this.lastRecoveryTime.delete(serverId);
    this.recoveriesInProgress.delete(serverId);
  }

  /**
   * Get registered server IDs
   */
  getRegisteredServers(): string[] {
    return Array.from(this.serverConfigs.keys());
  }

  // === Status & Statistics ===

  /**
   * Get server status
   */
  getServerStatus(serverId: string): MCPServerStatus | undefined {
    return this.serverStatuses.get(serverId);
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): Map<string, MCPServerStatus> {
    return new Map(this.serverStatuses);
  }

  /**
   * Get server statistics
   */
  getStatistics(serverId: string): MCPServerStatistics | undefined {
    return this.serverStatistics.get(serverId);
  }

  /**
   * Get all server statistics
   */
  getAllStatistics(): Map<string, MCPServerStatistics> {
    return new Map(this.serverStatistics);
  }

  /**
   * Reset statistics for a server
   */
  resetStatistics(serverId: string): void {
    this.initializeStatistics(serverId);
    this.responseTimeHistory.set(serverId, []);
  }

  // === Health Checks ===

  /**
   * Check health of a specific server
   */
  async checkHealth(serverId: string): Promise<HealthCheckResult> {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      return this.createFailedHealthCheck(serverId, 'Server not registered');
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Use custom health check if provided
      if (config.customHealthCheck) {
        result = await Promise.race([
          config.customHealthCheck(serverId),
          this.createTimeoutPromise(config.healthCheckTimeoutMs, serverId),
        ]);
      }
      // Use injected health checker
      else if (this.healthChecker) {
        result = await Promise.race([
          this.healthChecker.checkHealth(serverId, config),
          this.createTimeoutPromise(config.healthCheckTimeoutMs, serverId),
        ]);
      }
      // Fallback to basic check using server manager
      else if (this.serverManager) {
        result = await this.performBasicHealthCheck(serverId, config);
      }
      // No way to check - assume healthy if configured
      else {
        result = this.createSuccessHealthCheck(serverId, Date.now() - startTime);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result = this.createFailedHealthCheck(serverId, errorMessage, Date.now() - startTime);
    }

    // Update status based on result
    this.updateServerStatus(serverId, result);

    // Update statistics
    this.updateStatistics(serverId, result);

    // Check for warnings
    this.checkForWarnings(serverId, result);

    // Notify callbacks
    this.notifyHealthCheck(result);

    return result;
  }

  /**
   * Check health of all registered servers
   */
  async checkAllHealth(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const serverIds = Array.from(this.serverConfigs.keys());

    await Promise.all(
      serverIds.map(async (serverId) => {
        const result = await this.checkHealth(serverId);
        results.set(serverId, result);
      })
    );

    return results;
  }

  // === Auto Recovery ===

  /**
   * Enable auto-recovery for a server
   */
  enableAutoRecovery(serverId: string, options?: Partial<MCPRecoveryOptions>): void {
    const config = this.serverConfigs.get(serverId);
    if (config) {
      config.autoRecoveryEnabled = true;
      if (options) {
        config.recoveryOptions = {
          ...this.config.defaultRecoveryOptions,
          ...options,
        };
      }
    }

    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.autoRecoveryEnabled = true;
    }
  }

  /**
   * Disable auto-recovery for a server
   */
  disableAutoRecovery(serverId: string): void {
    const config = this.serverConfigs.get(serverId);
    if (config) {
      config.autoRecoveryEnabled = false;
    }

    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.autoRecoveryEnabled = false;
    }
  }

  /**
   * Manually trigger recovery for a server
   */
  async triggerRecovery(serverId: string): Promise<boolean> {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      return false;
    }

    return this.attemptRecovery(serverId, config);
  }

  /**
   * Check if recovery is in progress for a server
   */
  isRecoveryInProgress(serverId: string): boolean {
    return this.recoveriesInProgress.has(serverId);
  }

  // === Monitoring ===

  /**
   * Start automatic monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      await this.checkAllHealth();
    }, this.config.healthCheckIntervalMs);

    this.log('Monitoring started');
  }

  /**
   * Stop automatic monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.log('Monitoring stopped');
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  // === Subscriptions ===

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: StatusChangeCallback): MCPHealthMonitorSubscription {
    this.statusChangeCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.statusChangeCallbacks.indexOf(callback);
      if (index > -1) this.statusChangeCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to health warnings
   */
  onHealthWarning(callback: HealthWarningCallback): MCPHealthMonitorSubscription {
    this.healthWarningCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.healthWarningCallbacks.indexOf(callback);
      if (index > -1) this.healthWarningCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to health check results
   */
  onHealthCheck(callback: HealthCheckCallback): MCPHealthMonitorSubscription {
    this.healthCheckCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.healthCheckCallbacks.indexOf(callback);
      if (index > -1) this.healthCheckCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to recovery events
   */
  onRecovery(callback: RecoveryCallback): MCPHealthMonitorSubscription {
    this.recoveryCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.recoveryCallbacks.indexOf(callback);
      if (index > -1) this.recoveryCallbacks.splice(index, 1);
    });
  }

  /**
   * Get active warnings for a server
   */
  getActiveWarnings(serverId?: string): HealthWarning[] {
    if (serverId) {
      return this.activeWarnings.get(serverId) ?? [];
    }

    const allWarnings: HealthWarning[] = [];
    this.activeWarnings.forEach((warnings) => {
      allWarnings.push(...warnings);
    });
    return allWarnings;
  }

  // === Hook Execution ===

  /**
   * Execute hook - check all servers and report status
   */
  async execute(_context: HookContext<unknown>): Promise<HookResult<MCPHealthMonitorEventData>> {
    // Check all servers
    await this.checkAllHealth();

    // Collect status changes and warnings
    const statusChanges: StatusChangeEvent[] = [];
    const activeWarnings: HealthWarning[] = [];

    this.activeWarnings.forEach((warnings) => {
      activeWarnings.push(...warnings);
    });

    const eventData: MCPHealthMonitorEventData = {
      serverStatuses: new Map(this.serverStatuses),
      statusChanges,
      activeWarnings,
      recoveriesInProgress: Array.from(this.recoveriesInProgress),
    };

    // Check if any server is unhealthy
    const unhealthyServers: string[] = [];
    this.serverStatuses.forEach((status, serverId) => {
      if (status.status === MCPServerStatusLevel.UNHEALTHY) {
        unhealthyServers.push(serverId);
      }
    });

    if (unhealthyServers.length > 0) {
      return this.continue(
        eventData,
        `Unhealthy servers: ${unhealthyServers.join(', ')}`
      );
    }

    // Check for degraded servers
    const degradedServers: string[] = [];
    this.serverStatuses.forEach((status, serverId) => {
      if (status.status === MCPServerStatusLevel.DEGRADED) {
        degradedServers.push(serverId);
      }
    });

    if (degradedServers.length > 0) {
      return this.continue(
        eventData,
        `Degraded servers: ${degradedServers.join(', ')}`
      );
    }

    return this.continue(eventData);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stopMonitoring();
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.statusChangeCallbacks = [];
    this.healthWarningCallbacks = [];
    this.healthCheckCallbacks = [];
    this.recoveryCallbacks = [];
    this.serverStatuses.clear();
    this.serverConfigs.clear();
    this.serverStatistics.clear();
    this.responseTimeHistory.clear();
    this.activeWarnings.clear();
    this.recoveriesInProgress.clear();
    this.recoveryAttempts.clear();
    this.lastRecoveryTime.clear();
  }

  // === Private Methods ===

  private initializeStatistics(serverId: string): void {
    const now = new Date();
    this.serverStatistics.set(serverId, {
      serverId,
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTimeMs: 0,
      minResponseTimeMs: Infinity,
      maxResponseTimeMs: 0,
      percentiles: { p50: 0, p90: 0, p95: 0, p99: 0 },
      recoveryAttempts: 0,
      successfulRecoveries: 0,
      totalDowntimeMs: 0,
      monitoringStartedAt: now,
      lastResetAt: now,
    });
  }

  private async performBasicHealthCheck(
    serverId: string,
    _config: MCPServerConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    if (!this.serverManager) {
      return this.createFailedHealthCheck(serverId, 'No server manager available');
    }

    const isAvailable = this.serverManager.isServerAvailable(serverId);
    const latency = Date.now() - startTime;

    if (isAvailable) {
      const capabilities = this.serverManager.getServerCapabilities(serverId);
      return {
        serverId,
        healthy: true,
        status: latency > this.config.degradedResponseTimeMs
          ? MCPServerStatusLevel.DEGRADED
          : MCPServerStatusLevel.HEALTHY,
        latencyMs: latency,
        details: [
          {
            name: 'availability',
            passed: true,
            durationMs: latency,
            message: 'Server is available',
            metadata: { capabilities },
          },
        ],
        recommendations: [],
        timestamp: new Date(),
      };
    }

    return this.createFailedHealthCheck(serverId, 'Server not available', latency);
  }

  private createSuccessHealthCheck(serverId: string, latencyMs: number): HealthCheckResult {
    return {
      serverId,
      healthy: true,
      status: latencyMs > this.config.degradedResponseTimeMs
        ? MCPServerStatusLevel.DEGRADED
        : MCPServerStatusLevel.HEALTHY,
      latencyMs,
      details: [
        {
          name: 'default',
          passed: true,
          durationMs: latencyMs,
          message: 'Health check passed',
        },
      ],
      recommendations: [],
      timestamp: new Date(),
    };
  }

  private createFailedHealthCheck(
    serverId: string,
    error: string,
    latencyMs = 0
  ): HealthCheckResult {
    return {
      serverId,
      healthy: false,
      status: MCPServerStatusLevel.UNHEALTHY,
      latencyMs,
      details: [
        {
          name: 'health',
          passed: false,
          durationMs: latencyMs,
          message: error,
        },
      ],
      recommendations: ['Check server connectivity', 'Review server logs'],
      timestamp: new Date(),
      error,
    };
  }

  private createTimeoutPromise(timeoutMs: number, serverId: string): Promise<HealthCheckResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout after ${timeoutMs}ms for server ${serverId}`));
      }, timeoutMs);
    });
  }

  private updateServerStatus(serverId: string, result: HealthCheckResult): void {
    const currentStatus = this.serverStatuses.get(serverId);
    if (!currentStatus) return;

    const previousStatusLevel = currentStatus.status;
    const config = this.serverConfigs.get(serverId);

    // Update status fields
    currentStatus.lastCheck = result.timestamp;
    currentStatus.responseTimeMs = result.latencyMs;

    // Update consecutive failures
    if (!result.healthy) {
      currentStatus.consecutiveFailures++;
      currentStatus.lastError = result.error;
    } else {
      currentStatus.consecutiveFailures = 0;
      currentStatus.lastError = undefined;
    }

    // Determine new status
    if (currentStatus.consecutiveFailures >= this.config.consecutiveFailuresThreshold) {
      currentStatus.status = MCPServerStatusLevel.UNHEALTHY;
    } else if (!result.healthy) {
      currentStatus.status = MCPServerStatusLevel.DEGRADED;
    } else if (result.latencyMs > this.config.degradedResponseTimeMs) {
      currentStatus.status = MCPServerStatusLevel.DEGRADED;
    } else {
      currentStatus.status = MCPServerStatusLevel.HEALTHY;
    }

    // Update capabilities from result details
    const capabilitiesDetail = result.details.find((d) => d.metadata?.capabilities);
    if (capabilitiesDetail?.metadata?.capabilities) {
      currentStatus.capabilities = capabilitiesDetail.metadata.capabilities as string[];
    }

    // Calculate error rate from recent history
    const stats = this.serverStatistics.get(serverId);
    if (stats && stats.totalChecks > 0) {
      currentStatus.errorRate = stats.failedChecks / stats.totalChecks;
      currentStatus.uptime = stats.successfulChecks / stats.totalChecks;
    }

    // Check for status change
    if (previousStatusLevel !== currentStatus.status) {
      const event: StatusChangeEvent = {
        serverId,
        previousStatus: previousStatusLevel,
        newStatus: currentStatus.status,
        reason: this.getStatusChangeReason(previousStatusLevel, currentStatus.status, result),
        timestamp: new Date(),
        healthCheckResult: result,
      };

      this.notifyStatusChange(event);

      // Trigger auto-recovery if needed
      if (
        currentStatus.status === MCPServerStatusLevel.UNHEALTHY &&
        currentStatus.autoRecoveryEnabled &&
        config
      ) {
        this.attemptRecovery(serverId, config).catch((err) => {
          this.log(`Recovery failed for ${serverId}: ${err}`);
        });
      }
    }
  }

  private getStatusChangeReason(
    from: MCPServerStatusLevel,
    to: MCPServerStatusLevel,
    result: HealthCheckResult
  ): string {
    if (to === MCPServerStatusLevel.UNHEALTHY) {
      return result.error ?? 'Server became unhealthy';
    }
    if (to === MCPServerStatusLevel.DEGRADED) {
      if (result.latencyMs > this.config.degradedResponseTimeMs) {
        return `High latency: ${result.latencyMs}ms`;
      }
      return 'Server degraded';
    }
    if (to === MCPServerStatusLevel.HEALTHY && from !== MCPServerStatusLevel.UNKNOWN) {
      return 'Server recovered';
    }
    return 'Status changed';
  }

  private updateStatistics(serverId: string, result: HealthCheckResult): void {
    const stats = this.serverStatistics.get(serverId);
    if (!stats) return;

    stats.totalChecks++;
    if (result.healthy) {
      stats.successfulChecks++;
    } else {
      stats.failedChecks++;
    }

    // Update response time stats
    const history = this.responseTimeHistory.get(serverId) ?? [];
    history.push(result.latencyMs);

    // Keep only recent history (simple approach: keep last 100 samples)
    if (history.length > 100) {
      history.shift();
    }
    this.responseTimeHistory.set(serverId, history);

    // Calculate statistics
    if (history.length > 0) {
      const sorted = [...history].sort((a, b) => a - b);
      stats.averageResponseTimeMs = history.reduce((a, b) => a + b, 0) / history.length;
      stats.minResponseTimeMs = Math.min(stats.minResponseTimeMs, result.latencyMs);
      stats.maxResponseTimeMs = Math.max(stats.maxResponseTimeMs, result.latencyMs);

      stats.percentiles.p50 = this.percentile(sorted, 50);
      stats.percentiles.p90 = this.percentile(sorted, 90);
      stats.percentiles.p95 = this.percentile(sorted, 95);
      stats.percentiles.p99 = this.percentile(sorted, 99);
    }

    // Update downtime if unhealthy
    const status = this.serverStatuses.get(serverId);
    if (status?.status === MCPServerStatusLevel.UNHEALTHY) {
      const lastCheck = status.lastCheck;
      const timeSinceLastCheck = Date.now() - lastCheck.getTime();
      stats.totalDowntimeMs += Math.min(timeSinceLastCheck, this.config.healthCheckIntervalMs);
    }
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private checkForWarnings(serverId: string, result: HealthCheckResult): void {
    const warnings: HealthWarning[] = [];
    const status = this.serverStatuses.get(serverId);

    // High latency warning
    if (result.latencyMs > this.config.highLatencyThresholdMs) {
      warnings.push({
        serverId,
        type: 'high_latency',
        severity: result.latencyMs > this.config.highLatencyThresholdMs * 2 ? 'high' : 'medium',
        message: `Response time ${result.latencyMs}ms exceeds threshold ${this.config.highLatencyThresholdMs}ms`,
        currentValue: result.latencyMs,
        thresholdValue: this.config.highLatencyThresholdMs,
        timestamp: new Date(),
        recommendations: ['Check network connectivity', 'Review server load'],
      });
    }

    // High error rate warning
    if (status && status.errorRate > this.config.highErrorRateThreshold) {
      warnings.push({
        serverId,
        type: 'high_error_rate',
        severity: status.errorRate > this.config.highErrorRateThreshold * 2 ? 'critical' : 'high',
        message: `Error rate ${(status.errorRate * 100).toFixed(1)}% exceeds threshold ${this.config.highErrorRateThreshold * 100}%`,
        currentValue: status.errorRate,
        thresholdValue: this.config.highErrorRateThreshold,
        timestamp: new Date(),
        recommendations: ['Review server logs', 'Check for resource constraints'],
      });
    }

    // Consecutive failures warning
    if (status && status.consecutiveFailures > 0 && status.consecutiveFailures < this.config.consecutiveFailuresThreshold) {
      warnings.push({
        serverId,
        type: 'consecutive_failures',
        severity: 'medium',
        message: `${status.consecutiveFailures} consecutive failures (threshold: ${this.config.consecutiveFailuresThreshold})`,
        currentValue: status.consecutiveFailures,
        thresholdValue: this.config.consecutiveFailuresThreshold,
        timestamp: new Date(),
        recommendations: ['Monitor closely', 'Check server health'],
      });
    }

    // Degraded status warning
    if (status?.status === MCPServerStatusLevel.DEGRADED) {
      warnings.push({
        serverId,
        type: 'degraded',
        severity: 'medium',
        message: 'Server is in degraded state',
        currentValue: 1,
        thresholdValue: 0,
        timestamp: new Date(),
        recommendations: result.recommendations,
      });
    }

    // Update active warnings
    this.activeWarnings.set(serverId, warnings);

    // Notify callbacks
    warnings.forEach((warning) => this.notifyHealthWarning(warning));
  }

  private async attemptRecovery(serverId: string, config: MCPServerConfig): Promise<boolean> {
    if (this.recoveriesInProgress.has(serverId)) {
      this.log(`Recovery already in progress for ${serverId}`);
      return false;
    }

    const recoveryOptions = config.recoveryOptions ?? this.config.defaultRecoveryOptions;
    const currentAttempts = this.recoveryAttempts.get(serverId) ?? 0;

    if (currentAttempts >= recoveryOptions.maxRetries) {
      this.log(`Max recovery attempts reached for ${serverId}`);

      // Check escalation policy
      if (recoveryOptions.escalationPolicy) {
        await this.handleEscalation(serverId, recoveryOptions.escalationPolicy);
      }

      return false;
    }

    this.recoveriesInProgress.add(serverId);
    this.recoveryAttempts.set(serverId, currentAttempts + 1);

    const stats = this.serverStatistics.get(serverId);
    if (stats) {
      stats.recoveryAttempts++;
    }

    try {
      this.log(`Attempting recovery for ${serverId} (attempt ${currentAttempts + 1}/${recoveryOptions.maxRetries})`);

      // Calculate delay with exponential backoff
      const delay = Math.min(
        recoveryOptions.retryDelayMs * Math.pow(recoveryOptions.backoffMultiplier, currentAttempts),
        recoveryOptions.maxRetryDelayMs
      );

      await this.sleep(delay);

      // Try to restart using server manager
      let success = false;
      if (this.serverManager) {
        success = await this.serverManager.restartServer(serverId);
      }

      // If restart failed or no manager, try fallback servers
      if (!success && recoveryOptions.fallbackServers && recoveryOptions.fallbackServers.length > 0) {
        this.log(`Trying fallback servers for ${serverId}`);
        // Note: Fallback logic would need to be implemented based on requirements
        // For now, we just check if any fallback server is healthy
        for (const fallbackId of recoveryOptions.fallbackServers) {
          const fallbackResult = await this.checkHealth(fallbackId);
          if (fallbackResult.healthy) {
            this.log(`Fallback server ${fallbackId} is healthy`);
            // Could redirect traffic here
            success = true;
            break;
          }
        }
      }

      // Verify recovery
      if (success) {
        const checkResult = await this.checkHealth(serverId);
        success = checkResult.healthy;
      }

      if (success) {
        this.log(`Recovery successful for ${serverId}`);
        this.recoveryAttempts.delete(serverId);
        if (stats) {
          stats.successfulRecoveries++;
        }
      } else {
        // Add recovery failed warning
        const warning: HealthWarning = {
          serverId,
          type: 'recovery_failed',
          severity: 'high',
          message: `Recovery attempt ${currentAttempts + 1} failed`,
          currentValue: currentAttempts + 1,
          thresholdValue: recoveryOptions.maxRetries,
          timestamp: new Date(),
          recommendations: ['Check server logs', 'Manual intervention may be required'],
        };
        this.notifyHealthWarning(warning);
      }

      this.notifyRecovery(serverId, success);
      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log(`Recovery error for ${serverId}: ${errorMessage}`);
      this.notifyRecovery(serverId, false, errorMessage);
      return false;
    } finally {
      this.recoveriesInProgress.delete(serverId);
      this.lastRecoveryTime.set(serverId, new Date());
    }
  }

  private async handleEscalation(
    serverId: string,
    policy: NonNullable<MCPRecoveryOptions['escalationPolicy']>
  ): Promise<void> {
    const lastEscalation = this.lastRecoveryTime.get(serverId);
    const now = Date.now();

    // Check cooldown
    if (lastEscalation && now - lastEscalation.getTime() < policy.cooldownMs) {
      this.log(`Escalation cooldown active for ${serverId}`);
      return;
    }

    this.log(`Escalating for ${serverId}: action=${policy.action}`);

    switch (policy.action) {
      case 'notify':
        // Emit warning with notify targets
        const warning: HealthWarning = {
          serverId,
          type: 'recovery_failed',
          severity: 'critical',
          message: `Recovery failed - escalating to: ${policy.notifyTargets?.join(', ') ?? 'admin'}`,
          currentValue: 0,
          thresholdValue: 0,
          timestamp: new Date(),
          recommendations: ['Immediate attention required'],
        };
        this.notifyHealthWarning(warning);
        break;

      case 'disable':
        this.disableAutoRecovery(serverId);
        break;

      case 'restart':
      case 'fallback':
        // These would require server manager implementation
        break;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private notifyStatusChange(event: StatusChangeEvent): void {
    this.statusChangeCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyHealthWarning(warning: HealthWarning): void {
    this.healthWarningCallbacks.forEach((callback) => {
      try {
        callback(warning);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyHealthCheck(result: HealthCheckResult): void {
    this.healthCheckCallbacks.forEach((callback) => {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyRecovery(serverId: string, success: boolean, error?: string): void {
    this.recoveryCallbacks.forEach((callback) => {
      try {
        callback(serverId, success, error);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private createSubscription(cleanup: () => void): MCPHealthMonitorSubscription {
    const id = `mcp-health-monitor-sub-${++this.subscriptionCounter}`;
    const subscription: MCPHealthMonitorSubscription = {
      id,
      unsubscribe: () => {
        cleanup();
        this.subscriptions.delete(id);
      },
    };
    this.subscriptions.set(id, subscription);
    return subscription;
  }

  private log(message: string): void {
    if (this.config.verbose) {
      this.logger.debug(message);
    }
  }
}
