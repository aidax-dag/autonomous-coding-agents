/**
 * Workflow Schema
 *
 * Zod schemas for YAML-based workflow definitions.
 * Supports conditional execution, parallel steps, and dependencies.
 *
 * Feature: Workflow Engine for Agent OS
 */

import { z } from 'zod';

// ============================================================================
// Condition Schemas
// ============================================================================

/**
 * Comparison operators for conditions
 */
export const ComparisonOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'matches', // regex
  'exists',
  'not_exists',
]);

export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;

/**
 * Single condition
 */
export const ConditionSchema = z.object({
  /** Field to evaluate (supports dot notation for nested access) */
  field: z.string(),
  /** Comparison operator */
  operator: ComparisonOperatorSchema,
  /** Value to compare against (optional for exists/not_exists) */
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export type Condition = z.infer<typeof ConditionSchema>;

/**
 * Condition group with logical operators
 */
export const ConditionGroupSchema: z.ZodType<{
  operator: 'and' | 'or';
  conditions: Array<Condition | { operator: 'and' | 'or'; conditions: unknown[] }>;
}> = z.object({
  operator: z.enum(['and', 'or']),
  conditions: z.array(
    z.union([ConditionSchema, z.lazy(() => ConditionGroupSchema)])
  ),
});

export type ConditionGroup = z.infer<typeof ConditionGroupSchema>;

/**
 * Condition expression (single condition or group)
 */
export const ConditionExpressionSchema = z.union([
  ConditionSchema,
  ConditionGroupSchema,
]);

export type ConditionExpression = z.infer<typeof ConditionExpressionSchema>;

// ============================================================================
// Step Schemas
// ============================================================================

/**
 * Step input configuration
 */
export const StepInputSchema = z.object({
  /** Input from previous step output */
  from_step: z.string().optional(),
  /** Field from the step output */
  field: z.string().optional(),
  /** Static value */
  value: z.unknown().optional(),
  /** Template string with variable substitution */
  template: z.string().optional(),
});

export type StepInput = z.infer<typeof StepInputSchema>;

/**
 * Step retry configuration
 */
export const RetryConfigSchema = z.object({
  /** Maximum retry attempts */
  max_attempts: z.number().min(1).max(10).default(3),
  /** Delay between retries in milliseconds */
  delay_ms: z.number().min(0).max(60000).default(1000),
  /** Exponential backoff multiplier */
  backoff_multiplier: z.number().min(1).max(5).default(2),
  /** Retry on specific error types */
  retry_on: z.array(z.string()).optional(),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

/**
 * Single workflow step
 */
export const WorkflowStepSchema = z.object({
  /** Step ID (unique within workflow) */
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/i, 'ID must start with letter and contain only alphanumeric, underscore, hyphen'),
  /** Human-readable name */
  name: z.string(),
  /** Step description */
  description: z.string().optional(),
  /** Target team */
  team: z.enum(['planning', 'development', 'qa', 'code-quality']),
  /** Task type */
  type: z.enum(['plan', 'implement', 'test', 'review', 'refactor', 'analyze']),
  /** Task content or template */
  content: z.string(),
  /** Input configuration */
  inputs: z.record(z.string(), StepInputSchema).optional(),
  /** Condition for execution */
  condition: ConditionExpressionSchema.optional(),
  /** Dependencies (step IDs that must complete first) */
  depends_on: z.array(z.string()).optional(),
  /** Retry configuration */
  retry: RetryConfigSchema.optional(),
  /** Timeout in milliseconds */
  timeout_ms: z.number().min(1000).max(3600000).optional(),
  /** Continue workflow on step failure */
  continue_on_failure: z.boolean().default(false),
  /** Output fields to expose */
  outputs: z.array(z.string()).optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * Parallel step group
 */
export const ParallelStepGroupSchema = z.object({
  /** Group type marker */
  parallel: z.literal(true),
  /** Steps to run in parallel */
  steps: z.array(WorkflowStepSchema),
  /** Maximum concurrent executions */
  max_concurrency: z.number().min(1).max(10).default(5),
  /** Wait for all steps or fail fast */
  wait_for_all: z.boolean().default(true),
});

export type ParallelStepGroup = z.infer<typeof ParallelStepGroupSchema>;

/**
 * Step entry (single step or parallel group)
 */
export const StepEntrySchema = z.union([WorkflowStepSchema, ParallelStepGroupSchema]);

export type StepEntry = z.infer<typeof StepEntrySchema>;

// ============================================================================
// Workflow Schemas
// ============================================================================

/**
 * Workflow trigger configuration
 */
export const WorkflowTriggerSchema = z.object({
  /** Trigger type */
  type: z.enum(['manual', 'schedule', 'event', 'webhook']),
  /** Schedule cron expression (for schedule type) */
  cron: z.string().optional(),
  /** Event name (for event type) */
  event: z.string().optional(),
  /** Filter conditions for trigger */
  filter: ConditionExpressionSchema.optional(),
});

export type WorkflowTrigger = z.infer<typeof WorkflowTriggerSchema>;

/**
 * Workflow variable definition
 */
export const WorkflowVariableSchema = z.object({
  /** Variable name */
  name: z.string(),
  /** Default value */
  default: z.unknown().optional(),
  /** Description */
  description: z.string().optional(),
  /** Required flag */
  required: z.boolean().default(false),
  /** Validation schema (as string) */
  schema: z.string().optional(),
});

export type WorkflowVariable = z.infer<typeof WorkflowVariableSchema>;

/**
 * Workflow output definition
 */
export const WorkflowOutputSchema = z.object({
  /** Output name */
  name: z.string(),
  /** Value expression (reference to step output) */
  value: z.string(),
  /** Description */
  description: z.string().optional(),
});

export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;

/**
 * Complete workflow definition
 */
export const WorkflowDefinitionSchema = z.object({
  /** Workflow version */
  version: z.string().default('1.0'),
  /** Workflow ID */
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/i),
  /** Human-readable name */
  name: z.string(),
  /** Description */
  description: z.string().optional(),
  /** Workflow triggers */
  triggers: z.array(WorkflowTriggerSchema).optional(),
  /** Input variables */
  variables: z.array(WorkflowVariableSchema).optional(),
  /** Workflow steps */
  steps: z.array(StepEntrySchema),
  /** Workflow outputs */
  outputs: z.array(WorkflowOutputSchema).optional(),
  /** Global timeout in milliseconds */
  timeout_ms: z.number().min(1000).max(86400000).optional(),
  /** Global retry configuration */
  retry: RetryConfigSchema.optional(),
  /** Metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate workflow definition
 */
export function validateWorkflowDefinition(data: unknown): WorkflowDefinition {
  return WorkflowDefinitionSchema.parse(data);
}

/**
 * Check if step entry is a parallel group
 */
export function isParallelGroup(entry: StepEntry): entry is ParallelStepGroup {
  return 'parallel' in entry && entry.parallel === true;
}

/**
 * Get all step IDs from a workflow
 */
export function getAllStepIds(workflow: WorkflowDefinition): string[] {
  const ids: string[] = [];

  for (const entry of workflow.steps) {
    if (isParallelGroup(entry)) {
      ids.push(...entry.steps.map((s) => s.id));
    } else {
      ids.push(entry.id);
    }
  }

  return ids;
}

/**
 * Validate step dependencies
 */
export function validateDependencies(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const allIds = new Set(getAllStepIds(workflow));

  for (const entry of workflow.steps) {
    const steps = isParallelGroup(entry) ? entry.steps : [entry];

    for (const step of steps) {
      if (step.depends_on) {
        for (const dep of step.depends_on) {
          if (!allIds.has(dep)) {
            errors.push(`Step "${step.id}" depends on unknown step "${dep}"`);
          }
          if (dep === step.id) {
            errors.push(`Step "${step.id}" cannot depend on itself`);
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Detect circular dependencies
 */
export function detectCircularDependencies(workflow: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const graph = new Map<string, string[]>();

  // Build dependency graph
  for (const entry of workflow.steps) {
    const steps = isParallelGroup(entry) ? entry.steps : [entry];

    for (const step of steps) {
      graph.set(step.id, step.depends_on || []);
    }
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(nodeId: string, path: string[]): boolean {
    if (recursionStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart).concat(nodeId);
      errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const deps = graph.get(nodeId) || [];
    for (const dep of deps) {
      if (hasCycle(dep, [...path, nodeId])) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      hasCycle(nodeId, []);
    }
  }

  return errors;
}
