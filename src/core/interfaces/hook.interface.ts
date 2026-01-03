/**
 * Hook Interfaces
 *
 * SOLID Principles:
 * - S: IHook focuses only on lifecycle hook contract
 * - O: New hook events extend without modifying base
 * - I: Hook interfaces segregated by concern
 * - D: Consumers depend on IHook abstraction
 *
 * @module core/interfaces/hook
 */

/**
 * Hook event enumeration
 */
export enum HookEvent {
  // === Agent Lifecycle ===
  AGENT_INITIALIZING = 'agent:initializing',
  AGENT_INITIALIZED = 'agent:initialized',
  AGENT_STARTING = 'agent:starting',
  AGENT_STARTED = 'agent:started',
  AGENT_STOPPING = 'agent:stopping',
  AGENT_STOPPED = 'agent:stopped',
  AGENT_ERROR = 'agent:error',

  // === Task Lifecycle ===
  TASK_BEFORE = 'task:before',
  TASK_AFTER = 'task:after',
  TASK_ERROR = 'task:error',
  TASK_RETRY = 'task:retry',
  TASK_TIMEOUT = 'task:timeout',

  // === Tool Lifecycle ===
  TOOL_BEFORE = 'tool:before',
  TOOL_AFTER = 'tool:after',
  TOOL_ERROR = 'tool:error',

  // === Workflow Lifecycle ===
  WORKFLOW_START = 'workflow:start',
  WORKFLOW_STEP_START = 'workflow:step:start',
  WORKFLOW_STEP_END = 'workflow:step:end',
  WORKFLOW_END = 'workflow:end',
  WORKFLOW_ERROR = 'workflow:error',

  // === Git Operations ===
  GIT_COMMIT = 'git:commit',
  GIT_PUSH = 'git:push',
  GIT_PR_CREATE = 'git:pr:create',
  GIT_PR_MERGE = 'git:pr:merge',

  // === Context Management ===
  CONTEXT_THRESHOLD = 'context:threshold',
  CONTEXT_COMPACT = 'context:compact',
  CONTEXT_OVERFLOW = 'context:overflow',

  // === Session Management ===
  SESSION_START = 'session:start',
  SESSION_END = 'session:end',
  SESSION_CHECKPOINT = 'session:checkpoint',
  SESSION_RESTORE = 'session:restore',

  // === LLM Operations ===
  LLM_REQUEST = 'llm:request',
  LLM_RESPONSE = 'llm:response',
  LLM_ERROR = 'llm:error',
  LLM_STREAM_START = 'llm:stream:start',
  LLM_STREAM_END = 'llm:stream:end',

  // === Custom ===
  CUSTOM = 'custom',
}

/**
 * Hook action result types
 */
export enum HookAction {
  CONTINUE = 'continue',    // Proceed with operation
  SKIP = 'skip',            // Skip the operation
  RETRY = 'retry',          // Retry the operation
  ABORT = 'abort',          // Abort the operation
  MODIFY = 'modify',        // Modify context and continue
}

/**
 * Hook execution context
 */
export interface HookContext<T = unknown> {
  readonly event: HookEvent;
  readonly timestamp: Date;
  readonly source: string;
  readonly data: T;
  readonly metadata?: Record<string, unknown>;
  readonly previousResults?: HookResult[];
}

/**
 * Hook execution result
 */
export interface HookResult<T = unknown> {
  action: HookAction;
  data?: T;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Hook configuration
 */
export interface HookConfig {
  name: string;
  description?: string;
  event: HookEvent;
  priority: number;
  enabled?: boolean;
  timeout?: number;
  retryOnError?: boolean;
  conditions?: HookCondition[];
}

/**
 * Hook condition for conditional execution
 */
export interface HookCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex';
  value: unknown;
}

/**
 * Core Hook Interface
 *
 * Defines the contract that all hooks must implement.
 *
 * @interface IHook
 */
export interface IHook<TContext = unknown, TResult = unknown> {
  // === Identification ===
  readonly name: string;
  readonly description: string;
  readonly event: HookEvent;
  readonly priority: number;

  // === Execution ===
  /**
   * Execute the hook
   */
  execute(context: HookContext<TContext>): Promise<HookResult<TResult>>;

  /**
   * Check if hook should run for given context
   */
  shouldRun(context: HookContext<TContext>): boolean;

  // === Lifecycle ===
  /**
   * Enable the hook
   */
  enable(): void;

  /**
   * Disable the hook
   */
  disable(): void;

  /**
   * Check if hook is enabled
   */
  isEnabled(): boolean;

  // === Metadata ===
  /**
   * Get hook configuration
   */
  getConfig(): HookConfig;
}

/**
 * Hook constructor type
 */
export type HookConstructor = new (config?: Partial<HookConfig>) => IHook;

/**
 * Hook Registry Interface
 *
 * Manages hook registration and execution order
 */
export interface IHookRegistry {
  /**
   * Register a hook
   */
  register(hook: IHook): void;

  /**
   * Unregister a hook by name
   */
  unregister(name: string): boolean;

  /**
   * Get a hook by name
   */
  get(name: string): IHook | undefined;

  /**
   * Get all hooks for an event (sorted by priority)
   */
  getByEvent(event: HookEvent): IHook[];

  /**
   * Get all registered hooks
   */
  getAll(): IHook[];

  /**
   * Check if a hook is registered
   */
  has(name: string): boolean;

  /**
   * Get count of registered hooks
   */
  count(): number;

  /**
   * Enable/disable a hook
   */
  setEnabled(name: string, enabled: boolean): boolean;

  /**
   * Clear all registered hooks
   */
  clear(): void;
}

/**
 * Hook Executor Interface
 *
 * Executes hooks in order with error handling
 */
export interface IHookExecutor {
  /**
   * Execute all hooks for an event
   */
  executeHooks<TContext, TResult>(
    event: HookEvent,
    context: TContext,
    options?: HookExecutionOptions
  ): Promise<HookResult<TResult>[]>;

  /**
   * Execute hooks and reduce to final result
   */
  executeAndReduce<TContext, TResult>(
    event: HookEvent,
    context: TContext,
    reducer: HookResultReducer<TResult>,
    options?: HookExecutionOptions
  ): Promise<TResult>;

  /**
   * Execute hooks until one returns non-continue action
   */
  executeUntilAction<TContext>(
    event: HookEvent,
    context: TContext,
    action: HookAction,
    options?: HookExecutionOptions
  ): Promise<HookResult | undefined>;
}

/**
 * Hook execution options
 */
export interface HookExecutionOptions {
  timeout?: number;
  stopOnError?: boolean;
  stopOnAction?: HookAction[];
  parallel?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Hook result reducer function type
 */
export type HookResultReducer<T> = (
  accumulator: T | undefined,
  result: HookResult,
  index: number
) => T;

/**
 * Hook execution record for auditing
 */
export interface HookExecutionRecord {
  id: string;
  hookName: string;
  event: HookEvent;
  context: unknown;
  result: HookResult;
  timestamp: Date;
  duration: number;
  error?: Error;
}

/**
 * Built-in hook types
 */
export type BuiltinHookType =
  | 'context-monitor'
  | 'token-optimizer'
  | 'session-recovery'
  | 'auto-compaction'
  | 'comment-checker'
  | 'code-quality'
  | 'todo-enforcer'
  | 'think-mode';
