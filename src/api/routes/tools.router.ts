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
} from '../interfaces/tool-api.interface.js';
import { ToolStatus, ExecutionStatus } from '../interfaces/tool-api.interface.js';
import { NotFoundException } from '../middleware/error.middleware.js';
import { ToolCategory } from '../../core/interfaces/tool.interface.js';
import { ToolsService, createToolsService } from '../services/tools.service.js';

/**
 * Tools API Router
 */
export class ToolsRouter extends BaseRouter {
  readonly prefix = '/tools';
  private readonly service: ToolsService;

  constructor(service?: ToolsService) {
    super('ToolsRouter');
    this.service = service || createToolsService();
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
    const query = request.query || {};

    this.logger.info('Listing tools', { page, limit });

    const categoryFilter = Array.isArray(query.category) ? query.category[0] : query.category;

    const result = await this.service.listTools({
      category: categoryFilter as string | undefined,
      search: query.name,
      page,
      limit,
    });

    const summaries: ToolSummary[] = result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category as ToolCategory,
      version: tool.version,
      status: tool.enabled ? ToolStatus.AVAILABLE : ToolStatus.DISABLED,
      executionCount: 0,
    }));

    return this.listResponse(summaries, result.total, { page, limit }, request.id as string);
  }

  private async registerTool(
    request: TypedRequest<RegisterToolRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Registering tool', { name: body.name, category: body.category });

    const toolInfo = await this.service.registerTool({
      name: body.name,
      description: body.description,
      category: body.category as string,
      version: body.version,
      metadata: body.metadata,
      schema: body.schema as unknown as Record<string, unknown>,
    });

    const stats = await this.service.getToolStats(body.name);

    const tool: ToolDetail = {
      name: toolInfo.name,
      description: toolInfo.description,
      category: toolInfo.category as ToolCategory,
      version: toolInfo.version,
      status: toolInfo.enabled ? ToolStatus.AVAILABLE : ToolStatus.DISABLED,
      executionCount: 0,
      schema: body.schema,
      parameters: [],
      examples: body.examples || [],
      timeout: body.timeout || 30000,
      rateLimit: body.rateLimit ? { ...body.rateLimit, remaining: body.rateLimit.max, resetsAt: new Date().toISOString() } : undefined,
      stats: {
        totalExecutions: stats?.totalExecutions || 0,
        successfulExecutions: stats?.successCount || 0,
        failedExecutions: stats?.failureCount || 0,
        averageDuration: stats?.averageDuration || 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
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

    const toolInfo = await this.service.getTool(toolName);
    if (!toolInfo) {
      throw new NotFoundException('Tool', toolName);
    }

    const stats = await this.service.getToolStats(toolName);

    const tool: ToolDetail = {
      name: toolInfo.name,
      description: toolInfo.description,
      category: toolInfo.category as ToolCategory,
      version: toolInfo.version,
      status: toolInfo.enabled ? ToolStatus.AVAILABLE : ToolStatus.DISABLED,
      executionCount: 0,
      schema: {
        name: toolInfo.name,
        description: toolInfo.description,
        category: toolInfo.category as ToolCategory,
        version: toolInfo.version,
        parameters: [],
        returns: { type: 'object', description: 'Result' },
      },
      parameters: [],
      examples: [],
      timeout: 30000,
      stats: {
        totalExecutions: stats?.totalExecutions || 0,
        successfulExecutions: stats?.successCount || 0,
        failedExecutions: stats?.failureCount || 0,
        averageDuration: stats?.averageDuration || 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
        executionsLast24h: 0,
        executionsLast7d: 0,
      },
    };

    return this.success(tool, request.id as string);
  }

  private async updateTool(
    request: TypedRequest<UpdateToolRequest, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolDetail>> {
    const { toolName } = request.params;
    const body = request.body;

    this.logger.info('Updating tool', { toolName });

    const toolInfo = await this.service.updateTool(toolName, {
      description: body.description,
      metadata: body.metadata,
    });

    if (!toolInfo) {
      throw new NotFoundException('Tool', toolName);
    }

    const stats = await this.service.getToolStats(toolName);

    const tool: ToolDetail = {
      name: toolInfo.name,
      description: toolInfo.description,
      category: toolInfo.category as ToolCategory,
      version: toolInfo.version,
      status: toolInfo.enabled ? ToolStatus.AVAILABLE : ToolStatus.DISABLED,
      executionCount: 0,
      schema: {
        name: toolInfo.name,
        description: toolInfo.description,
        category: toolInfo.category as ToolCategory,
        version: toolInfo.version,
        parameters: [],
        returns: { type: 'object', description: 'Result' },
      },
      parameters: [],
      examples: [],
      timeout: body.timeout || 30000,
      stats: {
        totalExecutions: stats?.totalExecutions || 0,
        successfulExecutions: stats?.successCount || 0,
        failedExecutions: stats?.failureCount || 0,
        averageDuration: stats?.averageDuration || 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
        executionsLast24h: 0,
        executionsLast7d: 0,
      },
      metadata: body.metadata,
    };

    return this.success(tool, request.id as string);
  }

  private async unregisterTool(
    request: TypedRequest<unknown, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ unregistered: boolean; toolName: string }>> {
    const { toolName } = request.params;

    this.logger.info('Unregistering tool', { toolName });

    const deleted = await this.service.unregisterTool(toolName);
    if (!deleted) {
      throw new NotFoundException('Tool', toolName);
    }

    return this.success({ unregistered: true, toolName }, request.id as string);
  }

  private async executeTool(
    request: TypedRequest<ExecuteToolRequest, ToolNameParam, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const { toolName } = request.params;
    const body = request.body;

    this.logger.info('Executing tool', { toolName, async: body.async });

    const toolInfo = await this.service.getTool(toolName);
    if (!toolInfo) {
      throw new NotFoundException('Tool', toolName);
    }

    const startedAt = new Date().toISOString();
    const executionId = crypto.randomUUID();

    try {
      const toolResult = await this.service.executeTool(toolName, body.parameters);

      const result: ToolExecutionResult = {
        executionId,
        toolName,
        status: toolResult.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED,
        startedAt,
        completedAt: new Date().toISOString(),
        duration: toolResult.duration,
        result: {
          success: toolResult.success,
          data: toolResult.data,
        },
        context: body.context,
      };

      return this.created(result, request.id as string, reply);
    } catch (error) {
      // Re-throw validation errors to be handled by error middleware
      if (error instanceof Error && error.name === 'ApiException') {
        throw error;
      }

      const result: ToolExecutionResult = {
        executionId,
        toolName,
        status: ExecutionStatus.FAILED,
        startedAt,
        completedAt: new Date().toISOString(),
        result: {
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        },
        context: body.context,
      };

      return this.created(result, request.id as string, reply);
    }
  }

  private async batchExecute(
    request: TypedRequest<BatchExecuteRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Batch executing tools', { count: body.executions.length, parallel: body.parallel });

    const startTime = Date.now();
    const batchResults = await this.service.batchExecute(
      body.executions.map((exec) => ({
        tool: exec.toolName,
        params: exec.parameters,
      }))
    );

    let successCount = 0;
    let failedCount = 0;
    const results = batchResults.map((r, i) => {
      const exec = body.executions[i];
      if (r.result.success) {
        successCount++;
        return {
          id: exec.id,
          toolName: exec.toolName,
          status: ExecutionStatus.COMPLETED,
          result: r.result.data,
          duration: 0,
        };
      } else {
        failedCount++;
        return {
          id: exec.id,
          toolName: exec.toolName,
          status: ExecutionStatus.FAILED,
          error: {
            code: 'EXECUTION_ERROR',
            message: r.result.error || 'Tool execution failed',
          },
        };
      }
    });

    const result: BatchExecutionResult = {
      batchId: crypto.randomUUID(),
      status: failedCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'partial'),
      totalCount: body.executions.length,
      successCount,
      failedCount,
      results,
      totalDuration: Date.now() - startTime,
    };

    return this.created(result, request.id as string, reply);
  }

  private async validateParameters(
    request: TypedRequest<{ parameters: Record<string, unknown> }, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolValidationResult>> {
    const { toolName } = request.params;
    const body = request.body;

    this.logger.info('Validating tool parameters', { toolName });

    const toolInfo = await this.service.getTool(toolName);
    if (!toolInfo) {
      throw new NotFoundException('Tool', toolName);
    }

    const validation = await this.service.validateParams(toolName, body.parameters);

    const result: ToolValidationResult = {
      valid: validation.valid,
      errors: validation.errors?.map((err: { field: string; message: string }) => ({
        parameter: err.field,
        message: err.message,
        code: 'VALIDATION_ERROR',
      })),
    };

    return this.success(result, request.id as string);
  }

  private async getExecutionHistory(
    request: TypedRequest<unknown, ToolNameParam, ExecutionHistoryQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<ToolExecutionResult[]>> {
    const { toolName } = request.params;
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);

    this.logger.info('Getting tool execution history', { toolName, page, limit });

    const toolInfo = await this.service.getTool(toolName);
    if (!toolInfo) {
      throw new NotFoundException('Tool', toolName);
    }

    const history = await this.service.getExecutionHistory(toolName, { page, limit });

    const results: ToolExecutionResult[] = history.records.map((record) => ({
      executionId: record.id,
      toolName: record.toolName,
      status: record.result.success ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED,
      startedAt: record.executedAt.toISOString(),
      duration: record.duration,
      result: {
        success: record.result.success,
        data: record.result.data,
        error: record.result.error ? {
          code: 'EXECUTION_ERROR',
          message: record.result.error,
        } : undefined,
      },
    }));

    return this.listResponse(results, history.total, { page, limit }, request.id as string);
  }

  private async getToolStats(
    request: TypedRequest<unknown, ToolNameParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { toolName } = request.params;

    this.logger.info('Getting tool stats', { toolName });

    const toolInfo = await this.service.getTool(toolName);
    if (!toolInfo) {
      throw new NotFoundException('Tool', toolName);
    }

    const stats = await this.service.getToolStats(toolName);

    return this.success({
      totalExecutions: stats?.totalExecutions || 0,
      successfulExecutions: stats?.successCount || 0,
      failedExecutions: stats?.failureCount || 0,
      averageDuration: stats?.averageDuration || 0,
      minDuration: 0,
      maxDuration: 0,
      successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
      executionsLast24h: 0,
      executionsLast7d: 0,
      lastExecutedAt: stats?.lastExecutedAt?.toISOString() || null,
    }, request.id as string);
  }
}

export function createToolsRouter(): ToolsRouter {
  return new ToolsRouter();
}
