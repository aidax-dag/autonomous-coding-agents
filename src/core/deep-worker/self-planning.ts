/**
 * Self-Planning
 *
 * Generates execution plans autonomously based on task context
 * and exploration results.
 *
 * @module core/deep-worker
 */

import type {
  ISelfPlanning,
  DeepWorkerContext,
  ExplorationResult,
  SelfPlanResult,
  PlannedStep,
} from './interfaces/deep-worker.interface';

/**
 * Planning executor — pluggable function for LLM-backed planning
 */
export type PlanningExecutor = (
  context: DeepWorkerContext,
  exploration: ExplorationResult,
) => Promise<SelfPlanResult>;

/**
 * SelfPlanning options
 */
export interface SelfPlanningOptions {
  /** Custom executor (for LLM integration) */
  executor?: PlanningExecutor;
  /** Maximum steps to generate */
  maxSteps?: number;
}

/**
 * Default self-planning implementation
 */
export class SelfPlanning implements ISelfPlanning {
  private readonly executor?: PlanningExecutor;
  private readonly maxSteps: number;

  constructor(options: SelfPlanningOptions = {}) {
    this.executor = options.executor;
    this.maxSteps = options.maxSteps ?? 20;
  }

  async plan(
    context: DeepWorkerContext,
    exploration: ExplorationResult,
  ): Promise<SelfPlanResult> {
    const start = Date.now();

    if (this.executor) {
      const result = await this.executor(context, exploration);
      return {
        ...result,
        steps: result.steps.slice(0, this.maxSteps),
        duration: Date.now() - start,
      };
    }

    // Default: generate a basic plan from the task description
    const steps: PlannedStep[] = [
      {
        id: 'explore',
        description: `Explore context for: ${context.taskDescription}`,
        type: 'explore',
        dependencies: [],
        effort: 'small',
        completed: false,
      },
      {
        id: 'implement',
        description: `Implement: ${context.taskDescription}`,
        type: 'implement',
        dependencies: ['explore'],
        effort: 'medium',
        completed: false,
      },
      {
        id: 'test',
        description: `Test: ${context.taskDescription}`,
        type: 'test',
        dependencies: ['implement'],
        effort: 'small',
        completed: false,
      },
    ];

    return {
      steps,
      summary: `Plan for: ${context.taskDescription}`,
      totalEffort: 'medium',
      duration: Date.now() - start,
    };
  }
}

/**
 * Factory function
 */
export function createSelfPlanning(
  options?: SelfPlanningOptions,
): SelfPlanning {
  return new SelfPlanning(options);
}
