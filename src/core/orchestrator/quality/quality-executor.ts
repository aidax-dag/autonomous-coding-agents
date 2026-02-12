/**
 * Quality Executor
 *
 * Bridges QAAgent with real quality tools (CodeQualityHook, TestResultParser).
 * Provides real test execution and code review capabilities.
 *
 * Feature: Quality Measurement Implementation for Agent OS
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

import { TaskDocument } from '../../workspace/task-document';
import { QAOutput, TestResult } from '../agents/qa-agent';
import {
  CodeQualityHook,
} from '../../hooks';
import {
  QualityCheckType,
  QualityCheckResult,
  IssueSeverity,
} from '../../hooks/code-quality/code-quality.interface';
import { TestResultParser } from '../../../shared/ci/test-parser';
import { TestResults } from '../../../shared/ci/types';

/**
 * Quality executor configuration
 */
export interface QualityExecutorConfig {
  /** Working directory for test execution */
  workspaceDir: string;
  /** Minimum quality score to approve (default: 70) */
  minQualityScore?: number;
  /** Auto-approve if all tests pass (default: true) */
  autoApproveOnPass?: boolean;
  /** Test command to run (default: 'npm test') */
  testCommand?: string;
  /** Test command args (default: ['--', '--json', '--coverage']) */
  testArgs?: string[];
  /** Timeout for test execution in ms (default: 300000) */
  testTimeout?: number;
  /** Enable parallel execution (default: true) */
  parallel?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<Omit<QualityExecutorConfig, 'workspaceDir'>> = {
  minQualityScore: 70,
  autoApproveOnPass: true,
  testCommand: 'npm',
  testArgs: ['test', '--', '--json', '--coverage'],
  testTimeout: 300000,
  parallel: true,
};

/**
 * Quality Executor
 *
 * Executes real quality checks using CodeQualityHook and TestResultParser.
 */
export class QualityExecutor {
  private config: Required<QualityExecutorConfig>;
  private codeQualityHook: CodeQualityHook;
  private testResultParser: TestResultParser;

  constructor(config: QualityExecutorConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Initialize code quality hook
    this.codeQualityHook = new CodeQualityHook({
      name: 'quality-executor',
      enabled: true,
      checkTypes: [QualityCheckType.LINT, QualityCheckType.TYPE_CHECK],
      parallel: this.config.parallel,
    });

    // Initialize test result parser
    this.testResultParser = new TestResultParser();
  }

  /**
   * Execute QA for a task (main entry point for QAAgent integration)
   */
  async execute(task: TaskDocument): Promise<QAOutput> {
    const taskType = task.metadata.type;

    // Determine execution type based on task
    if (taskType === 'test' || task.content.toLowerCase().includes('test')) {
      return this.executeTestTask(task);
    } else {
      return this.executeReviewTask(task);
    }
  }

  /**
   * Execute test task - runs actual tests
   */
  async executeTestTask(task: TaskDocument): Promise<QAOutput> {
    const title = task.metadata.title;

    try {
      // Run actual tests
      const testOutput = await this.runTests();

      // Parse test results
      const testResults = this.parseTestOutput(testOutput);

      // Calculate quality score
      const qualityScore = this.calculateQualityScore(testResults);
      const allPassed = testResults.failed === 0;

      // Build QA output
      const output: QAOutput = {
        summary: `Test execution completed for: ${title}`,
        testResults: {
          total: testResults.totalTests,
          passed: testResults.passed,
          failed: testResults.failed,
          skipped: testResults.skipped,
          tests: this.convertToTestResults(testResults),
        },
        coverage: testResults.coverage,
        qualityScore,
        recommendations: this.generateTestRecommendations(testResults, qualityScore),
        approved: this.shouldApprove(allPassed, qualityScore),
        reason: this.getApprovalReason(allPassed, qualityScore),
      };

      return output;
    } catch (error) {
      // Handle test execution failure
      return {
        summary: `Test execution failed for: ${title}`,
        testResults: {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          tests: [],
        },
        qualityScore: 0,
        approved: false,
        reason: `Test execution failed: ${error instanceof Error ? error.message : String(error)}`,
        recommendations: ['Fix test execution errors before proceeding'],
      };
    }
  }

  /**
   * Execute review task - runs code quality checks
   */
  async executeReviewTask(task: TaskDocument): Promise<QAOutput> {
    const title = task.metadata.title;

    try {
      // Get files to check from task
      const files = this.getFilesToCheck(task);

      // Run code quality checks
      const qualityResult = await this.codeQualityHook.check(
        files,
        [QualityCheckType.LINT, QualityCheckType.TYPE_CHECK]
      );

      // Convert to review findings
      const findings = this.convertToReviewFindings(qualityResult);

      // Calculate quality score
      const criticalCount = findings.filter((f) => f.severity === 'critical').length;
      const majorCount = findings.filter((f) => f.severity === 'major').length;
      const qualityScore = Math.max(0, 100 - criticalCount * 30 - majorCount * 10);

      const approved = criticalCount === 0 && qualityScore >= this.config.minQualityScore;

      return {
        summary: `Code review completed for: ${title}`,
        reviewFindings: findings,
        qualityScore,
        recommendations: this.generateReviewRecommendations(findings),
        approved,
        reason: approved
          ? 'Code review passed with acceptable quality score'
          : `Code review failed: ${criticalCount} critical, ${majorCount} major issues found`,
      };
    } catch (error) {
      return {
        summary: `Code review failed for: ${title}`,
        reviewFindings: [],
        qualityScore: 0,
        approved: false,
        reason: `Code review failed: ${error instanceof Error ? error.message : String(error)}`,
        recommendations: ['Fix code review execution errors'],
      };
    }
  }

  /**
   * Run actual tests using configured test command
   */
  private async runTests(): Promise<string> {
    return new Promise((resolve, reject) => {
      const { testCommand, testArgs, testTimeout, workspaceDir } = this.config;

      let stdout = '';
      let stderr = '';

      const proc = spawn(testCommand, testArgs, {
        cwd: workspaceDir,
        shell: true,
        env: {
          ...process.env,
          CI: 'true', // Ensure CI mode for consistent output
        },
      });

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Test execution timed out after ${testTimeout}ms`));
      }, testTimeout);

      proc.on('close', (code) => {
        clearTimeout(timeoutId);

        // Jest returns non-zero when tests fail, but we still want the output
        if (stdout.includes('"numTotalTests"')) {
          resolve(stdout);
        } else if (stderr.includes('"numTotalTests"')) {
          resolve(stderr);
        } else if (code === 0) {
          resolve(stdout || stderr);
        } else {
          // Try to extract JSON from output
          const jsonMatch = stdout.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
          if (jsonMatch) {
            resolve(jsonMatch[0]);
          } else {
            reject(new Error(`Test command failed with code ${code}: ${stderr || stdout}`));
          }
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  /**
   * Parse test output to TestResults
   */
  private parseTestOutput(output: string): TestResults {
    try {
      // Try to extract JSON from output (Jest format)
      const jsonMatch = output.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);
      if (jsonMatch) {
        return this.testResultParser.parseJestResults(jsonMatch[0]);
      }

      // Try XML format (Pytest/JUnit)
      if (output.includes('<?xml') || output.includes('<testsuite')) {
        return this.testResultParser.parsePytestResults(output);
      }

      // Fallback: parse simple test output
      return this.parseSimpleTestOutput(output);
    } catch {
      // Return empty results on parse error
      return {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        failures: [],
      };
    }
  }

  /**
   * Parse simple test output (fallback)
   */
  private parseSimpleTestOutput(output: string): TestResults {
    // Try to extract basic metrics from output
    const passedMatch = output.match(/(\d+)\s+(?:tests?\s+)?pass(?:ed|ing)?/i);
    const failedMatch = output.match(/(\d+)\s+(?:tests?\s+)?fail(?:ed|ing)?/i);
    const skippedMatch = output.match(/(\d+)\s+(?:tests?\s+)?skip(?:ped)?/i);

    const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;

    return {
      totalTests: passed + failed + skipped,
      passed,
      failed,
      skipped,
      duration: 0,
      failures: [],
    };
  }

  /**
   * Convert TestResults to TestResult array
   */
  private convertToTestResults(results: TestResults): TestResult[] {
    const tests: TestResult[] = [];

    // Add failure entries
    for (const failure of results.failures) {
      tests.push({
        name: failure.name,
        status: 'failed',
        error: failure.message,
        stackTrace: failure.stack,
      });
    }

    // Add placeholder passed tests (we don't have individual test names)
    for (let i = 0; i < results.passed; i++) {
      tests.push({
        name: `test_${i + 1}`,
        status: 'passed',
      });
    }

    // Add placeholder skipped tests
    for (let i = 0; i < results.skipped; i++) {
      tests.push({
        name: `skipped_test_${i + 1}`,
        status: 'skipped',
      });
    }

    return tests;
  }

  /**
   * Convert QualityCheckResult to review findings
   */
  private convertToReviewFindings(
    result: QualityCheckResult
  ): NonNullable<QAOutput['reviewFindings']> {
    return result.issues.map((issue) => ({
      severity: this.mapSeverity(issue.severity),
      category: issue.checkType,
      message: issue.message,
      file: issue.location.file,
      line: issue.location.line,
    }));
  }

  /**
   * Map IssueSeverity to QAOutput severity
   */
  private mapSeverity(severity: IssueSeverity): 'critical' | 'major' | 'minor' | 'info' {
    switch (severity) {
      case IssueSeverity.ERROR:
        return 'critical';
      case IssueSeverity.WARNING:
        return 'major';
      case IssueSeverity.INFO:
        return 'minor';
      case IssueSeverity.HINT:
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * Get files to check from task
   */
  private getFilesToCheck(task: TaskDocument): string[] {
    // Extract files from task metadata
    if (task.metadata.files && task.metadata.files.length > 0) {
      return task.metadata.files.map((f) => {
        // Make path absolute if relative
        if (path.isAbsolute(f.path)) {
          return f.path;
        }
        return path.join(this.config.workspaceDir, f.path);
      });
    }

    // Default: check all TS/JS files in workspace
    return this.findSourceFiles(this.config.workspaceDir);
  }

  /**
   * Find source files in directory
   */
  private findSourceFiles(dir: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];

    const walk = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) {
              walk(fullPath);
            }
          } else if (entry.isFile()) {
            if (extensions.some((ext) => entry.name.endsWith(ext))) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    };

    walk(dir);
    return files;
  }

  /**
   * Calculate quality score from test results
   */
  private calculateQualityScore(results: TestResults): number {
    if (results.totalTests === 0) return 100;

    const passRate = results.passed / results.totalTests;
    let score = Math.round(passRate * 100);

    // Bonus for coverage
    if (results.coverage) {
      const avgCoverage =
        (results.coverage.lines +
          results.coverage.statements +
          results.coverage.functions +
          results.coverage.branches) /
        4;

      // Add up to 10 points for good coverage
      if (avgCoverage >= 80) {
        score = Math.min(100, score + 10);
      } else if (avgCoverage >= 60) {
        score = Math.min(100, score + 5);
      }
    }

    return score;
  }

  /**
   * Generate test recommendations
   */
  private generateTestRecommendations(results: TestResults, qualityScore: number): string[] {
    const recommendations: string[] = [];

    if (results.failed > 0) {
      recommendations.push(`Fix ${results.failed} failing tests before merging`);
    }

    if (qualityScore < 80) {
      recommendations.push('Increase test coverage to improve quality score');
    }

    if (results.skipped > 0) {
      recommendations.push(`Review ${results.skipped} skipped tests`);
    }

    if (results.coverage) {
      if (results.coverage.branches < 60) {
        recommendations.push('Improve branch coverage (currently below 60%)');
      }
      if (results.coverage.functions < 70) {
        recommendations.push('Improve function coverage (currently below 70%)');
      }
    }

    return recommendations;
  }

  /**
   * Generate review recommendations
   */
  private generateReviewRecommendations(
    findings: NonNullable<QAOutput['reviewFindings']>
  ): string[] {
    const recommendations: string[] = [];

    const critical = findings.filter((f) => f.severity === 'critical');
    const major = findings.filter((f) => f.severity === 'major');

    if (critical.length > 0) {
      recommendations.push(
        `Fix ${critical.length} critical issues: ${critical.map((f) => f.message).slice(0, 3).join(', ')}`
      );
    }

    if (major.length > 0) {
      recommendations.push(
        `Address ${major.length} major issues before merging`
      );
    }

    // Group by category
    const byCategory = findings.reduce(
      (acc, f) => {
        acc[f.category] = (acc[f.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    for (const [category, count] of Object.entries(byCategory)) {
      if (count >= 3) {
        recommendations.push(`Review ${count} ${category} issues`);
      }
    }

    return recommendations;
  }

  /**
   * Determine if should approve
   */
  private shouldApprove(allPassed: boolean, qualityScore: number): boolean {
    if (this.config.autoApproveOnPass && allPassed) {
      return true;
    }
    return qualityScore >= this.config.minQualityScore;
  }

  /**
   * Get approval reason
   */
  private getApprovalReason(allPassed: boolean, qualityScore: number): string {
    if (allPassed && qualityScore >= this.config.minQualityScore) {
      return 'All tests passed and quality score meets threshold';
    } else if (!allPassed) {
      return 'Some tests failed';
    } else {
      return `Quality score (${qualityScore}) below minimum threshold (${this.config.minQualityScore})`;
    }
  }
}

/**
 * Create a quality executor
 */
export function createQualityExecutor(config: QualityExecutorConfig): QualityExecutor {
  return new QualityExecutor(config);
}

/**
 * Create a QA executor function for QAAgent integration
 */
export function createQAExecutor(
  config: QualityExecutorConfig
): (task: TaskDocument) => Promise<QAOutput> {
  const executor = new QualityExecutor(config);
  return (task: TaskDocument) => executor.execute(task);
}
