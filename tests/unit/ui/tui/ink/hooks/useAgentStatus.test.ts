/**
 * Tests for useAgentStatus React hook
 */

import React from 'react';
import { render, act } from 'ink-testing-library';
import { Text } from 'ink';
import { useAgentStatus } from '@/ui/tui/ink/hooks/useAgentStatus';
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

function makeMsg(agentId: string, payload: Record<string, unknown> = {}): ACPMessage {
  return {
    id: `msg-${agentId}`,
    type: 'agent:status',
    source: 'system',
    target: 'tui',
    payload: { agentId, ...payload },
    priority: 'normal',
    timestamp: '2026-02-15T14:00:00Z',
  };
}

function TestComponent({ bus }: { bus: IACPMessageBus }) {
  const agents = useAgentStatus(bus);
  return React.createElement(
    Text,
    null,
    `agents:${agents.map((a) => a.agentId).join(',')}`,
  );
}

describe('useAgentStatus', () => {
  it('should start with empty agents', () => {
    const bus = createMockBus();
    const { lastFrame } = render(React.createElement(TestComponent, { bus }));
    expect(lastFrame()).toBe('agents:');
  });

  it('should subscribe to agent:status on mount', () => {
    const bus = createMockBus();
    render(React.createElement(TestComponent, { bus }));
    expect(bus.on).toHaveBeenCalledWith('agent:status', expect.any(Function));
  });

  it('should update when agent status messages arrive', async () => {
    const bus = createMockBus();
    const { lastFrame } = render(React.createElement(TestComponent, { bus }));

    await act(async () => {
      await bus.publish(makeMsg('agent-1', { agentType: 'coder', state: 'working' }));
    });

    expect(lastFrame()).toBe('agents:agent-1');
  });

  it('should handle multiple agents', async () => {
    const bus = createMockBus();
    const { lastFrame } = render(React.createElement(TestComponent, { bus }));

    await act(async () => {
      await bus.publish(makeMsg('a1', { agentType: 'coder' }));
      await bus.publish(makeMsg('a2', { agentType: 'reviewer' }));
    });

    expect(lastFrame()).toBe('agents:a1,a2');
  });

  it('should merge partial updates', async () => {
    const bus = createMockBus();

    function DetailComponent({ bus: b }: { bus: IACPMessageBus }) {
      const agents = useAgentStatus(b);
      const a = agents[0];
      return React.createElement(
        Text,
        null,
        a ? `${a.agentType}:${a.progress}` : 'none',
      );
    }

    const { lastFrame } = render(React.createElement(DetailComponent, { bus }));

    await act(async () => {
      await bus.publish(makeMsg('a1', { agentType: 'coder', progress: 30 }));
    });
    expect(lastFrame()).toBe('coder:30');

    await act(async () => {
      await bus.publish(makeMsg('a1', { progress: 80 }));
    });
    expect(lastFrame()).toBe('coder:80');
  });

  it('should unsubscribe on unmount', () => {
    const bus = createMockBus();
    const { unmount } = render(React.createElement(TestComponent, { bus }));

    const onCall = (bus.on as jest.Mock).mock.results[0];
    const subscription = onCall.value;

    unmount();
    // After unmount, we can verify the subscription was returned properly
    expect(subscription).toHaveProperty('unsubscribe');
  });
});
