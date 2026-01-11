/**
 * Workflows Router
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/routes/workflows
 */

import { FastifyReply } from 'fastify';
import { BaseRouter } from './base.router.js';
import type { TypedRequest, ApiResponse } from '../interfaces/api.interface.js';
import type {
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  ExecuteWorkflowRequest,
  WorkflowListQuery,
  WorkflowInstanceListQuery,
  WorkflowIdParam,
  WorkflowInstanceIdParam,
  WorkflowDetail,
  WorkflowSummary,
  WorkflowInstanceDetail,
  WorkflowInstanceSummary,
  WorkflowStatus,
} from '../interfaces/workflow-api.interface.js';
import { NotFoundException } from '../middleware/error.middleware.js';
import { WorkflowsService, createWorkflowsService } from '../services/workflows.service.js';

/**
 * Workflows API Router
 */
export class WorkflowsRouter extends BaseRouter {
  readonly prefix = '/workflows';
  private readonly service: WorkflowsService;

  constructor(service?: WorkflowsService) {
    super('WorkflowsRouter');
    this.service = service || createWorkflowsService();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.routes = [
      // List workflows
      {
        method: 'GET',
        path: '',
        handler: this.listWorkflows.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'List all workflows',
          querystring: {
            type: 'object',
            properties: {
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
              status: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },

      // Create workflow
      {
        method: 'POST',
        path: '',
        handler: this.createWorkflow.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Create a new workflow',
          body: {
            type: 'object',
            required: ['name', 'steps'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 500 },
              steps: { type: 'array', minItems: 1, items: { type: 'object' } },
              triggers: { type: 'array', items: { type: 'object' } },
              variables: { type: 'object' },
              timeout: { type: 'integer', minimum: 1000 },
              maxRetries: { type: 'integer', minimum: 0 },
              metadata: { type: 'object' },
            },
          },
        },
      },

      // Get workflow
      {
        method: 'GET',
        path: '/:workflowId',
        handler: this.getWorkflow.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Get workflow by ID',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Update workflow
      {
        method: 'PATCH',
        path: '/:workflowId',
        handler: this.updateWorkflow.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Update workflow',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Delete workflow
      {
        method: 'DELETE',
        path: '/:workflowId',
        handler: this.deleteWorkflow.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Delete workflow',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Execute workflow
      {
        method: 'POST',
        path: '/:workflowId/execute',
        handler: this.executeWorkflow.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Execute workflow',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
          body: {
            type: 'object',
            properties: {
              variables: { type: 'object' },
              context: { type: 'object' },
              async: { type: 'boolean', default: true },
              callbackUrl: { type: 'string', format: 'uri' },
            },
          },
        },
      },

      // List workflow instances
      {
        method: 'GET',
        path: '/:workflowId/instances',
        handler: this.listInstances.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'List workflow instances',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Get workflow instance
      {
        method: 'GET',
        path: '/:workflowId/instances/:instanceId',
        handler: this.getInstance.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Get workflow instance',
        },
      },

      // Cancel workflow instance
      {
        method: 'POST',
        path: '/:workflowId/instances/:instanceId/cancel',
        handler: this.cancelInstance.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Cancel workflow instance',
        },
      },

      // Start workflow
      {
        method: 'POST',
        path: '/:workflowId/start',
        handler: this.startWorkflowAction.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Start workflow execution',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
          body: {
            type: 'object',
            properties: {
              variables: { type: 'object' },
            },
          },
        },
      },

      // Pause workflow
      {
        method: 'POST',
        path: '/:workflowId/pause',
        handler: this.pauseWorkflowAction.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Pause workflow execution',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Resume workflow
      {
        method: 'POST',
        path: '/:workflowId/resume',
        handler: this.resumeWorkflowAction.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Resume workflow execution',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Stop workflow
      {
        method: 'POST',
        path: '/:workflowId/stop',
        handler: this.stopWorkflowAction.bind(this),
        schema: {
          tags: ['Workflows'],
          summary: 'Stop workflow execution',
          params: {
            type: 'object',
            required: ['workflowId'],
            properties: {
              workflowId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },
    ];
  }

  // ==================== Route Handlers ====================

  private async listWorkflows(
    request: TypedRequest<unknown, unknown, WorkflowListQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowSummary[]>> {
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);
    const query = request.query || {};

    this.logger.info('Listing workflows', { page, limit });

    const result = await this.service.listWorkflows({
      status: Array.isArray(query.status) ? query.status[0] : query.status,
      name: query.name,
      page,
      limit,
    });

    const summaries: WorkflowSummary[] = result.workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      status: workflow.status as WorkflowStatus,
      stepsCount: workflow.steps.length,
      triggersCount: 0,
      executionsCount: 0,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    }));

    return this.listResponse(summaries, result.total, { page, limit }, request.id as string);
  }

  private async createWorkflow(
    request: TypedRequest<CreateWorkflowRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Creating workflow', { name: body.name });

    const workflowInfo = await this.service.createWorkflow({
      name: body.name,
      description: body.description,
      steps: body.steps.map((step, idx) => ({
        id: step.id || `step_${idx}`,
        name: step.name || `Step ${idx + 1}`,
        type: step.type || 'agent',
        config: step.config as Record<string, unknown>,
        dependsOn: step.dependsOn,
      })),
      config: {
        triggers: body.triggers,
        variables: body.variables,
        timeout: body.timeout,
        maxRetries: body.maxRetries,
        metadata: body.metadata,
      },
    });

    const workflow: WorkflowDetail = {
      id: workflowInfo.id,
      name: workflowInfo.name,
      description: workflowInfo.description,
      status: workflowInfo.status as WorkflowStatus,
      stepsCount: workflowInfo.steps.length,
      triggersCount: body.triggers?.length || 0,
      executionsCount: 0,
      createdAt: workflowInfo.createdAt.toISOString(),
      updatedAt: workflowInfo.updatedAt.toISOString(),
      steps: body.steps,
      triggers: body.triggers || [],
      variables: body.variables || {},
      timeout: body.timeout || 300000,
      maxRetries: body.maxRetries || 3,
      metadata: body.metadata,
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        successRate: 0,
      },
    };

    return this.created(workflow, request.id as string, reply);
  }

  private async getWorkflow(
    request: TypedRequest<unknown, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowDetail>> {
    const { workflowId } = request.params;

    this.logger.info('Getting workflow', { workflowId });

    const workflowInfo = await this.service.getWorkflow(workflowId);
    if (!workflowInfo) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const workflow: WorkflowDetail = {
      id: workflowInfo.id,
      name: workflowInfo.name,
      description: workflowInfo.description,
      status: workflowInfo.status as WorkflowStatus,
      stepsCount: workflowInfo.steps.length,
      triggersCount: 0,
      executionsCount: 0,
      createdAt: workflowInfo.createdAt.toISOString(),
      updatedAt: workflowInfo.updatedAt.toISOString(),
      steps: workflowInfo.steps.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as 'agent' | 'tool' | 'condition' | 'parallel' | 'wait',
        config: s.config as import('../interfaces/workflow-api.interface.js').StepConfig,
        dependsOn: s.dependsOn,
      })),
      triggers: [],
      variables: {},
      timeout: 300000,
      maxRetries: 3,
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        successRate: 0,
      },
    };

    return this.success(workflow, request.id as string);
  }

  private async updateWorkflow(
    request: TypedRequest<UpdateWorkflowRequest, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowDetail>> {
    const { workflowId } = request.params;
    const body = request.body;

    this.logger.info('Updating workflow', { workflowId });

    const workflowInfo = await this.service.updateWorkflow(workflowId, {
      name: body.name,
      description: body.description,
      status: body.status as 'draft' | 'active' | 'paused' | 'archived' | undefined,
      steps: body.steps?.map((step, idx) => ({
        id: step.id || `step_${idx}`,
        name: step.name || `Step ${idx + 1}`,
        type: step.type || 'agent',
        config: step.config as Record<string, unknown>,
        dependsOn: step.dependsOn,
      })),
      config: {
        triggers: body.triggers,
        variables: body.variables,
        timeout: body.timeout,
        maxRetries: body.maxRetries,
        metadata: body.metadata,
      },
    });

    if (!workflowInfo) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const workflow: WorkflowDetail = {
      id: workflowInfo.id,
      name: workflowInfo.name,
      description: workflowInfo.description,
      status: workflowInfo.status as WorkflowStatus,
      stepsCount: workflowInfo.steps.length,
      triggersCount: body.triggers?.length || 0,
      executionsCount: 0,
      createdAt: workflowInfo.createdAt.toISOString(),
      updatedAt: workflowInfo.updatedAt.toISOString(),
      steps: body.steps || workflowInfo.steps.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type as 'agent' | 'tool' | 'condition' | 'parallel' | 'wait',
        config: s.config as import('../interfaces/workflow-api.interface.js').StepConfig,
        dependsOn: s.dependsOn,
      })),
      triggers: body.triggers || [],
      variables: body.variables || {},
      timeout: body.timeout || 300000,
      maxRetries: body.maxRetries || 3,
      metadata: body.metadata,
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        successRate: 0,
      },
    };

    return this.success(workflow, request.id as string);
  }

  private async deleteWorkflow(
    request: TypedRequest<unknown, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ deleted: boolean; workflowId: string }>> {
    const { workflowId } = request.params;

    this.logger.info('Deleting workflow', { workflowId });

    const deleted = await this.service.deleteWorkflow(workflowId);
    if (!deleted) {
      throw new NotFoundException('Workflow', workflowId);
    }

    return this.success({ deleted: true, workflowId }, request.id as string);
  }

  private async executeWorkflow(
    request: TypedRequest<ExecuteWorkflowRequest, WorkflowIdParam, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const { workflowId } = request.params;
    const body = request.body;

    this.logger.info('Executing workflow', { workflowId, async: body.async });

    const workflowInfo = await this.service.getWorkflow(workflowId);
    if (!workflowInfo) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const instance = await this.service.startWorkflow(workflowId, body.variables);
    if (!instance) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const instanceDetail: WorkflowInstanceDetail = {
      id: instance.instanceId,
      workflowId: instance.workflowId,
      workflowName: workflowInfo.name,
      status: instance.status as import('../interfaces/workflow-api.interface.js').WorkflowInstanceStatus,
      currentStep: instance.currentStep,
      progress: 0,
      startedAt: instance.startedAt.toISOString(),
      completedAt: instance.completedAt?.toISOString(),
      variables: body.variables || {},
      context: body.context || {},
      steps: [],
      error: instance.error ? {
        stepId: instance.currentStep || 'unknown',
        code: 'EXECUTION_ERROR',
        message: instance.error,
      } : undefined,
    };

    return this.created(instanceDetail, request.id as string, reply);
  }

  private async listInstances(
    request: TypedRequest<unknown, WorkflowIdParam, WorkflowInstanceListQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowInstanceSummary[]>> {
    const { workflowId } = request.params;
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);
    const query = request.query || {};

    this.logger.info('Listing workflow instances', { workflowId, page, limit });

    const workflowInfo = await this.service.getWorkflow(workflowId);
    if (!workflowInfo) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const statusFilter = Array.isArray(query.status) ? query.status[0] : query.status;

    const result = await this.service.getInstances(workflowId, {
      status: statusFilter as string | undefined,
      page,
      limit,
    });

    const summaries: WorkflowInstanceSummary[] = result.instances.map((instance) => ({
      id: instance.instanceId,
      workflowId: instance.workflowId,
      workflowName: workflowInfo.name,
      status: instance.status as import('../interfaces/workflow-api.interface.js').WorkflowInstanceStatus,
      currentStep: instance.currentStep,
      progress: 0,
      startedAt: instance.startedAt.toISOString(),
      completedAt: instance.completedAt?.toISOString(),
    }));

    return this.listResponse(summaries, result.total, { page, limit }, request.id as string);
  }

  private async getInstance(
    request: TypedRequest<unknown, WorkflowIdParam & WorkflowInstanceIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowInstanceDetail>> {
    const { workflowId, instanceId } = request.params;

    this.logger.info('Getting workflow instance', { workflowId, instanceId });

    const instance = await this.service.getInstance(instanceId);
    if (!instance || instance.workflowId !== workflowId) {
      throw new NotFoundException('Workflow instance', instanceId);
    }

    const workflowInfo = await this.service.getWorkflow(workflowId);

    const instanceDetail: WorkflowInstanceDetail = {
      id: instance.instanceId,
      workflowId: instance.workflowId,
      workflowName: workflowInfo?.name || 'Unknown',
      status: instance.status as import('../interfaces/workflow-api.interface.js').WorkflowInstanceStatus,
      currentStep: instance.currentStep,
      progress: 0,
      startedAt: instance.startedAt.toISOString(),
      completedAt: instance.completedAt?.toISOString(),
      variables: {},
      context: {},
      steps: [],
      error: instance.error ? {
        stepId: instance.currentStep || 'unknown',
        code: 'EXECUTION_ERROR',
        message: instance.error,
      } : undefined,
    };

    return this.success(instanceDetail, request.id as string);
  }

  private async cancelInstance(
    request: TypedRequest<unknown, WorkflowIdParam & WorkflowInstanceIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { workflowId, instanceId } = request.params;

    this.logger.info('Canceling workflow instance', { workflowId, instanceId });

    const instance = await this.service.cancelInstance(instanceId);
    if (!instance || instance.workflowId !== workflowId) {
      throw new NotFoundException('Workflow instance', instanceId);
    }

    return this.success({
      instanceId: instance.instanceId,
      workflowId: instance.workflowId,
      status: instance.status,
      message: 'Workflow instance cancelled successfully',
    }, request.id as string);
  }

  private async startWorkflowAction(
    request: TypedRequest<{ variables?: Record<string, unknown> }, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ status: string; instanceId: string }>> {
    const { workflowId } = request.params;
    const body = request.body || {};

    this.logger.info('Starting workflow', { workflowId });

    const workflow = await this.service.getWorkflow(workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const instance = await this.service.startWorkflow(workflowId, body.variables);
    if (!instance) {
      throw new NotFoundException('Workflow', workflowId);
    }

    return this.success({
      status: 'running',
      instanceId: instance.instanceId,
    }, request.id as string);
  }

  private async pauseWorkflowAction(
    request: TypedRequest<unknown, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ status: string }>> {
    const { workflowId } = request.params;

    this.logger.info('Pausing workflow', { workflowId });

    const workflow = await this.service.getWorkflow(workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const instance = await this.service.pauseWorkflow(workflowId);
    if (!instance) {
      throw new NotFoundException('Running workflow instance', workflowId);
    }

    return this.success({
      status: 'paused',
    }, request.id as string);
  }

  private async resumeWorkflowAction(
    request: TypedRequest<unknown, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ status: string }>> {
    const { workflowId } = request.params;

    this.logger.info('Resuming workflow', { workflowId });

    const workflow = await this.service.getWorkflow(workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const instance = await this.service.resumeWorkflow(workflowId);
    if (!instance) {
      throw new NotFoundException('Paused workflow instance', workflowId);
    }

    return this.success({
      status: 'running',
    }, request.id as string);
  }

  private async stopWorkflowAction(
    request: TypedRequest<unknown, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ status: string }>> {
    const { workflowId } = request.params;

    this.logger.info('Stopping workflow', { workflowId });

    const workflow = await this.service.getWorkflow(workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow', workflowId);
    }

    const instance = await this.service.stopWorkflow(workflowId);
    if (!instance) {
      throw new NotFoundException('Running workflow instance', workflowId);
    }

    return this.success({
      status: instance.status,
    }, request.id as string);
  }
}

export function createWorkflowsRouter(): WorkflowsRouter {
  return new WorkflowsRouter();
}
