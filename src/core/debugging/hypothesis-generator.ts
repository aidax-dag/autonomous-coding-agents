/**
 * Hypothesis Generator
 *
 * Generates, ranks, and filters hypotheses about the root cause of an error
 * based on error message patterns, stack trace analysis, and previous
 * debugging attempts.
 *
 * @module core/debugging/hypothesis-generator
 */

import { randomUUID } from 'crypto';
import type {
  DebuggingContext,
  DebuggingAttempt,
  Hypothesis,
  HypothesisCategory,
} from './types';

// ============================================================================
// Error Pattern Definitions
// ============================================================================

interface ErrorPattern {
  /** Pattern to match against error message */
  pattern: RegExp;
  /** Category of the resulting hypothesis */
  category: HypothesisCategory;
  /** Base confidence for this pattern */
  confidence: number;
  /** Description template (may include $1, $2 for captured groups) */
  description: string;
  /** Suggested fix template */
  suggestedFix: string;
  /** Test strategy template */
  testStrategy: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // TypeError / ReferenceError patterns
  {
    pattern: /(?:TypeError:?\s*)?(?:cannot read propert|is not a function|undefined is not|null is not|has no method)/i,
    category: 'code-error',
    confidence: 0.8,
    description: 'TypeError detected: likely accessing property of null/undefined or calling non-function',
    suggestedFix: 'Add null/undefined checks before property access or function call',
    testStrategy: 'Verify the variable is defined and has the expected type before usage',
  },
  {
    pattern: /(?:ReferenceError:?\s*)?(\w+)\s+is not defined/i,
    category: 'code-error',
    confidence: 0.85,
    description: 'ReferenceError: variable or function is not defined in the current scope',
    suggestedFix: 'Ensure the variable is declared and imported correctly',
    testStrategy: 'Check import statements and variable declarations in the related files',
  },

  // File system errors
  {
    pattern: /ENOENT:.*no such file or directory/i,
    category: 'config-error',
    confidence: 0.9,
    description: 'File or directory not found (ENOENT)',
    suggestedFix: 'Verify the file path exists and is correctly configured',
    testStrategy: 'Check file existence at the specified path and validate configuration',
  },
  {
    pattern: /EACCES:.*permission denied/i,
    category: 'config-error',
    confidence: 0.85,
    description: 'Permission denied (EACCES) when accessing a file or directory',
    suggestedFix: 'Check and fix file/directory permissions',
    testStrategy: 'Verify file permissions and ownership for the target path',
  },

  // Dependency errors
  {
    pattern: /Cannot find module|MODULE_NOT_FOUND/i,
    category: 'dependency-error',
    confidence: 0.9,
    description: 'Module not found: a required dependency is missing or misconfigured',
    suggestedFix: 'Install the missing module or fix the import path',
    testStrategy: 'Check package.json for the dependency and verify node_modules',
  },

  // Runtime / network errors
  {
    pattern: /timeout|ETIMEDOUT/i,
    category: 'runtime-error',
    confidence: 0.7,
    description: 'Operation timed out: network request or process exceeded time limit',
    suggestedFix: 'Increase timeout configuration or add retry logic with backoff',
    testStrategy: 'Test with increased timeout and verify network connectivity',
  },
  {
    pattern: /ECONNREFUSED/i,
    category: 'runtime-error',
    confidence: 0.75,
    description: 'Connection refused: target service is not running or not reachable',
    suggestedFix: 'Verify the target service is running and the connection URL is correct',
    testStrategy: 'Check service availability and network configuration',
  },
  {
    pattern: /ECONNRESET/i,
    category: 'runtime-error',
    confidence: 0.65,
    description: 'Connection reset: the remote server closed the connection unexpectedly',
    suggestedFix: 'Add retry logic with exponential backoff for transient failures',
    testStrategy: 'Retry the operation and monitor for persistent connection issues',
  },

  // Logic / assertion errors
  {
    pattern: /AssertionError|assertion fail|expected.*but got/i,
    category: 'logic-error',
    confidence: 0.75,
    description: 'Assertion failure: runtime value did not match expected value',
    suggestedFix: 'Review the logic producing the unexpected value and fix the computation',
    testStrategy: 'Trace the data flow to identify where the unexpected value originates',
  },

  // Syntax errors
  {
    pattern: /SyntaxError:.*Unexpected token/i,
    category: 'code-error',
    confidence: 0.85,
    description: 'Syntax error: unexpected token in source code or JSON',
    suggestedFix: 'Fix the syntax error at the indicated location',
    testStrategy: 'Parse the file and identify the exact syntax issue',
  },
];

// ============================================================================
// Stack Trace Utilities
// ============================================================================

/** Extract file paths from a stack trace string */
function extractFilesFromStackTrace(stackTrace: string): string[] {
  const filePattern = /(?:at\s+.*?\(|at\s+)(\/[^\s):]+|[a-zA-Z]:\\[^\s):]+)/g;
  const files: Set<string> = new Set();
  let match: RegExpExecArray | null;

  while ((match = filePattern.exec(stackTrace)) !== null) {
    const filePath = match[1];
    // Filter out node_modules and internal node files
    if (!filePath.includes('node_modules') && !filePath.startsWith('node:')) {
      files.add(filePath);
    }
  }

  return Array.from(files);
}

// ============================================================================
// HypothesisGenerator
// ============================================================================

/**
 * Generates hypotheses about root causes of errors using pattern matching
 * on error messages, stack trace analysis, and learning from previous
 * debugging attempts.
 */
export class HypothesisGenerator {
  /**
   * Generate hypotheses for a given debugging context.
   * Combines insights from the error message, stack trace, and
   * previous attempts.
   */
  generateHypotheses(context: DebuggingContext): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];

    // Generate from error message patterns
    hypotheses.push(...this.analyzeErrorMessage(context.error));

    // Generate from stack trace
    hypotheses.push(...this.analyzeStackTrace(context.stackTrace));

    // Adjust based on previous attempts
    const adjusted = this.analyzePreviousAttempts(
      hypotheses,
      context.previousAttempts,
    );

    // Populate relatedFiles from context if not already set
    for (const h of adjusted) {
      if (h.relatedFiles.length === 0) {
        h.relatedFiles = [...context.relatedFiles];
      }
    }

    // Deduplicate by category (keep highest confidence per category)
    return this.deduplicateByCategory(adjusted);
  }

  /**
   * Rank hypotheses by confidence in descending order.
   */
  rankByConfidence(hypotheses: Hypothesis[]): Hypothesis[] {
    return [...hypotheses].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Filter hypotheses that meet a minimum confidence threshold.
   */
  filterByMinConfidence(hypotheses: Hypothesis[], min: number): Hypothesis[] {
    return hypotheses.filter((h) => h.confidence >= min);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Match error message against known patterns to generate hypotheses.
   */
  private analyzeErrorMessage(error: Error): Hypothesis[] {
    const message = error.message;
    const hypotheses: Hypothesis[] = [];

    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(message)) {
        hypotheses.push({
          id: randomUUID(),
          description: pattern.description,
          confidence: pattern.confidence,
          category: pattern.category,
          suggestedFix: pattern.suggestedFix,
          relatedFiles: [],
          testStrategy: pattern.testStrategy,
        });
      }
    }

    // If no patterns matched, generate a generic hypothesis
    if (hypotheses.length === 0) {
      hypotheses.push({
        id: randomUUID(),
        description: `Unknown error: ${error.message.slice(0, 100)}`,
        confidence: 0.3,
        category: 'code-error',
        suggestedFix: 'Investigate the error message and stack trace for clues',
        relatedFiles: [],
        testStrategy: 'Manual investigation of the error context',
      });
    }

    return hypotheses;
  }

  /**
   * Analyze stack trace to extract file context and generate
   * location-based hypotheses.
   */
  private analyzeStackTrace(stackTrace: string): Hypothesis[] {
    if (!stackTrace) {
      return [];
    }

    const files = extractFilesFromStackTrace(stackTrace);
    if (files.length === 0) {
      return [];
    }

    return [
      {
        id: randomUUID(),
        description: `Error originates from: ${files[0]}`,
        confidence: 0.6,
        category: 'code-error',
        suggestedFix: `Review the code in ${files[0]} near the error location`,
        relatedFiles: files,
        testStrategy: 'Examine the source file at the error location for issues',
      },
    ];
  }

  /**
   * Adjust hypothesis confidence based on previous attempts.
   * If a hypothesis category was already tried and failed, reduce
   * confidence for similar hypotheses.
   */
  private analyzePreviousAttempts(
    hypotheses: Hypothesis[],
    previousAttempts: DebuggingAttempt[],
  ): Hypothesis[] {
    if (previousAttempts.length === 0) {
      return hypotheses;
    }

    const failedDescriptions = new Set(
      previousAttempts
        .filter((a) => a.result === 'failure')
        .map((a) => a.hypothesis),
    );

    return hypotheses.map((h) => {
      // Reduce confidence if a similar hypothesis already failed
      if (failedDescriptions.has(h.description)) {
        return { ...h, confidence: h.confidence * 0.3 };
      }

      // Slightly reduce confidence for each prior failed attempt overall
      const penalty = previousAttempts.filter(
        (a) => a.result === 'failure',
      ).length * 0.05;

      return {
        ...h,
        confidence: Math.max(0.1, h.confidence - penalty),
      };
    });
  }

  /**
   * Remove duplicate hypotheses within the same category, keeping only
   * the one with highest confidence. Merges relatedFiles from all
   * hypotheses in the same category into the winning hypothesis.
   */
  private deduplicateByCategory(hypotheses: Hypothesis[]): Hypothesis[] {
    const bestByCategory = new Map<string, Hypothesis>();
    const filesByCategory = new Map<string, Set<string>>();

    for (const h of hypotheses) {
      // Accumulate all relatedFiles for each category
      if (!filesByCategory.has(h.category)) {
        filesByCategory.set(h.category, new Set());
      }
      for (const f of h.relatedFiles) {
        filesByCategory.get(h.category)!.add(f);
      }

      // Keep highest confidence per category
      const existing = bestByCategory.get(h.category);
      if (!existing || h.confidence > existing.confidence) {
        bestByCategory.set(h.category, h);
      }
    }

    // Merge accumulated relatedFiles into the winning hypothesis
    for (const [category, hypothesis] of bestByCategory) {
      const allFiles = filesByCategory.get(category);
      if (allFiles && allFiles.size > 0) {
        hypothesis.relatedFiles = Array.from(allFiles);
      }
    }

    return Array.from(bestByCategory.values());
  }
}
