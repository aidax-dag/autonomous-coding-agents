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
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  // ── New: error classification tests ──────────

  it('should classify syntax errors as SYNTAX', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('SyntaxError: Unexpected token')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'SYNTAX',
    );
  });

  it('should classify parse errors as SYNTAX', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('Failed to parse JSON')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'SYNTAX',
    );
  });

  it('should classify type errors as TYPE', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('TypeError: cannot read property')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'TYPE',
    );
  });

  it('should classify network errors as NETWORK', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('ECONNREFUSED 127.0.0.1:3000')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'NETWORK',
    );
  });

  it('should classify fetch errors as NETWORK', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('fetch failed: network timeout')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'NETWORK',
    );
  });

  it('should classify file system errors as FILE', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('ENOENT: no such file or directory')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'FILE',
    );
  });

  it('should classify path errors as FILE', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('Invalid path specified')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'FILE',
    );
  });

  it('should classify timeout errors as RUNTIME', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('Operation timeout after 30s')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'RUNTIME',
    );
  });

  it('should classify validation errors as VALIDATION', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('Validation failed: invalid email')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'VALIDATION',
    );
  });

  it('should classify auth errors as AUTH', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('Permission denied: forbidden access')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'AUTH',
    );
  });

  it('should classify config errors as CONFIG', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('Missing config: DATABASE_URL env variable')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'CONFIG',
    );
  });

  it('should classify unknown errors as RUNTIME', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('Something completely unexpected')));
    expect(reflexion.learn).toHaveBeenCalledWith(
      expect.any(Error),
      'pending',
      'RUNTIME',
    );
  });

  // ── New: cache behavior tests ──────────

  it('should include rootCause in cache entry', async () => {
    const reflexion = createMockReflexion();
    const cache = createMockCache();
    const hook = new ErrorLearningHook(reflexion, cache);
    await hook.execute(createErrorContext(new Error('SyntaxError: bad token')));

    expect(cache.set).toHaveBeenCalledWith(
      expect.objectContaining({
        rootCause: 'SYNTAX',
        errorType: 'SYNTAX',
        signature: 'SyntaxError: bad token',
        solution: 'pending',
        prevention: [],
        hits: 1,
        successCount: 0,
        failureCount: 0,
      }),
    );
  });

  it('should CONTINUE even when cache.set fails', async () => {
    const reflexion = createMockReflexion();
    const cache = createMockCache();
    cache.set.mockRejectedValue(new Error('cache write failed'));
    const hook = new ErrorLearningHook(reflexion, cache);
    const result = await hook.execute(createErrorContext(new Error('some error')));
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  it('should not call cache when solutionsCache is null', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    const result = await hook.execute(createErrorContext(new Error('any error')));
    expect(result.action).toBe(HookAction.CONTINUE);
    // No assertion on cache.set because cache is null - test that it doesn't throw
  });

  // ── New: known solution message includes prevention ──────────

  it('should include prevention steps in known solution message', async () => {
    const reflexion = createMockReflexion({
      solution: 'Add null check',
      prevention: ['Validate inputs', 'Use TypeScript strict mode'],
    });
    const hook = new ErrorLearningHook(reflexion, null);
    const result = await hook.execute(createErrorContext(new Error('Cannot read property of null')));
    expect(result.message).toContain('Validate inputs');
    expect(result.message).toContain('Use TypeScript strict mode');
  });

  it('should not call learn when solution is already known', async () => {
    const reflexion = createMockReflexion({ solution: 'Known fix', prevention: ['Do X'] });
    const hook = new ErrorLearningHook(reflexion, null);
    await hook.execute(createErrorContext(new Error('known issue')));
    expect(reflexion.learn).not.toHaveBeenCalled();
  });

  // ── New: hook configuration tests ──────────

  it('should accept custom priority via config', () => {
    const hook = new ErrorLearningHook(createMockReflexion(), null, { priority: 50 });
    expect(hook.priority).toBe(50);
  });

  it('should report correct description', () => {
    const hook = new ErrorLearningHook(createMockReflexion(), null);
    expect(hook.description).toBe('Learn from task errors via ReflexionPattern');
  });

  it('should include error message in new-error-learned response', async () => {
    const reflexion = createMockReflexion();
    const hook = new ErrorLearningHook(reflexion, null);
    const result = await hook.execute(createErrorContext(new Error('Custom failure message')));
    expect(result.message).toContain('Custom failure message');
  });
});
