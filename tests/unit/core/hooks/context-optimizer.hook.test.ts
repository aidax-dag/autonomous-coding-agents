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

function createAfterContext(resultContent?: string): HookContext<TaskAfterContext> {
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
        result: resultContent || 'Task completed with detailed output',
      },
    },
  };
}

describe('ContextOptimizerHook', () => {
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
});
