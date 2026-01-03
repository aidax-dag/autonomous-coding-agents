/**
 * Token Budget Manager Implementation
 *
 * Provides token usage tracking and budget management for LLM operations.
 *
 * @module dx/token-budget/impl
 */

import type {
  ITokenBudgetManager,
  TokenBudget,
  TokenBudgetConfig,
  TokenUsage,
  BudgetStatus,
  BudgetSubscription,
  UsageHistoryEntry,
  UsageStats,
} from '../interfaces/token-budget.interface';
import { BudgetExceededError, BudgetNotFoundError } from '../interfaces/token-budget.interface';

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Calculate next reset time
 */
function calculateResetTime(interval: string): Date | undefined {
  const now = new Date();

  switch (interval) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    default:
      return undefined;
  }
}

/**
 * Internal budget state
 */
interface BudgetState {
  budget: TokenBudget;
  used: number;
  reserved: number;
  history: UsageHistoryEntry[];
  lastUpdated: Date;
}

/**
 * Token Budget Manager Implementation
 */
export class TokenBudgetManager implements ITokenBudgetManager {
  private budgets = new Map<string, BudgetState>();
  private globalBudget?: BudgetState;
  private warningCallbacks = new Map<string, (status: BudgetStatus) => void>();
  private exceededCallbacks = new Map<string, (status: BudgetStatus) => void>();
  private usageCallbacks = new Map<string, (usage: TokenUsage, status: BudgetStatus) => void>();
  private resetTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private disposed = false;

  constructor(globalConfig?: TokenBudgetConfig) {
    if (globalConfig) {
      const globalBudget = this.createBudgetInternal('global', {
        ...globalConfig,
        name: 'Global Budget',
      });
      this.globalBudget = {
        budget: globalBudget,
        used: 0,
        reserved: 0,
        history: [],
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Create a new token budget
   */
  createBudget(config: TokenBudgetConfig): TokenBudget {
    this.ensureNotDisposed();

    const id = generateId();
    const budget = this.createBudgetInternal(id, config);

    const state: BudgetState = {
      budget,
      used: 0,
      reserved: 0,
      history: [],
      lastUpdated: new Date(),
    };

    this.budgets.set(id, state);
    this.scheduleReset(id, budget.resetAt);

    return budget;
  }

  /**
   * Get a budget by ID
   */
  getBudget(budgetId: string): TokenBudget | undefined {
    return this.budgets.get(budgetId)?.budget;
  }

  /**
   * Delete a budget
   */
  deleteBudget(budgetId: string): boolean {
    const timer = this.resetTimers.get(budgetId);
    if (timer) {
      clearTimeout(timer);
      this.resetTimers.delete(budgetId);
    }
    return this.budgets.delete(budgetId);
  }

  /**
   * List all budgets
   */
  listBudgets(): TokenBudget[] {
    return Array.from(this.budgets.values()).map((s) => s.budget);
  }

  /**
   * Update budget configuration
   */
  updateBudget(budgetId: string, config: Partial<TokenBudgetConfig>): TokenBudget | undefined {
    const state = this.budgets.get(budgetId);
    if (!state) return undefined;

    const updatedConfig: TokenBudgetConfig = {
      ...state.budget.config,
      ...config,
    };

    const updatedBudget: TokenBudget = {
      ...state.budget,
      config: updatedConfig,
      resetAt: config.resetInterval ? calculateResetTime(config.resetInterval) : state.budget.resetAt,
    };

    state.budget = updatedBudget;
    return updatedBudget;
  }

  /**
   * Record token usage
   */
  recordUsage(usage: TokenUsage): void {
    this.ensureNotDisposed();

    const totalTokens = usage.totalTokens ?? usage.inputTokens + usage.outputTokens;
    const budgetId = usage.budgetId;

    // Record to specific budget if provided
    if (budgetId) {
      const state = this.budgets.get(budgetId);
      if (state) {
        this.recordToState(state, usage, totalTokens);
        this.checkAndNotify(budgetId, state);
      }
    }

    // Always record to global budget
    if (this.globalBudget) {
      this.recordToState(this.globalBudget, usage, totalTokens);
      this.checkAndNotify('global', this.globalBudget);
    }
  }

  /**
   * Get budget status
   */
  checkBudget(budgetId?: string): BudgetStatus {
    const state = budgetId ? this.budgets.get(budgetId) : this.globalBudget;

    if (!state) {
      if (budgetId) {
        throw new BudgetNotFoundError(budgetId);
      }
      // Return default status if no global budget
      return {
        budgetId: 'none',
        name: 'No Budget',
        used: 0,
        limit: Infinity,
        remaining: Infinity,
        percentage: 0,
        isWarning: false,
        isExceeded: false,
        lastUpdated: new Date(),
      };
    }

    return this.calculateStatus(budgetId ?? 'global', state);
  }

  /**
   * Get remaining budget tokens
   */
  getRemainingBudget(budgetId?: string): number {
    const status = this.checkBudget(budgetId);
    return status.remaining;
  }

  /**
   * Check if budget allows operation
   */
  canAfford(budgetId: string | undefined, tokens: number): boolean {
    const remaining = this.getRemainingBudget(budgetId);
    return remaining >= tokens;
  }

  /**
   * Execute an operation within a budget context
   */
  async withBudget<T>(
    budget: TokenBudget | string,
    operation: () => Promise<T>
  ): Promise<T> {
    const budgetId = typeof budget === 'string' ? budget : budget.id;
    const status = this.checkBudget(budgetId);

    if (status.isExceeded) {
      throw new BudgetExceededError(budgetId, status);
    }

    return operation();
  }

  /**
   * Reserve tokens before operation
   */
  reserveTokens(budgetId: string, tokens: number): boolean {
    const state = this.budgets.get(budgetId);
    if (!state) return false;

    const available = state.budget.config.maxTokens - state.used - state.reserved;
    if (tokens > available) return false;

    state.reserved += tokens;
    return true;
  }

  /**
   * Release reserved tokens
   */
  releaseReservedTokens(budgetId: string, tokens: number): void {
    const state = this.budgets.get(budgetId);
    if (!state) return;

    state.reserved = Math.max(0, state.reserved - tokens);
  }

  /**
   * Get usage history
   */
  getHistory(budgetId?: string, limit = 100): UsageHistoryEntry[] {
    const state = budgetId ? this.budgets.get(budgetId) : this.globalBudget;
    if (!state) return [];

    const history = state.history.slice(-limit);
    return history;
  }

  /**
   * Get aggregated usage stats
   */
  getUsageStats(
    budgetId?: string,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): UsageStats {
    const state = budgetId ? this.budgets.get(budgetId) : this.globalBudget;

    if (!state) {
      return {
        budgetId: budgetId ?? 'global',
        period,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        operationCount: 0,
        averagePerOperation: 0,
        peakUsage: 0,
      };
    }

    const now = Date.now();
    const periodMs = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
    };

    const cutoff = now - periodMs[period];
    const entries = state.history.filter((e) => e.timestamp.getTime() > cutoff);

    let totalInput = 0;
    let totalOutput = 0;
    let peakUsage = 0;
    let peakAt: Date | undefined;

    for (const entry of entries) {
      totalInput += entry.usage.inputTokens;
      totalOutput += entry.usage.outputTokens;
      const total = entry.usage.totalTokens ?? entry.usage.inputTokens + entry.usage.outputTokens;
      if (total > peakUsage) {
        peakUsage = total;
        peakAt = entry.timestamp;
      }
    }

    const totalTokens = totalInput + totalOutput;
    const operationCount = entries.length;

    return {
      budgetId: budgetId ?? 'global',
      period,
      totalTokens,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      operationCount,
      averagePerOperation: operationCount > 0 ? totalTokens / operationCount : 0,
      peakUsage,
      peakAt,
    };
  }

  /**
   * Reset budget usage
   */
  resetBudget(budgetId: string): void {
    const state = this.budgets.get(budgetId);
    if (!state) return;

    state.used = 0;
    state.reserved = 0;
    state.lastUpdated = new Date();

    // Reschedule reset if applicable
    if (state.budget.resetAt) {
      state.budget = {
        ...state.budget,
        resetAt: calculateResetTime(state.budget.config.resetInterval ?? 'never'),
      };
      this.scheduleReset(budgetId, state.budget.resetAt);
    }
  }

  /**
   * Subscribe to warning events
   */
  onWarning(callback: (status: BudgetStatus) => void): BudgetSubscription {
    const id = generateId();
    this.warningCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => this.warningCallbacks.delete(id),
    };
  }

  /**
   * Subscribe to exceeded events
   */
  onExceeded(callback: (status: BudgetStatus) => void): BudgetSubscription {
    const id = generateId();
    this.exceededCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => this.exceededCallbacks.delete(id),
    };
  }

  /**
   * Subscribe to usage events
   */
  onUsage(
    callback: (usage: TokenUsage, status: BudgetStatus) => void
  ): BudgetSubscription {
    const id = generateId();
    this.usageCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => this.usageCallbacks.delete(id),
    };
  }

  /**
   * Get global budget status
   */
  getGlobalStatus(): BudgetStatus {
    return this.checkBudget(undefined);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.disposed) return;

    // Clear all timers
    for (const timer of this.resetTimers.values()) {
      clearTimeout(timer);
    }

    this.resetTimers.clear();
    this.budgets.clear();
    this.warningCallbacks.clear();
    this.exceededCallbacks.clear();
    this.usageCallbacks.clear();
    this.disposed = true;
  }

  // === Private Methods ===

  private createBudgetInternal(id: string, config: TokenBudgetConfig): TokenBudget {
    return {
      id,
      name: config.name ?? `Budget-${id}`,
      config,
      createdAt: new Date(),
      resetAt: calculateResetTime(config.resetInterval ?? 'never'),
    };
  }

  private recordToState(
    state: BudgetState,
    usage: TokenUsage,
    totalTokens: number
  ): void {
    state.used += totalTokens;
    state.lastUpdated = new Date();

    const entry: UsageHistoryEntry = {
      id: generateId(),
      budgetId: state.budget.id,
      usage,
      timestamp: new Date(),
      runningTotal: state.used,
    };

    state.history.push(entry);

    // Trim history if too long
    if (state.history.length > 1000) {
      state.history = state.history.slice(-500);
    }
  }

  private calculateStatus(budgetId: string, state: BudgetState): BudgetStatus {
    const limit = state.budget.config.maxTokens;
    const used = state.used;
    const remaining = Math.max(0, limit - used - state.reserved);
    const percentage = (used / limit) * 100;
    const threshold = state.budget.config.warningThreshold ?? 0.8;

    return {
      budgetId,
      name: state.budget.name,
      used,
      limit,
      remaining,
      percentage,
      isWarning: percentage >= threshold * 100,
      isExceeded: used >= limit,
      resetAt: state.budget.resetAt,
      lastUpdated: state.lastUpdated,
    };
  }

  private checkAndNotify(budgetId: string, state: BudgetState): void {
    const status = this.calculateStatus(budgetId, state);

    // Notify usage callbacks
    for (const callback of this.usageCallbacks.values()) {
      try {
        callback(state.history[state.history.length - 1]?.usage ?? {} as TokenUsage, status);
      } catch (error) {
        console.error('Error in usage callback:', error);
      }
    }

    // Notify warning callbacks
    if (status.isWarning && !status.isExceeded) {
      for (const callback of this.warningCallbacks.values()) {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in warning callback:', error);
        }
      }
    }

    // Notify exceeded callbacks
    if (status.isExceeded) {
      for (const callback of this.exceededCallbacks.values()) {
        try {
          callback(status);
        } catch (error) {
          console.error('Error in exceeded callback:', error);
        }
      }
    }
  }

  private scheduleReset(budgetId: string, resetAt?: Date): void {
    if (!resetAt) return;

    // Clear existing timer
    const existing = this.resetTimers.get(budgetId);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = resetAt.getTime() - Date.now();
    if (delay <= 0) return;

    const timer = setTimeout(() => {
      this.resetBudget(budgetId);
    }, delay);

    this.resetTimers.set(budgetId, timer);
  }

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('TokenBudgetManager has been disposed');
    }
  }
}

/**
 * Create a new Token Budget Manager instance
 */
export function createTokenBudgetManager(
  globalConfig?: TokenBudgetConfig
): ITokenBudgetManager {
  return new TokenBudgetManager(globalConfig);
}
