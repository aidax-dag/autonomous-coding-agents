/**
 * Development Agent
 *
 * Team agent responsible for code implementation tasks.
 * Handles feature development, bug fixes, and refactoring.
 *
 * Capabilities:
 * - Feature implementation
 * - Bug fixing
 * - Code refactoring
 * - Code generation
 *
 * Feature: Team Agent Implementation for Agent OS
 */

import {
  TaskDocument,
} from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import {
  TaskHandler,
  TaskHandlerResult,
} from '../team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from '../base-team-agent';

/**
 * Development output structure
 */
export interface DevelopmentOutput {
  /** Summary of changes */
  summary: string;
  /** Files modified */
  filesModified: Array<{
    path: string;
    action: 'created' | 'modified' | 'deleted';
    description: string;
  }>;
  /** Code snippets (for review) */
  codeChanges?: Array<{
    file: string;
    language: string;
    diff?: string;
    newCode?: string;
  }>;
  /** Tests added/modified */
  tests?: string[];
  /** Documentation updates */
  documentation?: string[];
  /** Notes for review */
  reviewNotes?: string[];
}

/**
 * Development Agent Options
 */
export interface DevelopmentAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Specialization (frontend, backend, fullstack) */
  specialization?: 'frontend' | 'backend' | 'fullstack';
  /** Code executor function (for LLM integration) */
  codeExecutor?: (task: TaskDocument) => Promise<DevelopmentOutput>;
  /** Supported languages */
  supportedLanguages?: string[];
  /** Auto-create review task after completion */
  autoCreateReview?: boolean;
}

/**
 * Development Agent
 */
export class DevelopmentAgent extends BaseTeamAgent {
  private specialization: 'frontend' | 'backend' | 'fullstack';
  private codeExecutor?: (task: TaskDocument) => Promise<DevelopmentOutput>;
  private supportedLanguages: string[];
  private autoCreateReview: boolean;

  constructor(options: DevelopmentAgentOptions) {
    const teamType = options.specialization === 'frontend'
      ? 'frontend'
      : options.specialization === 'backend'
        ? 'backend'
        : 'development';

    super({
      ...options,
      teamType,
      config: {
        ...options.config,
        name: options.config?.name || `${options.specialization || 'Development'} Team`,
        description: options.config?.description || 'Implements features, fixes bugs, and refactors code',
        capabilities: options.config?.capabilities || [
          {
            name: 'feature-implementation',
            description: 'Implement new features',
            taskTypes: ['feature'],
            priority: 80,
          },
          {
            name: 'bug-fixing',
            description: 'Fix bugs and issues',
            taskTypes: ['bugfix'],
            priority: 85,
          },
          {
            name: 'refactoring',
            description: 'Refactor and improve code',
            taskTypes: ['refactor'],
            priority: 70,
          },
        ],
      },
    });

    this.specialization = options.specialization || 'fullstack';
    this.codeExecutor = options.codeExecutor;
    this.supportedLanguages = options.supportedLanguages || ['typescript', 'javascript', 'python'];
    this.autoCreateReview = options.autoCreateReview ?? false;
  }

  /**
   * Set custom code executor (for LLM integration)
   */
  setCodeExecutor(executor: (task: TaskDocument) => Promise<DevelopmentOutput>): void {
    this.codeExecutor = executor;
  }

  /**
   * Get specialization
   */
  getSpecialization(): string {
    return this.specialization;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return this.supportedLanguages;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    // Feature implementation handler
    this.registerHandler(['feature'], this.handleFeatureTask.bind(this));

    // Bug fix handler
    this.registerHandler(['bugfix'], this.handleBugfixTask.bind(this));

    // Refactoring handler
    this.registerHandler(['refactor'], this.handleRefactorTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleFeatureTask.bind(this);
  }

  /**
   * Hook: on start
   */
  protected async onStart(): Promise<void> {
    // Any initialization logic
  }

  /**
   * Hook: on stop
   */
  protected async onStop(): Promise<void> {
    // Any cleanup logic
  }

  /**
   * Handle feature task
   */
  private async handleFeatureTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.codeExecutor
        ? await this.codeExecutor(task)
        : await this.generateDefaultOutput(task, 'feature');

      // Create review task if configured
      const outputTasks: TaskDocument[] = [];
      if (this.autoCreateReview) {
        const reviewTask = await this.createReviewTask(task, output);
        outputTasks.push(reviewTask);
      }

      return {
        success: true,
        result: output,
        outputTasks,
        metrics: {
          processingTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle bugfix task
   */
  private async handleBugfixTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.codeExecutor
        ? await this.codeExecutor(task)
        : await this.generateDefaultOutput(task, 'bugfix');

      return {
        success: true,
        result: output,
        metrics: {
          processingTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle refactor task
   */
  private async handleRefactorTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.codeExecutor
        ? await this.codeExecutor(task)
        : await this.generateDefaultOutput(task, 'refactor');

      return {
        success: true,
        result: output,
        metrics: {
          processingTime: Date.now(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Generate default output (placeholder for LLM integration)
   */
  private async generateDefaultOutput(
    task: TaskDocument,
    type: 'feature' | 'bugfix' | 'refactor'
  ): Promise<DevelopmentOutput> {
    const title = task.metadata.title;

    // Extract file references from task
    const fileRefs = task.metadata.files || [];

    const output: DevelopmentOutput = {
      summary: `${type === 'feature' ? 'Implemented' : type === 'bugfix' ? 'Fixed' : 'Refactored'}: ${title}`,
      filesModified: fileRefs.map((ref) => ({
        path: ref.path,
        action: ref.action === 'create' ? 'created' : ref.action === 'delete' ? 'deleted' : 'modified',
        description: ref.description || `${ref.action} ${ref.path}`,
      })),
      reviewNotes: [
        `Task type: ${type}`,
        `Priority: ${task.metadata.priority}`,
        'Ready for code review',
      ],
    };

    // Add type-specific notes
    if (type === 'bugfix') {
      output.reviewNotes?.push('Please verify the fix addresses the root cause');
      output.tests = ['Added regression test for the fix'];
    } else if (type === 'refactor') {
      output.reviewNotes?.push('No functional changes expected');
      output.reviewNotes?.push('Please verify all tests still pass');
    }

    return output;
  }

  /**
   * Create review task
   */
  private async createReviewTask(
    originalTask: TaskDocument,
    output: DevelopmentOutput
  ): Promise<TaskDocument> {
    const reviewContent = this.formatReviewContent(originalTask, output);

    return this.queue.publish({
      title: `Review: ${originalTask.metadata.title}`,
      type: 'review',
      from: this.teamType,
      to: 'code-quality',
      priority: originalTask.metadata.priority,
      parentTaskId: originalTask.metadata.id,
      projectId: originalTask.metadata.projectId,
      content: reviewContent,
      tags: [...originalTask.metadata.tags, 'auto-generated', 'review-request'],
    });
  }

  /**
   * Format review content
   */
  private formatReviewContent(task: TaskDocument, output: DevelopmentOutput): string {
    let content = `## Code Review Request\n\n`;
    content += `### Original Task\n\n${task.metadata.title}\n\n`;
    content += `### Summary\n\n${output.summary}\n\n`;

    if (output.filesModified.length > 0) {
      content += `### Files Modified\n\n`;
      for (const file of output.filesModified) {
        content += `- \`${file.path}\` (${file.action}): ${file.description}\n`;
      }
      content += '\n';
    }

    if (output.reviewNotes && output.reviewNotes.length > 0) {
      content += `### Review Notes\n\n`;
      for (const note of output.reviewNotes) {
        content += `- ${note}\n`;
      }
    }

    return content;
  }
}

/**
 * Create a development agent
 */
export function createDevelopmentAgent(
  queue: DocumentQueue,
  options?: Partial<DevelopmentAgentOptions>
): DevelopmentAgent {
  return new DevelopmentAgent({
    queue,
    ...options,
  });
}

/**
 * Create a frontend development agent
 */
export function createFrontendAgent(
  queue: DocumentQueue,
  options?: Partial<Omit<DevelopmentAgentOptions, 'specialization'>>
): DevelopmentAgent {
  return new DevelopmentAgent({
    queue,
    ...options,
    specialization: 'frontend',
    supportedLanguages: ['typescript', 'javascript', 'css', 'html'],
  });
}

/**
 * Create a backend development agent
 */
export function createBackendAgent(
  queue: DocumentQueue,
  options?: Partial<Omit<DevelopmentAgentOptions, 'specialization'>>
): DevelopmentAgent {
  return new DevelopmentAgent({
    queue,
    ...options,
    specialization: 'backend',
    supportedLanguages: ['typescript', 'javascript', 'python', 'go'],
  });
}
