/**
 * Token Budget Manager Interfaces
 *
 * Provides token usage tracking and budget management for LLM operations.
 *
 * @module dx/token-budget/interfaces
 */

/**
 * Token budget scope
 */
export type BudgetScope = 'global' | 'agent' | 'task' | 'session';

/**
 * Reset interval for budgets
 */
export type ResetInterval = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'never';

/**
 * Token budget configuration
 */
export interface TokenBudgetConfig {
  /** Maximum tokens allowed */
  maxTokens: number;
  /** Warning threshold (0.0 - 1.0), default 0.8 */
  warningThreshold?: number;
  /** When to reset the budget */
  resetInterval?: ResetInterval;
  /** Budget scope */
  scope?: BudgetScope;
  /** Optional name for identification */
  name?: string;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Token budget instance
 */
export interface TokenBudget {
  /** Unique identifier */
  readonly id: string;
  /** Budget name */
  readonly name: string;
  /** Configuration */
  readonly config: TokenBudgetConfig;
  /** Creation timestamp */
  readonly createdAt: Date;
  /** Next reset timestamp (if applicable) */
  readonly resetAt?: Date;
}

/**
 * Token usage record
 */
export interface TokenUsage {
  /** Budget ID to charge */
  budgetId?: string;
  /** Input tokens used */
  inputTokens: number;
  /** Output tokens used */
  outputTokens: number;
  /** Total tokens (computed if not provided) */
  totalTokens?: number;
  /** Operation that consumed tokens */
  operation?: string;
  /** Agent ID (if applicable) */
  agentId?: string;
  /** Task ID (if applicable) */
  taskId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Budget status
 */
export interface BudgetStatus {
  /** Budget identifier */
  budgetId: string;
  /** Budget name */
  name: string;
  /** Tokens used */
  used: number;
  /** Token limit */
  limit: number;
  /** Remaining tokens */
  remaining: number;
  /** Usage percentage (0-100) */
  percentage: number;
  /** Whether warning threshold exceeded */
  isWarning: boolean;
  /** Whether budget exceeded */
  isExceeded: boolean;
  /** Next reset time */
  resetAt?: Date;
  /** Last update time */
  lastUpdated: Date;
}

/**
 * Usage history entry
 */
export interface UsageHistoryEntry {
  /** Entry ID */
  id: string;
  /** Budget ID */
  budgetId: string;
  /** Token usage */
  usage: TokenUsage;
  /** Timestamp */
  timestamp: Date;
  /** Running total after this entry */
  runningTotal: number;
}

/**
 * Subscription handle for cleanup
 */
export interface BudgetSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Token Budget Manager Interface
 *
 * Manages token budgets and usage tracking
 */
export interface ITokenBudgetManager {
  // === Budget Management ===

  /**
   * Create a new token budget
   */
  createBudget(config: TokenBudgetConfig): TokenBudget;

  /**
   * Get a budget by ID
   */
  getBudget(budgetId: string): TokenBudget | undefined;

  /**
   * Delete a budget
   */
  deleteBudget(budgetId: string): boolean;

  /**
   * List all budgets
   */
  listBudgets(): TokenBudget[];

  /**
   * Update budget configuration
   */
  updateBudget(budgetId: string, config: Partial<TokenBudgetConfig>): TokenBudget | undefined;

  // === Usage Tracking ===

  /**
   * Record token usage
   */
  recordUsage(usage: TokenUsage): void;

  /**
   * Get budget status
   */
  checkBudget(budgetId?: string): BudgetStatus;

  /**
   * Get remaining budget tokens
   */
  getRemainingBudget(budgetId?: string): number;

  /**
   * Check if budget allows operation
   */
  canAfford(budgetId: string | undefined, tokens: number): boolean;

  // === Budget-Scoped Execution ===

  /**
   * Execute an operation within a budget context
   */
  withBudget<T>(
    budget: TokenBudget | string,
    operation: () => Promise<T>
  ): Promise<T>;

  /**
   * Reserve tokens before operation
   */
  reserveTokens(budgetId: string, tokens: number): boolean;

  /**
   * Release reserved tokens
   */
  releaseReservedTokens(budgetId: string, tokens: number): void;

  // === History & Analytics ===

  /**
   * Get usage history
   */
  getHistory(budgetId?: string, limit?: number): UsageHistoryEntry[];

  /**
   * Get aggregated usage stats
   */
  getUsageStats(budgetId?: string, period?: 'hour' | 'day' | 'week' | 'month'): UsageStats;

  /**
   * Reset budget usage
   */
  resetBudget(budgetId: string): void;

  // === Events ===

  /**
   * Subscribe to warning events
   */
  onWarning(callback: (status: BudgetStatus) => void): BudgetSubscription;

  /**
   * Subscribe to exceeded events
   */
  onExceeded(callback: (status: BudgetStatus) => void): BudgetSubscription;

  /**
   * Subscribe to usage events
   */
  onUsage(callback: (usage: TokenUsage, status: BudgetStatus) => void): BudgetSubscription;

  // === Lifecycle ===

  /**
   * Get global budget status
   */
  getGlobalStatus(): BudgetStatus;

  /**
   * Dispose of resources
   */
  dispose(): void;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  /** Budget ID (or 'global') */
  budgetId: string;
  /** Time period */
  period: 'hour' | 'day' | 'week' | 'month';
  /** Total tokens used */
  totalTokens: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Number of operations */
  operationCount: number;
  /** Average tokens per operation */
  averagePerOperation: number;
  /** Peak usage */
  peakUsage: number;
  /** Time of peak usage */
  peakAt?: Date;
}

/**
 * Budget exceeded error
 */
export class BudgetExceededError extends Error {
  constructor(
    public readonly budgetId: string,
    public readonly status: BudgetStatus
  ) {
    super(`Token budget exceeded for ${budgetId}: ${status.used}/${status.limit} tokens used`);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Budget not found error
 */
export class BudgetNotFoundError extends Error {
  constructor(public readonly budgetId: string) {
    super(`Token budget not found: ${budgetId}`);
    this.name = 'BudgetNotFoundError';
  }
}
