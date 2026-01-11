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
  HookStatus,
} from '../interfaces/hook-api.interface.js';
import { NotFoundException } from '../middleware/error.middleware.js';
import { HookEvent } from '../../core/interfaces/hook.interface.js';

/**
 * Hooks API Router
 */
export class HooksRouter extends BaseRouter {
  readonly prefix = '/hooks';

  constructor() {
    super('HooksRouter');
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

    this.logger.info('Listing hooks', { page, limit });

    return this.listResponse([], 0, { page, limit }, request.id as string);
  }

  private async registerHook(
    request: TypedRequest<RegisterHookRequest, unknown, unknown>,
    reply: FastifyReply
  ): Promise<FastifyReply> {
    const body = request.body;

    this.logger.info('Registering hook', { name: body.name, event: body.event });

    const hook: HookDetail = {
      id: crypto.randomUUID(),
      name: body.name,
      description: body.description,
      event: body.event,
      priority: body.priority || 50,
      status: 'active' as HookStatus,
      executionCount: 0,
      createdAt: new Date().toISOString(),
      conditions: body.conditions || [],
      config: {
        name: body.name,
        event: body.event,
        priority: body.priority ?? 0,
        enabled: true,
        timeout: body.timeout,
        retryOnError: body.retryOnError,
      },
      timeout: body.timeout || 30000,
      retryOnError: body.retryOnError || false,
      maxRetries: body.maxRetries || 3,
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        skippedExecutions: 0,
        averageDuration: 0,
        successRate: 0,
        executionsLast24h: 0,
        errorRate: 0,
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

    throw new NotFoundException('Hook', hookId);
  }

  private async updateHook(
    request: TypedRequest<UpdateHookRequest, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookDetail>> {
    const { hookId } = request.params;

    this.logger.info('Updating hook', { hookId });

    throw new NotFoundException('Hook', hookId);
  }

  private async unregisterHook(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<{ unregistered: boolean; hookId: string }>> {
    const { hookId } = request.params;

    this.logger.info('Unregistering hook', { hookId });

    throw new NotFoundException('Hook', hookId);
  }

  private async enableHook(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { hookId } = request.params;

    this.logger.info('Enabling hook', { hookId });

    throw new NotFoundException('Hook', hookId);
  }

  private async disableHook(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { hookId } = request.params;

    this.logger.info('Disabling hook', { hookId });

    throw new NotFoundException('Hook', hookId);
  }

  private async testHook(
    request: TypedRequest<TestHookRequest, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookTestResult>> {
    const { hookId } = request.params;
    const body = request.body;

    this.logger.info('Testing hook', { hookId, dryRun: body.dryRun });

    throw new NotFoundException('Hook', hookId);
  }

  private async getExecutionHistory(
    request: TypedRequest<unknown, HookIdParam, HookExecutionHistoryQuery>,
    _reply: FastifyReply
  ): Promise<ApiResponse<HookExecutionRecord[]>> {
    const { hookId } = request.params;
    const { page, limit } = this.parsePagination(request.query as Record<string, unknown>);

    this.logger.info('Getting hook execution history', { hookId, page, limit });

    return this.listResponse([], 0, { page, limit }, request.id as string);
  }

  private async getHookStats(
    request: TypedRequest<unknown, HookIdParam, unknown>,
    _reply: FastifyReply
  ): Promise<ApiResponse> {
    const { hookId } = request.params;

    this.logger.info('Getting hook stats', { hookId });

    throw new NotFoundException('Hook', hookId);
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
