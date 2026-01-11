/**
 * Agent API Interfaces
 *
 * Feature: F4.1 - REST API Interface (Agents)
 *
 * @module api/interfaces/agent-api
 */

import type {
  AgentType,
  AgentStatus,
  AgentCapability,
  AgentMetrics,
  HealthStatus,
  TaskPriority,
  IAgentConfig,
} from '../../core/interfaces/agent.interface.js';
import type { ApiResponse, ListQueryParams, PaginationMeta } from './api.interface.js';

// ==================== Request DTOs ====================

/**
 * Create agent request body
 */
export interface CreateAgentRequest {
  type: AgentType;
  name: string;
  description?: string;
  llm: {
    provider: 'claude' | 'openai' | 'gemini';
    model: string;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  retryAttempts?: number;
  capabilities?: AgentCapability[];
  metadata?: Record<string, unknown>;
}

/**
 * Update agent request body
 */
export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  llm?: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  };
  maxConcurrentTasks?: number;
  taskTimeout?: number;
  retryAttempts?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Submit task request body
 */
export interface SubmitTaskRequest {
  type: string;
  payload: Record<string, unknown>;
  priority?: TaskPriority;
  timeout?: number;
  metadata?: {
    requestId?: string;
    parentTaskId?: string;
    tags?: string[];
  };
}

/**
 * Agent list query parameters
 */
export interface AgentListQuery extends ListQueryParams {
  type?: AgentType | AgentType[];
  status?: AgentStatus | AgentStatus[];
  name?: string;
}

// ==================== Response DTOs ====================

/**
 * Agent summary (for list responses)
 */
export interface AgentSummary {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  version: string;
  tasksProcessed: number;
  lastActiveAt: string | null;
  createdAt: string;
}

/**
 * Agent detail (for single agent responses)
 */
export interface AgentDetail extends AgentSummary {
  description?: string;
  config: Omit<IAgentConfig, 'id'>;
  capabilities: AgentCapability[];
  metrics: AgentMetrics;
  health: HealthStatus;
  currentTask?: {
    id: string;
    type: string;
    priority: TaskPriority;
    startedAt: string;
  } | null;
  queuedTasks: number;
}

/**
 * Agent task result
 */
export interface AgentTaskResponse {
  taskId: string;
  agentId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  position?: number;
  estimatedWaitTime?: number;
}

/**
 * Agent health response
 */
export interface AgentHealthResponse {
  agentId: string;
  health: HealthStatus;
  metrics: AgentMetrics;
  timestamp: string;
}

/**
 * Agent capabilities response
 */
export interface AgentCapabilitiesResponse {
  agentId: string;
  type: AgentType;
  capabilities: AgentCapability[];
}

// ==================== API Response Types ====================

/**
 * Create agent response
 */
export type CreateAgentResponse = ApiResponse<AgentDetail>;

/**
 * Get agent response
 */
export type GetAgentResponse = ApiResponse<AgentDetail>;

/**
 * List agents response
 */
export interface ListAgentsResponse extends ApiResponse<AgentSummary[]> {
  meta: {
    requestId: string;
    timestamp: string;
    pagination: PaginationMeta;
  };
}

/**
 * Update agent response
 */
export type UpdateAgentResponse = ApiResponse<AgentDetail>;

/**
 * Delete agent response
 */
export type DeleteAgentResponse = ApiResponse<{ deleted: boolean; agentId: string }>;

/**
 * Agent action response (start, stop, pause, resume)
 */
export type AgentActionResponse = ApiResponse<{
  agentId: string;
  action: 'start' | 'stop' | 'pause' | 'resume';
  previousStatus: AgentStatus;
  currentStatus: AgentStatus;
  timestamp: string;
}>;

/**
 * Submit task response
 */
export type SubmitTaskResponse = ApiResponse<AgentTaskResponse>;

/**
 * Get agent health response
 */
export type GetAgentHealthResponse = ApiResponse<AgentHealthResponse>;

/**
 * Get agent capabilities response
 */
export type GetAgentCapabilitiesResponse = ApiResponse<AgentCapabilitiesResponse>;

// ==================== Route Params ====================

/**
 * Agent ID parameter
 */
export interface AgentIdParam {
  agentId: string;
}

/**
 * Task ID parameter
 */
export interface TaskIdParam extends AgentIdParam {
  taskId: string;
}
