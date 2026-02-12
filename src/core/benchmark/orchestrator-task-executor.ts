/**
 * Orchestrator Task Executor
 *
 * Implements the BenchmarkRunner's pluggable TaskExecutor interface
 * by wrapping OrchestratorRunner to execute benchmark tasks as goals.
 *
 * @module core/benchmark
 */

import type { BenchmarkTask, BenchmarkResult } from './interfaces/benchmark.interface';
import type { TaskExecutor } from './benchmark-runner';
import type { OrchestratorRunner } from '../orchestrator/orchestrator-runner';

/**
 * Configuration for the orchestrator task executor
 */
export interface OrchestratorTaskExecutorConfig {
  /** The orchestrator runner to use for task execution */
  runner: OrchestratorRunner;
  /** Default team to route benchmark tasks to (default: 'development') */
  defaultTeam?: string;
  /** Default priority for benchmark tasks (default: 'medium') */
  defaultPriority?: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Create a TaskExecutor that delegates to OrchestratorRunner.
 *
 * Maps BenchmarkTask → executeGoal → BenchmarkResult.
 */
export function createOrchestratorTaskExecutor(
  config: OrchestratorTaskExecutorConfig,
): TaskExecutor {
  const runner = config.runner;
  const defaultPriority = config.defaultPriority ?? 'medium';

  return async (task: BenchmarkTask): Promise<BenchmarkResult> => {
    const startTime = Date.now();
    let tokensUsed = 0;
    let llmCalls = 0;

    try {
      const goalResult = await runner.executeGoal(
        `[Benchmark] ${task.id}: ${task.description.slice(0, 100)}`,
        buildGoalDescription(task),
        {
          priority: defaultPriority,
          tags: ['benchmark', ...task.tags],
          waitForCompletion: true,
        },
      );

      const durationMs = Date.now() - startTime;

      // Extract token/call metrics from telemetry if available
      const telemetry = runner.getTelemetry();
      if (telemetry) {
        const completedSpans = telemetry.getTraceManager().getCompletedSpans();
        for (const span of completedSpans) {
          if (span.attributes['tokens.total']) {
            tokensUsed += Number(span.attributes['tokens.total']);
          }
          if (span.name === 'llm.chat' || span.name === 'llm.call') {
            llmCalls++;
          }
        }
      }

      const passed = goalResult.success && goalResult.failedTasks === 0;
      const totalTasks = goalResult.completedTasks + goalResult.failedTasks;

      return {
        taskId: task.id,
        passed,
        testsPassedRatio: totalTasks > 0
          ? goalResult.completedTasks / totalTasks
          : 0,
        generatedPatch: '', // Patch extraction not available from goal results
        tokensUsed,
        durationMs,
        llmCalls,
        error: passed ? undefined : collectErrors(goalResult),
      };
    } catch (error) {
      return {
        taskId: task.id,
        passed: false,
        testsPassedRatio: 0,
        generatedPatch: '',
        tokensUsed,
        durationMs: Date.now() - startTime,
        llmCalls,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

/**
 * Build a goal description from the benchmark task definition.
 */
function buildGoalDescription(task: BenchmarkTask): string {
  const lines: string[] = [
    `Repository: ${task.repo}`,
    `Difficulty: ${task.difficulty}`,
    '',
    task.description,
  ];

  if (task.expectedPatch) {
    lines.push('', 'Expected patch pattern:', task.expectedPatch);
  }

  if (task.testCommands.length > 0) {
    lines.push('', 'Validation commands:');
    for (const cmd of task.testCommands) {
      lines.push(`  $ ${cmd}`);
    }
  }

  return lines.join('\n');
}

/**
 * Collect error messages from a goal result.
 */
function collectErrors(goalResult: { tasks: Array<{ error?: string }> }): string {
  const errors = goalResult.tasks
    .filter((t) => t.error)
    .map((t) => t.error!);
  return errors.length > 0 ? errors.join('; ') : 'Unknown error';
}
