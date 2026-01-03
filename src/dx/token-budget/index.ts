/**
 * Token Budget Manager Module
 *
 * Provides token usage tracking and budget management for LLM operations.
 *
 * Features:
 * - Budget creation and management
 * - Real-time usage tracking
 * - Warning and exceeded notifications
 * - Automatic budget reset
 * - Usage history and analytics
 *
 * @module dx/token-budget
 *
 * @example
 * ```typescript
 * import { createTokenBudgetManager } from '@/dx/token-budget';
 *
 * // Create manager with global budget
 * const manager = createTokenBudgetManager({
 *   maxTokens: 100000,
 *   warningThreshold: 0.8,
 *   resetInterval: 'daily',
 * });
 *
 * // Create task-specific budget
 * const taskBudget = manager.createBudget({
 *   maxTokens: 5000,
 *   name: 'Feature Implementation',
 * });
 *
 * // Subscribe to warnings
 * manager.onWarning((status) => {
 *   console.log(`Warning: ${status.percentage}% of budget used`);
 * });
 *
 * // Record usage
 * manager.recordUsage({
 *   budgetId: taskBudget.id,
 *   inputTokens: 1000,
 *   outputTokens: 500,
 *   operation: 'code-generation',
 * });
 *
 * // Check status
 * const status = manager.checkBudget(taskBudget.id);
 * console.log(`Remaining: ${status.remaining} tokens`);
 * ```
 */

// Interfaces
export {
  type ITokenBudgetManager,
  type TokenBudget,
  type TokenBudgetConfig,
  type TokenUsage,
  type BudgetStatus,
  type BudgetSubscription,
  type UsageHistoryEntry,
  type UsageStats,
  type BudgetScope,
  type ResetInterval,
  BudgetExceededError,
  BudgetNotFoundError,
} from './interfaces/token-budget.interface';

// Implementation
export {
  TokenBudgetManager,
  createTokenBudgetManager,
} from './impl/token-budget-manager.impl';
