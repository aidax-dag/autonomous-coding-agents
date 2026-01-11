/**
 * Context Monitor Hook
 *
 * Monitors context window usage and triggers appropriate actions.
 *
 * @module core/hooks/context-monitor
 */

import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult, HookAction } from '../../interfaces/hook.interface.js';
import { ITokenBudgetManager, BudgetStatus } from '../../../dx/token-budget/index.js';
import {
  ContextMonitorConfig,
  ContextUsageLevel,
  ContextUsageStatus,
  CompactionStrategy,
  CompactionRequest,
  CompactionResult,
  ContextMonitorEventData,
  IContextProvider,
  IContextCompactor,
  ContextWarningCallback,
  ContextCriticalCallback,
  ContextOverflowCallback,
  ContextCompactionCallback,
  ContextMonitorSubscription,
  DEFAULT_CONTEXT_MONITOR_CONFIG,
} from './context-monitor.interface.js';

/**
 * Context Monitor Hook
 *
 * Monitors context window usage and takes action when thresholds are exceeded:
 * - Warning (70%): Log warning, continue
 * - Critical (85%): Trigger compaction, modify context
 * - Overflow (95%): Abort operation
 */
export class ContextMonitorHook extends BaseHook<unknown, ContextMonitorEventData> {
  readonly name = 'context-monitor';
  readonly description = 'Monitors context window usage and manages thresholds';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;
  private readonly overflowThreshold: number;
  private readonly autoCompact: boolean;
  private readonly maxContextSize: number;
  private readonly verbose: boolean;

  private tokenBudgetManager?: ITokenBudgetManager;
  private contextProvider?: IContextProvider;
  private contextCompactor?: IContextCompactor;
  private budgetId?: string;

  private previousStatus?: ContextUsageStatus;
  private subscriptions: Map<string, ContextMonitorSubscription> = new Map();
  private subscriptionCounter = 0;

  // Event callbacks
  private warningCallbacks: ContextWarningCallback[] = [];
  private criticalCallbacks: ContextCriticalCallback[] = [];
  private overflowCallbacks: ContextOverflowCallback[] = [];
  private compactionCallbacks: ContextCompactionCallback[] = [];

  constructor(config?: ContextMonitorConfig) {
    super(config);

    const mergedConfig = { ...DEFAULT_CONTEXT_MONITOR_CONFIG, ...config };

    this.warningThreshold = mergedConfig.warningThreshold;
    this.criticalThreshold = mergedConfig.criticalThreshold;
    this.overflowThreshold = mergedConfig.overflowThreshold;
    this.autoCompact = mergedConfig.autoCompact;
    this.maxContextSize = mergedConfig.maxContextSize;
    this.verbose = mergedConfig.verbose;

    this.tokenBudgetManager = config?.tokenBudgetManager;
    this.budgetId = config?.budgetId;

    this.validateThresholds();
  }

  /**
   * Set token budget manager
   */
  setTokenBudgetManager(manager: ITokenBudgetManager): void {
    this.tokenBudgetManager = manager;
  }

  /**
   * Set context provider
   */
  setContextProvider(provider: IContextProvider): void {
    this.contextProvider = provider;
  }

  /**
   * Set context compactor
   */
  setContextCompactor(compactor: IContextCompactor): void {
    this.contextCompactor = compactor;
  }

  /**
   * Set budget ID to monitor
   */
  setBudgetId(budgetId: string): void {
    this.budgetId = budgetId;
  }

  /**
   * Execute hook - check context usage and take appropriate action
   */
  async execute(context: HookContext<unknown>): Promise<HookResult<ContextMonitorEventData>> {
    const currentStatus = this.calculateUsageStatus();
    const eventData: ContextMonitorEventData = {
      previousStatus: this.previousStatus,
      currentStatus,
    };

    // Check for threshold crossings
    const thresholdCrossed = this.detectThresholdCrossing(currentStatus);
    if (thresholdCrossed) {
      eventData.thresholdCrossed = thresholdCrossed;
    }

    // Store current status for next comparison
    this.previousStatus = currentStatus;

    // Handle overflow - abort operation
    if (currentStatus.level === ContextUsageLevel.OVERFLOW) {
      this.notifyOverflow(currentStatus);
      this.log(`Context overflow detected: ${currentStatus.percentage.toFixed(1)}%`);
      return {
        action: HookAction.ABORT,
        data: eventData,
        message: `Context overflow: ${currentStatus.percentage.toFixed(1)}% usage exceeds ${this.overflowThreshold * 100}% threshold`,
      };
    }

    // Handle critical - attempt compaction
    if (currentStatus.level === ContextUsageLevel.CRITICAL) {
      this.notifyCritical(currentStatus);
      this.log(`Context critical: ${currentStatus.percentage.toFixed(1)}%`);

      if (this.autoCompact && currentStatus.shouldCompact) {
        const compactionResult = await this.attemptCompaction(currentStatus, context);
        eventData.compactionResult = compactionResult;

        if (compactionResult.success) {
          this.notifyCompaction(compactionResult);
          return this.modify(eventData, `Context compacted: freed ${compactionResult.tokensFreed} tokens`);
        } else {
          return this.continue(eventData, `Compaction failed: ${compactionResult.error}`);
        }
      }

      return this.continue(eventData, `Context critical: ${currentStatus.percentage.toFixed(1)}%`);
    }

    // Handle warning - log and continue
    if (currentStatus.level === ContextUsageLevel.WARNING) {
      this.notifyWarning(currentStatus);
      this.log(`Context warning: ${currentStatus.percentage.toFixed(1)}%`);
      return this.continue(eventData, `Context usage: ${currentStatus.percentage.toFixed(1)}%`);
    }

    // Normal - continue
    if (this.verbose) {
      this.log(`Context normal: ${currentStatus.percentage.toFixed(1)}%`);
    }
    return this.continue(eventData);
  }

  /**
   * Get current usage status
   */
  getUsageStatus(): ContextUsageStatus {
    return this.calculateUsageStatus();
  }

  /**
   * Get usage level for percentage
   */
  getUsageLevel(percentage: number): ContextUsageLevel {
    const ratio = percentage / 100;
    if (ratio >= this.overflowThreshold) return ContextUsageLevel.OVERFLOW;
    if (ratio >= this.criticalThreshold) return ContextUsageLevel.CRITICAL;
    if (ratio >= this.warningThreshold) return ContextUsageLevel.WARNING;
    return ContextUsageLevel.NORMAL;
  }

  /**
   * Subscribe to warning events
   */
  onWarning(callback: ContextWarningCallback): ContextMonitorSubscription {
    this.warningCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.warningCallbacks.indexOf(callback);
      if (index > -1) this.warningCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to critical events
   */
  onCritical(callback: ContextCriticalCallback): ContextMonitorSubscription {
    this.criticalCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.criticalCallbacks.indexOf(callback);
      if (index > -1) this.criticalCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to overflow events
   */
  onOverflow(callback: ContextOverflowCallback): ContextMonitorSubscription {
    this.overflowCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.overflowCallbacks.indexOf(callback);
      if (index > -1) this.overflowCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to compaction events
   */
  onCompaction(callback: ContextCompactionCallback): ContextMonitorSubscription {
    this.compactionCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.compactionCallbacks.indexOf(callback);
      if (index > -1) this.compactionCallbacks.splice(index, 1);
    });
  }

  /**
   * Get thresholds
   */
  getThresholds(): { warning: number; critical: number; overflow: number } {
    return {
      warning: this.warningThreshold,
      critical: this.criticalThreshold,
      overflow: this.overflowThreshold,
    };
  }

  /**
   * Dispose subscriptions
   */
  dispose(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.warningCallbacks = [];
    this.criticalCallbacks = [];
    this.overflowCallbacks = [];
    this.compactionCallbacks = [];
  }

  // === Private Methods ===

  private validateThresholds(): void {
    if (this.warningThreshold < 0 || this.warningThreshold > 1) {
      throw new Error('Warning threshold must be between 0 and 1');
    }
    if (this.criticalThreshold < 0 || this.criticalThreshold > 1) {
      throw new Error('Critical threshold must be between 0 and 1');
    }
    if (this.overflowThreshold < 0 || this.overflowThreshold > 1) {
      throw new Error('Overflow threshold must be between 0 and 1');
    }
    if (this.warningThreshold >= this.criticalThreshold) {
      throw new Error('Warning threshold must be less than critical threshold');
    }
    if (this.criticalThreshold >= this.overflowThreshold) {
      throw new Error('Critical threshold must be less than overflow threshold');
    }
  }

  private calculateUsageStatus(): ContextUsageStatus {
    let usedTokens: number;
    let maxTokens: number;
    let budgetStatus: BudgetStatus | undefined;

    // Try to get usage from token budget manager
    if (this.tokenBudgetManager) {
      budgetStatus = this.budgetId
        ? this.tokenBudgetManager.checkBudget(this.budgetId)
        : this.tokenBudgetManager.getGlobalStatus();

      usedTokens = budgetStatus.used;
      maxTokens = budgetStatus.limit;
    }
    // Try to get usage from context provider
    else if (this.contextProvider) {
      usedTokens = this.contextProvider.getCurrentSize();
      maxTokens = this.contextProvider.getMaxSize();
    }
    // Fall back to default max size with zero usage
    else {
      usedTokens = 0;
      maxTokens = this.maxContextSize;
    }

    const percentage = maxTokens > 0 ? (usedTokens / maxTokens) * 100 : 0;
    const level = this.getUsageLevel(percentage);

    return {
      level,
      percentage,
      usedTokens,
      maxTokens,
      remainingTokens: maxTokens - usedTokens,
      shouldCompact: level === ContextUsageLevel.CRITICAL || level === ContextUsageLevel.OVERFLOW,
      shouldAbort: level === ContextUsageLevel.OVERFLOW,
      budgetStatus,
    };
  }

  private detectThresholdCrossing(
    current: ContextUsageStatus
  ): 'warning' | 'critical' | 'overflow' | undefined {
    if (!this.previousStatus) return undefined;

    const prevLevel = this.previousStatus.level;
    const currLevel = current.level;

    if (prevLevel !== currLevel) {
      if (currLevel === ContextUsageLevel.OVERFLOW) return 'overflow';
      if (currLevel === ContextUsageLevel.CRITICAL) return 'critical';
      if (currLevel === ContextUsageLevel.WARNING) return 'warning';
    }

    return undefined;
  }

  private async attemptCompaction(
    status: ContextUsageStatus,
    _hookContext: HookContext<unknown>
  ): Promise<CompactionResult> {
    if (!this.contextCompactor || !this.contextProvider) {
      return {
        success: false,
        tokensFreed: 0,
        newPercentage: status.percentage,
        strategyUsed: CompactionStrategy.HYBRID,
        error: 'No context compactor or provider available',
      };
    }

    const context = this.contextProvider.getContext();
    if (!this.contextCompactor.canCompact(context)) {
      return {
        success: false,
        tokensFreed: 0,
        newPercentage: status.percentage,
        strategyUsed: CompactionStrategy.HYBRID,
        error: 'Context cannot be compacted',
      };
    }

    // Calculate how many tokens we need to free
    const targetPercentage = this.warningThreshold * 100; // Target warning level
    const targetUsage = (targetPercentage / 100) * status.maxTokens;
    const tokensToFree = status.usedTokens - targetUsage;

    const request: CompactionRequest = {
      targetPercentage,
      strategy: CompactionStrategy.HYBRID,
      context,
      tokensToFree: Math.max(0, tokensToFree),
    };

    try {
      const result = await this.contextCompactor.compact(request);

      if (result.success && result.compactedContext) {
        this.contextProvider.setContext(result.compactedContext);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        tokensFreed: 0,
        newPercentage: status.percentage,
        strategyUsed: CompactionStrategy.HYBRID,
        error: error instanceof Error ? error.message : 'Compaction failed',
      };
    }
  }

  private notifyWarning(status: ContextUsageStatus): void {
    this.warningCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyCritical(status: ContextUsageStatus): void {
    this.criticalCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyOverflow(status: ContextUsageStatus): void {
    this.overflowCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyCompaction(result: CompactionResult): void {
    this.compactionCallbacks.forEach((callback) => {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private createSubscription(cleanup: () => void): ContextMonitorSubscription {
    const id = `context-monitor-sub-${++this.subscriptionCounter}`;
    const subscription: ContextMonitorSubscription = {
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
    if (this.verbose) {
      console.log(`[ContextMonitor] ${message}`);
    }
  }
}
