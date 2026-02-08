/**
 * SelfCheckHook Unit Tests
 */

import { SelfCheckHook, TaskAfterContext } from '../../../../src/core/hooks/self-check/self-check.hook';
import { HookEvent, HookAction, HookContext } from '../../../../src/core/interfaces/hook.interface';
import type { TaskDocument } from '../../../../src/core/workspace/task-document';
import type { TaskHandlerResult } from '../../../../src/core/orchestrator/team-agent';

function createMockProtocol(result: { passed: boolean; questions: any[]; dangerSignals: any[] }) {
  return {
    check: jest.fn().mockResolvedValue(result),
    scanForDangerSignals: jest.fn().mockReturnValue([]),
    setQuestions: jest.fn(),
    setDangerSignals: jest.fn(),
  } as any;
}

function createAfterContext(overrides?: Partial<TaskAfterContext>): HookContext<TaskAfterContext> {
  const task: TaskDocument = {
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
  } as any;

  const result: TaskHandlerResult = {
    success: true,
    result: 'Task completed successfully',
  };

  return {
    event: HookEvent.TASK_AFTER,
    timestamp: new Date(),
    source: 'test',
    data: { task, result, ...overrides },
  };
}

describe('SelfCheckHook', () => {
  it('should have correct metadata', () => {
    const hook = new SelfCheckHook(createMockProtocol({ passed: true, questions: [], dangerSignals: [] }));
    expect(hook.name).toBe('self-check');
    expect(hook.event).toBe(HookEvent.TASK_AFTER);
    expect(hook.priority).toBe(200);
  });

  it('should CONTINUE when check passes', async () => {
    const protocol = createMockProtocol({ passed: true, questions: [], dangerSignals: [] });
    const hook = new SelfCheckHook(protocol);
    const result = await hook.execute(createAfterContext());
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.data).toBeDefined();
  });

  it('should CONTINUE with message when check fails (advisory)', async () => {
    const protocol = createMockProtocol({
      passed: false,
      questions: [{ id: 'tests_pass', passed: false }],
      dangerSignals: [{ signal: 'should work', found: true }],
    });
    const hook = new SelfCheckHook(protocol);
    const result = await hook.execute(createAfterContext());
    expect(result.action).toBe(HookAction.CONTINUE);
    expect(result.message).toContain('tests_pass');
    expect(result.message).toContain('should work');
  });

  it('should CONTINUE on protocol error (graceful degradation)', async () => {
    const protocol = { check: jest.fn().mockRejectedValue(new Error('protocol error')) } as any;
    const hook = new SelfCheckHook(protocol);
    const result = await hook.execute(createAfterContext());
    expect(result.action).toBe(HookAction.CONTINUE);
  });
});
