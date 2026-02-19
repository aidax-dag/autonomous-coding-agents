/**
 * Deep Worker Constants
 *
 * Named constants extracted from pre-exploration scoring and configuration.
 *
 * @module core/deep-worker
 */

// ── File scoring weights (used in keyword-based file relevance ranking) ──

/** Score awarded when a file's basename (without extension) exactly matches a keyword */
export const SCORE_EXACT_MATCH = 10;

/** Score awarded when a file's basename (without extension) contains a keyword */
export const SCORE_CONTAINS = 5;

/** Score awarded when a directory path segment contains a keyword */
export const SCORE_PATH_SEGMENT = 3;

/** Score awarded when a file's extension matches a keyword */
export const SCORE_EXTENSION = 1;

// ── Exploration configuration defaults ───────────────────────────────────

/** Default timeout for pre-exploration in milliseconds */
export const DEFAULT_EXPLORATION_TIMEOUT_MS = 30_000;

/** Maximum number of top-scoring files to parse for import/require analysis */
export const MAX_FILES_FOR_IMPORT_PARSING = 20;
