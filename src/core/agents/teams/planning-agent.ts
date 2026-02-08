/**
 * Planning Agent
 *
 * Team agent responsible for task decomposition and implementation planning.
 * Analyzes goals and creates structured plans with sub-tasks.
 *
 * Capabilities:
 * - Goal analysis and decomposition
 * - Implementation plan creation
 * - Task dependency mapping
 * - Resource estimation
 *
 * Feature: Team Agent Implementation for Agent OS
 */

import {
  TaskDocument,
  TaskType,
  TeamType,
} from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import {
  TaskHandler,
  TaskHandlerResult,
} from './team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from './base-team-agent';

/**
 * Planning output structure
 */
export interface PlanningOutput {
  /** Plan title */
  title: string;
  /** Plan summary */
  summary: string;
  /** Decomposed sub-tasks */
  tasks: Array<{
    title: string;
    type: TaskType;
    targetTeam: TeamType;
    description: string;
    dependencies?: string[];
    estimatedEffort?: 'small' | 'medium' | 'large';
  }>;
  /** Implementation phases */
  phases?: Array<{
    name: string;
    taskIndices: number[];
    description: string;
  }>;
  /** Risk assessment */
  risks?: string[];
  /** Assumptions */
  assumptions?: string[];
}

/**
 * Planning Agent Options
 */
export interface PlanningAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Custom plan generator function (for LLM integration) */
  planGenerator?: (task: TaskDocument) => Promise<PlanningOutput>;
  /** Auto-publish generated sub-tasks */
  autoPublishTasks?: boolean;
}

/**
 * Planning Agent
 */
export class PlanningAgent extends BaseTeamAgent {
  private planGenerator?: (task: TaskDocument) => Promise<PlanningOutput>;
  private autoPublishTasks: boolean;

  constructor(options: PlanningAgentOptions) {
    super({
      ...options,
      teamType: 'planning',
      config: {
        ...options.config,
        name: options.config?.name || 'Planning Team',
        description: options.config?.description || 'Creates implementation plans and decomposes goals into tasks',
        capabilities: options.config?.capabilities || [
          {
            name: 'goal-decomposition',
            description: 'Decompose high-level goals into actionable tasks',
            taskTypes: ['planning', 'analysis'],
            priority: 95,
          },
        ],
      },
    });

    this.planGenerator = options.planGenerator;
    this.autoPublishTasks = options.autoPublishTasks ?? false;
  }

  /**
   * Set custom plan generator (for LLM integration)
   */
  setPlanGenerator(generator: (task: TaskDocument) => Promise<PlanningOutput>): void {
    this.planGenerator = generator;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    // Planning task handler
    this.registerHandler(['planning'], this.handlePlanningTask.bind(this));

    // Analysis task handler
    this.registerHandler(['analysis'], this.handleAnalysisTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handlePlanningTask.bind(this);
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
   * Handle planning task
   */
  private async handlePlanningTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      // Generate plan using custom generator or default
      const plan = this.planGenerator
        ? await this.planGenerator(task)
        : await this.generateDefaultPlan(task);

      // Publish sub-tasks if configured
      const outputTasks: TaskDocument[] = [];
      if (this.autoPublishTasks && plan.tasks.length > 0) {
        for (const subTask of plan.tasks) {
          const published = await this.queue.publish({
            title: subTask.title,
            type: subTask.type,
            from: 'planning',
            to: subTask.targetTeam,
            priority: task.metadata.priority,
            parentTaskId: task.metadata.id,
            projectId: task.metadata.projectId,
            content: this.formatTaskContent(subTask),
            tags: [...task.metadata.tags, 'generated', 'from-plan'],
          });
          outputTasks.push(published);
        }
      }

      return {
        success: true,
        result: plan,
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
   * Handle analysis task
   */
  private async handleAnalysisTask(task: TaskDocument): Promise<TaskHandlerResult> {
    // For analysis tasks, we create a lightweight analysis plan
    const analysis = {
      title: `Analysis: ${task.metadata.title}`,
      summary: 'Task analysis completed',
      findings: this.extractKeyPoints(task.content),
      recommendations: [],
    };

    return {
      success: true,
      result: analysis,
    };
  }

  /**
   * Generate default plan (template-based)
   */
  private async generateDefaultPlan(task: TaskDocument): Promise<PlanningOutput> {
    const title = task.metadata.title;
    const content = task.content;

    // Extract key information from task content
    const keyPoints = this.extractKeyPoints(content);

    // Generate basic plan structure
    const tasks: PlanningOutput['tasks'] = [];

    // Default task decomposition based on common patterns
    if (this.isFeatureRequest(content)) {
      tasks.push(
        {
          title: `Design: ${title}`,
          type: 'design',
          targetTeam: 'design',
          description: 'Create design specifications and mockups',
          estimatedEffort: 'medium',
        },
        {
          title: `Implement: ${title}`,
          type: 'feature',
          targetTeam: 'development',
          description: 'Implement the feature according to design',
          dependencies: [`Design: ${title}`],
          estimatedEffort: 'large',
        },
        {
          title: `Test: ${title}`,
          type: 'test',
          targetTeam: 'qa',
          description: 'Create and run tests for the feature',
          dependencies: [`Implement: ${title}`],
          estimatedEffort: 'medium',
        },
        {
          title: `Review: ${title}`,
          type: 'review',
          targetTeam: 'code-quality',
          description: 'Code review and quality check',
          dependencies: [`Implement: ${title}`],
          estimatedEffort: 'small',
        }
      );
    } else if (this.isBugFix(content)) {
      tasks.push(
        {
          title: `Investigate: ${title}`,
          type: 'analysis',
          targetTeam: 'development',
          description: 'Investigate root cause of the issue',
          estimatedEffort: 'small',
        },
        {
          title: `Fix: ${title}`,
          type: 'bugfix',
          targetTeam: 'development',
          description: 'Implement the bug fix',
          dependencies: [`Investigate: ${title}`],
          estimatedEffort: 'medium',
        },
        {
          title: `Verify: ${title}`,
          type: 'test',
          targetTeam: 'qa',
          description: 'Verify the fix and add regression tests',
          dependencies: [`Fix: ${title}`],
          estimatedEffort: 'small',
        }
      );
    } else {
      // Generic task decomposition
      tasks.push(
        {
          title: `Analyze: ${title}`,
          type: 'analysis',
          targetTeam: 'planning',
          description: 'Detailed analysis of requirements',
          estimatedEffort: 'small',
        },
        {
          title: `Execute: ${title}`,
          type: 'feature',
          targetTeam: 'development',
          description: 'Execute the primary task',
          dependencies: [`Analyze: ${title}`],
          estimatedEffort: 'medium',
        }
      );
    }

    return {
      title: `Plan: ${title}`,
      summary: `Implementation plan for: ${title}`,
      tasks,
      phases: [
        {
          name: 'Analysis & Design',
          taskIndices: [0],
          description: 'Initial analysis and design phase',
        },
        {
          name: 'Implementation',
          taskIndices: tasks.length > 1 ? [1] : [],
          description: 'Core implementation phase',
        },
        {
          name: 'Verification',
          taskIndices: tasks.length > 2 ? tasks.slice(2).map((_, i) => i + 2) : [],
          description: 'Testing and review phase',
        },
      ],
      risks: keyPoints.risks || [],
      assumptions: keyPoints.assumptions || [],
    };
  }

  /**
   * Extract key points from content
   */
  private extractKeyPoints(content: string): {
    goals: string[];
    requirements: string[];
    risks: string[];
    assumptions: string[];
  } {
    const lines = content.split('\n');
    const goals: string[] = [];
    const requirements: string[] = [];
    const risks: string[] = [];
    const assumptions: string[] = [];

    let currentSection = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect section headers
      if (trimmed.toLowerCase().includes('goal')) {
        currentSection = 'goals';
      } else if (trimmed.toLowerCase().includes('requirement')) {
        currentSection = 'requirements';
      } else if (trimmed.toLowerCase().includes('risk')) {
        currentSection = 'risks';
      } else if (trimmed.toLowerCase().includes('assumption')) {
        currentSection = 'assumptions';
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const item = trimmed.substring(2);
        switch (currentSection) {
          case 'goals':
            goals.push(item);
            break;
          case 'requirements':
            requirements.push(item);
            break;
          case 'risks':
            risks.push(item);
            break;
          case 'assumptions':
            assumptions.push(item);
            break;
        }
      }
    }

    return { goals, requirements, risks, assumptions };
  }

  /**
   * Check if content is a feature request
   */
  private isFeatureRequest(content: string): boolean {
    const keywords = ['feature', 'implement', 'add', 'create', 'build', 'new'];
    const lowerContent = content.toLowerCase();
    return keywords.some((kw) => lowerContent.includes(kw));
  }

  /**
   * Check if content is a bug fix
   */
  private isBugFix(content: string): boolean {
    const keywords = ['bug', 'fix', 'error', 'issue', 'broken', 'crash', 'fail'];
    const lowerContent = content.toLowerCase();
    return keywords.some((kw) => lowerContent.includes(kw));
  }

  /**
   * Format task content
   */
  private formatTaskContent(subTask: PlanningOutput['tasks'][0]): string {
    let content = `## ${subTask.title}\n\n`;
    content += `${subTask.description}\n\n`;

    if (subTask.dependencies && subTask.dependencies.length > 0) {
      content += `### Dependencies\n\n`;
      for (const dep of subTask.dependencies) {
        content += `- ${dep}\n`;
      }
      content += '\n';
    }

    if (subTask.estimatedEffort) {
      content += `### Estimated Effort\n\n${subTask.estimatedEffort}\n`;
    }

    return content;
  }
}

/**
 * Create a planning agent
 */
export function createPlanningAgent(
  queue: DocumentQueue,
  options?: Partial<PlanningAgentOptions>
): PlanningAgent {
  return new PlanningAgent({
    queue,
    ...options,
  });
}
