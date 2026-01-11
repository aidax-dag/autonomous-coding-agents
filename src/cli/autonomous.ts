/**
 * Autonomous Runner CLI
 *
 * Command-line interface for the AutonomousRunner system.
 * Allows users to create and manage autonomous coding projects from PRD files.
 *
 * Commands:
 * - create: Create a new project from a PRD file
 * - run: Run a project
 * - status: Get project status
 * - stop: Stop a running project
 * - list: List all projects
 * - pause/resume: Pause and resume projects
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { readFile, access, mkdir } from 'fs/promises';
import { resolve } from 'path';
import {
  AutonomousRunner,
  RunnerEvent,
  createAutonomousRunnerByProvider,
  LLMProvider,
} from '@/core/runner';
import { QualityGateLevel } from '@/core/quality';
import { CompletionStatus } from '@/core/quality/completion-detector';
import { ProjectStatus, TaskStatus } from '@/core/memory/project-store';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Create the autonomous runner CLI commands
 */
export function createAutonomousCLI(): Command {
  const program = new Command();

  program
    .name('runner')
    .description('Autonomous Runner CLI - PRD to Product automation')
    .version('1.0.0');

  // Create Project Command
  program
    .command('create')
    .description('Create a new project from a PRD file')
    .argument('<prd-file>', 'Path to the PRD file (markdown or text)')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <desc>', 'Project description')
    .option('-q, --quality <level>', 'Quality gate level (minimal|standard|strict|enterprise)', 'standard')
    .option('--storage <type>', 'Storage type (memory|filesystem)', 'filesystem')
    .option('--storage-path <path>', 'Storage path for filesystem storage', './.autonomous-runner')
    .option('-p, --provider <provider>', 'LLM provider (claude|openai|gemini|mock)', 'claude')
    .option('-m, --model <model>', 'LLM model to use')
    .option('--mock', 'Use mock LLM client for testing (shorthand for --provider mock)')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (prdFile: string, options) => {
      const spinner = ora('Initializing project...').start();

      try {
        // Resolve PRD file path
        const prdPath = resolve(process.cwd(), prdFile);

        // Verify file exists
        spinner.text = 'Reading PRD file...';
        try {
          await access(prdPath);
        } catch {
          throw new Error(`PRD file not found: ${prdPath}`);
        }

        // Read PRD content
        const prdContent = await readFile(prdPath, 'utf-8');
        if (!prdContent.trim()) {
          throw new Error('PRD file is empty');
        }

        // Extract project name from filename if not provided
        const projectName = options.name || extractProjectName(prdFile);
        const projectDescription = options.description || `Project created from ${prdFile}`;

        // Create storage directory if filesystem storage
        if (options.storage === 'filesystem') {
          const storagePath = resolve(process.cwd(), options.storagePath);
          await mkdir(storagePath, { recursive: true });
        }

        // Create runner
        spinner.text = 'Creating runner...';
        const runner = await createRunner(options);

        // Start runner
        await runner.start();

        // Create project
        spinner.text = 'Analyzing PRD and creating project...';
        const projectId = await runner.createProject({
          name: projectName,
          description: projectDescription,
          prd: prdContent,
        });

        // Get project status
        const project = await runner.getProjectStatus(projectId);
        const taskCount = project?.tasks.size || 0;

        // Stop runner (project is created, not executed yet)
        await runner.stop();

        spinner.succeed(chalk.green('Project created successfully!'));

        // Display project details
        console.log();
        console.log(chalk.bold('Project Details:'));
        console.log(chalk.gray('  ID:          ') + chalk.cyan(projectId));
        console.log(chalk.gray('  Name:        ') + projectName);
        console.log(chalk.gray('  Tasks:       ') + chalk.yellow(`${taskCount} tasks`));
        console.log(chalk.gray('  Quality:     ') + getQualityBadge(options.quality));
        console.log(chalk.gray('  Storage:     ') + options.storage);
        if (options.storage === 'filesystem') {
          console.log(chalk.gray('  Path:        ') + resolve(process.cwd(), options.storagePath));
        }
        console.log();
        console.log(chalk.dim('Run the project with:'));
        console.log(chalk.cyan(`  multi-agent runner run ${projectId}`));
        console.log();
      } catch (error) {
        spinner.fail(chalk.red('Failed to create project'));
        console.error();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        if (options.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  // Run Project Command
  program
    .command('run')
    .description('Run a project')
    .argument('<project-id>', 'Project ID to run')
    .option('--storage <type>', 'Storage type (memory|filesystem)', 'filesystem')
    .option('--storage-path <path>', 'Storage path for filesystem storage', './.autonomous-runner')
    .option('-q, --quality <level>', 'Quality gate level (minimal|standard|strict|enterprise)', 'standard')
    .option('-p, --provider <provider>', 'LLM provider (claude|openai|gemini|mock)', 'claude')
    .option('-m, --model <model>', 'LLM model to use')
    .option('--mock', 'Use mock LLM client for testing (shorthand for --provider mock)')
    .option('--no-wait', 'Do not wait for completion')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (projectId: string, options) => {
      const spinner = ora('Starting project execution...').start();

      try {
        // Create runner
        const runner = await createRunner(options);

        // Setup event handlers
        setupEventHandlers(runner, spinner, options.verbose);

        // Start runner
        await runner.start();

        // Check if project exists
        const project = await runner.getProjectStatus(projectId);
        if (!project) {
          throw new Error(`Project not found: ${projectId}`);
        }

        spinner.text = `Running project: ${project.name}...`;

        if (options.wait !== false) {
          // Run and wait for completion
          const result = await runner.runProject(projectId);

          spinner.stop();

          // Display result
          const isSuccess = result.status === CompletionStatus.COMPLETE;
          console.log();
          if (isSuccess) {
            console.log(chalk.green.bold('Project completed successfully!'));
          } else {
            console.log(chalk.red.bold('Project failed or incomplete'));
            if (result.completionResult?.recommendations?.length > 0) {
              console.log(chalk.yellow('Recommendations:'));
              result.completionResult.recommendations.forEach((rec: string) => {
                console.log(chalk.gray('  - ') + rec);
              });
            }
          }

          const totalTasks = result.tasksCompleted + result.tasksFailed;
          console.log();
          console.log(chalk.bold('Execution Summary:'));
          console.log(chalk.gray('  Project ID:  ') + chalk.cyan(projectId));
          console.log(chalk.gray('  Status:      ') + getCompletionStatusBadge(result.status));
          console.log(chalk.gray('  Duration:    ') + formatDuration(result.duration));
          console.log(chalk.gray('  Tasks:       ') + `${result.tasksCompleted}/${totalTasks} completed`);
          if (result.tasksFailed > 0) {
            console.log(chalk.gray('  Failed:      ') + chalk.red(`${result.tasksFailed} tasks`));
          }
          console.log();
        } else {
          // Start and don't wait
          runner.runProject(projectId).catch((err) => {
            console.error(chalk.red('Background execution error:'), err.message);
          });

          spinner.succeed(chalk.green('Project execution started in background'));
          console.log();
          console.log(chalk.dim('Monitor progress with:'));
          console.log(chalk.cyan(`  multi-agent runner status ${projectId}`));
          console.log();
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to run project'));
        console.error();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        if (options.verbose && error instanceof Error && error.stack) {
          console.error(chalk.gray(error.stack));
        }
        process.exit(1);
      }
    });

  // Status Command
  program
    .command('status')
    .description('Get project status')
    .argument('[project-id]', 'Project ID (optional, shows all projects if omitted)')
    .option('--storage <type>', 'Storage type (memory|filesystem)', 'filesystem')
    .option('--storage-path <path>', 'Storage path for filesystem storage', './.autonomous-runner')
    .option('--mock', 'Use mock LLM client for testing')
    .option('-v, --verbose', 'Enable verbose output')
    .action(async (projectId: string | undefined, options) => {
      const spinner = ora('Fetching project status...').start();

      try {
        const runner = await createRunner(options);
        await runner.start();

        if (projectId) {
          // Get specific project status
          const project = await runner.getProjectStatus(projectId);
          if (!project) {
            throw new Error(`Project not found: ${projectId}`);
          }

          spinner.stop();
          displayProjectStatus(project, options.verbose);
        } else {
          // List all projects
          spinner.stop();
          console.log();
          console.log(chalk.yellow('No project ID specified. Use --storage-path to specify the storage location.'));
          console.log(chalk.dim('To view a specific project:'));
          console.log(chalk.cyan('  multi-agent runner status <project-id>'));
          console.log();
        }

        await runner.stop();
      } catch (error) {
        spinner.fail(chalk.red('Failed to get status'));
        console.error();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Stop Command
  program
    .command('stop')
    .description('Stop a running project')
    .argument('<project-id>', 'Project ID to stop')
    .option('--storage <type>', 'Storage type (memory|filesystem)', 'filesystem')
    .option('--storage-path <path>', 'Storage path for filesystem storage', './.autonomous-runner')
    .option('--mock', 'Use mock LLM client for testing')
    .action(async (projectId: string, options) => {
      const spinner = ora('Stopping project...').start();

      try {
        const runner = await createRunner(options);
        await runner.start();

        const project = await runner.getProjectStatus(projectId);
        if (!project) {
          throw new Error(`Project not found: ${projectId}`);
        }

        // Stop the runner (which stops all projects)
        await runner.stop();

        spinner.succeed(chalk.green('Project stopped'));
        console.log();
        console.log(chalk.gray('  Project ID: ') + chalk.cyan(projectId));
        console.log(chalk.gray('  Status:     ') + getStatusBadge('stopped'));
        console.log();
      } catch (error) {
        spinner.fail(chalk.red('Failed to stop project'));
        console.error();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Pause Command
  program
    .command('pause')
    .description('Pause a running project')
    .argument('<project-id>', 'Project ID to pause')
    .option('--storage <type>', 'Storage type (memory|filesystem)', 'filesystem')
    .option('--storage-path <path>', 'Storage path for filesystem storage', './.autonomous-runner')
    .option('--mock', 'Use mock LLM client for testing')
    .action(async (projectId: string, options) => {
      const spinner = ora('Pausing project...').start();

      try {
        const runner = await createRunner(options);
        await runner.start();

        const project = await runner.getProjectStatus(projectId);
        if (!project) {
          throw new Error(`Project not found: ${projectId}`);
        }

        await runner.pause();

        spinner.succeed(chalk.yellow('Project paused'));
        console.log();
        console.log(chalk.gray('  Project ID: ') + chalk.cyan(projectId));
        console.log(chalk.gray('  Status:     ') + chalk.yellow('PAUSED'));
        console.log();
        console.log(chalk.dim('Resume with:'));
        console.log(chalk.cyan(`  multi-agent runner resume ${projectId}`));
        console.log();
      } catch (error) {
        spinner.fail(chalk.red('Failed to pause project'));
        console.error();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  // Resume Command
  program
    .command('resume')
    .description('Resume a paused project')
    .argument('<project-id>', 'Project ID to resume')
    .option('--storage <type>', 'Storage type (memory|filesystem)', 'filesystem')
    .option('--storage-path <path>', 'Storage path for filesystem storage', './.autonomous-runner')
    .option('--mock', 'Use mock LLM client for testing')
    .action(async (projectId: string, options) => {
      const spinner = ora('Resuming project...').start();

      try {
        const runner = await createRunner(options);
        await runner.start();

        const project = await runner.getProjectStatus(projectId);
        if (!project) {
          throw new Error(`Project not found: ${projectId}`);
        }

        await runner.resume();

        spinner.succeed(chalk.green('Project resumed'));
        console.log();
        console.log(chalk.gray('  Project ID: ') + chalk.cyan(projectId));
        console.log(chalk.gray('  Status:     ') + chalk.green('RUNNING'));
        console.log();
      } catch (error) {
        spinner.fail(chalk.red('Failed to resume project'));
        console.error();
        console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });

  return program;
}

/**
 * Create runner with options
 */
async function createRunner(options: {
  storage?: string;
  storagePath?: string;
  quality?: string;
  provider?: string;
  model?: string;
  mock?: boolean;
  verbose?: boolean;
}): Promise<AutonomousRunner> {
  const qualityLevel = parseQualityLevel(options.quality || 'standard');

  // Determine provider (--mock flag overrides --provider)
  const provider: LLMProvider = options.mock ? 'mock' : (options.provider as LLMProvider) || 'claude';

  const runnerConfig = {
    storageType: options.storage === 'filesystem' ? 'filesystem' as const : 'memory' as const,
    storagePath: options.storagePath ? resolve(process.cwd(), options.storagePath) : undefined,
    qualityGateLevel: qualityLevel,
    verbose: options.verbose || false,
  };

  // Create runner with selected provider
  return createAutonomousRunnerByProvider(
    provider,
    runnerConfig,
    { model: options.model }
  );
}

/**
 * Parse quality level string
 */
function parseQualityLevel(level: string): QualityGateLevel {
  switch (level.toLowerCase()) {
    case 'minimal':
      return QualityGateLevel.MINIMAL;
    case 'standard':
      return QualityGateLevel.STANDARD;
    case 'strict':
      return QualityGateLevel.STRICT;
    case 'enterprise':
      return QualityGateLevel.ENTERPRISE;
    default:
      return QualityGateLevel.STANDARD;
  }
}

/**
 * Extract project name from filename
 */
function extractProjectName(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;
  const baseName = fileName.replace(/\.(md|txt|prd)$/i, '');
  return baseName
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Setup event handlers for runner
 */
function setupEventHandlers(
  runner: AutonomousRunner,
  spinner: Ora,
  verbose: boolean
): void {
  runner.on(RunnerEvent.TASK_STARTED, (data) => {
    if (verbose) {
      spinner.text = `Running task: ${data.taskId}...`;
    }
  });

  runner.on(RunnerEvent.TASK_COMPLETED, (data) => {
    if (verbose) {
      console.log(chalk.green(`  Task completed: ${data.taskId}`));
    }
  });

  runner.on(RunnerEvent.TASK_FAILED, (data) => {
    if (verbose) {
      console.log(chalk.red(`  Task failed: ${data.taskId} - ${data.error || 'Unknown error'}`));
    }
  });

  runner.on(RunnerEvent.ERROR, (data) => {
    console.log(chalk.red(`  Error: ${data.error || 'Unknown error'}`));
  });
}

/**
 * Display project status
 */
function displayProjectStatus(project: any, verbose: boolean): void {
  console.log();
  console.log(chalk.bold('Project Status'));
  console.log(chalk.gray(''.repeat(60)));
  console.log();
  console.log(chalk.gray('  ID:          ') + chalk.cyan(project.id));
  console.log(chalk.gray('  Name:        ') + project.name);
  console.log(chalk.gray('  Description: ') + (project.description || '-'));
  console.log(chalk.gray('  Status:      ') + getProjectStatusBadge(project.status));
  console.log(chalk.gray('  Created:     ') + new Date(project.createdAt).toLocaleString());
  console.log(chalk.gray('  Updated:     ') + new Date(project.updatedAt).toLocaleString());
  console.log();

  // Task summary
  const tasks = Array.from(project.tasks.values());
  const completed = tasks.filter((t: any) => t.status === TaskStatus.COMPLETED).length;
  const failed = tasks.filter((t: any) => t.status === TaskStatus.FAILED).length;
  const inProgress = tasks.filter((t: any) => t.status === TaskStatus.IN_PROGRESS).length;
  const pending = tasks.filter((t: any) => t.status === TaskStatus.PENDING).length;

  console.log(chalk.bold('  Task Summary:'));
  console.log(chalk.gray('    Total:       ') + tasks.length);
  console.log(chalk.gray('    Completed:   ') + chalk.green(completed.toString()));
  console.log(chalk.gray('    In Progress: ') + chalk.yellow(inProgress.toString()));
  console.log(chalk.gray('    Pending:     ') + chalk.gray(pending.toString()));
  console.log(chalk.gray('    Failed:      ') + chalk.red(failed.toString()));
  console.log();

  // Progress bar
  const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const barWidth = 30;
  const filled = Math.round((progress / 100) * barWidth);
  const empty = barWidth - filled;
  const progressBar = chalk.green(''.repeat(filled)) + chalk.gray(''.repeat(empty));
  console.log(chalk.gray('  Progress: ') + `[${progressBar}] ${progress}%`);
  console.log();

  // Verbose task list
  if (verbose && tasks.length > 0) {
    console.log(chalk.bold('  Tasks:'));
    tasks.forEach((task: any, index: number) => {
      const statusIcon = getTaskStatusIcon(task.status);
      console.log(chalk.gray(`    ${index + 1}. ${statusIcon} ${task.name}`));
    });
    console.log();
  }
}

/**
 * Get status badge
 */
function getStatusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'success':
      return chalk.green.bold('COMPLETED');
    case 'failed':
    case 'error':
      return chalk.red.bold('FAILED');
    case 'running':
    case 'in_progress':
      return chalk.yellow('RUNNING');
    case 'paused':
      return chalk.blue('PAUSED');
    case 'stopped':
      return chalk.gray('STOPPED');
    case 'pending':
      return chalk.gray('PENDING');
    default:
      return status.toUpperCase();
  }
}

/**
 * Get project status badge
 */
function getProjectStatusBadge(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.COMPLETED:
      return chalk.green.bold('COMPLETED');
    case ProjectStatus.FAILED:
      return chalk.red.bold('FAILED');
    case ProjectStatus.IN_PROGRESS:
      return chalk.yellow('IN PROGRESS');
    case ProjectStatus.PAUSED:
      return chalk.blue('PAUSED');
    case ProjectStatus.CREATED:
    case ProjectStatus.PLANNING:
      return chalk.gray('PENDING');
    case ProjectStatus.CANCELLED:
      return chalk.gray('CANCELLED');
    case ProjectStatus.BLOCKED:
      return chalk.red('BLOCKED');
    case ProjectStatus.REVIEW:
      return chalk.cyan('REVIEW');
    default:
      return String(status).toUpperCase();
  }
}

/**
 * Get completion status badge
 */
function getCompletionStatusBadge(status: CompletionStatus): string {
  switch (status) {
    case CompletionStatus.COMPLETE:
      return chalk.green.bold('COMPLETE');
    case CompletionStatus.PARTIALLY_COMPLETE:
      return chalk.yellow('PARTIALLY COMPLETE');
    case CompletionStatus.IN_PROGRESS:
      return chalk.blue('IN PROGRESS');
    case CompletionStatus.NOT_STARTED:
      return chalk.gray('NOT STARTED');
    case CompletionStatus.FAILED:
      return chalk.red.bold('FAILED');
    default:
      return String(status).toUpperCase();
  }
}

/**
 * Get task status icon
 */
function getTaskStatusIcon(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.COMPLETED:
      return chalk.green('');
    case TaskStatus.FAILED:
      return chalk.red('');
    case TaskStatus.IN_PROGRESS:
      return chalk.yellow('');
    case TaskStatus.PENDING:
      return chalk.gray('');
    case TaskStatus.BLOCKED:
      return chalk.red('');
    case TaskStatus.SKIPPED:
      return chalk.gray('');
    default:
      return chalk.gray('');
  }
}

/**
 * Get quality badge
 */
function getQualityBadge(level: string): string {
  switch (level.toLowerCase()) {
    case 'minimal':
      return chalk.gray('MINIMAL');
    case 'standard':
      return chalk.blue('STANDARD');
    case 'strict':
      return chalk.yellow('STRICT');
    case 'enterprise':
      return chalk.magenta.bold('ENTERPRISE');
    default:
      return level.toUpperCase();
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
