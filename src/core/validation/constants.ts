/**
 * Validation Constants
 *
 * Named constants extracted from validation modules to eliminate magic numbers
 * and improve readability/maintainability.
 *
 * @module core/validation/constants
 */

// ---------------------------------------------------------------------------
// Confidence checker thresholds
// ---------------------------------------------------------------------------

/** Default score threshold for "proceed" recommendation */
export const DEFAULT_PROCEED_THRESHOLD = 90;

/** Default score threshold for "alternatives" recommendation */
export const DEFAULT_ALTERNATIVES_THRESHOLD = 70;

// ---------------------------------------------------------------------------
// Danger signal scanning
// ---------------------------------------------------------------------------

/** Number of characters of context to extract before a danger signal match */
export const DANGER_SIGNAL_CONTEXT_CHARS = 50;
