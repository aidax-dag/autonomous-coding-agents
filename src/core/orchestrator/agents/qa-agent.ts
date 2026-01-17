/**
 * QA Agent
 *
 * Team agent responsible for quality assurance and testing.
 * Creates tests, runs verification, and ensures code quality.
 *
 * Capabilities:
 * - Test creation and execution
 * - Code review
 * - Quality verification
 * - Regression testing
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
 * Test result structure
 */
export interface TestResult {
  /** Test name */
  name: string;
  /** Test status */
  status: 'passed' | 'failed' | 'skipped';
  /** Duration in ms */
  duration?: number;
  /** Error message if failed */
  error?: string;
  /** Stack trace if failed */
  stackTrace?: string;
}

/**
 * QA output structure
 */
export interface QAOutput {
  /** Summary of QA activities */
  summary: string;
  /** Test results */
  testResults?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    tests: TestResult[];
  };
  /** Code coverage */
  coverage?: {
    lines: number;
    branches: number;
    functions: number;
    statements: number;
  };
  /** Review findings */
  reviewFindings?: Array<{
    severity: 'critical' | 'major' | 'minor' | 'info';
    category: string;
    message: string;
    file?: string;
    line?: number;
  }>;
  /** Quality score (0-100) */
  qualityScore?: number;
  /** Recommendations */
  recommendations?: string[];
  /** Approval status */
  approved: boolean;
  /** Reason for approval/rejection */
  reason?: string;
}

/**
 * QA Agent Options
 */
export interface QAAgentOptions extends Omit<BaseTeamAgentOptions, 'teamType'> {
  /** QA executor function (for LLM integration) */
  qaExecutor?: (task: TaskDocument) => Promise<QAOutput>;
  /** Minimum quality score to approve */
  minQualityScore?: number;
  /** Auto-approve if all tests pass */
  autoApproveOnPass?: boolean;
}

/**
 * QA Agent
 */
export class QAAgent extends BaseTeamAgent {
  private qaExecutor?: (task: TaskDocument) => Promise<QAOutput>;
  private minQualityScore: number;
  private autoApproveOnPass: boolean;

  constructor(options: QAAgentOptions) {
    super({
      ...options,
      teamType: 'qa',
      config: {
        ...options.config,
        name: options.config?.name || 'QA Team',
        description: options.config?.description || 'Quality assurance, testing, and code review',
        capabilities: options.config?.capabilities || [
          {
            name: 'testing',
            description: 'Create and run tests',
            taskTypes: ['test'],
            priority: 90,
          },
          {
            name: 'code-review',
            description: 'Review code for quality',
            taskTypes: ['review'],
            priority: 85,
          },
        ],
      },
    });

    this.qaExecutor = options.qaExecutor;
    this.minQualityScore = options.minQualityScore ?? 70;
    this.autoApproveOnPass = options.autoApproveOnPass ?? true;
  }

  /**
   * Set custom QA executor (for LLM integration)
   */
  setQAExecutor(executor: (task: TaskDocument) => Promise<QAOutput>): void {
    this.qaExecutor = executor;
  }

  /**
   * Register default handlers
   */
  protected registerDefaultHandlers(): void {
    // Test task handler
    this.registerHandler(['test'], this.handleTestTask.bind(this));

    // Review task handler
    this.registerHandler(['review'], this.handleReviewTask.bind(this));
  }

  /**
   * Get default handler
   */
  protected getDefaultHandler(): TaskHandler | null {
    return this.handleTestTask.bind(this);
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
   * Handle test task
   */
  private async handleTestTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.qaExecutor
        ? await this.qaExecutor(task)
        : await this.generateTestOutput(task);

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
   * Handle review task
   */
  private async handleReviewTask(task: TaskDocument): Promise<TaskHandlerResult> {
    try {
      const output = this.qaExecutor
        ? await this.qaExecutor(task)
        : await this.generateReviewOutput(task);

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
   * Generate test output (placeholder for LLM integration)
   */
  private async generateTestOutput(task: TaskDocument): Promise<QAOutput> {
    const title = task.metadata.title;

    // Simulate test execution
    const testResults = this.simulateTestExecution(task);
    const allPassed = testResults.failed === 0;
    const qualityScore = this.calculateQualityScore(testResults);

    const output: QAOutput = {
      summary: `Test execution completed for: ${title}`,
      testResults,
      coverage: {
        lines: 85,
        branches: 75,
        functions: 90,
        statements: 85,
      },
      qualityScore,
      recommendations: this.generateRecommendations(testResults, qualityScore),
      approved: this.shouldApprove(allPassed, qualityScore),
      reason: this.getApprovalReason(allPassed, qualityScore),
    };

    return output;
  }

  /**
   * Generate review output (placeholder for LLM integration)
   */
  private async generateReviewOutput(task: TaskDocument): Promise<QAOutput> {
    const title = task.metadata.title;

    // Simulate code review
    const findings = this.simulateCodeReview(task);
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const majorCount = findings.filter((f) => f.severity === 'major').length;

    const qualityScore = Math.max(0, 100 - criticalCount * 30 - majorCount * 10);
    const approved = criticalCount === 0 && qualityScore >= this.minQualityScore;

    const output: QAOutput = {
      summary: `Code review completed for: ${title}`,
      reviewFindings: findings,
      qualityScore,
      recommendations: findings
        .filter((f) => f.severity === 'critical' || f.severity === 'major')
        .map((f) => `Fix ${f.severity} issue: ${f.message}`),
      approved,
      reason: approved
        ? 'Code review passed with acceptable quality score'
        : `Code review failed: ${criticalCount} critical, ${majorCount} major issues found`,
    };

    return output;
  }

  /**
   * Simulate test execution
   */
  private simulateTestExecution(task: TaskDocument): QAOutput['testResults'] & {} {
    // Generate mock test results based on task content
    const testCount = Math.floor(Math.random() * 10) + 5;
    const tests: TestResult[] = [];

    for (let i = 0; i < testCount; i++) {
      const passed = Math.random() > 0.1; // 90% pass rate
      tests.push({
        name: `test_${task.metadata.type}_${i + 1}`,
        status: passed ? 'passed' : 'failed',
        duration: Math.floor(Math.random() * 1000) + 100,
        error: passed ? undefined : 'Assertion failed',
      });
    }

    return {
      total: testCount,
      passed: tests.filter((t) => t.status === 'passed').length,
      failed: tests.filter((t) => t.status === 'failed').length,
      skipped: 0,
      tests,
    };
  }

  /**
   * Simulate code review
   */
  private simulateCodeReview(task: TaskDocument): QAOutput['reviewFindings'] & {} {
    const findings: NonNullable<QAOutput['reviewFindings']> = [];

    // Add some mock findings based on task content
    if (task.content.toLowerCase().includes('security')) {
      findings.push({
        severity: 'major',
        category: 'security',
        message: 'Consider adding input validation',
      });
    }

    if (task.content.toLowerCase().includes('performance')) {
      findings.push({
        severity: 'minor',
        category: 'performance',
        message: 'Consider caching for frequently accessed data',
      });
    }

    // Add general recommendations
    findings.push({
      severity: 'info',
      category: 'documentation',
      message: 'Add JSDoc comments for public methods',
    });

    return findings;
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(testResults: NonNullable<QAOutput['testResults']>): number {
    if (testResults.total === 0) return 100;
    const passRate = testResults.passed / testResults.total;
    return Math.round(passRate * 100);
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    testResults: NonNullable<QAOutput['testResults']>,
    qualityScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (testResults.failed > 0) {
      recommendations.push(`Fix ${testResults.failed} failing tests before merging`);
    }

    if (qualityScore < 80) {
      recommendations.push('Increase test coverage to improve quality score');
    }

    if (testResults.skipped > 0) {
      recommendations.push(`Review ${testResults.skipped} skipped tests`);
    }

    return recommendations;
  }

  /**
   * Determine if should approve
   */
  private shouldApprove(allPassed: boolean, qualityScore: number): boolean {
    if (this.autoApproveOnPass && allPassed) {
      return true;
    }
    return qualityScore >= this.minQualityScore;
  }

  /**
   * Get approval reason
   */
  private getApprovalReason(allPassed: boolean, qualityScore: number): string {
    if (allPassed && qualityScore >= this.minQualityScore) {
      return 'All tests passed and quality score meets threshold';
    } else if (!allPassed) {
      return 'Some tests failed';
    } else {
      return `Quality score (${qualityScore}) below minimum threshold (${this.minQualityScore})`;
    }
  }
}

/**
 * Create a QA agent
 */
export function createQAAgent(
  queue: DocumentQueue,
  options?: Partial<QAAgentOptions>
): QAAgent {
  return new QAAgent({
    queue,
    ...options,
  });
}
