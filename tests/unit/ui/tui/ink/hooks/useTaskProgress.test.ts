/**
 * Tests for useTaskProgress React hook
 */

import React from 'react';
import { render, act } from 'ink-testing-library';
import { Text } from 'ink';
import { useTaskProgress } from '@/ui/tui/ink/hooks/useTaskProgress';
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

function makeMsg(taskId: string, payload: Record<string, unknown> = {}): ACPMessage {
  return {
    id: `msg-${taskId}`,
    type: 'task:status',
    source: 'runner',
    target: 'broadcast',
    payload: { taskId, ...payload },
    priority: 'normal',
    timestamp: '2026-02-15T14:00:00Z',
  };
}

function TestComponent({ bus }: { bus: IACPMessageBus }) {
  const tasks = useTaskProgress(bus);
  return React.createElement(
    Text,
    null,
    `tasks:${tasks.map((t) => `${t.taskId}:${t.status}`).join(',')}`,
  );
}

describe('useTaskProgress', () => {
  it('should start with empty tasks', () => {
    const bus = createMockBus();
    const { lastFrame } = render(React.createElement(TestComponent, { bus }));
    expect(lastFrame()).toBe('tasks:');
  });

  it('should subscribe to task:status on mount', () => {
    const bus = createMockBus();
    render(React.createElement(TestComponent, { bus }));
    expect(bus.on).toHaveBeenCalledWith('task:status', expect.any(Function));
  });

  it('should update when task status messages arrive', async () => {
    const bus = createMockBus();
    const { lastFrame } = render(React.createElement(TestComponent, { bus }));

    await act(async () => {
      await bus.publish(makeMsg('task-1', { name: 'Build', status: 'running', progress: 50 }));
    });

    expect(lastFrame()).toBe('tasks:task-1:running');
  });

  it('should handle multiple tasks', async () => {
    const bus = createMockBus();
    const { lastFrame } = render(React.createElement(TestComponent, { bus }));

    await act(async () => {
      await bus.publish(makeMsg('t1', { status: 'running' }));
      await bus.publish(makeMsg('t2', { status: 'completed' }));
    });

    expect(lastFrame()).toBe('tasks:t1:running,t2:completed');
  });

  it('should merge partial updates for existing tasks', async () => {
    const bus = createMockBus();

    function DetailComponent({ bus: b }: { bus: IACPMessageBus }) {
      const tasks = useTaskProgress(b);
      const t = tasks[0];
      return React.createElement(
        Text,
        null,
        t ? `${t.name}:${t.progress}` : 'none',
      );
    }

    const { lastFrame } = render(React.createElement(DetailComponent, { bus }));

    await act(async () => {
      await bus.publish(makeMsg('t1', { name: 'Build API', status: 'running', progress: 20 }));
    });
    expect(lastFrame()).toBe('Build API:20');

    await act(async () => {
      await bus.publish(makeMsg('t1', { progress: 90 }));
    });
    expect(lastFrame()).toBe('Build API:90');
  });
});
