/**
 * Autonomous Debugging Loop - Unit Tests
 *
 * Tests for HypothesisGenerator, DebuggingLoop, and integration scenarios.
 */

import { HypothesisGenerator } from '../../../../src/core/debugging/hypothesis-generator';
import {
  DebuggingLoop,
  type FixStrategy,
  type LearnCallback,
} from '../../../../src/core/debugging/debugging-loop';
import {
  DEFAULT_DEBUGGING_CONFIG,
  type DebuggingContext,
  type DebuggingAttempt,
  type Hypothesis,
  type DebuggingResult,
} from '../../../../src/core/debugging/types';

// ============================================================================
// Test Helpers
// ============================================================================

function createContext(overrides?: Partial<DebuggingContext>): DebuggingContext {
  return {
    taskId: 'test-task-1',
    error: new Error('test error'),
    errorClassification: {
      severity: 'medium',
      action: 'retry',
      category: 'task',
    },
    stackTrace: '',
    relatedFiles: [],
    previousAttempts: [],
    ...overrides,
  };
}

function createTypeErrorContext(): DebuggingContext {
  return createContext({
    error: new TypeError("Cannot read properties of undefined (reading 'foo')"),
    errorClassification: {
      severity: 'medium',
      action: 'fail_task',
      category: 'task',
    },
    stackTrace: `TypeError: Cannot read properties of undefined (reading 'foo')
    at processData (/src/core/services/data-processor.ts:45:12)
    at Object.<anonymous> (/src/core/services/handler.ts:22:5)
    at node:internal/modules/cjs/loader:1234:14`,
  });
}

function createEnoentContext(): DebuggingContext {
  return createContext({
    error: new Error("ENOENT: no such file or directory, open '/config/app.json'"),
    errorClassification: {
      severity: 'medium',
      action: 'fail_task',
      category: 'task',
    },
    stackTrace: `Error: ENOENT: no such file or directory, open '/config/app.json'
    at Object.openSync (node:fs:601:3)
    at readConfig (/src/core/config/config-loader.ts:15:10)`,
  });
}

function createTimeoutContext(): DebuggingContext {
  return createContext({
    error: new Error('Request timeout after 30000ms'),
    errorClassification: {
      severity: 'medium',
      action: 'retry',
      category: 'transient',
    },
  });
}

function createModuleNotFoundContext(): DebuggingContext {
  return createContext({
    error: new Error("Cannot find module 'some-package'"),
    errorClassification: {
      severity: 'high',
      action: 'fail_task',
      category: 'task',
    },
  });
}

function createAssertionContext(): DebuggingContext {
  return createContext({
    error: new Error('AssertionError: expected 5 but got 3'),
    errorClassification: {
      severity: 'medium',
      action: 'fail_task',
      category: 'task',
    },
  });
}

/** Create a FixStrategy that always succeeds */
function alwaysSuccessStrategy(): FixStrategy {
  return {
    applyFix: jest.fn().mockResolvedValue(true),
    verifyFix: jest.fn().mockResolvedValue(true),
  };
}

/** Create a FixStrategy that always fails */
function alwaysFailStrategy(): FixStrategy {
  return {
    applyFix: jest.fn().mockResolvedValue(true),
    verifyFix: jest.fn().mockResolvedValue(false),
  };
}

/** Create a FixStrategy that fails to apply */
function applyFailStrategy(): FixStrategy {
  return {
    applyFix: jest.fn().mockResolvedValue(false),
    verifyFix: jest.fn().mockResolvedValue(false),
  };
}

/** Create a FixStrategy that succeeds on the Nth call */
function succeedsOnNthCallStrategy(n: number): FixStrategy {
  let callCount = 0;
  return {
    applyFix: jest.fn().mockResolvedValue(true),
    verifyFix: jest.fn().mockImplementation(async () => {
      callCount++;
      return callCount >= n;
    }),
  };
}

// ============================================================================
// HypothesisGenerator Tests
// ============================================================================

describe('HypothesisGenerator', () => {
  let generator: HypothesisGenerator;

  beforeEach(() => {
    generator = new HypothesisGenerator();
  });

  // --------------------------------------------------------------------------
  // Hypothesis generation from error types
  // --------------------------------------------------------------------------

  describe('generateHypotheses', () => {
    it('should generate hypotheses from TypeError', () => {
      const context = createTypeErrorContext();
      const hypotheses = generator.generateHypotheses(context);

      expect(hypotheses.length).toBeGreaterThan(0);
      const codeError = hypotheses.find((h) => h.category === 'code-error');
      expect(codeError).toBeDefined();
      expect(codeError!.confidence).toBeGreaterThan(0.5);
      expect(codeError!.description).toContain('TypeError');
    });

    it('should generate hypotheses from ENOENT error', () => {
      const context = createEnoentContext();
      const hypotheses = generator.generateHypotheses(context);

      expect(hypotheses.length).toBeGreaterThan(0);
      const configError = hypotheses.find((h) => h.category === 'config-error');
      expect(configError).toBeDefined();
      expect(configError!.description).toContain('ENOENT');
    });

    it('should generate hypotheses from timeout error', () => {
      const context = createTimeoutContext();
      const hypotheses = generator.generateHypotheses(context);

      expect(hypotheses.length).toBeGreaterThan(0);
      const runtimeError = hypotheses.find((h) => h.category === 'runtime-error');
      expect(runtimeError).toBeDefined();
      expect(runtimeError!.description).toContain('timed out');
    });

    it('should generate hypotheses from MODULE_NOT_FOUND', () => {
      const context = createModuleNotFoundContext();
      const hypotheses = generator.generateHypotheses(context);

      expect(hypotheses.length).toBeGreaterThan(0);
      const depError = hypotheses.find((h) => h.category === 'dependency-error');
      expect(depError).toBeDefined();
      expect(depError!.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should generate hypotheses from assertion failure', () => {
      const context = createAssertionContext();
      const hypotheses = generator.generateHypotheses(context);

      expect(hypotheses.length).toBeGreaterThan(0);
      const logicError = hypotheses.find((h) => h.category === 'logic-error');
      expect(logicError).toBeDefined();
    });

    it('should generate hypotheses from stack trace with file paths', () => {
      const context = createTypeErrorContext();
      const hypotheses = generator.generateHypotheses(context);

      // Should have at least one hypothesis with relatedFiles populated from stack trace
      const withFiles = hypotheses.find((h) => h.relatedFiles.length > 0);
      expect(withFiles).toBeDefined();
      expect(withFiles!.relatedFiles.some((f) => f.includes('data-processor'))).toBe(true);
    });

    it('should generate a fallback hypothesis for unknown errors', () => {
      const context = createContext({
        error: new Error('Something completely unexpected happened'),
      });
      const hypotheses = generator.generateHypotheses(context);

      expect(hypotheses.length).toBeGreaterThan(0);
      // Should have at least a generic hypothesis
      expect(hypotheses.some((h) => h.description.includes('Unknown error') || h.confidence <= 0.5)).toBe(true);
    });

    it('should populate relatedFiles from context when stack trace has none', () => {
      const context = createContext({
        error: new Error('mysterious error'),
        relatedFiles: ['/src/app.ts', '/src/util.ts'],
        stackTrace: '',
      });
      const hypotheses = generator.generateHypotheses(context);

      // All hypotheses should inherit relatedFiles from context
      for (const h of hypotheses) {
        expect(h.relatedFiles.length).toBeGreaterThan(0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Ranking
  // --------------------------------------------------------------------------

  describe('rankByConfidence', () => {
    it('should rank hypotheses highest confidence first', () => {
      const hypotheses: Hypothesis[] = [
        {
          id: '1',
          description: 'low',
          confidence: 0.3,
          category: 'code-error',
          suggestedFix: 'fix1',
          relatedFiles: [],
          testStrategy: 'test1',
        },
        {
          id: '2',
          description: 'high',
          confidence: 0.9,
          category: 'config-error',
          suggestedFix: 'fix2',
          relatedFiles: [],
          testStrategy: 'test2',
        },
        {
          id: '3',
          description: 'mid',
          confidence: 0.6,
          category: 'runtime-error',
          suggestedFix: 'fix3',
          relatedFiles: [],
          testStrategy: 'test3',
        },
      ];

      const ranked = generator.rankByConfidence(hypotheses);

      expect(ranked[0].confidence).toBe(0.9);
      expect(ranked[1].confidence).toBe(0.6);
      expect(ranked[2].confidence).toBe(0.3);
    });

    it('should not mutate the original array', () => {
      const hypotheses: Hypothesis[] = [
        {
          id: '1',
          description: 'low',
          confidence: 0.3,
          category: 'code-error',
          suggestedFix: 'fix1',
          relatedFiles: [],
          testStrategy: 'test1',
        },
        {
          id: '2',
          description: 'high',
          confidence: 0.9,
          category: 'config-error',
          suggestedFix: 'fix2',
          relatedFiles: [],
          testStrategy: 'test2',
        },
      ];

      const ranked = generator.rankByConfidence(hypotheses);
      expect(hypotheses[0].confidence).toBe(0.3); // original unchanged
      expect(ranked[0].confidence).toBe(0.9);
    });
  });

  // --------------------------------------------------------------------------
  // Filtering
  // --------------------------------------------------------------------------

  describe('filterByMinConfidence', () => {
    it('should filter out hypotheses below the threshold', () => {
      const hypotheses: Hypothesis[] = [
        {
          id: '1',
          description: 'low',
          confidence: 0.3,
          category: 'code-error',
          suggestedFix: 'fix1',
          relatedFiles: [],
          testStrategy: 'test1',
        },
        {
          id: '2',
          description: 'high',
          confidence: 0.8,
          category: 'config-error',
          suggestedFix: 'fix2',
          relatedFiles: [],
          testStrategy: 'test2',
        },
      ];

      const filtered = generator.filterByMinConfidence(hypotheses, 0.5);

      expect(filtered.length).toBe(1);
      expect(filtered[0].confidence).toBe(0.8);
    });

    it('should return empty array when all below threshold', () => {
      const hypotheses: Hypothesis[] = [
        {
          id: '1',
          description: 'low',
          confidence: 0.2,
          category: 'code-error',
          suggestedFix: 'fix1',
          relatedFiles: [],
          testStrategy: 'test1',
        },
      ];

      const filtered = generator.filterByMinConfidence(hypotheses, 0.5);
      expect(filtered.length).toBe(0);
    });

    it('should include hypotheses at exactly the threshold', () => {
      const hypotheses: Hypothesis[] = [
        {
          id: '1',
          description: 'exact',
          confidence: 0.5,
          category: 'code-error',
          suggestedFix: 'fix1',
          relatedFiles: [],
          testStrategy: 'test1',
        },
      ];

      const filtered = generator.filterByMinConfidence(hypotheses, 0.5);
      expect(filtered.length).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // Previous attempts influence
  // --------------------------------------------------------------------------

  describe('previous attempts influence', () => {
    it('should reduce confidence for hypotheses matching failed attempts', () => {
      const context = createTypeErrorContext();

      // First generate without previous attempts
      const firstRun = generator.generateHypotheses(
        createTypeErrorContext(),
      );
      const firstConfidence = firstRun[0].confidence;

      // Now add a failed attempt with same description
      context.previousAttempts = [
        {
          hypothesis: firstRun[0].description,
          action: 'attempted fix',
          result: 'failure',
          evidence: ['did not work'],
          duration: 100,
        },
      ];

      const secondRun = generator.generateHypotheses(context);
      const matchingHypothesis = secondRun.find(
        (h) => h.category === firstRun[0].category,
      );

      expect(matchingHypothesis).toBeDefined();
      expect(matchingHypothesis!.confidence).toBeLessThan(firstConfidence);
    });
  });
});

// ============================================================================
// DebuggingLoop Tests
// ============================================================================

describe('DebuggingLoop', () => {
  // --------------------------------------------------------------------------
  // Basic diagnosis
  // --------------------------------------------------------------------------

  describe('diagnose', () => {
    it('should diagnose a simple error with a single hypothesis and successful fix', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 3 },
        alwaysSuccessStrategy(),
      );
      const context = createTypeErrorContext();

      const result = await loop.diagnose(context);

      expect(result.taskId).toBe(context.taskId);
      expect(result.successfulFix).not.toBeNull();
      expect(result.rootCause).not.toBeNull();
      expect(result.hypothesesTested).toBeGreaterThanOrEqual(1);
      expect(result.attempts.length).toBeGreaterThanOrEqual(1);
      expect(result.attempts[0].result).toBe('success');
    });

    it('should stop after a successful fix', async () => {
      const strategy = succeedsOnNthCallStrategy(1);
      const loop = new DebuggingLoop({ maxDepth: 5 }, strategy);
      const context = createTypeErrorContext();

      const result = await loop.diagnose(context);

      expect(result.successfulFix).not.toBeNull();
      // Should stop at the first successful hypothesis
      expect(result.hypothesesTested).toBe(1);
    });

    it('should respect maxDepth limit', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 2 },
        alwaysFailStrategy(),
      );

      // Use a context that generates multiple hypotheses
      const context = createContext({
        error: new TypeError("Cannot read properties of undefined (reading 'x')"),
        stackTrace: `TypeError: Cannot read properties of undefined
    at processData (/src/core/data.ts:10:5)
    at handler (/src/core/handler.ts:20:3)`,
      });

      const result = await loop.diagnose(context);

      expect(result.hypothesesTested).toBeLessThanOrEqual(2);
      expect(result.successfulFix).toBeNull();
    });

    it('should respect timeout', async () => {
      // Create a strategy that takes time
      const slowStrategy: FixStrategy = {
        applyFix: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(true), 50)),
        ),
        verifyFix: jest.fn().mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(false), 50)),
        ),
      };

      const loop = new DebuggingLoop(
        { maxDepth: 10, timeoutMs: 80 },
        slowStrategy,
      );

      const context = createContext({
        error: new TypeError("Cannot read properties of undefined (reading 'x')"),
        stackTrace: `TypeError: err
    at a (/src/a.ts:1:1)
    at b (/src/b.ts:2:2)`,
      });

      const result = await loop.diagnose(context);

      // Should not have tested all 10 hypotheses due to timeout
      expect(result.hypothesesTested).toBeLessThan(10);
      expect(result.totalDuration).toBeGreaterThanOrEqual(80);
    });

    it('should record all attempts', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 3 },
        alwaysFailStrategy(),
      );
      const context = createTypeErrorContext();

      const result = await loop.diagnose(context);

      expect(result.attempts.length).toBe(result.hypothesesTested);
      for (const attempt of result.attempts) {
        expect(attempt.hypothesis).toBeDefined();
        expect(attempt.action).toBeDefined();
        expect(attempt.result).toBeDefined();
        expect(attempt.evidence.length).toBeGreaterThan(0);
        expect(typeof attempt.duration).toBe('number');
      }
    });

    it('should return null rootCause when all hypotheses fail', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 5 },
        alwaysFailStrategy(),
      );
      const context = createTypeErrorContext();

      const result = await loop.diagnose(context);

      expect(result.rootCause).toBeNull();
      expect(result.successfulFix).toBeNull();
    });

    it('should handle empty hypotheses list gracefully', async () => {
      // Use a very high minConfidence to filter out all hypotheses
      const loop = new DebuggingLoop(
        { maxDepth: 3, minConfidence: 0.99 },
        alwaysSuccessStrategy(),
      );
      const context = createContext({
        error: new Error('something totally unknown and weird'),
      });

      const result = await loop.diagnose(context);

      expect(result.hypothesesTested).toBe(0);
      expect(result.attempts.length).toBe(0);
      expect(result.rootCause).toBeNull();
      expect(result.successfulFix).toBeNull();
    });

    it('should handle errors during hypothesis testing (inconclusive result)', async () => {
      const throwingStrategy: FixStrategy = {
        applyFix: jest.fn().mockRejectedValue(new Error('crash during apply')),
        verifyFix: jest.fn().mockResolvedValue(false),
      };

      const loop = new DebuggingLoop({ maxDepth: 3 }, throwingStrategy);
      const context = createTypeErrorContext();

      const result = await loop.diagnose(context);

      expect(result.attempts.length).toBeGreaterThan(0);
      expect(result.attempts[0].result).toBe('inconclusive');
      expect(result.attempts[0].evidence.some((e) => e.includes('crash during apply'))).toBe(true);
    });

    it('should handle applyFix returning false', async () => {
      const loop = new DebuggingLoop({ maxDepth: 3 }, applyFailStrategy());
      const context = createTypeErrorContext();

      const result = await loop.diagnose(context);

      for (const attempt of result.attempts) {
        expect(attempt.result).toBe('failure');
        expect(attempt.evidence).toContain('Fix application failed');
      }
    });
  });

  // --------------------------------------------------------------------------
  // Events
  // --------------------------------------------------------------------------

  describe('events', () => {
    it('should emit events in correct order for successful diagnosis', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 3 },
        alwaysSuccessStrategy(),
      );
      const events: string[] = [];

      loop.on('hypothesis:generated', () => events.push('generated'));
      loop.on('hypothesis:testing', () => events.push('testing'));
      loop.on('hypothesis:result', () => events.push('result'));
      loop.on('fix:applied', () => events.push('fix:applied'));
      loop.on('diagnosis:complete', () => events.push('complete'));

      await loop.diagnose(createTypeErrorContext());

      expect(events[0]).toBe('generated');
      expect(events).toContain('testing');
      expect(events).toContain('result');
      expect(events).toContain('fix:applied');
      expect(events[events.length - 1]).toBe('complete');
    });

    it('should emit diagnosis:complete even when no fix is found', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 3 },
        alwaysFailStrategy(),
      );
      const events: string[] = [];

      loop.on('diagnosis:complete', () => events.push('complete'));
      loop.on('fix:applied', () => events.push('fix:applied'));

      await loop.diagnose(createTypeErrorContext());

      expect(events).toContain('complete');
      expect(events).not.toContain('fix:applied');
    });

    it('should emit hypothesis:generated with the filtered hypotheses', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 3 },
        alwaysFailStrategy(),
      );

      let generatedHypotheses: Hypothesis[] = [];
      loop.on('hypothesis:generated', (h) => {
        generatedHypotheses = h;
      });

      await loop.diagnose(createTypeErrorContext());

      expect(generatedHypotheses.length).toBeGreaterThan(0);
      for (const h of generatedHypotheses) {
        expect(h.id).toBeDefined();
        expect(h.description).toBeDefined();
        expect(h.confidence).toBeDefined();
      }
    });

    it('should emit hypothesis:result with hypothesis and attempt data', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 1 },
        alwaysSuccessStrategy(),
      );

      let resultData: { hypothesis: Hypothesis; attempt: DebuggingAttempt } | null = null;
      loop.on('hypothesis:result', (data) => {
        resultData = data;
      });

      await loop.diagnose(createTypeErrorContext());

      expect(resultData).not.toBeNull();
      expect(resultData!.hypothesis).toBeDefined();
      expect(resultData!.attempt).toBeDefined();
      expect(resultData!.attempt.result).toBe('success');
    });
  });

  // --------------------------------------------------------------------------
  // Learning integration
  // --------------------------------------------------------------------------

  describe('learning', () => {
    it('should set learned flag when autoLearn is true and fix succeeds', async () => {
      const learnCallback: LearnCallback = jest.fn().mockResolvedValue(undefined);
      const loop = new DebuggingLoop(
        { autoLearn: true },
        alwaysSuccessStrategy(),
        learnCallback,
      );

      const result = await loop.diagnose(createTypeErrorContext());

      expect(result.learned).toBe(true);
      expect(learnCallback).toHaveBeenCalled();
    });

    it('should not call learn callback when autoLearn is false', async () => {
      const learnCallback: LearnCallback = jest.fn().mockResolvedValue(undefined);
      const loop = new DebuggingLoop(
        { autoLearn: false },
        alwaysSuccessStrategy(),
        learnCallback,
      );

      const result = await loop.diagnose(createTypeErrorContext());

      expect(result.learned).toBe(false);
      expect(learnCallback).not.toHaveBeenCalled();
    });

    it('should not set learned when no fix is found', async () => {
      const learnCallback: LearnCallback = jest.fn().mockResolvedValue(undefined);
      const loop = new DebuggingLoop(
        { autoLearn: true },
        alwaysFailStrategy(),
        learnCallback,
      );

      const result = await loop.diagnose(createTypeErrorContext());

      expect(result.learned).toBe(false);
      expect(learnCallback).not.toHaveBeenCalled();
    });

    it('should handle learn callback failure gracefully', async () => {
      const learnCallback: LearnCallback = jest.fn().mockRejectedValue(
        new Error('learning system down'),
      );
      const loop = new DebuggingLoop(
        { autoLearn: true },
        alwaysSuccessStrategy(),
        learnCallback,
      );

      const result = await loop.diagnose(createTypeErrorContext());

      // Fix was found but learning failed
      expect(result.successfulFix).not.toBeNull();
      expect(result.learned).toBe(false);
    });

    it('should not set learned when no learn callback is provided', async () => {
      const loop = new DebuggingLoop(
        { autoLearn: true },
        alwaysSuccessStrategy(),
        // no learn callback
      );

      const result = await loop.diagnose(createTypeErrorContext());

      expect(result.successfulFix).not.toBeNull();
      expect(result.learned).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Config defaults
  // --------------------------------------------------------------------------

  describe('config', () => {
    it('should apply default config values', () => {
      expect(DEFAULT_DEBUGGING_CONFIG.maxDepth).toBe(3);
      expect(DEFAULT_DEBUGGING_CONFIG.timeoutMs).toBe(30000);
      expect(DEFAULT_DEBUGGING_CONFIG.minConfidence).toBe(0.5);
      expect(DEFAULT_DEBUGGING_CONFIG.autoLearn).toBe(true);
    });

    it('should merge partial config with defaults', async () => {
      const loop = new DebuggingLoop(
        { maxDepth: 1 },
        alwaysFailStrategy(),
      );
      const context = createTypeErrorContext();

      const result = await loop.diagnose(context);

      // maxDepth=1 should limit to 1 hypothesis tested
      expect(result.hypothesesTested).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('DebuggingLoop Integration', () => {
  it('should complete full loop: error -> hypotheses -> test -> result', async () => {
    const loop = new DebuggingLoop(
      { maxDepth: 3, autoLearn: true },
      alwaysSuccessStrategy(),
      jest.fn().mockResolvedValue(undefined),
    );

    const context = createEnoentContext();
    const result = await loop.diagnose(context);

    expect(result.taskId).toBe(context.taskId);
    expect(result.successfulFix).not.toBeNull();
    expect(result.rootCause).not.toBeNull();
    expect(result.attempts.length).toBeGreaterThanOrEqual(1);
    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    expect(result.learned).toBe(true);
  });

  it('should test multiple hypotheses in order when earlier ones fail', async () => {
    const strategy = succeedsOnNthCallStrategy(2);
    const loop = new DebuggingLoop({ maxDepth: 5, minConfidence: 0.1 }, strategy);

    // Use an error that triggers multiple pattern categories:
    // - "Cannot find module" triggers dependency-error
    // - Stack trace generates code-error
    // This ensures at least 2 hypotheses after deduplication
    const context = createContext({
      error: new Error("Cannot find module 'some-pkg' - timeout waiting for install"),
      stackTrace: `Error: Cannot find module 'some-pkg'
    at require (/src/loader.ts:10:5)
    at init (/src/app.ts:3:1)`,
    });

    const result = await loop.diagnose(context);

    expect(result.hypothesesTested).toBeGreaterThanOrEqual(2);
    expect(result.attempts[0].result).toBe('failure');
    expect(result.attempts[1].result).toBe('success');
    expect(result.successfulFix).not.toBeNull();
  });

  it('should use previous attempts to inform subsequent hypothesis generation', async () => {
    const generator = new HypothesisGenerator();

    // First run: no previous attempts
    const context1 = createTypeErrorContext();
    const hypotheses1 = generator.generateHypotheses(context1);
    const firstConfidence = hypotheses1[0].confidence;

    // Second run: with failed attempt from first run
    const context2 = createTypeErrorContext();
    context2.previousAttempts = [
      {
        hypothesis: hypotheses1[0].description,
        action: hypotheses1[0].suggestedFix,
        result: 'failure',
        evidence: ['did not help'],
        duration: 200,
      },
    ];

    const hypotheses2 = generator.generateHypotheses(context2);
    const matchingCategory = hypotheses2.find(
      (h) => h.category === hypotheses1[0].category,
    );

    // Confidence should be reduced for the same category hypothesis
    expect(matchingCategory).toBeDefined();
    expect(matchingCategory!.confidence).toBeLessThan(firstConfidence);
  });

  it('should handle ReferenceError correctly in full loop', async () => {
    const loop = new DebuggingLoop(
      { maxDepth: 3 },
      alwaysSuccessStrategy(),
    );

    const context = createContext({
      error: new ReferenceError('myFunction is not defined'),
      errorClassification: {
        severity: 'medium',
        action: 'fail_task',
        category: 'task',
      },
    });

    const result = await loop.diagnose(context);

    expect(result.successfulFix).not.toBeNull();
    expect(result.rootCause).toContain('ReferenceError');
  });

  it('should handle ECONNREFUSED in full loop', async () => {
    const loop = new DebuggingLoop(
      { maxDepth: 3 },
      alwaysSuccessStrategy(),
    );

    const context = createContext({
      error: new Error('connect ECONNREFUSED 127.0.0.1:5432'),
      errorClassification: {
        severity: 'medium',
        action: 'retry',
        category: 'transient',
      },
    });

    const result = await loop.diagnose(context);

    expect(result.successfulFix).not.toBeNull();
    expect(result.rootCause).toContain('Connection refused');
  });
});
