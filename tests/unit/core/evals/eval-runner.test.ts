/**
 * Tests for Eval Runner
 */

import {
  EvalRunner,
  createEvalRunner,
} from '@/core/evals';
import type {
  EvalDefinition,
  EvalExecutor,
  EvalExecutionResult,
} from '@/core/evals';

// Mock the logger to avoid winston side effects in tests
jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// --- Test Fixtures ---

const baseDefinition: EvalDefinition = {
  id: 'test-eval-001',
  name: 'Test Eval',
  description: 'A test eval definition',
  category: 'code_quality',
  severity: 'ALWAYS_PASSES',
  input: {
    taskDescription: 'Create a utility function that validates email addresses',
    expectedFiles: ['utils/validate-email.ts'],
  },
  expectedBehavior: {
    shouldSucceed: true,
    outputPatterns: ['function', 'email', 'return'],
    maxDuration: 30000,
    minQualityScore: 0.7,
  },
  timeout: 30000,
  tags: ['test'],
};

const passingExecutor: EvalExecutor = {
  execute: async () => ({
    success: true,
    output: 'function validateEmail(email: string): boolean { return email.includes("@"); }',
    duration: 100,
    toolsUsed: ['file-write'],
    filesModified: ['utils/validate-email.ts'],
    qualityScore: 0.9,
  }),
};

const failingExecutor: EvalExecutor = {
  execute: async () => ({
    success: false,
    output: '',
    error: 'Task failed unexpectedly',
    duration: 50,
    toolsUsed: [],
    filesModified: [],
    qualityScore: 0.1,
  }),
};

// --- Tests ---

describe('EvalRunner', () => {
  describe('loadDefinitions', () => {
    it('should load definitions and make them retrievable', () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([baseDefinition]);

      const defs = runner.getDefinitions();
      expect(defs).toHaveLength(1);
      expect(defs[0].id).toBe('test-eval-001');
    });

    it('should replace previously loaded definitions', () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([baseDefinition]);
      runner.loadDefinitions([]);

      expect(runner.getDefinitions()).toHaveLength(0);
    });

    it('should return a copy of definitions (not a mutable reference)', () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([baseDefinition]);

      const defs = runner.getDefinitions();
      defs.pop();

      expect(runner.getDefinitions()).toHaveLength(1);
    });
  });

  describe('runEval', () => {
    it('should pass when executor result meets all expected behavior', async () => {
      const runner = new EvalRunner();
      const result = await runner.runEval(baseDefinition, passingExecutor);

      expect(result.evalId).toBe('test-eval-001');
      expect(result.evalName).toBe('Test Eval');
      expect(result.passed).toBe(true);
      expect(result.severity).toBe('ALWAYS_PASSES');
      expect(result.score).toBe(1);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it('should fail when task fails but success was expected', async () => {
      const runner = new EvalRunner();
      const result = await runner.runEval(baseDefinition, failingExecutor);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(1);

      const successCheck = result.checks.find((c) => c.name === 'success_check');
      expect(successCheck).toBeDefined();
      expect(successCheck!.passed).toBe(false);
    });

    it('should check output patterns and fail when they do not match', async () => {
      const noOutputExecutor: EvalExecutor = {
        execute: async () => ({
          success: true,
          output: 'no matching content here',
          duration: 100,
          qualityScore: 0.9,
        }),
      };

      const runner = new EvalRunner();
      const result = await runner.runEval(baseDefinition, noOutputExecutor);

      expect(result.passed).toBe(false);
      const patternChecks = result.checks.filter((c) => c.name.startsWith('output_pattern'));
      expect(patternChecks.length).toBe(3);
      // "function" is not in "no matching content here"
      expect(patternChecks[0].passed).toBe(false);
    });

    it('should pass output patterns when content matches', async () => {
      const runner = new EvalRunner();
      const result = await runner.runEval(baseDefinition, passingExecutor);

      const patternChecks = result.checks.filter((c) => c.name.startsWith('output_pattern'));
      expect(patternChecks.length).toBe(3);
      expect(patternChecks.every((c) => c.passed)).toBe(true);
    });

    it('should check duration limit and fail when exceeded', async () => {
      const slowDefinition: EvalDefinition = {
        ...baseDefinition,
        id: 'slow-test',
        expectedBehavior: {
          shouldSucceed: true,
          maxDuration: 50,
        },
      };

      const slowExecutor: EvalExecutor = {
        execute: async () => ({
          success: true,
          output: 'done',
          duration: 200,
        }),
      };

      const runner = new EvalRunner();
      const result = await runner.runEval(slowDefinition, slowExecutor);

      const durationCheck = result.checks.find((c) => c.name === 'duration_check');
      expect(durationCheck).toBeDefined();
      expect(durationCheck!.passed).toBe(false);
      expect(durationCheck!.message).toContain('exceeded');
    });

    it('should check duration limit and pass when within limit', async () => {
      const runner = new EvalRunner();
      const result = await runner.runEval(baseDefinition, passingExecutor);

      const durationCheck = result.checks.find((c) => c.name === 'duration_check');
      expect(durationCheck).toBeDefined();
      expect(durationCheck!.passed).toBe(true);
    });

    it('should check tool usage and fail when expected tool not used', async () => {
      const toolDefinition: EvalDefinition = {
        ...baseDefinition,
        id: 'tool-test',
        expectedBehavior: {
          shouldSucceed: true,
          expectedToolUsage: ['file-read', 'file-write'],
        },
      };

      const runner = new EvalRunner();
      // passingExecutor only uses 'file-write'
      const result = await runner.runEval(toolDefinition, passingExecutor);

      const toolChecks = result.checks.filter((c) => c.name.startsWith('tool_usage'));
      expect(toolChecks).toHaveLength(2);

      const readCheck = toolChecks.find((c) => c.name === 'tool_usage: file-read');
      const writeCheck = toolChecks.find((c) => c.name === 'tool_usage: file-write');
      expect(readCheck!.passed).toBe(false);
      expect(writeCheck!.passed).toBe(true);
    });

    it('should check quality score and fail when below minimum', async () => {
      const runner = new EvalRunner();
      // failingExecutor has qualityScore 0.1, baseDefinition requires 0.7
      const result = await runner.runEval(baseDefinition, failingExecutor);

      const qualityCheck = result.checks.find((c) => c.name === 'quality_score_check');
      expect(qualityCheck).toBeDefined();
      expect(qualityCheck!.passed).toBe(false);
      expect(qualityCheck!.message).toContain('below minimum');
    });

    it('should check quality score and pass when at or above minimum', async () => {
      const runner = new EvalRunner();
      const result = await runner.runEval(baseDefinition, passingExecutor);

      const qualityCheck = result.checks.find((c) => c.name === 'quality_score_check');
      expect(qualityCheck).toBeDefined();
      expect(qualityCheck!.passed).toBe(true);
    });

    it('should handle executor timeout', async () => {
      jest.useFakeTimers();

      const timeoutDefinition: EvalDefinition = {
        ...baseDefinition,
        id: 'timeout-test',
        timeout: 50,
      };

      const hangingExecutor: EvalExecutor = {
        execute: () => new Promise<EvalExecutionResult>(() => {
          // Never resolves -- simulates a hanging executor
        }),
      };

      const runner = new EvalRunner();
      const resultPromise = runner.runEval(timeoutDefinition, hangingExecutor);

      // Advance timers past the timeout
      jest.advanceTimersByTime(100);

      const result = await resultPromise;

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain('timed out');

      jest.useRealTimers();
    });

    it('should handle executor throwing an error', async () => {
      const throwingExecutor: EvalExecutor = {
        execute: async () => {
          throw new Error('Executor crashed');
        },
      };

      const runner = new EvalRunner();
      const result = await runner.runEval(baseDefinition, throwingExecutor);

      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain('Executor crashed');
    });

    it('should calculate partial score when some checks pass', async () => {
      // Definition with multiple checks: success + quality
      const partialDefinition: EvalDefinition = {
        ...baseDefinition,
        id: 'partial-test',
        expectedBehavior: {
          shouldSucceed: true,
          minQualityScore: 0.95, // will fail (executor returns 0.9)
        },
      };

      const runner = new EvalRunner();
      const result = await runner.runEval(partialDefinition, passingExecutor);

      // success_check passes, quality_score_check fails
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0.5); // 1 of 2 checks passed
    });
  });

  describe('runSuite', () => {
    it('should run all loaded definitions and collect results', async () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([
        { ...baseDefinition, id: 'eval-1', name: 'Eval 1' },
        { ...baseDefinition, id: 'eval-2', name: 'Eval 2' },
      ]);

      const suiteResult = await runner.runSuite('test-suite', passingExecutor);

      expect(suiteResult.suiteName).toBe('test-suite');
      expect(suiteResult.totalEvals).toBe(2);
      expect(suiteResult.results).toHaveLength(2);
      expect(suiteResult.passed).toBe(2);
      expect(suiteResult.failed).toBe(0);
    });

    it('should calculate ALWAYS_PASSES rate correctly', async () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([
        { ...baseDefinition, id: 'ap-1', severity: 'ALWAYS_PASSES' },
        { ...baseDefinition, id: 'ap-2', severity: 'ALWAYS_PASSES' },
      ]);

      const suiteResult = await runner.runSuite('test', passingExecutor);
      expect(suiteResult.alwaysPassRate).toBe(1);

      // Now with a failing eval
      runner.loadDefinitions([
        { ...baseDefinition, id: 'ap-1', severity: 'ALWAYS_PASSES' },
        {
          ...baseDefinition,
          id: 'ap-2',
          severity: 'ALWAYS_PASSES',
          expectedBehavior: { shouldSucceed: false }, // will fail since executor succeeds
        },
      ]);

      const failResult = await runner.runSuite('test', passingExecutor);
      expect(failResult.alwaysPassRate).toBe(0.5);
    });

    it('should calculate USUALLY_PASSES rate correctly', async () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([
        { ...baseDefinition, id: 'up-1', severity: 'USUALLY_PASSES' },
        {
          ...baseDefinition,
          id: 'up-2',
          severity: 'USUALLY_PASSES',
          expectedBehavior: { shouldSucceed: false },
        },
      ]);

      const suiteResult = await runner.runSuite('test', passingExecutor);
      expect(suiteResult.usuallyPassRate).toBe(0.5);
    });

    it('should return correct counts for empty suite', async () => {
      const runner = new EvalRunner();
      const suiteResult = await runner.runSuite('empty', passingExecutor);

      expect(suiteResult.totalEvals).toBe(0);
      expect(suiteResult.passed).toBe(0);
      expect(suiteResult.failed).toBe(0);
      expect(suiteResult.skipped).toBe(0);
      expect(suiteResult.results).toHaveLength(0);
      expect(suiteResult.alwaysPassRate).toBe(1);
      expect(suiteResult.usuallyPassRate).toBe(1);
    });

    it('should include timestamp and duration', async () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([baseDefinition]);

      const suiteResult = await runner.runSuite('test', passingExecutor);

      expect(suiteResult.timestamp).toBeDefined();
      expect(typeof suiteResult.duration).toBe('number');
      expect(suiteResult.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return empty regressions array', async () => {
      const runner = new EvalRunner();
      runner.loadDefinitions([baseDefinition]);

      const suiteResult = await runner.runSuite('test', passingExecutor);
      expect(suiteResult.regressions).toEqual([]);
    });
  });

  describe('createEvalRunner', () => {
    it('should create via factory function', () => {
      const runner = createEvalRunner();
      expect(runner).toBeInstanceOf(EvalRunner);
    });
  });
});
