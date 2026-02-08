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
import type { ISandboxEscalation, EscalationResult } from '../../security/escalation/escalation.interface.js';
import { SandboxLevel } from '../../security/escalation/escalation.interface.js';

/**
 * Extended result including sandbox escalation info when available.
 */
export interface ConfidenceCheckWithEscalation extends ConfidenceCheckResult {
  escalation?: EscalationResult;
}

/**
 * ConfidenceCheckHook
 *
 * Runs before task execution to assess confidence level.
 * - recommendation 'stop' → aborts the task
 * - recommendation 'alternatives' → continues with warning
 * - recommendation 'proceed' → continues normally
 * - any error → continues (graceful degradation)
 *
 * Optionally integrates with SandboxEscalation: the confidence score
 * drives sandbox level escalation/de-escalation for the executing entity.
 */
export class ConfidenceCheckHook extends BaseHook<TaskDocument, ConfidenceCheckWithEscalation> {
  readonly name = 'confidence-check';
  readonly description = 'Pre-execution confidence validation';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly checker: ConfidenceChecker;
  private readonly sandboxEscalation: ISandboxEscalation | null;

  constructor(
    checker: ConfidenceChecker,
    config?: Partial<HookConfig>,
    sandboxEscalation?: ISandboxEscalation,
  ) {
    super({ priority: 200, ...config });
    this.checker = checker;
    this.sandboxEscalation = sandboxEscalation ?? null;
  }

  async execute(context: HookContext<TaskDocument>): Promise<HookResult<ConfidenceCheckWithEscalation>> {
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

      // Sandbox escalation based on confidence score
      let escalation: EscalationResult | undefined;
      if (this.sandboxEscalation) {
        try {
          const entityId = task.metadata.to || task.metadata.id;
          escalation = this.sandboxEscalation.requestEscalation({
            entityId,
            entityType: 'agent',
            currentLevel: this.sandboxEscalation.getCurrentLevel(entityId),
            requestedLevel: this.confidenceToLevel(result.score),
            reason: `Confidence score: ${result.score}`,
            confidenceScore: result.score,
          });
        } catch {
          // Escalation error should not block the pipeline
        }
      }

      const resultWithEscalation: ConfidenceCheckWithEscalation = { ...result, escalation };

      switch (result.recommendation) {
        case 'stop':
          return this.abort(
            `Confidence too low (${result.score}/${result.threshold}): ${result.explanation || 'Task blocked by pre-execution validation'}`
          );

        case 'alternatives':
          return this.continue(
            resultWithEscalation,
            `Confidence marginal (${result.score}/${result.threshold}): Consider alternatives`
          );

        case 'proceed':
        default:
          return this.continue(resultWithEscalation);
      }
    } catch {
      // Graceful degradation: checker error should not block the pipeline
      return this.continue();
    }
  }

  /**
   * Map confidence score (0-100) to a sandbox level request.
   */
  private confidenceToLevel(score: number): SandboxLevel {
    if (score >= 95) return SandboxLevel.ELEVATED;
    if (score >= 75) return SandboxLevel.STANDARD;
    return SandboxLevel.RESTRICTED;
  }
}
