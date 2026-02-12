/**
 * Autonomous Runner CLI
 *
 * Provides CLI commands for running OrchestratorRunner workflows.
 * Uses createRunnerFromEnv() to load configuration from environment.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
  createRunnerFromEnv,
  loadRunnerConfig,
  type RunnerConfig,
} from '@/core/orchestrator/runner-config';
import type { OrchestratorRunner, GoalResult, WorkflowResult } from '@/core/orchestrator/orchestrator-runner';
import { logger } from '@/shared/logging/logger';
import type { TeamType } from '@/core/workspace/task-document';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(1);
  return `${secs}s`;
}

function printGoalResult(result: GoalResult): void {
  const icon = result.success ? chalk.green('✓') : chalk.red('✗');
  console.log(`\n${icon} Goal ${chalk.bold(result.goalId)}`);
  console.log(`  Duration: ${formatDuration(result.totalDuration)}`);
  console.log(`  Tasks: ${result.completedTasks} passed, ${result.failedTasks} failed`);

  if (result.verification) {
    const v = result.verification;
    console.log(`  Verification: ${v.passed ? chalk.green('passed') : chalk.yellow('partial')}`);
  }

  if (result.tasks.length > 0) {
    console.log(chalk.dim('\n  Task details:'));
    for (const task of result.tasks) {
      const taskIcon = task.success ? chalk.green('  ✓') : chalk.red('  ✗');
      console.log(`${taskIcon} [${task.teamType}] ${task.taskId} (${formatDuration(task.duration)})`);
      if (task.error) {
        console.log(chalk.red(`      Error: ${task.error}`));
      }
    }
  }
}

function printWorkflowResult(result: WorkflowResult): void {
  const icon = result.success ? chalk.green('✓') : chalk.red('✗');
  console.log(`\n${icon} Task ${chalk.bold(result.taskId)}`);
  console.log(`  Team: ${result.teamType}`);
  console.log(`  Duration: ${formatDuration(result.duration)}`);
  if (result.error) {
    console.log(chalk.red(`  Error: ${result.error}`));
  }
}

async function withRunner(
  overrides: Partial<RunnerConfig>,
  fn: (runner: OrchestratorRunner) => Promise<void>,
): Promise<void> {
  let runner: OrchestratorRunner | null = null;
  try {
    runner = createRunnerFromEnv(overrides);
    await runner.start();
    await fn(runner);
  } finally {
    if (runner) {
      await runner.destroy().catch((e) => {
        logger.warn('Runner cleanup failed', { error: e instanceof Error ? e.message : String(e) });
      });
    }
  }
}

export function createAutonomousCLI(): Command {
  const program = new Command();

  program
    .name('runner')
    .description('Autonomous Runner CLI — powered by OrchestratorRunner')
    .version('1.0.0');

  // ========================================================================
  // run — execute a high-level goal
  // ========================================================================
  program
    .command('run')
    .description('Execute a goal using the orchestrator')
    .argument('<goal>', 'Goal description')
    .option('-p, --priority <level>', 'Task priority (low, medium, high, critical)', 'medium')
    .option('--project <id>', 'Project identifier')
    .option('--tags <tags>', 'Comma-separated tags')
    .option('--no-wait', 'Submit and exit without waiting for completion')
    .option('--workspace <dir>', 'Override workspace directory')
    .option('--validation', 'Enable validation hooks')
    .option('--learning', 'Enable learning hooks')
    .action(async (goal: string, opts) => {
      try {
        const overrides: Partial<RunnerConfig> = {};
        if (opts.workspace) overrides.workspaceDir = opts.workspace;
        if (opts.validation) overrides.enableValidation = true;
        if (opts.learning) overrides.enableLearning = true;

        console.log(chalk.cyan('Starting runner...'));

        await withRunner(overrides, async (runner) => {
          console.log(chalk.green('Runner started.'));
          console.log(chalk.dim(`Executing goal: "${goal}"`));

          const result = await runner.executeGoal(goal, goal, {
            priority: opts.priority,
            projectId: opts.project,
            tags: opts.tags?.split(',').map((t: string) => t.trim()),
            waitForCompletion: opts.wait !== false,
          });

          printGoalResult(result);
          process.exitCode = result.success ? 0 : 1;
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${msg}`));
        process.exitCode = 1;
      }
    });

  // ========================================================================
  // submit — submit a task to a specific team
  // ========================================================================
  program
    .command('submit')
    .description('Submit a task directly to a specific team')
    .argument('<team>', 'Target team (planning, development, qa, frontend, backend)')
    .argument('<description>', 'Task description')
    .option('-p, --priority <level>', 'Task priority', 'medium')
    .option('--project <id>', 'Project identifier')
    .option('--workspace <dir>', 'Override workspace directory')
    .action(async (team: string, description: string, opts) => {
      try {
        const overrides: Partial<RunnerConfig> = {};
        if (opts.workspace) overrides.workspaceDir = opts.workspace;

        console.log(chalk.cyan(`Submitting to ${team}...`));

        await withRunner(overrides, async (runner) => {
          const task = await runner.submitToTeam(
            team as TeamType,
            description,
            description,
            {
              priority: opts.priority,
              projectId: opts.project,
            },
          );

          const result = await runner.executeTask(task);
          printWorkflowResult(result);
          process.exitCode = result.success ? 0 : 1;
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error: ${msg}`));
        process.exitCode = 1;
      }
    });

  // ========================================================================
  // config — show loaded configuration
  // ========================================================================
  program
    .command('config')
    .description('Show loaded runner configuration')
    .action(() => {
      try {
        const config = loadRunnerConfig();
        console.log(chalk.cyan('Runner Configuration:'));
        console.log(JSON.stringify(config, null, 2));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`Error loading config: ${msg}`));
        process.exitCode = 1;
      }
    });

  return program;
}
