# F012 -- DeepWorker

> Autonomous agent orchestration through composable exploration, self-planning, retry, and completion enforcement.

## 1. Purpose

The DeepWorker module provides genuine agent autonomy by composing four distinct capabilities into a single execution cycle: context exploration before work begins, autonomous plan generation, retry with strategy adaptation on failure, and enforcement that all planned steps reach completion. Each capability is defined as a pluggable interface, allowing LLM-backed implementations to be injected while maintaining testability through default stubs.

## 2. Interface

**Source**: `src/core/deep-worker/interfaces/deep-worker.interface.ts`

### Context and Result Types

```typescript
interface DeepWorkerContext {
  workspaceDir: string;
  taskDescription: string;
  projectContext?: string;
  maxRetries?: number;
  stepTimeout?: number;
  metadata?: Record<string, unknown>;
}

interface DeepWorkerResult {
  success: boolean;
  exploration: ExplorationResult;
  plan: SelfPlanResult;
  todoStatus: TodoStatus;
  duration: number;
  error?: string;
}
```

### Component Interfaces

```typescript
interface IPreExploration {
  explore(context: DeepWorkerContext): Promise<ExplorationResult>;
}

interface ISelfPlanning {
  plan(context: DeepWorkerContext, exploration: ExplorationResult): Promise<SelfPlanResult>;
}

interface IRetryStrategy {
  getNextStrategy(context: DeepWorkerContext, previousError: string, attempt: number): RetryStrategyInfo | null;
  executeWithRetry<T>(fn: (strategy: RetryStrategyInfo) => Promise<T>, context: DeepWorkerContext): Promise<RetryResult>;
}

interface ITodoContinuation {
  trackSteps(steps: PlannedStep[]): void;
  completeStep(stepId: string): void;
  failStep(stepId: string, error: string): void;
  getStatus(): TodoStatus;
  getNextStep(): PlannedStep | null;
  reset(): void;
}

interface IDeepWorker {
  readonly name: string;
  readonly exploration: IPreExploration;
  readonly planning: ISelfPlanning;
  readonly retry: IRetryStrategy;
  readonly continuation: ITodoContinuation;
  execute(context: DeepWorkerContext): Promise<DeepWorkerResult>;
}
```

### Supporting Types

```typescript
interface PlannedStep {
  id: string;
  description: string;
  type: 'explore' | 'implement' | 'test' | 'review' | 'refactor';
  dependencies: string[];
  effort: 'small' | 'medium' | 'large';
  completed: boolean;
  error?: string;
}

interface TodoStatus {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  remainingSteps: number;
  allComplete: boolean;
  incompleteStepIds: string[];
}
```

## 3. Implementation

### DeepWorker (`src/core/deep-worker/deep-worker.ts`)

- **Class**: `DeepWorker implements IDeepWorker`
- **Config**: `DeepWorkerOptions { name, exploration, planning, retry, continuation, stepExecutor? }`
- **Execution cycle**:
  1. Pre-explore via `this.exploration.explore(context)`.
  2. Self-plan via `this.planning.plan(context, exploration)`.
  3. Track steps via `this.continuation.trackSteps(plan.steps)`.
  4. Loop: get next step, execute with retry, mark complete or failed, continue to next available.
  5. Return composite result with exploration, plan, and todo status.
- **Key behavior**: Failed steps are marked as failed (not retried infinitely). Dependents of failed steps are blocked by the TodoContinuationEnforcer.
- **Factory**: `createDeepWorker(options)`

### PreExploration (`src/core/deep-worker/pre-exploration.ts`)

- **Class**: `PreExploration implements IPreExploration`
- **Config**: `maxFiles` (default 50), `timeout` (default 30000ms), optional `executor`
- **Default behavior**: Returns empty exploration result with task summary.
- **Custom executor**: Runs with timeout via `Promise.race`, truncates files to `maxFiles`.

### SelfPlanning (`src/core/deep-worker/self-planning.ts`)

- **Class**: `SelfPlanning implements ISelfPlanning`
- **Config**: `maxSteps` (default 20), optional `executor`
- **Default behavior**: Generates a 3-step plan (explore, implement, test) with dependency chain.

### RetryStrategy (`src/core/deep-worker/retry-strategy.ts`)

- **Class**: `RetryStrategy implements IRetryStrategy`
- **Config**: `maxRetries` (default 3), optional `strategyGenerator`, `retryDelay` (default 0)
- **Default strategy progression**: `original` -> `simplified` -> `alternative` -> `decomposed`
- **Key behavior**: Returns `null` from `getNextStrategy()` when attempts are exhausted. The `executeWithRetry()` method wraps a function with the full retry loop.
- **Important note**: The `strategyGenerator` option (not `generator`) is the correct property name.

### TodoContinuationEnforcer (`src/core/deep-worker/todo-enforcer.ts`)

- **Class**: `TodoContinuationEnforcer implements ITodoContinuation`
- **Key behaviors**:
  - `getNextStep()` respects dependency ordering: a step is only available if all its dependencies are completed (not just resolved).
  - Steps with failed dependencies are blocked (skipped, not returned).
  - Failed steps retain their error and are excluded from future iteration.

## 4. Dependencies

- **Depends on**: No external module dependencies. All four component interfaces are self-contained.
- **Depended on by**: Orchestrator agents (uses DeepWorker for autonomous task execution), integration tests.

## 5. Testing

- **Test file location**: `tests/unit/core/deep-worker/deep-worker.test.ts`
- **Test count**: 7 tests
- **Key test scenarios**:
  - Full autonomy cycle with default stubs (3 steps: explore, implement, test)
  - Step executor invocation order verification
  - Step failure with retry (succeeds on second attempt)
  - Exhausted retries reporting failure
  - Custom exploration executor injection
  - Component exposure verification
  - Factory function creation
