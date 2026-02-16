/**
 * Planning Skill
 *
 * Extracted from PlanningAgent — task decomposition and plan creation.
 *
 * @module core/skills/skills
 */

import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../interfaces/skill.interface';
import type { PlanningOutput } from '../../orchestrator/agents/planning-agent';
import { createSkillFallback } from '../skill-fallback';

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
export class PlanningSkill
  implements ISkill<PlanningSkillInput, PlanningOutput>
{
  readonly name = 'planning';
  readonly description = 'Decomposes goals into structured plans with sub-tasks and phases';
  readonly tags = ['planning', 'decomposition', 'analysis'] as const;
  readonly version = '1.0.0';

  /** Executor function for LLM-backed planning */
  private readonly executor?: (
    input: PlanningSkillInput,
    context: SkillContext,
  ) => Promise<PlanningOutput>;

  constructor(options?: {
    executor?: (
      input: PlanningSkillInput,
      context: SkillContext,
    ) => Promise<PlanningOutput>;
  }) {
    this.executor = options?.executor;
  }

  validate(input: PlanningSkillInput): boolean {
    return typeof input.goal === 'string' && input.goal.length > 0;
  }

  canHandle(input: PlanningSkillInput): boolean {
    return this.validate(input);
  }

  async execute(
    input: PlanningSkillInput,
    context: SkillContext,
  ): Promise<SkillResult<PlanningOutput>> {
    const start = Date.now();

    if (!this.validate(input)) {
      return {
        success: false,
        error: 'Invalid input: goal is required',
        duration: Date.now() - start,
      };
    }

    try {
      if (this.executor) {
        const output = await this.executor(input, context);
        return {
          success: true,
          output,
          duration: Date.now() - start,
        };
      }

      // Default stub output (no LLM)
      const fallback = createSkillFallback('planning', 'no_executor', {
        goal: input.goal,
        constraints: input.constraints,
      });

      const output: PlanningOutput = {
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

      return {
        success: true,
        output,
        duration: Date.now() - start,
        metadata: { fallback },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        duration: Date.now() - start,
      };
    }
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
