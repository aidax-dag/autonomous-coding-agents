/**
 * Tests for Eval Reporter
 */

import { EvalReporter, createEvalReporter } from '@/core/evals';
import type { EvalSuiteResult, EvalResult } from '@/core/evals';

// Mock the logger since the barrel import loads eval-runner which depends on it
jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// --- Test Fixtures ---

function makeResult(overrides: Partial<EvalResult> = {}): EvalResult {
  return {
    evalId: 'eval-001',
    evalName: 'Test Eval',
    passed: true,
    severity: 'ALWAYS_PASSES',
    score: 1,
    details: 'All 3 checks passed',
    duration: 234,
    checks: [
      { name: 'success_check', passed: true, message: 'Task succeeded as expected' },
    ],
    ...overrides,
  };
}

function makeSuiteResult(overrides: Partial<EvalSuiteResult> = {}): EvalSuiteResult {
  return {
    suiteName: 'test-suite',
    timestamp: '2026-02-13T00:00:00.000Z',
    totalEvals: 2,
    passed: 2,
    failed: 0,
    skipped: 0,
    alwaysPassRate: 1,
    usuallyPassRate: 1,
    results: [
      makeResult({ evalId: 'e1', evalName: 'Eval One', duration: 100 }),
      makeResult({ evalId: 'e2', evalName: 'Eval Two', duration: 200 }),
    ],
    regressions: [],
    duration: 300,
    ...overrides,
  };
}

// --- Tests ---

describe('EvalReporter', () => {
  describe('report (text format)', () => {
    it('should generate a human-readable text report', () => {
      const reporter = new EvalReporter();
      const text = reporter.report(makeSuiteResult());

      expect(text).toContain('Suite: test-suite');
      expect(text).toContain('Total: 2');
      expect(text).toContain('Passed: 2');
      expect(text).toContain('Failed: 0');
      expect(text).toContain('ALWAYS_PASSES: 100.0%');
      expect(text).toContain('USUALLY_PASSES: 100.0%');
      expect(text).toContain('[PASS] Eval One');
      expect(text).toContain('[PASS] Eval Two');
    });

    it('should display failed checks in detail', () => {
      const failedResult = makeResult({
        evalId: 'fail-1',
        evalName: 'Failing Eval',
        passed: false,
        score: 0.5,
        duration: 567,
        checks: [
          { name: 'success_check', passed: true, message: 'Task succeeded as expected' },
          { name: 'output_pattern: /xyz/', passed: false, message: 'Output did not match pattern "/xyz/"' },
        ],
      });

      const suite = makeSuiteResult({
        totalEvals: 1,
        passed: 0,
        failed: 1,
        alwaysPassRate: 0,
        results: [failedResult],
      });

      const reporter = new EvalReporter();
      const text = reporter.report(suite);

      expect(text).toContain('[FAIL] Failing Eval');
      expect(text).toContain('score: 0.50');
      expect(text).toContain('567ms');
      expect(text).toContain('Check failed: Output did not match pattern "/xyz/"');
    });

    it('should display regressions section when present', () => {
      const regression = makeResult({
        evalId: 'reg-1',
        evalName: 'Regressed Eval',
        passed: false,
        score: 0,
        checks: [
          { name: 'success_check', passed: false, message: 'Expected success but got failure' },
        ],
      });

      const suite = makeSuiteResult({
        regressions: [regression],
      });

      const reporter = new EvalReporter();
      const text = reporter.report(suite);

      expect(text).toContain('Regressions:');
      expect(text).toContain('[FAIL] Regressed Eval');
    });

    it('should handle empty suite', () => {
      const suite = makeSuiteResult({
        totalEvals: 0,
        passed: 0,
        failed: 0,
        results: [],
        duration: 0,
      });

      const reporter = new EvalReporter();
      const text = reporter.report(suite);

      expect(text).toContain('Suite: test-suite');
      expect(text).toContain('Total: 0');
      expect(text).not.toContain('[PASS]');
      expect(text).not.toContain('[FAIL]');
    });
  });

  describe('reportJSON', () => {
    it('should generate valid indented JSON', () => {
      const reporter = new EvalReporter();
      const suite = makeSuiteResult();
      const json = reporter.reportJSON(suite);

      const parsed = JSON.parse(json);
      expect(parsed.suiteName).toBe('test-suite');
      expect(parsed.totalEvals).toBe(2);
      expect(parsed.results).toHaveLength(2);
      // Verify it is indented
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });
  });

  describe('createEvalReporter', () => {
    it('should create via factory function', () => {
      const reporter = createEvalReporter();
      expect(reporter).toBeInstanceOf(EvalReporter);
    });
  });
});
