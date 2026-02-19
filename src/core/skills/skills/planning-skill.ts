/**
 * Planning Skill
 *
 * Extracted from PlanningAgent — task decomposition and plan creation.
 *
 * @module core/skills/skills
 */

import type { SkillContext } from '../interfaces/skill.interface';
import type { PlanningOutput } from '../../orchestrator/agents/planning-agent';
import { BaseSkill } from '../base-skill';

/**
 * Input for planning skill
 */
export interface PlanningSkillInput {
  /** Goal to decompose */
  goal: string;
  /** Optional constraints */
  constraints?: string[];
  /** Maximum number of sub-tasks */
  maxTasks?: number;
}

/**
 * Planning skill — decomposes goals into structured plans
 */
export class PlanningSkill extends BaseSkill<PlanningSkillInput, PlanningOutput> {
  readonly name = 'planning';
  readonly description = 'Decomposes goals into structured plans with sub-tasks and phases';
  readonly tags = ['planning', 'decomposition', 'analysis'] as const;
  protected readonly validationError = 'Invalid input: goal is required';

  validate(input: PlanningSkillInput): boolean {
    return typeof input.goal === 'string' && input.goal.length > 0;
  }

  protected createFallbackOutput(input: PlanningSkillInput): PlanningOutput {
    return {
      title: `Plan: ${input.goal}`,
      summary: `Decomposition of: ${input.goal}`,
      tasks: [
        {
          title: input.goal,
          type: 'feature',
          targetTeam: 'development',
          description: input.goal,
          estimatedEffort: 'medium',
        },
      ],
    };
  }

  protected createFallbackContext(input: PlanningSkillInput): Record<string, unknown> {
    return {
      goal: input.goal,
      constraints: input.constraints,
    };
  }
}

/**
 * Factory function
 */
export function createPlanningSkill(options?: {
  executor?: (
    input: PlanningSkillInput,
    context: SkillContext,
  ) => Promise<PlanningOutput>;
}): PlanningSkill {
  return new PlanningSkill(options);
}
