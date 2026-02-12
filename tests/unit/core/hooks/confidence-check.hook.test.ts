/**
 * ConfidenceCheckHook Unit Tests
 */

import { ConfidenceCheckHook } from '../../../../src/core/hooks/confidence-check/confidence-check.hook';
import { HookEvent, HookAction, HookContext } from '../../../../src/core/interfaces/hook.interface';
import type { TaskDocument } from '../../../../src/core/workspace/task-document';

// Mock ConfidenceChecker
function createMockChecker(result: { score: number; passed: boolean; recommendation: string; threshold: number; explanation?: string }) {
  return {
    check: jest.fn().mockResolvedValue({ ...result, items: [] }),
    setCheckItems: jest.fn(),
    setThresholds: jest.fn(),
  } as any;
}

function createTaskContext(task: TaskDocument): HookContext<TaskDocument> {
  return {
    event: HookEvent.TASK_BEFORE,
    timestamp: new Date(),
    source: 'test',
    data: task,
  };
}

const mockTask: TaskDocument = {
  metadata: {
    id: 'task-1',
    title: 'Test task',
    type: 'feature',
    from: 'orchestrator',
    to: 'development',
    priority: 'medium',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dependencies: [],
    files: [],
    retryCount: 0,
    maxRetries: 3,
    tags: [],
  },
  content: 'Test task content',
} as any;

describe('ConfidenceCheckHook', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should have correct metadata', () => {
    const hook = new ConfidenceCheckHook(createMockChecker({ score: 100, passed: true, recommendation: 'proceed', threshold: 90 }));
    expect(hook.name).toBe('confidence-check');
    expect(hook.event).toBe(HookEvent.TASK_BEFORE);
    expect(hook.priority).toBe(200);
  });

  it('should CONTINUE when recommendation is proceed', async () => {
    const checker = createMockChecker({ score: 95, passed: true, recommendation: 'proceed', threshold: 90 });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.data).toBeDefined();
  });

  it('should ABORT when recommendation is stop', async () => {
    const checker = createMockChecker({ score: 50, passed: false, recommendation: 'stop', threshold: 90, explanation: 'Too risky' });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.ABORT);
    expect(result.message).toContain('Confidence too low');
    expect(result.message).toContain('50');
  });

  it('should CONTINUE with warning when recommendation is alternatives', async () => {
    const checker = createMockChecker({ score: 75, passed: false, recommendation: 'alternatives', threshold: 90 });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('marginal');
    expect(result.data).toBeDefined();
  });

  it('should CONTINUE on checker error (graceful degradation)', async () => {
    const checker = { check: jest.fn().mockRejectedValue(new Error('checker failed')), setCheckItems: jest.fn(), setThresholds: jest.fn() } as any;
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  // ── New: confidence threshold checks ──────────

  it('should include threshold in ABORT message', async () => {
    const checker = createMockChecker({ score: 30, passed: false, recommendation: 'stop', threshold: 80 });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.ABORT);
    expect(result.message).toContain('30');
    expect(result.message).toContain('80');
  });

  it('should include explanation in ABORT message when provided', async () => {
    const checker = createMockChecker({
      score: 20,
      passed: false,
      recommendation: 'stop',
      threshold: 90,
      explanation: 'Missing test coverage data',
    });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.ABORT);
    expect(result.message).toContain('Missing test coverage data');
  });

  it('should use fallback text in ABORT message when no explanation', async () => {
    const checker = createMockChecker({
      score: 10,
      passed: false,
      recommendation: 'stop',
      threshold: 90,
    });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.ABORT);
    expect(result.message).toContain('Task blocked by pre-execution validation');
  });

  it('should include score and threshold in alternatives message', async () => {
    const checker = createMockChecker({
      score: 65,
      passed: false,
      recommendation: 'alternatives',
      threshold: 80,
    });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.message).toContain('65');
    expect(result.message).toContain('80');
    expect(result.message).toContain('Consider alternatives');
  });

  it('should not include a message when recommendation is proceed', async () => {
    const checker = createMockChecker({ score: 100, passed: true, recommendation: 'proceed', threshold: 90 });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toBeUndefined();
  });

  // ── New: TaskDocument to TaskContext conversion ──────────

  it('should pass taskId from metadata to checker', async () => {
    const checker = createMockChecker({ score: 90, passed: true, recommendation: 'proceed', threshold: 80 });
    const hook = new ConfidenceCheckHook(checker);
    await hook.execute(createTaskContext(mockTask));

    expect(checker.check).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-1',
        taskType: 'feature',
        description: 'Test task content',
      }),
    );
  });

  it('should map files paths to checker context', async () => {
    const checker = createMockChecker({ score: 90, passed: true, recommendation: 'proceed', threshold: 80 });
    const hook = new ConfidenceCheckHook(checker);

    const taskWithFiles: TaskDocument = {
      ...mockTask,
      metadata: {
        ...mockTask.metadata,
        files: [{ path: 'src/auth.ts' }, { path: 'src/db.ts' }],
      },
    } as any;

    await hook.execute(createTaskContext(taskWithFiles));

    expect(checker.check).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ['src/auth.ts', 'src/db.ts'],
      }),
    );
  });

  it('should map dependency taskIds to checker context', async () => {
    const checker = createMockChecker({ score: 90, passed: true, recommendation: 'proceed', threshold: 80 });
    const hook = new ConfidenceCheckHook(checker);

    const taskWithDeps: TaskDocument = {
      ...mockTask,
      metadata: {
        ...mockTask.metadata,
        dependencies: [{ taskId: 'dep-1' }, { taskId: 'dep-2' }],
      },
    } as any;

    await hook.execute(createTaskContext(taskWithDeps));

    expect(checker.check).toHaveBeenCalledWith(
      expect.objectContaining({
        dependencies: ['dep-1', 'dep-2'],
      }),
    );
  });

  it('should handle task with no files or dependencies', async () => {
    const checker = createMockChecker({ score: 90, passed: true, recommendation: 'proceed', threshold: 80 });
    const hook = new ConfidenceCheckHook(checker);

    const minimalTask: TaskDocument = {
      metadata: {
        id: 'task-min',
        title: 'Minimal',
        type: 'bugfix',
        from: 'orchestrator',
        to: 'development',
        priority: 'low',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 3,
        tags: [],
      },
      content: 'Minimal task',
    } as any;

    const result = await hook.execute(createTaskContext(minimalTask));
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  // ── New: hook configuration ──────────

  it('should accept custom priority', () => {
    const checker = createMockChecker({ score: 100, passed: true, recommendation: 'proceed', threshold: 90 });
    const hook = new ConfidenceCheckHook(checker, { priority: 500 });
    expect(hook.priority).toBe(500);
  });

  it('should report correct description', () => {
    const checker = createMockChecker({ score: 100, passed: true, recommendation: 'proceed', threshold: 90 });
    const hook = new ConfidenceCheckHook(checker);
    expect(hook.description).toBe('Pre-execution confidence validation');
  });

  // ── New: default case handling ──────────

  it('should CONTINUE for unknown recommendation values (default case)', async () => {
    const checker = createMockChecker({ score: 80, passed: true, recommendation: 'unknown-value', threshold: 70 });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    // The default case in switch falls through to 'proceed'
    expect(result.action).toBe(HookAction.CONTINUE);
  });

  it('should return check result data on proceed', async () => {
    const checker = createMockChecker({ score: 95, passed: true, recommendation: 'proceed', threshold: 80 });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.data).toEqual(
      expect.objectContaining({
        score: 95,
        passed: true,
        recommendation: 'proceed',
        threshold: 80,
      }),
    );
  });

  it('should return check result data on alternatives', async () => {
    const checker = createMockChecker({ score: 60, passed: false, recommendation: 'alternatives', threshold: 80 });
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.data).toEqual(
      expect.objectContaining({
        score: 60,
        recommendation: 'alternatives',
      }),
    );
  });

  it('should not return data on graceful degradation', async () => {
    const checker = { check: jest.fn().mockRejectedValue(new Error('boom')), setCheckItems: jest.fn(), setThresholds: jest.fn() } as any;
    const hook = new ConfidenceCheckHook(checker);
    const result = await hook.execute(createTaskContext(mockTask));
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.data).toBeUndefined();
  });
});
