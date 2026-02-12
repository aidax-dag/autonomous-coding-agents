/**
 * Integration Agent
 *
 * Team agent responsible for verifying system integration,
 * testing component connections, and validating cross-module
 * communication and data flow.
 *
 * Capabilities:
 * - Integration verification
 * - Connection testing
 * - Data flow validation
 * - Cross-module compatibility
 *
 * Optimal model: Sonnet (integration testing is systematic verification)
 *
 * @module core/orchestrator/agents
 */

import { TaskDocument } from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import { TaskHandler, TaskHandlerResult } from '../team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from '../base-team-agent';

/**
 * Integration connection structure
 */
export interface IntegrationConnection {
  /** Source component */
  source: string;
  /** Target component */
  target: string;
  /** Connection status */
  status: 'connected' | 'disconnected' | 'degraded';
  /** Protocol or interface type */
  protocol?: string;
  /** Latency in ms */
  latency?: number;
}

/**
 * Integration output structure
 */
export interface IntegrationOutput {
  /** Verified connections */
  connections: IntegrationConnection[];
  /** Detected issues */
  issues: Array<{
    severity: 'critical' | 'warning' | 'info';
    component: string;
    description: string;
    suggestion: string;
  }>;
  /** Integration coverage percentage */
  coverage: number;
  /** Overall integration health */
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  /** Summary of findings */
  summary: string;
}

/**
 * Integration Agent Options
 */
export interface IntegrationAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Custom integration verification function (for LLM integration) */
  verifyFunction?: (task: TaskDocument) => Promise<IntegrationOutput>;
}

/**
 * Integration Agent
 *
 * Provides integration verification and connection testing capabilities.
 * Uses 'code-quality' team type as integration testing is quality work.
 */
export class IntegrationAgent extends BaseTeamAgent {
  private verifyFunction?: (task: TaskDocument) => Promise<IntegrationOutput>;

  constructor(options: IntegrationAgentOptions) {
    super({
      ...options,
      teamType: 'code-quality',
      config: {
        ...options.config,
        name: options.config?.name || 'Integration Team',
        description: options.config?.description || 'Integration verification and connection testing',
        capabilities: options.config?.capabilities || [
          {
            name: 'integration-verification',
            description: 'Verify system integration and component connections',
            taskTypes: ['test', 'review'],
            priority: 87,
          },
        ],
      },
    });

    this.verifyFunction = options.verifyFunction;
  }

  /**
   * Set custom verify function (for LLM integration)
   */
  setVerifyFunction(fn: (task: TaskDocument) => Promise<IntegrationOutput>): void {
    this.verifyFunction = fn;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    this.registerHandler(['test'], this.handleIntegrationTask.bind(this));
    this.registerHandler(['review'], this.handleIntegrationTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleIntegrationTask.bind(this);
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
   * Handle integration verification task
   */
  private async handleIntegrationTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.verifyFunction
        ? await this.verifyFunction(task)
        : await this.generateDefaultVerification(task);

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
   * Generate default integration verification (placeholder for LLM integration)
   */
  private async generateDefaultVerification(task: TaskDocument): Promise<IntegrationOutput> {
    const title = task.metadata.title;
    const content = task.content;

    const connections = this.analyzeConnections(content);
    const issues = this.detectIntegrationIssues(content);

    const connectedCount = connections.filter((c) => c.status === 'connected').length;
    const coverage = connections.length > 0 ? Math.round((connectedCount / connections.length) * 100) : 0;

    const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
    const healthStatus: IntegrationOutput['healthStatus'] =
      criticalIssues > 0 ? 'unhealthy' : issues.length > 0 ? 'degraded' : 'healthy';

    return {
      connections,
      issues,
      coverage,
      healthStatus,
      summary: `Integration verification for "${title}": ${connections.length} connections analyzed, ${issues.length} issues found, coverage ${coverage}%.`,
    };
  }

  /**
   * Analyze connections from content
   */
  private analyzeConnections(content: string): IntegrationConnection[] {
    const connections: IntegrationConnection[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect connection patterns like "A -> B" or "A connects to B"
      const arrowMatch = trimmed.match(/^(\w[\w\s-]*?)\s*(?:->|→|connects?\s+to)\s*(\w[\w\s-]*?)$/i);
      if (arrowMatch) {
        connections.push({
          source: arrowMatch[1].trim(),
          target: arrowMatch[2].trim(),
          status: 'connected',
        });
      }

      // Detect import-style connections
      const importMatch = trimmed.match(/import\s+.*from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        connections.push({
          source: 'current-module',
          target: importMatch[1],
          status: 'connected',
          protocol: 'import',
        });
      }
    }

    return connections;
  }

  /**
   * Detect integration issues from content
   */
  private detectIntegrationIssues(
    content: string
  ): IntegrationOutput['issues'] {
    const issues: IntegrationOutput['issues'] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('circular') || lowerContent.includes('cycle')) {
      issues.push({
        severity: 'critical',
        component: 'dependency-graph',
        description: 'Potential circular dependency detected',
        suggestion: 'Refactor to break circular dependency using interfaces or dependency injection',
      });
    }

    if (lowerContent.includes('version mismatch') || lowerContent.includes('incompatible')) {
      issues.push({
        severity: 'warning',
        component: 'versioning',
        description: 'Version mismatch or incompatibility detected',
        suggestion: 'Align dependency versions across components',
      });
    }

    if (lowerContent.includes('timeout') || lowerContent.includes('connection refused')) {
      issues.push({
        severity: 'critical',
        component: 'connectivity',
        description: 'Connection failure detected between components',
        suggestion: 'Verify service availability and network configuration',
      });
    }

    if (lowerContent.includes('deprecated')) {
      issues.push({
        severity: 'info',
        component: 'api-compatibility',
        description: 'Use of deprecated API or interface',
        suggestion: 'Migrate to the recommended replacement API',
      });
    }

    return issues;
  }
}

/**
 * Create an integration agent
 */
export function createIntegrationAgent(
  queue: DocumentQueue,
  options?: Partial<IntegrationAgentOptions>
): IntegrationAgent {
  return new IntegrationAgent({
    queue,
    ...options,
  });
}
