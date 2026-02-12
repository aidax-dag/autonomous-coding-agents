/**
 * Context Manager
 *
 * Unified context management integrating token budgets, quality levels,
 * output optimization, and compression strategies.
 *
 * @module core/context/context-manager
 */

import { createAgentLogger } from '../../shared/logging/logger';
import type {
  IContextManager,
  ContextManagerConfig,
  TokenUsageStats,
  CompressionResult,
  SummarizationRequest,
  ContextEvent,
  ContextEventHandler,
  ContextEventData,
  CompressionLevel,
} from './interfaces/context.interface';
import type {
  QualityLevel,
  QualityLevelInfo,
  ContextState,
  CompressionStrategy,
} from './interfaces/quality-curve.interface';
import { DEFAULT_CONTEXT_CONFIG } from './constants/context.constants';
import { TokenBudgetManager } from './token-budget-manager';
import { OutputOptimizer } from './output-optimizer';
import { ContextMonitor } from './context-monitor';
import { CompactionStrategy } from './compaction-strategy';
import { QualityCurve } from './quality-curve';

// ============================================================================
// Implementation
// ============================================================================

/**
 * ContextManager
 *
 * Unified context management class that integrates:
 * - Token budget tracking
 * - Quality level management
 * - Output optimization
 * - Compression strategies
 * - Event-driven monitoring
 */
const logger = createAgentLogger('context-manager');

export class ContextManager implements IContextManager {
  private config: ContextManagerConfig;
  private tokenManager: TokenBudgetManager;
  private optimizer: OutputOptimizer;
  private monitor: ContextMonitor;
  private compactor: CompactionStrategy;
  private qualityCurve: QualityCurve;

  private eventHandlers: Map<ContextEvent, Set<ContextEventHandler>>;
  private monitorInterval?: ReturnType<typeof setInterval>;

  constructor(config?: Partial<ContextManagerConfig>) {
    this.config = this.mergeConfig(DEFAULT_CONTEXT_CONFIG, config);
    this.eventHandlers = new Map();

    // Initialize event handler sets
    const events: ContextEvent[] = [
      'usage-warning',
      'usage-critical',
      'quality-degraded',
      'budget-exceeded',
      'compression-applied',
    ];
    for (const event of events) {
      this.eventHandlers.set(event, new Set());
    }

    // Initialize sub-components
    this.tokenManager = new TokenBudgetManager(this.config.tokenBudget);
    this.optimizer = new OutputOptimizer(this.config.outputOptimizer);
    this.compactor = new CompactionStrategy();
    this.qualityCurve = new QualityCurve(async () => ({
      used: this.tokenManager.getUsedTokens(),
      total: this.tokenManager.getMaxTokens(),
    }));

    // Initialize monitor with callbacks
    this.monitor = new ContextMonitor(
      {
        onWarning: () => this.emit('usage-warning', {}),
        onCritical: () => this.emit('usage-critical', {}),
        onQualityDegraded: (level) => this.emitQualityEvent(level),
      },
      this.config.monitoring
    );

    // Set up quality level change monitoring
    this.qualityCurve.onLevelChange((oldLevel, newLevel) => {
      if (this.isQualityDegraded(oldLevel, newLevel)) {
        this.emitQualityEvent(newLevel);
      }
    });

    // Start monitoring if enabled
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
  }

  // ==========================================================================
  // Token Budget Management
  // ==========================================================================

  /**
   * Get current usage statistics
   */
  getUsageStats(): TokenUsageStats {
    const total = this.tokenManager.getMaxTokens();
    const used = this.tokenManager.getUsedTokens();
    const reserved = this.config.tokenBudget.reserveTokens;

    return {
      total,
      used,
      remaining: total - used,
      usagePercent: (used / total) * 100,
      reserved,
      available: Math.max(0, total - used - reserved),
    };
  }

  /**
   * Set maximum token budget
   */
  setMaxTokens(max: number): void {
    this.tokenManager.setMaxTokens(max);
  }

  /**
   * Add tokens to usage count
   */
  addTokens(count: number): void {
    this.tokenManager.addTokens(count);
    this.checkBudget();
  }

  /**
   * Release tokens from usage count
   */
  releaseTokens(count: number): void {
    this.tokenManager.releaseTokens(count);
  }

  /**
   * Check if required tokens are available
   */
  hasAvailableTokens(required: number): boolean {
    return this.tokenManager.canAfford(required);
  }

  // ==========================================================================
  // Quality Management
  // ==========================================================================

  /**
   * Get current quality level
   */
  getQualityLevel(): QualityLevel {
    const stats = this.getUsageStats();
    return this.qualityCurve.getLevel(stats.usagePercent);
  }

  /**
   * Get quality level information
   */
  getQualityInfo(): QualityLevelInfo {
    return this.qualityCurve.getLevelInfo(this.getQualityLevel());
  }

  /**
   * Get full context state
   */
  getContextState(): ContextState {
    const stats = this.getUsageStats();
    return this.qualityCurve.analyzeContextState(stats.used, stats.total);
  }

  /**
   * Check if new plan should be started
   */
  shouldStartNewPlan(): boolean {
    const stats = this.getUsageStats();
    return this.qualityCurve.shouldStartNewPlan(stats.usagePercent);
  }

  // ==========================================================================
  // Output Optimization
  // ==========================================================================

  /**
   * Optimize output with compression
   */
  async optimizeOutput(output: string): Promise<CompressionResult> {
    const level = this.getQualityLevel();
    const strategy = this.qualityCurve.getCompressionStrategy(level);

    const result = await this.optimizer.optimize(output, {
      level: this.config.outputOptimizer.compressionLevel,
      preserveCodeBlocks: this.config.outputOptimizer.preserveCodeBlocks,
      techniques: strategy.techniques.filter(t => t.enabled).map(t => t.name),
    });

    if (result.savedTokens > 0) {
      this.emit('compression-applied', {
        savedTokens: result.savedTokens,
        ratio: result.compressionRatio,
      });
    }

    return result;
  }

  /**
   * Set compression level
   */
  setCompressionLevel(level: CompressionLevel): void {
    this.config.outputOptimizer.compressionLevel = level;
  }

  /**
   * Summarize content
   */
  async summarize(request: SummarizationRequest): Promise<string> {
    return this.optimizer.summarize(request);
  }

  // ==========================================================================
  // Compression Strategy
  // ==========================================================================

  /**
   * Get current compression strategy
   */
  getCompressionStrategy(): CompressionStrategy {
    return this.qualityCurve.getCompressionStrategy(this.getQualityLevel());
  }

  /**
   * Apply compression to content
   */
  async applyCompression(content: string): Promise<string> {
    const strategy = this.getCompressionStrategy();
    return this.compactor.apply(content, strategy);
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Subscribe to context event
   */
  on(event: ContextEvent, handler: ContextEventHandler): void {
    this.eventHandlers.get(event)?.add(handler);
  }

  /**
   * Unsubscribe from context event
   */
  off(event: ContextEvent, handler: ContextEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Update configuration
   */
  configure(config: Partial<ContextManagerConfig>): void {
    this.config = this.mergeConfig(this.config, config);

    // Update sub-components
    if (config.tokenBudget) {
      this.tokenManager.configure(config.tokenBudget);
    }
    if (config.outputOptimizer) {
      this.optimizer.configure(config.outputOptimizer);
    }
    if (config.monitoring) {
      this.monitor.configure(config.monitoring);
      this.restartMonitoring();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextManagerConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    this.monitor.stop();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Deep merge configuration
   */
  private mergeConfig(
    base: ContextManagerConfig,
    override?: Partial<ContextManagerConfig>
  ): ContextManagerConfig {
    if (!override) return { ...base };

    return {
      tokenBudget: { ...base.tokenBudget, ...override.tokenBudget },
      outputOptimizer: { ...base.outputOptimizer, ...override.outputOptimizer },
      qualityCurve: { ...base.qualityCurve, ...override.qualityCurve },
      monitoring: { ...base.monitoring, ...override.monitoring },
    };
  }

  /**
   * Emit context event
   */
  private emit(event: ContextEvent, details?: Record<string, unknown>): void {
    const stats = this.getUsageStats();
    const level = this.getQualityLevel();

    const data: ContextEventData = {
      event,
      timestamp: new Date(),
      usageStats: stats,
      qualityLevel: level,
      message: this.getEventMessage(event, stats, level),
      details,
    };

    for (const handler of this.eventHandlers.get(event) ?? []) {
      try {
        handler(data);
      } catch (error) {
        logger.error('Context event handler error', { event, error });
      }
    }
  }

  /**
   * Emit quality degradation event
   */
  private emitQualityEvent(level: QualityLevel): void {
    const info = this.qualityCurve.getLevelInfo(level);
    this.emit('quality-degraded', {
      level,
      label: info.label,
      recommendations: info.recommendations,
    });
  }

  /**
   * Check if quality has degraded
   */
  private isQualityDegraded(oldLevel: QualityLevel, newLevel: QualityLevel): boolean {
    const order = ['peak', 'good', 'degrading', 'poor'];
    return order.indexOf(newLevel) > order.indexOf(oldLevel);
  }

  /**
   * Check budget and emit events if needed
   */
  private checkBudget(): void {
    const stats = this.getUsageStats();

    if (stats.usagePercent >= this.config.tokenBudget.criticalThreshold) {
      this.emit('usage-critical');
    } else if (stats.usagePercent >= this.config.tokenBudget.warningThreshold) {
      this.emit('usage-warning');
    }

    if (stats.available <= 0) {
      this.emit('budget-exceeded');
    }
  }

  /**
   * Get event message
   */
  private getEventMessage(
    event: ContextEvent,
    stats: TokenUsageStats,
    level: QualityLevel
  ): string {
    switch (event) {
      case 'usage-warning':
        return `컨텍스트 사용률 경고: ${stats.usagePercent.toFixed(1)}%`;
      case 'usage-critical':
        return `컨텍스트 사용률 위험: ${stats.usagePercent.toFixed(1)}%`;
      case 'quality-degraded':
        return `품질 레벨 저하: ${level}`;
      case 'budget-exceeded':
        return '토큰 예산 초과';
      case 'compression-applied':
        return '출력 압축 적용됨';
      default:
        return event;
    }
  }

  /**
   * Start periodic monitoring
   */
  private startMonitoring(): void {
    this.monitor.start();
    this.monitorInterval = setInterval(() => {
      const stats = this.getUsageStats();
      const level = this.getQualityLevel();
      this.monitor.check(stats, level);
    }, this.config.monitoring.checkInterval);
  }

  /**
   * Restart monitoring with updated config
   */
  private restartMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    if (this.config.monitoring.enabled) {
      this.startMonitoring();
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ContextManager instance
 */
export function createContextManager(config?: Partial<ContextManagerConfig>): ContextManager {
  return new ContextManager(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default ContextManager;
