/**
 * Goal Verification Hook
 *
 * Post-workflow hook that runs GoalBackwardVerifier to validate
 * that a completed workflow actually achieved its stated goal.
 *
 * 3-stage verification: EXISTS → SUBSTANTIVE → WIRED
 *
 * @module core/hooks/goal-verification
 */

import { BaseHook } from '../base-hook';
import {
  HookEvent,
  HookContext,
  HookResult,
  HookConfig,
} from '../../interfaces/hook.interface';
import type {
  GoalBackwardResult,
  GoalDefinition,
} from '../../validation/interfaces/validation.interface';
import type { GoalBackwardVerifier } from '../../validation/goal-backward-verifier';

/**
 * Context data for goal verification hook
 */
export interface GoalVerificationContext {
  /** Goal description */
  goalDescription: string;
  /** Expected file paths from completed tasks */
  expectedPaths: string[];
}

/**
 * GoalVerificationHook
 *
 * Runs after workflow completion (WORKFLOW_END) to verify goal achievement.
 * - passed → continues normally
 * - failed → reports failure (does not abort — workflow is already complete)
 * - any error → continues (graceful degradation)
 */
export class GoalVerificationHook extends BaseHook<GoalVerificationContext, GoalBackwardResult> {
  readonly name = 'goal-verification';
  readonly description = 'Post-workflow goal achievement verification';
  readonly event = HookEvent.WORKFLOW_END;

  private readonly verifier: GoalBackwardVerifier;

  constructor(
    verifier: GoalBackwardVerifier,
    config?: Partial<HookConfig>,
  ) {
    super({ priority: 50, ...config });
    this.verifier = verifier;
  }

  async execute(
    context: HookContext<GoalVerificationContext>,
  ): Promise<HookResult<GoalBackwardResult>> {
    try {
      const { goalDescription, expectedPaths } = context.data;

      if (!expectedPaths || expectedPaths.length === 0) {
        return this.continue(undefined, 'No expected paths to verify');
      }

      const goal: GoalDefinition = {
        description: goalDescription,
        expectedPaths,
      };

      const result = await this.verifier.verify(goal);

      if (result.passed) {
        return this.continue(result, 'Goal verification passed');
      }

      // Report failure but don't abort (workflow already completed)
      const failedStages = result.stages
        .filter((s) => !s.passed)
        .map((s) => s.stage)
        .join(', ');

      return this.continue(
        result,
        `Goal verification failed at stages: ${failedStages}`,
      );
    } catch {
      return this.continue(undefined, 'Goal verification skipped due to error');
    }
  }
}
