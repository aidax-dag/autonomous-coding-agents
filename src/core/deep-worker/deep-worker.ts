/**
 * Deep Worker
 *
 * Orchestrates the full autonomy cycle:
 * 1. Pre-explore the context
 * 2. Self-plan the execution
 * 3. Execute each step with retry and continuation enforcement
 *
 * @module core/deep-worker
 */

import type {
  IDeepWorker,
  IPreExploration,
  ISelfPlanning,
  IRetryStrategy,
  ITodoContinuation,
  DeepWorkerContext,
  DeepWorkerResult,
  RetryStrategyInfo,
} from './interfaces/deep-worker.interface';

/**
 * Step executor — function that executes a single planned step
 */
export type StepExecutor = (
  stepId: string,
  stepDescription: string,
  strategy: RetryStrategyInfo,
  context: DeepWorkerContext,
) => Promise<void>;

/**
 * DeepWorker options
 */
export interface DeepWorkerOptions {
  /** Worker name */
  name: string;
  /** Pre-exploration component */
  exploration: IPreExploration;
  /** Self-planning component */
  planning: ISelfPlanning;
  /** Retry strategy component */
  retry: IRetryStrategy;
  /** Todo continuation enforcer */
  continuation: ITodoContinuation;
  /** Step executor (for actually running steps) */
  stepExecutor?: StepExecutor;
}

/**
 * Deep Worker implementation — composes autonomy components
 */
export class DeepWorker implements IDeepWorker {
  readonly name: string;
  readonly exploration: IPreExploration;
  readonly planning: ISelfPlanning;
  readonly retry: IRetryStrategy;
  readonly continuation: ITodoContinuation;
  private readonly stepExecutor?: StepExecutor;

  constructor(options: DeepWorkerOptions) {
    this.name = options.name;
    this.exploration = options.exploration;
    this.planning = options.planning;
    this.retry = options.retry;
    this.continuation = options.continuation;
    this.stepExecutor = options.stepExecutor;
  }

  async execute(context: DeepWorkerContext): Promise<DeepWorkerResult> {
    const start = Date.now();

    // Phase 1: Pre-explore
    const exploration = await this.exploration.explore(context);

    // Phase 2: Self-plan
    const plan = await this.planning.plan(context, exploration);

    // Phase 3: Track and execute
    this.continuation.trackSteps(plan.steps);

    let step = this.continuation.getNextStep();
    while (step) {
      const currentStepId = step.id;
      const currentStepDesc = step.description;

      const result = await this.retry.executeWithRetry(
        async (strategy) => {
          if (this.stepExecutor) {
            await this.stepExecutor(
              currentStepId,
              currentStepDesc,
              strategy,
              context,
            );
          }
        },
        context,
      );

      if (result.success) {
        this.continuation.completeStep(currentStepId);
      } else {
        this.continuation.failStep(
          currentStepId,
          result.error ?? 'Step failed',
        );
        // Mark dependent steps as blocked, but continue to next available
      }

      step = this.continuation.getNextStep();
    }

    const todoStatus = this.continuation.getStatus();

    return {
      success: todoStatus.failedSteps === 0 && todoStatus.allComplete,
      exploration,
      plan,
      todoStatus,
      duration: Date.now() - start,
      error: todoStatus.failedSteps > 0
        ? `${todoStatus.failedSteps} step(s) failed`
        : undefined,
    };
  }
}

/**
 * Factory function
 */
export function createDeepWorker(options: DeepWorkerOptions): DeepWorker {
  return new DeepWorker(options);
}
