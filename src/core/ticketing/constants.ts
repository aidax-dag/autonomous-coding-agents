/**
 * Ticketing module constants.
 *
 * Centralises magic numbers used across the ticketing subsystem so they can be
 * changed and reasoned about in a single place.
 *
 * @module core/ticketing/constants
 */

// ---------------------------------------------------------------------------
// ID formatting widths
// ---------------------------------------------------------------------------

/** Zero-padded width for ticket IDs (e.g. ticket-2026-000001) */
export const TICKET_ID_COUNTER_WIDTH = 6;

/** Zero-padded width for feature IDs (e.g. feature-2026-000001) */
export const FEATURE_ID_COUNTER_WIDTH = 6;

/** Zero-padded width for feature management numbers (e.g. FEAT-2026-00001) */
export const FEATURE_MGT_NUMBER_WIDTH = 5;

/** Zero-padded width for ticket management numbers (e.g. ACA-2026-00001) */
export const TICKET_MGT_NUMBER_WIDTH = 5;

// ---------------------------------------------------------------------------
// Aggregation limits
// ---------------------------------------------------------------------------

/** Maximum number of top labels returned in a feature management summary */
export const TOP_LABELS_LIMIT = 20;

// ---------------------------------------------------------------------------
// HTTP and sync
// ---------------------------------------------------------------------------

/** Upper bound (exclusive) for random jitter added to exponential backoff (ms) */
export const BACKOFF_JITTER_MAX_MS = 100;

/**
 * Calculate exponential backoff delay with random jitter.
 *
 * Formula: `baseDelay * 2^attempt + random(0..jitterMax)`
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  jitterMax: number = BACKOFF_JITTER_MAX_MS,
): number {
  return baseDelay * Math.pow(2, attempt) + Math.random() * jitterMax;
}

/** HTTP 204 No Content */
export const HTTP_STATUS_NO_CONTENT = 204;

/** HTTP 429 Too Many Requests (rate-limited) */
export const HTTP_STATUS_RATE_LIMIT = 429;

/** Minimum status code that indicates a server-side error (5xx range) */
export const HTTP_STATUS_SERVER_ERROR_MIN = 500;
