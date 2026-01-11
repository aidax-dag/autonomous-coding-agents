/**
 * Token Optimizer Interfaces
 *
 * Provides token optimization and output compression for LLM operations.
 *
 * @module core/hooks/token-optimizer
 */

import { HookConfig } from '../../interfaces/hook.interface.js';
import { ITokenBudgetManager } from '../../../dx/token-budget/index.js';

/**
 * Optimization strategy
 */
export enum OptimizationStrategy {
  /** Remove extra whitespace and normalize spacing */
  WHITESPACE = 'whitespace',
  /** Remove duplicate content */
  DEDUPLICATE = 'deduplicate',
  /** Truncate content to max length */
  TRUNCATE = 'truncate',
  /** Remove empty lines */
  REMOVE_EMPTY_LINES = 'remove_empty_lines',
  /** Compress code blocks */
  COMPRESS_CODE = 'compress_code',
  /** Remove verbose comments */
  REMOVE_COMMENTS = 'remove_comments',
  /** Apply all strategies */
  ALL = 'all',
}

/**
 * Content type for optimization context
 */
export enum ContentType {
  /** Plain text */
  TEXT = 'text',
  /** Source code */
  CODE = 'code',
  /** Markdown content */
  MARKDOWN = 'markdown',
  /** JSON data */
  JSON = 'json',
  /** Mixed content */
  MIXED = 'mixed',
}

/**
 * Token optimizer configuration
 */
export interface TokenOptimizerConfig extends Partial<HookConfig> {
  /** Optimization strategies to apply (default: [WHITESPACE, REMOVE_EMPTY_LINES]) */
  strategies?: OptimizationStrategy[];
  /** Maximum output tokens (0 = no limit) */
  maxOutputTokens?: number;
  /** Truncation suffix when content is cut (default: '...') */
  truncationSuffix?: string;
  /** Minimum tokens saved to apply optimization (default: 10) */
  minTokensSaved?: number;
  /** Token budget manager for tracking */
  tokenBudgetManager?: ITokenBudgetManager;
  /** Budget ID to track savings */
  budgetId?: string;
  /** Characters per token estimate (default: 4) */
  charsPerToken?: number;
  /** Preserve code blocks during optimization (default: true) */
  preserveCodeBlocks?: boolean;
  /** Preserve markdown formatting (default: true) */
  preserveMarkdown?: boolean;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  /** Whether optimization was applied */
  optimized: boolean;
  /** Original content */
  originalContent: string;
  /** Optimized content */
  optimizedContent: string;
  /** Original token count (estimated) */
  originalTokens: number;
  /** Optimized token count (estimated) */
  optimizedTokens: number;
  /** Tokens saved */
  tokensSaved: number;
  /** Savings percentage (0-100) */
  savingsPercentage: number;
  /** Strategies applied */
  strategiesApplied: OptimizationStrategy[];
  /** Content type detected */
  contentType: ContentType;
  /** Whether content was truncated */
  wasTruncated: boolean;
  /** Processing time in milliseconds */
  processingTimeMs: number;
}

/**
 * Optimization metrics
 */
export interface OptimizationMetrics {
  /** Total optimizations performed */
  totalOptimizations: number;
  /** Total tokens saved */
  totalTokensSaved: number;
  /** Average savings percentage */
  averageSavingsPercentage: number;
  /** Total content truncations */
  totalTruncations: number;
  /** Strategy usage counts */
  strategyUsage: Record<OptimizationStrategy, number>;
  /** Total processing time in milliseconds */
  totalProcessingTimeMs: number;
}

/**
 * Token optimizer event data
 */
export interface TokenOptimizerEventData {
  /** Optimization result */
  result: OptimizationResult;
  /** Current metrics */
  metrics: OptimizationMetrics;
}

/**
 * Content optimizer interface
 */
export interface IContentOptimizer {
  /**
   * Optimize content using specified strategies
   */
  optimize(content: string, strategies: OptimizationStrategy[]): string;

  /**
   * Detect content type
   */
  detectContentType(content: string): ContentType;

  /**
   * Estimate token count for content
   */
  estimateTokens(content: string): number;
}

/**
 * Optimization callback types
 */
export type OptimizationAppliedCallback = (result: OptimizationResult) => void;
export type TokensSavedCallback = (tokensSaved: number, total: number) => void;
export type TruncationCallback = (originalLength: number, truncatedLength: number) => void;

/**
 * Token optimizer subscription
 */
export interface TokenOptimizerSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Default configuration values
 */
export const DEFAULT_TOKEN_OPTIMIZER_CONFIG: Required<
  Omit<TokenOptimizerConfig, 'tokenBudgetManager' | 'budgetId' | 'name' | 'description' | 'event' | 'conditions'>
> = {
  priority: 90,
  enabled: true,
  timeout: 5000,
  retryOnError: false,
  strategies: [OptimizationStrategy.WHITESPACE, OptimizationStrategy.REMOVE_EMPTY_LINES],
  maxOutputTokens: 0,
  truncationSuffix: '...',
  minTokensSaved: 10,
  charsPerToken: 4,
  preserveCodeBlocks: true,
  preserveMarkdown: true,
  verbose: false,
};
