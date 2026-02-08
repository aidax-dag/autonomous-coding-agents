/**
 * ErrorLearningHook Unit Tests
 */

import { ErrorLearningHook, TaskErrorContext } from '../../../../src/core/hooks/error-learning/error-learning.hook';
import { HookEvent, HookAction, HookContext } from '../../../../src/core/interfaces/hook.interface';
import type { TaskDocument } from '../../../../src/core/workspace/task-document';

function createMockReflexion(knownSolution?: { solution: string; prevention: string[] }) {
  return {
    lookup: jest.fn().mockResolvedValue(knownSolution || null),
    learn: jest.fn().mockResolvedValue(undefined),
    getPreventionChecklist: jest.fn().mockReturnValue([]),
    recordOutcome: jest.fn(),
    getStats: jest.fn(),
  } as any;
}

function createMockCache() {
  return {
    set: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    dispose: jest.fn(),
  } as any;
}

function createErrorContext(error: Error): HookContext<TaskErrorContext> {
  const task: TaskDocument = {
    metadata: {
      id: 'task-1',
      title: 'Test task',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      priority: 'medium',
      status: 'failed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dependencies: [],
      files: [],
      retryCount: 0,
      maxRetries: 3,
      tags: [],
    },
    content: 'Test task',
  } as any;

  return {
    event: HookEvent.TASK_ERROR,
    timestamp: new Date(),
    source: 'test',
    data: { task, error },
  };
}

describe('ErrorLearningHook', () => {
  it('should have correct metadata', () => {
    const hook = new ErrorLearningHook(createMockReflexion(), null);
    expect(hook.name).toBe('error-learning');
    expect(hook.event).toBe(HookEvent.TASK_ERROR);
    expect(hook.priority).toBe(100);
  });

  it('should CONTINUE with known solution message', async () => {
    const reflexion = createMockReflexion({ solution: 'Fix the import path', prevention: ['Check imports'] });
    const hook = new ErrorLearningHook(reflexion, null);
    const result = await hook.execute(createErrorContext(new Error('Module not found')));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('Known error pattern');
    expect(result.message).toContain('Fix the import path');
  });

  it('should learn from unknown errors', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    const error = new Error('ENOENT: no such file');
    const result = await hook.execute(createErrorContext(error));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(reflexion.learn).toHaveBeenCalledWith(error, 'pending', 'FILE');
    expect(result.message).toContain('New error learned');
  });

  it('should cache solution when cache is available', async () => {
    const reflexion = createMockReflexion();
    const cache = createMockCache();
    const hook = new ErrorLearningHook(reflexion, cache);
    await hook.execute(createErrorContext(new Error('network error')));
    expect(cache.set).toHaveBeenCalled();
  });

  it('should CONTINUE on reflexion error (graceful degradation)', async () => {
    const reflexion = { lookup: jest.fn().mockRejectedValue(new Error('storage error')) } as any;
    const hook = new ErrorLearningHook(reflexion, null);
    const result = await hook.execute(createErrorContext(new Error('some error')));
    expect(result.action).toBe(HookAction.CONTINUE);
  });
});
