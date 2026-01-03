/**
 * State Machine Module
 *
 * Provides a generic state machine implementation for workflow and step state management.
 * Supports typed states, transitions, guards, actions, and history tracking.
 *
 * SOLID Principles:
 * - S: StateMachine focuses solely on state transition management
 * - O: Extensible through generic types and transition configurations
 * - L: All state machine instances follow the same contract
 * - I: Separate interfaces for configuration, transitions, and events
 * - D: Depends on abstractions (generic types, event handlers)
 *
 * @module core/workflow/state-machine
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import { WorkflowStatus, StepStatus } from './workflow-definition';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Transition guard function type
 * Returns true if the transition is allowed
 */
export type TransitionGuard<TContext = unknown> = (
  context: TContext,
  from: string,
  to: string
) => boolean;

/**
 * Transition action function type
 * Executed when a transition occurs
 */
export type TransitionAction<TContext = unknown> = (
  context: TContext,
  from: string,
  to: string
) => void | Promise<void>;

/**
 * State entry/exit action type
 */
export type StateAction<TContext = unknown> = (
  context: TContext,
  state: string
) => void | Promise<void>;

/**
 * Transition definition
 */
export interface TransitionDefinition<TContext = unknown> {
  from: string | string[];
  to: string;
  guard?: TransitionGuard<TContext>;
  action?: TransitionAction<TContext>;
}

/**
 * State definition
 */
export interface StateDefinition<TContext = unknown> {
  name: string;
  onEnter?: StateAction<TContext>;
  onExit?: StateAction<TContext>;
  metadata?: Record<string, unknown>;
}

/**
 * State machine configuration
 */
export interface StateMachineConfig<TState extends string, TContext = unknown> {
  id: string;
  initialState: TState;
  states: StateDefinition<TContext>[];
  transitions: TransitionDefinition<TContext>[];
  context?: TContext;
  enableHistory?: boolean;
  maxHistorySize?: number;
}

/**
 * Transition history entry
 */
export interface TransitionHistoryEntry {
  id: string;
  from: string;
  to: string;
  timestamp: Date;
  trigger?: string;
  metadata?: Record<string, unknown>;
}

/**
 * State machine events
 */
export const StateMachineEvents = {
  STATE_ENTERED: 'state:entered',
  STATE_EXITED: 'state:exited',
  TRANSITION_STARTED: 'transition:started',
  TRANSITION_COMPLETED: 'transition:completed',
  TRANSITION_FAILED: 'transition:failed',
  TRANSITION_DENIED: 'transition:denied',
} as const;

export type StateMachineEventType = typeof StateMachineEvents[keyof typeof StateMachineEvents];

/**
 * State machine event payload
 */
export interface StateMachineEventPayload<TState extends string = string> {
  machineId: string;
  currentState: TState;
  previousState?: TState;
  targetState?: TState;
  timestamp: Date;
  trigger?: string;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * State machine interface
 */
export interface IStateMachine<TState extends string, TContext = unknown> {
  readonly id: string;
  readonly currentState: TState;
  readonly context: TContext;
  readonly history: TransitionHistoryEntry[];

  canTransitionTo(state: TState): boolean;
  getAvailableTransitions(): TState[];
  transition(to: TState, trigger?: string): Promise<boolean>;
  reset(): void;

  on(event: StateMachineEventType, handler: (payload: StateMachineEventPayload<TState>) => void): void;
  off(event: StateMachineEventType, handler: (payload: StateMachineEventPayload<TState>) => void): void;
}

/**
 * State machine snapshot for serialization
 */
export interface StateMachineSnapshot<TState extends string, TContext = unknown> {
  id: string;
  currentState: TState;
  context: TContext;
  history: TransitionHistoryEntry[];
  createdAt: Date;
}

// ============================================================================
// Schemas
// ============================================================================

export const TransitionDefinitionSchema = z.object({
  from: z.union([z.string(), z.array(z.string())]),
  to: z.string(),
});

export const StateDefinitionSchema = z.object({
  name: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const StateMachineConfigSchema = z.object({
  id: z.string().min(1),
  initialState: z.string(),
  states: z.array(StateDefinitionSchema).min(1),
  transitions: z.array(TransitionDefinitionSchema),
  enableHistory: z.boolean().default(true),
  maxHistorySize: z.number().int().min(0).max(10000).default(1000),
});

// ============================================================================
// State Machine Implementation
// ============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generic State Machine
 *
 * Provides a type-safe state machine implementation with:
 * - Typed states and transitions
 * - Guard conditions for transitions
 * - Entry/exit actions for states
 * - Transition actions
 * - History tracking
 * - Event emission
 */
export class StateMachine<TState extends string, TContext = unknown>
  implements IStateMachine<TState, TContext>
{
  readonly id: string;
  private _currentState: TState;
  private _context: TContext;
  private _history: TransitionHistoryEntry[] = [];

  private readonly states: Map<string, StateDefinition<TContext>>;
  private readonly transitions: Map<string, Set<string>>;
  private readonly transitionDefinitions: Map<string, TransitionDefinition<TContext>>;
  private readonly eventEmitter: EventEmitter;
  private readonly enableHistory: boolean;
  private readonly maxHistorySize: number;

  constructor(config: StateMachineConfig<TState, TContext>) {
    this.id = config.id;
    this._currentState = config.initialState;
    this._context = config.context ?? ({} as TContext);
    this.enableHistory = config.enableHistory ?? true;
    this.maxHistorySize = config.maxHistorySize ?? 1000;
    this.eventEmitter = new EventEmitter();

    // Initialize state map
    this.states = new Map();
    for (const state of config.states) {
      this.states.set(state.name, state);
    }

    // Validate initial state exists
    if (!this.states.has(config.initialState)) {
      throw new Error(`Initial state '${config.initialState}' not found in states`);
    }

    // Initialize transition maps
    this.transitions = new Map();
    this.transitionDefinitions = new Map();
    this.buildTransitionMaps(config.transitions);
  }

  /**
   * Get current state
   */
  get currentState(): TState {
    return this._currentState;
  }

  /**
   * Get context
   */
  get context(): TContext {
    return this._context;
  }

  /**
   * Get transition history
   */
  get history(): TransitionHistoryEntry[] {
    return [...this._history];
  }

  /**
   * Check if a transition to the target state is possible
   */
  canTransitionTo(state: TState): boolean {
    const availableTransitions = this.transitions.get(this._currentState);
    if (!availableTransitions) {
      return false;
    }

    if (!availableTransitions.has(state)) {
      return false;
    }

    // Check guard condition
    const transitionKey = this.getTransitionKey(this._currentState, state);
    const definition = this.transitionDefinitions.get(transitionKey);
    if (definition?.guard) {
      return definition.guard(this._context, this._currentState, state);
    }

    return true;
  }

  /**
   * Get all available transitions from current state
   */
  getAvailableTransitions(): TState[] {
    const available = this.transitions.get(this._currentState);
    if (!available) {
      return [];
    }

    // Filter by guard conditions
    return Array.from(available).filter((targetState) => {
      const transitionKey = this.getTransitionKey(this._currentState, targetState);
      const definition = this.transitionDefinitions.get(transitionKey);
      if (definition?.guard) {
        return definition.guard(this._context, this._currentState, targetState);
      }
      return true;
    }) as TState[];
  }

  /**
   * Perform a state transition
   */
  async transition(to: TState, trigger?: string): Promise<boolean> {
    const from = this._currentState;

    // Check if transition is valid
    if (!this.canTransitionTo(to)) {
      this.emitEvent(StateMachineEvents.TRANSITION_DENIED, {
        currentState: from,
        targetState: to,
        trigger,
      });
      return false;
    }

    const transitionKey = this.getTransitionKey(from, to);
    const transitionDef = this.transitionDefinitions.get(transitionKey);
    const fromStateDef = this.states.get(from);
    const toStateDef = this.states.get(to);

    try {
      // Emit transition started
      this.emitEvent(StateMachineEvents.TRANSITION_STARTED, {
        currentState: from,
        targetState: to,
        trigger,
      });

      // Execute exit action
      if (fromStateDef?.onExit) {
        await fromStateDef.onExit(this._context, from);
      }

      // Emit state exited
      this.emitEvent(StateMachineEvents.STATE_EXITED, {
        currentState: from,
        previousState: from,
        targetState: to,
        trigger,
      });

      // Execute transition action
      if (transitionDef?.action) {
        await transitionDef.action(this._context, from, to);
      }

      // Update state
      this._currentState = to;

      // Execute entry action
      if (toStateDef?.onEnter) {
        await toStateDef.onEnter(this._context, to);
      }

      // Emit state entered
      this.emitEvent(StateMachineEvents.STATE_ENTERED, {
        currentState: to,
        previousState: from,
        trigger,
      });

      // Record history
      this.recordHistory(from, to, trigger);

      // Emit transition completed
      this.emitEvent(StateMachineEvents.TRANSITION_COMPLETED, {
        currentState: to,
        previousState: from,
        trigger,
      });

      return true;
    } catch (error) {
      // Emit transition failed (state remains unchanged)
      this.emitEvent(StateMachineEvents.TRANSITION_FAILED, {
        currentState: from,
        targetState: to,
        trigger,
        error: error as Error,
      });
      throw error;
    }
  }

  /**
   * Reset state machine to initial state
   */
  reset(): void {
    const initialState = this.getInitialState();
    this._currentState = initialState;
    this._history = [];
  }

  /**
   * Update context
   */
  updateContext(updater: (context: TContext) => TContext): void {
    this._context = updater(this._context);
  }

  /**
   * Set context directly
   */
  setContext(context: TContext): void {
    this._context = context;
  }

  /**
   * Get state definition
   */
  getStateDefinition(state: TState): StateDefinition<TContext> | undefined {
    return this.states.get(state);
  }

  /**
   * Check if a state is final (no outgoing transitions)
   */
  isFinalState(state?: TState): boolean {
    const checkState = state ?? this._currentState;
    const available = this.transitions.get(checkState);
    return !available || available.size === 0;
  }

  /**
   * Create a snapshot of the current state
   */
  snapshot(): StateMachineSnapshot<TState, TContext> {
    return {
      id: this.id,
      currentState: this._currentState,
      context: structuredClone(this._context),
      history: [...this._history],
      createdAt: new Date(),
    };
  }

  /**
   * Restore from a snapshot
   */
  restore(snapshot: StateMachineSnapshot<TState, TContext>): void {
    if (snapshot.id !== this.id) {
      throw new Error(`Snapshot ID mismatch: expected '${this.id}', got '${snapshot.id}'`);
    }
    this._currentState = snapshot.currentState;
    this._context = structuredClone(snapshot.context);
    this._history = [...snapshot.history];
  }

  /**
   * Subscribe to events
   */
  on(
    event: StateMachineEventType,
    handler: (payload: StateMachineEventPayload<TState>) => void
  ): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  off(
    event: StateMachineEventType,
    handler: (payload: StateMachineEventPayload<TState>) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Build transition maps from definitions
   */
  private buildTransitionMaps(definitions: TransitionDefinition<TContext>[]): void {
    for (const def of definitions) {
      const fromStates = Array.isArray(def.from) ? def.from : [def.from];

      for (const from of fromStates) {
        // Validate states exist
        if (!this.states.has(from)) {
          throw new Error(`Transition 'from' state '${from}' not found in states`);
        }
        if (!this.states.has(def.to)) {
          throw new Error(`Transition 'to' state '${def.to}' not found in states`);
        }

        // Add to transitions map
        if (!this.transitions.has(from)) {
          this.transitions.set(from, new Set());
        }
        this.transitions.get(from)!.add(def.to);

        // Store definition for guard/action lookup
        const key = this.getTransitionKey(from, def.to);
        this.transitionDefinitions.set(key, def);
      }
    }
  }

  /**
   * Get transition key for lookup
   */
  private getTransitionKey(from: string, to: string): string {
    return `${from}->${to}`;
  }

  /**
   * Get initial state from states map
   */
  private getInitialState(): TState {
    // Find the first state in the map (which was the initial state)
    return this.states.keys().next().value as TState;
  }

  /**
   * Record transition in history
   */
  private recordHistory(from: string, to: string, trigger?: string): void {
    if (!this.enableHistory) {
      return;
    }

    const entry: TransitionHistoryEntry = {
      id: generateId(),
      from,
      to,
      timestamp: new Date(),
      trigger,
    };

    this._history.push(entry);

    // Trim history if needed
    if (this._history.length > this.maxHistorySize) {
      this._history = this._history.slice(-this.maxHistorySize);
    }
  }

  /**
   * Emit state machine event
   */
  private emitEvent(
    event: StateMachineEventType,
    data: Partial<StateMachineEventPayload<TState>>
  ): void {
    const payload: StateMachineEventPayload<TState> = {
      machineId: this.id,
      currentState: data.currentState ?? this._currentState,
      previousState: data.previousState,
      targetState: data.targetState,
      timestamp: new Date(),
      trigger: data.trigger,
      error: data.error,
      metadata: data.metadata,
    };
    this.eventEmitter.emit(event, payload);
  }
}

// ============================================================================
// Workflow State Machine
// ============================================================================

/**
 * Workflow state machine context
 */
export interface WorkflowStateMachineContext {
  instanceId: string;
  workflowId: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Create a workflow state machine with predefined transitions
 */
export function createWorkflowStateMachine(
  instanceId: string,
  workflowId: string,
  options?: {
    onStateChange?: (from: WorkflowStatus, to: WorkflowStatus) => void;
  }
): StateMachine<WorkflowStatus, WorkflowStateMachineContext> {
  const config: StateMachineConfig<WorkflowStatus, WorkflowStateMachineContext> = {
    id: `workflow-${instanceId}`,
    initialState: WorkflowStatus.PENDING,
    states: [
      {
        name: WorkflowStatus.PENDING,
        metadata: { description: 'Workflow is pending execution' },
      },
      {
        name: WorkflowStatus.RUNNING,
        onEnter: (ctx) => {
          ctx.startedAt = new Date();
        },
        metadata: { description: 'Workflow is currently running' },
      },
      {
        name: WorkflowStatus.PAUSED,
        metadata: { description: 'Workflow is paused' },
      },
      {
        name: WorkflowStatus.COMPLETED,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Workflow completed successfully', final: true },
      },
      {
        name: WorkflowStatus.FAILED,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Workflow failed with error', final: true },
      },
      {
        name: WorkflowStatus.CANCELLED,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Workflow was cancelled', final: true },
      },
      {
        name: WorkflowStatus.TIMEOUT,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Workflow timed out', final: true },
      },
    ],
    transitions: [
      // From PENDING
      { from: WorkflowStatus.PENDING, to: WorkflowStatus.RUNNING },
      { from: WorkflowStatus.PENDING, to: WorkflowStatus.CANCELLED },

      // From RUNNING
      { from: WorkflowStatus.RUNNING, to: WorkflowStatus.PAUSED },
      { from: WorkflowStatus.RUNNING, to: WorkflowStatus.COMPLETED },
      { from: WorkflowStatus.RUNNING, to: WorkflowStatus.FAILED },
      { from: WorkflowStatus.RUNNING, to: WorkflowStatus.CANCELLED },
      { from: WorkflowStatus.RUNNING, to: WorkflowStatus.TIMEOUT },

      // From PAUSED
      { from: WorkflowStatus.PAUSED, to: WorkflowStatus.RUNNING },
      { from: WorkflowStatus.PAUSED, to: WorkflowStatus.CANCELLED },
      { from: WorkflowStatus.PAUSED, to: WorkflowStatus.TIMEOUT },
    ],
    context: {
      instanceId,
      workflowId,
    },
    enableHistory: true,
  };

  const machine = new StateMachine(config);

  // Add state change callback if provided
  if (options?.onStateChange) {
    machine.on(StateMachineEvents.TRANSITION_COMPLETED, (payload) => {
      if (payload.previousState) {
        options.onStateChange!(
          payload.previousState as WorkflowStatus,
          payload.currentState
        );
      }
    });
  }

  return machine;
}

// ============================================================================
// Step State Machine
// ============================================================================

/**
 * Step state machine context
 */
export interface StepStateMachineContext {
  stepId: string;
  instanceId: string;
  retryCount: number;
  maxRetries: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Create a step state machine with predefined transitions
 */
export function createStepStateMachine(
  stepId: string,
  instanceId: string,
  options?: {
    maxRetries?: number;
    onStateChange?: (from: StepStatus, to: StepStatus) => void;
  }
): StateMachine<StepStatus, StepStateMachineContext> {
  const maxRetries = options?.maxRetries ?? 3;

  const config: StateMachineConfig<StepStatus, StepStateMachineContext> = {
    id: `step-${instanceId}-${stepId}`,
    initialState: StepStatus.PENDING,
    states: [
      {
        name: StepStatus.PENDING,
        metadata: { description: 'Step is pending execution' },
      },
      {
        name: StepStatus.WAITING,
        metadata: { description: 'Step is waiting for dependencies' },
      },
      {
        name: StepStatus.RUNNING,
        onEnter: (ctx) => {
          if (!ctx.startedAt) {
            ctx.startedAt = new Date();
          }
        },
        metadata: { description: 'Step is currently running' },
      },
      {
        name: StepStatus.COMPLETED,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Step completed successfully', final: true },
      },
      {
        name: StepStatus.FAILED,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Step failed with error', final: true },
      },
      {
        name: StepStatus.SKIPPED,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Step was skipped', final: true },
      },
      {
        name: StepStatus.CANCELLED,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Step was cancelled', final: true },
      },
      {
        name: StepStatus.TIMEOUT,
        onEnter: (ctx) => {
          ctx.completedAt = new Date();
        },
        metadata: { description: 'Step timed out', final: true },
      },
    ],
    transitions: [
      // From PENDING
      { from: StepStatus.PENDING, to: StepStatus.WAITING },
      { from: StepStatus.PENDING, to: StepStatus.RUNNING },
      { from: StepStatus.PENDING, to: StepStatus.SKIPPED },
      { from: StepStatus.PENDING, to: StepStatus.CANCELLED },

      // From WAITING
      { from: StepStatus.WAITING, to: StepStatus.RUNNING },
      { from: StepStatus.WAITING, to: StepStatus.SKIPPED },
      { from: StepStatus.WAITING, to: StepStatus.CANCELLED },
      { from: StepStatus.WAITING, to: StepStatus.TIMEOUT },

      // From RUNNING
      { from: StepStatus.RUNNING, to: StepStatus.COMPLETED },
      { from: StepStatus.RUNNING, to: StepStatus.FAILED },
      { from: StepStatus.RUNNING, to: StepStatus.CANCELLED },
      { from: StepStatus.RUNNING, to: StepStatus.TIMEOUT },
      // Retry: RUNNING -> RUNNING (with guard)
      {
        from: StepStatus.RUNNING,
        to: StepStatus.RUNNING,
        guard: (ctx) => ctx.retryCount < ctx.maxRetries,
        action: (ctx) => {
          ctx.retryCount++;
        },
      },
    ],
    context: {
      stepId,
      instanceId,
      retryCount: 0,
      maxRetries,
    },
    enableHistory: true,
  };

  const machine = new StateMachine(config);

  // Add state change callback if provided
  if (options?.onStateChange) {
    machine.on(StateMachineEvents.TRANSITION_COMPLETED, (payload) => {
      if (payload.previousState) {
        options.onStateChange!(
          payload.previousState as StepStatus,
          payload.currentState
        );
      }
    });
  }

  return machine;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a workflow status is terminal (final)
 */
export function isWorkflowStatusFinal(status: WorkflowStatus): boolean {
  return [
    WorkflowStatus.COMPLETED,
    WorkflowStatus.FAILED,
    WorkflowStatus.CANCELLED,
    WorkflowStatus.TIMEOUT,
  ].includes(status);
}

/**
 * Check if a step status is terminal (final)
 */
export function isStepStatusFinal(status: StepStatus): boolean {
  return [
    StepStatus.COMPLETED,
    StepStatus.FAILED,
    StepStatus.SKIPPED,
    StepStatus.CANCELLED,
    StepStatus.TIMEOUT,
  ].includes(status);
}

/**
 * Get valid workflow status transitions
 */
export function getValidWorkflowTransitions(
  from: WorkflowStatus
): WorkflowStatus[] {
  const transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
    [WorkflowStatus.PENDING]: [WorkflowStatus.RUNNING, WorkflowStatus.CANCELLED],
    [WorkflowStatus.RUNNING]: [
      WorkflowStatus.PAUSED,
      WorkflowStatus.COMPLETED,
      WorkflowStatus.FAILED,
      WorkflowStatus.CANCELLED,
      WorkflowStatus.TIMEOUT,
    ],
    [WorkflowStatus.PAUSED]: [
      WorkflowStatus.RUNNING,
      WorkflowStatus.CANCELLED,
      WorkflowStatus.TIMEOUT,
    ],
    [WorkflowStatus.COMPLETED]: [],
    [WorkflowStatus.FAILED]: [],
    [WorkflowStatus.CANCELLED]: [],
    [WorkflowStatus.TIMEOUT]: [],
  };
  return transitions[from] ?? [];
}

/**
 * Get valid step status transitions
 */
export function getValidStepTransitions(from: StepStatus): StepStatus[] {
  const transitions: Record<StepStatus, StepStatus[]> = {
    [StepStatus.PENDING]: [
      StepStatus.WAITING,
      StepStatus.RUNNING,
      StepStatus.SKIPPED,
      StepStatus.CANCELLED,
    ],
    [StepStatus.WAITING]: [
      StepStatus.RUNNING,
      StepStatus.SKIPPED,
      StepStatus.CANCELLED,
      StepStatus.TIMEOUT,
    ],
    [StepStatus.RUNNING]: [
      StepStatus.COMPLETED,
      StepStatus.FAILED,
      StepStatus.CANCELLED,
      StepStatus.TIMEOUT,
      StepStatus.RUNNING, // For retry
    ],
    [StepStatus.COMPLETED]: [],
    [StepStatus.FAILED]: [],
    [StepStatus.SKIPPED]: [],
    [StepStatus.CANCELLED]: [],
    [StepStatus.TIMEOUT]: [],
  };
  return transitions[from] ?? [];
}
