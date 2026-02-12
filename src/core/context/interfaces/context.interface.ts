/**
 * Context Module Interfaces
 *
 * Unified interfaces for context management, token budgets,
 * output optimization, and compression strategies.
 *
 * @module core/context/interfaces
 */

import type {
  QualityLevel,
  QualityLevelInfo,
  ContextState,
  CompressionStrategy as QualityCompressionStrategy,
} from './quality-curve.interface';

// ============================================================================
// Token Budget Types
// ============================================================================

/**
 * Token budget configuration for ContextManager
 */
export interface TokenBudgetConfig {
  /** Maximum tokens allowed */
  maxTokens: number;
  /** Warning threshold percentage (0-100) */
  warningThreshold: number;
  /** Critical threshold percentage (0-100) */
  criticalThreshold: number;
  /** Reserved tokens for response */
  reserveTokens: number;
}

/**
 * Token usage statistics
 */
export interface TokenUsageStats {
  /** Total tokens available */
  total: number;
  /** Tokens used */
  used: number;
  /** Tokens remaining */
  remaining: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Reserved tokens */
  reserved: number;
  /** Available tokens (remaining - reserved) */
  available: number;
}

// ============================================================================
// Output Optimizer Types
// ============================================================================

/**
 * Output optimizer configuration
 */
export interface OutputOptimizerConfig {
  /** Whether optimizer is enabled */
  enabled: boolean;
  /** Maximum output length in tokens */
  maxOutputLength: number;
  /** Compression level */
  compressionLevel: CompressionLevel;
  /** Preserve code blocks during compression */
  preserveCodeBlocks: boolean;
  /** Preserve important information markers */
  preserveImportantInfo: boolean;
}

/**
 * Compression level
 */
export type CompressionLevel = 'none' | 'light' | 'moderate' | 'aggressive';

/**
 * Compression result
 */
export interface CompressionResult {
  /** Original content */
  original: string;
  /** Compressed content */
  compressed: string;
  /** Original token count (estimated) */
  originalTokens: number;
  /** Compressed token count (estimated) */
  compressedTokens: number;
  /** Tokens saved */
  savedTokens: number;
  /** Compression ratio (0-1) */
  compressionRatio: number;
  /** Techniques applied */
  techniques: string[];
}

/**
 * Summarization request
 */
export interface SummarizationRequest {
  /** Content to summarize */
  content: string;
  /** Target token count */
  targetTokens: number;
  /** Keywords to preserve */
  preserveKeys?: string[];
  /** Additional context */
  context?: string;
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  /** Compression level */
  level: CompressionLevel;
  /** Preserve code blocks */
  preserveCodeBlocks: boolean;
  /** Compression techniques to apply */
  techniques: string[];
}

// ============================================================================
// Context Monitor Types
// ============================================================================

/**
 * Context monitor configuration
 */
export interface ContextMonitorConfig {
  /** Whether monitoring is enabled */
  enabled: boolean;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Check interval in milliseconds */
  checkInterval: number;
}

/**
 * Monitor callback configuration
 */
export interface MonitorCallbacks {
  /** Called when usage reaches warning threshold */
  onWarning?: (stats: TokenUsageStats) => void;
  /** Called when usage reaches critical threshold */
  onCritical?: (stats: TokenUsageStats) => void;
  /** Called when quality level degrades */
  onQualityDegraded?: (level: QualityLevel) => void;
}

// ============================================================================
// Context Event Types
// ============================================================================

/**
 * Context event types
 */
export type ContextEvent =
  | 'usage-warning'
  | 'usage-critical'
  | 'quality-degraded'
  | 'budget-exceeded'
  | 'compression-applied';

/**
 * Context event handler
 */
export type ContextEventHandler = (data: ContextEventData) => void;

/**
 * Context event data
 */
export interface ContextEventData {
  /** Event type */
  event: ContextEvent;
  /** Event timestamp */
  timestamp: Date;
  /** Current usage stats */
  usageStats: TokenUsageStats;
  /** Current quality level */
  qualityLevel: QualityLevel;
  /** Event message */
  message: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

// ============================================================================
// Compaction Types
// ============================================================================

/**
 * Compaction strategy type
 */
export type CompactionStrategyType =
  | 'remove_oldest'
  | 'summarize'
  | 'deduplicate'
  | 'hybrid';

/**
 * Compaction request
 */
export interface CompactionRequest {
  /** Content to compact */
  content: string;
  /** Target token reduction */
  targetReduction: number;
  /** Strategy to use */
  strategy?: CompactionStrategyType;
  /** Preserve patterns (regex) */
  preservePatterns?: RegExp[];
}

/**
 * Compaction result
 */
export interface CompactionResult {
  /** Whether compaction was successful */
  success: boolean;
  /** Compacted content */
  content: string;
  /** Tokens freed */
  tokensFreed: number;
  /** Strategy used */
  strategyUsed: CompactionStrategyType;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Context Manager Configuration
// ============================================================================

/**
 * Quality curve configuration
 */
export interface QualityCurveConfig {
  /** Whether quality curve is enabled */
  enabled: boolean;
  /** Auto-adjust compression based on quality level */
  autoAdjust: boolean;
}

/**
 * Unified context manager configuration
 */
export interface ContextManagerConfig {
  /** Token budget configuration */
  tokenBudget: TokenBudgetConfig;
  /** Output optimizer configuration */
  outputOptimizer: OutputOptimizerConfig;
  /** Quality curve configuration */
  qualityCurve: QualityCurveConfig;
  /** Monitoring configuration */
  monitoring: ContextMonitorConfig;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Token Budget Manager Interface
 */
export interface ITokenBudgetManager {
  /** Get used tokens */
  getUsedTokens(): number;
  /** Get maximum tokens */
  getMaxTokens(): number;
  /** Set maximum tokens */
  setMaxTokens(max: number): void;
  /** Add tokens to usage */
  addTokens(count: number): void;
  /** Release tokens from usage */
  releaseTokens(count: number): void;
  /** Check if can afford tokens */
  canAfford(tokens: number): boolean;
  /** Configure the manager */
  configure(config: Partial<TokenBudgetConfig>): void;
  /** Reset usage to zero */
  reset(): void;
}

/**
 * Output Optimizer Interface
 */
export interface IOutputOptimizer {
  /** Optimize output with compression */
  optimize(output: string, options: OptimizationOptions): Promise<CompressionResult>;
  /** Summarize content */
  summarize(request: SummarizationRequest): Promise<string>;
  /** Estimate token count */
  estimateTokens(text: string): number;
  /** Configure the optimizer */
  configure(config: Partial<OutputOptimizerConfig>): void;
}

/**
 * Context Monitor Interface
 */
export interface IContextMonitor {
  /** Check context state and trigger events */
  check(stats: TokenUsageStats, level: QualityLevel): void;
  /** Start monitoring */
  start(): void;
  /** Stop monitoring */
  stop(): void;
  /** Configure the monitor */
  configure(config: Partial<ContextMonitorConfig>): void;
}

/**
 * Compaction Strategy Interface
 */
export interface ICompactionStrategy {
  /** Apply compaction to content */
  apply(content: string, strategy: QualityCompressionStrategy): Promise<string>;
  /** Estimate tokens that can be saved */
  estimateSavings(content: string, strategy: QualityCompressionStrategy): number;
  /** Check if compaction is applicable */
  canApply(content: string): boolean;
}

/**
 * Context Manager Interface
 *
 * Unified interface for all context management operations.
 */
export interface IContextManager {
  // === Token Budget Management ===

  /** Get current usage statistics */
  getUsageStats(): TokenUsageStats;
  /** Set maximum token budget */
  setMaxTokens(max: number): void;
  /** Add tokens to usage count */
  addTokens(count: number): void;
  /** Release tokens from usage count */
  releaseTokens(count: number): void;
  /** Check if required tokens are available */
  hasAvailableTokens(required: number): boolean;

  // === Quality Management ===

  /** Get current quality level */
  getQualityLevel(): QualityLevel;
  /** Get quality level information */
  getQualityInfo(): QualityLevelInfo;
  /** Get full context state */
  getContextState(): ContextState;
  /** Check if new plan should be started */
  shouldStartNewPlan(): boolean;

  // === Output Optimization ===

  /** Optimize output with compression */
  optimizeOutput(output: string): Promise<CompressionResult>;
  /** Set compression level */
  setCompressionLevel(level: CompressionLevel): void;
  /** Summarize content */
  summarize(request: SummarizationRequest): Promise<string>;

  // === Compression Strategy ===

  /** Get current compression strategy */
  getCompressionStrategy(): QualityCompressionStrategy;
  /** Apply compression to content */
  applyCompression(content: string): Promise<string>;

  // === Events ===

  /** Subscribe to context event */
  on(event: ContextEvent, handler: ContextEventHandler): void;
  /** Unsubscribe from context event */
  off(event: ContextEvent, handler: ContextEventHandler): void;

  // === Configuration ===

  /** Update configuration */
  configure(config: Partial<ContextManagerConfig>): void;
  /** Get current configuration */
  getConfig(): ContextManagerConfig;

  // === Lifecycle ===

  /** Dispose resources */
  dispose(): void;
}

// ============================================================================
// Legacy Token Budget Types (migrated from dx/token-budget)
// ============================================================================

/**
 * Budget status (legacy dx/token-budget type)
 */
export interface BudgetStatus {
  budgetId: string;
  name: string;
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  isWarning: boolean;
  isExceeded: boolean;
  resetAt?: Date;
  lastUpdated: Date;
}

/**
 * Budget subscription handle (legacy dx/token-budget type)
 */
export interface BudgetSubscription {
  id: string;
  unsubscribe(): void;
}

/**
 * Legacy Token Budget Manager Interface (migrated from dx/token-budget)
 *
 * Used by hooks (context-monitor, token-optimizer) for budget-aware operations.
 * New code should use the simpler ITokenBudgetManager above.
 */
export interface ILegacyTokenBudgetManager {
  checkBudget(budgetId?: string): BudgetStatus;
  getRemainingBudget(budgetId?: string): number;
  canAfford(budgetId: string | undefined, tokens: number): boolean;
  getGlobalStatus(): BudgetStatus;
  onWarning(callback: (status: BudgetStatus) => void): BudgetSubscription;
  onExceeded(callback: (status: BudgetStatus) => void): BudgetSubscription;
  dispose(): void;
}

// ============================================================================
// Re-exports from quality-curve for convenience
// ============================================================================

export type { QualityLevel, QualityLevelInfo, ContextState };
