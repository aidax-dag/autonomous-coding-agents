#!/usr/bin/env tsx
/**
 * API Server Entry Point
 *
 * Feature: F4.1 - REST API Interface
 * Feature: F4.2 - WebSocket API
 *
 * Starts the Fastify-based REST API server for the autonomous coding agents system.
 * This server provides endpoints for:
 * - Agent management
 * - Workflow execution
 * - Tools and hooks
 * - Dashboard and metrics
 *
 * Usage:
 *   npm run dev:api       # Development mode with hot reload
 *   npm run start:api     # Production mode
 *
 * Environment Variables:
 *   API_HOST       - Host to bind to (default: 0.0.0.0)
 *   API_PORT       - Port to listen on (default: 3001)
 *   API_PREFIX     - API path prefix (default: /api)
 *   NODE_ENV       - Environment (development|production|test)
 *   CORS_ORIGIN    - CORS origin (default: *)
 *   ENABLE_SWAGGER - Enable Swagger docs (default: true in dev)
 *   LOG_LEVEL      - Log level (default: info)
 */

import dotenv from 'dotenv';
dotenv.config();

import { createApiServer, createWsServer } from '../api/server/index.js';
import {
  AgentsRouter,
  WorkflowsRouter,
  ToolsRouter,
  HooksRouter,
} from '../api/routes/index.js';
import { createLogger } from '../core/services/logger.js';
import type { ApiServerConfig } from '../api/interfaces/api.interface.js';
import { createAgentsService } from '../api/services/agents.service.js';
import { createWorkflowsService } from '../api/services/workflows.service.js';
import { createDashboardService, DashboardService } from '../api/services/dashboard.service.js';

const logger = createLogger('ApiServerBootstrap');

// Configuration from environment
const config: Partial<ApiServerConfig> = {
  host: process.env.API_HOST || '0.0.0.0',
  port: parseInt(process.env.API_PORT || '3001', 10),
  prefix: process.env.API_PREFIX || '/api',
  cors: {
    enabled: true,
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  },
  helmet: {
    enabled: process.env.NODE_ENV === 'production',
    contentSecurityPolicy: false,
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
  },
  logging: {
    enabled: true,
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production',
  },
  swagger: {
    enabled: process.env.ENABLE_SWAGGER !== 'false' && process.env.NODE_ENV !== 'production',
    title: 'CodeAvengers API',
    description: 'REST API for the Autonomous Coding Agents System',
    version: '1.0.0',
    basePath: '/docs',
  },
  gracefulShutdown: {
    enabled: true,
    timeout: 10000,
    signals: ['SIGTERM', 'SIGINT'],
  },
};

async function startServer(): Promise<void> {
  logger.info('Starting API server...', {
    host: config.host,
    port: config.port,
    prefix: config.prefix,
    env: process.env.NODE_ENV || 'development',
  });

  try {
    // Create services
    const agentsService = createAgentsService();
    const workflowsService = createWorkflowsService();
    const dashboardService = createDashboardService(agentsService, workflowsService);

    // Create API server
    const apiServer = createApiServer(config);
    const fastify = apiServer.getInstance();

    // Register routers
    const routers = [
      new AgentsRouter(),
      new WorkflowsRouter(),
      new ToolsRouter(),
      new HooksRouter(),
    ];

    for (const router of routers) {
      const routes = router.getRoutes();
      for (const route of routes) {
        const fullPath = `${config.prefix}${router.prefix}${route.path}`;
        fastify.route({
          method: route.method,
          url: fullPath,
          schema: route.schema,
          preHandler: route.middleware,
          handler: route.handler as never,
        });
        logger.debug(`Route registered: ${route.method} ${fullPath}`);
      }
    }

    // Register dashboard routes for web client compatibility
    registerDashboardRoutes(fastify, config.prefix || '/api', dashboardService);

    // Start WebSocket server (optional)
    const wsPort = parseInt(process.env.WS_PORT || '3002', 10);
    if (process.env.ENABLE_WS !== 'false') {
      const wsServer = createWsServer({
        port: wsPort,
        pingInterval: 30000,
        maxConnections: 100,
      });
      await wsServer.start();
      logger.info(`WebSocket server started on port ${wsPort}`);
    }

    // Start API server
    await apiServer.start();

    const address = apiServer.getAddress();
    logger.info(`🚀 API server ready at ${address}`);
    logger.info(`📚 API docs available at ${address}/docs`);

    // Print startup summary
    console.log('\n' + '='.repeat(60));
    console.log('  CodeAvengers API Server');
    console.log('='.repeat(60));
    console.log(`  REST API:    ${address}`);
    console.log(`  Swagger UI:  ${address}/docs`);
    console.log(`  Health:      ${address}${config.prefix}/health`);
    if (process.env.ENABLE_WS !== 'false') {
      console.log(`  WebSocket:   ws://${config.host}:${wsPort}`);
    }
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    logger.error('Failed to start API server', { error });
    process.exit(1);
  }
}

/**
 * Register dashboard routes for web client compatibility
 */
function registerDashboardRoutes(
  fastify: ReturnType<ReturnType<typeof createApiServer>['getInstance']>,
  prefix: string,
  dashboardService: DashboardService
): void {
  // Dashboard stats endpoint
  fastify.get(`${prefix}/dashboard/stats`, async (request, reply) => {
    const stats = await dashboardService.getStats();

    return reply.send({
      success: true,
      data: stats,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Projects endpoints (placeholder)
  fastify.get(`${prefix}/projects`, async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  fastify.post(`${prefix}/projects`, async (request, reply) => {
    return reply.status(201).send({
      success: true,
      data: { id: 'placeholder', ...request.body as object },
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Logs endpoints (placeholder)
  fastify.get(`${prefix}/logs`, async (request, reply) => {
    return reply.send({
      success: true,
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 50,
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
    });
  });

  logger.debug('Dashboard routes registered');
}

// Start the server
startServer().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
