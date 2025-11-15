#!/usr/bin/env node
/**
 * Reviewer Agent Entry Point
 *
 * Starts the Reviewer Agent process for autonomous code review.
 * Designed to run 24/7 with PM2 process manager.
 *
 * Feature: F5.2 - Process Manager Integration
 */

import { ReviewerAgent } from '@/agents/reviewer/reviewer-agent';
import { initializeNatsClient } from '@/shared/messaging/nats-client';
import { AgentType, AgentConfig } from '@/agents/base/types';
import { createAgentLogger } from '@/shared/logging/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = createAgentLogger('MAIN', 'reviewer-startup');

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Reviewer Agent...', {
    nodeVersion: process.version,
    pid: process.pid,
    agentId: process.env.AGENT_ID || 'reviewer-1',
  });

  // Validate required environment variables
  const requiredEnvVars = ['NATS_URL', 'GITHUB_TOKEN', 'LLM_PROVIDER', 'LLM_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter((varName) => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    logger.error('Missing required environment variables', {
      missing: missingEnvVars,
    });
    process.exit(1);
  }

  try {
    // Create agent configuration
    const config: AgentConfig = {
      id: process.env.AGENT_ID || 'reviewer-1',
      type: AgentType.REVIEWER,
      name: process.env.AGENT_NAME || 'Reviewer Agent',
      description: 'Autonomous code review agent',
      llm: {
        provider: (process.env.LLM_PROVIDER as 'claude' | 'openai' | 'gemini') || 'claude',
        model: process.env.LLM_MODEL,
        options: {
          maxTokens: process.env.LLM_MAX_TOKENS
            ? parseInt(process.env.LLM_MAX_TOKENS, 10)
            : undefined,
          temperature: process.env.LLM_TEMPERATURE
            ? parseFloat(process.env.LLM_TEMPERATURE)
            : undefined,
        },
      },
      nats: {
        servers: process.env.NATS_URL!.split(','),
      },
      maxConcurrentTasks: process.env.MAX_CONCURRENT_TASKS
        ? parseInt(process.env.MAX_CONCURRENT_TASKS, 10)
        : 1,
      retryAttempts: process.env.RETRY_ATTEMPTS
        ? parseInt(process.env.RETRY_ATTEMPTS, 10)
        : 3,
      timeout: process.env.TASK_TIMEOUT
        ? parseInt(process.env.TASK_TIMEOUT, 10)
        : 300000, // 5 minutes
    };

    // Initialize NATS client
    const natsClient = await initializeNatsClient({
      url: process.env.NATS_URL!,
      reconnect: true,
      maxReconnectAttempts: 10,
      reconnectTimeWait: 2000,
    });

    logger.info('NATS client connected', {
      url: process.env.NATS_URL,
    });

    // Create and start agent
    const agent = new ReviewerAgent(config, natsClient);
    await agent.start();

    logger.info('Reviewer Agent started successfully', {
      agentId: config.id,
      state: agent.getState(),
    });

    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await agent.stop();
        await natsClient.close();
        logger.info('Reviewer Agent stopped successfully');
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
    logger.error('Failed to start Reviewer Agent', { error });
    process.exit(1);
  }
}

// Start the agent
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
