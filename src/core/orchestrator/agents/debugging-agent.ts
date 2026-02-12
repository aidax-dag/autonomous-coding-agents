/**
 * Debugging Agent
 *
 * Team agent responsible for root cause analysis, hypothesis generation,
 * and systematic debugging. Investigates failures and suggests fixes.
 *
 * Capabilities:
 * - Root cause analysis
 * - Hypothesis generation and testing
 * - Evidence collection
 * - Fix suggestion
 *
 * Optimal model: Opus (debugging requires deep reasoning)
 *
 * @module core/orchestrator/agents
 */

import { TaskDocument } from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import { TaskHandler, TaskHandlerResult } from '../team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from '../base-team-agent';

/**
 * Debugging analysis output structure
 */
export interface DebuggingOutput {
  /** Identified root cause */
  rootCause: string;
  /** Generated hypotheses */
  hypotheses: Array<{
    description: string;
    confidence: number;
    verified: boolean;
  }>;
  /** Collected evidence */
  evidence: Array<{
    source: string;
    description: string;
    relevance: 'high' | 'medium' | 'low';
  }>;
  /** Suggested fix */
  suggestedFix: string;
  /** Additional investigation steps */
  nextSteps?: string[];
}

/**
 * Debugging Agent Options
 */
export interface DebuggingAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Custom debugging function (for LLM integration) */
  debugFunction?: (task: TaskDocument) => Promise<DebuggingOutput>;
}

/**
 * Debugging Agent
 *
 * Provides root cause analysis and systematic debugging capabilities.
 * Uses 'issue-response' team type as debugging is issue-response work.
 */
export class DebuggingAgent extends BaseTeamAgent {
  private debugFunction?: (task: TaskDocument) => Promise<DebuggingOutput>;

  constructor(options: DebuggingAgentOptions) {
    super({
      ...options,
      teamType: 'issue-response',
      config: {
        ...options.config,
        name: options.config?.name || 'Debugging Team',
        description: options.config?.description || 'Root cause analysis and systematic debugging',
        capabilities: options.config?.capabilities || [
          {
            name: 'root-cause-analysis',
            description: 'Investigate failures and identify root causes',
            taskTypes: ['bugfix', 'analysis'],
            priority: 88,
          },
        ],
      },
    });

    this.debugFunction = options.debugFunction;
  }

  /**
   * Set custom debug function (for LLM integration)
   */
  setDebugFunction(fn: (task: TaskDocument) => Promise<DebuggingOutput>): void {
    this.debugFunction = fn;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    this.registerHandler(['bugfix'], this.handleDebuggingTask.bind(this));
    this.registerHandler(['analysis'], this.handleDebuggingTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleDebuggingTask.bind(this);
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
   * Handle debugging task
   */
  private async handleDebuggingTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.debugFunction
        ? await this.debugFunction(task)
        : await this.generateDefaultDebugAnalysis(task);

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
   * Generate default debug analysis (placeholder for LLM integration)
   */
  private async generateDefaultDebugAnalysis(task: TaskDocument): Promise<DebuggingOutput> {
    const title = task.metadata.title;
    const content = task.content;

    const hypotheses = this.generateHypotheses(content);
    const evidence = this.collectEvidence(content);

    return {
      rootCause: `Root cause analysis pending for: ${title}`,
      hypotheses,
      evidence,
      suggestedFix: 'Further investigation required to determine appropriate fix',
      nextSteps: [
        'Reproduce the issue in a controlled environment',
        'Add logging around suspected areas',
        'Review recent changes related to the affected code',
      ],
    };
  }

  /**
   * Generate hypotheses from content
   */
  private generateHypotheses(
    content: string
  ): DebuggingOutput['hypotheses'] {
    const hypotheses: DebuggingOutput['hypotheses'] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('crash') || lowerContent.includes('error')) {
      hypotheses.push({
        description: 'Unhandled exception causing application crash',
        confidence: 0.6,
        verified: false,
      });
    }

    if (lowerContent.includes('slow') || lowerContent.includes('timeout')) {
      hypotheses.push({
        description: 'Performance bottleneck causing timeouts',
        confidence: 0.5,
        verified: false,
      });
    }

    if (lowerContent.includes('null') || lowerContent.includes('undefined')) {
      hypotheses.push({
        description: 'Null reference or undefined value access',
        confidence: 0.7,
        verified: false,
      });
    }

    if (hypotheses.length === 0) {
      hypotheses.push({
        description: 'General logic error in affected code path',
        confidence: 0.3,
        verified: false,
      });
    }

    return hypotheses;
  }

  /**
   * Collect evidence from content
   */
  private collectEvidence(content: string): DebuggingOutput['evidence'] {
    const evidence: DebuggingOutput['evidence'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('Error:') || trimmed.startsWith('Exception:')) {
        evidence.push({
          source: 'error-message',
          description: trimmed,
          relevance: 'high',
        });
      } else if (trimmed.startsWith('at ') || trimmed.includes('stack trace')) {
        evidence.push({
          source: 'stack-trace',
          description: trimmed,
          relevance: 'high',
        });
      } else if (trimmed.startsWith('- ') && trimmed.length > 5) {
        evidence.push({
          source: 'user-report',
          description: trimmed.substring(2),
          relevance: 'medium',
        });
      }
    }

    return evidence;
  }
}

/**
 * Create a debugging agent
 */
export function createDebuggingAgent(
  queue: DocumentQueue,
  options?: Partial<DebuggingAgentOptions>
): DebuggingAgent {
  return new DebuggingAgent({
    queue,
    ...options,
  });
}
