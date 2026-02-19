/**
 * Orchestrator Constants
 *
 * Named constants extracted from orchestrator module to eliminate magic numbers.
 */

// -- Timeouts ----------------------------------------------------------------
export const DEFAULT_TASK_TIMEOUT_MS = 300_000;
export const HEALTH_CHECK_INTERVAL_MS = 30_000;
export const STATUS_POLL_INTERVAL_MS = 1_000;

// -- Concurrency -------------------------------------------------------------
export const DEFAULT_MAX_CONCURRENT_TASKS = 10;
export const DEFAULT_PARALLEL_CONCURRENCY = 5;
export const DEFAULT_AGENT_POOL_MAX = 3;
export const GLOBAL_AGENT_POOL_MAX = 10;

// -- Thresholds --------------------------------------------------------------
export const MIN_CONFIDENCE_THRESHOLD = 70;
export const CONTEXT_BUDGET_WARNING_PCT = 95;

// -- Retry -------------------------------------------------------------------
export const MAX_TASK_RETRIES = 2;
export const MAX_CONSECUTIVE_ERRORS = 5;

// -- Error Classification Patterns -------------------------------------------
export const ERROR_PATTERNS = {
  SYSTEM: ['enospc', 'out of memory', 'heap'],
  ROUTING: ['no team registered', 'not running'],
  TRANSIENT: ['timeout', 'rate limit', '503', '429', 'econnreset'],
} as const;

// -- ID Generation -----------------------------------------------------------

/**
 * Generate a unique ID with the given prefix.
 *
 * Format: `<prefix>-<timestamp>-<random>`
 *
 * @example generateUniqueId('goal')  // 'goal-1718000000000-a1b2c3d4e'
 * @example generateUniqueId('xmlplan') // 'xmlplan-1718000000000-x9y8z7w6v'
 */
export function generateUniqueId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
