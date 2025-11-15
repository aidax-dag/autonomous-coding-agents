/**
 * Test Result Parser
 *
 * Parses test results from various testing frameworks (Jest, Pytest, etc).
 *
 * Feature: F4.1 - CI/CD Integration
 */

import { TestResults, TestFailure } from './types.js';
import { createAgentLogger } from '../logging/logger.js';

const logger = createAgentLogger('CI', 'test-parser');

/**
 * Jest test result format
 */
interface JestTestResult {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: Array<{
    name: string;
    assertionResults: Array<{
      fullName: string;
      status: 'passed' | 'failed' | 'pending' | 'skipped';
      title: string;
      failureMessages: string[];
      location?: {
        line: number;
        column: number;
      };
    }>;
  }>;
  coverageMap?: {
    total: {
      lines: { pct: number };
      statements: { pct: number };
      functions: { pct: number };
      branches: { pct: number };
    };
  };
}

/**
 * Test Result Parser
 */
export class TestResultParser {
  /**
   * Parse Jest JSON results
   */
  parseJestResults(json: string): TestResults {
    try {
      const data: JestTestResult = JSON.parse(json);

      const failures: TestFailure[] = [];

      // Extract failures from test results
      for (const testFile of data.testResults) {
        for (const assertion of testFile.assertionResults) {
          if (assertion.status === 'failed') {
            failures.push({
              name: assertion.fullName || assertion.title,
              message: assertion.failureMessages.join('\n'),
              file: testFile.name,
              line: assertion.location?.line,
            });
          }
        }
      }

      const results: TestResults = {
        totalTests: data.numTotalTests,
        passed: data.numPassedTests,
        failed: data.numFailedTests,
        skipped: data.numPendingTests,
        duration: 0, // Jest doesn't provide total duration in summary
        failures,
      };

      // Add coverage if available
      if (data.coverageMap?.total) {
        results.coverage = {
          lines: data.coverageMap.total.lines.pct,
          statements: data.coverageMap.total.statements.pct,
          functions: data.coverageMap.total.functions.pct,
          branches: data.coverageMap.total.branches.pct,
        };
      }

      logger.info('Jest results parsed', {
        total: results.totalTests,
        passed: results.passed,
        failed: results.failed,
      });

      return results;
    } catch (error) {
      logger.error('Failed to parse Jest results', { error });
      throw new Error(`Failed to parse Jest results: ${error}`);
    }
  }

  /**
   * Parse Pytest XML results (JUnit format)
   */
  parsePytestResults(xml: string): TestResults {
    try {
      // Simple XML parsing (in production, use a proper XML parser like xml2js)
      const totalMatch = xml.match(/tests="(\d+)"/);
      const failuresMatch = xml.match(/failures="(\d+)"/);
      const errorsMatch = xml.match(/errors="(\d+)"/);
      const skippedMatch = xml.match(/skipped="(\d+)"/);
      const timeMatch = xml.match(/time="([\d.]+)"/);

      const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
      const failed = (failuresMatch ? parseInt(failuresMatch[1], 10) : 0) +
        (errorsMatch ? parseInt(errorsMatch[1], 10) : 0);
      const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;
      const passed = total - failed - skipped;
      const duration = timeMatch ? parseFloat(timeMatch[1]) * 1000 : 0;

      // Extract failures (simplified)
      const failures: TestFailure[] = [];
      const failurePattern = /<testcase[^>]*name="([^"]*)"[^>]*>[\s\S]*?<failure[^>]*>([\s\S]*?)<\/failure>/g;
      let match;

      while ((match = failurePattern.exec(xml)) !== null) {
        failures.push({
          name: match[1],
          message: match[2].trim(),
        });
      }

      const results: TestResults = {
        totalTests: total,
        passed,
        failed,
        skipped,
        duration,
        failures,
      };

      logger.info('Pytest results parsed', {
        total: results.totalTests,
        passed: results.passed,
        failed: results.failed,
      });

      return results;
    } catch (error) {
      logger.error('Failed to parse Pytest results', { error });
      throw new Error(`Failed to parse Pytest results: ${error}`);
    }
  }

  /**
   * Format test results as markdown
   */
  formatAsMarkdown(results: TestResults): string {
    const lines: string[] = [];

    lines.push('## Test Results\n');

    // Summary
    const passRate = results.totalTests > 0
      ? ((results.passed / results.totalTests) * 100).toFixed(1)
      : '0.0';

    lines.push(`**Summary**: ${results.passed}/${results.totalTests} tests passed (${passRate}%)\n`);

    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Tests | ${results.totalTests} |`);
    lines.push(`| ✅ Passed | ${results.passed} |`);
    lines.push(`| ❌ Failed | ${results.failed} |`);
    lines.push(`| ⏭️ Skipped | ${results.skipped} |`);
    lines.push(`| ⏱️ Duration | ${(results.duration / 1000).toFixed(2)}s |`);

    // Coverage
    if (results.coverage) {
      lines.push('\n### Code Coverage\n');
      lines.push('| Metric | Coverage |');
      lines.push('|--------|----------|');
      lines.push(`| Lines | ${results.coverage.lines.toFixed(1)}% |`);
      lines.push(`| Statements | ${results.coverage.statements.toFixed(1)}% |`);
      lines.push(`| Functions | ${results.coverage.functions.toFixed(1)}% |`);
      lines.push(`| Branches | ${results.coverage.branches.toFixed(1)}% |`);
    }

    // Failures
    if (results.failures.length > 0) {
      lines.push('\n### Failed Tests\n');

      for (const failure of results.failures) {
        lines.push(`#### ❌ ${failure.name}\n`);

        if (failure.file) {
          const location = failure.line ? `:${failure.line}` : '';
          lines.push(`**Location**: \`${failure.file}${location}\`\n`);
        }

        lines.push('```');
        lines.push(failure.message);
        lines.push('```\n');

        if (failure.stack) {
          lines.push('<details>');
          lines.push('<summary>Stack Trace</summary>\n');
          lines.push('```');
          lines.push(failure.stack);
          lines.push('```');
          lines.push('</details>\n');
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format test results for Slack notification
   */
  formatForSlack(results: TestResults): string {
    const lines: string[] = [];

    const icon = results.failed > 0 ? '❌' : '✅';
    const passRate = results.totalTests > 0
      ? ((results.passed / results.totalTests) * 100).toFixed(1)
      : '0.0';

    lines.push(`${icon} *Test Results*: ${results.passed}/${results.totalTests} passed (${passRate}%)`);

    if (results.failed > 0) {
      lines.push(`\n*Failed Tests*: ${results.failed}`);
      for (const failure of results.failures.slice(0, 3)) {
        lines.push(`  • ${failure.name}`);
      }

      if (results.failures.length > 3) {
        lines.push(`  ... and ${results.failures.length - 3} more`);
      }
    }

    if (results.coverage) {
      const avgCoverage = (
        results.coverage.lines +
        results.coverage.statements +
        results.coverage.functions +
        results.coverage.branches
      ) / 4;

      const coverageIcon = avgCoverage >= 80 ? '✅' : avgCoverage >= 60 ? '⚠️' : '❌';
      lines.push(`\n${coverageIcon} *Coverage*: ${avgCoverage.toFixed(1)}%`);
    }

    return lines.join('\n');
  }

  /**
   * Check if tests passed
   */
  isPassed(results: TestResults): boolean {
    return results.failed === 0;
  }

  /**
   * Check if coverage meets threshold
   */
  meetsCoverageThreshold(results: TestResults, threshold: number): boolean {
    if (!results.coverage) {
      return false;
    }

    const avgCoverage = (
      results.coverage.lines +
      results.coverage.statements +
      results.coverage.functions +
      results.coverage.branches
    ) / 4;

    return avgCoverage >= threshold;
  }
}
