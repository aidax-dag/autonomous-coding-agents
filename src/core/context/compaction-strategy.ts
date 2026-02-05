/**
 * Compaction Strategy
 *
 * Applies compression strategies based on quality level.
 *
 * @module core/context/compaction-strategy
 */

import type { ICompactionStrategy } from './interfaces/context.interface.js';
import type { CompressionStrategy, CompressionTechnique } from './interfaces/quality-curve.interface.js';
import { CHARS_PER_TOKEN } from './constants/context.constants.js';

// ============================================================================
// Implementation
// ============================================================================

/**
 * CompactionStrategy
 *
 * Applies compression strategies based on the quality curve.
 */
export class CompactionStrategy implements ICompactionStrategy {
  // ==========================================================================
  // Main Operations
  // ==========================================================================

  /**
   * Apply compression strategy to content
   */
  async apply(content: string, strategy: CompressionStrategy): Promise<string> {
    if (!content || strategy.name === 'none' || strategy.techniques.length === 0) {
      return content;
    }

    let result = content;

    for (const technique of strategy.techniques) {
      if (technique.enabled) {
        result = this.applyTechnique(result, technique);
      }
    }

    return result;
  }

  /**
   * Estimate tokens that can be saved
   */
  estimateSavings(content: string, strategy: CompressionStrategy): number {
    if (!content || strategy.name === 'none') {
      return 0;
    }

    const currentTokens = this.estimateTokens(content);
    const estimatedReduction = currentTokens * strategy.tokenReduction;

    // Sum up technique-specific savings, capped at estimated reduction
    let techniqueSavings = 0;
    for (const technique of strategy.techniques) {
      if (technique.enabled) {
        techniqueSavings += technique.tokenSaving;
      }
    }

    return Math.min(techniqueSavings, estimatedReduction, currentTokens);
  }

  /**
   * Check if compaction can be applied
   */
  canApply(content: string): boolean {
    // Can apply if content is non-empty and has reasonable length
    return !!content && content.length > 100;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Apply a single compression technique
   */
  private applyTechnique(content: string, technique: CompressionTechnique): string {
    switch (technique.name) {
      case 'remove_verbose_comments':
        return this.removeVerboseComments(content);
      case 'remove_all_comments':
        return this.removeAllComments(content);
      case 'summarize_explanations':
        return this.summarizeExplanations(content);
      case 'abbreviate_identifiers':
        return this.abbreviateIdentifiers(content);
      case 'minimal_output':
        return this.minimalOutput(content);
      case 'skip_examples':
        return this.skipExamples(content);
      case 'code_only':
        return this.codeOnly(content);
      default:
        return content;
    }
  }

  /**
   * Remove verbose comments (multi-line, detailed)
   */
  private removeVerboseComments(content: string): string {
    return content
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove long single-line comments (> 80 chars)
      .replace(/\/\/[^\n]{80,}/g, '')
      // Remove JSDoc-style comments
      .replace(/\/\*\*[\s\S]*?\*\//g, '');
  }

  /**
   * Remove all comments
   */
  private removeAllComments(content: string): string {
    return content
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Remove single-line comments
      .replace(/\/\/[^\n]*/g, '')
      // Remove Python-style comments
      .replace(/#[^\n]*/g, '')
      // Clean up empty lines left behind
      .replace(/\n\s*\n\s*\n/g, '\n\n');
  }

  /**
   * Summarize verbose explanations
   */
  private summarizeExplanations(content: string): string {
    return content
      // Remove explanation patterns
      .replace(/Let me explain[\s\S]*?:\s*/gi, '')
      .replace(/This means that[\s\S]*?[.!]\s*/gi, '')
      .replace(/In other words,[\s\S]*?[.!]\s*/gi, '')
      .replace(/To put it simply,[\s\S]*?[.!]\s*/gi, '')
      .replace(/Basically,[\s\S]*?[.!]\s*/gi, '');
  }

  /**
   * Abbreviate common identifiers in documentation
   */
  private abbreviateIdentifiers(content: string): string {
    return content
      .replace(/configuration/gi, 'config')
      .replace(/implementation/gi, 'impl')
      .replace(/documentation/gi, 'docs')
      .replace(/function/gi, 'fn')
      .replace(/parameter/gi, 'param')
      .replace(/argument/gi, 'arg')
      .replace(/variable/gi, 'var')
      .replace(/constant/gi, 'const')
      .replace(/interface/gi, 'iface')
      .replace(/component/gi, 'comp');
  }

  /**
   * Reduce to minimal output
   */
  private minimalOutput(content: string): string {
    return content
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      // Simplify lists
      .replace(/^\s*[-*]\s+/gm, '- ');
  }

  /**
   * Skip/remove example sections
   */
  private skipExamples(content: string): string {
    return content
      // Remove example sections
      .replace(/## Example[\s\S]*?(?=##|$)/gi, '')
      .replace(/### Example[\s\S]*?(?=###|##|$)/gi, '')
      .replace(/For example:[\s\S]*?(?=\n\n[A-Z]|\n##|$)/gi, '')
      .replace(/Example:[\s\S]*?(?=\n\n[A-Z]|\n##|$)/gi, '')
      // Remove code examples (but preserve inline code)
      .replace(/```[\s\S]*?```/g, '[code example removed]');
  }

  /**
   * Extract code only, removing explanatory text
   */
  private codeOnly(content: string): string {
    // Extract code blocks
    const codeBlocks: string[] = [];
    const regex = /```(?:\w+)?\n([\s\S]*?)```/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      codeBlocks.push(match[1].trim());
    }

    if (codeBlocks.length > 0) {
      return codeBlocks.join('\n\n');
    }

    // If no code blocks, return original (might be pure code)
    return content;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a CompactionStrategy instance
 */
export function createCompactionStrategy(): CompactionStrategy {
  return new CompactionStrategy();
}

// ============================================================================
// Default Export
// ============================================================================

export default CompactionStrategy;
