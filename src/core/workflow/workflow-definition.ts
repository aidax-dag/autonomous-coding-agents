/**
 * Workflow Definition Module
 *
 * Provides DSL and schema definitions for declarative workflow configuration.
 * Supports sequential, parallel, conditional, and loop-based execution patterns.
 *
 * SOLID Principles:
 * - S: Each type/interface has a single, well-defined purpose
 * - O: Extensible step types without modifying core definitions
 * - L: All step types are substitutable in workflow execution
 * - I: Segregated interfaces for different step behaviors
 * - D: Depends on abstractions (AgentType, ITask patterns)
 *
 * @module core/workflow/workflow-definition
 */

import { z } from 'zod';
import { AgentType, TaskPriority } from '../interfaces/agent.interface';

// ============================================================================
// Enums
// ============================================================================

/**
 * Workflow execution status
 */
export enum WorkflowStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * Step execution status
 */
export enum StepStatus {
  PENDING = 'pending',
  WAITING = 'waiting',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
}

/**
 * Step type enumeration
 */
export enum StepType {
  /** Execute a single agent task */
  AGENT = 'agent',
  /** Execute steps in parallel */
  PARALLEL = 'parallel',
  /** Execute steps sequentially */
  SEQUENTIAL = 'sequential',
  /** Conditional branching */
  CONDITION = 'condition',
  /** Loop execution */
  LOOP = 'loop',
  /** Wait for external event or time */
  WAIT = 'wait',
  /** Transform data */
  TRANSFORM = 'transform',
  /** Human approval gate */
  APPROVAL = 'approval',
  /** Sub-workflow execution */
  SUBWORKFLOW = 'subworkflow',
}

/**
 * Condition operator types
 */
export enum ConditionOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  GREATER_THAN_OR_EQUALS = 'gte',
  LESS_THAN = 'lt',
  LESS_THAN_OR_EQUALS = 'lte',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  MATCHES = 'matches',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null',
  IN = 'in',
  NOT_IN = 'not_in',
  AND = 'and',
  OR = 'or',
  NOT = 'not',
}

/**
 * Loop type enumeration
 */
export enum LoopType {
  /** Iterate over array items */
  FOR_EACH = 'for_each',
  /** Loop while condition is true */
  WHILE = 'while',
  /** Loop until condition is true */
  UNTIL = 'until',
  /** Fixed number of iterations */
  COUNT = 'count',
}

/**
 * Wait type enumeration
 */
export enum WaitType {
  /** Wait for a duration */
  DURATION = 'duration',
  /** Wait until a specific time */
  UNTIL = 'until',
  /** Wait for external event */
  EVENT = 'event',
  /** Wait for condition to be true */
  CONDITION = 'condition',
}

// ============================================================================
// TypeScript Interfaces (defined first to avoid circular references)
// ============================================================================

/**
 * Condition expression type
 */
export type ConditionExpression =
  | {
      left: string | number | boolean | null;
      operator: ConditionOperator;
      right?: string | number | boolean | null | unknown[];
    }
  | {
      operator: ConditionOperator.AND | ConditionOperator.OR;
      conditions: ConditionExpression[];
    }
  | {
      operator: ConditionOperator.NOT;
      condition: ConditionExpression;
    };

/**
 * Input/Output mapping types
 */
export type InputMapping = Record<string, string | number | boolean | null | Record<string, unknown> | unknown[]>;
export type OutputMapping = Record<string, string>;

/**
 * Retry policy interface
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Timeout policy interface
 */
export interface TimeoutPolicy {
  stepTimeout?: number;
  workflowTimeout?: number;
}

/**
 * Error handling policy interface
 */
export interface ErrorHandlingPolicy {
  onError: 'fail' | 'continue' | 'retry' | 'fallback';
  fallbackStepId?: string;
  continueOnFailedSteps?: string[];
}

/**
 * Base step interface
 */
export interface BaseStep {
  id: string;
  name: string;
  description?: string;
  type: StepType;
  dependsOn?: string[];
  condition?: ConditionExpression;
  inputMapping?: InputMapping;
  outputMapping?: OutputMapping;
  retry?: RetryPolicy;
  timeout?: number;
  errorHandling?: ErrorHandlingPolicy;
  metadata?: Record<string, unknown>;
}

/**
 * Agent step configuration
 */
export interface AgentStepConfig {
  agentType: AgentType;
  taskType: string;
  payload: Record<string, unknown>;
  priority?: TaskPriority;
}

/**
 * Agent step interface
 */
export interface AgentStep extends BaseStep {
  type: StepType.AGENT;
  config: AgentStepConfig;
}

/**
 * Parallel step interface
 */
export interface ParallelStep extends BaseStep {
  type: StepType.PARALLEL;
  config: {
    steps: StepDefinition[];
    maxConcurrency?: number;
    failFast: boolean;
  };
}

/**
 * Sequential step interface
 */
export interface SequentialStep extends BaseStep {
  type: StepType.SEQUENTIAL;
  config: {
    steps: StepDefinition[];
    stopOnError: boolean;
  };
}

/**
 * Condition step interface
 */
export interface ConditionStep extends BaseStep {
  type: StepType.CONDITION;
  config: {
    condition: ConditionExpression;
    thenSteps: StepDefinition[];
    elseSteps?: StepDefinition[];
  };
}

/**
 * Loop step interface
 */
export interface LoopStep extends BaseStep {
  type: StepType.LOOP;
  config: {
    loopType: LoopType;
    items?: string;
    condition?: ConditionExpression;
    count?: number;
    maxIterations: number;
    itemVariable: string;
    indexVariable: string;
    steps: StepDefinition[];
  };
}

/**
 * Wait step interface
 */
export interface WaitStep extends BaseStep {
  type: StepType.WAIT;
  config: {
    waitType: WaitType;
    duration?: number;
    until?: string;
    eventName?: string;
    eventFilter?: Record<string, unknown>;
    condition?: ConditionExpression;
    pollInterval: number;
    maxWait?: number;
  };
}

/**
 * Transform step interface
 */
export interface TransformStep extends BaseStep {
  type: StepType.TRANSFORM;
  config: {
    transformations: Array<{
      source: string;
      target: string;
      expression?: string;
      defaultValue?: unknown;
    }>;
  };
}

/**
 * Approval step interface
 */
export interface ApprovalStep extends BaseStep {
  type: StepType.APPROVAL;
  config: {
    approvers: string[];
    requiredApprovals: number;
    message: string;
    timeout?: number;
    escalateTo?: string[];
    escalateAfter?: number;
  };
}

/**
 * Subworkflow step interface
 */
export interface SubworkflowStep extends BaseStep {
  type: StepType.SUBWORKFLOW;
  config: {
    workflowId: string;
    version?: string;
    inputMapping?: InputMapping;
    outputMapping?: OutputMapping;
    waitForCompletion: boolean;
  };
}

/**
 * Unified step definition type
 */
export type StepDefinition =
  | AgentStep
  | ParallelStep
  | SequentialStep
  | ConditionStep
  | LoopStep
  | WaitStep
  | TransformStep
  | ApprovalStep
  | SubworkflowStep;

/**
 * Workflow trigger interface
 */
export interface WorkflowTrigger {
  type: 'manual' | 'schedule' | 'event' | 'webhook' | 'api';
  schedule?: string;
  eventName?: string;
  eventFilter?: Record<string, unknown>;
  webhookPath?: string;
}

/**
 * Workflow metadata interface
 */
export interface WorkflowMetadata {
  author?: string;
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Workflow variable interface
 */
export interface WorkflowVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: unknown[];
  };
}

/**
 * Complete workflow definition interface
 */
export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  inputs?: WorkflowVariable[];
  outputs?: WorkflowVariable[];
  variables?: Record<string, unknown>;
  steps: StepDefinition[];
  triggers?: WorkflowTrigger[];
  retry?: RetryPolicy;
  timeout?: TimeoutPolicy;
  errorHandling?: ErrorHandlingPolicy;
  metadata?: WorkflowMetadata;
  enabled: boolean;
  draft: boolean;
}

// ============================================================================
// Zod Schemas (for validation)
// ============================================================================

/**
 * Variable reference schema (e.g., "${steps.step1.output.result}")
 */
export const VariableRefSchema = z.string().regex(
  /^\$\{[a-zA-Z_][a-zA-Z0-9_.[\]]*\}$/,
  'Invalid variable reference format. Use ${path.to.value}'
);

/**
 * Condition expression schema
 */
export const ConditionExpressionSchema: z.ZodType<ConditionExpression> = z.lazy(() =>
  z.union([
    // Simple comparison
    z.object({
      left: z.union([z.string(), z.number(), z.boolean(), z.null()]),
      operator: z.nativeEnum(ConditionOperator),
      right: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown())]).optional(),
    }),
    // Compound expressions (AND, OR)
    z.object({
      operator: z.enum([ConditionOperator.AND, ConditionOperator.OR]),
      conditions: z.array(ConditionExpressionSchema),
    }),
    // NOT expression
    z.object({
      operator: z.literal(ConditionOperator.NOT),
      condition: ConditionExpressionSchema,
    }),
  ])
);

/**
 * Input mapping schema
 */
export const InputMappingSchema = z.record(
  z.string(),
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.unknown()),
    z.array(z.unknown()),
  ])
);

/**
 * Output mapping schema
 */
export const OutputMappingSchema = z.record(z.string(), z.string());

/**
 * Retry policy schema
 */
export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  initialDelay: z.number().int().min(100).default(1000),
  maxDelay: z.number().int().min(1000).default(30000),
  backoffMultiplier: z.number().min(1).max(5).default(2),
  retryableErrors: z.array(z.string()).optional(),
});

/**
 * Timeout policy schema
 */
export const TimeoutPolicySchema = z.object({
  stepTimeout: z.number().int().min(1000).optional(),
  workflowTimeout: z.number().int().min(1000).optional(),
});

/**
 * Error handling policy schema
 */
export const ErrorHandlingPolicySchema = z.object({
  onError: z.enum(['fail', 'continue', 'retry', 'fallback']).default('fail'),
  fallbackStepId: z.string().optional(),
  continueOnFailedSteps: z.array(z.string()).optional(),
});

/**
 * Base step definition schema (without recursive references)
 */
const BaseStepSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dependsOn: z.array(z.string()).optional(),
  condition: ConditionExpressionSchema.optional(),
  inputMapping: InputMappingSchema.optional(),
  outputMapping: OutputMappingSchema.optional(),
  retry: RetryPolicySchema.optional(),
  timeout: z.number().int().min(1000).optional(),
  errorHandling: ErrorHandlingPolicySchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Agent step configuration schema
 */
export const AgentStepConfigSchema = z.object({
  agentType: z.nativeEnum(AgentType),
  taskType: z.string().min(1),
  payload: z.record(z.unknown()),
  priority: z.nativeEnum(TaskPriority).optional(),
});

/**
 * Agent step schema
 */
export const AgentStepSchema = BaseStepSchema.extend({
  type: z.literal(StepType.AGENT),
  config: AgentStepConfigSchema,
});

// Forward declaration for recursive schemas
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let StepDefinitionSchemaInternal: z.ZodType<any>;

/**
 * Parallel step schema
 */
export const ParallelStepSchema: z.ZodType<ParallelStep> = BaseStepSchema.extend({
  type: z.literal(StepType.PARALLEL),
  config: z.object({
    steps: z.lazy(() => z.array(StepDefinitionSchemaInternal)),
    maxConcurrency: z.number().int().min(1).max(100).optional(),
    failFast: z.boolean().default(true),
  }),
}) as z.ZodType<ParallelStep>;

/**
 * Sequential step schema
 */
export const SequentialStepSchema: z.ZodType<SequentialStep> = BaseStepSchema.extend({
  type: z.literal(StepType.SEQUENTIAL),
  config: z.object({
    steps: z.lazy(() => z.array(StepDefinitionSchemaInternal)),
    stopOnError: z.boolean().default(true),
  }),
}) as z.ZodType<SequentialStep>;

/**
 * Condition step schema
 */
export const ConditionStepSchema: z.ZodType<ConditionStep> = BaseStepSchema.extend({
  type: z.literal(StepType.CONDITION),
  config: z.object({
    condition: ConditionExpressionSchema,
    thenSteps: z.lazy(() => z.array(StepDefinitionSchemaInternal)),
    elseSteps: z.lazy(() => z.array(StepDefinitionSchemaInternal)).optional(),
  }),
}) as z.ZodType<ConditionStep>;

/**
 * Loop step schema
 */
export const LoopStepSchema: z.ZodType<LoopStep> = BaseStepSchema.extend({
  type: z.literal(StepType.LOOP),
  config: z.object({
    loopType: z.nativeEnum(LoopType),
    items: z.string().optional(),
    condition: ConditionExpressionSchema.optional(),
    count: z.number().int().min(1).optional(),
    maxIterations: z.number().int().min(1).max(1000).default(100),
    itemVariable: z.string().default('item'),
    indexVariable: z.string().default('index'),
    steps: z.lazy(() => z.array(StepDefinitionSchemaInternal)),
  }),
}) as z.ZodType<LoopStep>;

/**
 * Wait step schema
 */
export const WaitStepSchema = BaseStepSchema.extend({
  type: z.literal(StepType.WAIT),
  config: z.object({
    waitType: z.nativeEnum(WaitType),
    duration: z.number().int().min(0).optional(),
    until: z.string().optional(),
    eventName: z.string().optional(),
    eventFilter: z.record(z.unknown()).optional(),
    condition: ConditionExpressionSchema.optional(),
    pollInterval: z.number().int().min(100).default(1000),
    maxWait: z.number().int().min(1000).optional(),
  }),
});

/**
 * Transform step schema
 */
export const TransformStepSchema = BaseStepSchema.extend({
  type: z.literal(StepType.TRANSFORM),
  config: z.object({
    transformations: z.array(z.object({
      source: z.string(),
      target: z.string(),
      expression: z.string().optional(),
      defaultValue: z.unknown().optional(),
    })),
  }),
});

/**
 * Approval step schema
 */
export const ApprovalStepSchema = BaseStepSchema.extend({
  type: z.literal(StepType.APPROVAL),
  config: z.object({
    approvers: z.array(z.string()).min(1),
    requiredApprovals: z.number().int().min(1).default(1),
    message: z.string().max(1000),
    timeout: z.number().int().min(60000).optional(),
    escalateTo: z.array(z.string()).optional(),
    escalateAfter: z.number().int().min(60000).optional(),
  }),
});

/**
 * Sub-workflow step schema
 */
export const SubworkflowStepSchema = BaseStepSchema.extend({
  type: z.literal(StepType.SUBWORKFLOW),
  config: z.object({
    workflowId: z.string().min(1),
    version: z.string().optional(),
    inputMapping: InputMappingSchema.optional(),
    outputMapping: OutputMappingSchema.optional(),
    waitForCompletion: z.boolean().default(true),
  }),
});

/**
 * Unified step definition schema (using discriminated union)
 */
StepDefinitionSchemaInternal = z.union([
  AgentStepSchema,
  ParallelStepSchema,
  SequentialStepSchema,
  ConditionStepSchema,
  LoopStepSchema,
  WaitStepSchema,
  TransformStepSchema,
  ApprovalStepSchema,
  SubworkflowStepSchema,
]);

export const StepDefinitionSchema: z.ZodType<StepDefinition> = StepDefinitionSchemaInternal;

/**
 * Workflow trigger schema
 */
export const WorkflowTriggerSchema = z.object({
  type: z.enum(['manual', 'schedule', 'event', 'webhook', 'api']),
  schedule: z.string().optional(),
  eventName: z.string().optional(),
  eventFilter: z.record(z.unknown()).optional(),
  webhookPath: z.string().optional(),
});

/**
 * Workflow metadata schema
 */
export const WorkflowMetadataSchema = z.object({
  author: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  tags: z.array(z.string()).optional(),
  labels: z.record(z.string()).optional(),
  annotations: z.record(z.string()).optional(),
});

/**
 * Workflow variable schema
 */
export const WorkflowVariableSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  description: z.string().max(500).optional(),
  validation: z.object({
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    enum: z.array(z.unknown()).optional(),
  }).optional(),
});

/**
 * Complete workflow definition schema
 */
export const WorkflowDefinitionSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be semver format (e.g., 1.0.0)'),
  inputs: z.array(WorkflowVariableSchema).optional(),
  outputs: z.array(WorkflowVariableSchema).optional(),
  variables: z.record(z.unknown()).optional(),
  steps: z.array(StepDefinitionSchema).min(1),
  triggers: z.array(WorkflowTriggerSchema).optional(),
  retry: RetryPolicySchema.optional(),
  timeout: TimeoutPolicySchema.optional(),
  errorHandling: ErrorHandlingPolicySchema.optional(),
  metadata: WorkflowMetadataSchema.optional(),
  enabled: z.boolean().default(true),
  draft: z.boolean().default(false),
});

// ============================================================================
// Workflow Builder (Fluent API)
// ============================================================================

/**
 * Fluent workflow builder for programmatic workflow construction
 */
export class WorkflowBuilder {
  private definition: Partial<WorkflowDefinition> = {
    version: '1.0.0',
    steps: [],
    enabled: true,
    draft: false,
  };

  /**
   * Create a new workflow builder
   */
  static create(id: string, name: string): WorkflowBuilder {
    const builder = new WorkflowBuilder();
    builder.definition.id = id;
    builder.definition.name = name;
    return builder;
  }

  /**
   * Set workflow description
   */
  description(desc: string): this {
    this.definition.description = desc;
    return this;
  }

  /**
   * Set workflow version
   */
  version(ver: string): this {
    this.definition.version = ver;
    return this;
  }

  /**
   * Add input variable
   */
  input(variable: WorkflowVariable): this {
    if (!this.definition.inputs) {
      this.definition.inputs = [];
    }
    this.definition.inputs.push(variable);
    return this;
  }

  /**
   * Add output variable
   */
  output(variable: WorkflowVariable): this {
    if (!this.definition.outputs) {
      this.definition.outputs = [];
    }
    this.definition.outputs.push(variable);
    return this;
  }

  /**
   * Add a step to the workflow
   */
  step(step: StepDefinition): this {
    if (!this.definition.steps) {
      this.definition.steps = [];
    }
    this.definition.steps.push(step);
    return this;
  }

  /**
   * Add an agent step
   */
  agentStep(
    id: string,
    name: string,
    agentType: AgentType,
    taskType: string,
    payload: Record<string, unknown>,
    options?: Partial<Omit<AgentStep, 'id' | 'name' | 'type' | 'config'>>
  ): this {
    return this.step({
      id,
      name,
      type: StepType.AGENT,
      config: {
        agentType,
        taskType,
        payload,
      },
      ...options,
    });
  }

  /**
   * Add parallel steps
   */
  parallel(
    id: string,
    name: string,
    steps: StepDefinition[],
    options?: { maxConcurrency?: number; failFast?: boolean }
  ): this {
    return this.step({
      id,
      name,
      type: StepType.PARALLEL,
      config: {
        steps,
        maxConcurrency: options?.maxConcurrency,
        failFast: options?.failFast ?? true,
      },
    });
  }

  /**
   * Add sequential steps
   */
  sequential(
    id: string,
    name: string,
    steps: StepDefinition[],
    options?: { stopOnError?: boolean }
  ): this {
    return this.step({
      id,
      name,
      type: StepType.SEQUENTIAL,
      config: {
        steps,
        stopOnError: options?.stopOnError ?? true,
      },
    });
  }

  /**
   * Add conditional branching
   */
  condition(
    id: string,
    name: string,
    condition: ConditionExpression,
    thenSteps: StepDefinition[],
    elseSteps?: StepDefinition[]
  ): this {
    return this.step({
      id,
      name,
      type: StepType.CONDITION,
      config: {
        condition,
        thenSteps,
        elseSteps,
      },
    });
  }

  /**
   * Add a loop step
   */
  loop(
    id: string,
    name: string,
    loopType: LoopType,
    steps: StepDefinition[],
    options?: Partial<LoopStep['config']>
  ): this {
    return this.step({
      id,
      name,
      type: StepType.LOOP,
      config: {
        loopType,
        steps,
        maxIterations: options?.maxIterations ?? 100,
        itemVariable: options?.itemVariable ?? 'item',
        indexVariable: options?.indexVariable ?? 'index',
        ...options,
      },
    });
  }

  /**
   * Add a wait step
   */
  wait(
    id: string,
    name: string,
    waitType: WaitType,
    options: Partial<WaitStep['config']>
  ): this {
    return this.step({
      id,
      name,
      type: StepType.WAIT,
      config: {
        waitType,
        pollInterval: options.pollInterval ?? 1000,
        ...options,
      },
    });
  }

  /**
   * Add retry policy
   */
  retry(policy: RetryPolicy): this {
    this.definition.retry = policy;
    return this;
  }

  /**
   * Add timeout policy
   */
  timeout(policy: TimeoutPolicy): this {
    this.definition.timeout = policy;
    return this;
  }

  /**
   * Add error handling policy
   */
  errorHandling(policy: ErrorHandlingPolicy): this {
    this.definition.errorHandling = policy;
    return this;
  }

  /**
   * Add trigger
   */
  trigger(trigger: WorkflowTrigger): this {
    if (!this.definition.triggers) {
      this.definition.triggers = [];
    }
    this.definition.triggers.push(trigger);
    return this;
  }

  /**
   * Set metadata
   */
  metadata(meta: WorkflowMetadata): this {
    this.definition.metadata = meta;
    return this;
  }

  /**
   * Set enabled flag
   */
  enabled(value: boolean): this {
    this.definition.enabled = value;
    return this;
  }

  /**
   * Set draft flag
   */
  draft(value: boolean): this {
    this.definition.draft = value;
    return this;
  }

  /**
   * Build and validate the workflow definition
   */
  build(): WorkflowDefinition {
    const result = WorkflowDefinitionSchema.safeParse(this.definition);
    if (!result.success) {
      throw new Error(
        `Invalid workflow definition: ${result.error.errors.map(e => e.message).join(', ')}`
      );
    }
    return result.data;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate a workflow definition
 */
export function validateWorkflowDefinition(
  definition: unknown
): { valid: true; data: WorkflowDefinition } | { valid: false; errors: z.ZodError } {
  const result = WorkflowDefinitionSchema.safeParse(definition);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

/**
 * Validate a step definition
 */
export function validateStepDefinition(
  step: unknown
): { valid: true; data: StepDefinition } | { valid: false; errors: z.ZodError } {
  const result = StepDefinitionSchema.safeParse(step);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  return { valid: false, errors: result.error };
}

/**
 * Get all step IDs from a workflow definition (including nested steps)
 */
export function getAllStepIds(definition: WorkflowDefinition): string[] {
  const ids: string[] = [];

  function collectIds(steps: StepDefinition[]): void {
    for (const step of steps) {
      ids.push(step.id);

      // Collect nested step IDs
      if (step.type === StepType.PARALLEL) {
        collectIds(step.config.steps);
      } else if (step.type === StepType.SEQUENTIAL) {
        collectIds(step.config.steps);
      } else if (step.type === StepType.CONDITION) {
        collectIds(step.config.thenSteps);
        if (step.config.elseSteps) {
          collectIds(step.config.elseSteps);
        }
      } else if (step.type === StepType.LOOP) {
        collectIds(step.config.steps);
      }
    }
  }

  collectIds(definition.steps);
  return ids;
}

/**
 * Check for duplicate step IDs in a workflow definition
 */
export function checkDuplicateStepIds(
  definition: WorkflowDefinition
): string[] {
  const allIds = getAllStepIds(definition);
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const id of allIds) {
    if (seen.has(id)) {
      duplicates.push(id);
    } else {
      seen.add(id);
    }
  }

  return duplicates;
}

/**
 * Validate step dependencies (check for missing or circular dependencies)
 */
export function validateStepDependencies(
  definition: WorkflowDefinition
): { valid: boolean; errors: string[] } {
  const allIds = new Set(getAllStepIds(definition));
  const errors: string[] = [];

  function checkDependencies(steps: StepDefinition[], parentPath: string = ''): void {
    for (const step of steps) {
      const stepPath = parentPath ? `${parentPath}.${step.id}` : step.id;

      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!allIds.has(depId)) {
            errors.push(`Step '${stepPath}' depends on non-existent step '${depId}'`);
          }
        }
      }

      // Check nested steps
      if (step.type === StepType.PARALLEL) {
        checkDependencies(step.config.steps, stepPath);
      } else if (step.type === StepType.SEQUENTIAL) {
        checkDependencies(step.config.steps, stepPath);
      } else if (step.type === StepType.CONDITION) {
        checkDependencies(step.config.thenSteps, `${stepPath}.then`);
        if (step.config.elseSteps) {
          checkDependencies(step.config.elseSteps, `${stepPath}.else`);
        }
      } else if (step.type === StepType.LOOP) {
        checkDependencies(step.config.steps, stepPath);
      }
    }
  }

  checkDependencies(definition.steps);
  return { valid: errors.length === 0, errors };
}

/**
 * Create a simple agent step helper
 */
export function createAgentStep(
  id: string,
  name: string,
  agentType: AgentType,
  taskType: string,
  payload: Record<string, unknown>
): AgentStep {
  return {
    id,
    name,
    type: StepType.AGENT,
    config: {
      agentType,
      taskType,
      payload,
    },
  };
}

/**
 * Create a condition expression helper
 */
export function createCondition(
  left: string | number | boolean | null,
  operator: ConditionOperator,
  right?: string | number | boolean | null | unknown[]
): ConditionExpression {
  return { left, operator, right };
}

/**
 * Create an AND condition helper
 */
export function and(...conditions: ConditionExpression[]): ConditionExpression {
  return { operator: ConditionOperator.AND, conditions };
}

/**
 * Create an OR condition helper
 */
export function or(...conditions: ConditionExpression[]): ConditionExpression {
  return { operator: ConditionOperator.OR, conditions };
}

/**
 * Create a NOT condition helper
 */
export function not(condition: ConditionExpression): ConditionExpression {
  return { operator: ConditionOperator.NOT, condition };
}
