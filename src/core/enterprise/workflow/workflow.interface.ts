/**
 * Custom Workflows Interfaces
 *
 * Feature: F5.14 - Custom Workflows
 * Provides workflow builder, execution engine, and workflow templates
 *
 * @module core/enterprise/workflow
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';

/**
 * Workflow status
 */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

/**
 * Workflow execution status
 */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';

/**
 * Step type
 */
export type StepType =
  | 'action'
  | 'condition'
  | 'loop'
  | 'parallel'
  | 'wait'
  | 'webhook'
  | 'transform'
  | 'subworkflow';

/**
 * Trigger type
 */
export type TriggerType =
  | 'manual'
  | 'schedule'
  | 'webhook'
  | 'event'
  | 'file_change'
  | 'api_call';

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  /** Workflow unique identifier */
  id: string;
  /** Workflow name */
  name: string;
  /** Workflow description */
  description?: string;
  /** Team ID */
  teamId: string;
  /** Workflow status */
  status: WorkflowStatus;
  /** Workflow version */
  version: number;
  /** Triggers */
  triggers: WorkflowTrigger[];
  /** Steps */
  steps: WorkflowStep[];
  /** Input schema */
  inputSchema?: JsonSchema;
  /** Output schema */
  outputSchema?: JsonSchema;
  /** Variables */
  variables?: Record<string, unknown>;
  /** Tags */
  tags?: string[];
  /** Created by */
  createdBy: string;
  /** Created at */
  createdAt: Date;
  /** Updated at */
  updatedAt: Date;
}

/**
 * JSON Schema (simplified)
 */
export interface JsonSchema {
  /** Schema type */
  type: string;
  /** Properties */
  properties?: Record<string, JsonSchema>;
  /** Required fields */
  required?: string[];
  /** Items (for arrays) */
  items?: JsonSchema;
  /** Description */
  description?: string;
}

/**
 * Workflow trigger
 */
export interface WorkflowTrigger {
  /** Trigger unique identifier */
  id: string;
  /** Trigger type */
  type: TriggerType;
  /** Trigger configuration */
  config: TriggerConfig;
  /** Whether trigger is enabled */
  enabled: boolean;
}

/**
 * Trigger configuration
 */
export type TriggerConfig =
  | ManualTriggerConfig
  | ScheduleTriggerConfig
  | WebhookTriggerConfig
  | EventTriggerConfig
  | FileChangeTriggerConfig
  | ApiCallTriggerConfig;

/**
 * Manual trigger configuration
 */
export interface ManualTriggerConfig {
  type: 'manual';
  /** Allowed users (empty = all) */
  allowedUsers?: string[];
  /** Require confirmation */
  requireConfirmation?: boolean;
}

/**
 * Schedule trigger configuration
 */
export interface ScheduleTriggerConfig {
  type: 'schedule';
  /** Cron expression */
  cron: string;
  /** Timezone */
  timezone?: string;
}

/**
 * Webhook trigger configuration
 */
export interface WebhookTriggerConfig {
  type: 'webhook';
  /** Webhook path */
  path: string;
  /** HTTP methods */
  methods: ('GET' | 'POST' | 'PUT' | 'DELETE')[];
  /** Secret for validation */
  secret?: string;
}

/**
 * Event trigger configuration
 */
export interface EventTriggerConfig {
  type: 'event';
  /** Event types to listen for */
  eventTypes: string[];
  /** Event source */
  source?: string;
  /** Filter expression */
  filter?: string;
}

/**
 * File change trigger configuration
 */
export interface FileChangeTriggerConfig {
  type: 'file_change';
  /** Paths to watch */
  paths: string[];
  /** Change types */
  changeTypes: ('created' | 'modified' | 'deleted')[];
  /** Debounce delay in ms */
  debounceMs?: number;
}

/**
 * API call trigger configuration
 */
export interface ApiCallTriggerConfig {
  type: 'api_call';
  /** Endpoint pattern */
  endpointPattern: string;
  /** HTTP methods */
  methods: string[];
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  /** Step unique identifier */
  id: string;
  /** Step name */
  name: string;
  /** Step type */
  type: StepType;
  /** Step configuration */
  config: StepConfig;
  /** Input mapping */
  inputMapping?: Record<string, string>;
  /** Output mapping */
  outputMapping?: Record<string, string>;
  /** Error handling */
  errorHandling?: ErrorHandling;
  /** Retry configuration */
  retryConfig?: RetryConfig;
  /** Timeout in ms */
  timeoutMs?: number;
  /** Condition for execution */
  condition?: string;
  /** Next step ID (for sequential flow) */
  nextStepId?: string;
  /** On success step ID */
  onSuccessStepId?: string;
  /** On failure step ID */
  onFailureStepId?: string;
}

/**
 * Step configuration
 */
export type StepConfig =
  | ActionStepConfig
  | ConditionStepConfig
  | LoopStepConfig
  | ParallelStepConfig
  | WaitStepConfig
  | WebhookStepConfig
  | TransformStepConfig
  | SubworkflowStepConfig;

/**
 * Action step configuration
 */
export interface ActionStepConfig {
  type: 'action';
  /** Action type */
  actionType: string;
  /** Action parameters */
  parameters: Record<string, unknown>;
}

/**
 * Condition step configuration
 */
export interface ConditionStepConfig {
  type: 'condition';
  /** Condition expression */
  expression: string;
  /** True branch step ID */
  trueBranchStepId: string;
  /** False branch step ID */
  falseBranchStepId?: string;
}

/**
 * Loop step configuration
 */
export interface LoopStepConfig {
  type: 'loop';
  /** Loop type */
  loopType: 'foreach' | 'while' | 'count';
  /** Collection expression (for foreach) */
  collection?: string;
  /** Condition expression (for while) */
  condition?: string;
  /** Count (for count) */
  count?: number;
  /** Body step IDs */
  bodyStepIds: string[];
  /** Max iterations */
  maxIterations?: number;
}

/**
 * Parallel step configuration
 */
export interface ParallelStepConfig {
  type: 'parallel';
  /** Parallel branch step IDs */
  branchStepIds: string[];
  /** Wait for all */
  waitForAll: boolean;
  /** Max concurrency */
  maxConcurrency?: number;
}

/**
 * Wait step configuration
 */
export interface WaitStepConfig {
  type: 'wait';
  /** Wait type */
  waitType: 'duration' | 'until' | 'event';
  /** Duration in ms (for duration) */
  durationMs?: number;
  /** Until timestamp expression (for until) */
  untilExpression?: string;
  /** Event type to wait for (for event) */
  eventType?: string;
  /** Timeout in ms */
  timeoutMs?: number;
}

/**
 * Webhook step configuration
 */
export interface WebhookStepConfig {
  type: 'webhook';
  /** URL */
  url: string;
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** Headers */
  headers?: Record<string, string>;
  /** Body template */
  bodyTemplate?: string;
  /** Response mapping */
  responseMapping?: Record<string, string>;
}

/**
 * Transform step configuration
 */
export interface TransformStepConfig {
  type: 'transform';
  /** Transform expression */
  expression: string;
  /** Transform type */
  transformType: 'jq' | 'jsonpath' | 'javascript';
}

/**
 * Subworkflow step configuration
 */
export interface SubworkflowStepConfig {
  type: 'subworkflow';
  /** Subworkflow ID */
  workflowId: string;
  /** Input mapping */
  inputMapping: Record<string, string>;
  /** Wait for completion */
  waitForCompletion: boolean;
}

/**
 * Error handling configuration
 */
export interface ErrorHandling {
  /** Error handling strategy */
  strategy: 'fail' | 'ignore' | 'retry' | 'fallback';
  /** Fallback step ID */
  fallbackStepId?: string;
  /** Error message mapping */
  errorMapping?: Record<string, string>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Max attempts */
  maxAttempts: number;
  /** Initial delay in ms */
  initialDelayMs: number;
  /** Max delay in ms */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Retryable errors */
  retryableErrors?: string[];
}

/**
 * Workflow execution
 */
export interface WorkflowExecution {
  /** Execution unique identifier */
  id: string;
  /** Workflow ID */
  workflowId: string;
  /** Workflow version at execution */
  workflowVersion: number;
  /** Team ID */
  teamId: string;
  /** Execution status */
  status: ExecutionStatus;
  /** Trigger info */
  trigger: ExecutionTrigger;
  /** Input data */
  input: Record<string, unknown>;
  /** Output data */
  output?: Record<string, unknown>;
  /** Step executions */
  stepExecutions: StepExecution[];
  /** Error */
  error?: ExecutionError;
  /** Started at */
  startedAt: Date;
  /** Completed at */
  completedAt?: Date;
  /** Duration in ms */
  durationMs?: number;
  /** Context */
  context: ExecutionContext;
}

/**
 * Execution trigger info
 */
export interface ExecutionTrigger {
  /** Trigger ID */
  triggerId: string;
  /** Trigger type */
  type: TriggerType;
  /** Triggered by */
  triggeredBy?: string;
  /** Trigger data */
  data?: Record<string, unknown>;
}

/**
 * Step execution
 */
export interface StepExecution {
  /** Step execution ID */
  id: string;
  /** Step ID */
  stepId: string;
  /** Step name */
  stepName: string;
  /** Status */
  status: ExecutionStatus;
  /** Input */
  input?: Record<string, unknown>;
  /** Output */
  output?: Record<string, unknown>;
  /** Error */
  error?: ExecutionError;
  /** Attempt number */
  attempt: number;
  /** Started at */
  startedAt: Date;
  /** Completed at */
  completedAt?: Date;
  /** Duration in ms */
  durationMs?: number;
}

/**
 * Execution error
 */
export interface ExecutionError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error details */
  details?: Record<string, unknown>;
  /** Stack trace */
  stackTrace?: string;
}

/**
 * Execution context
 */
export interface ExecutionContext {
  /** Variables */
  variables: Record<string, unknown>;
  /** Secrets (masked) */
  secrets: Record<string, string>;
  /** Environment */
  environment: Record<string, string>;
}

/**
 * Workflow template
 */
export interface WorkflowTemplate {
  /** Template unique identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Category */
  category: string;
  /** Tags */
  tags: string[];
  /** Template definition */
  definition: Omit<WorkflowDefinition, 'id' | 'teamId' | 'createdBy' | 'createdAt' | 'updatedAt'>;
  /** Variables to fill */
  requiredVariables: TemplateVariable[];
  /** Author */
  author?: string;
  /** Is built-in */
  isBuiltIn: boolean;
  /** Created at */
  createdAt: Date;
}

/**
 * Template variable
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Display name */
  displayName: string;
  /** Description */
  description?: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  /** Default value */
  defaultValue?: unknown;
  /** Is required */
  required: boolean;
  /** Validation pattern */
  validationPattern?: string;
}

/**
 * Workflow event
 */
export interface WorkflowEvent {
  /** Event type */
  type: WorkflowEventType;
  /** Workflow ID */
  workflowId: string;
  /** Execution ID */
  executionId?: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | 'workflow.created'
  | 'workflow.updated'
  | 'workflow.deleted'
  | 'workflow.activated'
  | 'workflow.paused'
  | 'execution.started'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.cancelled'
  | 'step.started'
  | 'step.completed'
  | 'step.failed';

/**
 * Create workflow request
 */
export interface CreateWorkflowRequest {
  /** Workflow name */
  name: string;
  /** Description */
  description?: string;
  /** Team ID */
  teamId: string;
  /** Created by */
  createdBy: string;
  /** Triggers */
  triggers?: WorkflowTrigger[];
  /** Steps */
  steps?: WorkflowStep[];
  /** Input schema */
  inputSchema?: JsonSchema;
  /** Output schema */
  outputSchema?: JsonSchema;
  /** Variables */
  variables?: Record<string, unknown>;
  /** Tags */
  tags?: string[];
}

/**
 * Execute workflow request
 */
export interface ExecuteWorkflowRequest {
  /** Workflow ID */
  workflowId: string;
  /** Input data */
  input?: Record<string, unknown>;
  /** Triggered by */
  triggeredBy?: string;
  /** Trigger type */
  triggerType?: TriggerType;
  /** Trigger data */
  triggerData?: Record<string, unknown>;
  /** Context overrides */
  contextOverrides?: Partial<ExecutionContext>;
}

/**
 * Create from template request
 */
export interface CreateFromTemplateRequest {
  /** Template ID */
  templateId: string;
  /** Workflow name */
  name: string;
  /** Team ID */
  teamId: string;
  /** Created by */
  createdBy: string;
  /** Variable values */
  variables: Record<string, unknown>;
}

/**
 * Custom Workflows Manager interface
 */
export interface ICustomWorkflowsManager extends IDisposable {
  // ==================== Workflow CRUD ====================

  /**
   * Create a new workflow
   * @param request Create request
   */
  createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowDefinition>;

  /**
   * Get a workflow by ID
   * @param workflowId Workflow identifier
   */
  getWorkflow(workflowId: string): Promise<WorkflowDefinition | undefined>;

  /**
   * Update a workflow
   * @param workflowId Workflow identifier
   * @param updates Partial workflow updates
   */
  updateWorkflow(
    workflowId: string,
    updates: Partial<WorkflowDefinition>
  ): Promise<WorkflowDefinition>;

  /**
   * Delete a workflow
   * @param workflowId Workflow identifier
   */
  deleteWorkflow(workflowId: string): Promise<boolean>;

  /**
   * Get workflows by team
   * @param teamId Team identifier
   * @param status Optional status filter
   */
  getWorkflows(teamId: string, status?: WorkflowStatus): Promise<WorkflowDefinition[]>;

  // ==================== Workflow Lifecycle ====================

  /**
   * Activate a workflow
   * @param workflowId Workflow identifier
   */
  activateWorkflow(workflowId: string): Promise<WorkflowDefinition>;

  /**
   * Pause a workflow
   * @param workflowId Workflow identifier
   */
  pauseWorkflow(workflowId: string): Promise<WorkflowDefinition>;

  /**
   * Archive a workflow
   * @param workflowId Workflow identifier
   */
  archiveWorkflow(workflowId: string): Promise<WorkflowDefinition>;

  /**
   * Clone a workflow
   * @param workflowId Workflow identifier
   * @param newName New workflow name
   * @param createdBy User ID
   */
  cloneWorkflow(workflowId: string, newName: string, createdBy: string): Promise<WorkflowDefinition>;

  // ==================== Steps Management ====================

  /**
   * Add a step to workflow
   * @param workflowId Workflow identifier
   * @param step Step to add
   * @param afterStepId Optional step ID to insert after
   */
  addStep(workflowId: string, step: WorkflowStep, afterStepId?: string): Promise<WorkflowDefinition>;

  /**
   * Update a step
   * @param workflowId Workflow identifier
   * @param stepId Step identifier
   * @param updates Step updates
   */
  updateStep(
    workflowId: string,
    stepId: string,
    updates: Partial<WorkflowStep>
  ): Promise<WorkflowDefinition>;

  /**
   * Remove a step
   * @param workflowId Workflow identifier
   * @param stepId Step identifier
   */
  removeStep(workflowId: string, stepId: string): Promise<WorkflowDefinition>;

  /**
   * Reorder steps
   * @param workflowId Workflow identifier
   * @param stepIds Ordered step IDs
   */
  reorderSteps(workflowId: string, stepIds: string[]): Promise<WorkflowDefinition>;

  // ==================== Triggers Management ====================

  /**
   * Add a trigger to workflow
   * @param workflowId Workflow identifier
   * @param trigger Trigger to add
   */
  addTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<WorkflowDefinition>;

  /**
   * Update a trigger
   * @param workflowId Workflow identifier
   * @param triggerId Trigger identifier
   * @param updates Trigger updates
   */
  updateTrigger(
    workflowId: string,
    triggerId: string,
    updates: Partial<WorkflowTrigger>
  ): Promise<WorkflowDefinition>;

  /**
   * Remove a trigger
   * @param workflowId Workflow identifier
   * @param triggerId Trigger identifier
   */
  removeTrigger(workflowId: string, triggerId: string): Promise<WorkflowDefinition>;

  // ==================== Execution ====================

  /**
   * Execute a workflow
   * @param request Execute request
   */
  executeWorkflow(request: ExecuteWorkflowRequest): Promise<WorkflowExecution>;

  /**
   * Get an execution by ID
   * @param executionId Execution identifier
   */
  getExecution(executionId: string): Promise<WorkflowExecution | undefined>;

  /**
   * Get executions for a workflow
   * @param workflowId Workflow identifier
   * @param status Optional status filter
   * @param limit Maximum executions to return
   */
  getExecutions(
    workflowId: string,
    status?: ExecutionStatus,
    limit?: number
  ): Promise<WorkflowExecution[]>;

  /**
   * Cancel an execution
   * @param executionId Execution identifier
   */
  cancelExecution(executionId: string): Promise<WorkflowExecution>;

  /**
   * Retry a failed execution
   * @param executionId Execution identifier
   * @param fromStepId Optional step ID to retry from
   */
  retryExecution(executionId: string, fromStepId?: string): Promise<WorkflowExecution>;

  /**
   * Pause an execution
   * @param executionId Execution identifier
   */
  pauseExecution(executionId: string): Promise<WorkflowExecution>;

  /**
   * Resume a paused execution
   * @param executionId Execution identifier
   */
  resumeExecution(executionId: string): Promise<WorkflowExecution>;

  // ==================== Templates ====================

  /**
   * Get available templates
   * @param category Optional category filter
   */
  getTemplates(category?: string): Promise<WorkflowTemplate[]>;

  /**
   * Get a template by ID
   * @param templateId Template identifier
   */
  getTemplate(templateId: string): Promise<WorkflowTemplate | undefined>;

  /**
   * Create workflow from template
   * @param request Create from template request
   */
  createFromTemplate(request: CreateFromTemplateRequest): Promise<WorkflowDefinition>;

  /**
   * Save workflow as template
   * @param workflowId Workflow identifier
   * @param templateName Template name
   * @param category Category
   * @param requiredVariables Required variables
   */
  saveAsTemplate(
    workflowId: string,
    templateName: string,
    category: string,
    requiredVariables: TemplateVariable[]
  ): Promise<WorkflowTemplate>;

  // ==================== Validation ====================

  /**
   * Validate a workflow definition
   * @param workflow Workflow to validate
   */
  validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult>;

  /**
   * Validate workflow input
   * @param workflowId Workflow identifier
   * @param input Input data
   */
  validateInput(workflowId: string, input: Record<string, unknown>): Promise<ValidationResult>;

  // ==================== Events ====================

  /**
   * Subscribe to workflow events
   * @param handler Event handler
   */
  onWorkflowEvent(handler: (event: WorkflowEvent) => void): () => void;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Is valid */
  valid: boolean;
  /** Errors */
  errors: ValidationError[];
  /** Warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Path to error location */
  path?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Path to warning location */
  path?: string;
}

/**
 * Built-in action types
 */
export const BUILTIN_ACTION_TYPES = [
  'http_request',
  'send_email',
  'send_notification',
  'run_script',
  'query_database',
  'transform_data',
  'log_message',
  'set_variable',
  'call_api',
  'create_file',
  'delete_file',
  'git_commit',
  'git_push',
  'run_tests',
  'deploy',
] as const;

/**
 * Built-in categories
 */
export const WORKFLOW_CATEGORIES = [
  'ci_cd',
  'deployment',
  'testing',
  'notifications',
  'data_processing',
  'integrations',
  'maintenance',
  'custom',
] as const;
