#!/usr/bin/env node
/**
 * Multi-Agent CLI
 *
 * Command-line interface for interacting with the autonomous coding system.
 * Allows users to submit feature requests and monitor progress.
 *
 * Feature: F5.4 - CLI Interface
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { initializeNatsClient } from '@/shared/messaging/nats-client';
import {
  AgentType,
  TaskPriority,
  TaskStatus,
  FeatureRequest,
} from '@/agents/base/types';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const program = new Command();

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse repository URL
 */
function parseRepoUrl(url: string): { owner: string; repo: string; url: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) {
    throw new Error(
      'Invalid GitHub URL format. Expected: https://github.com/owner/repo or git@github.com:owner/repo.git'
    );
  }

  return {
    owner: match[1],
    repo: match[2],
    url: url.endsWith('.git') ? url : `${url}.git`,
  };
}

/**
 * Get status color based on task status
 */
function getStatusColor(status: string): string {
  switch (status) {
    case TaskStatus.COMPLETED:
      return chalk.green(status);
    case TaskStatus.FAILED:
      return chalk.red(status);
    case TaskStatus.IN_PROGRESS:
      return chalk.yellow(status);
    case TaskStatus.PENDING:
      return chalk.gray(status);
    case TaskStatus.CANCELLED:
      return chalk.dim(status);
    default:
      return status;
  }
}

/**
 * Get priority badge
 */
function getPriorityBadge(priority: string): string {
  switch (priority) {
    case TaskPriority.URGENT:
      return chalk.red.bold('🔥 URGENT');
    case TaskPriority.HIGH:
      return chalk.yellow.bold('⚡ HIGH');
    case TaskPriority.NORMAL:
      return chalk.blue('● NORMAL');
    case TaskPriority.LOW:
      return chalk.gray('○ LOW');
    default:
      return priority;
  }
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

// Configure CLI
program
  .name('multi-agent')
  .description('Multi-Agent Autonomous Coding System CLI')
  .version('1.0.0');

// Start Project Command
program
  .command('start-project')
  .description('Start a new autonomous coding project')
  .requiredOption('--repo <url>', 'GitHub repository URL')
  .requiredOption('--requirements <text>', 'Project requirements description')
  .option('--branch <name>', 'Base branch to work from', 'main')
  .option('--priority <level>', 'Priority level (low|normal|high|urgent)', 'normal')
  .action(async (options) => {
    const spinner = ora('Initializing project...').start();

    try {
      // Validate NATS configuration
      if (!process.env.NATS_URL) {
        throw new Error('NATS_URL environment variable is required');
      }

      // Parse repository URL
      spinner.text = 'Parsing repository...';
      const repository = parseRepoUrl(options.repo);

      // Connect to NATS
      spinner.text = 'Connecting to message broker...';
      const natsClient = await initializeNatsClient({
        url: process.env.NATS_URL,
        reconnect: false,
        maxReconnectAttempts: 3,
      });

      // Create feature request
      const taskId = generateTaskId();
      const featureRequest: FeatureRequest = {
        id: taskId,
        type: 'FEATURE_REQUEST',
        agentType: AgentType.REPO_MANAGER,
        priority: options.priority.toUpperCase() as TaskPriority,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: repository.owner,
            repo: repository.repo,
            url: repository.url,
          },
          feature: {
            title: 'Project Setup',
            description: options.requirements,
            requirements: [options.requirements],
          },
          workflow: {
            autoMerge: false,
            requireApproval: true,
            notifyOnCompletion: true,
          },
        },
        metadata: {
          createdAt: Date.now(),
          createdBy: 'cli',
        },
      };

      // Publish to NATS
      spinner.text = 'Submitting feature request...';
      await natsClient.publishToStream('task.repo-manager', featureRequest);

      // Close connection
      await natsClient.close();

      spinner.succeed(chalk.green('Project started successfully! 🚀'));

      // Display summary
      console.log();
      console.log(chalk.bold('📋 Project Details:'));
      console.log(chalk.gray('  Task ID:     ') + chalk.cyan(taskId));
      console.log(chalk.gray('  Repository:  ') + `${repository.owner}/${repository.repo}`);
      console.log(chalk.gray('  Priority:    ') + getPriorityBadge(featureRequest.priority));
      console.log(chalk.gray('  Status:      ') + getStatusColor(TaskStatus.PENDING));
      console.log();
      console.log(chalk.dim('Monitor progress with:'));
      console.log(chalk.cyan(`  multi-agent job-status ${taskId}`));
      console.log();
    } catch (error) {
      spinner.fail(chalk.red('Failed to start project'));
      console.error();
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Submit Feature Command
program
  .command('submit-feature')
  .description('Submit a new feature request to an existing project')
  .requiredOption('--repo <url>', 'GitHub repository URL')
  .requiredOption('--title <text>', 'Feature title')
  .requiredOption('--description <text>', 'Feature description')
  .option('--requirements <items>', 'Comma-separated requirements')
  .option('--branch <name>', 'Target branch', 'main')
  .option('--priority <level>', 'Priority level (low|normal|high|urgent)', 'normal')
  .action(async (options) => {
    const spinner = ora('Submitting feature request...').start();

    try {
      // Validate NATS configuration
      if (!process.env.NATS_URL) {
        throw new Error('NATS_URL environment variable is required');
      }

      // Parse repository URL
      spinner.text = 'Parsing repository...';
      const repository = parseRepoUrl(options.repo);

      // Parse requirements
      const requirements = options.requirements
        ? options.requirements.split(',').map((r: string) => r.trim())
        : [options.description];

      // Connect to NATS
      spinner.text = 'Connecting to message broker...';
      const natsClient = await initializeNatsClient({
        url: process.env.NATS_URL,
        reconnect: false,
        maxReconnectAttempts: 3,
      });

      // Create feature request
      const taskId = generateTaskId();
      const featureRequest: FeatureRequest = {
        id: taskId,
        type: 'FEATURE_REQUEST',
        agentType: AgentType.REPO_MANAGER,
        priority: options.priority.toUpperCase() as TaskPriority,
        status: TaskStatus.PENDING,
        payload: {
          repository: {
            owner: repository.owner,
            repo: repository.repo,
            url: repository.url,
          },
          feature: {
            title: options.title,
            description: options.description,
            requirements,
          },
          workflow: {
            autoMerge: false,
            requireApproval: true,
            notifyOnCompletion: true,
          },
        },
        metadata: {
          createdAt: Date.now(),
          createdBy: 'cli',
        },
      };

      // Publish to NATS
      spinner.text = 'Publishing feature request...';
      await natsClient.publishToStream('task.repo-manager', featureRequest);

      // Close connection
      await natsClient.close();

      spinner.succeed(chalk.green('Feature submitted successfully! ✨'));

      // Display summary
      console.log();
      console.log(chalk.bold('📋 Feature Details:'));
      console.log(chalk.gray('  Task ID:     ') + chalk.cyan(taskId));
      console.log(chalk.gray('  Title:       ') + options.title);
      console.log(chalk.gray('  Repository:  ') + `${repository.owner}/${repository.repo}`);
      console.log(chalk.gray('  Priority:    ') + getPriorityBadge(featureRequest.priority));
      console.log(chalk.gray('  Status:      ') + getStatusColor(TaskStatus.PENDING));
      console.log();
      console.log(chalk.dim('Monitor progress with:'));
      console.log(chalk.cyan(`  multi-agent job-status ${taskId}`));
      console.log();
    } catch (error) {
      spinner.fail(chalk.red('Failed to submit feature'));
      console.error();
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Job Status Command
program
  .command('job-status <task-id>')
  .description('Get the status of a task')
  .action(async (taskId: string) => {
    const spinner = ora('Fetching task status...').start();

    try {
      // Validate NATS configuration
      if (!process.env.NATS_URL) {
        throw new Error('NATS_URL environment variable is required');
      }

      // Connect to NATS
      const natsClient = await initializeNatsClient({
        url: process.env.NATS_URL,
        reconnect: false,
        maxReconnectAttempts: 3,
      });

      // Request status
      spinner.text = 'Requesting status from agents...';

      try {
        const response = await natsClient.request(
          'status.query',
          JSON.stringify({ taskId }),
          { timeout: 5000 }
        );

        const decoder = new TextDecoder();
        const statusData = JSON.parse(decoder.decode(response.data));

        await natsClient.close();
        spinner.stop();

        // Display status
        console.log();
        console.log(chalk.bold('📊 Task Status'));
        console.log(chalk.gray('━'.repeat(60)));
        console.log();
        console.log(chalk.gray('  Task ID:     ') + chalk.cyan(taskId));
        console.log(chalk.gray('  Status:      ') + getStatusColor(statusData.status));

        if (statusData.priority) {
          console.log(chalk.gray('  Priority:    ') + getPriorityBadge(statusData.priority));
        }

        if (statusData.createdAt) {
          const elapsed = Date.now() - statusData.createdAt;
          console.log(
            chalk.gray('  Created:     ') +
              new Date(statusData.createdAt).toLocaleString() +
              chalk.dim(` (${formatDuration(elapsed)} ago)`)
          );
        }

        if (statusData.updatedAt) {
          console.log(
            chalk.gray('  Updated:     ') + new Date(statusData.updatedAt).toLocaleString()
          );
        }

        if (statusData.result) {
          console.log();
          console.log(chalk.bold('  Result:'));
          console.log(chalk.gray('  ' + JSON.stringify(statusData.result, null, 2)));
        }

        if (statusData.error) {
          console.log();
          console.log(chalk.red.bold('  Error:'));
          console.log(chalk.red('    Code:    ') + statusData.error.code);
          console.log(chalk.red('    Message: ') + statusData.error.message);
        }

        console.log();
      } catch (error) {
        await natsClient.close();

        if (error instanceof Error && error.message.includes('timeout')) {
          spinner.warn(chalk.yellow('No response from agents (timeout)'));
          console.log();
          console.log(
            chalk.dim(
              'The task might still be processing, or agents might not be running.'
            )
          );
          console.log();
          console.log(chalk.dim('Check agent status:'));
          console.log(chalk.cyan('  curl http://localhost:3000/health/agents'));
          console.log();
        } else {
          throw error;
        }
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch status'));
      console.error();
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// List Jobs Command
program
  .command('list-jobs')
  .description('List all active jobs')
  .option('--status <status>', 'Filter by status (pending|in_progress|completed|failed)')
  .option('--limit <number>', 'Limit number of results', '10')
  .action(async (options) => {
    const spinner = ora('Fetching jobs...').start();

    try {
      // Validate NATS configuration
      if (!process.env.NATS_URL) {
        throw new Error('NATS_URL environment variable is required');
      }

      // Connect to NATS
      const natsClient = await initializeNatsClient({
        url: process.env.NATS_URL,
        reconnect: false,
        maxReconnectAttempts: 3,
      });

      // Request job list
      try {
        const response = await natsClient.request(
          'jobs.list',
          JSON.stringify({
            status: options.status,
            limit: parseInt(options.limit, 10),
          }),
          { timeout: 5000 }
        );

        const decoder = new TextDecoder();
        const jobsData = JSON.parse(decoder.decode(response.data));

        await natsClient.close();
        spinner.stop();

        // Display jobs
        console.log();
        console.log(chalk.bold(`📋 Active Jobs (${jobsData.jobs?.length || 0})`));
        console.log(chalk.gray('━'.repeat(60)));

        if (!jobsData.jobs || jobsData.jobs.length === 0) {
          console.log();
          console.log(chalk.dim('  No jobs found.'));
          console.log();
          return;
        }

        jobsData.jobs.forEach((job: any, index: number) => {
          console.log();
          console.log(chalk.bold(`  ${index + 1}. ${job.title || job.id}`));
          console.log(chalk.gray('     Task ID:  ') + chalk.cyan(job.id));
          console.log(chalk.gray('     Status:   ') + getStatusColor(job.status));
          if (job.priority) {
            console.log(chalk.gray('     Priority: ') + getPriorityBadge(job.priority));
          }
          if (job.createdAt) {
            const elapsed = Date.now() - job.createdAt;
            console.log(
              chalk.gray('     Created:  ') +
                new Date(job.createdAt).toLocaleString() +
                chalk.dim(` (${formatDuration(elapsed)} ago)`)
            );
          }
        });

        console.log();
      } catch (error) {
        await natsClient.close();

        if (error instanceof Error && error.message.includes('timeout')) {
          spinner.warn(chalk.yellow('No response from agents (timeout)'));
          console.log();
          console.log(chalk.dim('Agents might not be running or job list feature not implemented.'));
          console.log();
        } else {
          throw error;
        }
      }
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch jobs'));
      console.error();
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Health Check Command
program
  .command('health')
  .description('Check system health')
  .option('--url <url>', 'Health server URL', 'http://localhost:3000')
  .action(async (options) => {
    const spinner = ora('Checking system health...').start();

    try {
      const response = await fetch(`${options.url}/health`);
      const data = (await response.json()) as any;

      spinner.stop();

      console.log();
      console.log(chalk.bold('🏥 System Health'));
      console.log(chalk.gray('━'.repeat(60)));
      console.log();

      // Overall status
      const statusIcon = data.status === 'healthy' ? '✅' : data.status === 'degraded' ? '⚠️' : '❌';
      const statusColor =
        data.status === 'healthy' ? chalk.green : data.status === 'degraded' ? chalk.yellow : chalk.red;
      console.log(chalk.gray('  Overall Status: ') + statusColor(`${statusIcon} ${data.status.toUpperCase()}`));
      console.log(chalk.gray('  Uptime:         ') + formatDuration(data.uptime));
      console.log(chalk.gray('  Agent Count:    ') + data.system.agentCount);

      // Agent details
      if (data.system.agents && data.system.agents.length > 0) {
        console.log();
        console.log(chalk.bold('  Agents:'));
        data.system.agents.forEach((agent: any) => {
          const agentIcon = agent.healthy === agent.count ? '✅' : '⚠️';
          console.log(
            chalk.gray(`    ${agentIcon} ${agent.type}: `) +
              `${agent.healthy}/${agent.count} healthy, ` +
              chalk.dim(`${agent.idle} idle, ${agent.working} working`)
          );
        });
      }

      // Dependencies
      console.log();
      console.log(chalk.bold('  Dependencies:'));
      const natsIcon = data.dependencies.nats.connected ? '✅' : '❌';
      const natsColor = data.dependencies.nats.connected ? chalk.green : chalk.red;
      console.log(
        chalk.gray(`    ${natsIcon} NATS: `) +
          natsColor(data.dependencies.nats.connected ? 'Connected' : 'Disconnected')
      );

      console.log();
    } catch (error) {
      spinner.fail(chalk.red('Failed to check health'));
      console.error();
      if (error instanceof Error && error.message.includes('fetch')) {
        console.error(
          chalk.red('Error:'),
          'Could not connect to health server. Is it running?'
        );
        console.log();
        console.log(chalk.dim('Start the health server with:'));
        console.log(chalk.cyan('  npm run dev:health'));
        console.log();
      } else {
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
