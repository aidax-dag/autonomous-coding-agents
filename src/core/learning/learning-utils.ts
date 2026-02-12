/**
 * Learning Module Utility Functions
 *
 * Extracted from index.ts to avoid circular dependencies.
 * reflexion-pattern.ts and solutions-cache.ts import these utilities directly.
 *
 * @module core/learning/learning-utils
 */

// ============================================================================
// Error Signature & Classification
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

// ============================================================================
// Confidence Utilities
// ============================================================================

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

// ============================================================================
// Domain Constants
// ============================================================================

/**
 * Default instinct domains for categorization
 * Note: InstinctDomain type is exported from learning.interface.ts
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
