/**
 * JetBrains Plugin Types
 *
 * Type definitions for the ACA JetBrains IDE integration client,
 * covering configuration, task management, and agent monitoring.
 *
 * @module platform/jetbrains
 */

export interface JetBrainsClientConfig {
  serverUrl: string;
  rpcPort?: number;
  authToken?: string;
  connectTimeout?: number;
  requestTimeout?: number;
}

export interface TaskSubmission {
  goal: string;
  context?: string;
  workingDirectory?: string;
  priority?: 'low' | 'normal' | 'high';
}

export interface TaskStatus {
  id: string;
  goal: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'busy' | 'error';
  currentTask?: string;
}

export interface TaskUpdateEvent {
  taskId: string;
  status: TaskStatus['status'];
  progress?: number;
  message?: string;
}

export interface AgentEvent {
  agentId: string;
  type: 'started' | 'completed' | 'error' | 'progress';
  data?: Record<string, unknown>;
}

export const DEFAULT_RPC_PORT = 6789;
export const DEFAULT_CONNECT_TIMEOUT = 10000;
export const DEFAULT_REQUEST_TIMEOUT = 30000;
