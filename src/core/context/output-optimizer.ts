/**
 * Output Optimizer
 *
 * Token-aware output optimization with compression and summarization.
 *
 * @module core/context/output-optimizer
 */

import type {
  IOutputOptimizer,
  OutputOptimizerConfig,
  CompressionResult,
  SummarizationRequest,
  OptimizationOptions,
} from './interfaces/context.interface';
import {
  DEFAULT_CONTEXT_CONFIG,
  CHARS_PER_TOKEN,
} from './constants/context.constants';

// ============================================================================
// Implementation
// ============================================================================

/**
 * OutputOptimizer
 *
 * Provides token-aware output optimization including compression
 * and summarization capabilities.
 */
export class OutputOptimizer implements IOutputOptimizer {
  private config: OutputOptimizerConfig;

  constructor(config?: Partial<OutputOptimizerConfig>) {
    this.config = {
      ...DEFAULT_CONTEXT_CONFIG.outputOptimizer,
      ...config,
    };
  }

  // ==========================================================================
  // Token Estimation
  // ==========================================================================

  /**
   * Estimate token count for text
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  // ==========================================================================
  // Optimization
  // ==========================================================================

  /**
   * Optimize output with compression
   */
  async optimize(output: string, options: OptimizationOptions): Promise<CompressionResult> {
    if (!this.config.enabled || options.level === 'none') {
      return this.createNoCompressionResult(output);
    }

    const originalTokens = this.estimateTokens(output);
    let compressed = output;

    // Apply techniques in order
    for (const technique of options.techniques) {
      compressed = this.applyTechnique(compressed, technique, options.preserveCodeBlocks);
    }

    const compressedTokens = this.estimateTokens(compressed);
    const savedTokens = originalTokens - compressedTokens;

    return {
      original: output,
      compressed,
      originalTokens,
      compressedTokens,
      savedTokens,
      compressionRatio: originalTokens > 0 ? savedTokens / originalTokens : 0,
      techniques: options.techniques,
    };
  }

  /**
   * Summarize content to target token count
   */
  async summarize(request: SummarizationRequest): Promise<string> {
    const { content, targetTokens, preserveKeys } = request;

    const currentTokens = this.estimateTokens(content);
    if (currentTokens <= targetTokens) {
      return content;
    }

    // Simple summarization: truncate to target while preserving key information
    const targetChars = targetTokens * CHARS_PER_TOKEN;
    let summary = content;

    // If preserveKeys specified, try to keep those sections
    if (preserveKeys && preserveKeys.length > 0) {
      const keyRegex = new RegExp(`(${preserveKeys.join('|')})`, 'gi');
      const matches = content.match(keyRegex);

      if (matches) {
        // Extract sentences containing keywords
        const sentences = content.split(/[.!?]+/);
        const keySentences = sentences.filter(s =>
          preserveKeys.some(key => s.toLowerCase().includes(key.toLowerCase()))
        );
        summary = keySentences.join('. ').substring(0, targetChars);
      } else {
        summary = content.substring(0, targetChars);
      }
    } else {
      summary = content.substring(0, targetChars);
    }

    // Add truncation indicator if truncated
    if (summary.length < content.length) {
      summary = summary.trimEnd() + '... [truncated]';
    }

    return summary;
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Configure the optimizer
   */
  configure(config: Partial<OutputOptimizerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): OutputOptimizerConfig {
    return { ...this.config };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create result for no compression
   */
  private createNoCompressionResult(output: string): CompressionResult {
    const tokens = this.estimateTokens(output);
    return {
      original: output,
      compressed: output,
      originalTokens: tokens,
      compressedTokens: tokens,
      savedTokens: 0,
      compressionRatio: 0,
      techniques: [],
    };
  }

  /**
   * Apply a compression technique
   */
  private applyTechnique(content: string, technique: string, preserveCodeBlocks: boolean): string {
    // Extract code blocks if preservation is enabled
    const codeBlocks: string[] = [];
    let processedContent = content;

    if (preserveCodeBlocks) {
      // Replace code blocks with placeholders
      processedContent = content.replace(/```[\s\S]*?```/g, (match) => {
        codeBlocks.push(match);
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
      });
    }

    // Apply technique
    switch (technique) {
      case 'remove_redundant_whitespace':
        processedContent = this.removeRedundantWhitespace(processedContent);
        break;
      case 'shorten_verbose_text':
        processedContent = this.shortenVerboseText(processedContent);
        break;
      case 'summarize_explanations':
        processedContent = this.summarizeExplanations(processedContent);
        break;
      case 'abbreviate_common_terms':
        processedContent = this.abbreviateCommonTerms(processedContent);
        break;
      case 'remove_examples':
        processedContent = this.removeExamples(processedContent);
        break;
      case 'minimal_formatting':
        processedContent = this.minimalFormatting(processedContent);
        break;
    }

    // Restore code blocks
    if (preserveCodeBlocks) {
      codeBlocks.forEach((block, index) => {
        processedContent = processedContent.replace(`__CODE_BLOCK_${index}__`, block);
      });
    }

    return processedContent;
  }

  /**
   * Remove redundant whitespace
   */
  private removeRedundantWhitespace(content: string): string {
    return content
      .replace(/\n{3,}/g, '\n\n')  // Multiple newlines to double
      .replace(/[ \t]{2,}/g, ' ')   // Multiple spaces to single
      .replace(/\n[ \t]+\n/g, '\n\n'); // Lines with only whitespace
  }

  /**
   * Shorten verbose text patterns
   */
  private shortenVerboseText(content: string): string {
    return content
      .replace(/In order to/gi, 'To')
      .replace(/It is important to note that/gi, 'Note:')
      .replace(/For the purpose of/gi, 'For')
      .replace(/With respect to/gi, 'For')
      .replace(/In the event that/gi, 'If')
      .replace(/At the present time/gi, 'Now')
      .replace(/Due to the fact that/gi, 'Because')
      .replace(/In light of the fact that/gi, 'Since')
      .replace(/For example,/gi, 'e.g.,')
      .replace(/That is to say/gi, 'i.e.,');
  }

  /**
   * Summarize explanation patterns
   */
  private summarizeExplanations(content: string): string {
    // Remove repeated explanation markers
    return content
      .replace(/Let me explain[\s\S]*?:\s*/gi, '')
      .replace(/As you can see,\s*/gi, '')
      .replace(/To clarify,\s*/gi, '')
      .replace(/In other words,\s*/gi, '');
  }

  /**
   * Abbreviate common technical terms
   */
  private abbreviateCommonTerms(content: string): string {
    return content
      .replace(/configuration/gi, 'config')
      .replace(/implementation/gi, 'impl')
      .replace(/documentation/gi, 'docs')
      .replace(/application/gi, 'app')
      .replace(/function/gi, 'fn')
      .replace(/repository/gi, 'repo')
      .replace(/directory/gi, 'dir')
      .replace(/parameter/gi, 'param')
      .replace(/environment/gi, 'env');
  }

  /**
   * Remove example sections
   */
  private removeExamples(content: string): string {
    return content
      .replace(/For example:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '')
      .replace(/Example:[\s\S]*?(?=\n\n|\n[A-Z]|$)/gi, '')
      .replace(/E\.g\.,[\s\S]*?(?=\n\n|\n[A-Z]|\.)/gi, '');
  }

  /**
   * Apply minimal formatting
   */
  private minimalFormatting(content: string): string {
    return content
      .replace(/^\s*[-*]\s+/gm, '- ')  // Normalize list markers
      .replace(/^#{1,6}\s+/gm, '')      // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold
      .replace(/\*(.*?)\*/g, '$1')      // Remove italic
      .replace(/`([^`]+)`/g, '$1');     // Remove inline code (not blocks)
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an OutputOptimizer instance
 */
export function createOutputOptimizer(config?: Partial<OutputOptimizerConfig>): OutputOptimizer {
  return new OutputOptimizer(config);
}

// ============================================================================
// Default Export
// ============================================================================

export default OutputOptimizer;
