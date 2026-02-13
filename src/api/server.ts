#!/usr/bin/env node
/**
 * API Server
 *
 * Standalone entry point for the ACA web API.
 * Initializes OrchestratorRunner, HUD dashboard, ACP message bus,
 * and web dashboard with proper lifecycle management.
 *
 * Usage:
 *   node dist/api/server.js              # direct execution
 *   tsx src/api/server.ts                 # development
 *   runner serve                          # via CLI
 *
 * @module api/server
 */

import dotenv from 'dotenv';
import { createRunnerFromEnv } from '../core/orchestrator/runner-config';
import { createHUDDashboard, createMetricsCollector } from '../core/hud';
import { createACPMessageBus } from '../core/protocols';
import { createWebDashboard } from '../ui/web/web-dashboard';
import { createRequestLogger } from './middleware/request-logger';
import { installErrorHandler } from './middleware/error-handler';
import { installLoginHandler } from './auth/login-handler';
import { createJWTService } from './auth/jwt';
import { logger } from '../shared/logging/logger';
import type { OrchestratorRunner } from '../core/orchestrator/orchestrator-runner';
import type { WebDashboardApp } from '../ui/web/web-dashboard';

dotenv.config();

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

export interface APIServerOptions {
  port?: number;
  host?: string;
}

export interface APIServerHandle {
  runner: OrchestratorRunner;
  dashboard: WebDashboardApp;
  shutdown: () => Promise<void>;
}

/**
 * Start the API server with full OrchestratorRunner integration.
 *
 * 1. Creates OrchestratorRunner from environment config
 * 2. Creates HUD dashboard + metrics collector
 * 3. Creates ACP message bus
 * 4. Creates WebDashboard with all dependencies
 * 5. Installs request logging + error normalization middleware
 * 6. Wires runner events to HUD
 * 7. Starts runner then HTTP listener
 */
export async function startAPIServer(options: APIServerOptions = {}): Promise<APIServerHandle> {
  const port = options.port ?? parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  const host = options.host ?? process.env.HOST ?? DEFAULT_HOST;

  logger.info('Starting API server', { port, host });

  // 1. Create OrchestratorRunner from environment config
  const runner = createRunnerFromEnv();

  // 2. Create HUD dashboard with metrics
  const metrics = createMetricsCollector();
  const hudDashboard = createHUDDashboard({ metrics });

  // 3. Create ACP message bus
  const messageBus = createACPMessageBus();

  // 4. Create web dashboard with all dependencies
  const dashboard = createWebDashboard({
    config: { server: { port, host } },
    dashboard: hudDashboard,
    messageBus,
  });

  // 5. Install middleware on the web server
  const webServer = dashboard.getServer();
  const requestLogger = createRequestLogger();
  requestLogger.install(webServer);
  installErrorHandler(webServer);

  // 5b. Install login endpoint (JWT-based authentication)
  const jwtSecret = process.env.JWT_SECRET ?? '';
  if (jwtSecret.length >= 16) {
    const jwtService = createJWTService({ secret: jwtSecret });
    installLoginHandler(webServer, { jwtService });
    logger.info('Login endpoint installed');
  } else {
    logger.warn('JWT_SECRET not configured (min 16 chars) — login endpoint disabled');
  }

  // 6. Wire runner events to HUD
  runner.on('workflow:started', (taskId) => {
    hudDashboard.updateAgent({
      agentId: taskId,
      agentType: 'task',
      state: 'working',
      currentTask: taskId,
      progress: 0,
      tokensUsed: 0,
      elapsedMs: 0,
      updatedAt: new Date().toISOString(),
    });
  });

  runner.on('workflow:completed', (result) => {
    hudDashboard.updateAgent({
      agentId: result.taskId,
      agentType: result.teamType,
      state: result.success ? 'completed' : 'error',
      progress: 100,
      tokensUsed: 0,
      elapsedMs: result.duration,
      updatedAt: new Date().toISOString(),
    });
  });

  runner.on('error', (error) => {
    hudDashboard.addWarning(error.message);
  });

  // 7. Start the orchestrator runner
  await runner.start();
  logger.info('Orchestrator runner started');

  // 8. Start the web dashboard (HTTP listener)
  await dashboard.start();
  logger.info(`API server listening on http://${host}:${port}`);

  // 9. Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down API server...');
    await dashboard.stop();
    await runner.destroy();
    logger.info('API server stopped');
  };

  return { runner, dashboard, shutdown };
}

// ── Direct execution entry point ────────────────────────────────

async function main(): Promise<void> {
  let shutdownFn: (() => Promise<void>) | null = null;
  let shuttingDown = false;

  const handleSignal = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}`);
    if (shutdownFn) {
      await shutdownFn();
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));

  try {
    const { shutdown } = await startAPIServer();
    shutdownFn = shutdown;
  } catch (error) {
    logger.error('Failed to start API server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

// Detect direct execution (works for both CJS and ESM compiled output)
const isDirectExecution = process.argv[1]?.replace(/\\/g, '/').includes('/api/server.');
if (isDirectExecution) {
  main();
}
