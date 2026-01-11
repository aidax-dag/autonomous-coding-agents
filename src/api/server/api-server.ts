/**
 * REST API Server Implementation
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/server
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';

import type {
  IApiServer,
  ApiServerConfig,
  ApiServerHealth,
  RouteDefinition,
  FastifyPluginAsync,
  ApiResponse,
  ApiError,
  RequestContext,
} from '../interfaces/api.interface.js';
import { DEFAULT_API_CONFIG, API_ERROR_CODES, ApiStatusCode } from '../interfaces/api.interface.js';
import { ILogger } from '../../core/services/logger.interface.js';
import { createLogger } from '../../core/services/logger.js';

/**
 * REST API Server
 *
 * Fastify-based HTTP server for the agent orchestration system.
 */
export class ApiServer implements IApiServer {
  private readonly instance: FastifyInstance;
  private readonly config: Required<ApiServerConfig>;
  private readonly logger: ILogger;
  private running = false;
  private startedAt: Date | null = null;
  private requestsServed = 0;

  constructor(config: Partial<ApiServerConfig> = {}) {
    this.config = this.mergeConfig(config);
    this.logger = createLogger('ApiServer');

    // Create Fastify instance
    this.instance = Fastify({
      logger: this.config.logging.enabled
        ? {
            level: this.config.logging.level,
            transport: this.config.logging.prettyPrint
              ? { target: 'pino-pretty', options: { colorize: true } }
              : undefined,
            redact: [
              ...(this.config.logging.redactHeaders || []).map((h) => `headers.${h}`),
              ...(this.config.logging.redactPaths || []),
            ],
          }
        : false,
      requestIdHeader: 'x-request-id',
      genReqId: () => randomUUID(),
      trustProxy: true,
    });

    this.setupHooks();
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(config: Partial<ApiServerConfig>): Required<ApiServerConfig> {
    return {
      ...DEFAULT_API_CONFIG,
      ...config,
      cors: { ...DEFAULT_API_CONFIG.cors, ...config.cors },
      helmet: { ...DEFAULT_API_CONFIG.helmet, ...config.helmet },
      rateLimit: { ...DEFAULT_API_CONFIG.rateLimit, ...config.rateLimit },
      logging: { ...DEFAULT_API_CONFIG.logging, ...config.logging },
      gracefulShutdown: { ...DEFAULT_API_CONFIG.gracefulShutdown, ...config.gracefulShutdown },
      swagger: config.swagger || { enabled: false },
      auth: config.auth || { enabled: false },
    } as Required<ApiServerConfig>;
  }

  /**
   * Setup request/response hooks
   */
  private setupHooks(): void {
    // Add request context
    this.instance.addHook('onRequest', async (request) => {
      (request as FastifyRequest & { context: RequestContext }).context = {
        requestId: request.id as string,
        timestamp: new Date(),
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      };
    });

    // Count requests
    this.instance.addHook('onResponse', async () => {
      this.requestsServed++;
    });

    // Error handler
    this.instance.setErrorHandler(async (error, request, reply) => {
      const err = error as Error & {
        statusCode?: number;
        code?: string;
        validation?: Array<{
          instancePath?: string;
          message?: string;
          keyword?: string;
          params?: { missingProperty?: string };
        }>;
      };
      const statusCode = err.statusCode || ApiStatusCode.INTERNAL_ERROR;
      const apiError: ApiError = {
        code: err.code || API_ERROR_CODES.INTERNAL_ERROR,
        message: err.message,
        details:
          statusCode === ApiStatusCode.VALIDATION_ERROR && err.validation
            ? err.validation.map((v) => ({
                field: v.params?.missingProperty || v.instancePath || '',
                message: v.message || 'Validation failed',
                code: v.keyword || 'validation',
              }))
            : undefined,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      };

      const response: ApiResponse = {
        success: false,
        error: apiError,
        meta: {
          requestId: request.id as string,
          timestamp: new Date().toISOString(),
        },
      };

      this.logger.error('Request error', { error: err, requestId: request.id });
      return reply.status(statusCode).send(response);
    });

    // Not found handler
    this.instance.setNotFoundHandler(async (request, reply) => {
      const response: ApiResponse = {
        success: false,
        error: {
          code: API_ERROR_CODES.NOT_FOUND,
          message: `Route ${request.method} ${request.url} not found`,
        },
        meta: {
          requestId: request.id as string,
          timestamp: new Date().toISOString(),
        },
      };

      return reply.status(ApiStatusCode.NOT_FOUND).send(response);
    });
  }

  /**
   * Initialize plugins
   */
  private async initializePlugins(): Promise<void> {
    // CORS
    if (this.config.cors.enabled) {
      await this.instance.register(cors, {
        origin: this.config.cors.origin,
        methods: this.config.cors.methods,
        allowedHeaders: this.config.cors.allowedHeaders,
        exposedHeaders: this.config.cors.exposedHeaders,
        credentials: this.config.cors.credentials,
        maxAge: this.config.cors.maxAge,
      });
      this.logger.debug('CORS plugin registered');
    }

    // Helmet (security headers)
    if (this.config.helmet.enabled) {
      await this.instance.register(helmet, {
        contentSecurityPolicy: this.config.helmet.contentSecurityPolicy,
      });
      this.logger.debug('Helmet plugin registered');
    }

    // Rate limiting
    if (this.config.rateLimit) {
      await this.instance.register(rateLimit, {
        max: this.config.rateLimit.max,
        timeWindow: this.config.rateLimit.timeWindow,
        keyGenerator: this.config.rateLimit.keyGenerator,
        errorResponseBuilder: (request, context) => ({
          success: false,
          error: {
            code: API_ERROR_CODES.RATE_LIMITED,
            message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)} seconds`,
          },
          meta: {
            requestId: request.id,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      this.logger.debug('Rate limit plugin registered');
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    if (!this.config.gracefulShutdown.enabled) return;

    const shutdown = async (signal: string): Promise<void> => {
      this.logger.info(`Received ${signal}, starting graceful shutdown`);

      try {
        await this.stop();
        this.logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        this.logger.error('Error during graceful shutdown', { error });
        process.exit(1);
      }
    };

    for (const signal of this.config.gracefulShutdown.signals || ['SIGTERM', 'SIGINT']) {
      process.on(signal, () => shutdown(signal));
    }
  }

  /**
   * Register health check endpoint
   */
  private registerHealthEndpoint(): void {
    this.instance.get(`${this.config.prefix}/health`, async (request, reply) => {
      const health = this.getHealth();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      return reply.status(statusCode).send({
        success: true,
        data: health,
        meta: {
          requestId: request.id,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  /**
   * Get Fastify instance
   */
  getInstance(): FastifyInstance {
    return this.instance;
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Server is already running');
    }

    try {
      // Initialize plugins
      await this.initializePlugins();

      // Register health endpoint
      this.registerHealthEndpoint();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      // Start listening
      const address = await this.instance.listen({
        host: this.config.host,
        port: this.config.port,
      });

      this.running = true;
      this.startedAt = new Date();

      this.logger.info(`API server started at ${address}`, {
        host: this.config.host,
        port: this.config.port,
        prefix: this.config.prefix,
      });
    } catch (error) {
      this.logger.error('Failed to start API server', { error });
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    try {
      await this.instance.close();
      this.running = false;
      this.logger.info('API server stopped');
    } catch (error) {
      this.logger.error('Error stopping API server', { error });
      throw error;
    }
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get server address
   */
  getAddress(): string | null {
    if (!this.running) return null;

    const addresses = this.instance.addresses();
    if (addresses.length === 0) return null;

    const addr = addresses[0];
    return `http://${addr.address}:${addr.port}`;
  }

  /**
   * Register routes
   */
  registerRoutes(routes: RouteDefinition[]): void {
    for (const route of routes) {
      const fullPath = route.path.startsWith(this.config.prefix)
        ? route.path
        : `${this.config.prefix}${route.path}`;

      this.instance.route({
        method: route.method,
        url: fullPath,
        schema: route.schema,
        preHandler: route.middleware,
        handler: async (request: FastifyRequest, reply: FastifyReply) => {
          const startTime = Date.now();

          try {
            const result = await route.handler(request as never, reply);

            // Add metadata if not present
            if (result && !result.meta) {
              result.meta = {
                requestId: request.id as string,
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime,
              };
            } else if (result?.meta) {
              result.meta.duration = Date.now() - startTime;
            }

            return reply.send(result);
          } catch (error) {
            throw error;
          }
        },
      });

      this.logger.debug(`Route registered: ${route.method} ${fullPath}`);
    }
  }

  /**
   * Register plugin
   */
  async registerPlugin(
    plugin: FastifyPluginAsync,
    options: Record<string, unknown> = {}
  ): Promise<void> {
    await this.instance.register(plugin, options);
  }

  /**
   * Get server health
   */
  getHealth(): ApiServerHealth {
    const uptime = this.startedAt ? Date.now() - this.startedAt.getTime() : 0;

    // Simple health check - could be extended with dependency checks
    const status: ApiServerHealth['status'] = this.running ? 'healthy' : 'unhealthy';

    return {
      status,
      uptime,
      startedAt: this.startedAt || new Date(),
      requestsServed: this.requestsServed,
      activeConnections: 0, // Fastify doesn't expose this directly
      details: {
        version: '1.0.0',
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
    };
  }
}

/**
 * Create API server instance
 */
export function createApiServer(config?: Partial<ApiServerConfig>): IApiServer {
  return new ApiServer(config);
}
