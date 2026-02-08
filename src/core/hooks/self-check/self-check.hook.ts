/**
 * Self-Check Hook
 *
 * Post-execution hook that validates task results for hallucinations
 * and unverified assumptions using SelfCheckProtocol.
 *
 * @module core/hooks/self-check
 */

import { BaseHook } from '../base-hook.js';
import {
  HookEvent,
  HookContext,
  HookResult,
  HookConfig,
} from '../../interfaces/hook.interface.js';
import type { TaskDocument } from '../../workspace/task-document.js';
import type { TaskHandlerResult } from '../../orchestrator/team-agent.js';
import type { SelfCheckProtocol } from '../../validation/self-check-protocol.js';
import type {
  SelfCheckResult,
  Evidence,
} from '../../validation/interfaces/validation.interface.js';

/**
 * Context passed to TASK_AFTER hooks
 */
export interface TaskAfterContext {
  task: TaskDocument;
  result: TaskHandlerResult;
}

/**
 * SelfCheckHook
 *
 * Runs after task execution to detect hallucinations and unverified claims.
 * Always continues (advisory only) - post-execution checks don't block the pipeline.
 */
export class SelfCheckHook extends BaseHook<TaskAfterContext, SelfCheckResult> {
  readonly name = 'self-check';
  readonly description = 'Post-execution hallucination detection';
  readonly event = HookEvent.TASK_AFTER;

  private readonly protocol: SelfCheckProtocol;

  constructor(protocol: SelfCheckProtocol, config?: Partial<HookConfig>) {
    super({ priority: 200, ...config });
    this.protocol = protocol;
  }

  async execute(context: HookContext<TaskAfterContext>): Promise<HookResult<SelfCheckResult>> {
    try {
      const { result } = context.data;

      // Convert TaskHandlerResult → Evidence
      const evidence: Evidence = {
        testsPassed: result.success,
        testOutput: typeof result.result === 'string' ? result.result : JSON.stringify(result.result),
      };

      const checkResult = await this.protocol.check(evidence);

      if (!checkResult.passed) {
        const failedQuestions = checkResult.questions
          .filter((q) => !q.passed)
          .map((q) => q.id);
        const dangerSignals = checkResult.dangerSignals
          .filter((d) => d.found)
          .map((d) => d.signal);

        const warnings: string[] = [];
        if (failedQuestions.length > 0) {
          warnings.push(`Failed checks: ${failedQuestions.join(', ')}`);
        }
        if (dangerSignals.length > 0) {
          warnings.push(`Danger signals: ${dangerSignals.join(', ')}`);
        }

        return this.continue(checkResult, warnings.join('; '));
      }

      return this.continue(checkResult);
    } catch {
      // Graceful degradation: protocol error should not affect the pipeline
      return this.continue();
    }
  }
}
