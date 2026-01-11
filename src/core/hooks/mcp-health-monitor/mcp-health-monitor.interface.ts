/**
 * MCP Health Monitor Interfaces
 *
 * Provides MCP server health monitoring, status tracking, and auto-recovery.
 *
 * @module core/hooks/mcp-health-monitor
 */

import { HookConfig } from '../../interfaces/hook.interface.js';

/**
 * MCP Server status levels
 */
export enum MCPServerStatusLevel {
  /** Server is healthy and responding normally */
  HEALTHY = 'healthy',
  /** Server is responding but with degraded performance */
  DEGRADED = 'degraded',
  /** Server is not responding or has critical errors */
  UNHEALTHY = 'unhealthy',
  /** Server status is unknown (not yet checked) */
  UNKNOWN = 'unknown',
}

/**
 * MCP Server status information
 */
export interface MCPServerStatus {
  /** Server identifier */
  serverId: string;
  /** Server name (human-readable) */
  serverName: string;
  /** Current status level */
  status: MCPServerStatusLevel;
  /** Timestamp of last health check */
  lastCheck: Date;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Error rate (0.0 - 1.0) over the monitoring window */
  errorRate: number;
  /** Uptime percentage (0.0 - 1.0) */
  uptime: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Server capabilities (if available) */
  capabilities: string[];
  /** Server version (if available) */
  version?: string;
  /** Last error message (if any) */
  lastError?: string;
  /** Whether auto-recovery is enabled */
  autoRecoveryEnabled: boolean;
}

/**
 * Health check detail
 */
export interface HealthCheckDetail {
  /** Check name */
  name: string;
  /** Check passed */
  passed: boolean;
  /** Check duration in milliseconds */
  durationMs: number;
  /** Check message */
  message?: string;
  /** Check metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  /** Server identifier */
  serverId: string;
  /** Whether the server is healthy */
  healthy: boolean;
  /** Status level after check */
  status: MCPServerStatusLevel;
  /** Response latency in milliseconds */
  latencyMs: number;
  /** Individual check details */
  details: HealthCheckDetail[];
  /** Recommendations for improvement */
  recommendations: string[];
  /** Timestamp of the check */
  timestamp: Date;
  /** Error if check failed */
  error?: string;
}

/**
 * Escalation policy for auto-recovery
 */
export interface EscalationPolicy {
  /** Number of failures before escalating */
  failureThreshold: number;
  /** Action to take on escalation */
  action: 'notify' | 'restart' | 'fallback' | 'disable';
  /** Notification targets (if action is 'notify') */
  notifyTargets?: string[];
  /** Cooldown period in milliseconds before next escalation */
  cooldownMs: number;
}

/**
 * Recovery options for MCP auto-recovery
 */
export interface MCPRecoveryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelayMs: number;
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay between retries */
  maxRetryDelayMs: number;
  /** Escalation policy */
  escalationPolicy?: EscalationPolicy;
  /** Fallback server IDs to try */
  fallbackServers?: string[];
  /** Recovery timeout in milliseconds */
  timeoutMs: number;
}

/**
 * MCP Server statistics
 */
export interface MCPServerStatistics {
  /** Server identifier */
  serverId: string;
  /** Total number of health checks */
  totalChecks: number;
  /** Number of successful checks */
  successfulChecks: number;
  /** Number of failed checks */
  failedChecks: number;
  /** Average response time in milliseconds */
  averageResponseTimeMs: number;
  /** Minimum response time in milliseconds */
  minResponseTimeMs: number;
  /** Maximum response time in milliseconds */
  maxResponseTimeMs: number;
  /** Response time percentiles */
  percentiles: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };
  /** Number of recovery attempts */
  recoveryAttempts: number;
  /** Number of successful recoveries */
  successfulRecoveries: number;
  /** Total downtime in milliseconds */
  totalDowntimeMs: number;
  /** Monitoring start time */
  monitoringStartedAt: Date;
  /** Last reset time */
  lastResetAt: Date;
}

/**
 * Health warning information
 */
export interface HealthWarning {
  /** Server identifier */
  serverId: string;
  /** Warning type */
  type: 'high_latency' | 'high_error_rate' | 'consecutive_failures' | 'degraded' | 'recovery_failed';
  /** Warning severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Warning message */
  message: string;
  /** Current value that triggered the warning */
  currentValue: number;
  /** Threshold value */
  thresholdValue: number;
  /** Timestamp */
  timestamp: Date;
  /** Recommendations */
  recommendations: string[];
}

/**
 * Status change event
 */
export interface StatusChangeEvent {
  /** Server identifier */
  serverId: string;
  /** Previous status */
  previousStatus: MCPServerStatusLevel;
  /** New status */
  newStatus: MCPServerStatusLevel;
  /** Change reason */
  reason: string;
  /** Timestamp */
  timestamp: Date;
  /** Health check result that triggered the change */
  healthCheckResult?: HealthCheckResult;
}

/**
 * MCP Server configuration for monitoring
 */
export interface MCPServerConfig {
  /** Server identifier */
  serverId: string;
  /** Server name (human-readable) */
  serverName: string;
  /** Server endpoint URL or command */
  endpoint: string;
  /** Server type */
  type: 'stdio' | 'http' | 'websocket';
  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number;
  /** Health check timeout in milliseconds */
  healthCheckTimeoutMs: number;
  /** Enable auto-recovery */
  autoRecoveryEnabled: boolean;
  /** Recovery options */
  recoveryOptions?: MCPRecoveryOptions;
  /** Custom health check function */
  customHealthCheck?: (serverId: string) => Promise<HealthCheckResult>;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * MCP Health Monitor configuration
 */
export interface MCPHealthMonitorConfig extends Partial<HookConfig> {
  /** Health check interval in milliseconds (default: 30000) */
  healthCheckIntervalMs?: number;
  /** Health check timeout in milliseconds (default: 5000) */
  healthCheckTimeoutMs?: number;
  /** High latency threshold in milliseconds (default: 1000) */
  highLatencyThresholdMs?: number;
  /** High error rate threshold (0.0 - 1.0, default: 0.1) */
  highErrorRateThreshold?: number;
  /** Consecutive failures before marking unhealthy (default: 3) */
  consecutiveFailuresThreshold?: number;
  /** Degraded response time threshold in milliseconds (default: 500) */
  degradedResponseTimeMs?: number;
  /** Enable auto-recovery by default (default: true) */
  defaultAutoRecovery?: boolean;
  /** Default recovery options */
  defaultRecoveryOptions?: Partial<MCPRecoveryOptions>;
  /** Statistics window size in milliseconds (default: 300000 = 5 minutes) */
  statisticsWindowMs?: number;
  /** Enable verbose logging (default: false) */
  verbose?: boolean;
  /** Servers to monitor */
  servers?: MCPServerConfig[];
}

/**
 * Health monitor event data
 */
export interface MCPHealthMonitorEventData {
  /** Server statuses */
  serverStatuses: Map<string, MCPServerStatus>;
  /** Status changes since last check */
  statusChanges: StatusChangeEvent[];
  /** Active warnings */
  activeWarnings: HealthWarning[];
  /** Recovery in progress */
  recoveriesInProgress: string[];
}

/**
 * Health monitor subscription
 */
export interface MCPHealthMonitorSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Callback types
 */
export type StatusChangeCallback = (event: StatusChangeEvent) => void;
export type HealthWarningCallback = (warning: HealthWarning) => void;
export type HealthCheckCallback = (result: HealthCheckResult) => void;
export type RecoveryCallback = (serverId: string, success: boolean, error?: string) => void;

/**
 * MCP Health Checker interface
 */
export interface IMCPHealthChecker {
  /**
   * Perform health check on a server
   */
  checkHealth(serverId: string, config: MCPServerConfig): Promise<HealthCheckResult>;

  /**
   * Check if server supports health check
   */
  supportsHealthCheck(config: MCPServerConfig): boolean;
}

/**
 * MCP Server Manager interface for recovery actions
 */
export interface IMCPServerManager {
  /**
   * Restart a server
   */
  restartServer(serverId: string): Promise<boolean>;

  /**
   * Get server configuration
   */
  getServerConfig(serverId: string): MCPServerConfig | undefined;

  /**
   * Get all server configurations
   */
  getAllServerConfigs(): MCPServerConfig[];

  /**
   * Check if server is available
   */
  isServerAvailable(serverId: string): boolean;

  /**
   * Get server capabilities
   */
  getServerCapabilities(serverId: string): string[];
}

/**
 * Default configuration values
 */
export const DEFAULT_MCP_HEALTH_MONITOR_CONFIG: Required<
  Omit<
    MCPHealthMonitorConfig,
    | 'name'
    | 'description'
    | 'event'
    | 'conditions'
    | 'servers'
    | 'defaultRecoveryOptions'
  >
> = {
  priority: 90,
  enabled: true,
  timeout: 10000,
  retryOnError: false,
  healthCheckIntervalMs: 30000,
  healthCheckTimeoutMs: 5000,
  highLatencyThresholdMs: 1000,
  highErrorRateThreshold: 0.1,
  consecutiveFailuresThreshold: 3,
  degradedResponseTimeMs: 500,
  defaultAutoRecovery: true,
  statisticsWindowMs: 300000,
  verbose: false,
};

/**
 * Default MCP recovery options
 */
export const DEFAULT_MCP_RECOVERY_OPTIONS: MCPRecoveryOptions = {
  maxRetries: 3,
  retryDelayMs: 1000,
  backoffMultiplier: 2,
  maxRetryDelayMs: 30000,
  timeoutMs: 60000,
};
