/**
 * Learning Module
 *
 * Provides error learning and pattern-based continuous learning systems
 * for adaptive agent behavior improvement.
 *
 * Key Components:
 * - ReflexionPattern: Error-driven learning with solution caching
 * - InstinctStore: Instinct-based behavioral learning (0.3-0.9 confidence)
 * - SolutionsCache: Fast lookup cache for learned solutions
 *
 * @module core/learning
 *
 * @example
 * ```typescript
 * import {
 *   ReflexionPattern,
 *   InstinctStore,
 *   SolutionsCache,
 *   CONFIDENCE_LEVELS,
 * } from '@core/learning';
 *
 * // Error learning
 * const reflexion = new ReflexionPattern();
 * const existingSolution = await reflexion.lookup(error);
 * if (!existingSolution) {
 *   await reflexion.learn(error, solution, rootCause);
 * }
 *
 * // Instinct-based learning
 * const instinctStore = new InstinctStore();
 * const matchingInstincts = await instinctStore.findMatching(context);
 * if (userApproved) {
 *   await instinctStore.reinforce(instinctId);
 * } else {
 *   await instinctStore.correct(instinctId);
 * }
 * ```
 *
 * @see IMPROVEMENT_RECOMMENDATIONS_v2.md §3.2
 * @see CODE_STRUCTURE_IMPROVEMENT_PLAN.md §2.2
 */

// ============================================================================
// Interfaces
// ============================================================================

export {
  // Reflexion Pattern
  type LearnedSolution,
  type ReflexionResult,
  type IReflexionPattern,

  // Instinct Store
  type Instinct,
  type InstinctEvolution,
  type InstinctFilter,
  type IInstinctStore,

  // Solutions Cache
  type SolutionCacheEntry,
  type ISolutionsCache,

  // Constants
  CONFIDENCE_LEVELS,
  CONFIDENCE_ADJUSTMENTS,
  STORAGE_PATHS,
} from './interfaces/learning.interface.js';

// ============================================================================
// Implementations
// ============================================================================

export {
  ReflexionPattern,
  createReflexionPattern,
  STORAGE_CONFIG,
  type ReflexionPatternOptions,
} from './reflexion-pattern.js';

// TODO: Implement these
// export { InstinctStore, createInstinctStore } from './instinct-store.js';
// export { SolutionsCache, createSolutionsCache } from './solutions-cache.js';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate error signature for cache lookup
 * Uses error type + message pattern for matching
 */
export function generateErrorSignature(error: Error): string {
  const errorType = error.constructor.name;
  // Normalize error message by removing variable parts (numbers, paths, etc.)
  const normalizedMessage = error.message
    .replace(/\d+/g, 'N') // Replace numbers
    .replace(/['"][^'"]+['"]/g, 'STR') // Replace quoted strings
    .replace(/\/[^\s]+/g, 'PATH') // Replace paths
    .slice(0, 200); // Limit length

  return `${errorType}:${normalizedMessage}`;
}

/**
 * Calculate confidence adjustment based on outcome
 */
export function calculateConfidenceAdjustment(
  currentConfidence: number,
  success: boolean,
  reinforceIncrement: number = 0.05,
  correctDecrement: number = 0.1,
  minConfidence: number = 0.2,
  maxConfidence: number = 0.9
): number {
  if (success) {
    return Math.min(maxConfidence, currentConfidence + reinforceIncrement);
  } else {
    return Math.max(minConfidence, currentConfidence - correctDecrement);
  }
}

/**
 * Check if instinct should be auto-applied based on confidence
 */
export function shouldAutoApply(confidence: number): boolean {
  // Auto-apply at STRONG level (0.7+)
  return confidence >= 0.7;
}

/**
 * Check if instinct should be suggested (not auto-applied)
 */
export function shouldSuggest(confidence: number): boolean {
  // Suggest at MODERATE level (0.5-0.7)
  return confidence >= 0.5 && confidence < 0.7;
}

/**
 * Default error type categories for classification
 */
export const ERROR_CATEGORIES = {
  SYNTAX: ['SyntaxError', 'ParseError'],
  TYPE: ['TypeError', 'TypeMismatchError'],
  RUNTIME: ['RuntimeError', 'ReferenceError', 'RangeError'],
  NETWORK: ['NetworkError', 'FetchError', 'TimeoutError'],
  FILE: ['FileNotFoundError', 'PermissionError', 'IOError'],
  VALIDATION: ['ValidationError', 'SchemaError'],
  AUTH: ['AuthenticationError', 'AuthorizationError'],
  CONFIG: ['ConfigurationError', 'EnvironmentError'],
} as const;

/**
 * Classify error into category
 */
export function classifyError(error: Error): string {
  const errorName = error.constructor.name;

  for (const [category, errorTypes] of Object.entries(ERROR_CATEGORIES)) {
    if (errorTypes.some((type) => errorName.includes(type) || error.message.toLowerCase().includes(type.toLowerCase()))) {
      return category;
    }
  }

  return 'UNKNOWN';
}

/**
 * Default instinct domains for categorization
 */
export const INSTINCT_DOMAINS = [
  'code-style',
  'error-handling',
  'testing',
  'documentation',
  'security',
  'performance',
  'architecture',
  'git-workflow',
  'debugging',
  'refactoring',
] as const;

export type InstinctDomain = (typeof INSTINCT_DOMAINS)[number];
