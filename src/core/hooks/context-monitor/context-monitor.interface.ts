/**
 * Context Monitor Interfaces
 *
 * Provides context window monitoring and management for LLM operations.
 *
 * @module core/hooks/context-monitor
 */

import { HookConfig } from '../../interfaces/hook.interface.js';
import { BudgetStatus, ILegacyTokenBudgetManager as ITokenBudgetManager } from '../../context/index.js';

/**
 * Context usage level
 */
export enum ContextUsageLevel {
  /** Normal usage (< warning threshold) */
  NORMAL = 'normal',
  /** Warning level (warning threshold ~ critical threshold) */
  WARNING = 'warning',
  /** Critical level (critical threshold ~ overflow threshold) */
  CRITICAL = 'critical',
  /** Overflow level (> overflow threshold) */
  OVERFLOW = 'overflow',
}

/**
 * Context monitor configuration
 */
export interface ContextMonitorConfig extends Partial<HookConfig> {
  /** Warning threshold percentage (0.0 - 1.0), default 0.70 */
  warningThreshold?: number;
  /** Critical threshold percentage (0.0 - 1.0), default 0.85 */
  criticalThreshold?: number;
  /** Overflow threshold percentage (0.0 - 1.0), default 0.95 */
  overflowThreshold?: number;
  /** Auto compact on critical threshold, default true */
  autoCompact?: boolean;
  /** Token budget manager instance */
  tokenBudgetManager?: ITokenBudgetManager;
  /** Budget ID to monitor (optional, uses global if not specified) */
  budgetId?: string;
  /** Maximum context window size (tokens) */
  maxContextSize?: number;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Context usage status
 */
export interface ContextUsageStatus {
  /** Current usage level */
  level: ContextUsageLevel;
  /** Usage percentage (0-100) */
  percentage: number;
  /** Used tokens */
  usedTokens: number;
  /** Maximum tokens */
  maxTokens: number;
  /** Remaining tokens */
  remainingTokens: number;
  /** Whether compaction is recommended */
  shouldCompact: boolean;
  /** Whether operation should be aborted */
  shouldAbort: boolean;
  /** Budget status (if available) */
  budgetStatus?: BudgetStatus;
}

/**
 * Context compaction strategy
 */
export enum CompactionStrategy {
  /** Remove oldest messages */
  REMOVE_OLDEST = 'remove_oldest',
  /** Summarize older messages */
  SUMMARIZE = 'summarize',
  /** Remove redundant information */
  DEDUPLICATE = 'deduplicate',
  /** Hybrid approach */
  HYBRID = 'hybrid',
}

/**
 * Context compaction request
 */
export interface CompactionRequest {
  /** Target usage percentage after compaction */
  targetPercentage: number;
  /** Strategy to use */
  strategy: CompactionStrategy;
  /** Current context data */
  context: unknown;
  /** Tokens to free */
  tokensToFree: number;
}

/**
 * Context compaction result
 */
export interface CompactionResult {
  /** Whether compaction was successful */
  success: boolean;
  /** Tokens freed */
  tokensFreed: number;
  /** New usage percentage */
  newPercentage: number;
  /** Strategy used */
  strategyUsed: CompactionStrategy;
  /** Compacted context */
  compactedContext?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * Context monitor event data
 */
export interface ContextMonitorEventData {
  /** Previous usage status */
  previousStatus?: ContextUsageStatus;
  /** Current usage status */
  currentStatus: ContextUsageStatus;
  /** Threshold that was crossed (if any) */
  thresholdCrossed?: 'warning' | 'critical' | 'overflow';
  /** Compaction request (if applicable) */
  compactionRequest?: CompactionRequest;
  /** Compaction result (if applicable) */
  compactionResult?: CompactionResult;
}

/**
 * Context provider interface for retrieving context information
 */
export interface IContextProvider {
  /**
   * Get current context size in tokens
   */
  getCurrentSize(): number;

  /**
   * Get maximum context size in tokens
   */
  getMaxSize(): number;

  /**
   * Get current context data
   */
  getContext(): unknown;

  /**
   * Set compacted context
   */
  setContext(context: unknown): void;
}

/**
 * Context compactor interface
 */
export interface IContextCompactor {
  /**
   * Compact context to free tokens
   */
  compact(request: CompactionRequest): Promise<CompactionResult>;

  /**
   * Check if compaction is possible
   */
  canCompact(context: unknown): boolean;

  /**
   * Estimate tokens that can be freed
   */
  estimateFreeable(context: unknown): number;
}

/**
 * Context monitor callback types
 */
export type ContextWarningCallback = (status: ContextUsageStatus) => void;
export type ContextCriticalCallback = (status: ContextUsageStatus) => void;
export type ContextOverflowCallback = (status: ContextUsageStatus) => void;
export type ContextCompactionCallback = (result: CompactionResult) => void;

/**
 * Context monitor subscription
 */
export interface ContextMonitorSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONTEXT_MONITOR_CONFIG: Required<
  Omit<ContextMonitorConfig, 'tokenBudgetManager' | 'budgetId' | 'name' | 'description' | 'event' | 'conditions'>
> = {
  priority: 100,
  enabled: true,
  timeout: 5000,
  retryOnError: false,
  warningThreshold: 0.7,
  criticalThreshold: 0.85,
  overflowThreshold: 0.95,
  autoCompact: true,
  maxContextSize: 128000, // Default for Claude models
  verbose: false,
};
