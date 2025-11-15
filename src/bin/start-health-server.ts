#!/usr/bin/env node
/**
 * Health Server Entry Point
 *
 * Starts the health check and monitoring HTTP server.
 * Monitors all running agents and provides health endpoints.
 *
 * Feature: F5.3 - Health Check & Monitoring
 */

import { HealthServer } from '@/server/health-server';
import { AgentManager } from '@/agents/manager/agent-manager';
import { initializeNatsClient } from '@/shared/messaging/nats-client';
import { CoderAgent } from '@/agents/coder/coder-agent';
import { ReviewerAgent } from '@/agents/reviewer/reviewer-agent';
import { RepoManagerAgent } from '@/agents/repo-manager/repo-manager-agent';
import { AgentType, AgentConfig } from '@/agents/base/types';
import { createAgentLogger } from '@/shared/logging/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = createAgentLogger('MAIN', 'health-server-startup');

/**
 * Create agent configuration
 */
function createAgentConfig(type: AgentType, id: string, name: string): AgentConfig {
  return {
    id,
    type,
    name,
    llm: {
      provider: (process.env.LLM_PROVIDER as 'claude' | 'openai' | 'gemini') || 'claude',
      model: process.env.LLM_MODEL,
    },
    nats: {
      servers: (process.env.NATS_URL || 'nats://localhost:4222').split(','),
    },
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Health Server...', {
    nodeVersion: process.version,
    pid: process.pid,
    port: process.env.HEALTH_PORT || 3000,
  });

  try {
    // Initialize NATS client
    const natsClient = await initializeNatsClient({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      reconnect: true,
      maxReconnectAttempts: 10,
      reconnectTimeWait: 2000,
    });

    logger.info('NATS client connected');

    // Create Agent Manager
    const agentManager = new AgentManager(natsClient);
    await agentManager.start();

    logger.info('Agent Manager started');

    // Register agents (these should already be running via PM2)
    // This is just for monitoring - we don't start them here
    // In a real deployment, agents would be discovered dynamically

    // For now, register placeholder agents to demonstrate monitoring
    // In production, you'd discover agents via NATS or a service registry
    const coderConfig = createAgentConfig(
      AgentType.CODER,
      'coder-1',
      'Coder Agent'
    );
    const reviewerConfig = createAgentConfig(
      AgentType.REVIEWER,
      'reviewer-1',
      'Reviewer Agent'
    );
    const repoManagerConfig = createAgentConfig(
      AgentType.REPO_MANAGER,
      'repo-manager-1',
      'Repo Manager Agent'
    );

    // Note: In production, these agents would already be running
    // This health server just monitors their status
    const coderAgent = new CoderAgent(coderConfig, natsClient);
    const reviewerAgent = new ReviewerAgent(reviewerConfig, natsClient);
    const repoManagerAgent = new RepoManagerAgent(repoManagerConfig, natsClient);

    await agentManager.registerAgent(coderAgent);
    await agentManager.registerAgent(reviewerAgent);
    await agentManager.registerAgent(repoManagerAgent);

    logger.info('Agents registered for monitoring');

    // Create and start health server
    const healthServer = new HealthServer(
      {
        port: parseInt(process.env.HEALTH_PORT || '3000', 10),
        host: process.env.HEALTH_HOST || '0.0.0.0',
      },
      agentManager,
      natsClient
    );

    await healthServer.start();

    logger.info('Health Server started successfully', {
      port: process.env.HEALTH_PORT || 3000,
    });

    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await healthServer.stop();
        await agentManager.stop();
        await natsClient.close();
        logger.info('Health Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('uncaughtException').catch(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', { reason });
      shutdown('unhandledRejection').catch(() => process.exit(1));
    });
  } catch (error) {
    logger.error('Failed to start Health Server', { error });
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
