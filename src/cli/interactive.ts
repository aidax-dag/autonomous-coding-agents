/**
 * Interactive CLI Mode
 *
 * Provides real-time feedback and monitoring for agent tasks.
 * Allows users to provide feedback during development to adjust direction.
 *
 * Feature: F4.4 - Interactive Feedback System
 */

import * as readline from 'readline';
import chalk from 'chalk';
import { NatsClient } from '@/shared/messaging/nats-client';
import {
  FeedbackRequest,
  FeedbackResponse,
  FeedbackResponseType,
  AgentUpdate,
  AgentUpdateType,
  InteractiveSessionState,
} from '@/shared/feedback';
import { createAgentLogger } from '@/shared/logging/logger';

const logger = createAgentLogger('CLI', 'interactive');

/**
 * Interactive CLI for real-time agent monitoring and feedback
 */
export class InteractiveCLI {
  private rl: readline.Interface;
  private natsClient: NatsClient;
  private taskId: string;
  private state: InteractiveSessionState;
  private running: boolean = false;

  constructor(natsClient: NatsClient, taskId: string) {
    this.natsClient = natsClient;
    this.taskId = taskId;

    // Initialize readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('> '),
    });

    // Initialize session state
    this.state = {
      taskId,
      active: false,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      feedbackRequests: new Map(),
      pendingFeedback: [],
      updates: [],
    };
  }

  /**
   * Start interactive session
   */
  async start(): Promise<void> {
    this.running = true;
    this.state.active = true;

    console.log(chalk.bold.cyan('\n🤖 Interactive Mode Started\n'));
    console.log(chalk.gray(`Task ID: ${this.taskId}`));
    console.log(chalk.gray(`Type ${chalk.white('/help')} for available commands\n`));

    try {
      // Subscribe to agent updates
      await this.subscribeToUpdates();

      // Subscribe to feedback requests
      await this.subscribeToFeedbackRequests();

      // Start REPL
      this.startREPL();

      logger.info('Interactive session started', { taskId: this.taskId });
    } catch (error) {
      logger.error('Failed to start interactive session', { error });
      throw error;
    }
  }

  /**
   * Stop interactive session
   */
  async stop(): Promise<void> {
    this.running = false;
    this.state.active = false;

    this.rl.close();
    await this.natsClient.unsubscribe(`task.${this.taskId}.updates`);
    await this.natsClient.unsubscribe(`task.${this.taskId}.feedback-request`);

    console.log(chalk.yellow('\n👋 Interactive session ended\n'));
    logger.info('Interactive session stopped', { taskId: this.taskId });
  }

  /**
   * Subscribe to agent updates
   */
  private async subscribeToUpdates(): Promise<void> {
    await this.natsClient.subscribe(`task.${this.taskId}.updates`, async (data: unknown) => {
      try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        const update: AgentUpdate = JSON.parse(dataStr);
        this.handleUpdate(update);
      } catch (error) {
        logger.error('Failed to parse update message', { error });
      }
    });
  }

  /**
   * Subscribe to feedback requests
   */
  private async subscribeToFeedbackRequests(): Promise<void> {
    await this.natsClient.subscribe(`task.${this.taskId}.feedback-request`, async (data: unknown) => {
      try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        const request: FeedbackRequest = JSON.parse(dataStr);
        this.handleFeedbackRequest(request);
      } catch (error) {
        logger.error('Failed to parse feedback request', { error });
      }
    });
  }

  /**
   * Handle agent update
   */
  private handleUpdate(update: AgentUpdate): void {
    this.state.updates.push(update);
    this.state.lastActivityAt = Date.now();

    // Clear current line and move cursor up
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);

    // Display update based on type
    switch (update.type) {
      case AgentUpdateType.STATUS_CHANGE:
        console.log(chalk.blue(`\n📊 ${update.title}`));
        console.log(chalk.gray(`   ${update.message}`));
        break;

      case AgentUpdateType.PROGRESS:
        const progressBar = this.formatProgressBar(update.progress || 0);
        console.log(chalk.cyan(`\n⏳ ${update.title} ${progressBar}`));
        if (update.message) {
          console.log(chalk.gray(`   ${update.message}`));
        }
        break;

      case AgentUpdateType.INFO:
        console.log(chalk.white(`\nℹ️  ${update.message}`));
        break;

      case AgentUpdateType.WARNING:
        console.log(chalk.yellow(`\n⚠️  ${update.message}`));
        break;

      case AgentUpdateType.ERROR:
        console.log(chalk.red(`\n❌ ${update.message}`));
        break;

      case AgentUpdateType.SUCCESS:
        console.log(chalk.green(`\n✅ ${update.message}`));
        break;

      case AgentUpdateType.FEEDBACK_REQUEST:
        if (update.feedbackRequest) {
          this.handleFeedbackRequest(update.feedbackRequest);
        }
        break;
    }

    // Re-display prompt
    this.rl.prompt(true);
  }

  /**
   * Handle feedback request
   */
  private handleFeedbackRequest(request: FeedbackRequest): void {
    this.state.feedbackRequests.set(request.id, request);
    this.state.pendingFeedback.push(request.id);

    console.log(chalk.bold.magenta(`\n💬 Feedback Requested`));
    console.log(chalk.gray(`   ID: ${request.id}`));
    console.log(chalk.white(`   ${request.title}`));
    console.log(chalk.gray(`   ${request.content}\n`));

    if (request.options && request.options.length > 0) {
      console.log(chalk.gray('   Options:'));
      request.options.forEach((option, index) => {
        console.log(
          chalk.white(`   ${index + 1}. ${option.label}`) +
            (option.description ? chalk.gray(` - ${option.description}`) : '')
        );
      });
      console.log();
    }

    console.log(
      chalk.gray(
        `   Reply with: ${chalk.white(`/respond ${request.id} <choice> [message]`)}`
      )
    );
    console.log();

    this.rl.prompt(true);
  }

  /**
   * Start REPL loop
   */
  private startREPL(): void {
    this.rl.on('line', async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        this.rl.prompt();
        return;
      }

      try {
        if (trimmed.startsWith('/')) {
          await this.handleCommand(trimmed);
        } else {
          await this.sendFeedback(trimmed);
        }
      } catch (error) {
        console.log(chalk.red(`Error: ${(error as Error).message}`));
        logger.error('Command execution failed', { error });
      }

      this.rl.prompt();
    });

    this.rl.on('close', () => {
      if (this.running) {
        this.stop().catch((error) => {
          logger.error('Error during stop', { error });
        });
      }
    });

    this.rl.prompt();
  }

  /**
   * Handle slash command
   */
  private async handleCommand(command: string): Promise<void> {
    const parts = command.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        this.displayHelp();
        break;

      case 'status':
        this.displayStatus();
        break;

      case 'pending':
        this.displayPendingFeedback();
        break;

      case 'respond':
        await this.respondToFeedback(args);
        break;

      case 'pause':
        await this.pauseTask();
        break;

      case 'resume':
        await this.resumeTask();
        break;

      case 'quit':
      case 'exit':
        await this.stop();
        process.exit(0);
        break;

      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
        console.log(chalk.gray(`Type /help for available commands`));
    }
  }

  /**
   * Send general feedback message
   */
  private async sendFeedback(message: string): Promise<void> {
    const feedback: FeedbackResponse = {
      id: `feedback-${Date.now()}`,
      requestId: '',
      taskId: this.taskId,
      type: FeedbackResponseType.CUSTOM,
      message,
      createdAt: Date.now(),
    };

    await this.natsClient.publish(`task.${this.taskId}.feedback`, feedback);

    console.log(chalk.green('✓ Feedback sent'));
    logger.info('Feedback sent', { taskId: this.taskId, message });
  }

  /**
   * Respond to specific feedback request
   */
  private async respondToFeedback(args: string[]): Promise<void> {
    if (args.length < 2) {
      console.log(chalk.red('Usage: /respond <request-id> <choice> [message]'));
      return;
    }

    const requestId = args[0];
    const choice = args[1];
    const message = args.slice(2).join(' ');

    const request = this.state.feedbackRequests.get(requestId);
    if (!request) {
      console.log(chalk.red(`Feedback request not found: ${requestId}`));
      return;
    }

    const response: FeedbackResponse = {
      id: `response-${Date.now()}`,
      requestId,
      taskId: this.taskId,
      type: this.parseResponseType(choice),
      choice,
      message: message || undefined,
      createdAt: Date.now(),
    };

    await this.natsClient.publish(`task.${this.taskId}.feedback`, response);

    // Remove from pending
    this.state.pendingFeedback = this.state.pendingFeedback.filter((id) => id !== requestId);

    console.log(chalk.green(`✓ Response sent for ${requestId}`));
    logger.info('Feedback response sent', { requestId, choice });
  }

  /**
   * Parse response type from choice
   */
  private parseResponseType(choice: string): FeedbackResponseType {
    const lowerChoice = choice.toLowerCase();
    if (lowerChoice === 'approve' || lowerChoice === 'yes') {
      return FeedbackResponseType.APPROVE;
    } else if (lowerChoice === 'modify' || lowerChoice === 'change') {
      return FeedbackResponseType.MODIFY;
    } else if (lowerChoice === 'reject' || lowerChoice === 'no') {
      return FeedbackResponseType.REJECT;
    }
    return FeedbackResponseType.CUSTOM;
  }

  /**
   * Pause task execution
   */
  private async pauseTask(): Promise<void> {
    await this.natsClient.publish(`task.${this.taskId}.control`, {
      action: 'pause',
      timestamp: Date.now(),
    });
    console.log(chalk.yellow('⏸️  Task paused'));
  }

  /**
   * Resume task execution
   */
  private async resumeTask(): Promise<void> {
    await this.natsClient.publish(`task.${this.taskId}.control`, {
      action: 'resume',
      timestamp: Date.now(),
    });
    console.log(chalk.green('▶️  Task resumed'));
  }

  /**
   * Display help
   */
  private displayHelp(): void {
    console.log(chalk.bold('\nAvailable Commands:\n'));
    console.log(chalk.white('  /help') + chalk.gray('              - Show this help message'));
    console.log(chalk.white('  /status') + chalk.gray('            - Show current task status'));
    console.log(
      chalk.white('  /pending') + chalk.gray('           - List pending feedback requests')
    );
    console.log(
      chalk.white('  /respond <id> <choice>') +
        chalk.gray(' - Respond to feedback request')
    );
    console.log(chalk.white('  /pause') + chalk.gray('             - Pause task execution'));
    console.log(chalk.white('  /resume') + chalk.gray('            - Resume task execution'));
    console.log(chalk.white('  /quit') + chalk.gray('              - Exit interactive mode'));
    console.log();
    console.log(chalk.gray('To send general feedback, just type your message and press Enter.'));
    console.log();
  }

  /**
   * Display current status
   */
  private displayStatus(): void {
    const uptime = Date.now() - this.state.startedAt;
    const inactive = Date.now() - this.state.lastActivityAt;

    console.log(chalk.bold('\nTask Status:\n'));
    console.log(chalk.white('  Task ID:          ') + chalk.cyan(this.taskId));
    console.log(
      chalk.white('  Session uptime:   ') + chalk.gray(this.formatDuration(uptime))
    );
    console.log(
      chalk.white('  Last activity:    ') +
        chalk.gray(`${this.formatDuration(inactive)} ago`)
    );
    console.log(
      chalk.white('  Updates received: ') + chalk.cyan(this.state.updates.length.toString())
    );
    console.log(
      chalk.white('  Pending feedback: ') + chalk.yellow(this.state.pendingFeedback.length.toString())
    );
    console.log();
  }

  /**
   * Display pending feedback requests
   */
  private displayPendingFeedback(): void {
    if (this.state.pendingFeedback.length === 0) {
      console.log(chalk.gray('\nNo pending feedback requests\n'));
      return;
    }

    console.log(chalk.bold('\nPending Feedback Requests:\n'));

    this.state.pendingFeedback.forEach((requestId) => {
      const request = this.state.feedbackRequests.get(requestId);
      if (request) {
        console.log(chalk.white(`  ID: ${requestId}`));
        console.log(chalk.gray(`  ${request.title}`));
        console.log(chalk.gray(`  ${request.content}`));
        console.log();
      }
    });
  }

  /**
   * Format progress bar
   */
  private formatProgressBar(progress: number, width: number = 20): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${progress.toFixed(0)}%`;
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}
