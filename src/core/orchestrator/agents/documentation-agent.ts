/**
 * Documentation Agent
 *
 * Team agent responsible for generating and maintaining documentation.
 * Creates API docs, user guides, architectural documentation, and
 * inline code documentation.
 *
 * Capabilities:
 * - Documentation generation
 * - API documentation
 * - Architecture documentation
 * - User guide creation
 *
 * Optimal model: Sonnet (documentation is structured generation)
 *
 * @module core/orchestrator/agents
 */

import { TaskDocument } from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import { TaskHandler, TaskHandlerResult } from '../team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from '../base-team-agent';

/**
 * Documentation section structure
 */
export interface DocumentationSection {
  /** Section title */
  title: string;
  /** Section content */
  content: string;
  /** Section type */
  type: 'overview' | 'api' | 'guide' | 'reference' | 'example' | 'changelog';
}

/**
 * Documentation output structure
 */
export interface DocumentationOutput {
  /** Generated documentation sections */
  sections: DocumentationSection[];
  /** Overall summary */
  summary: string;
  /** Output format */
  format: 'markdown' | 'html' | 'jsdoc';
  /** Files that should be documented */
  coveredFiles?: string[];
}

/**
 * Documentation Agent Options
 */
export interface DocumentationAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Custom documentation generator function (for LLM integration) */
  generateFunction?: (task: TaskDocument) => Promise<DocumentationOutput>;
  /** Default output format */
  defaultFormat?: 'markdown' | 'html' | 'jsdoc';
}

/**
 * Documentation Agent
 *
 * Provides documentation generation and maintenance capabilities.
 * Uses 'planning' team type as documentation is planning-adjacent.
 */
export class DocumentationAgent extends BaseTeamAgent {
  private generateFunction?: (task: TaskDocument) => Promise<DocumentationOutput>;
  private defaultFormat: 'markdown' | 'html' | 'jsdoc';

  constructor(options: DocumentationAgentOptions) {
    super({
      ...options,
      teamType: 'planning',
      config: {
        ...options.config,
        name: options.config?.name || 'Documentation Team',
        description: options.config?.description || 'Documentation generation and maintenance',
        capabilities: options.config?.capabilities || [
          {
            name: 'documentation-generation',
            description: 'Generate and maintain project documentation',
            taskTypes: ['documentation', 'planning'],
            priority: 80,
          },
        ],
      },
    });

    this.generateFunction = options.generateFunction;
    this.defaultFormat = options.defaultFormat ?? 'markdown';
  }

  /**
   * Set custom generate function (for LLM integration)
   */
  setGenerateFunction(fn: (task: TaskDocument) => Promise<DocumentationOutput>): void {
    this.generateFunction = fn;
  }

  /**
   * Get default format
   */
  getDefaultFormat(): string {
    return this.defaultFormat;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    this.registerHandler(['documentation'], this.handleDocumentationTask.bind(this));
    this.registerHandler(['planning'], this.handleDocumentationTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleDocumentationTask.bind(this);
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
   * Handle documentation task
   */
  private async handleDocumentationTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.generateFunction
        ? await this.generateFunction(task)
        : await this.generateDefaultDocumentation(task);

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
   * Generate default documentation (placeholder for LLM integration)
   */
  private async generateDefaultDocumentation(task: TaskDocument): Promise<DocumentationOutput> {
    const title = task.metadata.title;
    const content = task.content;
    const files = task.metadata.files || [];

    const sections = this.buildSections(title, content);

    return {
      sections,
      summary: `Documentation generated for: ${title}`,
      format: this.defaultFormat,
      coveredFiles: files.map((f) => f.path),
    };
  }

  /**
   * Build documentation sections from content
   */
  private buildSections(title: string, content: string): DocumentationSection[] {
    const sections: DocumentationSection[] = [];

    // Overview section
    sections.push({
      title: 'Overview',
      content: `# ${title}\n\n${this.extractSummary(content)}`,
      type: 'overview',
    });

    // Detect API-related content
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('api') || lowerContent.includes('endpoint') || lowerContent.includes('function')) {
      sections.push({
        title: 'API Reference',
        content: this.extractApiDocs(content),
        type: 'api',
      });
    }

    // Detect example-related content
    if (lowerContent.includes('example') || lowerContent.includes('usage')) {
      sections.push({
        title: 'Examples',
        content: this.extractExamples(content),
        type: 'example',
      });
    }

    return sections;
  }

  /**
   * Extract summary from content
   */
  private extractSummary(content: string): string {
    const lines = content.split('\n');
    const summaryLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 && summaryLines.length > 0) break;
      if (trimmed.length > 0) {
        summaryLines.push(trimmed);
      }
    }

    return summaryLines.join('\n') || 'No summary available.';
  }

  /**
   * Extract API documentation from content
   */
  private extractApiDocs(content: string): string {
    const lines = content.split('\n');
    const apiLines: string[] = [];
    let inApiSection = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.includes('api') || trimmed.includes('endpoint') || trimmed.includes('function')) {
        inApiSection = true;
      }
      if (inApiSection) {
        apiLines.push(line);
      }
    }

    return apiLines.length > 0
      ? apiLines.join('\n')
      : 'API documentation will be generated from source code analysis.';
  }

  /**
   * Extract examples from content
   */
  private extractExamples(content: string): string {
    const lines = content.split('\n');
    const exampleLines: string[] = [];
    let inExample = false;

    for (const line of lines) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.includes('example') || trimmed.includes('usage')) {
        inExample = true;
      }
      if (inExample) {
        exampleLines.push(line);
      }
    }

    return exampleLines.length > 0
      ? exampleLines.join('\n')
      : 'Examples will be generated from test cases.';
  }
}

/**
 * Create a documentation agent
 */
export function createDocumentationAgent(
  queue: DocumentQueue,
  options?: Partial<DocumentationAgentOptions>
): DocumentationAgent {
  return new DocumentationAgent({
    queue,
    ...options,
  });
}
