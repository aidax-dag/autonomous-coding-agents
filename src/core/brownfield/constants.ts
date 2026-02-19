/**
 * Brownfield Analyzer Constants
 *
 * Named constants extracted from brownfield-analyzer.ts to eliminate magic numbers
 * and improve readability/maintainability.
 *
 * @module core/brownfield/constants
 */

// ---------------------------------------------------------------------------
// File scanning limits
// ---------------------------------------------------------------------------

/** Default maximum number of files to scan during analysis */
export const DEFAULT_MAX_FILES = 1_000;

/** Maximum number of largest files to include in reports */
export const MAX_REPORTED_FILES = 20;

/** Maximum number of pattern locations to include in reports */
export const MAX_REPORTED_PATTERN_LOCATIONS = 20;

// ---------------------------------------------------------------------------
// Code quality thresholds
// ---------------------------------------------------------------------------

/** Lines of code above which a file is considered "large" (for largestFiles metric) */
export const LARGE_FILE_LOC_THRESHOLD = 500;

/** Lines of code above which a file is flagged as excessively long (tech debt) */
export const EXCESSIVE_FILE_LENGTH = 300;

/** Directory depth above which nesting is flagged as too deep (tech debt) */
export const DEEP_NESTING_LEVEL = 5;

/** Test coverage percentage below which a recommendation is generated */
export const TEST_COVERAGE_THRESHOLD = 50;

// ---------------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------------

/** Base confidence value for pattern detection */
export const BASE_CONFIDENCE = 0.4;

/** Confidence increment per additional occurrence of a pattern */
export const CONFIDENCE_PER_OCCURRENCE = 0.05;

/** Maximum confidence value (cap) for pattern detection */
export const MAX_CONFIDENCE = 0.95;

// ---------------------------------------------------------------------------
// Health score deductions
// ---------------------------------------------------------------------------

/** Health score deduction per critical-severity tech debt item */
export const HEALTH_DEDUCTION_CRITICAL = 15;

/** Health score deduction per high-severity tech debt item */
export const HEALTH_DEDUCTION_HIGH = 8;

/** Health score deduction per medium-severity tech debt item */
export const HEALTH_DEDUCTION_MEDIUM = 3;

/** Health score deduction when test coverage is below threshold */
export const HEALTH_DEDUCTION_LOW_COVERAGE = 10;
