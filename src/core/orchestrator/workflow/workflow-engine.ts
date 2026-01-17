/**
 * Workflow Engine
 *
 * Executes YAML-defined workflows with support for:
 * - Conditional execution based on previous step results
 * - Parallel execution of independent steps
 * - Dependency resolution and topological ordering
 *
 * Feature: Workflow Engine for Agent OS
 */

import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  WorkflowStep,
  StepEntry,
  Condition,
  ConditionGroup,
  ConditionExpression,
  ComparisonOperator,
  isParallelGroup,
  RetryConfig,
} from './workflow-schema';

// ============================================================================
// Types
// ============================================================================

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
}

/**
 * Step execution result
 */
export interface StepResult {
  stepId: string;
  status: StepStatus;
  output: unknown;
  error?: string;
  startTime: number;
  endTime: number;
  duration: number;
  retryCount: number;
}

/**
 * Workflow execution context
 */
export interface WorkflowContext {
  /** Workflow ID */
  workflowId: string;
  /** Execution ID */
  executionId: string;
  /** Input variables */
  variables: Record<string, unknown>;
  /** Step results */
  stepResults: Map<string, StepResult>;
  /** Current execution state */
  state: 'running' | 'completed' | 'failed' | 'cancelled';
  /** Start time */
  startTime: number;
  /** End time (when completed) */
  endTime?: number;
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  success: boolean;
  workflowId: string;
  executionId: string;
  stepResults: StepResult[];
  outputs: Record<string, unknown>;
  duration: number;
  error?: string;
}

/**
 * Step executor function
 */
export type StepExecutor = (
  step: WorkflowStep,
  inputs: Record<string, unknown>,
  context: WorkflowContext
) => Promise<unknown>;

/**
 * Workflow engine configuration
 */
export interface WorkflowEngineConfig {
  /** Step executor function */
  executor: StepExecutor;
  /** Default timeout for steps (ms) */
  defaultTimeout?: number;
  /** Default retry configuration */
  defaultRetry?: RetryConfig;
  /** Maximum parallel executions */
  maxParallelism?: number;
}

/**
 * Workflow engine events
 */
export interface WorkflowEngineEvents {
  'workflow:started': (context: WorkflowContext) => void;
  'workflow:completed': (result: WorkflowExecutionResult) => void;
  'workflow:failed': (context: WorkflowContext, error: Error) => void;
  'step:started': (stepId: string, context: WorkflowContext) => void;
  'step:completed': (result: StepResult, context: WorkflowContext) => void;
  'step:failed': (result: StepResult, context: WorkflowContext) => void;
  'step:skipped': (stepId: string, reason: string, context: WorkflowContext) => void;
  'step:retrying': (stepId: string, attempt: number, error: Error) => void;
}

// ============================================================================
// Workflow Engine
// ============================================================================

/**
 * Workflow Engine
 *
 * Executes YAML-defined workflows with conditional and parallel support.
 */
export class WorkflowEngine extends EventEmitter {
  private config: Required<WorkflowEngineConfig>;
  private activeExecutions = new Map<string, WorkflowContext>();

  constructor(config: WorkflowEngineConfig) {
    super();
    this.config = {
      executor: config.executor,
      defaultTimeout: config.defaultTimeout ?? 300000, // 5 minutes
      defaultRetry: config.defaultRetry ?? { max_attempts: 1, delay_ms: 0, backoff_multiplier: 1 },
      maxParallelism: config.maxParallelism ?? 5,
    };
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflow: WorkflowDefinition,
    variables: Record<string, unknown> = {}
  ): Promise<WorkflowExecutionResult> {
    const executionId = this.generateExecutionId();
    const context: WorkflowContext = {
      workflowId: workflow.id,
      executionId,
      variables: { ...variables },
      stepResults: new Map(),
      state: 'running',
      startTime: Date.now(),
    };

    this.activeExecutions.set(executionId, context);
    this.emit('workflow:started', context);

    try {
      // Execute workflow steps
      await this.executeSteps(workflow, context);

      // Collect outputs
      const outputs = this.collectOutputs(workflow, context);

      context.state = 'completed';
      context.endTime = Date.now();

      const result: WorkflowExecutionResult = {
        success: true,
        workflowId: workflow.id,
        executionId,
        stepResults: Array.from(context.stepResults.values()),
        outputs,
        duration: context.endTime - context.startTime,
      };

      this.emit('workflow:completed', result);
      return result;
    } catch (error) {
      context.state = 'failed';
      context.endTime = Date.now();

      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('workflow:failed', context, err);

      return {
        success: false,
        workflowId: workflow.id,
        executionId,
        stepResults: Array.from(context.stepResults.values()),
        outputs: {},
        duration: (context.endTime ?? Date.now()) - context.startTime,
        error: err.message,
      };
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Cancel a running workflow
   */
  async cancel(executionId: string): Promise<boolean> {
    const context = this.activeExecutions.get(executionId);
    if (!context || context.state !== 'running') {
      return false;
    }

    context.state = 'cancelled';
    return true;
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): WorkflowContext[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Execute workflow steps
   */
  private async executeSteps(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Promise<void> {
    // Build execution plan with topological ordering
    const executionPlan = this.buildExecutionPlan(workflow);

    // Execute steps in order
    for (const batch of executionPlan) {
      if (context.state !== 'running') {
        break;
      }

      if (batch.length === 1 && !isParallelGroup(batch[0].entry)) {
        // Single step execution
        await this.executeStep(batch[0].entry as WorkflowStep, context);
      } else {
        // Parallel execution
        const steps = batch.flatMap((b) =>
          isParallelGroup(b.entry) ? b.entry.steps : [b.entry as WorkflowStep]
        );

        const maxConcurrency = batch[0].entry && isParallelGroup(batch[0].entry)
          ? batch[0].entry.max_concurrency
          : this.config.maxParallelism;

        await this.executeParallel(steps, context, maxConcurrency);
      }
    }
  }

  /**
   * Build execution plan with topological ordering
   */
  private buildExecutionPlan(
    workflow: WorkflowDefinition
  ): Array<Array<{ entry: StepEntry; index: number }>> {
    const plan: Array<Array<{ entry: StepEntry; index: number }>> = [];
    const executed = new Set<string>();
    const entries = workflow.steps.map((entry, index) => ({ entry, index }));

    // Simple topological sort based on depends_on
    while (entries.length > 0) {
      const batch: Array<{ entry: StepEntry; index: number }> = [];

      for (let i = entries.length - 1; i >= 0; i--) {
        const { entry } = entries[i];
        const steps = isParallelGroup(entry) ? entry.steps : [entry];
        const allDepsResolved = steps.every((step) =>
          (step.depends_on || []).every((dep) => executed.has(dep))
        );

        if (allDepsResolved) {
          batch.push(entries[i]);
          entries.splice(i, 1);
        }
      }

      if (batch.length === 0 && entries.length > 0) {
        // Circular dependency or missing dependency - should be caught by validation
        throw new Error('Unable to resolve step dependencies');
      }

      // Add step IDs to executed set
      for (const { entry } of batch) {
        const steps = isParallelGroup(entry) ? entry.steps : [entry];
        for (const step of steps) {
          executed.add(step.id);
        }
      }

      if (batch.length > 0) {
        plan.push(batch.sort((a, b) => a.index - b.index));
      }
    }

    return plan;
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    step: WorkflowStep,
    context: WorkflowContext
  ): Promise<StepResult> {
    // Check condition
    if (step.condition && !this.evaluateCondition(step.condition, context)) {
      const result: StepResult = {
        stepId: step.id,
        status: StepStatus.SKIPPED,
        output: null,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        retryCount: 0,
      };
      context.stepResults.set(step.id, result);
      this.emit('step:skipped', step.id, 'Condition not met', context);
      return result;
    }

    const startTime = Date.now();
    this.emit('step:started', step.id, context);

    // Resolve inputs
    const inputs = this.resolveInputs(step, context);

    // Get retry config
    const retryConfig = step.retry || this.config.defaultRetry;
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 1; attempt <= retryConfig.max_attempts; attempt++) {
      try {
        // Execute with timeout
        const timeout = step.timeout_ms || this.config.defaultTimeout;
        const output = await this.executeWithTimeout(
          () => this.config.executor(step, inputs, context),
          timeout
        );

        const result: StepResult = {
          stepId: step.id,
          status: StepStatus.COMPLETED,
          output,
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          retryCount,
        };

        context.stepResults.set(step.id, result);
        this.emit('step:completed', result, context);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retryCount = attempt;

        if (attempt < retryConfig.max_attempts) {
          this.emit('step:retrying', step.id, attempt, lastError);
          const delay = retryConfig.delay_ms * Math.pow(retryConfig.backoff_multiplier, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    const result: StepResult = {
      stepId: step.id,
      status: StepStatus.FAILED,
      output: null,
      error: lastError?.message,
      startTime,
      endTime: Date.now(),
      duration: Date.now() - startTime,
      retryCount,
    };

    context.stepResults.set(step.id, result);
    this.emit('step:failed', result, context);

    if (!step.continue_on_failure) {
      throw lastError || new Error(`Step ${step.id} failed`);
    }

    return result;
  }

  /**
   * Execute steps in parallel
   */
  private async executeParallel(
    steps: WorkflowStep[],
    context: WorkflowContext,
    maxConcurrency: number
  ): Promise<StepResult[]> {
    const results: StepResult[] = [];
    const pending = [...steps];
    const running = new Map<string, Promise<StepResult>>();

    while (pending.length > 0 || running.size > 0) {
      // Start new executions up to max concurrency
      while (pending.length > 0 && running.size < maxConcurrency) {
        const step = pending.shift()!;

        // Check if dependencies are met
        const depsResolved = (step.depends_on || []).every((dep) => {
          const result = context.stepResults.get(dep);
          return result && result.status === StepStatus.COMPLETED;
        });

        if (!depsResolved) {
          // Put back to pending
          pending.push(step);
          break;
        }

        const promise = this.executeStep(step, context).catch((error) => ({
          stepId: step.id,
          status: StepStatus.FAILED as const,
          output: null,
          error: error instanceof Error ? error.message : String(error),
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          retryCount: 0,
        }));

        running.set(step.id, promise);
      }

      if (running.size === 0) {
        break;
      }

      // Wait for any execution to complete
      const [completedId, result] = await Promise.race(
        Array.from(running.entries()).map(async ([id, promise]) => {
          const res = await promise;
          return [id, res] as const;
        })
      );

      running.delete(completedId);
      results.push(result);

      // Check for failure
      if (result.status === StepStatus.FAILED) {
        const step = steps.find((s) => s.id === completedId);
        if (step && !step.continue_on_failure) {
          // Cancel remaining steps
          context.state = 'failed';
          break;
        }
      }
    }

    return results;
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(
    expression: ConditionExpression,
    context: WorkflowContext
  ): boolean {
    if ('operator' in expression && ('and' === expression.operator || 'or' === expression.operator)) {
      return this.evaluateConditionGroup(expression as ConditionGroup, context);
    }
    return this.evaluateSingleCondition(expression as Condition, context);
  }

  /**
   * Evaluate a condition group
   */
  private evaluateConditionGroup(
    group: ConditionGroup,
    context: WorkflowContext
  ): boolean {
    if (group.operator === 'and') {
      return group.conditions.every((c) => this.evaluateCondition(c as ConditionExpression, context));
    }
    return group.conditions.some((c) => this.evaluateCondition(c as ConditionExpression, context));
  }

  /**
   * Evaluate a single condition
   */
  private evaluateSingleCondition(
    condition: Condition,
    context: WorkflowContext
  ): boolean {
    const fieldValue = this.resolveFieldValue(condition.field, context);
    const compareValue = condition.value;

    return this.compareValues(fieldValue, condition.operator, compareValue);
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: unknown,
    operator: ComparisonOperator,
    expected: unknown
  ): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not_equals':
        return actual !== expected;
      case 'contains':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.includes(expected);
        }
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        return false;
      case 'not_contains':
        return !this.compareValues(actual, 'contains', expected);
      case 'greater_than':
        return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      case 'less_than':
        return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      case 'greater_than_or_equal':
        return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      case 'less_than_or_equal':
        return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      case 'matches':
        if (typeof actual === 'string' && typeof expected === 'string') {
          return new RegExp(expected).test(actual);
        }
        return false;
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'not_exists':
        return actual === undefined || actual === null;
      default:
        return false;
    }
  }

  /**
   * Resolve field value from context
   */
  private resolveFieldValue(field: string, context: WorkflowContext): unknown {
    const parts = field.split('.');

    // Check if it's a step output reference
    if (parts.length >= 2) {
      const [stepId, ...rest] = parts;
      const result = context.stepResults.get(stepId);
      if (result && result.output) {
        return this.getNestedValue(result.output, rest);
      }
    }

    // Check variables
    if (parts[0] === 'variables') {
      return this.getNestedValue(context.variables, parts.slice(1));
    }

    return undefined;
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: unknown, path: string[]): unknown {
    let current = obj;
    for (const key of path) {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[key];
      } else {
        return undefined;
      }
    }
    return current;
  }

  /**
   * Resolve step inputs
   */
  private resolveInputs(
    step: WorkflowStep,
    context: WorkflowContext
  ): Record<string, unknown> {
    const inputs: Record<string, unknown> = {};

    if (!step.inputs) {
      return inputs;
    }

    for (const [key, inputConfig] of Object.entries(step.inputs)) {
      if (inputConfig.value !== undefined) {
        inputs[key] = inputConfig.value;
      } else if (inputConfig.from_step && inputConfig.field) {
        const stepResult = context.stepResults.get(inputConfig.from_step);
        if (stepResult?.output) {
          inputs[key] = this.getNestedValue(stepResult.output, inputConfig.field.split('.'));
        }
      } else if (inputConfig.template) {
        inputs[key] = this.resolveTemplate(inputConfig.template, context);
      }
    }

    return inputs;
  }

  /**
   * Resolve template string
   */
  private resolveTemplate(template: string, context: WorkflowContext): string {
    return template.replace(/\$\{([^}]+)\}/g, (match, field) => {
      const value = this.resolveFieldValue(field, context);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Collect workflow outputs
   */
  private collectOutputs(
    workflow: WorkflowDefinition,
    context: WorkflowContext
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};

    if (!workflow.outputs) {
      return outputs;
    }

    for (const output of workflow.outputs) {
      outputs[output.name] = this.resolveFieldValue(output.value, context);
    }

    return outputs;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Step execution timeout')), timeout)
      ),
    ]);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }
}

// Type-safe event emitter
export interface WorkflowEngine {
  on<E extends keyof WorkflowEngineEvents>(event: E, listener: WorkflowEngineEvents[E]): this;
  emit<E extends keyof WorkflowEngineEvents>(
    event: E,
    ...args: Parameters<WorkflowEngineEvents[E]>
  ): boolean;
}

/**
 * Create workflow engine
 */
export function createWorkflowEngine(config: WorkflowEngineConfig): WorkflowEngine {
  return new WorkflowEngine(config);
}
