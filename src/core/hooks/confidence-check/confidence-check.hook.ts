/**
 * Confidence Check Hook
 *
 * Pre-execution hook that validates task confidence before processing.
 * Uses ConfidenceChecker to assess readiness and can abort low-confidence tasks.
 *
 * @module core/hooks/confidence-check
 */

import { BaseHook } from '../base-hook.js';
import {
  HookEvent,
  HookContext,
  HookResult,
  HookConfig,
} from '../../interfaces/hook.interface.js';
import type { TaskDocument } from '../../workspace/task-document.js';
import type {
  ConfidenceChecker,
  TaskContext,
  ConfidenceCheckResult,
} from '../../validation/confidence-checker.js';

/**
 * ConfidenceCheckHook
 *
 * Runs before task execution to assess confidence level.
 * - recommendation 'stop' → aborts the task
 * - recommendation 'alternatives' → continues with warning
 * - recommendation 'proceed' → continues normally
 * - any error → continues (graceful degradation)
 */
export class ConfidenceCheckHook extends BaseHook<TaskDocument, ConfidenceCheckResult> {
  readonly name = 'confidence-check';
  readonly description = 'Pre-execution confidence validation';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly checker: ConfidenceChecker;

  constructor(checker: ConfidenceChecker, config?: Partial<HookConfig>) {
    super({ priority: 200, ...config });
    this.checker = checker;
  }

  async execute(context: HookContext<TaskDocument>): Promise<HookResult<ConfidenceCheckResult>> {
    try {
      const task = context.data;

      // Convert TaskDocument → TaskContext
      const taskContext: TaskContext = {
        taskId: task.metadata.id,
        taskType: task.metadata.type,
        description: task.content,
        files: task.metadata.files?.map((f) => f.path),
        dependencies: task.metadata.dependencies?.map((d) => d.taskId),
      };

      const result = await this.checker.check(taskContext);

      switch (result.recommendation) {
        case 'stop':
          return this.abort(
            `Confidence too low (${result.score}/${result.threshold}): ${result.explanation || 'Task blocked by pre-execution validation'}`
          );

        case 'alternatives':
          return this.continue(
            result,
            `Confidence marginal (${result.score}/${result.threshold}): Consider alternatives`
          );

        case 'proceed':
        default:
          return this.continue(result);
      }
    } catch {
      // Graceful degradation: checker error should not block the pipeline
      return this.continue();
    }
  }
}
