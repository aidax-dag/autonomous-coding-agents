/**
 * Deep Worker Interfaces
 *
 * Defines the core abstractions for genuine agent autonomy:
 * - IDeepWorker: enhanced agent with exploration and self-planning
 * - IPreExploration: codebase/context exploration before work
 * - ISelfPlanning: autonomous plan generation
 * - IRetryStrategy: retry with strategy change on failure
 * - ITodoContinuation: enforce completion of all planned steps
 *
 * @module core/deep-worker/interfaces
 */

/**
 * Task context for deep worker operations
 */
export interface DeepWorkerContext {
  /** Working directory */
  workspaceDir: string;
  /** Task description */
  taskDescription: string;
  /** Project context/description */
  projectContext?: string;
  /** Maximum retries before giving up */
  maxRetries?: number;
  /** Timeout per step in ms */
  stepTimeout?: number;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Exploration result from pre-exploration phase
 */
export interface ExplorationResult {
  /** Files discovered and relevant */
  relevantFiles: string[];
  /** Patterns identified */
  patterns: string[];
  /** Dependencies identified */
  dependencies: string[];
  /** Summary of exploration */
  summary: string;
  /** Duration in ms */
  duration: number;
}

/**
 * A single planned step
 */
export interface PlannedStep {
  /** Step ID */
  id: string;
  /** Step description */
  description: string;
  /** Step type */
  type: 'explore' | 'implement' | 'test' | 'review' | 'refactor';
  /** Dependencies (other step IDs that must complete first) */
  dependencies: string[];
  /** Estimated effort */
  effort: 'small' | 'medium' | 'large';
  /** Whether this step is complete */
  completed: boolean;
  /** Error if step failed */
  error?: string;
}

/**
 * Self-planning result
 */
export interface SelfPlanResult {
  /** Generated steps */
  steps: PlannedStep[];
  /** Plan summary */
  summary: string;
  /** Estimated total effort */
  totalEffort: 'small' | 'medium' | 'large';
  /** Duration to generate plan in ms */
  duration: number;
}

/**
 * Strategy for retry after failure
 */
export interface RetryStrategyInfo {
  /** Strategy name */
  name: string;
  /** Why this strategy was chosen */
  reason: string;
  /** Changes from previous attempt */
  changes: string[];
  /** Attempt number */
  attempt: number;
  /** Maximum attempts */
  maxAttempts: number;
}

/**
 * Result of a retry attempt
 */
export interface RetryResult {
  /** Whether the retry succeeded */
  success: boolean;
  /** Strategy that was used */
  strategy: RetryStrategyInfo;
  /** Error if still failed */
  error?: string;
  /** Output if succeeded */
  output?: unknown;
  /** Duration in ms */
  duration: number;
}

/**
 * Todo continuation status
 */
export interface TodoStatus {
  /** Total steps in the plan */
  totalSteps: number;
  /** Completed steps */
  completedSteps: number;
  /** Failed steps */
  failedSteps: number;
  /** Remaining steps */
  remainingSteps: number;
  /** Whether all steps are complete */
  allComplete: boolean;
  /** Incomplete step IDs */
  incompleteStepIds: string[];
}

// ── Component Interfaces ───────────────────────────────────

/**
 * Pre-exploration: explores the context before starting work
 */
export interface IPreExploration {
  /**
   * Explore the task context and return findings
   */
  explore(context: DeepWorkerContext): Promise<ExplorationResult>;
}

/**
 * Self-planning: generates an execution plan autonomously
 */
export interface ISelfPlanning {
  /**
   * Generate a plan based on task context and exploration results
   */
  plan(
    context: DeepWorkerContext,
    exploration: ExplorationResult,
  ): Promise<SelfPlanResult>;
}

/**
 * Retry strategy: retries with different approach on failure
 */
export interface IRetryStrategy {
  /**
   * Generate a new strategy after a failure
   */
  getNextStrategy(
    context: DeepWorkerContext,
    previousError: string,
    attempt: number,
  ): RetryStrategyInfo | null;

  /**
   * Execute with retry logic
   */
  executeWithRetry<T>(
    fn: (strategy: RetryStrategyInfo) => Promise<T>,
    context: DeepWorkerContext,
  ): Promise<RetryResult>;
}

/**
 * Todo continuation enforcer: ensures all steps complete
 */
export interface ITodoContinuation {
  /**
   * Track a set of planned steps
   */
  trackSteps(steps: PlannedStep[]): void;

  /**
   * Mark a step as complete
   */
  completeStep(stepId: string): void;

  /**
   * Mark a step as failed
   */
  failStep(stepId: string, error: string): void;

  /**
   * Get current todo status
   */
  getStatus(): TodoStatus;

  /**
   * Get the next incomplete step (respecting dependencies)
   */
  getNextStep(): PlannedStep | null;

  /**
   * Reset tracking
   */
  reset(): void;
}

/**
 * Deep Worker: autonomous agent with exploration, planning, retry, and completion
 */
export interface IDeepWorker {
  /** Worker name */
  readonly name: string;

  /** Pre-exploration component */
  readonly exploration: IPreExploration;

  /** Self-planning component */
  readonly planning: ISelfPlanning;

  /** Retry strategy component */
  readonly retry: IRetryStrategy;

  /** Todo continuation enforcer */
  readonly continuation: ITodoContinuation;

  /**
   * Execute a task with full autonomy:
   * 1. Pre-explore the context
   * 2. Generate a plan
   * 3. Execute each step with retry and continuation
   */
  execute(context: DeepWorkerContext): Promise<DeepWorkerResult>;
}

/**
 * Result of a deep worker execution
 */
export interface DeepWorkerResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Exploration findings */
  exploration: ExplorationResult;
  /** Generated plan */
  plan: SelfPlanResult;
  /** Todo completion status */
  todoStatus: TodoStatus;
  /** Total duration in ms */
  duration: number;
  /** Error if failed */
  error?: string;
}
