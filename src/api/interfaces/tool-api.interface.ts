/**
 * Tool API Interfaces
 *
 * Feature: F4.1 - REST API Interface (Tools)
 *
 * @module api/interfaces/tool-api
 */

import type {
  ToolCategory,
  ToolParameter,
  ToolSchema,
  ToolExample,
} from '../../core/interfaces/tool.interface.js';
import type { ApiResponse, ListQueryParams, PaginationMeta } from './api.interface.js';

// ==================== Enums ====================

/**
 * Tool status
 */
export enum ToolStatus {
  AVAILABLE = 'available',
  DISABLED = 'disabled',
  DEPRECATED = 'deprecated',
  ERROR = 'error',
}

/**
 * Execution status
 */
export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

// ==================== Request DTOs ====================

/**
 * Register tool request
 */
export interface RegisterToolRequest {
  name: string;
  description: string;
  category: ToolCategory;
  version?: string;
  schema: ToolSchema;
  examples?: ToolExample[];
  timeout?: number;
  rateLimit?: {
    max: number;
    window: number;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Update tool request
 */
export interface UpdateToolRequest {
  description?: string;
  schema?: Partial<ToolSchema>;
  examples?: ToolExample[];
  timeout?: number;
  rateLimit?: {
    max: number;
    window: number;
  };
  status?: ToolStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Execute tool request
 */
export interface ExecuteToolRequest {
  parameters: Record<string, unknown>;
  context?: {
    agentId?: string;
    taskId?: string;
    requestId?: string;
  };
  timeout?: number;
  async?: boolean;
  callbackUrl?: string;
}

/**
 * Batch execute request
 */
export interface BatchExecuteRequest {
  executions: Array<{
    toolName: string;
    parameters: Record<string, unknown>;
    id?: string;
  }>;
  parallel?: boolean;
  stopOnError?: boolean;
  timeout?: number;
}

/**
 * Tool list query parameters
 */
export interface ToolListQuery extends ListQueryParams {
  category?: ToolCategory | ToolCategory[];
  status?: ToolStatus | ToolStatus[];
  name?: string;
}

/**
 * Execution history query
 */
export interface ExecutionHistoryQuery extends ListQueryParams {
  status?: ExecutionStatus | ExecutionStatus[];
  startedAfter?: string;
  startedBefore?: string;
  agentId?: string;
  taskId?: string;
}

// ==================== Response DTOs ====================

/**
 * Tool summary
 */
export interface ToolSummary {
  name: string;
  description: string;
  category: ToolCategory;
  version: string;
  status: ToolStatus;
  executionCount: number;
  lastUsedAt?: string;
  avgDuration?: number;
}

/**
 * Tool detail
 */
export interface ToolDetail extends ToolSummary {
  schema: ToolSchema;
  parameters: ToolParameter[];
  examples: ToolExample[];
  timeout: number;
  rateLimit?: {
    max: number;
    window: number;
    remaining: number;
    resetsAt: string;
  };
  stats: ToolStats;
  metadata?: Record<string, unknown>;
}

/**
 * Tool statistics
 */
export interface ToolStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  executionsLast24h: number;
  executionsLast7d: number;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  executionId: string;
  toolName: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  result?: {
    success: boolean;
    data?: unknown;
    error?: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  };
  context?: {
    agentId?: string;
    taskId?: string;
    requestId?: string;
  };
}

/**
 * Batch execution result
 */
export interface BatchExecutionResult {
  batchId: string;
  status: 'completed' | 'partial' | 'failed';
  totalCount: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    id?: string;
    toolName: string;
    status: ExecutionStatus;
    result?: unknown;
    error?: {
      code: string;
      message: string;
    };
    duration?: number;
  }>;
  totalDuration: number;
}

/**
 * Tool validation result
 */
export interface ToolValidationResult {
  valid: boolean;
  errors?: Array<{
    parameter: string;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    parameter: string;
    message: string;
  }>;
}

// ==================== API Response Types ====================

/**
 * Register tool response
 */
export type RegisterToolResponse = ApiResponse<ToolDetail>;

/**
 * Get tool response
 */
export type GetToolResponse = ApiResponse<ToolDetail>;

/**
 * List tools response
 */
export interface ListToolsResponse extends ApiResponse<ToolSummary[]> {
  meta: {
    requestId: string;
    timestamp: string;
    pagination: PaginationMeta;
  };
}

/**
 * Update tool response
 */
export type UpdateToolResponse = ApiResponse<ToolDetail>;

/**
 * Unregister tool response
 */
export type UnregisterToolResponse = ApiResponse<{ unregistered: boolean; toolName: string }>;

/**
 * Execute tool response
 */
export type ExecuteToolResponse = ApiResponse<ToolExecutionResult>;

/**
 * Batch execute response
 */
export type BatchExecuteResponse = ApiResponse<BatchExecutionResult>;

/**
 * Validate parameters response
 */
export type ValidateParametersResponse = ApiResponse<ToolValidationResult>;

/**
 * Get execution history response
 */
export interface GetExecutionHistoryResponse extends ApiResponse<ToolExecutionResult[]> {
  meta: {
    requestId: string;
    timestamp: string;
    pagination: PaginationMeta;
  };
}

/**
 * Get tool stats response
 */
export type GetToolStatsResponse = ApiResponse<ToolStats>;

// ==================== Route Params ====================

/**
 * Tool name parameter
 */
export interface ToolNameParam {
  toolName: string;
}

/**
 * Execution ID parameter
 */
export interface ExecutionIdParam {
  executionId: string;
}

/**
 * Tool execution param
 */
export interface ToolExecutionParam extends ToolNameParam {
  executionId: string;
}
