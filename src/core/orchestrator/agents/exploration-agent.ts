/**
 * Exploration Agent
 *
 * Team agent responsible for codebase exploration, file discovery,
 * symbol analysis, and pattern recognition. Builds understanding
 * of unfamiliar codebases.
 *
 * Capabilities:
 * - Codebase exploration
 * - File and symbol discovery
 * - Pattern recognition
 * - Dependency mapping
 *
 * Optimal model: Sonnet (exploration is systematic traversal)
 *
 * @module core/orchestrator/agents
 */

import { TaskDocument } from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import { TaskHandler, TaskHandlerResult } from '../team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from '../base-team-agent';

/**
 * Exploration output structure
 */
export interface ExplorationOutput {
  /** Discovered files */
  files: Array<{
    path: string;
    type: string;
    size?: number;
  }>;
  /** Discovered symbols */
  symbols: Array<{
    name: string;
    type: 'function' | 'class' | 'variable' | 'interface' | 'type' | 'enum';
    file: string;
    exported: boolean;
  }>;
  /** Recognized patterns */
  patterns: string[];
  /** Exploration summary */
  summary: string;
  /** Dependency graph edges */
  dependencies?: Array<{
    source: string;
    target: string;
    type: 'import' | 'extends' | 'implements' | 'uses';
  }>;
}

/**
 * Exploration Agent Options
 */
export interface ExplorationAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Custom exploration function (for LLM integration) */
  exploreFunction?: (task: TaskDocument) => Promise<ExplorationOutput>;
}

/**
 * Exploration Agent
 *
 * Provides codebase exploration and discovery capabilities.
 * Uses 'development' team type as exploration supports development.
 */
export class ExplorationAgent extends BaseTeamAgent {
  private exploreFunction?: (task: TaskDocument) => Promise<ExplorationOutput>;

  constructor(options: ExplorationAgentOptions) {
    super({
      ...options,
      teamType: 'operations',
      config: {
        ...options.config,
        name: options.config?.name || 'Exploration Team',
        description: options.config?.description || 'Codebase exploration and pattern discovery',
        capabilities: options.config?.capabilities || [
          {
            name: 'codebase-exploration',
            description: 'Explore and map codebase structure',
            taskTypes: ['analysis', 'planning'],
            priority: 85,
          },
        ],
      },
    });

    this.exploreFunction = options.exploreFunction;
  }

  /**
   * Set custom explore function (for LLM integration)
   */
  setExploreFunction(fn: (task: TaskDocument) => Promise<ExplorationOutput>): void {
    this.exploreFunction = fn;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    this.registerHandler(['analysis'], this.handleExplorationTask.bind(this));
    this.registerHandler(['planning'], this.handleExplorationTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleExplorationTask.bind(this);
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
   * Handle exploration task
   */
  private async handleExplorationTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.exploreFunction
        ? await this.exploreFunction(task)
        : await this.generateDefaultExploration(task);

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
   * Generate default exploration output (placeholder for LLM integration)
   */
  private async generateDefaultExploration(task: TaskDocument): Promise<ExplorationOutput> {
    const title = task.metadata.title;
    const content = task.content;
    const taskFiles = task.metadata.files || [];

    const files = taskFiles.map((f) => ({
      path: f.path,
      type: this.getFileType(f.path),
    }));

    const symbols = this.extractSymbols(content);
    const patterns = this.detectCodePatterns(content);

    return {
      files,
      symbols,
      patterns,
      summary: `Exploration completed for: ${title}. Found ${files.length} files, ${symbols.length} symbols, ${patterns.length} patterns.`,
    };
  }

  /**
   * Get file type from path
   */
  private getFileType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const typeMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript-react',
      js: 'javascript',
      jsx: 'javascript-react',
      py: 'python',
      go: 'go',
      rs: 'rust',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      css: 'css',
      html: 'html',
    };
    return typeMap[ext] || ext;
  }

  /**
   * Extract symbols from content
   */
  private extractSymbols(content: string): ExplorationOutput['symbols'] {
    const symbols: ExplorationOutput['symbols'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect exported functions
      const funcMatch = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        symbols.push({
          name: funcMatch[1],
          type: 'function',
          file: 'detected-in-content',
          exported: trimmed.startsWith('export'),
        });
      }

      // Detect classes
      const classMatch = trimmed.match(/^(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          type: 'class',
          file: 'detected-in-content',
          exported: trimmed.startsWith('export'),
        });
      }

      // Detect interfaces
      const ifaceMatch = trimmed.match(/^(?:export\s+)?interface\s+(\w+)/);
      if (ifaceMatch) {
        symbols.push({
          name: ifaceMatch[1],
          type: 'interface',
          file: 'detected-in-content',
          exported: trimmed.startsWith('export'),
        });
      }
    }

    return symbols;
  }

  /**
   * Detect code patterns from content
   */
  private detectCodePatterns(content: string): string[] {
    const patterns: string[] = [];
    const lowerContent = content.toLowerCase();

    const patternRules: Array<{ keyword: string; pattern: string }> = [
      { keyword: 'singleton', pattern: 'Singleton Pattern' },
      { keyword: 'factory', pattern: 'Factory Pattern' },
      { keyword: 'observer', pattern: 'Observer Pattern' },
      { keyword: 'strategy', pattern: 'Strategy Pattern' },
      { keyword: 'decorator', pattern: 'Decorator Pattern' },
      { keyword: 'adapter', pattern: 'Adapter Pattern' },
      { keyword: 'middleware', pattern: 'Middleware Pattern' },
      { keyword: 'registry', pattern: 'Registry Pattern' },
      { keyword: 'barrel', pattern: 'Barrel Export Pattern' },
      { keyword: 'dependency injection', pattern: 'Dependency Injection' },
    ];

    for (const rule of patternRules) {
      if (lowerContent.includes(rule.keyword)) {
        patterns.push(rule.pattern);
      }
    }

    return patterns;
  }
}

/**
 * Create an exploration agent
 */
export function createExplorationAgent(
  queue: DocumentQueue,
  options?: Partial<ExplorationAgentOptions>
): ExplorationAgent {
  return new ExplorationAgent({
    queue,
    ...options,
  });
}
