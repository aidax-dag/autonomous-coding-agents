/**
 * Step Executor
 *
 * Handles individual step execution with retry logic, timeout handling,
 * and lifecycle hooks.
 *
 * @module core/workflow/step-executor
 */

import { z } from 'zod';
import {
  StepDefinition,
  StepType,
  RetryPolicy,
  AgentStep,
} from './workflow-definition';
import { ITask, TaskPriority } from '../interfaces/agent.interface';
import { IAgentRegistry } from '../interfaces/agent.interface';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Retry strategy types
 */
export enum RetryStrategy {
  FIXED = 'fixed',
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
}

/**
 * Step execution context
 */
export interface StepExecutionContext {
  workflowInstanceId: string;
  stepId: string;
  inputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  stepOutputs: Record<string, Record<string, unknown>>;
  loopContext?: LoopExecutionContext;
  parentStepId?: string;
  executionDepth: number;
}

/**
 * Loop execution context
 */
export interface LoopExecutionContext {
  currentIndex: number;
  totalIterations: number;
  currentItem?: unknown;
  items?: unknown[];
}

/**
 * Step execution result
 */
export interface StepExecutionResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: StepExecutionError;
  duration: number;
  retryCount: number;
  skipped: boolean;
  skipReason?: string;
}

/**
 * Step execution error
 */
export interface StepExecutionError {
  code: string;
  message: string;
  details?: unknown;
  recoverable: boolean;
  retryable: boolean;
}

/**
 * Step hook function type
 */
export type StepHookFn = (
  step: StepDefinition,
  context: StepExecutionContext
) => Promise<void>;

/**
 * Step executor configuration
 */
export interface StepExecutorConfig {
  defaultTimeout: number;
  defaultRetryPolicy: RetryPolicy;
  maxExecutionDepth: number;
  hooks?: {
    beforeStep?: StepHookFn;
    afterStep?: StepHookFn;
    onStepError?: (step: StepDefinition, error: StepExecutionError, context: StepExecutionContext) => Promise<void>;
    onStepRetry?: (step: StepDefinition, retryCount: number, context: StepExecutionContext) => Promise<void>;
  };
}

/**
 * Step executor events
 */
export const StepExecutorEvents = {
  STEP_STARTING: 'step:starting',
  STEP_COMPLETED: 'step:completed',
  STEP_FAILED: 'step:failed',
  STEP_RETRYING: 'step:retrying',
  STEP_TIMEOUT: 'step:timeout',
  STEP_SKIPPED: 'step:skipped',
} as const;

export type StepExecutorEventType = typeof StepExecutorEvents[keyof typeof StepExecutorEvents];

/**
 * Step event payload
 */
export interface StepEventPayload {
  step: StepDefinition;
  context: StepExecutionContext;
  result?: StepExecutionResult;
  error?: StepExecutionError;
  retryCount?: number;
}

// ============================================================================
// Schemas
// ============================================================================

export const StepExecutorConfigSchema = z.object({
  defaultTimeout: z.number().int().min(1000).default(30000),
  defaultRetryPolicy: z.object({
    maxAttempts: z.number().int().min(1).max(10).default(3),
    initialDelay: z.number().int().min(100).default(1000),
    maxDelay: z.number().int().min(1000).default(30000),
    backoffMultiplier: z.number().min(1).max(5).default(2),
    retryableErrors: z.array(z.string()).optional(),
  }),
  maxExecutionDepth: z.number().int().min(1).max(20).default(10),
});

// ============================================================================
// Step Executor Interface
// ============================================================================

/**
 * Step executor interface
 */
export interface IStepExecutor {
  execute(step: StepDefinition, context: StepExecutionContext): Promise<StepExecutionResult>;
  executeWithTimeout(step: StepDefinition, context: StepExecutionContext, timeout: number): Promise<StepExecutionResult>;
  calculateRetryDelay(retryCount: number, policy: RetryPolicy, strategy?: RetryStrategy): number;
  shouldRetry(error: StepExecutionError, retryCount: number, policy: RetryPolicy): boolean;
  on(event: StepExecutorEventType, handler: (payload: StepEventPayload) => void): void;
  off(event: StepExecutorEventType, handler: (payload: StepEventPayload) => void): void;
}

// ============================================================================
// Step Executor Implementation
// ============================================================================

/**
 * Step executor implementation
 */
export class StepExecutor implements IStepExecutor {
  private readonly config: StepExecutorConfig;
  private readonly agentRegistry: IAgentRegistry;
  private readonly eventHandlers: Map<StepExecutorEventType, Set<(payload: StepEventPayload) => void>>;

  constructor(agentRegistry: IAgentRegistry, config?: Partial<StepExecutorConfig>) {
    this.agentRegistry = agentRegistry;
    this.config = {
      defaultTimeout: config?.defaultTimeout ?? 30000,
      defaultRetryPolicy: config?.defaultRetryPolicy ?? {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
      },
      maxExecutionDepth: config?.maxExecutionDepth ?? 10,
      hooks: config?.hooks,
    };
    this.eventHandlers = new Map();
  }

  /**
   * Execute a step
   */
  async execute(step: StepDefinition, context: StepExecutionContext): Promise<StepExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;

    // Check execution depth
    if (context.executionDepth > this.config.maxExecutionDepth) {
      return this.createFailedResult(
        startTime,
        retryCount,
        {
          code: 'MAX_DEPTH_EXCEEDED',
          message: `Maximum execution depth (${this.config.maxExecutionDepth}) exceeded`,
          recoverable: false,
          retryable: false,
        }
      );
    }

    // Get timeout
    const timeout = step.timeout ?? this.config.defaultTimeout;

    // Execute with timeout
    return this.executeWithTimeout(step, context, timeout);
  }

  /**
   * Execute a step with timeout
   */
  async executeWithTimeout(
    step: StepDefinition,
    context: StepExecutionContext,
    timeout: number
  ): Promise<StepExecutionResult> {
    const startTime = Date.now();
    let retryCount = 0;
    const retryPolicy = step.retry ?? this.config.defaultRetryPolicy;

    // Call before hook
    if (this.config.hooks?.beforeStep) {
      await this.config.hooks.beforeStep(step, context);
    }

    // Emit starting event
    this.emit(StepExecutorEvents.STEP_STARTING, { step, context });

    while (true) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Step execution timed out after ${timeout}ms`));
          }, timeout);
        });

        // Execute step with timeout race
        const output = await Promise.race([
          this.executeStepByType(step, context),
          timeoutPromise,
        ]);

        const result: StepExecutionResult = {
          success: true,
          output,
          duration: Date.now() - startTime,
          retryCount,
          skipped: false,
        };

        // Call after hook
        if (this.config.hooks?.afterStep) {
          await this.config.hooks.afterStep(step, context);
        }

        // Emit completed event
        this.emit(StepExecutorEvents.STEP_COMPLETED, { step, context, result });

        return result;

      } catch (error) {
        const stepError = this.createStepError(error);

        // Check if should retry
        if (this.shouldRetry(stepError, retryCount, retryPolicy)) {
          retryCount++;

          // Call retry hook
          if (this.config.hooks?.onStepRetry) {
            await this.config.hooks.onStepRetry(step, retryCount, context);
          }

          // Emit retrying event
          this.emit(StepExecutorEvents.STEP_RETRYING, { step, context, retryCount });

          // Wait before retry
          const delay = this.calculateRetryDelay(retryCount, retryPolicy);
          await this.sleep(delay);

          continue;
        }

        // Call error hook
        if (this.config.hooks?.onStepError) {
          await this.config.hooks.onStepError(step, stepError, context);
        }

        // Emit failed event
        this.emit(StepExecutorEvents.STEP_FAILED, { step, context, error: stepError });

        return this.createFailedResult(startTime, retryCount, stepError);
      }
    }
  }

  /**
   * Execute step by type
   */
  private async executeStepByType(
    step: StepDefinition,
    context: StepExecutionContext
  ): Promise<Record<string, unknown>> {
    switch (step.type) {
      case StepType.AGENT:
        return this.executeAgentStep(step as AgentStep, context);

      case StepType.TRANSFORM:
        return this.executeTransformStep(step, context);

      case StepType.WAIT:
        return this.executeWaitStep(step, context);

      case StepType.APPROVAL:
        return this.executeApprovalStep(step, context);

      case StepType.PARALLEL:
      case StepType.SEQUENTIAL:
      case StepType.CONDITION:
      case StepType.LOOP:
      case StepType.SUBWORKFLOW:
        // These are composite steps handled by WorkflowEngine
        throw new Error(`Composite step type ${step.type} should be handled by WorkflowEngine`);

      default:
        throw new Error(`Unknown step type: ${(step as StepDefinition).type}`);
    }
  }

  /**
   * Execute agent step
   */
  private async executeAgentStep(
    step: AgentStep,
    context: StepExecutionContext
  ): Promise<Record<string, unknown>> {
    const { agentType, taskType, payload, priority } = step.config;

    // Get agent
    const agents = this.agentRegistry.getByType(agentType);
    if (!agents || agents.length === 0) {
      throw new Error(`No agent found for type: ${agentType}`);
    }
    const agent = agents[0];

    // Create task
    const task: ITask = {
      id: `task-${context.workflowInstanceId}-${step.id}-${Date.now()}`,
      type: taskType,
      agentType: agentType,
      priority: priority ?? TaskPriority.NORMAL,
      payload: this.resolveVariables(payload, context),
      createdAt: new Date(),
      metadata: {
        workflowInstanceId: context.workflowInstanceId,
        stepId: step.id,
      },
    };

    // Execute task
    const result = await agent.processTask(task);

    if (!result.success) {
      throw new Error(result.error?.message ?? 'Agent task failed');
    }

    return result.data ?? {};
  }

  /**
   * Execute transform step
   */
  private async executeTransformStep(
    step: StepDefinition & { type: typeof StepType.TRANSFORM },
    context: StepExecutionContext
  ): Promise<Record<string, unknown>> {
    const { transformations } = step.config;
    const result: Record<string, unknown> = {};

    for (const transform of transformations) {
      const sourceValue = this.resolveVariable(transform.source, context);
      let targetValue = sourceValue ?? transform.defaultValue;

      // Apply expression if provided
      if (transform.expression && sourceValue !== undefined) {
        targetValue = this.evaluateExpression(transform.expression, sourceValue, context);
      }

      result[transform.target] = targetValue;
    }

    return result;
  }

  /**
   * Execute wait step
   */
  private async executeWaitStep(
    step: StepDefinition & { type: typeof StepType.WAIT },
    context: StepExecutionContext
  ): Promise<Record<string, unknown>> {
    const { waitType, duration, condition, pollInterval = 1000, maxWait } = step.config;
    const startTime = Date.now();

    switch (waitType) {
      case 'duration':
        if (duration) {
          await this.sleep(duration);
        }
        break;

      case 'condition':
        if (condition) {
          while (!this.evaluateConditionSimple(condition, context)) {
            if (maxWait && Date.now() - startTime > maxWait) {
              throw new Error('Wait condition timeout');
            }
            await this.sleep(pollInterval);
          }
        }
        break;

      case 'event':
        // Event-based waiting would require external event handling
        throw new Error('Event-based waiting not implemented in StepExecutor');
    }

    return { waitedMs: Date.now() - startTime };
  }

  /**
   * Execute approval step
   */
  private async executeApprovalStep(
    step: StepDefinition & { type: typeof StepType.APPROVAL },
    _context: StepExecutionContext
  ): Promise<Record<string, unknown>> {
    const { approvers, timeout: approvalTimeout, requiredApprovals } = step.config;

    // In a real implementation, this would wait for approval
    // For now, we'll auto-approve after a short delay
    await this.sleep(100);

    return {
      approved: true,
      approvers,
      requiredApprovals,
      approvalTimeout,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate retry delay based on strategy
   */
  calculateRetryDelay(
    retryCount: number,
    policy: RetryPolicy,
    strategy: RetryStrategy = RetryStrategy.EXPONENTIAL
  ): number {
    let delay: number;

    switch (strategy) {
      case RetryStrategy.FIXED:
        delay = policy.initialDelay;
        break;

      case RetryStrategy.LINEAR:
        delay = policy.initialDelay * retryCount;
        break;

      case RetryStrategy.EXPONENTIAL:
      default:
        delay = policy.initialDelay * Math.pow(policy.backoffMultiplier, retryCount - 1);
        break;
    }

    // Apply jitter (±10%)
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    delay = Math.round(delay + jitter);

    // Clamp to max delay
    return Math.min(delay, policy.maxDelay);
  }

  /**
   * Determine if step should be retried
   */
  shouldRetry(error: StepExecutionError, retryCount: number, policy: RetryPolicy): boolean {
    // Check max attempts
    if (retryCount >= policy.maxAttempts) {
      return false;
    }

    // Check if error is retryable
    if (!error.retryable) {
      return false;
    }

    // Check retryable error codes if specified
    if (policy.retryableErrors && policy.retryableErrors.length > 0) {
      return policy.retryableErrors.includes(error.code);
    }

    return true;
  }

  /**
   * Subscribe to events
   */
  on(event: StepExecutorEventType, handler: (payload: StepEventPayload) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
  off(event: StepExecutorEventType, handler: (payload: StepEventPayload) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Emit event
   */
  private emit(event: StepExecutorEventType, payload: StepEventPayload): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (error) {
          // Ignore handler errors
        }
      }
    }
  }

  /**
   * Create step error from unknown error
   */
  private createStepError(error: unknown): StepExecutionError {
    if (error instanceof Error) {
      const isTimeout = error.message.includes('timed out');
      const isNetworkError = error.message.includes('network') || error.message.includes('ECONNREFUSED');

      return {
        code: isTimeout ? 'TIMEOUT' : isNetworkError ? 'NETWORK_ERROR' : 'EXECUTION_ERROR',
        message: error.message,
        details: error.stack,
        recoverable: !isTimeout,
        retryable: isNetworkError || !isTimeout,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      recoverable: false,
      retryable: false,
    };
  }

  /**
   * Create failed result
   */
  private createFailedResult(
    startTime: number,
    retryCount: number,
    error: StepExecutionError
  ): StepExecutionResult {
    return {
      success: false,
      output: {},
      error,
      duration: Date.now() - startTime,
      retryCount,
      skipped: false,
    };
  }

  /**
   * Create skipped result
   */
  createSkippedResult(reason: string): StepExecutionResult {
    return {
      success: true,
      output: {},
      duration: 0,
      retryCount: 0,
      skipped: true,
      skipReason: reason,
    };
  }

  /**
   * Resolve variables in an object
   */
  private resolveVariables(
    obj: Record<string, unknown>,
    context: StepExecutionContext
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        result[key] = this.resolveVariable(value, context);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.resolveVariables(value as Record<string, unknown>, context);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Resolve a single variable reference
   */
  private resolveVariable(ref: string, context: StepExecutionContext): unknown {
    // Remove ${ and }
    const path = ref.replace(/^\$\{/, '').replace(/\}$/, '');
    const parts = path.split('.');

    // Build resolution context
    const resolutionContext: Record<string, unknown> = {
      inputs: context.inputs,
      variables: context.variables,
      steps: context.stepOutputs,
    };

    // For single-part paths, check variables first (for loop variables)
    if (parts.length === 1 && context.variables[parts[0]] !== undefined) {
      return context.variables[parts[0]];
    }

    let current: unknown = resolutionContext;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Evaluate a simple expression
   */
  private evaluateExpression(
    _expression: string,
    value: unknown,
    _context: StepExecutionContext
  ): unknown {
    // Simple expression evaluation (extend as needed)
    // For now, just return the value
    // A real implementation would parse and evaluate the expression
    return value;
  }

  /**
   * Evaluate a simple condition
   */
  private evaluateConditionSimple(
    condition: unknown,
    context: StepExecutionContext
  ): boolean {
    if (typeof condition === 'boolean') {
      return condition;
    }

    if (typeof condition === 'string') {
      const resolved = this.resolveVariable(condition, context);
      return Boolean(resolved);
    }

    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a step executor instance
 */
export function createStepExecutor(
  agentRegistry: IAgentRegistry,
  config?: Partial<StepExecutorConfig>
): StepExecutor {
  return new StepExecutor(agentRegistry, config);
}
