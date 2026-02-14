/**
 * E2E: ACP MessageBus Integration
 *
 * Verifies the ACP in-memory message bus publish/subscribe pattern,
 * request/response with timeout, multiple subscribers, unsubscribe,
 * and correct message type filtering.
 */

import {
  createACPMessageBus,
  createACPMessage,
  type ACPMessage,
  type ACPSubscription,
} from '@/core/protocols';

describe('E2E: ACP MessageBus Integration', () => {
  // ═══════════════════════════════════════════════════════════
  // 1. Message publishing and subscription
  // ═══════════════════════════════════════════════════════════

  describe('Message publishing and subscription', () => {
    it('should deliver published messages to matching subscribers', async () => {
      const bus = createACPMessageBus();
      const received: ACPMessage[] = [];

      bus.on('task:submit', async (msg) => {
        received.push(msg);
      });

      const message = createACPMessage({
        type: 'task:submit',
        source: 'test-source',
        target: 'test-target',
        payload: { description: 'Test task' },
      });

      await bus.publish(message);

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('task:submit');
      expect(received[0].source).toBe('test-source');
      expect(received[0].payload).toEqual({ description: 'Test task' });
    });

    it('should not deliver messages to non-matching subscribers', async () => {
      const bus = createACPMessageBus();
      const received: ACPMessage[] = [];

      bus.on('task:status', async (msg) => {
        received.push(msg);
      });

      const message = createACPMessage({
        type: 'task:submit',
        source: 'test-source',
        target: 'test-target',
        payload: { description: 'Should not be received' },
      });

      await bus.publish(message);

      expect(received).toHaveLength(0);
    });

    it('should deliver messages to custom filter subscribers', async () => {
      const bus = createACPMessageBus();
      const received: ACPMessage[] = [];

      bus.subscribe(
        (msg) => msg.source === 'agent-1',
        async (msg) => {
          received.push(msg);
        },
      );

      await bus.publish(
        createACPMessage({
          type: 'task:submit',
          source: 'agent-1',
          target: 'broadcast',
          payload: { data: 'from-agent-1' },
        }),
      );

      await bus.publish(
        createACPMessage({
          type: 'task:submit',
          source: 'agent-2',
          target: 'broadcast',
          payload: { data: 'from-agent-2' },
        }),
      );

      expect(received).toHaveLength(1);
      expect(received[0].source).toBe('agent-1');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Multiple subscribers receiving same message
  // ═══════════════════════════════════════════════════════════

  describe('Multiple subscribers receiving same message', () => {
    it('should deliver to all matching subscribers', async () => {
      const bus = createACPMessageBus();
      const receivedA: ACPMessage[] = [];
      const receivedB: ACPMessage[] = [];
      const receivedC: ACPMessage[] = [];

      bus.on('system:health', async (msg) => { receivedA.push(msg); });
      bus.on('system:health', async (msg) => { receivedB.push(msg); });
      bus.on('system:health', async (msg) => { receivedC.push(msg); });

      await bus.publish(
        createACPMessage({
          type: 'system:health',
          source: 'system',
          target: 'broadcast',
          payload: { status: 'healthy' },
        }),
      );

      expect(receivedA).toHaveLength(1);
      expect(receivedB).toHaveLength(1);
      expect(receivedC).toHaveLength(1);
    });

    it('should track subscription count correctly', async () => {
      const bus = createACPMessageBus();
      expect(bus.subscriptionCount()).toBe(0);

      bus.on('task:submit', async () => {});
      bus.on('task:status', async () => {});
      bus.on('task:result', async () => {});

      expect(bus.subscriptionCount()).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Unsubscribe functionality
  // ═══════════════════════════════════════════════════════════

  describe('Unsubscribe functionality', () => {
    it('should stop receiving messages after unsubscribe', async () => {
      const bus = createACPMessageBus();
      const received: ACPMessage[] = [];

      const sub: ACPSubscription = bus.on('agent:event', async (msg) => {
        received.push(msg);
      });

      // First message should be received
      await bus.publish(
        createACPMessage({
          type: 'agent:event',
          source: 'agent-1',
          target: 'broadcast',
          payload: { event: 'first' },
        }),
      );

      expect(received).toHaveLength(1);

      // Unsubscribe
      sub.unsubscribe();

      // Second message should not be received
      await bus.publish(
        createACPMessage({
          type: 'agent:event',
          source: 'agent-1',
          target: 'broadcast',
          payload: { event: 'second' },
        }),
      );

      expect(received).toHaveLength(1);
    });

    it('should decrement subscription count after unsubscribe', () => {
      const bus = createACPMessageBus();

      const sub1 = bus.on('task:submit', async () => {});
      const sub2 = bus.on('task:status', async () => {});

      expect(bus.subscriptionCount()).toBe(2);

      sub1.unsubscribe();
      expect(bus.subscriptionCount()).toBe(1);

      sub2.unsubscribe();
      expect(bus.subscriptionCount()).toBe(0);
    });

    it('should clear all subscriptions with clear()', () => {
      const bus = createACPMessageBus();

      bus.on('task:submit', async () => {});
      bus.on('task:status', async () => {});
      bus.on('task:result', async () => {});

      expect(bus.subscriptionCount()).toBe(3);

      bus.clear();
      expect(bus.subscriptionCount()).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Request/response pattern with timeout
  // ═══════════════════════════════════════════════════════════

  describe('Request/response pattern', () => {
    it('should resolve when a matching response is published', async () => {
      const bus = createACPMessageBus();

      // Set up a responder that replies to task:submit messages
      bus.on('task:submit', async (msg) => {
        await bus.publish(
          createACPMessage({
            type: 'task:result',
            source: msg.target,
            target: msg.source,
            correlationId: msg.id,
            payload: { taskId: 'task-1', success: true, duration: 100 },
          }),
        );
      });

      const request = createACPMessage({
        type: 'task:submit',
        source: 'requester',
        target: 'responder',
        payload: { description: 'Do something' },
      });

      const response = await bus.request<
        { description: string },
        { taskId: string; success: boolean; duration: number }
      >(request, 5000);

      expect(response).toBeDefined();
      expect(response.correlationId).toBe(request.id);
      expect(response.payload.success).toBe(true);
    });

    it('should reject with timeout when no response arrives', async () => {
      const bus = createACPMessageBus();

      const request = createACPMessage({
        type: 'task:submit',
        source: 'requester',
        target: 'nobody',
        payload: { description: 'No one will answer' },
      });

      await expect(bus.request(request, 100)).rejects.toThrow(/timed out/i);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Message type coverage
  // ═══════════════════════════════════════════════════════════

  describe('Message types', () => {
    it.each([
      'task:submit',
      'task:status',
      'task:result',
      'task:cancel',
      'agent:status',
      'agent:event',
      'system:health',
      'system:config',
    ] as const)('should correctly route %s messages', async (msgType) => {
      const bus = createACPMessageBus();
      const received: ACPMessage[] = [];

      bus.on(msgType, async (msg) => { received.push(msg); });

      await bus.publish(
        createACPMessage({
          type: msgType,
          source: 'test',
          target: 'test',
          payload: { type: msgType },
        }),
      );

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe(msgType);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. Message creation helper
  // ═══════════════════════════════════════════════════════════

  describe('createACPMessage helper', () => {
    it('should populate default fields', () => {
      const msg = createACPMessage({
        type: 'task:submit',
        source: 'src',
        target: 'tgt',
        payload: { data: 'value' },
      });

      expect(msg.id).toBeDefined();
      expect(msg.id).toMatch(/^acp-/);
      expect(msg.priority).toBe('normal');
      expect(msg.timestamp).toBeDefined();
      expect(msg.type).toBe('task:submit');
      expect(msg.source).toBe('src');
      expect(msg.target).toBe('tgt');
    });

    it('should allow overriding default fields', () => {
      const msg = createACPMessage({
        type: 'task:submit',
        source: 'src',
        target: 'tgt',
        payload: {},
        priority: 'critical',
        id: 'custom-id-123',
      });

      expect(msg.id).toBe('custom-id-123');
      expect(msg.priority).toBe('critical');
    });
  });
});
