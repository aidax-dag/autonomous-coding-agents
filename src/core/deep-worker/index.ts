/**
 * Deep Worker Module
 *
 * Provides genuine agent autonomy through composable components:
 * - PreExploration: codebase/context exploration before work
 * - SelfPlanning: autonomous plan generation
 * - RetryStrategy: retry with strategy change on failure
 * - TodoContinuationEnforcer: ensure all planned steps complete
 * - DeepWorker: orchestrates the full autonomy cycle
 *
 * @module core/deep-worker
 */

// ── Interfaces ─────────────────────────────────────────────
export type {
  IDeepWorker,
  IPreExploration,
  ISelfPlanning,
  IRetryStrategy,
  ITodoContinuation,
  DeepWorkerContext,
  DeepWorkerResult,
  ExplorationResult,
  SelfPlanResult,
  PlannedStep,
  RetryStrategyInfo,
  RetryResult,
  TodoStatus,
} from './interfaces/deep-worker.interface';

// ── Components ─────────────────────────────────────────────
export {
  PreExploration,
  createPreExploration,
  type PreExplorationOptions,
  type ExplorationExecutor,
} from './pre-exploration';

export {
  SelfPlanning,
  createSelfPlanning,
  type SelfPlanningOptions,
  type PlanningExecutor,
} from './self-planning';

export {
  RetryStrategy,
  createRetryStrategy,
  type RetryStrategyOptions,
  type StrategyGenerator,
} from './retry-strategy';

export {
  TodoContinuationEnforcer,
  createTodoContinuationEnforcer,
} from './todo-enforcer';

// ── Deep Worker ────────────────────────────────────────────
export {
  DeepWorker,
  createDeepWorker,
  type DeepWorkerOptions,
  type StepExecutor,
} from './deep-worker';
