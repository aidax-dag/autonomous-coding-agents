/**
 * Hook API Interfaces
 *
 * Feature: F4.1 - REST API Interface (Hooks)
 *
 * @module api/interfaces/hook-api
 */

import type {
  HookEvent,
  HookAction,
  HookConfig,
  HookCondition,
} from '../../core/interfaces/hook.interface.js';
import type { ApiResponse, ListQueryParams, PaginationMeta } from './api.interface.js';

// ==================== Enums ====================

/**
 * Hook status
 */
export enum HookStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  ERROR = 'error',
}

/**
 * Hook execution result status
 */
export enum HookExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  TIMEOUT = 'timeout',
}

// ==================== Request DTOs ====================

/**
 * Register hook request
 */
export interface RegisterHookRequest {
  name: string;
  type?: string;
  description?: string;
  event: HookEvent;
  priority?: number;
  conditions?: HookCondition[];
  timeout?: number;
  retryOnError?: boolean;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Update hook request
 */
export interface UpdateHookRequest {
  name?: string;
  description?: string;
  priority?: number;
  conditions?: HookCondition[];
  timeout?: number;
  retryOnError?: boolean;
  maxRetries?: number;
  enabled?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Test hook request
 */
export interface TestHookRequest {
  context: {
    event: HookEvent;
    data: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  dryRun?: boolean;
}

/**
 * Hook list query parameters
 */
export interface HookListQuery extends ListQueryParams {
  event?: HookEvent | HookEvent[];
  status?: HookStatus | HookStatus[];
  name?: string;
  priority?: number;
}

/**
 * Hook execution history query
 */
export interface HookExecutionHistoryQuery extends ListQueryParams {
  status?: HookExecutionStatus | HookExecutionStatus[];
  event?: HookEvent;
  startedAfter?: string;
  startedBefore?: string;
}

// ==================== Response DTOs ====================

/**
 * Hook summary
 */
export interface HookSummary {
  id: string;
  name: string;
  type: string;
  description?: string;
  event: HookEvent;
  priority: number;
  status: HookStatus;
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
}

/**
 * Hook detail
 */
export interface HookDetail extends HookSummary {
  conditions: HookCondition[];
  config: HookConfig;
  timeout: number;
  retryOnError: boolean;
  maxRetries: number;
  stats: HookStats;
  metadata?: Record<string, unknown>;
}

/**
 * Hook statistics
 */
export interface HookStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  skippedExecutions: number;
  averageDuration: number;
  successRate: number;
  lastExecutionDuration?: number;
  executionsLast24h: number;
  errorRate: number;
}

/**
 * Hook execution record
 */
export interface HookExecutionRecord {
  id: string;
  hookId: string;
  hookName: string;
  event: HookEvent;
  status: HookExecutionStatus;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  input?: {
    context: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  };
  output?: {
    action: HookAction;
    data?: Record<string, unknown>;
  };
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  retryCount: number;
}

/**
 * Hook test result
 */
export interface HookTestResult {
  hookId: string;
  hookName: string;
  wouldExecute: boolean;
  conditionsMatched: boolean;
  conditionResults: Array<{
    condition: HookCondition;
    matched: boolean;
    reason?: string;
  }>;
  dryRun: boolean;
  result?: {
    action: HookAction;
    data?: Record<string, unknown>;
    duration: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Available events response
 */
export interface AvailableEventsResponse {
  events: Array<{
    event: HookEvent;
    description: string;
    dataSchema: Record<string, unknown>;
    registeredHooks: number;
  }>;
}

// ==================== API Response Types ====================

/**
 * Register hook response
 */
export type RegisterHookResponse = ApiResponse<HookDetail>;

/**
 * Get hook response
 */
export type GetHookResponse = ApiResponse<HookDetail>;

/**
 * List hooks response
 */
export interface ListHooksResponse extends ApiResponse<HookSummary[]> {
  meta: {
    requestId: string;
    timestamp: string;
    pagination: PaginationMeta;
  };
}

/**
 * Update hook response
 */
export type UpdateHookResponse = ApiResponse<HookDetail>;

/**
 * Unregister hook response
 */
export type UnregisterHookResponse = ApiResponse<{ unregistered: boolean; hookId: string }>;

/**
 * Enable hook response
 */
export type EnableHookResponse = ApiResponse<{
  hookId: string;
  enabled: boolean;
  previousStatus: HookStatus;
  currentStatus: HookStatus;
}>;

/**
 * Disable hook response
 */
export type DisableHookResponse = ApiResponse<{
  hookId: string;
  disabled: boolean;
  previousStatus: HookStatus;
  currentStatus: HookStatus;
}>;

/**
 * Test hook response
 */
export type TestHookResponse = ApiResponse<HookTestResult>;

/**
 * Get hook execution history response
 */
export interface GetHookExecutionHistoryResponse extends ApiResponse<HookExecutionRecord[]> {
  meta: {
    requestId: string;
    timestamp: string;
    pagination: PaginationMeta;
  };
}

/**
 * Get hook stats response
 */
export type GetHookStatsResponse = ApiResponse<HookStats>;

/**
 * Get available events response
 */
export type GetAvailableEventsResponse = ApiResponse<AvailableEventsResponse>;

// ==================== Route Params ====================

/**
 * Hook ID parameter
 */
export interface HookIdParam {
  hookId: string;
}

/**
 * Hook execution ID parameter
 */
export interface HookExecutionIdParam extends HookIdParam {
  executionId: string;
}
