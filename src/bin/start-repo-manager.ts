#!/usr/bin/env node
/**
 * Repo Manager Agent Entry Point
 *
 * Starts the Repo Manager Agent process for workflow orchestration.
 * Designed to run 24/7 with PM2 process manager.
 *
 * Feature: F5.2 - Process Manager Integration
 */

import { RepoManagerAgent } from '@/agents/repo-manager/repo-manager-agent';
import { initializeNatsClient } from '@/shared/messaging/nats-client';
import { AgentType, AgentConfig } from '@/agents/base/types';
import { createAgentLogger } from '@/shared/logging/logger';
import { Notifier, getNotificationConfig, validateNotificationConfig } from '@/shared/notifications/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const logger = createAgentLogger('MAIN', 'repo-manager-startup');

/**
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info('Starting Repo Manager Agent...', {
    nodeVersion: process.version,
    pid: process.pid,
    agentId: process.env.AGENT_ID || 'repo-manager-1',
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
      id: process.env.AGENT_ID || 'repo-manager-1',
      type: AgentType.REPO_MANAGER,
      name: process.env.AGENT_NAME || 'Repo Manager Agent',
      description: 'Workflow orchestration and multi-agent coordination',
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
        : 600000, // 10 minutes (longer for orchestration)
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

    // Initialize notification system
    const notificationConfig = getNotificationConfig();
    let notifier: Notifier | undefined;

    if (notificationConfig.enabled) {
      if (validateNotificationConfig(notificationConfig)) {
        notifier = new Notifier(notificationConfig);
        logger.info('Notification system initialized', {
          level: notificationConfig.level,
          hasSlack: !!notificationConfig.slack,
          hasDiscord: !!notificationConfig.discord,
          hasEmail: !!notificationConfig.email,
        });
      } else {
        logger.warn('Notification configuration invalid, notifications disabled');
      }
    } else {
      logger.info('Notifications disabled');
    }

    // Create and start agent
    const agent = new RepoManagerAgent(config, natsClient, undefined, undefined, notifier);
    await agent.start();

    logger.info('Repo Manager Agent started successfully', {
      agentId: config.id,
      state: agent.getState(),
    });

    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        await agent.stop();
        await natsClient.close();
        logger.info('Repo Manager Agent stopped successfully');
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
    logger.error('Failed to start Repo Manager Agent', { error });
    process.exit(1);
  }
}

// Start the agent
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
