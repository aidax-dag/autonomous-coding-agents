/**
 * Architecture Agent
 *
 * Team agent responsible for system design, dependency analysis, and
 * architectural decision making. Analyzes component relationships,
 * identifies patterns, and recommends structural improvements.
 *
 * Capabilities:
 * - System design and decomposition
 * - Dependency analysis
 * - Architectural pattern recommendation
 * - Trade-off analysis
 *
 * Optimal model: Opus (complex reasoning)
 *
 * @module core/orchestrator/agents
 */

import { TaskDocument } from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import { TaskHandler, TaskHandlerResult } from '../team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from '../base-team-agent';

/**
 * Architecture analysis output structure
 */
export interface ArchitectureOutput {
  /** Identified system components */
  components: Array<{
    name: string;
    responsibility: string;
    dependencies: string[];
  }>;
  /** Recognized architectural patterns */
  patterns: string[];
  /** Trade-off analysis for design decisions */
  tradeoffs: Array<{
    option: string;
    pros: string[];
    cons: string[];
  }>;
  /** Final architectural recommendation */
  recommendation: string;
}

/**
 * Architecture Agent Options
 */
export interface ArchitectureAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Custom architecture analysis function (for LLM integration) */
  analyzeFunction?: (task: TaskDocument) => Promise<ArchitectureOutput>;
}

/**
 * Architecture Agent
 *
 * Provides system design and architectural analysis capabilities.
 * Uses 'planning' team type as architecture is planning-adjacent.
 */
export class ArchitectureAgent extends BaseTeamAgent {
  private analyzeFunction?: (task: TaskDocument) => Promise<ArchitectureOutput>;

  constructor(options: ArchitectureAgentOptions) {
    super({
      ...options,
      teamType: 'planning',
      config: {
        ...options.config,
        name: options.config?.name || 'Architecture Team',
        description: options.config?.description || 'System design and architectural analysis',
        capabilities: options.config?.capabilities || [
          {
            name: 'system-design',
            description: 'Analyze and design system architecture',
            taskTypes: ['planning', 'analysis'],
            priority: 90,
          },
        ],
      },
    });

    this.analyzeFunction = options.analyzeFunction;
  }

  /**
   * Set custom analysis function (for LLM integration)
   */
  setAnalyzeFunction(fn: (task: TaskDocument) => Promise<ArchitectureOutput>): void {
    this.analyzeFunction = fn;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    this.registerHandler(['planning'], this.handleArchitectureTask.bind(this));
    this.registerHandler(['analysis'], this.handleArchitectureTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleArchitectureTask.bind(this);
  }

  /**
   * Hook: on start
   */
  protected async onStart(): Promise<void> {
    // Initialization logic
  }

  /**
   * Hook: on stop
   */
  protected async onStop(): Promise<void> {
    // Cleanup logic
  }

  /**
   * Handle architecture analysis task
   */
  private async handleArchitectureTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.analyzeFunction
        ? await this.analyzeFunction(task)
        : await this.generateDefaultAnalysis(task);

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
   * Generate default architecture analysis (placeholder for LLM integration)
   */
  private async generateDefaultAnalysis(task: TaskDocument): Promise<ArchitectureOutput> {
    const title = task.metadata.title;
    const content = task.content;

    const components = this.extractComponents(content);
    const patterns = this.detectPatterns(content);

    return {
      components,
      patterns,
      tradeoffs: [
        {
          option: 'Modular architecture',
          pros: ['Separation of concerns', 'Independent deployment'],
          cons: ['Increased complexity', 'Inter-module communication overhead'],
        },
      ],
      recommendation: `Architecture analysis for "${title}" suggests a modular approach with clear component boundaries.`,
    };
  }

  /**
   * Extract components from content
   */
  private extractComponents(
    content: string
  ): ArchitectureOutput['components'] {
    const components: ArchitectureOutput['components'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const name = trimmed.substring(2).split(':')[0].trim();
        if (name.length > 0 && name.length < 60) {
          components.push({
            name,
            responsibility: 'Extracted from task content',
            dependencies: [],
          });
        }
      }
    }

    return components;
  }

  /**
   * Detect architectural patterns from content
   */
  private detectPatterns(content: string): string[] {
    const patterns: string[] = [];
    const lowerContent = content.toLowerCase();

    const patternKeywords: Record<string, string> = {
      'microservice': 'Microservices Architecture',
      'event-driven': 'Event-Driven Architecture',
      'layer': 'Layered Architecture',
      'plugin': 'Plugin Architecture',
      'pipeline': 'Pipeline Pattern',
      'repository': 'Repository Pattern',
      'factory': 'Factory Pattern',
      'observer': 'Observer Pattern',
      'middleware': 'Middleware Pattern',
    };

    for (const [keyword, pattern] of Object.entries(patternKeywords)) {
      if (lowerContent.includes(keyword)) {
        patterns.push(pattern);
      }
    }

    return patterns;
  }
}

/**
 * Create an architecture agent
 */
export function createArchitectureAgent(
  queue: DocumentQueue,
  options?: Partial<ArchitectureAgentOptions>
): ArchitectureAgent {
  return new ArchitectureAgent({
    queue,
    ...options,
  });
}
