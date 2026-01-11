/**
 * Hooks Router
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/routes/hooks
 */

import { FastifyReply } from 'fastify';
import { BaseRouter } from './base.router.js';
import type { TypedRequest, ApiResponse } from '../interfaces/api.interface.js';
import type {
  RegisterHookRequest,
  UpdateHookRequest,
  TestHookRequest,
  HookListQuery,
  HookExecutionHistoryQuery,
  HookIdParam,
  HookDetail,
  HookSummary,
  HookTestResult,
  HookExecutionRecord,
  AvailableEventsResponse,
} from '../interfaces/hook-api.interface.js';
import { HookStatus, HookExecutionStatus } from '../interfaces/hook-api.interface.js';
import { NotFoundException } from '../middleware/error.middleware.js';
import { HookEvent } from '../../core/interfaces/hook.interface.js';
import { HooksService, createHooksService } from '../services/hooks.service.js';

/**
 * Hooks API Router
 */
export class HooksRouter extends BaseRouter {
  readonly prefix = '/hooks';
  private readonly service: HooksService;

  constructor(service?: HooksService) {
    super('HooksRouter');
    this.service = service || createHooksService();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.routes = [
      // List hooks
      {
        method: 'GET',
        path: '',
        handler: this.listHooks.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'List all registered hooks',
          querystring: {
            type: 'object',
            properties: {
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
              event: { type: 'string', enum: Object.values(HookEvent) },
              status: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },

      // Register hook
      {
        method: 'POST',
        path: '',
        handler: this.registerHook.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Register a new hook',
          body: {
            type: 'object',
            required: ['name', 'event'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 100 },
              description: { type: 'string', maxLength: 500 },
              event: { type: 'string', enum: Object.values(HookEvent) },
              priority: { type: 'integer', minimum: 0, maximum: 100, default: 50 },
              conditions: { type: 'array', items: { type: 'object' } },
              timeout: { type: 'integer', minimum: 1000, default: 30000 },
              retryOnError: { type: 'boolean', default: false },
              maxRetries: { type: 'integer', minimum: 0, default: 3 },
              metadata: { type: 'object' },
            },
          },
        },
      },

      // Get hook
      {
        method: 'GET',
        path: '/:hookId',
        handler: this.getHook.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Get hook by ID',
          params: {
            type: 'object',
            required: ['hookId'],
            properties: {
              hookId: { type: 'string', format: 'uuid' },
            },
          },
        },
      },

      // Update hook
      {
        method: 'PATCH',
        path: '/:hookId',
        handler: this.updateHook.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Update hook configuration',
        },
      },

      // Unregister hook
      {
        method: 'DELETE',
        path: '/:hookId',
        handler: this.unregisterHook.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Unregister a hook',
        },
      },

      // Enable hook
      {
        method: 'POST',
        path: '/:hookId/enable',
        handler: this.enableHook.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Enable a hook',
        },
      },

      // Disable hook
      {
        method: 'POST',
        path: '/:hookId/disable',
        handler: this.disableHook.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Disable a hook',
        },
      },

      // Test hook
      {
        method: 'POST',
        path: '/:hookId/test',
        handler: this.testHook.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Test a hook with sample data',
          body: {
            type: 'object',
            required: ['context'],
            properties: {
              context: {
                type: 'object',
                required: ['event', 'data'],
                properties: {
                  event: { type: 'string', enum: Object.values(HookEvent) },
                  data: { type: 'object' },
                  metadata: { type: 'object' },
                },
              },
              dryRun: { type: 'boolean', default: true },
            },
          },
        },
      },

      // Get execution history
      {
        method: 'GET',
        path: '/:hookId/executions',
        handler: this.getExecutionHistory.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Get hook execution history',
        },
      },

      // Get hook stats
      {
        method: 'GET',
        path: '/:hookId/stats',
        handler: this.getHookStats.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Get hook statistics',
        },
      },

      // Get available events
      {
        method: 'GET',
        path: '/events/available',
        handler: this.getAvailableEvents.bind(this),
        schema: {
          tags: ['Hooks'],
          summary: 'Get list of available events',
        },
      },
    ];
  }

  // ==================== Route Handlers ====================

  private async listHooks(
    request: TypedRequest<unknown, unknown, HookListQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookSummary[]>> {
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);
    const query = request.query || {};

    this.logger.info('Listing hooks', { page, limit });

    const eventFilter = Array.isArray(query.event) ? query.event[0] : query.event;
    const statusFilter = Array.isArray(query.status) ? query.status[0] : query.status;

    const result = await this.service.listHooks({
      type: undefined,
      event: eventFilter as string | undefined,
      enabled: statusFilter === HookStatus.ACTIVE ? true : (statusFilter === HookStatus.DISABLED ? false : undefined),
      search: query.name,
      page,
      limit,
    });

    const summaries: HookSummary[] = result.hooks.map((hook) => ({
      id: hook.id,
      name: hook.name,
      type: hook.type,
      event: hook.event as HookEvent,
      priority: hook.priority,
      status: hook.enabled ? HookStatus.ACTIVE : HookStatus.DISABLED,
      executionCount: 0,
      createdAt: hook.createdAt.toISOString(),
    }));

    return this.listResponse(summaries, result.total, { page, limit }, request.id as string);
  }

  private async registerHook(
    request: TypedRequest<RegisterHookRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Registering hook', { name: body.name, event: body.event });

    const hookInfo = await this.service.registerHook({
      name: body.name,
      type: body.type || 'custom',
      event: body.event,
      priority: body.priority,
      enabled: true,
      description: body.description,
      config: {
        timeout: body.timeout,
        retryOnError: body.retryOnError,
        maxRetries: body.maxRetries,
        conditions: body.conditions,
        metadata: body.metadata,
      },
    });

    const stats = await this.service.getHookStats(hookInfo.id);

    const hook: HookDetail = {
      id: hookInfo.id,
      name: hookInfo.name,
      type: hookInfo.type,
      description: hookInfo.description,
      event: hookInfo.event as HookEvent,
      priority: hookInfo.priority,
      status: hookInfo.enabled ? HookStatus.ACTIVE : HookStatus.DISABLED,
      executionCount: stats?.totalExecutions || 0,
      createdAt: hookInfo.createdAt.toISOString(),
      conditions: body.conditions || [],
      config: {
        name: hookInfo.name,
        event: hookInfo.event as HookEvent,
        priority: hookInfo.priority,
        enabled: hookInfo.enabled,
        timeout: body.timeout,
        retryOnError: body.retryOnError,
      },
      timeout: body.timeout || 30000,
      retryOnError: body.retryOnError || false,
      maxRetries: body.maxRetries || 3,
      stats: {
        totalExecutions: stats?.totalExecutions || 0,
        successfulExecutions: stats?.successCount || 0,
        failedExecutions: stats?.failureCount || 0,
        skippedExecutions: 0,
        averageDuration: stats?.averageDuration || 0,
        successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
        executionsLast24h: 0,
        errorRate: stats && stats.totalExecutions > 0 ? stats.failureCount / stats.totalExecutions : 0,
      },
      metadata: body.metadata,
    };

    return this.created(hook, request.id as string, reply);
  }

  private async getHook(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookDetail>> {
    const { hookId } = request.params;

    this.logger.info('Getting hook', { hookId });

    const hookInfo = await this.service.getHook(hookId);
    if (!hookInfo) {
      throw new NotFoundException('Hook', hookId);
    }

    const stats = await this.service.getHookStats(hookId);

    const hook: HookDetail = {
      id: hookInfo.id,
      name: hookInfo.name,
      type: hookInfo.type,
      description: hookInfo.description,
      event: hookInfo.event as HookEvent,
      priority: hookInfo.priority,
      status: hookInfo.enabled ? HookStatus.ACTIVE : HookStatus.DISABLED,
      executionCount: stats?.totalExecutions || 0,
      createdAt: hookInfo.createdAt.toISOString(),
      conditions: [],
      config: {
        name: hookInfo.name,
        event: hookInfo.event as HookEvent,
        priority: hookInfo.priority,
        enabled: hookInfo.enabled,
      },
      timeout: 30000,
      retryOnError: false,
      maxRetries: 3,
      stats: {
        totalExecutions: stats?.totalExecutions || 0,
        successfulExecutions: stats?.successCount || 0,
        failedExecutions: stats?.failureCount || 0,
        skippedExecutions: 0,
        averageDuration: stats?.averageDuration || 0,
        successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
        executionsLast24h: 0,
        errorRate: stats && stats.totalExecutions > 0 ? stats.failureCount / stats.totalExecutions : 0,
      },
    };

    return this.success(hook, request.id as string);
  }

  private async updateHook(
    request: TypedRequest<UpdateHookRequest, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookDetail>> {
    const { hookId } = request.params;
    const body = request.body;

    this.logger.info('Updating hook', { hookId, updates: body });

    const hookInfo = await this.service.updateHook(hookId, {
      name: body.name,
      priority: body.priority,
      enabled: body.enabled,
      description: body.description,
      config: body.metadata as Record<string, unknown>,
    });

    if (!hookInfo) {
      throw new NotFoundException('Hook', hookId);
    }

    const stats = await this.service.getHookStats(hookId);

    const hook: HookDetail = {
      id: hookInfo.id,
      name: hookInfo.name,
      type: hookInfo.type,
      description: hookInfo.description,
      event: hookInfo.event as HookEvent,
      priority: hookInfo.priority,
      status: hookInfo.enabled ? HookStatus.ACTIVE : HookStatus.DISABLED,
      executionCount: stats?.totalExecutions || 0,
      createdAt: hookInfo.createdAt.toISOString(),
      conditions: body.conditions || [],
      config: {
        name: hookInfo.name,
        event: hookInfo.event as HookEvent,
        priority: hookInfo.priority,
        enabled: hookInfo.enabled,
        timeout: body.timeout,
        retryOnError: body.retryOnError,
      },
      timeout: body.timeout || 30000,
      retryOnError: body.retryOnError || false,
      maxRetries: body.maxRetries || 3,
      stats: {
        totalExecutions: stats?.totalExecutions || 0,
        successfulExecutions: stats?.successCount || 0,
        failedExecutions: stats?.failureCount || 0,
        skippedExecutions: 0,
        averageDuration: stats?.averageDuration || 0,
        successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
        executionsLast24h: 0,
        errorRate: stats && stats.totalExecutions > 0 ? stats.failureCount / stats.totalExecutions : 0,
      },
      metadata: body.metadata,
    };

    return this.success(hook, request.id as string);
  }

  private async unregisterHook(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ unregistered: boolean; hookId: string }>> {
    const { hookId } = request.params;

    this.logger.info('Unregistering hook', { hookId });

    const deleted = await this.service.unregisterHook(hookId);
    if (!deleted) {
      throw new NotFoundException('Hook', hookId);
    }

    return this.success({ unregistered: true, hookId }, request.id as string);
  }

  private async enableHook(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { hookId } = request.params;

    this.logger.info('Enabling hook', { hookId });

    const hookInfo = await this.service.enableHook(hookId);
    if (!hookInfo) {
      throw new NotFoundException('Hook', hookId);
    }

    return this.success({
      hookId: hookInfo.id,
      enabled: hookInfo.enabled,
      previousStatus: HookStatus.DISABLED,
      currentStatus: HookStatus.ACTIVE,
    }, request.id as string);
  }

  private async disableHook(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { hookId } = request.params;

    this.logger.info('Disabling hook', { hookId });

    const hookInfo = await this.service.disableHook(hookId);
    if (!hookInfo) {
      throw new NotFoundException('Hook', hookId);
    }

    return this.success({
      hookId: hookInfo.id,
      disabled: !hookInfo.enabled,
      previousStatus: HookStatus.ACTIVE,
      currentStatus: HookStatus.DISABLED,
    }, request.id as string);
  }

  private async testHook(
    request: TypedRequest<TestHookRequest, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookTestResult>> {
    const { hookId } = request.params;
    const body = request.body;

    this.logger.info('Testing hook', { hookId, dryRun: body.dryRun });

    const hookInfo = await this.service.getHook(hookId);
    if (!hookInfo) {
      throw new NotFoundException('Hook', hookId);
    }

    const testResult = await this.service.testHook(hookId, body.context?.data);

    const result: HookTestResult = {
      hookId,
      hookName: hookInfo.name,
      wouldExecute: testResult.success,
      conditionsMatched: testResult.success,
      conditionResults: [],
      dryRun: body.dryRun ?? true,
      result: testResult.success ? {
        action: 'continue' as import('../../core/interfaces/hook.interface.js').HookAction,
        data: testResult.result?.data as Record<string, unknown> | undefined,
        duration: testResult.duration,
      } : undefined,
      error: testResult.error ? {
        code: 'TEST_ERROR',
        message: testResult.error,
      } : undefined,
    };

    return this.success(result, request.id as string);
  }

  private async getExecutionHistory(
    request: TypedRequest<unknown, HookIdParam, HookExecutionHistoryQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookExecutionRecord[]>> {
    const { hookId } = request.params;
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);

    this.logger.info('Getting hook execution history', { hookId, page, limit });

    const hookInfo = await this.service.getHook(hookId);
    if (!hookInfo) {
      throw new NotFoundException('Hook', hookId);
    }

    const history = await this.service.getExecutionHistory(hookId, { page, limit });

    const records: HookExecutionRecord[] = history.records.map((record) => ({
      id: record.id,
      hookId,
      hookName: record.hookName,
      event: record.event as HookEvent,
      status: record.result.success ? HookExecutionStatus.COMPLETED : HookExecutionStatus.FAILED,
      startedAt: record.executedAt.toISOString(),
      completedAt: record.executedAt.toISOString(),
      duration: record.duration,
      output: record.result.success ? {
        action: 'continue' as import('../../core/interfaces/hook.interface.js').HookAction,
        data: record.result.data as Record<string, unknown> | undefined,
      } : undefined,
      error: record.result.error ? {
        code: 'EXECUTION_ERROR',
        message: record.result.error,
      } : undefined,
      retryCount: 0,
    }));

    return this.listResponse(records, history.total, { page, limit }, request.id as string);
  }

  private async getHookStats(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { hookId } = request.params;

    this.logger.info('Getting hook stats', { hookId });

    const hookInfo = await this.service.getHook(hookId);
    if (!hookInfo) {
      throw new NotFoundException('Hook', hookId);
    }

    const stats = await this.service.getHookStats(hookId);

    return this.success({
      totalExecutions: stats?.totalExecutions || 0,
      successfulExecutions: stats?.successCount || 0,
      failedExecutions: stats?.failureCount || 0,
      skippedExecutions: 0,
      averageDuration: stats?.averageDuration || 0,
      successRate: stats && stats.totalExecutions > 0 ? stats.successCount / stats.totalExecutions : 0,
      executionsLast24h: 0,
      errorRate: stats && stats.totalExecutions > 0 ? stats.failureCount / stats.totalExecutions : 0,
      lastExecutedAt: stats?.lastExecutedAt?.toISOString() || null,
    }, request.id as string);
  }

  private async getAvailableEvents(
    request: TypedRequest<unknown, unknown, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<AvailableEventsResponse>> {
    this.logger.info('Getting available events');

    const events = Object.values(HookEvent).map((event) => ({
      event,
      description: `${event} event`,
      dataSchema: {},
      registeredHooks: 0,
    }));

    return this.success({ events }, request.id as string);
  }
}

export function createHooksRouter(): HooksRouter {
  return new HooksRouter();
}
