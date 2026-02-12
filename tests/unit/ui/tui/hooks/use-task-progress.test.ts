/**
 * Tests for TaskProgressHook
 */

import { TaskProgressHook, createTaskProgressHook } from '@/ui/tui/hooks/use-task-progress';
import type { IACPMessageBus, ACPMessage, ACPMessageType, ACPHandler } from '@/core/protocols';

function createMockBus(): IACPMessageBus {
  const handlers = new Map<string, ACPHandler[]>();
  return {
    publish: jest.fn(async (msg: ACPMessage) => {
      const list = handlers.get(msg.type) || [];
      for (const h of list) await h(msg);
    }),
    on: jest.fn((type: ACPMessageType, handler: ACPHandler) => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
      return {
        unsubscribe: () => {
          const list = handlers.get(type)!;
          const idx = list.indexOf(handler);
          if (idx >= 0) list.splice(idx, 1);
        },
      };
    }),
    subscribe: jest.fn(() => ({ unsubscribe: jest.fn() })),
    request: jest.fn(),
    subscriptionCount: jest.fn(() => 0),
    clear: jest.fn(),
  };
}

function makeTaskStatusMessage(
  taskId: string,
  payload: Record<string, unknown> = {},
): ACPMessage {
  return {
    id: `msg-${taskId}`,
    type: 'task:status',
    source: 'system',
    target: 'tui',
    payload: { taskId, ...payload },
    priority: 'normal',
    timestamp: '2026-02-13T15:00:00Z',
  };
}

describe('TaskProgressHook', () => {
  it('should connect and disconnect', () => {
    const bus = createMockBus();
    const hook = new TaskProgressHook(bus);

    expect(hook.isConnected()).toBe(false);
    hook.connect();
    expect(hook.isConnected()).toBe(true);
    expect(bus.on).toHaveBeenCalledWith('task:status', expect.any(Function));

    hook.disconnect();
    expect(hook.isConnected()).toBe(false);
  });

  it('should receive task updates', async () => {
    const bus = createMockBus();
    const hook = new TaskProgressHook(bus);
    hook.connect();

    await bus.publish(makeTaskStatusMessage('task-1', {
      name: 'Build auth',
      status: 'running',
      progress: 45,
    }));

    const tasks = hook.getTaskList();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].taskId).toBe('task-1');
    expect(tasks[0].name).toBe('Build auth');
    expect(tasks[0].status).toBe('running');
    expect(tasks[0].progress).toBe(45);
  });

  it('should compute overall progress', async () => {
    const bus = createMockBus();
    const hook = new TaskProgressHook(bus);
    hook.connect();

    await bus.publish(makeTaskStatusMessage('t1', { name: 'A', progress: 100, status: 'completed' }));
    await bus.publish(makeTaskStatusMessage('t2', { name: 'B', progress: 50, status: 'running' }));
    await bus.publish(makeTaskStatusMessage('t3', { name: 'C', progress: 0, status: 'pending' }));

    expect(hook.getOverallProgress()).toBe(50); // (100+50+0)/3 = 50
  });

  it('should count completed tasks', async () => {
    const bus = createMockBus();
    const hook = new TaskProgressHook(bus);
    hook.connect();

    await bus.publish(makeTaskStatusMessage('t1', { status: 'completed', progress: 100 }));
    await bus.publish(makeTaskStatusMessage('t2', { status: 'running', progress: 30 }));
    await bus.publish(makeTaskStatusMessage('t3', { status: 'completed', progress: 100 }));

    expect(hook.getCompletedCount()).toBe(2);
  });

  it('should notify onChange listeners', async () => {
    const bus = createMockBus();
    const hook = new TaskProgressHook(bus);
    hook.connect();

    const updates: unknown[] = [];
    const unsub = hook.onChange((state) => { updates.push(state); });

    await bus.publish(makeTaskStatusMessage('t1', { name: 'Task 1', status: 'running' }));
    expect(updates).toHaveLength(1);

    unsub();
    await bus.publish(makeTaskStatusMessage('t2', { name: 'Task 2', status: 'running' }));
    expect(updates).toHaveLength(1); // no more updates after unsub
  });

  it('should merge partial task updates', async () => {
    const bus = createMockBus();
    const hook = new TaskProgressHook(bus);
    hook.connect();

    await bus.publish(makeTaskStatusMessage('t1', {
      name: 'Auth module',
      status: 'running',
      progress: 20,
    }));

    await bus.publish(makeTaskStatusMessage('t1', {
      progress: 80,
    }));

    const tasks = hook.getTaskList();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('Auth module'); // preserved
    expect(tasks[0].progress).toBe(80);         // updated
  });

  it('should return zero progress when no tasks', () => {
    const bus = createMockBus();
    const hook = new TaskProgressHook(bus);
    expect(hook.getOverallProgress()).toBe(0);
  });

  it('should be created via factory function', () => {
    const bus = createMockBus();
    const hook = createTaskProgressHook(bus);
    expect(hook).toBeInstanceOf(TaskProgressHook);
  });
});
