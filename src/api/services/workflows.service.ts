/**
 * Workflows API Service
 *
 * Service layer for Workflows API operations
 */

import { createLogger, ILogger } from '../../core/services/logger.js';
import { ValidationException } from '../middleware/error.middleware.js';

export interface WorkflowStep {
  id: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
  dependsOn?: string[];
}

export interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  steps: WorkflowStep[];
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface WorkflowInstance {
  instanceId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep?: string;
  stepResults: Map<string, unknown>;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface ListWorkflowsOptions {
  status?: string;
  name?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListWorkflowsResult {
  workflows: WorkflowInfo[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateWorkflowData {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  config?: Record<string, unknown>;
}

/**
 * Workflows Service
 *
 * Provides API-friendly operations for workflow management
 */
export class WorkflowsService {
  private readonly logger: ILogger;
  private readonly workflows: Map<string, WorkflowInfo>;
  private readonly instances: Map<string, WorkflowInstance>;

  constructor() {
    this.logger = createLogger('WorkflowsService');
    this.workflows = new Map();
    this.instances = new Map();
  }

  /**
   * List workflows with filtering and pagination
   */
  async listWorkflows(options: ListWorkflowsOptions = {}): Promise<ListWorkflowsResult> {
    const { status, name, page = 1, limit = 20, sortBy, sortOrder = 'desc' } = options;

    let workflows = Array.from(this.workflows.values());

    // Filter by status
    if (status) {
      workflows = workflows.filter((w) => w.status === status);
    }

    // Filter by name
    if (name) {
      const nameLower = name.toLowerCase();
      workflows = workflows.filter((w) => w.name.toLowerCase().includes(nameLower));
    }

    // Sort
    if (sortBy) {
      workflows.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[sortBy];
        const bVal = (b as unknown as Record<string, unknown>)[sortBy];
        if (aVal === bVal) return 0;
        const cmp = aVal! > bVal! ? 1 : -1;
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    } else {
      // Default: sort by createdAt desc
      workflows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    const total = workflows.length;
    const offset = (page - 1) * limit;
    const paginatedWorkflows = workflows.slice(offset, offset + limit);

    return {
      workflows: paginatedWorkflows,
      total,
      page,
      limit,
    };
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<WorkflowInfo | null> {
    return this.workflows.get(workflowId) || null;
  }

  /**
   * Create a new workflow
   */
  async createWorkflow(data: CreateWorkflowData): Promise<WorkflowInfo> {
    const id = crypto.randomUUID();
    const now = new Date();

    // Validate steps
    this.validateSteps(data.steps);

    const workflow: WorkflowInfo = {
      id,
      name: data.name,
      description: data.description,
      status: 'active',
      steps: data.steps,
      config: data.config,
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(id, workflow);

    this.logger.info('Workflow created', { id, name: data.name, stepCount: data.steps.length });

    return workflow;
  }

  /**
   * Update workflow configuration
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<{
      name: string;
      description: string;
      status: WorkflowInfo['status'];
      steps: WorkflowStep[];
      config: Record<string, unknown>;
    }>
  ): Promise<WorkflowInfo | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return null;
    }

    if (updates.name) {
      workflow.name = updates.name;
    }
    if (updates.description !== undefined) {
      workflow.description = updates.description;
    }
    if (updates.status) {
      workflow.status = updates.status;
    }
    if (updates.steps) {
      this.validateSteps(updates.steps);
      workflow.steps = updates.steps;
    }
    if (updates.config) {
      workflow.config = { ...workflow.config, ...updates.config };
    }
    workflow.updatedAt = new Date();

    this.logger.info('Workflow updated', { workflowId, updates: Object.keys(updates) });

    return workflow;
  }

  /**
   * Delete a workflow
   */
  async deleteWorkflow(workflowId: string): Promise<boolean> {
    if (!this.workflows.has(workflowId)) {
      return false;
    }

    this.workflows.delete(workflowId);

    // Also delete associated instances
    for (const [instanceId, instance] of this.instances) {
      if (instance.workflowId === workflowId) {
        this.instances.delete(instanceId);
      }
    }

    this.logger.info('Workflow deleted', { workflowId });

    return true;
  }

  /**
   * Start workflow execution
   */
  async startWorkflow(
    workflowId: string,
    input?: Record<string, unknown>
  ): Promise<WorkflowInstance | null> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      return null;
    }

    if (workflow.status !== 'active') {
      throw new Error(`Workflow is not active: ${workflow.status}`);
    }

    const instanceId = crypto.randomUUID();
    const now = new Date();

    const instance: WorkflowInstance = {
      instanceId,
      workflowId,
      status: 'running',
      currentStep: workflow.steps[0]?.id,
      stepResults: new Map(),
      startedAt: now,
    };

    this.instances.set(instanceId, instance);

    this.logger.info('Workflow started', { workflowId, instanceId });

    // Simulate workflow execution
    this.executeWorkflow(instance, workflow, input);

    return instance;
  }

  /**
   * Pause workflow instance
   */
  async pauseWorkflow(workflowId: string): Promise<WorkflowInstance | null> {
    // Find running instance
    const instance = this.findRunningInstance(workflowId);
    if (!instance) {
      return null;
    }

    instance.status = 'paused';
    this.logger.info('Workflow paused', { workflowId, instanceId: instance.instanceId });

    return instance;
  }

  /**
   * Resume workflow instance
   */
  async resumeWorkflow(workflowId: string): Promise<WorkflowInstance | null> {
    // Find paused instance
    for (const instance of this.instances.values()) {
      if (instance.workflowId === workflowId && instance.status === 'paused') {
        instance.status = 'running';
        this.logger.info('Workflow resumed', { workflowId, instanceId: instance.instanceId });
        return instance;
      }
    }

    return null;
  }

  /**
   * Stop workflow instance
   */
  async stopWorkflow(workflowId: string): Promise<WorkflowInstance | null> {
    const instance = this.findRunningInstance(workflowId);
    if (!instance) {
      return null;
    }

    instance.status = 'cancelled';
    instance.completedAt = new Date();
    this.logger.info('Workflow stopped', { workflowId, instanceId: instance.instanceId });

    return instance;
  }

  /**
   * Get workflow instances
   */
  async getInstances(
    workflowId: string,
    options: { status?: string; page?: number; limit?: number } = {}
  ): Promise<{ instances: WorkflowInstance[]; total: number }> {
    const { status, page = 1, limit = 20 } = options;

    let instances = Array.from(this.instances.values()).filter(
      (i) => i.workflowId === workflowId
    );

    if (status) {
      instances = instances.filter((i) => i.status === status);
    }

    // Sort by startedAt desc
    instances.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    const total = instances.length;
    const offset = (page - 1) * limit;
    const paginatedInstances = instances.slice(offset, offset + limit);

    return { instances: paginatedInstances, total };
  }

  /**
   * Get workflow instance by ID
   */
  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Cancel workflow instance
   */
  async cancelInstance(instanceId: string): Promise<WorkflowInstance | null> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return null;
    }

    if (instance.status === 'completed' || instance.status === 'cancelled') {
      return instance;
    }

    instance.status = 'cancelled';
    instance.completedAt = new Date();
    this.logger.info('Workflow instance cancelled', { instanceId });

    return instance;
  }

  /**
   * Validate workflow steps
   */
  private validateSteps(steps: WorkflowStep[]): void {
    if (!steps || steps.length === 0) {
      throw new ValidationException([
        { field: 'steps', message: 'Workflow must have at least one step', code: 'minItems' },
      ]);
    }

    const stepIds = new Set<string>();
    for (const step of steps) {
      if (!step.id || !step.name || !step.type) {
        throw new ValidationException([
          { field: 'steps', message: 'Each step must have id, name, and type', code: 'required' },
        ]);
      }
      if (stepIds.has(step.id)) {
        throw new ValidationException([
          { field: 'steps', message: `Duplicate step ID: ${step.id}`, code: 'uniqueItems' },
        ]);
      }
      stepIds.add(step.id);

      // Validate dependencies
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep)) {
            throw new ValidationException([
              { field: 'steps.dependsOn', message: `Step '${step.id}' depends on non-existent step '${dep}'`, code: 'invalidDependency' },
            ]);
          }
        }
      }
    }
  }

  /**
   * Find running instance for workflow
   */
  private findRunningInstance(workflowId: string): WorkflowInstance | null {
    for (const instance of this.instances.values()) {
      if (instance.workflowId === workflowId && instance.status === 'running') {
        return instance;
      }
    }
    return null;
  }

  /**
   * Simulate workflow execution
   */
  private executeWorkflow(
    instance: WorkflowInstance,
    workflow: WorkflowInfo,
    _input?: Record<string, unknown>
  ): void {
    const steps = [...workflow.steps];
    let stepIndex = 0;

    const executeNextStep = (): void => {
      if (instance.status !== 'running' || stepIndex >= steps.length) {
        if (instance.status === 'running') {
          instance.status = 'completed';
          instance.completedAt = new Date();
          this.logger.info('Workflow completed', { instanceId: instance.instanceId });
        }
        return;
      }

      const step = steps[stepIndex];
      instance.currentStep = step.id;

      // Simulate step execution
      setTimeout(() => {
        instance.stepResults.set(step.id, { success: true, step: step.name });
        stepIndex++;
        executeNextStep();
      }, 100);
    };

    // Start execution after a short delay
    setTimeout(executeNextStep, 100);
  }
}

/**
 * Create workflows service instance
 */
export function createWorkflowsService(): WorkflowsService {
  return new WorkflowsService();
}
