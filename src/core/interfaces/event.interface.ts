/**
 * Event System Interfaces
 *
 * SOLID Principles:
 * - S: IEventBus focuses only on pub/sub contract
 * - O: New event types extend without modifying base
 * - I: Publisher and Subscriber interfaces are segregated
 * - D: Consumers depend on abstractions
 *
 * @module core/interfaces/event
 */

/**
 * Base event interface
 */
export interface IEvent<T = unknown> {
  readonly type: string;
  readonly payload: T;
  readonly timestamp: Date;
  readonly source: string;
  readonly id: string;
  readonly metadata?: EventMetadata;
}

/**
 * Event metadata
 */
export interface EventMetadata {
  correlationId?: string;
  causationId?: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  tags?: string[];
  [key: string]: unknown;
}

/**
 * Event type constructor
 */
export type EventType<T extends IEvent = IEvent> = string | (new (...args: unknown[]) => T);

/**
 * Event handler function type
 */
export type EventHandler<T extends IEvent = IEvent> = (event: T) => void | Promise<void>;

/**
 * Subscription interface for unsubscribing
 */
export interface Subscription {
  readonly id: string;
  readonly eventType: string;
  unsubscribe(): void;
  readonly isActive: boolean;
}

/**
 * Event filter for selective subscription
 */
export interface EventFilter<T extends IEvent = IEvent> {
  (event: T): boolean;
}

/**
 * Event subscription options
 */
export interface SubscriptionOptions<T extends IEvent = IEvent> {
  filter?: EventFilter<T>;
  priority?: number;
  once?: boolean;
  timeout?: number;
}

/**
 * Event Publisher Interface (ISP)
 *
 * Interface for components that only publish events
 */
export interface IEventPublisher {
  /**
   * Emit an event synchronously (fire-and-forget)
   */
  emit<T extends IEvent>(event: T): void;

  /**
   * Emit an event asynchronously (wait for all handlers)
   */
  emitAsync<T extends IEvent>(event: T): Promise<void>;

  /**
   * Emit multiple events
   */
  emitBatch<T extends IEvent>(events: T[]): void;
}

/**
 * Event Subscriber Interface (ISP)
 *
 * Interface for components that only subscribe to events
 */
export interface IEventSubscriber {
  /**
   * Subscribe to an event type
   */
  on<T extends IEvent>(
    eventType: EventType<T>,
    handler: EventHandler<T>,
    options?: SubscriptionOptions<T>
  ): Subscription;

  /**
   * Subscribe to an event type once
   */
  once<T extends IEvent>(
    eventType: EventType<T>,
    handler: EventHandler<T>,
    options?: SubscriptionOptions<T>
  ): Subscription;

  /**
   * Unsubscribe from an event
   */
  off(subscription: Subscription): void;

  /**
   * Wait for a specific event
   */
  waitFor<T extends IEvent>(
    eventType: EventType<T>,
    timeout?: number,
    filter?: EventFilter<T>
  ): Promise<T>;
}

/**
 * Event Bus Interface
 *
 * Full event bus combining publisher and subscriber capabilities
 */
export interface IEventBus extends IEventPublisher, IEventSubscriber {
  /**
   * Remove all listeners for an event type
   */
  removeAllListeners(eventType?: EventType): void;

  /**
   * Get listener count for an event type
   */
  listenerCount(eventType: EventType): number;

  /**
   * Get all registered event types
   */
  eventTypes(): string[];

  /**
   * Check if event type has listeners
   */
  hasListeners(eventType: EventType): boolean;

  /**
   * Pause event emission
   */
  pause(): void;

  /**
   * Resume event emission
   */
  resume(): void;

  /**
   * Check if event bus is paused
   */
  isPaused(): boolean;

  /**
   * Dispose of all resources
   */
  dispose(): void;
}

/**
 * Async Event Bus Interface
 *
 * Event bus with async-first design
 */
export interface IAsyncEventBus extends IEventBus {
  /**
   * Subscribe with async handler
   */
  onAsync<T extends IEvent>(
    eventType: EventType<T>,
    handler: EventHandler<T>,
    options?: SubscriptionOptions<T>
  ): Subscription;

  /**
   * Get pending async handlers count
   */
  pendingCount(): number;

  /**
   * Wait for all pending handlers to complete
   */
  flush(): Promise<void>;
}

/**
 * System event types
 */
export const SystemEvents = {
  // === Agent Events ===
  AgentInitializing: 'system.agent.initializing',
  AgentInitialized: 'system.agent.initialized',
  AgentStarted: 'system.agent.started',
  AgentStopped: 'system.agent.stopped',
  AgentError: 'system.agent.error',
  AgentPaused: 'system.agent.paused',
  AgentResumed: 'system.agent.resumed',

  // === Task Events ===
  TaskQueued: 'system.task.queued',
  TaskStarted: 'system.task.started',
  TaskCompleted: 'system.task.completed',
  TaskFailed: 'system.task.failed',
  TaskCancelled: 'system.task.cancelled',
  TaskTimeout: 'system.task.timeout',
  TaskRetry: 'system.task.retry',

  // === Workflow Events ===
  WorkflowStarted: 'system.workflow.started',
  WorkflowStepStarted: 'system.workflow.step.started',
  WorkflowStepCompleted: 'system.workflow.step.completed',
  WorkflowStepFailed: 'system.workflow.step.failed',
  WorkflowCompleted: 'system.workflow.completed',
  WorkflowFailed: 'system.workflow.failed',
  WorkflowCancelled: 'system.workflow.cancelled',

  // === Tool Events ===
  ToolExecuted: 'system.tool.executed',
  ToolFailed: 'system.tool.failed',

  // === Hook Events ===
  HookExecuted: 'system.hook.executed',
  HookFailed: 'system.hook.failed',

  // === LLM Events ===
  LLMRequestStarted: 'system.llm.request.started',
  LLMRequestCompleted: 'system.llm.request.completed',
  LLMRequestFailed: 'system.llm.request.failed',
  LLMStreamStarted: 'system.llm.stream.started',
  LLMStreamChunk: 'system.llm.stream.chunk',
  LLMStreamEnded: 'system.llm.stream.ended',

  // === Context Events ===
  ContextThreshold: 'system.context.threshold',
  ContextCompacted: 'system.context.compacted',
  ContextOverflow: 'system.context.overflow',

  // === Session Events ===
  SessionStarted: 'system.session.started',
  SessionEnded: 'system.session.ended',
  SessionCheckpoint: 'system.session.checkpoint',
  SessionRestored: 'system.session.restored',

  // === System Events ===
  SystemHealthCheck: 'system.health.check',
  SystemMetrics: 'system.metrics',
  SystemError: 'system.error',
  SystemShutdown: 'system.shutdown',
} as const;

/**
 * Type helper for system events
 */
export type SystemEventType = typeof SystemEvents[keyof typeof SystemEvents];

/**
 * Agent started event
 */
export interface AgentStartedEvent extends IEvent<{
  agentId: string;
  agentType: string;
  name: string;
}> {
  type: typeof SystemEvents.AgentStarted;
}

/**
 * Agent stopped event
 */
export interface AgentStoppedEvent extends IEvent<{
  agentId: string;
  agentType: string;
  reason?: string;
}> {
  type: typeof SystemEvents.AgentStopped;
}

/**
 * Task completed event
 */
export interface TaskCompletedEvent extends IEvent<{
  taskId: string;
  agentId: string;
  duration: number;
  success: boolean;
}> {
  type: typeof SystemEvents.TaskCompleted;
}

/**
 * Task failed event
 */
export interface TaskFailedEvent extends IEvent<{
  taskId: string;
  agentId: string;
  error: string;
  recoverable: boolean;
}> {
  type: typeof SystemEvents.TaskFailed;
}

/**
 * Context threshold event
 */
export interface ContextThresholdEvent extends IEvent<{
  usage: number;
  threshold: number;
  agentId?: string;
}> {
  type: typeof SystemEvents.ContextThreshold;
}

/**
 * Event factory interface for creating events
 */
export interface IEventFactory {
  /**
   * Create a new event
   */
  create<T>(type: string, payload: T, metadata?: EventMetadata): IEvent<T>;

  /**
   * Create a system event
   */
  createSystemEvent<T>(
    type: SystemEventType,
    payload: T,
    metadata?: EventMetadata
  ): IEvent<T>;
}
