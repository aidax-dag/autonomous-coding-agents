/**
 * ContextOptimizerHook Unit Tests
 */

import { ContextOptimizerHook } from '../../../../src/core/hooks/context-optimizer/context-optimizer.hook';
import { HookEvent, HookAction, HookContext } from '../../../../src/core/interfaces/hook.interface';
import type { TaskAfterContext } from '../../../../src/core/hooks/self-check/self-check.hook';

function createMockContextManager(qualityLevel: string, compressResult?: { compressed: string; originalTokens: number; compressedTokens: number }) {
  return {
    getQualityLevel: jest.fn().mockReturnValue(qualityLevel),
    optimizeOutput: jest.fn().mockResolvedValue(compressResult || { compressed: 'optimized', originalTokens: 100, compressedTokens: 50 }),
    on: jest.fn(),
    off: jest.fn(),
    dispose: jest.fn(),
  } as any;
}

function createAfterContext(resultContent?: string | object): HookContext<TaskAfterContext> {
  return {
    event: HookEvent.TASK_AFTER,
    timestamp: new Date(),
    source: 'test',
    data: {
      task: {
        metadata: {
          id: 'task-1',
          title: 'Test task',
          type: 'feature',
          from: 'orchestrator',
          to: 'development',
          priority: 'medium',
          status: 'completed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dependencies: [],
          files: [],
          retryCount: 0,
          maxRetries: 3,
          tags: [],
        },
        content: 'Test task',
      } as any,
      result: {
        success: true,
        result: resultContent !== undefined ? resultContent : 'Task completed with detailed output',
      },
    },
  };
}

describe('ContextOptimizerHook', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have correct metadata', () => {
    const hook = new ContextOptimizerHook(createMockContextManager('peak'));
    expect(hook.name).toBe('context-optimizer');
    expect(hook.event).toBe(HookEvent.TASK_AFTER);
    expect(hook.priority).toBe(50);
  });

  it('should CONTINUE (no-op) when quality is peak', async () => {
    const mgr = createMockContextManager('peak');
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext());
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(mgr.optimizeOutput).not.toHaveBeenCalled();
  });

  it('should CONTINUE (no-op) when quality is good', async () => {
    const mgr = createMockContextManager('good');
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext());
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(mgr.optimizeOutput).not.toHaveBeenCalled();
  });

  it('should MODIFY when quality is degrading', async () => {
    const mgr = createMockContextManager('degrading', {
      compressed: 'shorter output',
      originalTokens: 100,
      compressedTokens: 50,
    });
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext('long output'));
    expect(result.action).toBe(HookAction.MODIFY);
    expect(result.message).toContain('degrading');
    expect(result.message).toContain('100');
    expect(result.message).toContain('50');
  });

  it('should CONTINUE on optimization error (graceful degradation)', async () => {
    const mgr = createMockContextManager('poor');
    mgr.optimizeOutput.mockRejectedValue(new Error('optimization failed'));
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext());
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  // ── New: quality level behavior ──────────

  it('should optimize when quality is poor', async () => {
    const mgr = createMockContextManager('poor', {
      compressed: 'minimal output',
      originalTokens: 200,
      compressedTokens: 80,
    });
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext('verbose output'));
    expect(result.action).toBe(HookAction.MODIFY);
    expect(mgr.optimizeOutput).toHaveBeenCalledWith('verbose output');
    expect(result.message).toContain('poor');
    expect(result.message).toContain('200');
    expect(result.message).toContain('80');
  });

  it('should pass string output directly to optimizeOutput', async () => {
    const mgr = createMockContextManager('degrading', {
      compressed: 'compressed',
      originalTokens: 50,
      compressedTokens: 25,
    });
    const hook = new ContextOptimizerHook(mgr);
    await hook.execute(createAfterContext('raw string output'));
    expect(mgr.optimizeOutput).toHaveBeenCalledWith('raw string output');
  });

  it('should JSON.stringify non-string output before optimizing', async () => {
    const mgr = createMockContextManager('degrading', {
      compressed: '{"short":true}',
      originalTokens: 50,
      compressedTokens: 20,
    });
    const hook = new ContextOptimizerHook(mgr);
    const objResult = { detailed: true, data: [1, 2, 3] };
    await hook.execute(createAfterContext(objResult));
    expect(mgr.optimizeOutput).toHaveBeenCalledWith(JSON.stringify(objResult));
  });

  // ── New: no-change and empty output handling ──────────

  it('should CONTINUE when compressed output equals original', async () => {
    const originalText = 'already optimized';
    const mgr = createMockContextManager('degrading', {
      compressed: originalText,
      originalTokens: 10,
      compressedTokens: 10,
    });
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext(originalText));
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  it('should CONTINUE when output is empty string', async () => {
    const mgr = createMockContextManager('degrading');
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext(''));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(mgr.optimizeOutput).not.toHaveBeenCalled();
  });

  it('should CONTINUE when optimizeOutput returns null', async () => {
    const mgr = createMockContextManager('degrading');
    mgr.optimizeOutput.mockResolvedValue(null);
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext('some output'));
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  // ── New: modified data structure ──────────

  it('should include compressed result in MODIFY data', async () => {
    const mgr = createMockContextManager('degrading', {
      compressed: 'compressed content',
      originalTokens: 150,
      compressedTokens: 75,
    });
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext('original content'));
    expect(result.action).toBe(HookAction.MODIFY);
    const modified = result.data as any;
    expect(modified.result.result).toBe('compressed content');
    expect(modified.result.success).toBe(true);
  });

  it('should preserve task in modified data', async () => {
    const mgr = createMockContextManager('poor', {
      compressed: 'short',
      originalTokens: 100,
      compressedTokens: 20,
    });
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext('long output'));
    expect(result.action).toBe(HookAction.MODIFY);
    const modified = result.data as any;
    expect(modified.task.metadata.id).toBe('task-1');
  });

  // ── New: message format ──────────

  it('should format message with quality level and token counts', async () => {
    const mgr = createMockContextManager('degrading', {
      compressed: 'shorter',
      originalTokens: 500,
      compressedTokens: 200,
    });
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext('long text'));
    expect(result.message).toMatch(/Context quality degrading.*500.*200/);
  });

  // ── New: hook configuration ──────────

  it('should accept custom priority', () => {
    const mgr = createMockContextManager('peak');
    const hook = new ContextOptimizerHook(mgr, { priority: 10 });
    expect(hook.priority).toBe(10);
  });

  it('should report correct description', () => {
    const mgr = createMockContextManager('peak');
    const hook = new ContextOptimizerHook(mgr);
    expect(hook.description).toBe('Optimize output based on context budget');
  });

  // ── New: edge cases ──────────

  it('should handle getQualityLevel throwing (graceful degradation)', async () => {
    const mgr = createMockContextManager('peak');
    mgr.getQualityLevel.mockImplementation(() => { throw new Error('quality check failed'); });
    const hook = new ContextOptimizerHook(mgr);
    const result = await hook.execute(createAfterContext());
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  it('should not call optimizeOutput for peak quality even with large output', async () => {
    const mgr = createMockContextManager('peak');
    const hook = new ContextOptimizerHook(mgr);
    const largeOutput = 'x'.repeat(10000);
    const result = await hook.execute(createAfterContext(largeOutput));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(mgr.optimizeOutput).not.toHaveBeenCalled();
  });

  it('should handle numeric result via JSON.stringify', async () => {
    const mgr = createMockContextManager('degrading', {
      compressed: '42',
      originalTokens: 5,
      compressedTokens: 2,
    });
    const hook = new ContextOptimizerHook(mgr);
    // Pass a number as result - it should be JSON.stringified
    await hook.execute(createAfterContext(42 as any));
    expect(mgr.optimizeOutput).toHaveBeenCalledWith('42');
  });
});
