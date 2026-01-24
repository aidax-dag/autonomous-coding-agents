/**
 * WebSocket Event Types and Interfaces
 *
 * Feature: F4.2 - WebSocket API Events
 *
 * @module api/interfaces/ws-events
 */

/**
 * WebSocket event type enumeration
 */
export enum WsEventType {
  // ===== Connection Events =====
  CONNECTION_ESTABLISHED = 'connection:established',
  CONNECTION_CLOSED = 'connection:closed',
  PING = 'ping',
  PONG = 'pong',

  // ===== Agent Events =====
  AGENT_REGISTERED = 'agent:registered',
  AGENT_UNREGISTERED = 'agent:unregistered',
  AGENT_STARTED = 'agent:started',
  AGENT_STOPPED = 'agent:stopped',
  AGENT_STATUS_CHANGED = 'agent:status_changed',
  AGENT_TASK_ASSIGNED = 'agent:task_assigned',
  AGENT_TASK_PROGRESS = 'agent:task_progress',
  AGENT_TASK_COMPLETED = 'agent:task_completed',
  AGENT_TASK_FAILED = 'agent:task_failed',
  AGENT_ERROR = 'agent:error',

  // ===== Workflow Events =====
  WORKFLOW_CREATED = 'workflow:created',
  WORKFLOW_STARTED = 'workflow:started',
  WORKFLOW_PAUSED = 'workflow:paused',
  WORKFLOW_RESUMED = 'workflow:resumed',
  WORKFLOW_COMPLETED = 'workflow:completed',
  WORKFLOW_FAILED = 'workflow:failed',
  WORKFLOW_CANCELLED = 'workflow:cancelled',
  WORKFLOW_STEP_STARTED = 'workflow:step_started',
  WORKFLOW_STEP_COMPLETED = 'workflow:step_completed',
  WORKFLOW_STEP_FAILED = 'workflow:step_failed',

  // ===== System Events =====
  SYSTEM_HEALTH = 'system:health',
  SYSTEM_METRICS = 'system:metrics',
  SYSTEM_ALERT = 'system:alert',

  // ===== Project Events =====
  PROJECT_CREATED = 'project:created',
  PROJECT_UPDATED = 'project:updated',
  PROJECT_DELETED = 'project:deleted',
}

/**
 * Base WebSocket event structure
 */
export interface WsEventData<T = unknown> {
  type: WsEventType;
  timestamp: string;
  data: T;
  meta?: {
    correlationId?: string;
    source?: string;
  };
}

// ===== Agent Event Payloads =====

export interface AgentEventPayload {
  agentId: string;
  agentName: string;
  agentType: string;
}

export interface AgentStartedPayload extends AgentEventPayload {
  status: 'running';
}

export interface AgentStoppedPayload extends AgentEventPayload {
  status: 'stopped';
  reason?: string;
}

export interface AgentStatusChangedPayload extends AgentEventPayload {
  previousStatus: string;
  currentStatus: string;
}

export interface AgentTaskAssignedPayload extends AgentEventPayload {
  taskId: string;
  taskName: string;
  taskType: string;
}

export interface AgentTaskProgressPayload extends AgentEventPayload {
  taskId: string;
  taskName: string;
  progress: number; // 0-100
  message?: string;
}

export interface AgentTaskCompletedPayload extends AgentEventPayload {
  taskId: string;
  taskName: string;
  result?: unknown;
  duration: number; // milliseconds
}

export interface AgentTaskFailedPayload extends AgentEventPayload {
  taskId: string;
  taskName: string;
  error: string;
  stack?: string;
}

// ===== Workflow Event Payloads =====

export interface WorkflowEventPayload {
  workflowId: string;
  workflowName: string;
}

export interface WorkflowStartedPayload extends WorkflowEventPayload {
  status: 'running';
  totalSteps: number;
}

export interface WorkflowCompletedPayload extends WorkflowEventPayload {
  status: 'completed';
  duration: number;
  stepsCompleted: number;
}

export interface WorkflowFailedPayload extends WorkflowEventPayload {
  status: 'failed';
  error: string;
  failedStep?: string;
}

export interface WorkflowStepPayload extends WorkflowEventPayload {
  stepId: string;
  stepName: string;
  stepOrder: number;
  totalSteps: number;
}

export interface WorkflowStepCompletedPayload extends WorkflowStepPayload {
  duration: number;
  result?: unknown;
}

export interface WorkflowStepFailedPayload extends WorkflowStepPayload {
  error: string;
}

// ===== System Event Payloads =====

export interface SystemHealthPayload {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  activeConnections: number;
}

export interface SystemMetricsPayload {
  timestamp: string;
  agents: {
    total: number;
    active: number;
  };
  workflows: {
    running: number;
    queued: number;
  };
  requestsPerMinute: number;
}

export interface SystemAlertPayload {
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  details?: unknown;
}
