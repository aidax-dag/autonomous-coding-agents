/**
 * Test Parser Tests
 *
 * Tests for the TestResultParser class.
 */

import { TestResultParser } from '@/shared/ci/test-parser';
import { TestResults } from '@/shared/ci/types';

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  createAgentLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

describe('TestResultParser', () => {
  let parser: TestResultParser;

  beforeEach(() => {
    parser = new TestResultParser();
  });

  describe('parseJestResults', () => {
    it('should parse valid Jest JSON results', () => {
      const jestJson = JSON.stringify({
        numTotalTests: 10,
        numPassedTests: 8,
        numFailedTests: 2,
        numPendingTests: 0,
        testResults: [
          {
            name: 'test-file.test.ts',
            assertionResults: [
              {
                fullName: 'Suite test 1',
                status: 'passed',
                title: 'test 1',
                failureMessages: [],
              },
              {
                fullName: 'Suite test 2',
                status: 'failed',
                title: 'test 2',
                failureMessages: ['Expected true, got false'],
                location: { line: 10, column: 5 },
              },
            ],
          },
        ],
      });

      const results = parser.parseJestResults(jestJson);

      expect(results.totalTests).toBe(10);
      expect(results.passed).toBe(8);
      expect(results.failed).toBe(2);
      expect(results.skipped).toBe(0);
      expect(results.failures).toHaveLength(1);
      expect(results.failures[0].name).toBe('Suite test 2');
      expect(results.failures[0].message).toBe('Expected true, got false');
      expect(results.failures[0].file).toBe('test-file.test.ts');
      expect(results.failures[0].line).toBe(10);
    });

    it('should parse Jest results with coverage', () => {
      const jestJson = JSON.stringify({
        numTotalTests: 5,
        numPassedTests: 5,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: [],
        coverageMap: {
          total: {
            lines: { pct: 85.5 },
            statements: { pct: 90.2 },
            functions: { pct: 75.0 },
            branches: { pct: 60.0 },
          },
        },
      });

      const results = parser.parseJestResults(jestJson);

      expect(results.coverage).toBeDefined();
      expect(results.coverage?.lines).toBe(85.5);
      expect(results.coverage?.statements).toBe(90.2);
      expect(results.coverage?.functions).toBe(75.0);
      expect(results.coverage?.branches).toBe(60.0);
    });

    it('should handle Jest results without coverage', () => {
      const jestJson = JSON.stringify({
        numTotalTests: 3,
        numPassedTests: 3,
        numFailedTests: 0,
        numPendingTests: 0,
        testResults: [],
      });

      const results = parser.parseJestResults(jestJson);

      expect(results.coverage).toBeUndefined();
    });

    it('should handle multiple failures from different files', () => {
      const jestJson = JSON.stringify({
        numTotalTests: 10,
        numPassedTests: 7,
        numFailedTests: 3,
        numPendingTests: 0,
        testResults: [
          {
            name: 'file1.test.ts',
            assertionResults: [
              {
                fullName: 'Test 1',
                status: 'failed',
                title: 'test 1',
                failureMessages: ['Error 1'],
              },
            ],
          },
          {
            name: 'file2.test.ts',
            assertionResults: [
              {
                fullName: 'Test 2',
                status: 'failed',
                title: 'test 2',
                failureMessages: ['Error 2', 'Additional error'],
              },
              {
                fullName: 'Test 3',
                status: 'failed',
                title: 'test 3',
                failureMessages: ['Error 3'],
              },
            ],
          },
        ],
      });

      const results = parser.parseJestResults(jestJson);

      expect(results.failures).toHaveLength(3);
      expect(results.failures[0].file).toBe('file1.test.ts');
      expect(results.failures[1].file).toBe('file2.test.ts');
      expect(results.failures[1].message).toBe('Error 2\nAdditional error');
    });

    it('should use title when fullName is not available', () => {
      const jestJson = JSON.stringify({
        numTotalTests: 1,
        numPassedTests: 0,
        numFailedTests: 1,
        numPendingTests: 0,
        testResults: [
          {
            name: 'test.ts',
            assertionResults: [
              {
                fullName: '',
                status: 'failed',
                title: 'fallback title',
                failureMessages: ['Error'],
              },
            ],
          },
        ],
      });

      const results = parser.parseJestResults(jestJson);

      expect(results.failures[0].name).toBe('fallback title');
    });

    it('should throw error for invalid JSON', () => {
      expect(() => parser.parseJestResults('invalid json')).toThrow(
        'Failed to parse Jest results'
      );
    });
  });

  describe('parsePytestResults', () => {
    it('should parse valid Pytest XML results', () => {
      const xml = `
        <testsuite tests="10" failures="2" errors="1" skipped="1" time="5.5">
          <testcase name="test_pass" />
          <testcase name="test_fail">
            <failure>Assertion error</failure>
          </testcase>
        </testsuite>
      `;

      const results = parser.parsePytestResults(xml);

      expect(results.totalTests).toBe(10);
      expect(results.passed).toBe(6); // 10 - 2 - 1 - 1
      expect(results.failed).toBe(3); // 2 failures + 1 error
      expect(results.skipped).toBe(1);
      expect(results.duration).toBe(5500); // 5.5 seconds in ms
    });

    it('should extract failure details from Pytest XML', () => {
      const xml = `
        <testsuite tests="2" failures="1" errors="0" skipped="0" time="1.0">
          <testcase name="test_example">
            <failure>Expected 1, got 2</failure>
          </testcase>
        </testsuite>
      `;

      const results = parser.parsePytestResults(xml);

      expect(results.failures).toHaveLength(1);
      expect(results.failures[0].name).toBe('test_example');
      expect(results.failures[0].message).toBe('Expected 1, got 2');
    });

    it('should handle Pytest XML with no failures', () => {
      const xml = `
        <testsuite tests="5" failures="0" errors="0" skipped="0" time="2.0">
        </testsuite>
      `;

      const results = parser.parsePytestResults(xml);

      expect(results.totalTests).toBe(5);
      expect(results.passed).toBe(5);
      expect(results.failed).toBe(0);
      expect(results.failures).toHaveLength(0);
    });

    it('should handle missing attributes with defaults', () => {
      const xml = '<testsuite></testsuite>';

      const results = parser.parsePytestResults(xml);

      expect(results.totalTests).toBe(0);
      expect(results.passed).toBe(0);
      expect(results.failed).toBe(0);
      expect(results.skipped).toBe(0);
      expect(results.duration).toBe(0);
    });

    it('should handle multiple failures in Pytest XML', () => {
      const xml = `
        <testsuite tests="3" failures="2" errors="0" skipped="0" time="1.0">
          <testcase name="test_one">
            <failure>Error one</failure>
          </testcase>
          <testcase name="test_two">
            <failure>Error two</failure>
          </testcase>
        </testsuite>
      `;

      const results = parser.parsePytestResults(xml);

      expect(results.failures).toHaveLength(2);
      expect(results.failures[0].name).toBe('test_one');
      expect(results.failures[1].name).toBe('test_two');
    });
  });

  describe('formatAsMarkdown', () => {
    it('should format basic results as markdown', () => {
      const results: TestResults = {
        totalTests: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        duration: 5000,
        failures: [],
      };

      const markdown = parser.formatAsMarkdown(results);

      expect(markdown).toContain('## Test Results');
      expect(markdown).toContain('**Summary**: 8/10 tests passed (80.0%)');
      expect(markdown).toContain('| Total Tests | 10 |');
      expect(markdown).toContain('| ✅ Passed | 8 |');
      expect(markdown).toContain('| ❌ Failed | 2 |');
      expect(markdown).toContain('| ⏱️ Duration | 5.00s |');
    });

    it('should include coverage in markdown', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
        coverage: {
          lines: 85.5,
          statements: 90.2,
          functions: 75.0,
          branches: 60.0,
        },
      };

      const markdown = parser.formatAsMarkdown(results);

      expect(markdown).toContain('### Code Coverage');
      expect(markdown).toContain('| Lines | 85.5% |');
      expect(markdown).toContain('| Statements | 90.2% |');
      expect(markdown).toContain('| Functions | 75.0% |');
      expect(markdown).toContain('| Branches | 60.0% |');
    });

    it('should include failure details in markdown', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 4,
        failed: 1,
        skipped: 0,
        duration: 1000,
        failures: [
          {
            name: 'should do something',
            message: 'Expected true, got false',
            file: 'test.ts',
            line: 25,
          },
        ],
      };

      const markdown = parser.formatAsMarkdown(results);

      expect(markdown).toContain('### Failed Tests');
      expect(markdown).toContain('#### ❌ should do something');
      expect(markdown).toContain('**Location**: `test.ts:25`');
      expect(markdown).toContain('Expected true, got false');
    });

    it('should include stack trace in markdown when available', () => {
      const results: TestResults = {
        totalTests: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: 100,
        failures: [
          {
            name: 'test',
            message: 'Error',
            stack: 'Error\n  at test.ts:10',
          },
        ],
      };

      const markdown = parser.formatAsMarkdown(results);

      expect(markdown).toContain('<details>');
      expect(markdown).toContain('<summary>Stack Trace</summary>');
      expect(markdown).toContain('Error\n  at test.ts:10');
    });

    it('should handle file without line number', () => {
      const results: TestResults = {
        totalTests: 1,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: 100,
        failures: [
          {
            name: 'test',
            message: 'Error',
            file: 'test.ts',
          },
        ],
      };

      const markdown = parser.formatAsMarkdown(results);

      expect(markdown).toContain('**Location**: `test.ts`');
      expect(markdown).not.toContain('test.ts:');
    });

    it('should handle zero total tests', () => {
      const results: TestResults = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        failures: [],
      };

      const markdown = parser.formatAsMarkdown(results);

      expect(markdown).toContain('0/0 tests passed (0.0%)');
    });
  });

  describe('formatForSlack', () => {
    it('should format passing results for Slack', () => {
      const results: TestResults = {
        totalTests: 10,
        passed: 10,
        failed: 0,
        skipped: 0,
        duration: 5000,
        failures: [],
      };

      const slack = parser.formatForSlack(results);

      expect(slack).toContain('✅ *Test Results*: 10/10 passed (100.0%)');
    });

    it('should format failing results for Slack', () => {
      const results: TestResults = {
        totalTests: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        duration: 5000,
        failures: [
          { name: 'test 1', message: 'Error 1' },
          { name: 'test 2', message: 'Error 2' },
        ],
      };

      const slack = parser.formatForSlack(results);

      expect(slack).toContain('❌ *Test Results*: 8/10 passed (80.0%)');
      expect(slack).toContain('*Failed Tests*: 2');
      expect(slack).toContain('• test 1');
      expect(slack).toContain('• test 2');
    });

    it('should truncate failures list when more than 3', () => {
      const results: TestResults = {
        totalTests: 10,
        passed: 5,
        failed: 5,
        skipped: 0,
        duration: 1000,
        failures: [
          { name: 'test 1', message: '' },
          { name: 'test 2', message: '' },
          { name: 'test 3', message: '' },
          { name: 'test 4', message: '' },
          { name: 'test 5', message: '' },
        ],
      };

      const slack = parser.formatForSlack(results);

      expect(slack).toContain('• test 1');
      expect(slack).toContain('• test 2');
      expect(slack).toContain('• test 3');
      expect(slack).not.toContain('• test 4');
      expect(slack).toContain('... and 2 more');
    });

    it('should include coverage with good coverage icon', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
        coverage: {
          lines: 85,
          statements: 85,
          functions: 85,
          branches: 85,
        },
      };

      const slack = parser.formatForSlack(results);

      expect(slack).toContain('✅ *Coverage*: 85.0%');
    });

    it('should include coverage with warning icon for medium coverage', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
        coverage: {
          lines: 65,
          statements: 65,
          functions: 65,
          branches: 65,
        },
      };

      const slack = parser.formatForSlack(results);

      expect(slack).toContain('⚠️ *Coverage*: 65.0%');
    });

    it('should include coverage with error icon for low coverage', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
        coverage: {
          lines: 40,
          statements: 40,
          functions: 40,
          branches: 40,
        },
      };

      const slack = parser.formatForSlack(results);

      expect(slack).toContain('❌ *Coverage*: 40.0%');
    });

    it('should handle zero total tests', () => {
      const results: TestResults = {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        failures: [],
      };

      const slack = parser.formatForSlack(results);

      expect(slack).toContain('0/0 passed (0.0%)');
    });
  });

  describe('isPassed', () => {
    it('should return true when no failures', () => {
      const results: TestResults = {
        totalTests: 10,
        passed: 10,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
      };

      expect(parser.isPassed(results)).toBe(true);
    });

    it('should return false when there are failures', () => {
      const results: TestResults = {
        totalTests: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        duration: 1000,
        failures: [],
      };

      expect(parser.isPassed(results)).toBe(false);
    });
  });

  describe('meetsCoverageThreshold', () => {
    it('should return true when coverage meets threshold', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
        coverage: {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 80,
        },
      };

      expect(parser.meetsCoverageThreshold(results, 70)).toBe(true);
      expect(parser.meetsCoverageThreshold(results, 80)).toBe(true);
    });

    it('should return false when coverage is below threshold', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
        coverage: {
          lines: 60,
          statements: 60,
          functions: 60,
          branches: 60,
        },
      };

      expect(parser.meetsCoverageThreshold(results, 70)).toBe(false);
    });

    it('should return false when no coverage data', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
      };

      expect(parser.meetsCoverageThreshold(results, 70)).toBe(false);
    });

    it('should calculate average coverage correctly', () => {
      const results: TestResults = {
        totalTests: 5,
        passed: 5,
        failed: 0,
        skipped: 0,
        duration: 1000,
        failures: [],
        coverage: {
          lines: 100,
          statements: 80,
          functions: 60,
          branches: 40,
        },
      };

      // Average: (100 + 80 + 60 + 40) / 4 = 70
      expect(parser.meetsCoverageThreshold(results, 70)).toBe(true);
      expect(parser.meetsCoverageThreshold(results, 71)).toBe(false);
    });
  });
});
