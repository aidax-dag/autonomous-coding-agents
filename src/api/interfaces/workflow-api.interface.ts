/**
 * Workflow API Interfaces
 *
 * Feature: F4.1 - REST API Interface (Workflows)
 *
 * @module api/interfaces/workflow-api
 */

import type { ApiResponse, ListQueryParams, PaginationMeta } from './api.interface.js';

// ==================== Enums ====================

/**
 * Workflow status
 */
export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

/**
 * Workflow instance status
 */
export enum WorkflowInstanceStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * Step status
 */
export enum StepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

// ==================== Request DTOs ====================

/**
 * Create workflow request
 */
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  steps: WorkflowStepDefinition[];
  triggers?: WorkflowTrigger[];
  variables?: Record<string, unknown>;
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Workflow step definition
 */
export interface WorkflowStepDefinition {
  id: string;
  name: string;
  type: 'agent' | 'tool' | 'condition' | 'parallel' | 'wait';
  config: StepConfig;
  dependsOn?: string[];
  onSuccess?: string;
  onFailure?: string;
  timeout?: number;
  retries?: number;
}

/**
 * Step configuration (varies by type)
 */
export interface StepConfig {
  // Agent step
  agentId?: string;
  agentType?: string;
  taskType?: string;
  taskPayload?: Record<string, unknown>;

  // Tool step
  toolName?: string;
  toolParams?: Record<string, unknown>;

  // Condition step
  condition?: string;
  trueStep?: string;
  falseStep?: string;

  // Parallel step
  steps?: string[];
  waitForAll?: boolean;

  // Wait step
  duration?: number;
  until?: string;
}

/**
 * Workflow trigger configuration
 */
export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event' | 'webhook';
  config: TriggerConfig;
  enabled: boolean;
}

/**
 * Trigger configuration
 */
export interface TriggerConfig {
  // Schedule trigger
  cron?: string;
  timezone?: string;

  // Event trigger
  eventType?: string;
  eventFilter?: Record<string, unknown>;

  // Webhook trigger
  path?: string;
  method?: 'GET' | 'POST';
  secret?: string;
}

/**
 * Update workflow request
 */
export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  steps?: WorkflowStepDefinition[];
  triggers?: WorkflowTrigger[];
  variables?: Record<string, unknown>;
  status?: WorkflowStatus;
  timeout?: number;
  maxRetries?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Execute workflow request
 */
export interface ExecuteWorkflowRequest {
  variables?: Record<string, unknown>;
  context?: Record<string, unknown>;
  async?: boolean;
  callbackUrl?: string;
}

/**
 * Workflow list query parameters
 */
export interface WorkflowListQuery extends ListQueryParams {
  status?: WorkflowStatus | WorkflowStatus[];
  name?: string;
  hasTrigger?: boolean;
}

/**
 * Workflow instance list query
 */
export interface WorkflowInstanceListQuery extends ListQueryParams {
  status?: WorkflowInstanceStatus | WorkflowInstanceStatus[];
  startedAfter?: string;
  startedBefore?: string;
  completedAfter?: string;
  completedBefore?: string;
}

// ==================== Response DTOs ====================

/**
 * Workflow summary
 */
export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  stepsCount: number;
  triggersCount: number;
  executionsCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Workflow detail
 */
export interface WorkflowDetail extends WorkflowSummary {
  steps: WorkflowStepDefinition[];
  triggers: WorkflowTrigger[];
  variables: Record<string, unknown>;
  timeout: number;
  maxRetries: number;
  metadata?: Record<string, unknown>;
  stats: WorkflowStats;
}

/**
 * Workflow statistics
 */
export interface WorkflowStats {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageDuration: number;
  lastDuration?: number;
  successRate: number;
}

/**
 * Workflow instance summary
 */
export interface WorkflowInstanceSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowInstanceStatus;
  currentStep?: string;
  progress: number;
  startedAt: string;
  completedAt?: string;
  duration?: number;
}

/**
 * Workflow instance detail
 */
export interface WorkflowInstanceDetail extends WorkflowInstanceSummary {
  variables: Record<string, unknown>;
  context: Record<string, unknown>;
  steps: StepExecution[];
  error?: {
    stepId: string;
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Step execution info
 */
export interface StepExecution {
  stepId: string;
  stepName: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
  retryCount: number;
}

// ==================== API Response Types ====================

/**
 * Create workflow response
 */
export type CreateWorkflowResponse = ApiResponse<WorkflowDetail>;

/**
 * Get workflow response
 */
export type GetWorkflowResponse = ApiResponse<WorkflowDetail>;

/**
 * List workflows response
 */
export interface ListWorkflowsResponse extends ApiResponse<WorkflowSummary[]> {
  meta: {
    requestId: string;
    timestamp: string;
    pagination: PaginationMeta;
  };
}

/**
 * Update workflow response
 */
export type UpdateWorkflowResponse = ApiResponse<WorkflowDetail>;

/**
 * Delete workflow response
 */
export type DeleteWorkflowResponse = ApiResponse<{ deleted: boolean; workflowId: string }>;

/**
 * Execute workflow response
 */
export type ExecuteWorkflowResponse = ApiResponse<{
  instanceId: string;
  workflowId: string;
  status: WorkflowInstanceStatus;
  async: boolean;
  result?: Record<string, unknown>;
}>;

/**
 * Get workflow instance response
 */
export type GetWorkflowInstanceResponse = ApiResponse<WorkflowInstanceDetail>;

/**
 * List workflow instances response
 */
export interface ListWorkflowInstancesResponse extends ApiResponse<WorkflowInstanceSummary[]> {
  meta: {
    requestId: string;
    timestamp: string;
    pagination: PaginationMeta;
  };
}

/**
 * Cancel workflow instance response
 */
export type CancelWorkflowInstanceResponse = ApiResponse<{
  instanceId: string;
  status: WorkflowInstanceStatus;
  cancelledAt: string;
}>;

// ==================== Route Params ====================

/**
 * Workflow ID parameter
 */
export interface WorkflowIdParam {
  workflowId: string;
}

/**
 * Workflow instance ID parameter
 */
export interface WorkflowInstanceIdParam {
  instanceId: string;
}

/**
 * Combined workflow and instance ID
 */
export interface WorkflowInstanceParam extends WorkflowIdParam {
  instanceId: string;
}
