/**
 * Custom Workflows Manager Implementation
 *
 * Feature: F5.14 - Custom Workflows
 * Provides workflow builder, execution engine, and workflow templates
 *
 * @module core/enterprise/workflow
 */

import { randomUUID } from 'crypto';
import type {
  ICustomWorkflowsManager,
  WorkflowDefinition,
  WorkflowStatus,
  WorkflowStep,
  WorkflowTrigger,
  WorkflowExecution,
  ExecutionStatus,
  StepExecution,
  WorkflowTemplate,
  TemplateVariable,
  WorkflowEvent,
  WorkflowEventType,
  CreateWorkflowRequest,
  ExecuteWorkflowRequest,
  CreateFromTemplateRequest,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ExecutionContext,
  ExecutionError,
} from './workflow.interface.js';
import { BUILTIN_ACTION_TYPES } from './workflow.interface.js';

/**
 * Custom Workflows Manager implementation
 */
export class CustomWorkflowsManager implements ICustomWorkflowsManager {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  private eventHandlers: Set<(event: WorkflowEvent) => void> = new Set();
  private disposed = false;

  constructor() {
    this.initializeBuiltInTemplates();
  }

  // ==================== Workflow CRUD ====================

  async createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const now = new Date();
    const workflow: WorkflowDefinition = {
      id: randomUUID(),
      name: request.name,
      description: request.description,
      teamId: request.teamId,
      status: 'draft',
      version: 1,
      triggers: request.triggers || [],
      steps: request.steps || [],
      inputSchema: request.inputSchema,
      outputSchema: request.outputSchema,
      variables: request.variables || {},
      tags: request.tags || [],
      createdBy: request.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(workflow.id, workflow);

    this.emitEvent('workflow.created', workflow.id, undefined, { workflow });

    return workflow;
  }

  async getWorkflow(workflowId: string): Promise<WorkflowDefinition | undefined> {
    this.ensureNotDisposed();
    return this.workflows.get(workflowId);
  }

  async updateWorkflow(
    workflowId: string,
    updates: Partial<WorkflowDefinition>
  ): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const updatedWorkflow: WorkflowDefinition = {
      ...workflow,
      ...updates,
      id: workflow.id, // Prevent ID change
      teamId: workflow.teamId, // Prevent team change
      createdBy: workflow.createdBy, // Prevent creator change
      createdAt: workflow.createdAt, // Prevent creation date change
      version: workflow.version + 1,
      updatedAt: new Date(),
    };

    this.workflows.set(workflowId, updatedWorkflow);

    this.emitEvent('workflow.updated', workflowId, undefined, { workflow: updatedWorkflow });

    return updatedWorkflow;
  }

  async deleteWorkflow(workflowId: string): Promise<boolean> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    this.workflows.delete(workflowId);

    this.emitEvent('workflow.deleted', workflowId, undefined, { workflowId });

    return true;
  }

  async getWorkflows(teamId: string, status?: WorkflowStatus): Promise<WorkflowDefinition[]> {
    this.ensureNotDisposed();

    let workflows = Array.from(this.workflows.values()).filter((w) => w.teamId === teamId);

    if (status !== undefined) {
      workflows = workflows.filter((w) => w.status === status);
    }

    return workflows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  // ==================== Workflow Lifecycle ====================

  async activateWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Validate before activation
    const validation = await this.validateWorkflow(workflow);
    if (!validation.valid) {
      throw new Error(`Cannot activate workflow: ${validation.errors.map((e) => e.message).join(', ')}`);
    }

    const updated = await this.updateWorkflow(workflowId, { status: 'active' });

    this.emitEvent('workflow.activated', workflowId, undefined, { workflow: updated });

    return updated;
  }

  async pauseWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const updated = await this.updateWorkflow(workflowId, { status: 'paused' });

    this.emitEvent('workflow.paused', workflowId, undefined, { workflow: updated });

    return updated;
  }

  async archiveWorkflow(workflowId: string): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return this.updateWorkflow(workflowId, { status: 'archived' });
  }

  async cloneWorkflow(
    workflowId: string,
    newName: string,
    createdBy: string
  ): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    return this.createWorkflow({
      name: newName,
      description: workflow.description,
      teamId: workflow.teamId,
      createdBy,
      triggers: this.cloneTriggers(workflow.triggers),
      steps: this.cloneSteps(workflow.steps),
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      variables: { ...workflow.variables },
      tags: [...(workflow.tags || [])],
    });
  }

  // ==================== Steps Management ====================

  async addStep(
    workflowId: string,
    step: WorkflowStep,
    afterStepId?: string
  ): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const steps = [...workflow.steps];

    if (afterStepId) {
      const index = steps.findIndex((s) => s.id === afterStepId);
      if (index === -1) {
        throw new Error('Step not found');
      }
      steps.splice(index + 1, 0, step);
    } else {
      steps.push(step);
    }

    return this.updateWorkflow(workflowId, { steps });
  }

  async updateStep(
    workflowId: string,
    stepId: string,
    updates: Partial<WorkflowStep>
  ): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const stepIndex = workflow.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
      throw new Error('Step not found');
    }

    const steps = [...workflow.steps];
    steps[stepIndex] = { ...steps[stepIndex], ...updates, id: stepId };

    return this.updateWorkflow(workflowId, { steps });
  }

  async removeStep(workflowId: string, stepId: string): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const steps = workflow.steps.filter((s) => s.id !== stepId);

    return this.updateWorkflow(workflowId, { steps });
  }

  async reorderSteps(workflowId: string, stepIds: string[]): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));
    const steps: WorkflowStep[] = [];

    for (const stepId of stepIds) {
      const step = stepMap.get(stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found`);
      }
      steps.push(step);
    }

    return this.updateWorkflow(workflowId, { steps });
  }

  // ==================== Triggers Management ====================

  async addTrigger(workflowId: string, trigger: WorkflowTrigger): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const triggers = [...workflow.triggers, trigger];

    return this.updateWorkflow(workflowId, { triggers });
  }

  async updateTrigger(
    workflowId: string,
    triggerId: string,
    updates: Partial<WorkflowTrigger>
  ): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const triggerIndex = workflow.triggers.findIndex((t) => t.id === triggerId);
    if (triggerIndex === -1) {
      throw new Error('Trigger not found');
    }

    const triggers = [...workflow.triggers];
    triggers[triggerIndex] = { ...triggers[triggerIndex], ...updates, id: triggerId };

    return this.updateWorkflow(workflowId, { triggers });
  }

  async removeTrigger(workflowId: string, triggerId: string): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const triggers = workflow.triggers.filter((t) => t.id !== triggerId);

    return this.updateWorkflow(workflowId, { triggers });
  }

  // ==================== Execution ====================

  async executeWorkflow(request: ExecuteWorkflowRequest): Promise<WorkflowExecution> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(request.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    if (workflow.status !== 'active') {
      throw new Error('Workflow is not active');
    }

    // Validate input
    if (workflow.inputSchema && request.input) {
      const validation = await this.validateInput(request.workflowId, request.input);
      if (!validation.valid) {
        throw new Error(`Invalid input: ${validation.errors.map((e) => e.message).join(', ')}`);
      }
    }

    const now = new Date();
    const execution: WorkflowExecution = {
      id: randomUUID(),
      workflowId: request.workflowId,
      workflowVersion: workflow.version,
      teamId: workflow.teamId,
      status: 'running',
      trigger: {
        triggerId: randomUUID(),
        type: request.triggerType || 'manual',
        triggeredBy: request.triggeredBy,
        data: request.triggerData,
      },
      input: request.input || {},
      stepExecutions: [],
      startedAt: now,
      context: {
        variables: { ...workflow.variables },
        secrets: {},
        environment: {},
        ...request.contextOverrides,
      },
    };

    this.executions.set(execution.id, execution);

    this.emitEvent('execution.started', request.workflowId, execution.id, { execution });

    // Execute steps asynchronously
    this.executeStepsAsync(execution, workflow);

    return execution;
  }

  async getExecution(executionId: string): Promise<WorkflowExecution | undefined> {
    this.ensureNotDisposed();
    return this.executions.get(executionId);
  }

  async getExecutions(
    workflowId: string,
    status?: ExecutionStatus,
    limit = 50
  ): Promise<WorkflowExecution[]> {
    this.ensureNotDisposed();

    let executions = Array.from(this.executions.values()).filter(
      (e) => e.workflowId === workflowId
    );

    if (status !== undefined) {
      executions = executions.filter((e) => e.status === status);
    }

    return executions
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  async cancelExecution(executionId: string): Promise<WorkflowExecution> {
    this.ensureNotDisposed();

    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'running' && execution.status !== 'paused') {
      throw new Error('Execution cannot be cancelled');
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date();
    execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();

    this.executions.set(executionId, execution);

    this.emitEvent('execution.cancelled', execution.workflowId, executionId, { execution });

    return execution;
  }

  async retryExecution(executionId: string, fromStepId?: string): Promise<WorkflowExecution> {
    this.ensureNotDisposed();

    const originalExecution = this.executions.get(executionId);
    if (!originalExecution) {
      throw new Error('Execution not found');
    }

    if (originalExecution.status !== 'failed') {
      throw new Error('Only failed executions can be retried');
    }

    // Create new execution based on original
    return this.executeWorkflow({
      workflowId: originalExecution.workflowId,
      input: originalExecution.input,
      triggeredBy: originalExecution.trigger.triggeredBy,
      triggerType: originalExecution.trigger.type,
      triggerData: { ...originalExecution.trigger.data, retryFromStepId: fromStepId },
    });
  }

  async pauseExecution(executionId: string): Promise<WorkflowExecution> {
    this.ensureNotDisposed();

    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'running') {
      throw new Error('Execution is not running');
    }

    execution.status = 'paused';
    this.executions.set(executionId, execution);

    return execution;
  }

  async resumeExecution(executionId: string): Promise<WorkflowExecution> {
    this.ensureNotDisposed();

    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    if (execution.status !== 'paused') {
      throw new Error('Execution is not paused');
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    execution.status = 'running';
    this.executions.set(executionId, execution);

    // Continue execution
    this.executeStepsAsync(execution, workflow);

    return execution;
  }

  // ==================== Templates ====================

  async getTemplates(category?: string): Promise<WorkflowTemplate[]> {
    this.ensureNotDisposed();

    let templates = Array.from(this.templates.values());

    if (category !== undefined) {
      templates = templates.filter((t) => t.category === category);
    }

    return templates;
  }

  async getTemplate(templateId: string): Promise<WorkflowTemplate | undefined> {
    this.ensureNotDisposed();
    return this.templates.get(templateId);
  }

  async createFromTemplate(request: CreateFromTemplateRequest): Promise<WorkflowDefinition> {
    this.ensureNotDisposed();

    const template = this.templates.get(request.templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Validate required variables
    for (const variable of template.requiredVariables) {
      if (variable.required && !(variable.name in request.variables)) {
        throw new Error(`Missing required variable: ${variable.name}`);
      }
    }

    // Create workflow from template
    const definition = template.definition;

    return this.createWorkflow({
      name: request.name,
      description: definition.description,
      teamId: request.teamId,
      createdBy: request.createdBy,
      triggers: this.cloneTriggers(definition.triggers),
      steps: this.cloneSteps(definition.steps),
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      variables: { ...definition.variables, ...request.variables },
      tags: definition.tags,
    });
  }

  async saveAsTemplate(
    workflowId: string,
    templateName: string,
    category: string,
    requiredVariables: TemplateVariable[]
  ): Promise<WorkflowTemplate> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const template: WorkflowTemplate = {
      id: randomUUID(),
      name: templateName,
      description: workflow.description,
      category,
      tags: workflow.tags || [],
      definition: {
        name: workflow.name,
        description: workflow.description,
        status: 'draft',
        version: 1,
        triggers: this.cloneTriggers(workflow.triggers),
        steps: this.cloneSteps(workflow.steps),
        inputSchema: workflow.inputSchema,
        outputSchema: workflow.outputSchema,
        variables: workflow.variables,
        tags: workflow.tags,
      },
      requiredVariables,
      author: workflow.createdBy,
      isBuiltIn: false,
      createdAt: new Date(),
    };

    this.templates.set(template.id, template);

    return template;
  }

  // ==================== Validation ====================

  async validateWorkflow(workflow: WorkflowDefinition): Promise<ValidationResult> {
    this.ensureNotDisposed();

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic validation
    if (!workflow.name || workflow.name.trim().length === 0) {
      errors.push({
        code: 'INVALID_NAME',
        message: 'Workflow name is required',
        path: 'name',
      });
    }

    // Steps validation
    if (workflow.steps.length === 0) {
      warnings.push({
        code: 'NO_STEPS',
        message: 'Workflow has no steps',
        path: 'steps',
      });
    }

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const stepErrors = this.validateStep(step, i);
      errors.push(...stepErrors);
    }

    // Triggers validation
    if (workflow.triggers.length === 0) {
      warnings.push({
        code: 'NO_TRIGGERS',
        message: 'Workflow has no triggers',
        path: 'triggers',
      });
    }

    // Check for circular references in steps
    const circularRefs = this.detectCircularReferences(workflow.steps);
    if (circularRefs.length > 0) {
      errors.push({
        code: 'CIRCULAR_REFERENCE',
        message: `Circular references detected in steps: ${circularRefs.join(', ')}`,
        path: 'steps',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async validateInput(
    workflowId: string,
    input: Record<string, unknown>
  ): Promise<ValidationResult> {
    this.ensureNotDisposed();

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (workflow.inputSchema) {
      // Basic schema validation
      const schema = workflow.inputSchema;

      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in input)) {
            errors.push({
              code: 'MISSING_REQUIRED_FIELD',
              message: `Missing required field: ${field}`,
              path: `input.${field}`,
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==================== Events ====================

  onWorkflowEvent(handler: (event: WorkflowEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    this.disposed = true;
    this.workflows.clear();
    this.executions.clear();
    this.templates.clear();
    this.eventHandlers.clear();
  }

  // ==================== Private Helpers ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('CustomWorkflowsManager has been disposed');
    }
  }

  private emitEvent(
    type: WorkflowEventType,
    workflowId: string,
    executionId: string | undefined,
    data: Record<string, unknown>
  ): void {
    const event: WorkflowEvent = {
      type,
      workflowId,
      executionId,
      data,
      timestamp: new Date(),
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private cloneTriggers(triggers: WorkflowTrigger[]): WorkflowTrigger[] {
    return triggers.map((t) => ({
      ...t,
      id: randomUUID(),
      config: { ...t.config },
    }));
  }

  private cloneSteps(steps: WorkflowStep[]): WorkflowStep[] {
    const idMapping = new Map<string, string>();

    // Generate new IDs
    for (const step of steps) {
      idMapping.set(step.id, randomUUID());
    }

    return steps.map((s) => ({
      ...s,
      id: idMapping.get(s.id)!,
      config: { ...s.config },
      nextStepId: s.nextStepId ? idMapping.get(s.nextStepId) : undefined,
      onSuccessStepId: s.onSuccessStepId ? idMapping.get(s.onSuccessStepId) : undefined,
      onFailureStepId: s.onFailureStepId ? idMapping.get(s.onFailureStepId) : undefined,
    }));
  }

  private validateStep(step: WorkflowStep, index: number): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!step.id) {
      errors.push({
        code: 'INVALID_STEP_ID',
        message: `Step at index ${index} has no ID`,
        path: `steps[${index}].id`,
      });
    }

    if (!step.name || step.name.trim().length === 0) {
      errors.push({
        code: 'INVALID_STEP_NAME',
        message: `Step at index ${index} has no name`,
        path: `steps[${index}].name`,
      });
    }

    if (!step.type) {
      errors.push({
        code: 'INVALID_STEP_TYPE',
        message: `Step at index ${index} has no type`,
        path: `steps[${index}].type`,
      });
    }

    // Validate action type for action steps
    if (step.type === 'action' && step.config.type === 'action') {
      const actionConfig = step.config;
      if (!BUILTIN_ACTION_TYPES.includes(actionConfig.actionType as typeof BUILTIN_ACTION_TYPES[number])) {
        // Custom action types are allowed, but we can warn
      }
    }

    return errors;
  }

  private detectCircularReferences(steps: WorkflowStep[]): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circularRefs: string[] = [];

    const stepMap = new Map(steps.map((s) => [s.id, s]));

    const dfs = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = stepMap.get(stepId);
      if (!step) return false;

      const nextIds = [step.nextStepId, step.onSuccessStepId, step.onFailureStepId].filter(
        Boolean
      ) as string[];

      for (const nextId of nextIds) {
        if (!visited.has(nextId)) {
          if (dfs(nextId)) return true;
        } else if (recursionStack.has(nextId)) {
          circularRefs.push(`${stepId} -> ${nextId}`);
          return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of steps) {
      if (!visited.has(step.id)) {
        dfs(step.id);
      }
    }

    return circularRefs;
  }

  private async executeStepsAsync(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition
  ): Promise<void> {
    try {
      // Execute steps sequentially
      for (const step of workflow.steps) {
        if (execution.status !== 'running') {
          break;
        }

        // Check condition
        if (step.condition && !this.evaluateCondition(step.condition, execution.context)) {
          continue;
        }

        await this.executeStep(execution, step);
      }

      // Mark as completed if still running
      if (execution.status === 'running') {
        execution.status = 'completed';
        execution.completedAt = new Date();
        execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();

        this.emitEvent('execution.completed', execution.workflowId, execution.id, { execution });
      }
    } catch (error) {
      execution.status = 'failed';
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - execution.startedAt.getTime();
      execution.error = this.createExecutionError(error);

      this.emitEvent('execution.failed', execution.workflowId, execution.id, {
        execution,
        error: execution.error,
      });
    }

    this.executions.set(execution.id, execution);
  }

  private async executeStep(execution: WorkflowExecution, step: WorkflowStep): Promise<void> {
    const startedAt = new Date();
    const stepExecution: StepExecution = {
      id: randomUUID(),
      stepId: step.id,
      stepName: step.name,
      status: 'running',
      attempt: 1,
      startedAt,
    };

    execution.stepExecutions.push(stepExecution);

    this.emitEvent('step.started', execution.workflowId, execution.id, {
      stepExecution,
    });

    try {
      // Execute based on step type
      const output = await this.executeStepByType(step, execution.context);

      stepExecution.status = 'completed';
      stepExecution.output = output;
      stepExecution.completedAt = new Date();
      stepExecution.durationMs = stepExecution.completedAt.getTime() - startedAt.getTime();

      // Update context with output
      if (step.outputMapping) {
        for (const [key, value] of Object.entries(step.outputMapping)) {
          execution.context.variables[key] = output[value];
        }
      }

      this.emitEvent('step.completed', execution.workflowId, execution.id, {
        stepExecution,
      });
    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.error = this.createExecutionError(error);
      stepExecution.completedAt = new Date();
      stepExecution.durationMs = stepExecution.completedAt.getTime() - startedAt.getTime();

      this.emitEvent('step.failed', execution.workflowId, execution.id, {
        stepExecution,
        error: stepExecution.error,
      });

      // Handle error based on error handling config
      if (step.errorHandling?.strategy === 'ignore') {
        return;
      }

      throw error;
    }
  }

  private async executeStepByType(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    switch (step.type) {
      case 'action':
        return this.executeActionStep(step, context);
      case 'condition':
        return this.executeConditionStep(step, context);
      case 'wait':
        return this.executeWaitStep(step, context);
      case 'transform':
        return this.executeTransformStep(step, context);
      default:
        return {};
    }
  }

  private async executeActionStep(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = step.config as { type: 'action'; actionType: string; parameters: Record<string, unknown> };

    // Simulate action execution
    switch (config.actionType) {
      case 'log_message':
        return { logged: true, message: config.parameters.message };
      case 'set_variable':
        const { name, value } = config.parameters as { name: string; value: unknown };
        context.variables[name] = value;
        return { set: true, name, value };
      case 'http_request':
        // Simulate HTTP request
        return { status: 200, body: {} };
      default:
        return { executed: true, actionType: config.actionType };
    }
  }

  private async executeConditionStep(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = step.config as { type: 'condition'; expression: string };
    const result = this.evaluateCondition(config.expression, context);
    return { result };
  }

  private async executeWaitStep(
    step: WorkflowStep,
    _context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = step.config as { type: 'wait'; waitType: string; durationMs?: number };

    if (config.waitType === 'duration' && config.durationMs) {
      // In a real implementation, this would actually wait
      // For testing, we simulate immediate completion
      return { waited: true, durationMs: config.durationMs };
    }

    return { waited: true };
  }

  private async executeTransformStep(
    step: WorkflowStep,
    context: ExecutionContext
  ): Promise<Record<string, unknown>> {
    const config = step.config as { type: 'transform'; expression: string; transformType: string };

    // Simplified transform - in reality would use jq, jsonpath, or javascript
    return { transformed: true, expression: config.expression, variables: context.variables };
  }

  private evaluateCondition(expression: string, context: ExecutionContext): boolean {
    // Simplified condition evaluation
    // In a real implementation, this would properly evaluate expressions
    try {
      // Check for simple variable checks
      if (expression.startsWith('$')) {
        const varName = expression.slice(1);
        return Boolean(context.variables[varName]);
      }

      // Default to true for empty expressions
      if (!expression.trim()) {
        return true;
      }

      return true;
    } catch {
      return false;
    }
  }

  private createExecutionError(error: unknown): ExecutionError {
    if (error instanceof Error) {
      return {
        code: 'EXECUTION_ERROR',
        message: error.message,
        stackTrace: error.stack,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
    };
  }

  private initializeBuiltInTemplates(): void {
    // CI/CD Pipeline template
    const cicdTemplate: WorkflowTemplate = {
      id: 'template-cicd-basic',
      name: 'Basic CI/CD Pipeline',
      description: 'A basic continuous integration and deployment pipeline',
      category: 'ci_cd',
      tags: ['ci', 'cd', 'testing', 'deployment'],
      definition: {
        name: 'CI/CD Pipeline',
        description: 'Automated build, test, and deploy workflow',
        status: 'draft',
        version: 1,
        triggers: [
          {
            id: 'trigger-1',
            type: 'event',
            config: { type: 'event', eventTypes: ['git.push'], source: 'github' },
            enabled: true,
          },
        ],
        steps: [
          {
            id: 'step-1',
            name: 'Run Tests',
            type: 'action',
            config: { type: 'action', actionType: 'run_tests', parameters: {} },
          },
          {
            id: 'step-2',
            name: 'Build',
            type: 'action',
            config: { type: 'action', actionType: 'run_script', parameters: { script: 'npm run build' } },
          },
          {
            id: 'step-3',
            name: 'Deploy',
            type: 'action',
            config: { type: 'action', actionType: 'deploy', parameters: {} },
          },
        ],
        variables: {},
        tags: ['ci_cd'],
      },
      requiredVariables: [
        {
          name: 'deployTarget',
          displayName: 'Deploy Target',
          description: 'Deployment target environment',
          type: 'string',
          required: true,
        },
      ],
      author: 'system',
      isBuiltIn: true,
      createdAt: new Date(),
    };

    this.templates.set(cicdTemplate.id, cicdTemplate);

    // Notification template
    const notificationTemplate: WorkflowTemplate = {
      id: 'template-notification-basic',
      name: 'Event Notification',
      description: 'Send notifications when events occur',
      category: 'notifications',
      tags: ['notification', 'alert', 'email'],
      definition: {
        name: 'Event Notification',
        description: 'Notify team of events',
        status: 'draft',
        version: 1,
        triggers: [
          {
            id: 'trigger-1',
            type: 'event',
            config: { type: 'event', eventTypes: ['*'] },
            enabled: true,
          },
        ],
        steps: [
          {
            id: 'step-1',
            name: 'Send Notification',
            type: 'action',
            config: { type: 'action', actionType: 'send_notification', parameters: {} },
          },
        ],
        variables: {},
        tags: ['notifications'],
      },
      requiredVariables: [
        {
          name: 'notificationChannel',
          displayName: 'Notification Channel',
          description: 'Channel to send notifications to',
          type: 'string',
          required: true,
        },
      ],
      author: 'system',
      isBuiltIn: true,
      createdAt: new Date(),
    };

    this.templates.set(notificationTemplate.id, notificationTemplate);

    // Scheduled task template
    const scheduledTemplate: WorkflowTemplate = {
      id: 'template-scheduled-task',
      name: 'Scheduled Task',
      description: 'Run tasks on a schedule',
      category: 'maintenance',
      tags: ['schedule', 'cron', 'automation'],
      definition: {
        name: 'Scheduled Task',
        description: 'Run automated tasks on schedule',
        status: 'draft',
        version: 1,
        triggers: [
          {
            id: 'trigger-1',
            type: 'schedule',
            config: { type: 'schedule', cron: '0 0 * * *' },
            enabled: true,
          },
        ],
        steps: [
          {
            id: 'step-1',
            name: 'Run Script',
            type: 'action',
            config: { type: 'action', actionType: 'run_script', parameters: {} },
          },
        ],
        variables: {},
        tags: ['maintenance'],
      },
      requiredVariables: [
        {
          name: 'cronExpression',
          displayName: 'Schedule',
          description: 'Cron expression for scheduling',
          type: 'string',
          defaultValue: '0 0 * * *',
          required: true,
        },
      ],
      author: 'system',
      isBuiltIn: true,
      createdAt: new Date(),
    };

    this.templates.set(scheduledTemplate.id, scheduledTemplate);
  }
}
