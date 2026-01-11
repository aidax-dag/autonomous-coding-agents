/**
 * Base Router
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/routes/base
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  IRouter,
  RouteDefinition,
  ApiResponse,
  PaginationMeta,
  ListQueryParams,
} from '../interfaces/api.interface.js';
import { ApiStatusCode } from '../interfaces/api.interface.js';
import { ILogger, createLogger } from '../../core/services/logger.js';

/**
 * Abstract base router
 */
export abstract class BaseRouter implements IRouter {
  abstract readonly prefix: string;
  protected readonly logger: ILogger;
  protected routes: RouteDefinition[] = [];

  constructor(loggerName?: string) {
    this.logger = createLogger(loggerName || this.constructor.name);
  }

  /**
   * Get all route definitions
   */
  getRoutes(): RouteDefinition[] {
    return this.routes;
  }

  /**
   * Register router on Fastify instance
   */
  async register(instance: FastifyInstance): Promise<void> {
    for (const route of this.routes) {
      const fullPath = `${this.prefix}${route.path}`;

      instance.route({
        method: route.method,
        url: fullPath,
        schema: route.schema,
        preHandler: route.middleware,
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
          const startTime = Date.now();

          try {
            const result = await route.handler(request as never, reply);

            // If handler already sent response (returns FastifyReply), don't send again
            if (reply.sent) {
              return;
            }

            // Add metadata if not present
            if (result && typeof result === 'object') {
              const response = result as ApiResponse;
              if (!response.meta) {
                response.meta = {
                  requestId: request.id as string,
                  timestamp: new Date().toISOString(),
                  duration: Date.now() - startTime,
                };
              } else {
                response.meta.duration = Date.now() - startTime;
              }
            }

            return reply.send(result);
          } catch (error) {
            throw error;
          }
        },
      });

      this.logger.debug(`Route registered: ${route.method} ${fullPath}`);
    }

    this.logger.info(`Router registered with ${this.routes.length} routes`, {
      prefix: this.prefix,
    });
  }

  /**
   * Create success response
   */
  protected success<T>(data: T, requestId: string): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Create list response with pagination
   */
  protected listResponse<T>(
    items: T[],
    total: number,
    params: ListQueryParams,
    requestId: string
  ): ApiResponse<T[]> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(total / limit);

    const pagination: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };

    return {
      success: true,
      data: items,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        pagination,
      },
    };
  }

  /**
   * Create created response
   */
  protected created<T>(data: T, requestId: string, reply: FastifyReply): FastifyReply {
    return reply.status(ApiStatusCode.CREATED).send({
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Create no content response
   */
  protected noContent(reply: FastifyReply): FastifyReply {
    return reply.status(ApiStatusCode.NO_CONTENT).send();
  }

  /**
   * Parse pagination from query
   */
  protected parsePagination(query: Record<string, unknown>): { page: number; limit: number; offset: number } {
    const page = Math.max(1, parseInt(String(query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10)));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Parse sort from query
   */
  protected parseSort(query: Record<string, unknown>): { sortBy?: string; sortOrder: 'asc' | 'desc' } {
    return {
      sortBy: query.sortBy as string | undefined,
      sortOrder: (query.sortOrder as 'asc' | 'desc') || 'desc',
    };
  }
}
