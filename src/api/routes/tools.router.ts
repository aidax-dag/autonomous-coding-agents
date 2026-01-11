/**
 * Tools Router
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/routes/tools
 */

import { FastifyReply } from 'fastify';
import { BaseRouter } from './base.router.js';
import type { TypedRequest, ApiResponse } from '../interfaces/api.interface.js';
import type {
  RegisterToolRequest,
  UpdateToolRequest,
  ExecuteToolRequest,
  BatchExecuteRequest,
  ToolListQuery,
  ExecutionHistoryQuery,
  ToolNameParam,
  ToolDetail,
  ToolSummary,
  ToolExecutionResult,
  BatchExecutionResult,
  ToolValidationResult,
  ToolStatus,
  ExecutionStatus,
} from '../interfaces/tool-api.interface.js';
import { NotFoundException } from '../middleware/error.middleware.js';
import { ToolCategory } from '../../core/interfaces/tool.interface.js';

/**
 * Tools API Router
 */
export class ToolsRouter extends BaseRouter {
  readonly prefix = '/tools';

  constructor() {
    super('ToolsRouter');
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.routes = [
      // List tools
      {
        method: 'GET',
        path: '',
        handler: this.listTools.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'List all registered tools',
          querystring: {
            type: 'object',
            properties: {
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
              category: { type: 'string', enum: Object.values(ToolCategory) },
              status: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },

      // Register tool
      {
        method: 'POST',
        path: '',
        handler: this.registerTool.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Register a new tool',
          body: {
            type: 'object',
            required: ['name', 'description', 'category', 'schema'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 500 },
              category: { type: 'string', enum: Object.values(ToolCategory) },
              version: { type: 'string' },
              schema: { type: 'object' },
              examples: { type: 'array', items: { type: 'object' } },
              timeout: { type: 'integer', minimum: 1000 },
              rateLimit: { type: 'object' },
              metadata: { type: 'object' },
            },
          },
        },
      },

      // Get tool
      {
        method: 'GET',
        path: '/:toolName',
        handler: this.getTool.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Get tool by name',
          params: {
            type: 'object',
            required: ['toolName'],
            properties: {
              toolName: { type: 'string' },
            },
          },
        },
      },

      // Update tool
      {
        method: 'PATCH',
        path: '/:toolName',
        handler: this.updateTool.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Update tool configuration',
        },
      },

      // Unregister tool
      {
        method: 'DELETE',
        path: '/:toolName',
        handler: this.unregisterTool.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Unregister a tool',
        },
      },

      // Execute tool
      {
        method: 'POST',
        path: '/:toolName/execute',
        handler: this.executeTool.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Execute a tool',
          body: {
            type: 'object',
            required: ['parameters'],
            properties: {
              parameters: { type: 'object' },
              context: { type: 'object' },
              timeout: { type: 'integer', minimum: 1000 },
              async: { type: 'boolean', default: false },
              callbackUrl: { type: 'string', format: 'uri' },
            },
          },
        },
      },

      // Batch execute
      {
        method: 'POST',
        path: '/batch/execute',
        handler: this.batchExecute.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Execute multiple tools in batch',
          body: {
            type: 'object',
            required: ['executions'],
            properties: {
              executions: {
                type: 'array',
                minItems: 1,
                maxItems: 50,
                items: {
                  type: 'object',
                  required: ['toolName', 'parameters'],
                  properties: {
                    toolName: { type: 'string' },
                    parameters: { type: 'object' },
                    id: { type: 'string' },
                  },
                },
              },
              parallel: { type: 'boolean', default: true },
              stopOnError: { type: 'boolean', default: false },
              timeout: { type: 'integer', minimum: 1000 },
            },
          },
        },
      },

      // Validate parameters
      {
        method: 'POST',
        path: '/:toolName/validate',
        handler: this.validateParameters.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Validate tool parameters',
          body: {
            type: 'object',
            required: ['parameters'],
            properties: {
              parameters: { type: 'object' },
            },
          },
        },
      },

      // Get execution history
      {
        method: 'GET',
        path: '/:toolName/executions',
        handler: this.getExecutionHistory.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Get tool execution history',
        },
      },

      // Get tool stats
      {
        method: 'GET',
        path: '/:toolName/stats',
        handler: this.getToolStats.bind(this),
        schema: {
          tags: ['Tools'],
          summary: 'Get tool statistics',
        },
      },
    ];
  }

  // ==================== Route Handlers ====================

  private async listTools(
    request: TypedRequest<unknown, unknown, ToolListQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolSummary[]>> {
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);

    this.logger.info('Listing tools', { page, limit });

    return this.listResponse([], 0, { page, limit }, request.id as string);
  }

  private async registerTool(
    request: TypedRequest<RegisterToolRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Registering tool', { name: body.name, category: body.category });

    const tool: ToolDetail = {
      name: body.name,
      description: body.description,
      category: body.category,
      version: body.version || '1.0.0',
      status: 'available' as ToolStatus,
      executionCount: 0,
      schema: body.schema,
      parameters: [],
      examples: body.examples || [],
      timeout: body.timeout || 30000,
      rateLimit: body.rateLimit ? { ...body.rateLimit, remaining: body.rateLimit.max, resetsAt: new Date().toISOString() } : undefined,
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        executionsLast24h: 0,
        executionsLast7d: 0,
      },
      metadata: body.metadata,
    };

    return this.created(tool, request.id as string, reply);
  }

  private async getTool(
    request: TypedRequest<unknown, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolDetail>> {
    const { toolName } = request.params;

    this.logger.info('Getting tool', { toolName });

    throw new NotFoundException('Tool', toolName);
  }

  private async updateTool(
    request: TypedRequest<UpdateToolRequest, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolDetail>> {
    const { toolName } = request.params;

    this.logger.info('Updating tool', { toolName });

    throw new NotFoundException('Tool', toolName);
  }

  private async unregisterTool(
    request: TypedRequest<unknown, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ unregistered: boolean; toolName: string }>> {
    const { toolName } = request.params;

    this.logger.info('Unregistering tool', { toolName });

    throw new NotFoundException('Tool', toolName);
  }

  private async executeTool(
    request: TypedRequest<ExecuteToolRequest, ToolNameParam, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const { toolName } = request.params;
    const body = request.body;

    this.logger.info('Executing tool', { toolName, async: body.async });

    const result: ToolExecutionResult = {
      executionId: crypto.randomUUID(),
      toolName,
      status: 'pending' as ExecutionStatus,
      startedAt: new Date().toISOString(),
      context: body.context,
    };

    return this.created(result, request.id as string, reply);
  }

  private async batchExecute(
    request: TypedRequest<BatchExecuteRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Batch executing tools', { count: body.executions.length, parallel: body.parallel });

    const result: BatchExecutionResult = {
      batchId: crypto.randomUUID(),
      status: 'completed',
      totalCount: body.executions.length,
      successCount: 0,
      failedCount: body.executions.length,
      results: body.executions.map((exec) => ({
        id: exec.id,
        toolName: exec.toolName,
        status: 'failed' as ExecutionStatus,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool '${exec.toolName}' not found` },
      })),
      totalDuration: 0,
    };

    return this.created(result, request.id as string, reply);
  }

  private async validateParameters(
    request: TypedRequest<{ parameters: Record<string, unknown> }, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolValidationResult>> {
    const { toolName } = request.params;

    this.logger.info('Validating tool parameters', { toolName });

    throw new NotFoundException('Tool', toolName);
  }

  private async getExecutionHistory(
    request: TypedRequest<unknown, ToolNameParam, ExecutionHistoryQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolExecutionResult[]>> {
    const { toolName } = request.params;
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);

    this.logger.info('Getting tool execution history', { toolName, page, limit });

    return this.listResponse([], 0, { page, limit }, request.id as string);
  }

  private async getToolStats(
    request: TypedRequest<unknown, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { toolName } = request.params;

    this.logger.info('Getting tool stats', { toolName });

    throw new NotFoundException('Tool', toolName);
  }
}

export function createToolsRouter(): ToolsRouter {
  return new ToolsRouter();
}
