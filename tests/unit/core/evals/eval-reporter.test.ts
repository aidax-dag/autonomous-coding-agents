/**
 * EvalReporter Unit Tests
 */

import {
  EvalReporter,
  createEvalReporter,
  type EvalResult,
  type EvalSuiteResult,
} from '../../../../src/core/evals/index.js';

const mockResult: EvalResult = {
  evalId: 'test-001',
  passed: true,
  severity: 'ALWAYS_PASSES',
  score: 0.95,
  details: 'All 3 checks passed',
  duration: 150,
  assertions: [
    { check: 'output contains pattern', passed: true },
    { check: 'no TODO', passed: true },
    { check: 'file modified', passed: true },
  ],
};

const mockFailedResult: EvalResult = {
  evalId: 'test-002',
  passed: false,
  severity: 'ALWAYS_PASSES',
  score: 0.5,
  details: '1/2 passed',
  duration: 200,
  assertions: [
    { check: 'output check', passed: true },
    { check: 'tool usage', passed: false, expected: 'read_file', actual: 'not called' },
  ],
};

const mockSuiteResult: EvalSuiteResult = {
  suiteName: 'code_quality',
  totalEvals: 4,
  passed: 3,
  failed: 1,
  alwaysPassRate: 0.75,
  usuallyPassRate: 1,
  regressions: [mockFailedResult],
  results: [mockResult, mockResult, mockResult, mockFailedResult],
  duration: 500,
};

describe('EvalReporter', () => {
  describe('console format', () => {
    const reporter = createEvalReporter('console');

    it('should format single result', () => {
      const output = reporter.reportResult(mockResult);
      expect(output).toContain('PASS');
      expect(output).toContain('test-001');
      expect(output).toContain('95%');
    });

    it('should format failed result', () => {
      const output = reporter.reportResult(mockFailedResult);
      expect(output).toContain('FAIL');
      expect(output).toContain('test-002');
    });

    it('should format suite result', () => {
      const output = reporter.reportSuite(mockSuiteResult);
      expect(output).toContain('code_quality');
      expect(output).toContain('Total: 4');
      expect(output).toContain('Passed: 3');
      expect(output).toContain('Failed: 1');
      expect(output).toContain('Regressions');
      expect(output).toContain('FAILED');
    });

    it('should show PASSED for perfect suite', () => {
      const perfect: EvalSuiteResult = {
        ...mockSuiteResult,
        failed: 0,
        alwaysPassRate: 1,
        usuallyPassRate: 1,
        regressions: [],
      };
      const output = reporter.reportSuite(perfect);
      expect(output).toContain('PASSED');
    });
  });

  describe('json format', () => {
    const reporter = createEvalReporter('json');

    it('should produce valid JSON for result', () => {
      const output = reporter.reportResult(mockResult);
      const parsed = JSON.parse(output);
      expect(parsed.evalId).toBe('test-001');
      expect(parsed.passed).toBe(true);
    });

    it('should produce valid JSON for suite', () => {
      const output = reporter.reportSuite(mockSuiteResult);
      const parsed = JSON.parse(output);
      expect(parsed.suiteName).toBe('code_quality');
      expect(parsed.totalEvals).toBe(4);
    });
  });

  describe('markdown format', () => {
    const reporter = createEvalReporter('markdown');

    it('should produce markdown table for suite', () => {
      const output = reporter.reportSuite(mockSuiteResult);
      expect(output).toContain('# Eval Report');
      expect(output).toContain('| Metric | Value |');
      expect(output).toContain('## Regressions');
      expect(output).toContain('## Results');
    });

    it('should use emoji for results', () => {
      const pass = reporter.reportResult(mockResult);
      expect(pass).toContain('✅');

      const fail = reporter.reportResult(mockFailedResult);
      expect(fail).toContain('❌');
    });
  });

  describe('setFormat', () => {
    it('should switch format dynamically', () => {
      const reporter = new EvalReporter('console');
      const consoleOutput = reporter.reportResult(mockResult);
      expect(consoleOutput).toContain('PASS');

      reporter.setFormat('json');
      const jsonOutput = reporter.reportResult(mockResult);
      expect(JSON.parse(jsonOutput).evalId).toBe('test-001');
    });
  });
});
