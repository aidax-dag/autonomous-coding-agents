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
});
