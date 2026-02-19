/**
 * Hook System Constants
 * @module core/hooks/constants
 */

/** Maximum number of execution history records retained by the HookExecutor */
export const MAX_EXECUTION_HISTORY = 500;

/** Default priority assigned to hooks when no explicit priority is configured */
export const DEFAULT_HOOK_PRIORITY = 100;

/** Default timeout in milliseconds for individual hook execution */
export const DEFAULT_HOOK_TIMEOUT_MS = 5_000;
