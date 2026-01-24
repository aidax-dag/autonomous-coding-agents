/**
 * Output Optimizer Implementation
 *
 * Token-aware output optimization with dynamic truncation and summarization.
 *
 * Reference: oh-my-opencode/src/shared/dynamic-truncator.ts
 *
 * Key patterns adapted:
 * 1. Character-based token estimation
 * 2. Context-aware dynamic truncation
 * 3. Header preservation
 * 4. Tool-specific limits
 *
 * @module dx/output-optimizer/impl
 */

import {
  IOutputOptimizer,
  OutputOptimizerConfig,
  TruncationResult,
  TruncationOptions,
  TruncationContext,
  ContextWindowUsage,
  SummarizationResult,
  OutputOptimizerStats,
  DEFAULT_TOOL_LIMITS,
} from '../interfaces/output-optimizer.interface.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: OutputOptimizerConfig = {
  charsPerToken: 4,
  defaultMaxTokens: 50_000,
  preserveHeaderLines: 3,
  headroomPercent: 0.5,
  estimationStrategy: 'char_ratio',
  truncationMode: 'smart',
  toolLimits: { ...DEFAULT_TOOL_LIMITS },
};

/**
 * Output Optimizer Implementation
 */
export class OutputOptimizer implements IOutputOptimizer {
  private config: OutputOptimizerConfig;
  private stats: OutputOptimizerStats;

  constructor(config?: Partial<OutputOptimizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = this.createEmptyStats();
  }

  // ============================================================================
  // Token Estimation
  // ============================================================================

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    if (!text) return 0;

    switch (this.config.estimationStrategy) {
      case 'char_ratio':
        return Math.ceil(text.length / this.config.charsPerToken);

      case 'tiktoken':
        // TODO: Integrate tiktoken for accurate counting
        // For now, fall back to char ratio
        return Math.ceil(text.length / this.config.charsPerToken);

      case 'custom':
        // Custom estimation could be injected
        return Math.ceil(text.length / this.config.charsPerToken);

      default:
        return Math.ceil(text.length / this.config.charsPerToken);
    }
  }

  /**
   * Estimate tokens for multiple texts
   */
  estimateTokensBatch(texts: string[]): number[] {
    return texts.map((text) => this.estimateTokens(text));
  }

  // ============================================================================
  // Truncation
  // ============================================================================

  /**
   * Truncate output to token limit
   */
  truncate(output: string, options?: TruncationOptions): TruncationResult {
    const startTime = performance.now();
    const originalTokens = this.estimateTokens(output);
    const maxTokens = options?.targetMaxTokens ?? this.config.defaultMaxTokens;
    const preserveHeader = options?.preserveHeaderLines ?? this.config.preserveHeaderLines;

    // No truncation needed
    if (originalTokens <= maxTokens) {
      return {
        result: output,
        truncated: false,
        originalTokens,
        finalTokens: originalTokens,
      };
    }

    // Apply truncation based on mode
    const mode = options?.mode ?? this.config.truncationMode;
    let result: TruncationResult;

    switch (mode) {
      case 'head':
        result = this.truncateHead(output, maxTokens);
        break;

      case 'tail':
        result = this.truncateTail(output, maxTokens, options?.preserveTailLines ?? 0);
        break;

      case 'middle':
        result = this.truncateMiddle(output, maxTokens, preserveHeader, options?.preserveTailLines ?? 3);
        break;

      case 'smart':
      default:
        result = this.truncateSmart(output, maxTokens, preserveHeader, options?.context);
        break;
    }

    // Update statistics
    this.updateStats(originalTokens, result.finalTokens ?? 0, performance.now() - startTime);

    return result;
  }

  /**
   * Truncate with dynamic context awareness
   */
  truncateDynamic(
    output: string,
    contextUsage: ContextWindowUsage,
    options?: TruncationOptions
  ): TruncationResult {
    const targetMaxTokens = options?.targetMaxTokens ?? this.config.defaultMaxTokens;

    // Calculate maximum allowed output based on remaining context
    const maxOutputTokens = Math.min(
      contextUsage.remainingTokens * this.config.headroomPercent,
      targetMaxTokens
    );

    // Context exhausted
    if (maxOutputTokens <= 0) {
      return {
        result: '[Output suppressed - context window exhausted]',
        truncated: true,
        originalTokens: this.estimateTokens(output),
        finalTokens: 10,
        reason: 'context_exhausted',
      };
    }

    return this.truncate(output, {
      ...options,
      targetMaxTokens: maxOutputTokens,
      context: {
        ...options?.context,
        contextUsage: contextUsage.usagePercentage,
        remainingTokens: contextUsage.remainingTokens,
      },
    });
  }

  /**
   * Get tool-specific truncation limit
   */
  getToolLimit(toolName: string): number {
    const normalizedName = toolName.toLowerCase();

    // Check exact match first
    if (this.config.toolLimits[toolName]) {
      return this.config.toolLimits[toolName];
    }

    // Check lowercase match
    if (this.config.toolLimits[normalizedName]) {
      return this.config.toolLimits[normalizedName];
    }

    // Return default
    return this.config.toolLimits['default'] ?? this.config.defaultMaxTokens;
  }

  /**
   * Set tool-specific truncation limit
   */
  setToolLimit(toolName: string, maxTokens: number): void {
    this.config.toolLimits[toolName] = maxTokens;
  }

  // ============================================================================
  // Summarization
  // ============================================================================

  /**
   * Summarize long output (placeholder for LLM integration)
   */
  async summarize(output: string, maxTokens: number): Promise<SummarizationResult> {
    const originalTokens = this.estimateTokens(output);

    // If output is already within limits, return as-is
    if (originalTokens <= maxTokens) {
      return {
        summary: output,
        originalTokens,
        summaryTokens: originalTokens,
        compressionRatio: 1,
      };
    }

    // TODO: Integrate with LLM for actual summarization
    // For now, use intelligent truncation as a fallback
    const truncated = this.truncate(output, {
      targetMaxTokens: maxTokens,
      mode: 'smart',
    });

    const summaryTokens = this.estimateTokens(truncated.result);

    this.stats.summarizedCount++;

    return {
      summary: truncated.result,
      originalTokens,
      summaryTokens,
      compressionRatio: summaryTokens / originalTokens,
    };
  }

  /**
   * Extract key information from output
   */
  async extractKeyInfo(output: string, maxItems: number = 10): Promise<string[]> {
    // Simple extraction based on structure
    const lines = output.split('\n');
    const keyLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Prioritize structured content
      if (
        trimmed.startsWith('#') ||           // Headers
        trimmed.startsWith('-') ||           // List items
        trimmed.startsWith('*') ||           // List items
        trimmed.includes(':') ||             // Key-value pairs
        trimmed.startsWith('Error') ||       // Errors
        trimmed.startsWith('Warning') ||     // Warnings
        /^\d+\./.test(trimmed)               // Numbered items
      ) {
        keyLines.push(trimmed);

        if (keyLines.length >= maxItems) break;
      }
    }

    return keyLines;
  }

  // ============================================================================
  // Context Management
  // ============================================================================

  /**
   * Calculate optimal output size based on context
   */
  calculateOptimalSize(
    contextUsage: ContextWindowUsage,
    targetHeadroom?: number
  ): number {
    const headroom = targetHeadroom ?? this.config.headroomPercent;
    return Math.floor(contextUsage.remainingTokens * headroom);
  }

  /**
   * Check if output needs optimization
   */
  needsOptimization(
    output: string,
    contextUsage?: ContextWindowUsage
  ): boolean {
    const tokens = this.estimateTokens(output);

    // Always optimize if over default limit
    if (tokens > this.config.defaultMaxTokens) {
      return true;
    }

    // Check against context if provided
    if (contextUsage) {
      const optimalSize = this.calculateOptimalSize(contextUsage);
      return tokens > optimalSize;
    }

    return false;
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Get current configuration
   */
  getConfig(): OutputOptimizerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OutputOptimizerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get optimization statistics
   */
  getStats(): OutputOptimizerStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
  }

  // ============================================================================
  // Private Methods - Truncation Strategies
  // ============================================================================

  /**
   * Truncate from the end (keep head)
   */
  private truncateHead(output: string, maxTokens: number): TruncationResult {
    const maxChars = maxTokens * this.config.charsPerToken;
    const originalTokens = this.estimateTokens(output);

    if (output.length <= maxChars) {
      return {
        result: output,
        truncated: false,
        originalTokens,
        finalTokens: originalTokens,
      };
    }

    const truncated = output.slice(0, maxChars);
    const finalTokens = this.estimateTokens(truncated);

    return {
      result: truncated + '\n\n[Output truncated]',
      truncated: true,
      originalTokens,
      finalTokens,
      reason: 'head_truncation',
    };
  }

  /**
   * Truncate from the beginning (keep tail)
   */
  private truncateTail(
    output: string,
    maxTokens: number,
    preserveLines: number
  ): TruncationResult {
    const lines = output.split('\n');
    const originalTokens = this.estimateTokens(output);

    if (lines.length <= preserveLines) {
      return this.truncateHead(output, maxTokens);
    }

    const tailLines = lines.slice(-preserveLines);
    const tailText = tailLines.join('\n');
    const tailTokens = this.estimateTokens(tailText);

    if (tailTokens >= maxTokens) {
      return this.truncateHead(tailText, maxTokens);
    }

    const remainingTokens = maxTokens - tailTokens - 50; // Reserve for message
    const remainingLines: string[] = [];
    let currentTokens = 0;

    for (let i = lines.length - preserveLines - 1; i >= 0; i--) {
      const lineTokens = this.estimateTokens(lines[i] + '\n');
      if (currentTokens + lineTokens > remainingTokens) break;
      remainingLines.unshift(lines[i]);
      currentTokens += lineTokens;
    }

    const removedCount = lines.length - remainingLines.length - preserveLines;
    const result = [
      `[${removedCount} lines truncated from beginning]`,
      ...remainingLines,
      ...tailLines,
    ].join('\n');

    return {
      result,
      truncated: true,
      originalTokens,
      finalTokens: this.estimateTokens(result),
      removedCount,
      reason: 'tail_truncation',
    };
  }

  /**
   * Truncate from the middle (keep head and tail)
   */
  private truncateMiddle(
    output: string,
    maxTokens: number,
    preserveHeaderLines: number,
    preserveTailLines: number
  ): TruncationResult {
    const lines = output.split('\n');
    const originalTokens = this.estimateTokens(output);
    const totalPreserve = preserveHeaderLines + preserveTailLines;

    if (lines.length <= totalPreserve) {
      return this.truncateHead(output, maxTokens);
    }

    const headerLines = lines.slice(0, preserveHeaderLines);
    const tailLines = lines.slice(-preserveTailLines);
    const middleLines = lines.slice(preserveHeaderLines, -preserveTailLines || undefined);

    const headerText = headerLines.join('\n');
    const tailText = tailLines.join('\n');
    const headerTokens = this.estimateTokens(headerText);
    const tailTokens = this.estimateTokens(tailText);
    const messageTokens = 50;

    const availableTokens = maxTokens - headerTokens - tailTokens - messageTokens;

    if (availableTokens <= 0) {
      const result = headerText + '\n\n[Content truncated]\n\n' + tailText;
      return {
        result,
        truncated: true,
        originalTokens,
        finalTokens: this.estimateTokens(result),
        removedCount: middleLines.length,
        reason: 'middle_truncation',
      };
    }

    // Keep as much middle content as possible
    const keptMiddle: string[] = [];
    let currentTokens = 0;

    for (const line of middleLines) {
      const lineTokens = this.estimateTokens(line + '\n');
      if (currentTokens + lineTokens > availableTokens) break;
      keptMiddle.push(line);
      currentTokens += lineTokens;
    }

    const removedCount = middleLines.length - keptMiddle.length;

    const result = [
      ...headerLines,
      ...keptMiddle,
      `\n[${removedCount} more lines truncated]\n`,
      ...tailLines,
    ].join('\n');

    return {
      result,
      truncated: true,
      originalTokens,
      finalTokens: this.estimateTokens(result),
      removedCount,
      reason: 'middle_truncation',
    };
  }

  /**
   * Smart truncation based on content type and context
   */
  private truncateSmart(
    output: string,
    maxTokens: number,
    preserveHeaderLines: number,
    context?: TruncationContext
  ): TruncationResult {
    const contentType = context?.contentType ?? this.detectContentType(output);

    switch (contentType) {
      case 'code':
        // For code, preserve structure and syntax
        return this.truncateCode(output, maxTokens, preserveHeaderLines);

      case 'json':
        // For JSON, try to preserve valid structure
        return this.truncateJson(output, maxTokens);

      case 'log':
        // For logs, keep recent entries (tail)
        return this.truncateTail(output, maxTokens, 50);

      case 'structured':
        // For structured content, use middle truncation
        return this.truncateMiddle(output, maxTokens, preserveHeaderLines, 10);

      case 'text':
      default:
        // For plain text, use head truncation with line preservation
        return this.truncateWithLinePreservation(output, maxTokens, preserveHeaderLines);
    }
  }

  /**
   * Truncate code while preserving structure
   */
  private truncateCode(
    output: string,
    maxTokens: number,
    preserveHeaderLines: number
  ): TruncationResult {
    const lines = output.split('\n');
    const originalTokens = this.estimateTokens(output);

    // Preserve imports, function definitions, class declarations
    const importantPatterns = [
      /^import\s/,
      /^export\s/,
      /^(async\s+)?function\s/,
      /^class\s/,
      /^interface\s/,
      /^type\s/,
      /^const\s+\w+\s*=/,
    ];

    const headerLines = lines.slice(0, preserveHeaderLines);
    const contentLines = lines.slice(preserveHeaderLines);

    // Prioritize important lines
    const importantLines: string[] = [];
    const otherLines: string[] = [];

    for (const line of contentLines) {
      const trimmed = line.trim();
      if (importantPatterns.some((p) => p.test(trimmed))) {
        importantLines.push(line);
      } else {
        otherLines.push(line);
      }
    }

    const headerTokens = this.estimateTokens(headerLines.join('\n'));
    const messageTokens = 50;
    let availableTokens = maxTokens - headerTokens - messageTokens;

    const resultLines = [...headerLines];
    let currentTokens = 0;

    // Add important lines first
    for (const line of importantLines) {
      const lineTokens = this.estimateTokens(line + '\n');
      if (currentTokens + lineTokens > availableTokens) break;
      resultLines.push(line);
      currentTokens += lineTokens;
    }

    // Then add other lines
    for (const line of otherLines) {
      const lineTokens = this.estimateTokens(line + '\n');
      if (currentTokens + lineTokens > availableTokens) break;
      resultLines.push(line);
      currentTokens += lineTokens;
    }

    const removedCount = lines.length - resultLines.length;

    if (removedCount > 0) {
      resultLines.push(`\n// ... ${removedCount} more lines truncated`);
    }

    const result = resultLines.join('\n');

    return {
      result,
      truncated: removedCount > 0,
      originalTokens,
      finalTokens: this.estimateTokens(result),
      removedCount,
      reason: 'code_truncation',
    };
  }

  /**
   * Truncate JSON while trying to maintain valid structure
   */
  private truncateJson(output: string, maxTokens: number): TruncationResult {
    const originalTokens = this.estimateTokens(output);

    try {
      const parsed = JSON.parse(output);

      // If it's an array, truncate elements
      if (Array.isArray(parsed)) {
        const truncatedArray = this.truncateJsonArray(parsed, maxTokens);
        const result = JSON.stringify(truncatedArray, null, 2);
        return {
          result,
          truncated: truncatedArray.length < parsed.length,
          originalTokens,
          finalTokens: this.estimateTokens(result),
          removedCount: parsed.length - truncatedArray.length,
          reason: 'json_array_truncation',
        };
      }

      // If it's an object, truncate keys
      if (typeof parsed === 'object' && parsed !== null) {
        const truncatedObj = this.truncateJsonObject(parsed, maxTokens);
        const result = JSON.stringify(truncatedObj, null, 2);
        const originalKeys = Object.keys(parsed).length;
        const resultKeys = Object.keys(truncatedObj).length;
        return {
          result,
          truncated: resultKeys < originalKeys,
          originalTokens,
          finalTokens: this.estimateTokens(result),
          removedCount: originalKeys - resultKeys,
          reason: 'json_object_truncation',
        };
      }
    } catch {
      // Not valid JSON, fall back to head truncation
    }

    return this.truncateHead(output, maxTokens);
  }

  /**
   * Truncate JSON array
   */
  private truncateJsonArray(arr: unknown[], maxTokens: number): unknown[] {
    const result: unknown[] = [];
    let currentTokens = 10; // Account for array brackets

    for (const item of arr) {
      const itemStr = JSON.stringify(item);
      const itemTokens = this.estimateTokens(itemStr);

      if (currentTokens + itemTokens + 50 > maxTokens) {
        result.push({ _truncated: `${arr.length - result.length} more items` });
        break;
      }

      result.push(item);
      currentTokens += itemTokens;
    }

    return result;
  }

  /**
   * Truncate JSON object
   */
  private truncateJsonObject(
    obj: Record<string, unknown>,
    maxTokens: number
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const keys = Object.keys(obj);
    let currentTokens = 10; // Account for object braces

    for (const key of keys) {
      const valueStr = JSON.stringify(obj[key]);
      const entryTokens = this.estimateTokens(`"${key}": ${valueStr}`);

      if (currentTokens + entryTokens + 50 > maxTokens) {
        result._truncated = `${keys.length - Object.keys(result).length} more keys`;
        break;
      }

      result[key] = obj[key];
      currentTokens += entryTokens;
    }

    return result;
  }

  /**
   * Truncate with line preservation
   */
  private truncateWithLinePreservation(
    output: string,
    maxTokens: number,
    preserveHeaderLines: number
  ): TruncationResult {
    const lines = output.split('\n');
    const originalTokens = this.estimateTokens(output);

    if (lines.length <= preserveHeaderLines) {
      return this.truncateHead(output, maxTokens);
    }

    const headerLines = lines.slice(0, preserveHeaderLines);
    const contentLines = lines.slice(preserveHeaderLines);

    const headerText = headerLines.join('\n');
    const headerTokens = this.estimateTokens(headerText);
    const messageTokens = 50;
    const availableTokens = maxTokens - headerTokens - messageTokens;

    if (availableTokens <= 0) {
      return {
        result: headerText + '\n\n[Content truncated due to context limit]',
        truncated: true,
        originalTokens,
        finalTokens: this.estimateTokens(headerText) + 10,
        removedCount: contentLines.length,
        reason: 'line_preservation_truncation',
      };
    }

    const resultLines: string[] = [];
    let currentTokens = 0;

    for (const line of contentLines) {
      const lineTokens = this.estimateTokens(line + '\n');
      if (currentTokens + lineTokens > availableTokens) break;
      resultLines.push(line);
      currentTokens += lineTokens;
    }

    const removedCount = contentLines.length - resultLines.length;
    const result = [
      ...headerLines,
      ...resultLines,
      '',
      `[${removedCount} more lines truncated]`,
    ].join('\n');

    return {
      result,
      truncated: true,
      originalTokens,
      finalTokens: this.estimateTokens(result),
      removedCount,
      reason: 'line_preservation_truncation',
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Detect content type from output
   */
  private detectContentType(output: string): TruncationContext['contentType'] {
    const trimmed = output.trim();

    // Check for JSON
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch {
        // Not valid JSON
      }
    }

    // Check for code patterns
    const codePatterns = [
      /^import\s/m,
      /^export\s/m,
      /^function\s/m,
      /^class\s/m,
      /^const\s/m,
      /^let\s/m,
      /^var\s/m,
      /^\s*if\s*\(/m,
      /^\s*for\s*\(/m,
      /^\s*while\s*\(/m,
    ];

    if (codePatterns.some((p) => p.test(trimmed))) {
      return 'code';
    }

    // Check for log patterns
    const logPatterns = [
      /^\[\d{4}-\d{2}-\d{2}/m,
      /^\d{4}\/\d{2}\/\d{2}/m,
      /^(DEBUG|INFO|WARN|ERROR|FATAL):/m,
      /^\[.*\]\s+(DEBUG|INFO|WARN|ERROR)/m,
    ];

    if (logPatterns.some((p) => p.test(trimmed))) {
      return 'log';
    }

    // Check for structured content (tables, lists)
    const structuredPatterns = [
      /^\|.*\|$/m,        // Markdown tables
      /^[-*]\s/m,         // Lists
      /^\d+\.\s/m,        // Numbered lists
      /^#{1,6}\s/m,       // Headers
    ];

    if (structuredPatterns.some((p) => p.test(trimmed))) {
      return 'structured';
    }

    return 'text';
  }

  /**
   * Update statistics
   */
  private updateStats(originalTokens: number, finalTokens: number, processingTime: number): void {
    this.stats.totalProcessed++;

    if (finalTokens < originalTokens) {
      this.stats.truncatedCount++;
      this.stats.tokensSaved += originalTokens - finalTokens;
    }

    this.stats.processingTime.total += processingTime;
    this.stats.processingTime.average =
      this.stats.processingTime.total / this.stats.totalProcessed;
    this.stats.processingTime.max = Math.max(
      this.stats.processingTime.max,
      processingTime
    );

    // Update compression ratio
    if (this.stats.truncatedCount > 0) {
      const totalOriginal = this.stats.tokensSaved + finalTokens * this.stats.truncatedCount;
      const totalFinal = finalTokens * this.stats.truncatedCount;
      this.stats.averageCompressionRatio = totalFinal / totalOriginal;
    }
  }

  /**
   * Create empty statistics object
   */
  private createEmptyStats(): OutputOptimizerStats {
    return {
      totalProcessed: 0,
      truncatedCount: 0,
      summarizedCount: 0,
      tokensSaved: 0,
      averageCompressionRatio: 1,
      processingTime: {
        total: 0,
        average: 0,
        max: 0,
      },
    };
  }
}

/**
 * Factory function to create OutputOptimizer
 */
export function createOutputOptimizer(
  config?: Partial<OutputOptimizerConfig>
): IOutputOptimizer {
  return new OutputOptimizer(config);
}
