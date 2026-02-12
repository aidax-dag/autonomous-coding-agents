/**
 * Sandbox Escalation Hook
 *
 * Pre-execution hook that evaluates sandbox level based on ConfidenceChecker
 * results and task history. Integrates SandboxEscalation with the hook pipeline.
 *
 * @module core/hooks/sandbox-escalation
 */

import { BaseHook } from '../base-hook';
import {
  HookEvent,
  HookContext,
  HookResult,
  HookConfig,
} from '../../interfaces/hook.interface';
import type { TaskDocument } from '../../workspace/task-document';
import type { SandboxEscalation } from '../../security/sandbox-escalation';
import type { ConfidenceChecker } from '../../validation/confidence-checker';
import { SandboxLevel } from '../../security/interfaces/escalation.interface';
import type {
  EscalationContext,
  EscalationResult,
} from '../../security/interfaces/escalation.interface';

/**
 * SandboxEscalationHook
 *
 * Runs before task execution to evaluate and update sandbox level.
 * Uses ConfidenceChecker scores to drive escalation decisions.
 *
 * - Evaluates confidence → updates sandbox level
 * - Aborts if task requires higher permissions than current level
 * - Provides escalation result as hook data
 */
export class SandboxEscalationHook extends BaseHook<TaskDocument, EscalationResult> {
  readonly name = 'sandbox-escalation';
  readonly description = 'Pre-execution sandbox level evaluation';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly sandbox: SandboxEscalation;
  private readonly checker: ConfidenceChecker;
  private successfulTasks = 0;
  private failedTasks = 0;

  constructor(
    sandbox: SandboxEscalation,
    checker: ConfidenceChecker,
    config?: Partial<HookConfig>,
  ) {
    // Priority 150: runs after confidence-check (200) but before main execution
    super({ priority: 150, ...config });
    this.sandbox = sandbox;
    this.checker = checker;
  }

  async execute(context: HookContext<TaskDocument>): Promise<HookResult<EscalationResult>> {
    try {
      const task = context.data;

      // Run confidence check
      const confidenceResult = await this.checker.check({
        taskId: task.metadata.id,
        taskType: task.metadata.type,
        description: task.content,
        files: task.metadata.files?.map((f) => f.path),
        dependencies: task.metadata.dependencies?.map((d) => d.taskId),
      });

      // Build escalation context
      const escalationContext: EscalationContext = {
        confidenceScore: confidenceResult.score,
        successfulTasks: this.successfulTasks,
        failedTasks: this.failedTasks,
        currentLevel: this.sandbox.getCurrentLevel(),
        taskType: task.metadata.type,
      };

      // Evaluate escalation
      const result = this.sandbox.evaluate(escalationContext);

      if (result.changed) {
        const emoji = result.direction === 'promoted' ? 'promoted' : 'demoted';
        return this.continue(
          result,
          `Sandbox ${emoji}: ${result.previousLevel} -> ${result.newLevel} (${result.reason})`,
        );
      }

      return this.continue(result);
    } catch {
      // Graceful degradation: don't block pipeline on escalation errors
      return this.continue();
    }
  }

  /**
   * Record task success (called externally after task completion)
   */
  recordSuccess(): void {
    this.successfulTasks++;
  }

  /**
   * Record task failure (called externally after task error)
   */
  recordFailure(): void {
    this.failedTasks++;
  }

  /**
   * Get current sandbox level
   */
  getCurrentLevel(): SandboxLevel {
    return this.sandbox.getCurrentLevel();
  }

  /**
   * Get task counters for testing
   */
  getCounters(): { successful: number; failed: number } {
    return { successful: this.successfulTasks, failed: this.failedTasks };
  }
}
