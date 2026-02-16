/**
 * Dry-Run Executor
 *
 * A safe-mode TaskExecutor that does NOT call any LLM.
 * Returns a structured dry-run result for every task.
 * When a real executor IS configured, delegates to it instead.
 *
 * @module core/benchmark
 */

import type { BenchmarkTask, BenchmarkResult } from './interfaces/benchmark.interface';
import type { TaskExecutor } from './benchmark-runner';

/**
 * Reason code used in dry-run results.
 */
export const DRY_RUN_REASON_CODE = 'DRY_RUN' as const;

/**
 * Configuration for the dry-run executor.
 */
export interface DryRunExecutorConfig {
  /** Optional real executor to delegate to when configured */
  delegate?: TaskExecutor;
}

/**
 * Create a TaskExecutor that operates in dry-run mode.
 *
 * - When no delegate is provided, returns a simulated failure result
 *   with reasonCode 'DRY_RUN' — no LLM calls are made.
 * - When a delegate IS provided, passes through to the real executor.
 */
export function createDryRunExecutor(config: DryRunExecutorConfig = {}): TaskExecutor {
  return async (task: BenchmarkTask): Promise<BenchmarkResult> => {
    if (config.delegate) {
      return config.delegate(task);
    }

    return {
      taskId: task.id,
      passed: false,
      testsPassedRatio: 0,
      generatedPatch: '',
      tokensUsed: 0,
      durationMs: 0,
      llmCalls: 0,
      error: `Dry-run mode: no LLM executor configured [${DRY_RUN_REASON_CODE}]`,
    };
  };
}
