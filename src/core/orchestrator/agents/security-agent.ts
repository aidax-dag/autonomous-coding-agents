/**
 * Security Agent
 *
 * Team agent responsible for security analysis, vulnerability detection,
 * and security best-practice enforcement. Scans code and configurations
 * for potential security issues.
 *
 * Capabilities:
 * - Vulnerability analysis
 * - Security pattern detection
 * - Compliance checking
 * - Threat modeling
 *
 * Optimal model: Opus (security reasoning requires deep analysis)
 *
 * @module core/orchestrator/agents
 */

import { TaskDocument } from '../../workspace/task-document';
import { DocumentQueue } from '../../workspace/document-queue';
import { TaskHandler, TaskHandlerResult } from '../team-agent';
import { BaseTeamAgent, BaseTeamAgentOptions } from '../base-team-agent';

/**
 * Security finding structure
 */
export interface SecurityFinding {
  /** Finding severity */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Security category */
  category: string;
  /** Affected file or location */
  location: string;
  /** Description of the finding */
  description: string;
  /** Recommended fix */
  recommendation: string;
  /** CWE or reference ID */
  referenceId?: string;
}

/**
 * Security analysis output structure
 */
export interface SecurityOutput {
  /** Summary of security analysis */
  summary: string;
  /** List of security findings */
  findings: SecurityFinding[];
  /** Overall risk score (0-100, lower is better) */
  riskScore: number;
  /** Compliance status */
  complianceStatus: 'pass' | 'fail' | 'partial';
  /** Recommendations for improvement */
  recommendations: string[];
}

/**
 * Security Agent Options
 */
export interface SecurityAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** Custom security scanner function (for LLM integration) */
  scanFunction?: (task: TaskDocument) => Promise<SecurityOutput>;
}

/**
 * Security Agent
 *
 * Provides security analysis and vulnerability detection capabilities.
 * Uses 'code-quality' team type as security is quality-adjacent.
 */
export class SecurityAgent extends BaseTeamAgent {
  private scanFunction?: (task: TaskDocument) => Promise<SecurityOutput>;

  constructor(options: SecurityAgentOptions) {
    super({
      ...options,
      teamType: 'code-quality',
      config: {
        ...options.config,
        name: options.config?.name || 'Security Team',
        description: options.config?.description || 'Security analysis and vulnerability detection',
        capabilities: options.config?.capabilities || [
          {
            name: 'vulnerability-analysis',
            description: 'Detect security vulnerabilities and recommend fixes',
            taskTypes: ['review', 'analysis'],
            priority: 92,
          },
        ],
      },
    });

    this.scanFunction = options.scanFunction;
  }

  /**
   * Set custom scan function (for LLM integration)
   */
  setScanFunction(fn: (task: TaskDocument) => Promise<SecurityOutput>): void {
    this.scanFunction = fn;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    this.registerHandler(['review'], this.handleSecurityTask.bind(this));
    this.registerHandler(['analysis'], this.handleSecurityTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleSecurityTask.bind(this);
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
   * Handle security analysis task
   */
  private async handleSecurityTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.scanFunction
        ? await this.scanFunction(task)
        : await this.generateDefaultScan(task);

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
   * Generate default security scan (placeholder for LLM integration)
   */
  private async generateDefaultScan(task: TaskDocument): Promise<SecurityOutput> {
    const title = task.metadata.title;
    const content = task.content;

    const findings = this.detectSecurityIssues(content);
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount = findings.filter((f) => f.severity === 'high').length;

    const riskScore = Math.min(100, criticalCount * 30 + highCount * 15 + findings.length * 5);

    return {
      summary: `Security analysis completed for: ${title}`,
      findings,
      riskScore,
      complianceStatus: criticalCount > 0 ? 'fail' : highCount > 0 ? 'partial' : 'pass',
      recommendations: findings
        .filter((f) => f.severity === 'critical' || f.severity === 'high')
        .map((f) => f.recommendation),
    };
  }

  /**
   * Detect security issues from content
   */
  private detectSecurityIssues(content: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const lowerContent = content.toLowerCase();

    const securityPatterns: Array<{
      pattern: string;
      severity: SecurityFinding['severity'];
      category: string;
      description: string;
      recommendation: string;
      referenceId?: string;
    }> = [
      {
        pattern: 'eval(',
        severity: 'critical',
        category: 'Injection',
        description: 'Use of eval() can lead to code injection attacks',
        recommendation: 'Replace eval() with safer alternatives',
        referenceId: 'CWE-95',
      },
      {
        pattern: 'innerhtml',
        severity: 'high',
        category: 'XSS',
        description: 'Direct innerHTML assignment can lead to XSS vulnerabilities',
        recommendation: 'Use textContent or sanitize HTML before insertion',
        referenceId: 'CWE-79',
      },
      {
        pattern: 'password',
        severity: 'medium',
        category: 'Sensitive Data',
        description: 'Potential hardcoded credentials or password handling',
        recommendation: 'Use environment variables and secure credential storage',
        referenceId: 'CWE-798',
      },
      {
        pattern: 'http://',
        severity: 'medium',
        category: 'Transport Security',
        description: 'Use of insecure HTTP protocol',
        recommendation: 'Use HTTPS for all network communications',
        referenceId: 'CWE-319',
      },
      {
        pattern: 'console.log',
        severity: 'low',
        category: 'Information Disclosure',
        description: 'Console logging may expose sensitive information',
        recommendation: 'Remove or replace with proper logging library',
        referenceId: 'CWE-532',
      },
    ];

    for (const pattern of securityPatterns) {
      if (lowerContent.includes(pattern.pattern)) {
        findings.push({
          severity: pattern.severity,
          category: pattern.category,
          location: 'detected in content',
          description: pattern.description,
          recommendation: pattern.recommendation,
          referenceId: pattern.referenceId,
        });
      }
    }

    return findings;
  }
}

/**
 * Create a security agent
 */
export function createSecurityAgent(
  queue: DocumentQueue,
  options?: Partial<SecurityAgentOptions>
): SecurityAgent {
  return new SecurityAgent({
    queue,
    ...options,
  });
}
