/**
 * Output Optimizer Interfaces
 *
 * Provides token-aware output truncation and optimization for LLM operations.
 * Inspired by oh-my-opencode's dynamic-truncator pattern.
 *
 * @module dx/output-optimizer/interfaces
 */

/**
 * Token estimation strategy
 */
export type TokenEstimationStrategy = 'char_ratio' | 'tiktoken' | 'custom';

/**
 * Truncation mode
 */
export type TruncationMode = 'head' | 'tail' | 'middle' | 'smart';

/**
 * Output optimizer configuration
 */
export interface OutputOptimizerConfig {
  /** Characters per token estimate (default: 4) */
  charsPerToken: number;
  /** Default maximum tokens for output (default: 50000) */
  defaultMaxTokens: number;
  /** Number of header lines to preserve (default: 3) */
  preserveHeaderLines: number;
  /** Context window headroom percentage (default: 0.5) */
  headroomPercent: number;
  /** Token estimation strategy */
  estimationStrategy: TokenEstimationStrategy;
  /** Truncation mode */
  truncationMode: TruncationMode;
  /** Tool-specific token limits */
  toolLimits: Record<string, number>;
}

/**
 * Truncation result
 */
export interface TruncationResult {
  /** Resulting output after truncation */
  result: string;
  /** Whether truncation was applied */
  truncated: boolean;
  /** Original token count (estimated) */
  originalTokens?: number;
  /** Final token count (estimated) */
  finalTokens?: number;
  /** Number of lines/items removed */
  removedCount?: number;
  /** Truncation reason */
  reason?: string;
}

/**
 * Truncation options
 */
export interface TruncationOptions {
  /** Target maximum tokens */
  targetMaxTokens?: number;
  /** Lines to preserve at the start */
  preserveHeaderLines?: number;
  /** Lines to preserve at the end */
  preserveTailLines?: number;
  /** Truncation mode override */
  mode?: TruncationMode;
  /** Context for smart truncation */
  context?: TruncationContext;
}

/**
 * Context for smart truncation decisions
 */
export interface TruncationContext {
  /** Tool name that generated the output */
  toolName?: string;
  /** Current context window usage (0-1) */
  contextUsage?: number;
  /** Remaining context tokens */
  remainingTokens?: number;
  /** Content type hint */
  contentType?: 'code' | 'text' | 'json' | 'log' | 'structured';
}

/**
 * Context window usage information
 */
export interface ContextWindowUsage {
  /** Total tokens used */
  usedTokens: number;
  /** Remaining tokens available */
  remainingTokens: number;
  /** Usage percentage (0-1) */
  usagePercentage: number;
  /** Context window limit */
  limit: number;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Cached tokens */
  cachedTokens: number;
}

/**
 * Summarization result
 */
export interface SummarizationResult {
  /** Summarized content */
  summary: string;
  /** Original token count */
  originalTokens: number;
  /** Summary token count */
  summaryTokens: number;
  /** Compression ratio */
  compressionRatio: number;
  /** Key points extracted */
  keyPoints?: string[];
}

/**
 * Output Optimizer Interface
 *
 * Manages output optimization with token-aware truncation and summarization.
 */
export interface IOutputOptimizer {
  // === Token Estimation ===

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number;

  /**
   * Estimate tokens for multiple texts
   */
  estimateTokensBatch(texts: string[]): number[];

  // === Truncation ===

  /**
   * Truncate output to token limit
   */
  truncate(output: string, options?: TruncationOptions): TruncationResult;

  /**
   * Truncate with dynamic context awareness
   */
  truncateDynamic(
    output: string,
    contextUsage: ContextWindowUsage,
    options?: TruncationOptions
  ): TruncationResult;

  /**
   * Get tool-specific truncation limit
   */
  getToolLimit(toolName: string): number;

  /**
   * Set tool-specific truncation limit
   */
  setToolLimit(toolName: string, maxTokens: number): void;

  // === Summarization ===

  /**
   * Summarize long output (async, uses LLM)
   */
  summarize(output: string, maxTokens: number): Promise<SummarizationResult>;

  /**
   * Extract key information from output
   */
  extractKeyInfo(output: string, maxItems?: number): Promise<string[]>;

  // === Context Management ===

  /**
   * Calculate optimal output size based on context
   */
  calculateOptimalSize(
    contextUsage: ContextWindowUsage,
    targetHeadroom?: number
  ): number;

  /**
   * Check if output needs optimization
   */
  needsOptimization(
    output: string,
    contextUsage?: ContextWindowUsage
  ): boolean;

  // === Configuration ===

  /**
   * Get current configuration
   */
  getConfig(): OutputOptimizerConfig;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OutputOptimizerConfig>): void;

  // === Statistics ===

  /**
   * Get optimization statistics
   */
  getStats(): OutputOptimizerStats;

  /**
   * Reset statistics
   */
  resetStats(): void;
}

/**
 * Output optimizer statistics
 */
export interface OutputOptimizerStats {
  /** Total outputs processed */
  totalProcessed: number;
  /** Outputs that were truncated */
  truncatedCount: number;
  /** Outputs that were summarized */
  summarizedCount: number;
  /** Total tokens saved */
  tokensSaved: number;
  /** Average compression ratio */
  averageCompressionRatio: number;
  /** Processing time statistics */
  processingTime: {
    total: number;
    average: number;
    max: number;
  };
}

/**
 * Default tool token limits
 *
 * Tool-specific limits based on typical output sizes and importance.
 */
export const DEFAULT_TOOL_LIMITS: Record<string, number> = {
  // Aggressive limits for web content
  webfetch: 10_000,
  WebFetch: 10_000,

  // Standard limits for search/analysis
  grep: 50_000,
  Grep: 50_000,
  glob: 30_000,
  Glob: 30_000,

  // Higher limits for code
  read: 100_000,
  Read: 100_000,

  // Default for unknown tools
  default: 50_000,
};

/**
 * Context window limits by provider
 */
export const CONTEXT_WINDOW_LIMITS: Record<string, number> = {
  anthropic: 200_000,
  'anthropic-1m': 1_000_000,
  openai: 128_000,
  'openai-gpt4': 8_192,
  default: 128_000,
};
