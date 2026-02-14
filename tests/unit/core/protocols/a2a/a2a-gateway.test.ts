/**
 * A2A Gateway & Router Tests
 */

import {
  A2AGateway,
  createA2AGateway,
  type A2AGatewayConfig,
} from '../../../../../src/core/protocols/a2a/a2a-gateway';
import {
  A2ARouter,
  createA2ARouter,
} from '../../../../../src/core/protocols/a2a/a2a-router';
import {
  ACPMessageBus,
} from '../../../../../src/core/protocols/acp-message-bus';
import type {
  AgentCard,
  A2AMessage,
  TaskDelegation,
  TaskCompletion,
} from '../../../../../src/core/protocols/a2a/types';
import type { ACPMessage } from '../../../../../src/core/protocols/interfaces/acp.interface';

// ── Helpers ──────────────────────────────────────────────────

function makeGatewayConfig(
  overrides: Partial<A2AGatewayConfig> = {},
): A2AGatewayConfig {
  return {
    agentId: 'test-agent',
    agentName: 'Test Agent',
    capabilities: [
      { name: 'code-review', description: 'Reviews code' },
      { name: 'testing', description: 'Runs tests' },
    ],
    ...overrides,
  };
}

function makePeerCard(overrides: Partial<AgentCard> = {}): AgentCard {
  return {
    id: 'peer-agent',
    name: 'Peer Agent',
    description: 'A remote peer agent',
    version: '1.0.0',
    capabilities: [
      { name: 'deployment', description: 'Deploys code' },
    ],
    endpoint: 'http://peer:8080',
    protocol: 'a2a-v1',
    status: 'available',
    ...overrides,
  };
}

function makeDelegation(overrides: Partial<TaskDelegation> = {}): TaskDelegation {
  return {
    taskId: 'task-001',
    description: 'Deploy to staging',
    priority: 'normal',
    ...overrides,
  };
}

function makeA2AMessage<T = unknown>(
  overrides: Partial<A2AMessage<T>> = {},
): A2AMessage<T> {
  return {
    id: `msg-${Date.now()}`,
    type: 'ping',
    from: 'remote-agent',
    to: 'test-agent',
    payload: {} as T,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── AgentCard & Discovery ────────────────────────────────────

describe('A2AGateway - Agent Discovery', () => {
  let gateway: A2AGateway;

  beforeEach(() => {
    gateway = new A2AGateway(makeGatewayConfig());
  });

  afterEach(() => {
    gateway.dispose();
  });

  it('should return correct agent card via getAgentCard()', () => {
    const card = gateway.getAgentCard();

    expect(card.id).toBe('test-agent');
    expect(card.name).toBe('Test Agent');
    expect(card.protocol).toBe('a2a-v1');
    expect(card.status).toBe('available');
    expect(card.capabilities).toHaveLength(2);
    expect(card.capabilities[0].name).toBe('code-review');
  });

  it('should register a peer', () => {
    const peer = makePeerCard();
    gateway.registerPeer(peer);

    expect(gateway.getPeers()).toHaveLength(1);
    expect(gateway.getPeers()[0].id).toBe('peer-agent');
  });

  it('should reject duplicate peer ID', () => {
    const peer = makePeerCard();
    gateway.registerPeer(peer);

    expect(() => gateway.registerPeer(peer)).toThrow(
      'Peer already registered: peer-agent',
    );
  });

  it('should unregister a peer and return false for unknown', () => {
    const peer = makePeerCard();
    gateway.registerPeer(peer);

    expect(gateway.unregisterPeer('peer-agent')).toBe(true);
    expect(gateway.getPeers()).toHaveLength(0);
    expect(gateway.unregisterPeer('nonexistent')).toBe(false);
  });

  it('should return all peers via getPeers()', () => {
    gateway.registerPeer(makePeerCard({ id: 'peer-1', name: 'Peer 1' }));
    gateway.registerPeer(makePeerCard({ id: 'peer-2', name: 'Peer 2' }));

    const peers = gateway.getPeers();
    expect(peers).toHaveLength(2);
    expect(peers.map((p) => p.id)).toEqual(['peer-1', 'peer-2']);
  });

  it('should find peers by capability', () => {
    gateway.registerPeer(
      makePeerCard({
        id: 'deployer',
        capabilities: [
          { name: 'deployment', description: 'Deploys' },
          { name: 'monitoring', description: 'Monitors' },
        ],
      }),
    );
    gateway.registerPeer(
      makePeerCard({
        id: 'tester',
        capabilities: [
          { name: 'testing', description: 'Tests' },
        ],
      }),
    );

    const deployers = gateway.findPeersByCapability('deployment');
    expect(deployers).toHaveLength(1);
    expect(deployers[0].id).toBe('deployer');

    const monitors = gateway.findPeersByCapability('monitoring');
    expect(monitors).toHaveLength(1);

    const none = gateway.findPeersByCapability('nonexistent');
    expect(none).toHaveLength(0);
  });
});

// ── Message Handling ─────────────────────────────────────────

describe('A2AGateway - Message Handling', () => {
  let gateway: A2AGateway;

  beforeEach(() => {
    gateway = new A2AGateway(makeGatewayConfig());
  });

  afterEach(() => {
    gateway.dispose();
  });

  it('should route message to correct handler', async () => {
    const received: A2AMessage[] = [];
    gateway.onMessage('discovery:request', async (msg) => {
      received.push(msg);
      return gateway.createMessage('discovery:response', msg.from, {
        agents: [],
      });
    });

    const msg = makeA2AMessage({ type: 'discovery:request' });
    const response = await gateway.handleMessage(msg);

    expect(received).toHaveLength(1);
    expect(response).not.toBeNull();
    expect(response!.type).toBe('discovery:response');
  });

  it('should return null for unregistered message type', async () => {
    const msg = makeA2AMessage({ type: 'discovery:request' });
    const response = await gateway.handleMessage(msg);
    expect(response).toBeNull();
  });

  it('should register handler via onMessage()', async () => {
    let called = false;
    gateway.onMessage('task:accept', async () => {
      called = true;
      return null;
    });

    await gateway.handleMessage(makeA2AMessage({ type: 'task:accept' }));
    expect(called).toBe(true);
  });

  it('should create well-formed message with ID and timestamp', () => {
    const msg = gateway.createMessage('ping', 'target-agent', { test: true });

    expect(msg.id).toMatch(/^a2a-\d+-\d+$/);
    expect(msg.type).toBe('ping');
    expect(msg.from).toBe('test-agent');
    expect(msg.to).toBe('target-agent');
    expect(msg.payload).toEqual({ test: true });
    expect(msg.timestamp).toBeDefined();
    expect(new Date(msg.timestamp).getTime()).not.toBeNaN();
  });

  it('should emit message:received event on handleMessage()', async () => {
    const events: A2AMessage[] = [];
    gateway.on('message:received', (msg) => events.push(msg));

    const msg = makeA2AMessage({ type: 'ping' });
    await gateway.handleMessage(msg);

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(msg.id);
  });

  it('should handle ping with pong response', async () => {
    const msg = makeA2AMessage({ type: 'ping', from: 'remote' });
    const response = await gateway.handleMessage(msg);

    expect(response).not.toBeNull();
    expect(response!.type).toBe('pong');
    expect(response!.from).toBe('test-agent');
    expect(response!.to).toBe('remote');
    expect(response!.payload).toEqual({
      agentId: 'test-agent',
      status: 'available',
    });
  });
});

// ── Task Delegation ──────────────────────────────────────────

describe('A2AGateway - Task Delegation', () => {
  let gateway: A2AGateway;

  beforeEach(() => {
    gateway = new A2AGateway(makeGatewayConfig());
    gateway.registerPeer(makePeerCard());
  });

  afterEach(() => {
    gateway.dispose();
  });

  it('should create task:delegate message', async () => {
    const delegation = makeDelegation();
    const message = await gateway.delegateTask('peer-agent', delegation);

    expect(message.type).toBe('task:delegate');
    expect(message.from).toBe('test-agent');
    expect(message.to).toBe('peer-agent');
    expect(message.payload).toEqual(delegation);
  });

  it('should store task in pendingTasks', async () => {
    const delegation = makeDelegation();
    await gateway.delegateTask('peer-agent', delegation);

    const pending = gateway.getPendingTasks();
    expect(pending).toHaveLength(1);
    expect(pending[0].taskId).toBe('task-001');
  });

  it('should throw when delegating to unknown peer', async () => {
    const delegation = makeDelegation();
    await expect(
      gateway.delegateTask('nonexistent', delegation),
    ).rejects.toThrow('Unknown peer: nonexistent');
  });

  it('should create task:complete message via completeTask()', () => {
    const completion: TaskCompletion = {
      taskId: 'task-001',
      success: true,
      result: { deployed: true },
      duration: 5000,
    };

    const message = gateway.completeTask('task-001', completion);

    expect(message.type).toBe('task:complete');
    expect(message.from).toBe('test-agent');
    expect(message.payload).toEqual(completion);
  });

  it('should remove task from pendingTasks on completeTask()', async () => {
    const delegation = makeDelegation();
    await gateway.delegateTask('peer-agent', delegation);
    expect(gateway.getPendingTasks()).toHaveLength(1);

    gateway.completeTask('task-001', {
      taskId: 'task-001',
      success: true,
      duration: 1000,
    });

    expect(gateway.getPendingTasks()).toHaveLength(0);
  });

  it('should return pending tasks via getPendingTasks()', async () => {
    await gateway.delegateTask('peer-agent', makeDelegation({ taskId: 't-1' }));
    await gateway.delegateTask('peer-agent', makeDelegation({ taskId: 't-2' }));

    const pending = gateway.getPendingTasks();
    expect(pending).toHaveLength(2);
    expect(pending.map((t) => t.taskId)).toEqual(['t-1', 't-2']);
  });

  it('should respect timeout on delegated tasks', async () => {
    jest.useFakeTimers();

    const delegation = makeDelegation({ taskId: 'timeout-task', timeout: 100 });
    await gateway.delegateTask('peer-agent', delegation);

    expect(gateway.getPendingTasks()).toHaveLength(1);

    jest.advanceTimersByTime(150);

    expect(gateway.getPendingTasks()).toHaveLength(0);

    jest.useRealTimers();
  });

  it('should support full task lifecycle: delegate -> accept -> progress -> complete', async () => {
    const events: string[] = [];

    gateway.on('task:delegated', () => events.push('delegated'));
    gateway.on('task:completed', () => events.push('completed'));

    // 1. Delegate
    const delegation = makeDelegation({ taskId: 'lifecycle-task' });
    await gateway.delegateTask('peer-agent', delegation);
    expect(events).toContain('delegated');

    // 2. Accept (simulate incoming accept message)
    gateway.onMessage('task:accept', async (_msg) => {
      events.push('accepted');
      return null;
    });
    await gateway.handleMessage(
      makeA2AMessage({
        type: 'task:accept',
        from: 'peer-agent',
        payload: { taskId: 'lifecycle-task' },
      }),
    );
    expect(events).toContain('accepted');

    // 3. Progress (simulate incoming progress message)
    gateway.onMessage('task:progress', async (_msg) => {
      events.push('progress');
      return null;
    });
    await gateway.handleMessage(
      makeA2AMessage({
        type: 'task:progress',
        from: 'peer-agent',
        payload: { taskId: 'lifecycle-task', progress: 50 },
      }),
    );
    expect(events).toContain('progress');

    // 4. Complete
    gateway.completeTask('lifecycle-task', {
      taskId: 'lifecycle-task',
      success: true,
      duration: 3000,
    });
    expect(events).toContain('completed');
    expect(gateway.getPendingTasks()).toHaveLength(0);
  });
});

// ── A2ARouter ────────────────────────────────────────────────

describe('A2ARouter', () => {
  let router: A2ARouter;

  beforeEach(() => {
    router = new A2ARouter();
  });

  it('should register a route via addRoute()', () => {
    router.addRoute({
      pattern: 'ping',
      handler: async () => null,
    });

    expect(router.getRoutes()).toHaveLength(1);
  });

  it('should match exact message type', async () => {
    let matched = false;
    router.addRoute({
      pattern: 'ping',
      handler: async () => {
        matched = true;
        return null;
      },
    });

    await router.route(makeA2AMessage({ type: 'ping' }));
    expect(matched).toBe(true);
  });

  it('should return null for no match', async () => {
    router.addRoute({
      pattern: 'ping',
      handler: async () =>
        makeA2AMessage({ type: 'pong' }),
    });

    const result = await router.route(
      makeA2AMessage({ type: 'discovery:request' }),
    );
    expect(result).toBeNull();
  });

  it('should remove routes via removeRoute()', () => {
    router.addRoute({ pattern: 'ping', handler: async () => null });
    router.addRoute({ pattern: 'pong', handler: async () => null });

    expect(router.removeRoute('ping')).toBe(true);
    expect(router.getRoutes()).toHaveLength(1);
    expect(router.getRoutes()[0].pattern).toBe('pong');
  });

  it('should return all routes via getRoutes()', () => {
    router.addRoute({ pattern: 'ping', handler: async () => null });
    router.addRoute({ pattern: 'pong', handler: async () => null });

    const routes = router.getRoutes();
    expect(routes).toHaveLength(2);
  });

  it('should clear all routes via clear()', () => {
    router.addRoute({ pattern: 'ping', handler: async () => null });
    router.addRoute({ pattern: 'pong', handler: async () => null });

    router.clear();
    expect(router.getRoutes()).toHaveLength(0);
  });

  it('should respect priority ordering (higher first)', async () => {
    const order: string[] = [];

    router.addRoute({
      pattern: /^task:/,
      handler: async () => {
        order.push('low');
        return null;
      },
      priority: 1,
    });

    router.addRoute({
      pattern: /^task:/,
      handler: async () => {
        order.push('high');
        return null;
      },
      priority: 10,
    });

    await router.route(makeA2AMessage({ type: 'task:delegate' }));

    // Only first match fires (highest priority)
    expect(order).toEqual(['high']);
  });
});

// ── Integration with ACP ─────────────────────────────────────

describe('A2AGateway - ACP Integration', () => {
  let gateway: A2AGateway;
  let bus: ACPMessageBus;

  beforeEach(() => {
    bus = new ACPMessageBus();
    gateway = new A2AGateway(
      makeGatewayConfig({ messageBus: bus }),
    );
    gateway.registerPeer(makePeerCard());
  });

  afterEach(() => {
    gateway.dispose();
    bus.clear();
  });

  it('should bridge task:delegate to ACP bus', async () => {
    const received: ACPMessage[] = [];
    bus.on('task:submit', async (msg) => {
      received.push(msg);
    });

    const delegation = makeDelegation();
    await gateway.handleMessage(
      makeA2AMessage({
        type: 'task:delegate',
        from: 'remote-agent',
        payload: delegation,
      }),
    );

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('task:submit');
    expect(received[0].source).toBe('a2a:remote-agent');
    expect(received[0].payload).toMatchObject({
      description: 'Deploy to staging',
      type: 'a2a-delegation',
    });
  });

  it('should bridge task:complete to ACP bus as task:result', async () => {
    const received: ACPMessage[] = [];
    bus.on('task:result', async (msg) => {
      received.push(msg);
    });

    const completion: TaskCompletion = {
      taskId: 'task-001',
      success: true,
      result: { deployed: true },
      duration: 5000,
    };

    await gateway.handleMessage(
      makeA2AMessage({
        type: 'task:complete',
        from: 'remote-agent',
        payload: completion,
      }),
    );

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('task:result');
    expect(received[0].source).toBe('a2a:remote-agent');
    expect(received[0].payload).toMatchObject({
      taskId: 'task-001',
      success: true,
      duration: 5000,
    });
  });

  it('should emit events for message lifecycle', async () => {
    const events: string[] = [];

    gateway.on('message:received', () => events.push('received'));
    gateway.on('message:sent', () => events.push('sent'));

    // Ping should produce both received and sent (pong response)
    await gateway.handleMessage(makeA2AMessage({ type: 'ping' }));

    expect(events).toContain('received');
    expect(events).toContain('sent');
  });

  it('should not bridge when no messageBus is configured', async () => {
    const noBusGateway = new A2AGateway(makeGatewayConfig());
    let busCalled = false;
    bus.on('task:submit', async () => {
      busCalled = true;
    });

    await noBusGateway.handleMessage(
      makeA2AMessage({
        type: 'task:delegate',
        payload: makeDelegation(),
      }),
    );

    expect(busCalled).toBe(false);
    noBusGateway.dispose();
  });
});

// ── dispose() ────────────────────────────────────────────────

describe('A2AGateway - dispose()', () => {
  it('should clear peers and pending tasks', async () => {
    const gateway = new A2AGateway(makeGatewayConfig());
    gateway.registerPeer(makePeerCard());
    await gateway.delegateTask('peer-agent', makeDelegation());

    expect(gateway.getPeers()).toHaveLength(1);
    expect(gateway.getPendingTasks()).toHaveLength(1);

    gateway.dispose();

    expect(gateway.getPeers()).toHaveLength(0);
    expect(gateway.getPendingTasks()).toHaveLength(0);
  });

  it('should remove all event listeners', () => {
    const gateway = new A2AGateway(makeGatewayConfig());
    gateway.on('message:received', () => {});
    gateway.on('task:delegated', () => {});

    expect(gateway.listenerCount('message:received')).toBe(1);
    expect(gateway.listenerCount('task:delegated')).toBe(1);

    gateway.dispose();

    expect(gateway.listenerCount('message:received')).toBe(0);
    expect(gateway.listenerCount('task:delegated')).toBe(0);
  });
});

// ── Factory Functions ────────────────────────────────────────

describe('Factory Functions', () => {
  it('should create A2AGateway via createA2AGateway()', () => {
    const gateway = createA2AGateway(makeGatewayConfig());
    expect(gateway).toBeInstanceOf(A2AGateway);
    gateway.dispose();
  });

  it('should create A2ARouter via createA2ARouter()', () => {
    const router = createA2ARouter();
    expect(router).toBeInstanceOf(A2ARouter);
  });
});
