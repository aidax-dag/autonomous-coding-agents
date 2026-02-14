/**
 * A2A (Agent-to-Agent) Protocol Types
 *
 * Defines the standard types for inter-agent communication,
 * discovery, and task delegation over HTTP/JSON.
 *
 * @module core/protocols/a2a
 */

// ============================================================================
// Agent Card (Discovery)
// ============================================================================

/**
 * Agent status within the A2A network
 */
export type AgentStatus = 'available' | 'busy' | 'offline' | 'error';

/**
 * A capability that an agent can perform
 */
export interface AgentCapability {
  /** Capability name (unique per agent) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for expected input */
  inputSchema?: Record<string, unknown>;
  /** JSON Schema for expected output */
  outputSchema?: Record<string, unknown>;
}

/**
 * Agent Card — the discovery record for an A2A agent.
 * Published so that other agents can find and communicate
 * with this agent.
 */
export interface AgentCard {
  /** Unique agent identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** What this agent does */
  description: string;
  /** Agent version */
  version: string;
  /** What this agent can do */
  capabilities: AgentCapability[];
  /** Base URL for communication */
  endpoint: string;
  /** Protocol version */
  protocol: 'a2a-v1';
  /** Current agent status */
  status: AgentStatus;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// A2A Messages
// ============================================================================

/**
 * A2A message types covering discovery, task delegation, and health
 */
export type A2AMessageType =
  | 'discovery:request'   // Find available agents
  | 'discovery:response'  // Return agent cards
  | 'task:delegate'       // Delegate task to agent
  | 'task:accept'         // Agent accepts task
  | 'task:reject'         // Agent rejects task
  | 'task:progress'       // Task progress update
  | 'task:complete'       // Task completion
  | 'task:error'          // Task error
  | 'ping'                // Health check
  | 'pong';               // Health response

/**
 * Core A2A message — the fundamental unit of inter-agent communication
 */
export interface A2AMessage<T = unknown> {
  /** Unique message ID */
  id: string;
  /** Message type */
  type: A2AMessageType;
  /** Source agent ID */
  from: string;
  /** Target agent ID ('*' for broadcast) */
  to: string;
  /** Message payload */
  payload: T;
  /** ISO timestamp */
  timestamp: string;
  /** Correlation ID for request-response pairs */
  correlationId?: string;
  /** Time-to-live in ms */
  ttl?: number;
}

// ============================================================================
// Task Delegation
// ============================================================================

/**
 * Payload for delegating a task to a remote agent
 */
export interface TaskDelegation {
  /** Unique task identifier */
  taskId: string;
  /** Human-readable task description */
  description: string;
  /** Required capabilities for the task */
  requirements?: string[];
  /** Task priority */
  priority: 'low' | 'normal' | 'high' | 'critical';
  /** Timeout in ms */
  timeout?: number;
  /** Additional context for the task */
  context?: Record<string, unknown>;
}

/**
 * Payload when an agent accepts a delegated task
 */
export interface TaskAcceptance {
  /** Task being accepted */
  taskId: string;
  /** Estimated duration in ms */
  estimatedDuration?: number;
}

/**
 * Payload when an agent rejects a delegated task
 */
export interface TaskRejection {
  /** Task being rejected */
  taskId: string;
  /** Reason for rejection */
  reason: string;
}

/**
 * Payload for reporting progress on a delegated task
 */
export interface TaskProgress {
  /** Task being reported on */
  taskId: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Optional status message */
  message?: string;
  /** Intermediate artifacts */
  artifacts?: Array<{ name: string; type: string; content: string }>;
}

/**
 * Payload for reporting completion of a delegated task
 */
export interface TaskCompletion {
  /** Task that completed */
  taskId: string;
  /** Whether the task succeeded */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Duration in ms */
  duration: number;
  /** Error message if failed */
  error?: string;
}
