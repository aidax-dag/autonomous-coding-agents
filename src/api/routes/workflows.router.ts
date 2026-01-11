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

/**
 * Workflows API Router
 */
export class WorkflowsRouter extends BaseRouter {
  readonly prefix = '/workflows';

  constructor() {
    super('WorkflowsRouter');
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
    ];
  }

  // ==================== Route Handlers ====================

  private async listWorkflows(
    request: TypedRequest<unknown, unknown, WorkflowListQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowSummary[]>> {
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);

    this.logger.info('Listing workflows', { page, limit });

    // TODO: Replace with actual workflow registry implementation
    return this.listResponse([], 0, { page, limit }, request.id as string);
  }

  private async createWorkflow(
    request: TypedRequest<CreateWorkflowRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Creating workflow', { name: body.name });

    const workflow: WorkflowDetail = {
      id: crypto.randomUUID(),
      name: body.name,
      description: body.description,
      status: 'draft' as WorkflowStatus,
      stepsCount: body.steps.length,
      triggersCount: body.triggers?.length || 0,
      executionsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

    throw new NotFoundException('Workflow', workflowId);
  }

  private async updateWorkflow(
    request: TypedRequest<UpdateWorkflowRequest, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowDetail>> {
    const { workflowId } = request.params;

    this.logger.info('Updating workflow', { workflowId });

    throw new NotFoundException('Workflow', workflowId);
  }

  private async deleteWorkflow(
    request: TypedRequest<unknown, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ deleted: boolean; workflowId: string }>> {
    const { workflowId } = request.params;

    this.logger.info('Deleting workflow', { workflowId });

    throw new NotFoundException('Workflow', workflowId);
  }

  private async executeWorkflow(
    request: TypedRequest<ExecuteWorkflowRequest, WorkflowIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<FastifyReply> {
    const { workflowId } = request.params;
    const body = request.body;

    this.logger.info('Executing workflow', { workflowId, async: body.async });

    throw new NotFoundException('Workflow', workflowId);
  }

  private async listInstances(
    request: TypedRequest<unknown, WorkflowIdParam, WorkflowInstanceListQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowInstanceSummary[]>> {
    const { workflowId } = request.params;
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);

    this.logger.info('Listing workflow instances', { workflowId, page, limit });

    return this.listResponse([], 0, { page, limit }, request.id as string);
  }

  private async getInstance(
    request: TypedRequest<unknown, WorkflowIdParam & WorkflowInstanceIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<WorkflowInstanceDetail>> {
    const { workflowId, instanceId } = request.params;

    this.logger.info('Getting workflow instance', { workflowId, instanceId });

    throw new NotFoundException('Workflow instance', instanceId);
  }

  private async cancelInstance(
    request: TypedRequest<unknown, WorkflowIdParam & WorkflowInstanceIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { workflowId, instanceId } = request.params;

    this.logger.info('Canceling workflow instance', { workflowId, instanceId });

    throw new NotFoundException('Workflow instance', instanceId);
  }
}

export function createWorkflowsRouter(): WorkflowsRouter {
  return new WorkflowsRouter();
}
