/**
 * Token Optimizer Hook
 *
 * Optimizes LLM output to reduce token usage.
 *
 * @module core/hooks/token-optimizer
 */

import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult } from '../../interfaces/hook.interface.js';
import { ITokenBudgetManager } from '../../../dx/token-budget/index.js';
import { createLogger, ILogger } from '../../services/logger.js';
import {
  TokenOptimizerConfig,
  OptimizationStrategy,
  ContentType,
  OptimizationResult,
  OptimizationMetrics,
  TokenOptimizerEventData,
  IContentOptimizer,
  OptimizationAppliedCallback,
  TokensSavedCallback,
  TruncationCallback,
  TokenOptimizerSubscription,
  DEFAULT_TOKEN_OPTIMIZER_CONFIG,
} from './token-optimizer.interface.js';

/**
 * Token Optimizer Hook
 *
 * Optimizes LLM output to reduce token usage:
 * - Removes extra whitespace
 * - Deduplicates content
 * - Truncates long outputs
 * - Compresses code blocks
 */
export class TokenOptimizerHook
  extends BaseHook<unknown, TokenOptimizerEventData>
  implements IContentOptimizer
{
  readonly name = 'token-optimizer';
  readonly description = 'Optimizes LLM output to reduce token usage';
  readonly event = HookEvent.TASK_AFTER;

  private readonly strategies: OptimizationStrategy[];
  private readonly maxOutputTokens: number;
  private readonly truncationSuffix: string;
  private readonly minTokensSaved: number;
  private readonly charsPerToken: number;
  private readonly preserveCodeBlocks: boolean;
  private readonly _preserveMarkdown: boolean;
  private readonly verbose: boolean;

  private _tokenBudgetManager?: ITokenBudgetManager;
  private _budgetId?: string;

  private metrics: OptimizationMetrics = {
    totalOptimizations: 0,
    totalTokensSaved: 0,
    averageSavingsPercentage: 0,
    totalTruncations: 0,
    strategyUsage: {} as Record<OptimizationStrategy, number>,
    totalProcessingTimeMs: 0,
  };

  private subscriptions: Map<string, TokenOptimizerSubscription> = new Map();
  private subscriptionCounter = 0;

  // Event callbacks
  private optimizationCallbacks: OptimizationAppliedCallback[] = [];
  private tokensSavedCallbacks: TokensSavedCallback[] = [];
  private truncationCallbacks: TruncationCallback[] = [];

  // Logger
  private readonly logger: ILogger;

  constructor(config?: TokenOptimizerConfig) {
    super(config);

    this.logger = createLogger('TokenOptimizer');

    const mergedConfig = { ...DEFAULT_TOKEN_OPTIMIZER_CONFIG, ...config };

    this.strategies = mergedConfig.strategies;
    this.maxOutputTokens = mergedConfig.maxOutputTokens;
    this.truncationSuffix = mergedConfig.truncationSuffix;
    this.minTokensSaved = mergedConfig.minTokensSaved;
    this.charsPerToken = mergedConfig.charsPerToken;
    this.preserveCodeBlocks = mergedConfig.preserveCodeBlocks;
    this._preserveMarkdown = mergedConfig.preserveMarkdown;
    this.verbose = mergedConfig.verbose;

    this._tokenBudgetManager = config?.tokenBudgetManager;
    this._budgetId = config?.budgetId;

    // Initialize strategy usage counts
    Object.values(OptimizationStrategy).forEach((strategy) => {
      this.metrics.strategyUsage[strategy] = 0;
    });
  }

  /**
   * Set token budget manager
   */
  setTokenBudgetManager(manager: ITokenBudgetManager): void {
    this._tokenBudgetManager = manager;
  }

  /**
   * Set budget ID
   */
  setBudgetId(budgetId: string): void {
    this._budgetId = budgetId;
  }

  /**
   * Execute hook - optimize output content
   */
  async execute(context: HookContext<unknown>): Promise<HookResult<TokenOptimizerEventData>> {
    const content = this.extractContent(context);
    if (!content) {
      return this.continue(undefined, 'No content to optimize');
    }

    const startTime = Date.now();
    const result = this.optimizeContent(content);
    result.processingTimeMs = Date.now() - startTime;

    // Update metrics
    this.updateMetrics(result);

    // Notify callbacks
    this.notifyOptimization(result);
    if (result.tokensSaved > 0) {
      this.notifyTokensSaved(result.tokensSaved, this.metrics.totalTokensSaved);
    }
    if (result.wasTruncated) {
      this.notifyTruncation(result.originalTokens, result.optimizedTokens);
    }

    const eventData: TokenOptimizerEventData = {
      result,
      metrics: { ...this.metrics },
    };

    if (result.optimized && result.tokensSaved >= this.minTokensSaved) {
      this.log(
        `Optimized: saved ${result.tokensSaved} tokens (${result.savingsPercentage.toFixed(1)}%)`
      );
      return this.modify(eventData, `Saved ${result.tokensSaved} tokens`);
    }

    return this.continue(eventData, 'No significant optimization possible');
  }

  /**
   * Optimize content using specified strategies
   */
  optimize(content: string, strategies: OptimizationStrategy[]): string {
    let optimized = content;

    const effectiveStrategies = strategies.includes(OptimizationStrategy.ALL)
      ? Object.values(OptimizationStrategy).filter((s) => s !== OptimizationStrategy.ALL)
      : strategies;

    for (const strategy of effectiveStrategies) {
      optimized = this.applyStrategy(optimized, strategy);
    }

    return optimized;
  }

  /**
   * Detect content type
   */
  detectContentType(content: string): ContentType {
    // Check for JSON
    if (this.looksLikeJson(content)) {
      return ContentType.JSON;
    }

    // Check for mixed content (code blocks in text) - check before pure code
    if (content.includes('```')) {
      return ContentType.MIXED;
    }

    // Check for code
    if (this.looksLikeCode(content)) {
      return ContentType.CODE;
    }

    // Check for markdown
    if (this.looksLikeMarkdown(content)) {
      return ContentType.MARKDOWN;
    }

    // Check for inline code
    if (content.includes('`')) {
      return ContentType.MIXED;
    }

    return ContentType.TEXT;
  }

  /**
   * Estimate token count for content
   */
  estimateTokens(content: string): number {
    return Math.ceil(content.length / this.charsPerToken);
  }

  /**
   * Get current metrics
   */
  getMetrics(): OptimizationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalOptimizations: 0,
      totalTokensSaved: 0,
      averageSavingsPercentage: 0,
      totalTruncations: 0,
      strategyUsage: {} as Record<OptimizationStrategy, number>,
      totalProcessingTimeMs: 0,
    };

    Object.values(OptimizationStrategy).forEach((strategy) => {
      this.metrics.strategyUsage[strategy] = 0;
    });
  }

  /**
   * Get configuration
   */
  getOptimizerConfig(): {
    strategies: OptimizationStrategy[];
    maxOutputTokens: number;
    minTokensSaved: number;
    charsPerToken: number;
    preserveMarkdown: boolean;
    budgetId: string | undefined;
    hasTokenBudgetManager: boolean;
  } {
    return {
      strategies: [...this.strategies],
      maxOutputTokens: this.maxOutputTokens,
      minTokensSaved: this.minTokensSaved,
      charsPerToken: this.charsPerToken,
      preserveMarkdown: this._preserveMarkdown,
      budgetId: this._budgetId,
      hasTokenBudgetManager: !!this._tokenBudgetManager,
    };
  }

  /**
   * Subscribe to optimization events
   */
  onOptimization(callback: OptimizationAppliedCallback): TokenOptimizerSubscription {
    this.optimizationCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.optimizationCallbacks.indexOf(callback);
      if (index > -1) this.optimizationCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to tokens saved events
   */
  onTokensSaved(callback: TokensSavedCallback): TokenOptimizerSubscription {
    this.tokensSavedCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.tokensSavedCallbacks.indexOf(callback);
      if (index > -1) this.tokensSavedCallbacks.splice(index, 1);
    });
  }

  /**
   * Subscribe to truncation events
   */
  onTruncation(callback: TruncationCallback): TokenOptimizerSubscription {
    this.truncationCallbacks.push(callback);
    return this.createSubscription(() => {
      const index = this.truncationCallbacks.indexOf(callback);
      if (index > -1) this.truncationCallbacks.splice(index, 1);
    });
  }

  /**
   * Dispose subscriptions
   */
  dispose(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.clear();
    this.optimizationCallbacks = [];
    this.tokensSavedCallbacks = [];
    this.truncationCallbacks = [];
  }

  // === Private Methods ===

  private extractContent(context: HookContext<unknown>): string | undefined {
    const data = context.data as Record<string, unknown>;

    // Try common content fields
    if (typeof data?.content === 'string') {
      return data.content;
    }
    if (typeof data?.output === 'string') {
      return data.output;
    }
    if (typeof data?.result === 'string') {
      return data.result;
    }
    if (typeof data?.response === 'string') {
      return data.response;
    }
    if (typeof data?.text === 'string') {
      return data.text;
    }

    return undefined;
  }

  private optimizeContent(content: string): OptimizationResult {
    const originalTokens = this.estimateTokens(content);
    const contentType = this.detectContentType(content);
    const strategiesApplied: OptimizationStrategy[] = [];

    let optimized = content;
    let wasTruncated = false;

    // Apply strategies
    for (const strategy of this.strategies) {
      if (strategy === OptimizationStrategy.ALL) {
        // Apply all strategies except ALL itself
        for (const s of Object.values(OptimizationStrategy)) {
          if (s !== OptimizationStrategy.ALL) {
            const before = optimized;
            optimized = this.applyStrategy(optimized, s);
            if (optimized !== before) {
              strategiesApplied.push(s);
            }
          }
        }
      } else {
        const before = optimized;
        optimized = this.applyStrategy(optimized, strategy);
        if (optimized !== before) {
          strategiesApplied.push(strategy);
        }
      }
    }

    // Apply truncation if needed
    if (this.maxOutputTokens > 0) {
      const currentTokens = this.estimateTokens(optimized);
      if (currentTokens > this.maxOutputTokens) {
        optimized = this.truncateToTokens(optimized, this.maxOutputTokens);
        wasTruncated = true;
        if (!strategiesApplied.includes(OptimizationStrategy.TRUNCATE)) {
          strategiesApplied.push(OptimizationStrategy.TRUNCATE);
        }
      }
    }

    const optimizedTokens = this.estimateTokens(optimized);
    const tokensSaved = originalTokens - optimizedTokens;
    const savingsPercentage =
      originalTokens > 0 ? (tokensSaved / originalTokens) * 100 : 0;

    return {
      optimized: tokensSaved > 0,
      originalContent: content,
      optimizedContent: optimized,
      originalTokens,
      optimizedTokens,
      tokensSaved,
      savingsPercentage,
      strategiesApplied,
      contentType,
      wasTruncated,
      processingTimeMs: 0, // Set by caller
    };
  }

  private applyStrategy(content: string, strategy: OptimizationStrategy): string {
    switch (strategy) {
      case OptimizationStrategy.WHITESPACE:
        return this.optimizeWhitespace(content);

      case OptimizationStrategy.DEDUPLICATE:
        return this.deduplicateContent(content);

      case OptimizationStrategy.TRUNCATE:
        if (this.maxOutputTokens > 0) {
          return this.truncateToTokens(content, this.maxOutputTokens);
        }
        return content;

      case OptimizationStrategy.REMOVE_EMPTY_LINES:
        return this.removeEmptyLines(content);

      case OptimizationStrategy.COMPRESS_CODE:
        return this.compressCode(content);

      case OptimizationStrategy.REMOVE_COMMENTS:
        return this.removeComments(content);

      case OptimizationStrategy.ALL:
        // Handled in optimizeContent
        return content;

      default:
        return content;
    }
  }

  private optimizeWhitespace(content: string): string {
    if (this.preserveCodeBlocks) {
      return this.processWithCodeBlockPreservation(content, (text) => {
        // Normalize multiple spaces to single space (outside code)
        return text.replace(/[^\S\n]+/g, ' ').trim();
      });
    }

    return content.replace(/[^\S\n]+/g, ' ').trim();
  }

  private deduplicateContent(content: string): string {
    const lines = content.split('\n');
    const seen = new Set<string>();
    const result: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep empty lines and unique content
      if (trimmed === '' || !seen.has(trimmed)) {
        result.push(line);
        if (trimmed !== '') {
          seen.add(trimmed);
        }
      }
    }

    return result.join('\n');
  }

  private removeEmptyLines(content: string): string {
    // Replace multiple empty lines with a single one
    return content.replace(/\n{3,}/g, '\n\n');
  }

  private compressCode(content: string): string {
    if (!this.preserveCodeBlocks) {
      return content;
    }

    // Find code blocks and compress whitespace within them
    return content.replace(/```[\s\S]*?```/g, (match) => {
      // Remove excessive blank lines in code blocks
      return match.replace(/\n{3,}/g, '\n\n');
    });
  }

  private removeComments(content: string): string {
    const contentType = this.detectContentType(content);

    if (contentType === ContentType.CODE || contentType === ContentType.MIXED) {
      // Remove single-line JS/TS comments (//)
      let result = content.replace(/^\s*\/\/.*$/gm, '');

      // Remove Python/Shell comments (#) but preserve shebang
      // Only remove # comments that are not shebangs (first line starting with #!)
      const lines = result.split('\n');
      const processedLines = lines.map((line, index) => {
        const trimmed = line.trim();
        // Preserve shebang on first line
        if (index === 0 && trimmed.startsWith('#!')) {
          return line;
        }
        // Remove lines that are only comments (starting with #)
        if (trimmed.startsWith('#') && !trimmed.startsWith('#!')) {
          return '';
        }
        return line;
      });
      result = processedLines.join('\n');

      // Remove multi-line comments
      result = result.replace(/\/\*[\s\S]*?\*\//g, '');

      return result;
    }

    return content;
  }

  private truncateToTokens(content: string, maxTokens: number): string {
    const maxChars = maxTokens * this.charsPerToken;

    if (content.length <= maxChars) {
      return content;
    }

    const truncateAt = maxChars - this.truncationSuffix.length;

    // Try to truncate at a word boundary
    let truncated = content.substring(0, truncateAt);
    const lastSpace = truncated.lastIndexOf(' ');
    const lastNewline = truncated.lastIndexOf('\n');
    const breakPoint = Math.max(lastSpace, lastNewline);

    if (breakPoint > truncateAt * 0.8) {
      truncated = content.substring(0, breakPoint);
    }

    return truncated.trim() + this.truncationSuffix;
  }

  private processWithCodeBlockPreservation(
    content: string,
    processor: (text: string) => string
  ): string {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];
    const placeholder = '\0CODE_BLOCK\0';

    // Extract code blocks
    let processed = content.replace(codeBlockRegex, (match) => {
      codeBlocks.push(match);
      return placeholder;
    });

    // Process non-code content
    processed = processor(processed);

    // Restore code blocks
    let blockIndex = 0;
    processed = processed.replace(new RegExp(placeholder, 'g'), () => {
      return codeBlocks[blockIndex++] || '';
    });

    return processed;
  }

  private looksLikeJson(content: string): boolean {
    const trimmed = content.trim();
    return (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    );
  }

  private looksLikeCode(content: string): boolean {
    // Common code indicators
    const codePatterns = [
      /^#!\//, // Shebang line
      /^(import|export|const|let|var|function|class|interface|type)\s/m,
      /^\s*(def|class|import|from|if|elif|else|for|while|try|except)\s/m,
      /^\s*(public|private|protected|static|void|int|string)\s/m,
      /[{};]\s*$/m,
      /\(\s*\)\s*{/m,
      /=>/,
      /\w+\s*\([^)]*\)/, // Function calls like print("hello")
    ];

    return codePatterns.some((pattern) => pattern.test(content));
  }

  private looksLikeMarkdown(content: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s/m, // Headers
      /^\s*[-*+]\s/m, // Lists
      /^\s*\d+\.\s/m, // Numbered lists
      /\[.*\]\(.*\)/, // Links
      /^\s*>/m, // Blockquotes
      /\*\*.*\*\*/, // Bold
      /_.*_/, // Italic
    ];

    return markdownPatterns.some((pattern) => pattern.test(content));
  }

  private updateMetrics(result: OptimizationResult): void {
    if (result.optimized) {
      this.metrics.totalOptimizations++;
      this.metrics.totalTokensSaved += result.tokensSaved;

      // Update average savings
      const totalSavings =
        this.metrics.averageSavingsPercentage * (this.metrics.totalOptimizations - 1) +
        result.savingsPercentage;
      this.metrics.averageSavingsPercentage = totalSavings / this.metrics.totalOptimizations;

      // Update strategy usage
      for (const strategy of result.strategiesApplied) {
        this.metrics.strategyUsage[strategy] =
          (this.metrics.strategyUsage[strategy] || 0) + 1;
      }
    }

    if (result.wasTruncated) {
      this.metrics.totalTruncations++;
    }

    this.metrics.totalProcessingTimeMs += result.processingTimeMs;
  }

  private notifyOptimization(result: OptimizationResult): void {
    this.optimizationCallbacks.forEach((callback) => {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyTokensSaved(tokensSaved: number, total: number): void {
    this.tokensSavedCallbacks.forEach((callback) => {
      try {
        callback(tokensSaved, total);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private notifyTruncation(originalLength: number, truncatedLength: number): void {
    this.truncationCallbacks.forEach((callback) => {
      try {
        callback(originalLength, truncatedLength);
      } catch {
        // Ignore callback errors
      }
    });
  }

  private createSubscription(cleanup: () => void): TokenOptimizerSubscription {
    const id = `token-optimizer-sub-${++this.subscriptionCounter}`;
    const subscription: TokenOptimizerSubscription = {
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
      this.logger.debug(message);
    }
  }
}
