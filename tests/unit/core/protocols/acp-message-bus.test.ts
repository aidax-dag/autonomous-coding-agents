/**
 * ACP Message Bus Tests
 */

import {
  ACPMessageBus,
  createACPMessageBus,
  createACPMessage,
} from '../../../../src/core/protocols/acp-message-bus';
import type { ACPMessage } from '../../../../src/core/protocols/interfaces/acp.interface';

function makeMessage(overrides: Partial<ACPMessage> = {}): ACPMessage {
  return createACPMessage({
    type: 'task:submit',
    source: 'test-source',
    target: 'test-target',
    payload: { test: true },
    ...overrides,
  });
}

describe('ACPMessageBus', () => {
  let bus: ACPMessageBus;

  beforeEach(() => {
    bus = new ACPMessageBus();
  });

  afterEach(() => {
    bus.clear();
  });

  it('should publish and deliver to subscribers', async () => {
    const received: ACPMessage[] = [];

    bus.subscribe(
      () => true,
      async (msg) => { received.push(msg); },
    );

    await bus.publish(makeMessage());

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe('task:submit');
  });

  it('should filter messages by type', async () => {
    const taskMessages: ACPMessage[] = [];
    const statusMessages: ACPMessage[] = [];

    bus.on('task:submit', async (msg) => { taskMessages.push(msg); });
    bus.on('task:status', async (msg) => { statusMessages.push(msg); });

    await bus.publish(makeMessage({ type: 'task:submit' }));
    await bus.publish(makeMessage({ type: 'task:status' }));
    await bus.publish(makeMessage({ type: 'task:submit' }));

    expect(taskMessages).toHaveLength(2);
    expect(statusMessages).toHaveLength(1);
  });

  it('should filter with custom predicate', async () => {
    const highPriority: ACPMessage[] = [];

    bus.subscribe(
      (msg) => msg.priority === 'high',
      async (msg) => { highPriority.push(msg); },
    );

    await bus.publish(makeMessage({ priority: 'normal' }));
    await bus.publish(makeMessage({ priority: 'high' }));
    await bus.publish(makeMessage({ priority: 'low' }));

    expect(highPriority).toHaveLength(1);
  });

  it('should unsubscribe', async () => {
    const received: ACPMessage[] = [];

    const sub = bus.subscribe(
      () => true,
      async (msg) => { received.push(msg); },
    );

    await bus.publish(makeMessage());
    sub.unsubscribe();
    await bus.publish(makeMessage());

    expect(received).toHaveLength(1);
  });

  it('should track subscription count', () => {
    expect(bus.subscriptionCount()).toBe(0);

    const sub1 = bus.on('task:submit', async () => {});
    const sub2 = bus.on('task:status', async () => {});

    expect(bus.subscriptionCount()).toBe(2);

    sub1.unsubscribe();
    expect(bus.subscriptionCount()).toBe(1);

    sub2.unsubscribe();
    expect(bus.subscriptionCount()).toBe(0);
  });

  it('should clear all subscriptions', () => {
    bus.on('task:submit', async () => {});
    bus.on('task:status', async () => {});

    bus.clear();
    expect(bus.subscriptionCount()).toBe(0);
  });

  it('should deliver to multiple subscribers', async () => {
    let count = 0;

    bus.subscribe(() => true, async () => { count++; });
    bus.subscribe(() => true, async () => { count++; });

    await bus.publish(makeMessage());
    expect(count).toBe(2);
  });

  it('should handle request-response pattern', async () => {
    // Simulate a responder — skip messages that are responses (have correlationId)
    bus.on('system:health', async (msg) => {
      if (msg.correlationId) return; // ignore response messages
      const response = createACPMessage({
        type: 'system:health',
        source: msg.target, // respond from target
        target: msg.source,
        payload: { status: 'healthy', activeAgents: 3, pendingTasks: 0, uptime: 1000, components: {} },
        correlationId: msg.id,
      });
      await bus.publish(response);
    });

    const request = makeMessage({
      type: 'system:health',
      source: 'gateway',
      target: 'system',
      payload: {},
    });

    const response = await bus.request(request, 1000);

    expect(response.payload).toEqual({
      status: 'healthy',
      activeAgents: 3,
      pendingTasks: 0,
      uptime: 1000,
      components: {},
    });
  });

  it('should timeout on request with no response', async () => {
    const request = makeMessage({
      type: 'system:health',
      source: 'gateway',
      target: 'nobody',
    });

    await expect(bus.request(request, 50)).rejects.toThrow('timed out');
  });
});

describe('createACPMessage', () => {
  it('should create message with defaults', () => {
    const msg = createACPMessage({
      type: 'task:submit',
      source: 'src',
      target: 'tgt',
      payload: 'data',
    });

    expect(msg.id).toBeDefined();
    expect(msg.priority).toBe('normal');
    expect(msg.timestamp).toBeDefined();
    expect(msg.type).toBe('task:submit');
    expect(msg.payload).toBe('data');
  });

  it('should allow overriding defaults', () => {
    const msg = createACPMessage({
      type: 'task:submit',
      source: 'src',
      target: 'tgt',
      payload: null,
      priority: 'critical',
      id: 'custom-id',
    });

    expect(msg.id).toBe('custom-id');
    expect(msg.priority).toBe('critical');
  });
});

describe('createACPMessageBus', () => {
  it('should create via factory', () => {
    const bus = createACPMessageBus();
    expect(bus).toBeInstanceOf(ACPMessageBus);
  });
});
