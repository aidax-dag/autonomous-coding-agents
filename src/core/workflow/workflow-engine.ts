/**
 * Workflow Engine Module
 *
 * Executes workflow definitions by managing step execution,
 * state transitions, and coordination with agents.
 *
 * SOLID Principles:
 * - S: Engine focuses solely on workflow execution orchestration
 * - O: Extensible through step executors without modifying core engine
 * - L: All workflow instances follow the same execution contract
 * - I: Separate interfaces for execution, state, and events
 * - D: Depends on abstractions (IAgent, StepExecutor)
 *
 * @module core/workflow/workflow-engine
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import {
  WorkflowDefinition,
  StepDefinition,
  WorkflowStatus,
  StepStatus,
  StepType,
  ConditionExpression,
  ConditionOperator,
  RetryPolicy,
  LoopType,
} from './workflow-definition';
import { ITask, TaskPriority } from '../interfaces/agent.interface';
import { IAgentRegistry } from '../interfaces/agent.interface';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Workflow instance state
 */
export interface WorkflowInstance {
  id: string;
  workflowId: string;
  version: string;
  status: WorkflowStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  stepStates: Map<string, StepState>;
  startedAt: Date | null;
  completedAt: Date | null;
  error?: WorkflowError;
  metadata: Record<string, unknown>;
}

/**
 * Step execution state
 */
export interface StepState {
  stepId: string;
  status: StepStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: Date | null;
  completedAt: Date | null;
  retryCount: number;
  error?: StepError;
  loopContext?: LoopContext;
}

/**
 * Loop context for iterative steps
 */
export interface LoopContext {
  currentIndex: number;
  totalIterations: number;
  items?: unknown[];
  iterationResults: Record<string, unknown>[];
}

/**
 * Workflow error
 */
export interface WorkflowError {
  code: string;
  message: string;
  stepId?: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Step error
 */
export interface StepError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  recoverable: boolean;
}

/**
 * Workflow execution options
 */
export interface WorkflowExecutionOptions {
  timeout?: number;
  maxConcurrentSteps?: number;
  retryPolicy?: RetryPolicy;
  dryRun?: boolean;
  breakpoints?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Workflow engine configuration
 */
export interface WorkflowEngineConfig {
  maxConcurrentWorkflows: number;
  defaultStepTimeout: number;
  defaultWorkflowTimeout: number;
  enableMetrics: boolean;
  enableTracing: boolean;
}

/**
 * Workflow engine events
 */
export const WorkflowEngineEvents = {
  WORKFLOW_STARTED: 'workflow:started',
  WORKFLOW_COMPLETED: 'workflow:completed',
  WORKFLOW_FAILED: 'workflow:failed',
  WORKFLOW_PAUSED: 'workflow:paused',
  WORKFLOW_RESUMED: 'workflow:resumed',
  WORKFLOW_CANCELLED: 'workflow:cancelled',
  STEP_STARTED: 'step:started',
  STEP_COMPLETED: 'step:completed',
  STEP_FAILED: 'step:failed',
  STEP_SKIPPED: 'step:skipped',
  STEP_RETRYING: 'step:retrying',
} as const;

export type WorkflowEngineEventType = typeof WorkflowEngineEvents[keyof typeof WorkflowEngineEvents];

/**
 * Event payloads
 */
export interface WorkflowEventPayload {
  instanceId: string;
  workflowId: string;
  status: WorkflowStatus;
  timestamp: Date;
  error?: WorkflowError;
}

export interface StepEventPayload {
  instanceId: string;
  stepId: string;
  status: StepStatus;
  timestamp: Date;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: StepError;
  retryCount?: number;
}

/**
 * Workflow engine interface
 */
export interface IWorkflowEngine {
  execute(
    definition: WorkflowDefinition,
    inputs: Record<string, unknown>,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowInstance>;

  pause(instanceId: string): Promise<void>;
  resume(instanceId: string): Promise<void>;
  cancel(instanceId: string): Promise<void>;

  getInstance(instanceId: string): WorkflowInstance | undefined;
  getActiveInstances(): WorkflowInstance[];
  getStats(): WorkflowEngineStats;

  on(event: WorkflowEngineEventType, handler: (payload: WorkflowEventPayload | StepEventPayload) => void): void;
  off(event: WorkflowEngineEventType, handler: (payload: WorkflowEventPayload | StepEventPayload) => void): void;
}

/**
 * Workflow engine stats
 */
export interface WorkflowEngineStats {
  activeWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  totalExecutions: number;
  averageExecutionTime: number;
  uptime: number;
}

// ============================================================================
// Schemas
// ============================================================================

export const WorkflowExecutionOptionsSchema = z.object({
  timeout: z.number().int().min(1000).optional(),
  maxConcurrentSteps: z.number().int().min(1).max(100).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().int().min(1).max(10),
    initialDelay: z.number().int().min(100),
    maxDelay: z.number().int().min(1000),
    backoffMultiplier: z.number().min(1).max(5),
    retryableErrors: z.array(z.string()).optional(),
  }).optional(),
  dryRun: z.boolean().optional(),
  breakpoints: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const WorkflowEngineConfigSchema = z.object({
  maxConcurrentWorkflows: z.number().int().min(1).max(1000).default(100),
  defaultStepTimeout: z.number().int().min(1000).default(300000), // 5 minutes
  defaultWorkflowTimeout: z.number().int().min(1000).default(3600000), // 1 hour
  enableMetrics: z.boolean().default(true),
  enableTracing: z.boolean().default(false),
});

// ============================================================================
// Workflow Engine Implementation
// ============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Workflow Engine
 *
 * Executes workflow definitions by orchestrating step execution,
 * managing state, and coordinating with agents.
 */
export class WorkflowEngine implements IWorkflowEngine {
  private readonly config: WorkflowEngineConfig;
  private readonly agentRegistry: IAgentRegistry;
  private readonly eventEmitter: EventEmitter;
  private readonly instances: Map<string, WorkflowInstance>;
  private readonly executionPromises: Map<string, Promise<void>>;
  private readonly startTime: Date;

  private completedCount = 0;
  private failedCount = 0;
  private totalExecutionTime = 0;

  constructor(
    agentRegistry: IAgentRegistry,
    config?: Partial<WorkflowEngineConfig>
  ) {
    const validatedConfig = WorkflowEngineConfigSchema.parse(config ?? {});
    this.config = validatedConfig;
    this.agentRegistry = agentRegistry;
    this.eventEmitter = new EventEmitter();
    this.instances = new Map();
    this.executionPromises = new Map();
    this.startTime = new Date();
  }

  /**
   * Execute a workflow
   */
  async execute(
    definition: WorkflowDefinition,
    inputs: Record<string, unknown>,
    options?: WorkflowExecutionOptions
  ): Promise<WorkflowInstance> {
    // Validate options
    const validatedOptions = options
      ? WorkflowExecutionOptionsSchema.parse(options)
      : {};

    // Check concurrent workflow limit
    if (this.instances.size >= this.config.maxConcurrentWorkflows) {
      throw new Error(`Maximum concurrent workflows (${this.config.maxConcurrentWorkflows}) reached`);
    }

    // Create workflow instance
    const instance = this.createInstance(definition, inputs, validatedOptions);
    this.instances.set(instance.id, instance);

    // Start execution
    const executionPromise = this.executeWorkflow(instance, definition, validatedOptions);
    this.executionPromises.set(instance.id, executionPromise);

    // Wait for completion
    await executionPromise;

    return instance;
  }

  /**
   * Pause a running workflow
   */
  async pause(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    if (instance.status !== WorkflowStatus.RUNNING) {
      throw new Error(`Cannot pause workflow in status ${instance.status}`);
    }

    instance.status = WorkflowStatus.PAUSED;
    this.emitWorkflowEvent(WorkflowEngineEvents.WORKFLOW_PAUSED, instance);
  }

  /**
   * Resume a paused workflow
   */
  async resume(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    if (instance.status !== WorkflowStatus.PAUSED) {
      throw new Error(`Cannot resume workflow in status ${instance.status}`);
    }

    instance.status = WorkflowStatus.RUNNING;
    this.emitWorkflowEvent(WorkflowEngineEvents.WORKFLOW_RESUMED, instance);
  }

  /**
   * Cancel a running workflow
   */
  async cancel(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Workflow instance ${instanceId} not found`);
    }

    if (instance.status === WorkflowStatus.COMPLETED ||
        instance.status === WorkflowStatus.FAILED ||
        instance.status === WorkflowStatus.CANCELLED) {
      throw new Error(`Cannot cancel workflow in status ${instance.status}`);
    }

    instance.status = WorkflowStatus.CANCELLED;
    instance.completedAt = new Date();
    this.emitWorkflowEvent(WorkflowEngineEvents.WORKFLOW_CANCELLED, instance);
  }

  /**
   * Get workflow instance by ID
   */
  getInstance(instanceId: string): WorkflowInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all active workflow instances
   */
  getActiveInstances(): WorkflowInstance[] {
    return Array.from(this.instances.values()).filter(
      i => i.status === WorkflowStatus.RUNNING || i.status === WorkflowStatus.PAUSED
    );
  }

  /**
   * Get engine statistics
   */
  getStats(): WorkflowEngineStats {
    return {
      activeWorkflows: this.getActiveInstances().length,
      completedWorkflows: this.completedCount,
      failedWorkflows: this.failedCount,
      totalExecutions: this.completedCount + this.failedCount,
      averageExecutionTime: this.completedCount > 0
        ? this.totalExecutionTime / this.completedCount
        : 0,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Subscribe to events
   */
  on(
    event: WorkflowEngineEventType,
    handler: (payload: WorkflowEventPayload | StepEventPayload) => void
  ): void {
    this.eventEmitter.on(event, handler);
  }

  /**
   * Unsubscribe from events
   */
  off(
    event: WorkflowEngineEventType,
    handler: (payload: WorkflowEventPayload | StepEventPayload) => void
  ): void {
    this.eventEmitter.off(event, handler);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Create workflow instance
   */
  private createInstance(
    definition: WorkflowDefinition,
    inputs: Record<string, unknown>,
    options: WorkflowExecutionOptions
  ): WorkflowInstance {
    return {
      id: generateId(),
      workflowId: definition.id,
      version: definition.version,
      status: WorkflowStatus.PENDING,
      inputs,
      outputs: {},
      variables: { ...definition.variables },
      stepStates: new Map(),
      startedAt: null,
      completedAt: null,
      metadata: options.metadata ?? {},
    };
  }

  /**
   * Execute workflow
   */
  private async executeWorkflow(
    instance: WorkflowInstance,
    definition: WorkflowDefinition,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Start workflow
      instance.status = WorkflowStatus.RUNNING;
      instance.startedAt = new Date();
      this.emitWorkflowEvent(WorkflowEngineEvents.WORKFLOW_STARTED, instance);

      // Set timeout if specified
      const timeout = options.timeout ?? definition.timeout?.workflowTimeout ?? this.config.defaultWorkflowTimeout;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Workflow execution timeout')), timeout);
      });

      // Execute steps
      try {
        await Promise.race([
          this.executeSteps(instance, definition.steps, options),
          timeoutPromise,
        ]);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      // Complete workflow
      instance.status = WorkflowStatus.COMPLETED;
      instance.completedAt = new Date();
      this.completedCount++;
      this.totalExecutionTime += Date.now() - startTime;
      this.emitWorkflowEvent(WorkflowEngineEvents.WORKFLOW_COMPLETED, instance);

    } catch (error) {
      // Handle failure
      instance.status = WorkflowStatus.FAILED;
      instance.completedAt = new Date();
      instance.error = this.createWorkflowError(error);
      this.failedCount++;
      this.emitWorkflowEvent(WorkflowEngineEvents.WORKFLOW_FAILED, instance);
    }
  }

  /**
   * Execute steps in sequence (respecting dependencies)
   */
  private async executeSteps(
    instance: WorkflowInstance,
    steps: StepDefinition[],
    options: WorkflowExecutionOptions
  ): Promise<void> {
    // Build dependency graph and execution order
    const executionOrder = this.buildExecutionOrder(steps);

    for (const stepId of executionOrder) {
      // Check for pause/cancel
      if (instance.status === WorkflowStatus.PAUSED) {
        await this.waitForResume(instance);
      }
      if (instance.status === WorkflowStatus.CANCELLED) {
        return;
      }

      const step = steps.find(s => s.id === stepId);
      if (!step) continue;

      // Check dependencies
      if (step.dependsOn && step.dependsOn.length > 0) {
        const allDepsCompleted = step.dependsOn.every(depId => {
          const depState = instance.stepStates.get(depId);
          return depState?.status === StepStatus.COMPLETED;
        });

        if (!allDepsCompleted) {
          // Skip if dependencies not met (or failed)
          this.skipStep(instance, step, 'Dependencies not met');
          continue;
        }
      }

      // Check condition
      if (step.condition && !this.evaluateCondition(step.condition, instance)) {
        this.skipStep(instance, step, 'Condition not met');
        continue;
      }

      // Execute step
      await this.executeStep(instance, step, options);
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(
    instance: WorkflowInstance,
    step: StepDefinition,
    options: WorkflowExecutionOptions
  ): Promise<void> {
    // Initialize step state
    const stepState = this.initializeStepState(instance, step);

    try {
      // Emit step started
      this.emitStepEvent(WorkflowEngineEvents.STEP_STARTED, instance, stepState);

      // Resolve input mapping
      stepState.input = this.resolveInputMapping(step.inputMapping ?? {}, instance);

      // Execute based on step type
      const output = await this.executeStepByType(instance, step, stepState, options);

      // Apply output mapping
      stepState.output = output;
      if (step.outputMapping) {
        this.applyOutputMapping(step.outputMapping, output, instance);
      }

      // Complete step
      stepState.status = StepStatus.COMPLETED;
      stepState.completedAt = new Date();
      instance.stepStates.set(step.id, stepState);
      this.emitStepEvent(WorkflowEngineEvents.STEP_COMPLETED, instance, stepState);

    } catch (error) {
      // Handle step failure
      stepState.error = this.createStepError(error);

      // Check retry policy
      const retryPolicy = step.retry ?? options.retryPolicy;
      if (retryPolicy && stepState.retryCount < retryPolicy.maxAttempts) {
        stepState.retryCount++;
        this.emitStepEvent(WorkflowEngineEvents.STEP_RETRYING, instance, stepState);

        // Calculate delay with exponential backoff
        const delay = Math.min(
          retryPolicy.initialDelay * Math.pow(retryPolicy.backoffMultiplier, stepState.retryCount - 1),
          retryPolicy.maxDelay
        );
        await this.sleep(delay);

        // Retry
        return this.executeStep(instance, step, options);
      }

      // Step failed
      stepState.status = StepStatus.FAILED;
      stepState.completedAt = new Date();
      instance.stepStates.set(step.id, stepState);
      this.emitStepEvent(WorkflowEngineEvents.STEP_FAILED, instance, stepState);

      // Check error handling policy
      const errorPolicy = step.errorHandling ?? { onError: 'fail' };
      if (errorPolicy.onError === 'fail') {
        throw error;
      }
      // 'continue' - just continue with next steps
    }
  }

  /**
   * Execute step based on type
   */
  private async executeStepByType(
    instance: WorkflowInstance,
    step: StepDefinition,
    stepState: StepState,
    options: WorkflowExecutionOptions
  ): Promise<Record<string, unknown>> {
    switch (step.type) {
      case StepType.AGENT:
        return this.executeAgentStep(instance, step, stepState);

      case StepType.PARALLEL:
        return this.executeParallelStep(instance, step, stepState, options);

      case StepType.SEQUENTIAL:
        return this.executeSequentialStep(instance, step, stepState, options);

      case StepType.CONDITION:
        return this.executeConditionStep(instance, step, stepState, options);

      case StepType.LOOP:
        return this.executeLoopStep(instance, step, stepState, options);

      case StepType.WAIT:
        return this.executeWaitStep(instance, step, stepState);

      case StepType.TRANSFORM:
        return this.executeTransformStep(instance, step, stepState);

      case StepType.APPROVAL:
        return this.executeApprovalStep(instance, step, stepState);

      case StepType.SUBWORKFLOW:
        return this.executeSubworkflowStep(instance, step, stepState, options);

      default:
        throw new Error(`Unknown step type: ${(step as StepDefinition).type}`);
    }
  }

  /**
   * Execute agent step
   */
  private async executeAgentStep(
    instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.AGENT },
    _stepState: StepState
  ): Promise<Record<string, unknown>> {
    const { agentType, taskType, payload, priority } = step.config;

    // Find available agent
    const agents = this.agentRegistry.getByType(agentType);
    if (agents.length === 0) {
      throw new Error(`No agent available for type: ${agentType}`);
    }

    // Select first available agent (could be enhanced with load balancing)
    const agent = agents[0];

    // Create task
    const task: ITask = {
      id: generateId(),
      type: taskType,
      agentType: agentType,
      priority: priority ?? TaskPriority.NORMAL,
      payload: this.resolveVariables(payload, instance),
      createdAt: new Date(),
      metadata: {
        workflowInstanceId: instance.id,
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
   * Execute parallel step
   */
  private async executeParallelStep(
    instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.PARALLEL },
    _stepState: StepState,
    options: WorkflowExecutionOptions
  ): Promise<Record<string, unknown>> {
    const { steps: subSteps, maxConcurrency, failFast } = step.config;

    // Limit concurrency
    const concurrency = maxConcurrency ?? options.maxConcurrentSteps ?? 10;
    const results: Record<string, Record<string, unknown>> = {};

    // Execute in batches
    for (let i = 0; i < subSteps.length; i += concurrency) {
      const batch = subSteps.slice(i, i + concurrency);

      const batchPromises = batch.map(async (subStep) => {
        try {
          await this.executeStep(instance, subStep, options);
          const state = instance.stepStates.get(subStep.id);
          results[subStep.id] = state?.output ?? {};
        } catch (error) {
          if (failFast) {
            throw error;
          }
          results[subStep.id] = { error: (error as Error).message };
        }
      });

      await Promise.all(batchPromises);
    }

    return { results };
  }

  /**
   * Execute sequential step
   */
  private async executeSequentialStep(
    instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.SEQUENTIAL },
    _stepState: StepState,
    options: WorkflowExecutionOptions
  ): Promise<Record<string, unknown>> {
    const { steps: subSteps, stopOnError } = step.config;
    const results: Record<string, Record<string, unknown>> = {};

    for (const subStep of subSteps) {
      try {
        await this.executeStep(instance, subStep, options);
        const state = instance.stepStates.get(subStep.id);
        results[subStep.id] = state?.output ?? {};
      } catch (error) {
        results[subStep.id] = { error: (error as Error).message };
        if (stopOnError) {
          throw error;
        }
      }
    }

    return { results };
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(
    instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.CONDITION },
    _stepState: StepState,
    options: WorkflowExecutionOptions
  ): Promise<Record<string, unknown>> {
    const { condition, thenSteps, elseSteps } = step.config;

    const conditionResult = this.evaluateCondition(condition, instance);
    const stepsToExecute = conditionResult ? thenSteps : (elseSteps ?? []);

    const results: Record<string, Record<string, unknown>> = {};
    for (const subStep of stepsToExecute) {
      await this.executeStep(instance, subStep, options);
      const state = instance.stepStates.get(subStep.id);
      results[subStep.id] = state?.output ?? {};
    }

    return { branch: conditionResult ? 'then' : 'else', results };
  }

  /**
   * Execute loop step
   */
  private async executeLoopStep(
    instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.LOOP },
    stepState: StepState,
    options: WorkflowExecutionOptions
  ): Promise<Record<string, unknown>> {
    const { loopType, steps: subSteps, items, condition, count, maxIterations, itemVariable, indexVariable } = step.config;

    const iterationResults: Record<string, unknown>[] = [];
    let iterationIndex = 0;
    let itemsArray: unknown[] = [];

    // Determine iteration source
    if (loopType === LoopType.FOR_EACH && items) {
      const resolvedItems = this.resolveVariable(items, instance);
      if (!Array.isArray(resolvedItems)) {
        throw new Error(`Loop items must be an array, got: ${typeof resolvedItems}`);
      }
      itemsArray = resolvedItems;
    } else if (loopType === LoopType.COUNT && count) {
      itemsArray = Array.from({ length: count }, (_, i) => i);
    }

    // Initialize loop context
    stepState.loopContext = {
      currentIndex: 0,
      totalIterations: itemsArray.length || maxIterations,
      items: itemsArray,
      iterationResults: [],
    };

    // Execute loop
    while (iterationIndex < maxIterations) {
      // Check loop condition
      if (loopType === LoopType.FOR_EACH && iterationIndex >= itemsArray.length) {
        break;
      }

      if (loopType === LoopType.WHILE && condition && !this.evaluateCondition(condition, instance)) {
        break;
      }

      if (loopType === LoopType.UNTIL && condition && this.evaluateCondition(condition, instance)) {
        break;
      }

      // Set loop variables
      instance.variables[indexVariable] = iterationIndex;
      if (loopType === LoopType.FOR_EACH) {
        instance.variables[itemVariable] = itemsArray[iterationIndex];
      }

      // Update loop context
      stepState.loopContext.currentIndex = iterationIndex;

      // Execute iteration steps
      const iterationOutput: Record<string, unknown> = {};
      for (const subStep of subSteps) {
        await this.executeStep(instance, subStep, options);
        const state = instance.stepStates.get(subStep.id);
        iterationOutput[subStep.id] = state?.output ?? {};
      }

      iterationResults.push(iterationOutput);
      stepState.loopContext.iterationResults = iterationResults;
      iterationIndex++;
    }

    // Clean up loop variables
    delete instance.variables[indexVariable];
    delete instance.variables[itemVariable];

    return { iterations: iterationResults, totalIterations: iterationIndex };
  }

  /**
   * Execute wait step
   */
  private async executeWaitStep(
    instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.WAIT },
    _stepState: StepState
  ): Promise<Record<string, unknown>> {
    const { waitType, duration, condition, pollInterval, maxWait } = step.config;

    const startTime = Date.now();

    switch (waitType) {
      case 'duration':
        if (duration) {
          await this.sleep(duration);
        }
        break;

      case 'condition':
        if (condition) {
          while (!this.evaluateCondition(condition, instance)) {
            if (maxWait && Date.now() - startTime > maxWait) {
              throw new Error('Wait condition timeout');
            }
            await this.sleep(pollInterval);
          }
        }
        break;

      default:
        // 'until' and 'event' would need external coordination
        throw new Error(`Wait type ${waitType} not yet implemented`);
    }

    return { waitedMs: Date.now() - startTime };
  }

  /**
   * Execute transform step
   */
  private executeTransformStep(
    instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.TRANSFORM },
    _stepState: StepState
  ): Record<string, unknown> {
    const { transformations } = step.config;
    const result: Record<string, unknown> = {};

    for (const transform of transformations) {
      const sourceValue = this.resolveVariable(transform.source, instance);
      let targetValue = sourceValue ?? transform.defaultValue;

      // Apply expression if provided (simplified - could use a proper expression parser)
      if (transform.expression && sourceValue !== undefined) {
        // For now, just use the source value
        // A real implementation would evaluate the expression
        targetValue = sourceValue;
      }

      result[transform.target] = targetValue;
      // Also set in instance variables
      instance.variables[transform.target] = targetValue;
    }

    return result;
  }

  /**
   * Execute approval step (simplified - needs external approval mechanism)
   */
  private async executeApprovalStep(
    _instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.APPROVAL },
    _stepState: StepState
  ): Promise<Record<string, unknown>> {
    // In a real implementation, this would integrate with an approval system
    // For now, auto-approve after a delay to simulate the approval flow
    const { timeout } = step.config;

    // Simulate approval wait (in real implementation, this would be event-driven)
    await this.sleep(Math.min(timeout ?? 1000, 5000));

    return {
      approved: true,
      approvedBy: 'system',
      approvedAt: new Date().toISOString(),
    };
  }

  /**
   * Execute subworkflow step
   */
  private async executeSubworkflowStep(
    _instance: WorkflowInstance,
    step: StepDefinition & { type: typeof StepType.SUBWORKFLOW },
    _stepState: StepState,
    _options: WorkflowExecutionOptions
  ): Promise<Record<string, unknown>> {
    // In a real implementation, this would:
    // 1. Load the subworkflow definition by ID
    // 2. Execute it with the mapped inputs
    // 3. Return the mapped outputs

    // For now, return a placeholder
    return {
      subworkflowId: step.config.workflowId,
      status: 'not_implemented',
      message: 'Subworkflow execution requires workflow repository integration',
    };
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Build execution order respecting dependencies
   */
  private buildExecutionOrder(steps: StepDefinition[]): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (stepId: string): void => {
      if (visited.has(stepId)) return;
      if (visiting.has(stepId)) {
        throw new Error(`Circular dependency detected involving step: ${stepId}`);
      }

      visiting.add(stepId);

      const step = steps.find(s => s.id === stepId);
      if (step?.dependsOn) {
        for (const depId of step.dependsOn) {
          visit(depId);
        }
      }

      visiting.delete(stepId);
      visited.add(stepId);
      order.push(stepId);
    };

    for (const step of steps) {
      visit(step.id);
    }

    return order;
  }

  /**
   * Initialize step state
   */
  private initializeStepState(instance: WorkflowInstance, step: StepDefinition): StepState {
    const state: StepState = {
      stepId: step.id,
      status: StepStatus.RUNNING,
      input: {},
      output: {},
      startedAt: new Date(),
      completedAt: null,
      retryCount: 0,
    };

    instance.stepStates.set(step.id, state);
    return state;
  }

  /**
   * Skip a step
   */
  private skipStep(instance: WorkflowInstance, step: StepDefinition, reason: string): void {
    const state: StepState = {
      stepId: step.id,
      status: StepStatus.SKIPPED,
      input: {},
      output: { skipReason: reason },
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
    };

    instance.stepStates.set(step.id, state);
    this.emitStepEvent(WorkflowEngineEvents.STEP_SKIPPED, instance, state);
  }

  /**
   * Evaluate condition expression
   */
  private evaluateCondition(condition: ConditionExpression, instance: WorkflowInstance): boolean {
    if ('conditions' in condition) {
      // AND or OR condition
      const results = condition.conditions.map(c => this.evaluateCondition(c, instance));
      return condition.operator === ConditionOperator.AND
        ? results.every(r => r)
        : results.some(r => r);
    }

    if ('condition' in condition) {
      // NOT condition
      return !this.evaluateCondition(condition.condition, instance);
    }

    // Simple comparison
    const left = this.resolveVariableValue(condition.left, instance);
    const right = condition.right !== undefined
      ? this.resolveVariableValue(condition.right, instance)
      : undefined;

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return left === right;
      case ConditionOperator.NOT_EQUALS:
        return left !== right;
      case ConditionOperator.GREATER_THAN:
        return (left as number) > (right as number);
      case ConditionOperator.GREATER_THAN_OR_EQUALS:
        return (left as number) >= (right as number);
      case ConditionOperator.LESS_THAN:
        return (left as number) < (right as number);
      case ConditionOperator.LESS_THAN_OR_EQUALS:
        return (left as number) <= (right as number);
      case ConditionOperator.CONTAINS:
        return String(left).includes(String(right));
      case ConditionOperator.NOT_CONTAINS:
        return !String(left).includes(String(right));
      case ConditionOperator.STARTS_WITH:
        return String(left).startsWith(String(right));
      case ConditionOperator.ENDS_WITH:
        return String(left).endsWith(String(right));
      case ConditionOperator.MATCHES:
        return new RegExp(String(right)).test(String(left));
      case ConditionOperator.IS_NULL:
        return left === null || left === undefined;
      case ConditionOperator.IS_NOT_NULL:
        return left !== null && left !== undefined;
      case ConditionOperator.IN:
        return Array.isArray(right) && right.includes(left);
      case ConditionOperator.NOT_IN:
        return Array.isArray(right) && !right.includes(left);
      default:
        return false;
    }
  }

  /**
   * Resolve variable value (handles variable references)
   */
  private resolveVariableValue(
    value: string | number | boolean | null | unknown[],
    instance: WorkflowInstance
  ): unknown {
    if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
      return this.resolveVariable(value, instance);
    }
    return value;
  }

  /**
   * Resolve a variable reference
   */
  private resolveVariable(ref: string, instance: WorkflowInstance): unknown {
    // Remove ${ and }
    const path = ref.replace(/^\$\{/, '').replace(/\}$/, '');
    const parts = path.split('.');

    // Build context object with all resolution sources
    const context: Record<string, unknown> = {
      inputs: instance.inputs,
      outputs: instance.outputs,
      variables: instance.variables,
      steps: this.getStepOutputs(instance),
    };

    // For single-part paths, check variables first (for loop variables like 'item', 'index')
    if (parts.length === 1 && instance.variables[parts[0]] !== undefined) {
      return instance.variables[parts[0]];
    }

    let current: unknown = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Get step outputs as a map
   */
  private getStepOutputs(instance: WorkflowInstance): Record<string, Record<string, unknown>> {
    const outputs: Record<string, Record<string, unknown>> = {};
    for (const [stepId, state] of instance.stepStates) {
      outputs[stepId] = { output: state.output, status: state.status };
    }
    return outputs;
  }

  /**
   * Resolve input mapping
   */
  private resolveInputMapping(
    mapping: Record<string, unknown>,
    instance: WorkflowInstance
  ): Record<string, unknown> {
    return this.resolveVariables(mapping, instance);
  }

  /**
   * Resolve variables in an object
   */
  private resolveVariables(
    obj: Record<string, unknown>,
    instance: WorkflowInstance
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        result[key] = this.resolveVariable(value, instance);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        result[key] = this.resolveVariables(value as Record<string, unknown>, instance);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Apply output mapping
   */
  private applyOutputMapping(
    mapping: Record<string, string>,
    output: Record<string, unknown>,
    instance: WorkflowInstance
  ): void {
    for (const [targetPath, sourcePath] of Object.entries(mapping)) {
      const value = this.getNestedValue(output, sourcePath);
      this.setNestedValue(instance.outputs, targetPath, value);
    }
  }

  /**
   * Get nested value from object
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Set nested value in object
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Wait for workflow to resume
   */
  private async waitForResume(instance: WorkflowInstance): Promise<void> {
    while (instance.status === WorkflowStatus.PAUSED) {
      await this.sleep(100);
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create workflow error
   */
  private createWorkflowError(error: unknown): WorkflowError {
    if (error instanceof Error) {
      return {
        code: 'WORKFLOW_ERROR',
        message: error.message,
        stack: error.stack,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
    };
  }

  /**
   * Create step error
   */
  private createStepError(error: unknown): StepError {
    if (error instanceof Error) {
      return {
        code: 'STEP_ERROR',
        message: error.message,
        stack: error.stack,
        recoverable: true,
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      recoverable: false,
    };
  }

  /**
   * Emit workflow event
   */
  private emitWorkflowEvent(event: WorkflowEngineEventType, instance: WorkflowInstance): void {
    const payload: WorkflowEventPayload = {
      instanceId: instance.id,
      workflowId: instance.workflowId,
      status: instance.status,
      timestamp: new Date(),
      error: instance.error,
    };
    this.eventEmitter.emit(event, payload);
  }

  /**
   * Emit step event
   */
  private emitStepEvent(
    event: WorkflowEngineEventType,
    instance: WorkflowInstance,
    stepState: StepState
  ): void {
    const payload: StepEventPayload = {
      instanceId: instance.id,
      stepId: stepState.stepId,
      status: stepState.status,
      timestamp: new Date(),
      input: stepState.input,
      output: stepState.output,
      error: stepState.error,
      retryCount: stepState.retryCount,
    };
    this.eventEmitter.emit(event, payload);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a workflow engine instance
 */
export function createWorkflowEngine(
  agentRegistry: IAgentRegistry,
  config?: Partial<WorkflowEngineConfig>
): WorkflowEngine {
  return new WorkflowEngine(agentRegistry, config);
}
