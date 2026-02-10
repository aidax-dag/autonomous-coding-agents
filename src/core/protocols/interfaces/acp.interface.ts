/**
 * Agent Communication Protocol (ACP) Interfaces
 *
 * Defines the standard protocol for agent-to-agent and
 * agent-to-frontend communication. Enables multi-frontend
 * support (CLI, Web, API) through a unified message format.
 *
 * @module core/protocols/interfaces
 */

/**
 * ACP message types
 */
export type ACPMessageType =
  | 'task:submit'
  | 'task:status'
  | 'task:result'
  | 'task:cancel'
  | 'agent:status'
  | 'agent:event'
  | 'system:health'
  | 'system:config';

/**
 * ACP message priority
 */
export type ACPPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Core ACP message — the fundamental unit of communication
 */
export interface ACPMessage<T = unknown> {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: ACPMessageType;
  /** Source identifier (agent/frontend/system) */
  source: string;
  /** Target identifier (agent/frontend/broadcast) */
  target: string;
  /** Message payload */
  payload: T;
  /** Priority level */
  priority: ACPPriority;
  /** ISO timestamp */
  timestamp: string;
  /** Correlation ID for request-response pairs */
  correlationId?: string;
  /** Message metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task submission payload
 */
export interface TaskSubmitPayload {
  /** Task description */
  description: string;
  /** Task type */
  type?: string;
  /** Target team/agent */
  targetTeam?: string;
  /** Project context */
  projectContext?: string;
  /** Configuration overrides */
  config?: Record<string, unknown>;
}

/**
 * Task status payload
 */
export interface TaskStatusPayload {
  /** Task ID */
  taskId: string;
  /** Current status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Status message */
  message?: string;
}

/**
 * Task result payload
 */
export interface TaskResultPayload {
  /** Task ID */
  taskId: string;
  /** Whether the task succeeded */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error if failed */
  error?: string;
  /** Duration in ms */
  duration: number;
}

/**
 * Agent status payload
 */
export interface AgentStatusPayload {
  /** Agent ID */
  agentId: string;
  /** Agent name */
  name: string;
  /** Current status */
  status: 'idle' | 'busy' | 'error' | 'stopped';
  /** Active task count */
  activeTasks: number;
  /** Uptime in ms */
  uptime: number;
}

/**
 * System health payload
 */
export interface SystemHealthPayload {
  /** Overall system status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Active agents */
  activeAgents: number;
  /** Pending tasks */
  pendingTasks: number;
  /** System uptime in ms */
  uptime: number;
  /** Component health */
  components: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}

// ── Handler Interfaces ─────────────────────────────────────

/**
 * Message handler function
 */
export type ACPHandler<T = unknown> = (
  message: ACPMessage<T>,
) => Promise<ACPMessage | void>;

/**
 * Message filter predicate
 */
export type ACPFilter = (message: ACPMessage) => boolean;

/**
 * Subscription handle
 */
export interface ACPSubscription {
  /** Unsubscribe from messages */
  unsubscribe(): void;
}

/**
 * ACP message bus — routes messages between agents and frontends
 */
export interface IACPMessageBus {
  /** Publish a message */
  publish(message: ACPMessage): Promise<void>;

  /** Subscribe to messages matching a filter */
  subscribe(
    filter: ACPFilter,
    handler: ACPHandler,
  ): ACPSubscription;

  /** Subscribe to messages of a specific type */
  on(type: ACPMessageType, handler: ACPHandler): ACPSubscription;

  /** Send a message and wait for a response */
  request<TReq, TRes>(
    message: ACPMessage<TReq>,
    timeout?: number,
  ): Promise<ACPMessage<TRes>>;

  /** Number of active subscriptions */
  subscriptionCount(): number;

  /** Clear all subscriptions */
  clear(): void;
}
