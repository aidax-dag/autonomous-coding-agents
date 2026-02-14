/**
 * Autonomous Debugging Loop - End-to-End Verification Tests
 *
 * Validates the full error -> diagnose -> fix -> test chain including
 * error detection, diagnosis, fix application, verification, and retry logic.
 */

import { DebuggingLoop, type FixStrategy, type LearnCallback } from '../../../../src/core/debugging/debugging-loop';
import { HypothesisGenerator } from '../../../../src/core/debugging/hypothesis-generator';
import type { DebuggingContext, DebuggingAttempt, DebuggingResult } from '../../../../src/core/debugging/types';

// ============================================================================
// Helpers
// ============================================================================

function ctx(overrides?: Partial<DebuggingContext>): DebuggingContext {
  return {
    taskId: 'e2e-task',
    error: new Error('test error'),
    errorClassification: { severity: 'medium', action: 'retry', category: 'task' },
    stackTrace: '',
    relatedFiles: [],
    previousAttempts: [],
    ...overrides,
  };
}

const ok = (): FixStrategy => ({
  applyFix: jest.fn().mockResolvedValue(true),
  verifyFix: jest.fn().mockResolvedValue(true),
});

const verifyFail = (): FixStrategy => ({
  applyFix: jest.fn().mockResolvedValue(true),
  verifyFix: jest.fn().mockResolvedValue(false),
});

const applyFail = (): FixStrategy => ({
  applyFix: jest.fn().mockResolvedValue(false),
  verifyFix: jest.fn(),
});

const crash = (msg: string): FixStrategy => ({
  applyFix: jest.fn().mockRejectedValue(new Error(msg)),
  verifyFix: jest.fn(),
});

function okOnNth(n: number): FixStrategy {
  let count = 0;
  return {
    applyFix: jest.fn().mockResolvedValue(true),
    verifyFix: jest.fn().mockImplementation(async () => ++count >= n),
  };
}

/** Context that generates multiple hypothesis categories for retry tests */
function multiHypCtx(taskId = 'e2e-task'): DebuggingContext {
  return ctx({
    taskId,
    error: new Error("Cannot find module 'pkg' - ECONNRESET during install"),
    stackTrace: `Error: Cannot find module 'pkg'\n    at require (/src/index.ts:5:1)\n    at init (/src/boot.ts:10:3)`,
  });
}

// ============================================================================
// Error Detection Chain
// ============================================================================

describe('Error Detection Chain', () => {
  const gen = new HypothesisGenerator();

  it('should parse and categorize syntax errors', () => {
    const h = gen.generateHypotheses(ctx({
      error: new Error('SyntaxError: Unexpected token } in JSON at position 42'),
      stackTrace: 'SyntaxError: Unexpected token }\n    at readConfig (/src/config/loader.ts:15:20)',
    }));
    const match = h.find((x) => x.category === 'code-error');
    expect(match).toBeDefined();
    expect(match!.description).toContain('Syntax error');
    expect(match!.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should detect runtime errors (ECONNREFUSED)', () => {
    const h = gen.generateHypotheses(ctx({ error: new Error('connect ECONNREFUSED 127.0.0.1:3000') }));
    expect(h.find((x) => x.category === 'runtime-error')!.description).toContain('Connection refused');
  });

  it('should detect test failures (assertion errors) with related files', () => {
    const h = gen.generateHypotheses(ctx({
      error: new Error('AssertionError: expected true but got false'),
      relatedFiles: ['/src/utils/validator.ts'],
    }));
    const match = h.find((x) => x.category === 'logic-error');
    expect(match).toBeDefined();
    expect(match!.description).toContain('Assertion failure');
    expect(match!.relatedFiles).toContain('/src/utils/validator.ts');
  });
});

// ============================================================================
// Diagnosis Phase
// ============================================================================

describe('Diagnosis Phase', () => {
  const gen = new HypothesisGenerator();

  it.each([
    ['syntax',        new Error('SyntaxError: Unexpected token {'), 'code-error'],
    ['logic',         new Error('AssertionError: expected 42 but got 0'), 'logic-error'],
    ['dependency',    new Error("Cannot find module '@acme/utils'"), 'dependency-error'],
    ['configuration', new Error("ENOENT: no such file or directory, open '/etc/config.yml'"), 'config-error'],
  ])('should classify %s errors correctly', (_label, error, expectedCategory) => {
    const h = gen.generateHypotheses(ctx({ error }));
    expect(h.some((x) => x.category === expectedCategory)).toBe(true);
  });

  it('should perform multi-step diagnosis when first hypothesis is wrong', async () => {
    const loop = new DebuggingLoop({ maxDepth: 5, minConfidence: 0.1 }, okOnNth(2));
    const result = await loop.diagnose(multiHypCtx());

    expect(result.hypothesesTested).toBeGreaterThanOrEqual(2);
    expect(result.attempts[0].result).toBe('failure');
    expect(result.successfulFix).not.toBeNull();
  });
});

// ============================================================================
// Fix Application Phase
// ============================================================================

describe('Fix Application Phase', () => {
  it('should apply and verify fixes for common error patterns', async () => {
    const s = ok();
    const loop = new DebuggingLoop({ maxDepth: 3 }, s);
    const result = await loop.diagnose(ctx({
      error: new TypeError("Cannot read properties of undefined (reading 'name')"),
      stackTrace: 'TypeError: err\n    at getUser (/src/services/user.ts:12:5)',
    }));

    expect(result.successfulFix).not.toBeNull();
    expect(result.successfulFix!.suggestedFix.length).toBeGreaterThan(0);
    expect(s.applyFix).toHaveBeenCalled();
    expect(s.verifyFix).toHaveBeenCalled();
  });

  it('should block verify when applyFix returns false', async () => {
    const s = applyFail();
    const loop = new DebuggingLoop({ maxDepth: 3 }, s);
    const result = await loop.diagnose(ctx({
      error: new Error("ENOENT: no such file or directory, open '/missing.json'"),
    }));

    expect(s.applyFix).toHaveBeenCalled();
    expect(s.verifyFix).not.toHaveBeenCalled();
    result.attempts.forEach((a) => {
      expect(a.result).toBe('failure');
      expect(a.evidence).toContain('Fix application failed');
    });
  });

  it('should produce inconclusive when fix crashes', async () => {
    const loop = new DebuggingLoop({ maxDepth: 3 }, crash('Disk full'));
    const result = await loop.diagnose(ctx({
      error: new TypeError("Cannot read properties of null (reading 'id')"),
    }));

    expect(result.successfulFix).toBeNull();
    result.attempts.forEach((a) => {
      expect(a.result).toBe('inconclusive');
      expect(a.evidence.some((e) => e.includes('Disk full'))).toBe(true);
    });
  });

  it('should report failure when verify fails (rollback scenario)', async () => {
    const loop = new DebuggingLoop({ maxDepth: 3 }, verifyFail());
    const result = await loop.diagnose(ctx({ error: new Error("Cannot find module 'lodash'") }));

    expect(result.successfulFix).toBeNull();
    result.attempts.forEach((a) => {
      expect(a.result).toBe('failure');
      expect(a.evidence).toContain('Fix verification failed');
    });
  });
});

// ============================================================================
// Verification Phase
// ============================================================================

describe('Verification Phase', () => {
  it('should verify fix success with evidence trail', async () => {
    const loop = new DebuggingLoop({ maxDepth: 3 }, ok());
    const result = await loop.diagnose(ctx({
      error: new Error('EACCES: permission denied, open /var/log/app.log'),
    }));

    expect(result.successfulFix).not.toBeNull();
    expect(result.attempts[0].evidence).toContain('Fix applied successfully');
    expect(result.attempts[0].evidence).toContain('Fix verified successfully');
  });

  it('should retry on failure and eventually succeed', async () => {
    const loop = new DebuggingLoop({ maxDepth: 5, minConfidence: 0.1 }, okOnNth(2));
    const result = await loop.diagnose(multiHypCtx());

    expect(result.attempts[0].result).toBe('failure');
    expect(result.attempts.find((a) => a.result === 'success')).toBeDefined();
    expect(result.successfulFix).not.toBeNull();
  });

  it('should enforce maxDepth as retry limit', async () => {
    const loop = new DebuggingLoop({ maxDepth: 2, minConfidence: 0.1 }, verifyFail());
    const result = await loop.diagnose(multiHypCtx());

    expect(result.hypothesesTested).toBeLessThanOrEqual(2);
    expect(result.successfulFix).toBeNull();
  });
});

// ============================================================================
// Full Chain Integration
// ============================================================================

describe('Full Chain Integration', () => {
  it('should complete error -> diagnose -> fix -> verify -> success flow', async () => {
    const learn: LearnCallback = jest.fn().mockResolvedValue(undefined);
    const s = ok();
    const loop = new DebuggingLoop({ maxDepth: 3, autoLearn: true }, s, learn);

    const events: string[] = [];
    loop.on('hypothesis:generated', () => events.push('generated'));
    loop.on('hypothesis:testing', () => events.push('testing'));
    loop.on('hypothesis:result', () => events.push('result'));
    loop.on('fix:applied', () => events.push('fix:applied'));
    loop.on('diagnosis:complete', () => events.push('complete'));

    const context = ctx({
      taskId: 'e2e-success',
      error: new Error("ENOENT: no such file or directory, open '/app/config.json'"),
      stackTrace: 'Error: ENOENT\n    at readConfig (/src/config/loader.ts:20:10)',
      relatedFiles: ['/src/config/loader.ts'],
    });
    const result = await loop.diagnose(context);

    expect(result.taskId).toBe('e2e-success');
    expect(result.rootCause).not.toBeNull();
    expect(result.successfulFix).not.toBeNull();
    expect(result.successfulFix!.category).toBe('config-error');
    expect(result.attempts[0].result).toBe('success');
    expect(result.learned).toBe(true);

    expect(events[0]).toBe('generated');
    expect(events).toContain('fix:applied');
    expect(events[events.length - 1]).toBe('complete');
    expect(s.applyFix).toHaveBeenCalled();
    expect(learn).toHaveBeenCalledWith(context.error, expect.any(String), expect.any(String));
  });

  it('should complete error -> diagnose -> fix -> verify -> fail -> retry flow', async () => {
    const loop = new DebuggingLoop({ maxDepth: 5, minConfidence: 0.1 }, okOnNth(2));
    const eventResults: string[] = [];
    loop.on('hypothesis:result', (d: { attempt: DebuggingAttempt }) =>
      eventResults.push(d.attempt.result),
    );
    loop.on('fix:applied', () => eventResults.push('fix:applied'));

    const result = await loop.diagnose(multiHypCtx('e2e-retry'));

    expect(result.hypothesesTested).toBeGreaterThanOrEqual(2);
    expect(result.attempts[0].result).toBe('failure');
    expect(result.successfulFix).not.toBeNull();
    expect(eventResults[0]).toBe('failure');
    expect(eventResults).toContain('success');
    expect(eventResults).toContain('fix:applied');
  });

  it('should gracefully terminate when max retries exceeded', async () => {
    const learn: LearnCallback = jest.fn().mockResolvedValue(undefined);
    const loop = new DebuggingLoop({ maxDepth: 2, autoLearn: true, minConfidence: 0.1 }, verifyFail(), learn);

    let emittedResult: DebuggingResult | null = null;
    loop.on('diagnosis:complete', (r: DebuggingResult) => { emittedResult = r; });

    const result = await loop.diagnose(ctx({
      taskId: 'e2e-max-retries',
      error: new TypeError("Cannot read properties of undefined (reading 'map')"),
      stackTrace: 'TypeError: err\n    at transform (/src/pipeline/transform.ts:30:12)\n    at process (/src/pipeline/runner.ts:15:5)',
    }));

    expect(result.hypothesesTested).toBeLessThanOrEqual(2);
    expect(result.successfulFix).toBeNull();
    expect(result.rootCause).toBeNull();
    expect(result.attempts.every((a) => a.result === 'failure')).toBe(true);
    expect(learn).not.toHaveBeenCalled();
    expect(result.learned).toBe(false);
    expect(emittedResult).not.toBeNull();
    expect(emittedResult!.taskId).toBe('e2e-max-retries');
  });

  it('should handle timeout during full chain', async () => {
    const slow: FixStrategy = {
      applyFix: jest.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r(true), 60))),
      verifyFix: jest.fn().mockImplementation(() => new Promise((r) => setTimeout(() => r(false), 60))),
    };
    const loop = new DebuggingLoop({ maxDepth: 10, timeoutMs: 100 }, slow);
    const result = await loop.diagnose(ctx({
      error: new TypeError("Cannot read properties of undefined (reading 'x')"),
      stackTrace: 'TypeError: err\n    at fn (/src/a.ts:1:1)\n    at main (/src/b.ts:2:2)',
    }));

    expect(result.hypothesesTested).toBeLessThan(10);
    expect(result.totalDuration).toBeGreaterThanOrEqual(100);
  });

  it('should preserve full attempt history with required fields', async () => {
    const loop = new DebuggingLoop({ maxDepth: 5, minConfidence: 0.1 }, okOnNth(3));
    const result = await loop.diagnose(multiHypCtx());

    result.attempts.forEach((a) => {
      expect(typeof a.hypothesis).toBe('string');
      expect(typeof a.action).toBe('string');
      expect(['success', 'failure', 'inconclusive']).toContain(a.result);
      expect(a.evidence.length).toBeGreaterThan(0);
      expect(a.duration).toBeGreaterThanOrEqual(0);
    });
    expect(result.hypothesesTested).toBe(result.attempts.length);
  });

  it('should handle sequential independent debugging sessions', async () => {
    const loop = new DebuggingLoop({ maxDepth: 3 }, ok());
    const scenarios = [
      ctx({ taskId: 'seq-syntax', error: new Error('SyntaxError: Unexpected token }') }),
      ctx({ taskId: 'seq-module', error: new Error("Cannot find module 'react'") }),
      ctx({ taskId: 'seq-runtime', error: new Error('connect ECONNREFUSED 127.0.0.1:5432') }),
    ];

    const results = await Promise.all(scenarios.map((c) => loop.diagnose(c)));

    expect(results.map((r) => r.taskId)).toEqual(['seq-syntax', 'seq-module', 'seq-runtime']);
    results.forEach((r) => {
      expect(r.successfulFix).not.toBeNull();
      expect(r.rootCause).not.toBeNull();
    });
  });
});
