/**
 * Tests for AgentStatusHook
 */

import { AgentStatusHook, createAgentStatusHook } from '@/ui/tui/hooks/use-agent-status';
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

function makeAgentStatusMessage(
  agentId: string,
  payload: Record<string, unknown> = {},
): ACPMessage {
  return {
    id: `msg-${agentId}`,
    type: 'agent:status',
    source: 'system',
    target: 'tui',
    payload: { agentId, ...payload },
    priority: 'normal',
    timestamp: '2026-02-13T14:00:00Z',
  };
}

describe('AgentStatusHook', () => {
  it('should connect and disconnect', () => {
    const bus = createMockBus();
    const hook = new AgentStatusHook(bus);

    expect(hook.isConnected()).toBe(false);
    hook.connect();
    expect(hook.isConnected()).toBe(true);
    expect(bus.on).toHaveBeenCalledWith('agent:status', expect.any(Function));

    // Connecting again should be a no-op
    hook.connect();
    expect(bus.on).toHaveBeenCalledTimes(1);

    hook.disconnect();
    expect(hook.isConnected()).toBe(false);
  });

  it('should receive agent status updates', async () => {
    const bus = createMockBus();
    const hook = new AgentStatusHook(bus);
    hook.connect();

    await bus.publish(makeAgentStatusMessage('agent-1', {
      agentType: 'coder',
      state: 'working',
      progress: 50,
      tokensUsed: 1000,
      elapsedMs: 5000,
    }));

    const agents = hook.getAgentList();
    expect(agents).toHaveLength(1);
    expect(agents[0].agentId).toBe('agent-1');
    expect(agents[0].agentType).toBe('coder');
    expect(agents[0].state).toBe('working');
    expect(agents[0].progress).toBe(50);
  });

  it('should merge partial updates for existing agents', async () => {
    const bus = createMockBus();
    const hook = new AgentStatusHook(bus);
    hook.connect();

    // First update sets full state
    await bus.publish(makeAgentStatusMessage('agent-1', {
      agentType: 'coder',
      state: 'working',
      progress: 30,
      tokensUsed: 500,
      elapsedMs: 2000,
    }));

    // Partial update only changes progress
    await bus.publish(makeAgentStatusMessage('agent-1', {
      progress: 80,
    }));

    const agents = hook.getAgentList();
    expect(agents).toHaveLength(1);
    expect(agents[0].agentType).toBe('coder'); // preserved
    expect(agents[0].state).toBe('working');   // preserved
    expect(agents[0].progress).toBe(80);        // updated
  });

  it('should notify onChange listeners', async () => {
    const bus = createMockBus();
    const hook = new AgentStatusHook(bus);
    hook.connect();

    const states: unknown[] = [];
    const unsub = hook.onChange((state) => { states.push(state); });

    await bus.publish(makeAgentStatusMessage('agent-1', { state: 'working' }));
    await bus.publish(makeAgentStatusMessage('agent-2', { state: 'idle' }));

    expect(states).toHaveLength(2);

    unsub();
    await bus.publish(makeAgentStatusMessage('agent-3', { state: 'error' }));
    expect(states).toHaveLength(2); // no more updates after unsub
  });

  it('should return agent list and state snapshot', async () => {
    const bus = createMockBus();
    const hook = new AgentStatusHook(bus);
    hook.connect();

    await bus.publish(makeAgentStatusMessage('a1', { agentType: 'coder', state: 'working' }));
    await bus.publish(makeAgentStatusMessage('a2', { agentType: 'reviewer', state: 'idle' }));

    const state = hook.getState();
    expect(state.agents.size).toBe(2);
    expect(state.lastUpdate).toBe('2026-02-13T14:00:00Z');

    const list = hook.getAgentList();
    expect(list).toHaveLength(2);
    expect(list.map(a => a.agentId).sort()).toEqual(['a1', 'a2']);
  });

  it('should be created via factory function', () => {
    const bus = createMockBus();
    const hook = createAgentStatusHook(bus);
    expect(hook).toBeInstanceOf(AgentStatusHook);
  });
});
