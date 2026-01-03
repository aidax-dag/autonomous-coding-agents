/**
 * Agent Communication Tests
 */

import {
  AgentCommunication,
  createAgentCommunication,
  COMMUNICATION_EVENTS,
  type AgentMessage,
} from '../../../../src/core/agents/communication';
import type { IMessageBroker, MessageHandler } from '../../../../src/core/agents/interfaces';
import type { IEventBus, IEvent } from '../../../../src/core/events';

// Mock message broker
const createMockMessageBroker = (): IMessageBroker & {
  handlers: Map<string, MessageHandler>;
  simulateMessage: (topic: string, message: unknown) => Promise<void>;
} => {
  const handlers = new Map<string, MessageHandler>();

  return {
    handlers,
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockImplementation((topic: string, handler: MessageHandler) => {
      handlers.set(topic, handler);
      return Promise.resolve();
    }),
    unsubscribe: jest.fn().mockImplementation((topic: string) => {
      handlers.delete(topic);
      return Promise.resolve();
    }),
    request: jest.fn().mockResolvedValue({}),
    isConnected: jest.fn().mockReturnValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    simulateMessage: async (topic: string, message: unknown) => {
      const handler = handlers.get(topic);
      if (handler) {
        await handler(message);
      }
    },
  };
};

// Mock event bus
const createMockEventBus = (): IEventBus & { emittedEvents: IEvent[] } => {
  const emittedEvents: IEvent[] = [];

  return {
    emit: jest.fn((event: IEvent) => {
      emittedEvents.push(event);
    }),
    emitAsync: jest.fn().mockResolvedValue(undefined),
    emitBatch: jest.fn(),
    on: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    once: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    off: jest.fn(),
    waitFor: jest.fn().mockResolvedValue({}),
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
    eventTypes: jest.fn().mockReturnValue([]),
    hasListeners: jest.fn().mockReturnValue(false),
    pause: jest.fn(),
    resume: jest.fn(),
    isPaused: jest.fn().mockReturnValue(false),
    dispose: jest.fn(),
    emittedEvents,
  };
};

describe('AgentCommunication', () => {
  let communication: AgentCommunication;
  let broker: ReturnType<typeof createMockMessageBroker>;
  let eventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    broker = createMockMessageBroker();
    eventBus = createMockEventBus();
    communication = new AgentCommunication({
      messageBroker: broker,
      eventBus,
      defaultTimeout: 5000,
    });
  });

  afterEach(async () => {
    await communication.dispose();
  });

  describe('Direct Messaging', () => {
    it('should send message to specific agent', async () => {
      await communication.sendToAgent('sender-1', 'receiver-1', 'test.action', {
        data: 'hello',
      });

      expect(broker.publish).toHaveBeenCalledWith(
        'agents.messages.receiver-1',
        expect.objectContaining({
          from: 'sender-1',
          to: 'receiver-1',
          type: 'test.action',
          payload: { data: 'hello' },
        })
      );
    });

    it('should include message metadata', async () => {
      await communication.sendToAgent('sender-1', 'receiver-1', 'test.action', { data: 1 });

      const publishCall = (broker.publish as jest.Mock).mock.calls[0];
      const message = publishCall[1] as AgentMessage;

      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeInstanceOf(Date);
    });

    it('should emit event on message sent', async () => {
      await communication.sendToAgent('sender-1', 'receiver-1', 'test.action', {});

      const sentEvent = eventBus.emittedEvents.find(
        (e) => e.type === COMMUNICATION_EVENTS.MESSAGE_SENT
      );
      expect(sentEvent).toBeDefined();
      expect(sentEvent!.payload).toMatchObject({
        from: 'sender-1',
        to: 'receiver-1',
        type: 'test.action',
      });
    });
  });

  describe('Broadcast Messaging', () => {
    it('should broadcast message to all agents', async () => {
      await communication.broadcast('sender-1', 'alert.system', { level: 'warning' });

      expect(broker.publish).toHaveBeenCalledWith(
        'agents.messages.broadcast',
        expect.objectContaining({
          from: 'sender-1',
          type: 'alert.system',
          payload: { level: 'warning' },
        })
      );
    });

    it('should include broadcast flag in metadata', async () => {
      await communication.broadcast('sender-1', 'alert', {});

      const publishCall = (broker.publish as jest.Mock).mock.calls[0];
      const message = publishCall[1] as AgentMessage;

      expect(message.metadata?.broadcast).toBe(true);
    });
  });

  describe('Subscription', () => {
    it('should subscribe to agent messages', () => {
      const handler = jest.fn();

      communication.subscribe('agent-1', handler);

      expect(broker.subscribe).toHaveBeenCalledWith(
        'agents.messages.agent-1',
        expect.any(Function)
      );
    });

    it('should receive messages through subscription', async () => {
      const handler = jest.fn();

      communication.subscribe('agent-1', handler);

      // Simulate incoming message
      await broker.simulateMessage('agents.messages.agent-1', {
        id: 'msg-1',
        from: 'sender-1',
        to: 'agent-1',
        type: 'test.message',
        payload: { data: 'test' },
        timestamp: new Date().toISOString(),
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          from: 'sender-1',
          type: 'test.message',
        })
      );
    });

    it('should unsubscribe correctly', async () => {
      const handler = jest.fn();

      const subscription = communication.subscribe('agent-1', handler);
      subscription.unsubscribe();

      expect(broker.unsubscribe).toHaveBeenCalledWith('agents.messages.agent-1');
    });

    it('should emit event on subscription added', () => {
      communication.subscribe('agent-1', jest.fn());

      const addEvent = eventBus.emittedEvents.find(
        (e) => e.type === COMMUNICATION_EVENTS.SUBSCRIPTION_ADDED
      );
      expect(addEvent).toBeDefined();
      expect((addEvent!.payload as { agentId: string }).agentId).toBe('agent-1');
    });

    it('should subscribe to broadcasts', () => {
      const handler = jest.fn();

      communication.subscribeToBroadcasts(handler);

      expect(broker.subscribe).toHaveBeenCalledWith(
        'agents.messages.broadcast',
        expect.any(Function)
      );
    });
  });

  describe('Message Filtering', () => {
    it('should apply message filter', async () => {
      const handler = jest.fn();
      const filter = (msg: AgentMessage) => msg.type.startsWith('allowed');

      communication.subscribe('agent-1', handler, filter);

      // Should be filtered out
      await broker.simulateMessage('agents.messages.agent-1', {
        id: 'msg-1',
        from: 'sender',
        type: 'blocked.message',
        payload: {},
        timestamp: new Date().toISOString(),
      });

      expect(handler).not.toHaveBeenCalled();

      // Should pass filter
      await broker.simulateMessage('agents.messages.agent-1', {
        id: 'msg-2',
        from: 'sender',
        type: 'allowed.message',
        payload: {},
        timestamp: new Date().toISOString(),
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request/Reply Pattern', () => {
    it('should send request and wait for reply', async () => {
      // Start the request
      const requestPromise = communication.request<{ data: string }, { result: number }>(
        'requester-1',
        'responder-1',
        'calculate',
        { data: 'test' },
        2000
      );

      // Wait a tick for the subscription and publish to complete
      await new Promise((resolve) => setImmediate(resolve));

      // Get the message ID from publish call
      const publishCall = (broker.publish as jest.Mock).mock.calls[0];
      const requestMessage = publishCall[1] as AgentMessage;

      // Simulate reply
      await broker.simulateMessage('agents.messages.requester-1', {
        id: 'reply-1',
        from: 'responder-1',
        to: 'requester-1',
        type: 'calculate.reply',
        payload: { result: 42 },
        correlationId: requestMessage.id,
        timestamp: new Date().toISOString(),
      });

      const result = await requestPromise;
      expect(result).toEqual({ result: 42 });
    });

    it('should timeout if no reply received', async () => {
      const requestPromise = communication.request(
        'requester-1',
        'responder-1',
        'slow-op',
        {},
        100 // Very short timeout
      );

      await expect(requestPromise).rejects.toThrow('Request timeout after 100ms');
    });

    it('should reply to message', async () => {
      const originalMessage: AgentMessage = {
        id: 'original-msg',
        from: 'requester',
        to: 'responder',
        type: 'query',
        payload: { question: 'What?' },
        timestamp: new Date(),
      };

      await communication.reply(originalMessage, 'responder', { answer: 42 });

      expect(broker.publish).toHaveBeenCalledWith(
        'agents.messages.requester',
        expect.objectContaining({
          from: 'responder',
          to: 'requester',
          type: 'query.reply',
          correlationId: 'original-msg',
          payload: { answer: 42 },
        })
      );
    });
  });

  describe('Pending Request Management', () => {
    it('should track pending requests', async () => {
      expect(communication.getPendingRequestCount()).toBe(0);

      // Start request without reply (await to ensure subscription is set up)
      const requestPromise = communication.request('a', 'b', 'test', {}, 10000);
      requestPromise.catch(() => {}); // Suppress unhandled rejection

      // Wait for async setup
      await new Promise((resolve) => setImmediate(resolve));

      expect(communication.getPendingRequestCount()).toBe(1);

      // Clean up
      communication.cancelRequest((broker.publish as jest.Mock).mock.calls[0][1].id);
    });

    it('should cancel specific request', async () => {
      const requestPromise = communication.request('a', 'b', 'test', {}, 10000);

      // Wait for async setup
      await new Promise((resolve) => setImmediate(resolve));

      const publishCall = (broker.publish as jest.Mock).mock.calls[0];
      const message = publishCall[1] as AgentMessage;

      const cancelled = communication.cancelRequest(message.id);
      expect(cancelled).toBe(true);

      await expect(requestPromise).rejects.toThrow('Request cancelled');
    });

    it('should cancel all pending requests', async () => {
      const promises = [
        communication.request('a', 'b', 'test1', {}, 10000),
        communication.request('a', 'b', 'test2', {}, 10000),
        communication.request('a', 'b', 'test3', {}, 10000),
      ];

      // Wait for all subscriptions to be set up
      await new Promise((resolve) => setImmediate(resolve));

      communication.cancelAllRequests();

      for (const promise of promises) {
        await expect(promise).rejects.toThrow('All requests cancelled');
      }
    });

    it('should limit maximum pending requests', async () => {
      const limitedComm = new AgentCommunication({
        messageBroker: broker,
        maxPendingRequests: 2,
      });

      // Start 2 requests and wait for setup
      const p1 = limitedComm.request('a', 'b', 'test1', {}, 10000);
      p1.catch(() => {});
      await new Promise((resolve) => setImmediate(resolve));

      const p2 = limitedComm.request('a', 'b', 'test2', {}, 10000);
      p2.catch(() => {});
      await new Promise((resolve) => setImmediate(resolve));

      // Third should fail
      await expect(
        limitedComm.request('a', 'b', 'test3', {}, 10000)
      ).rejects.toThrow('Maximum pending requests reached');

      limitedComm.cancelAllRequests();
      await limitedComm.dispose();
    });
  });

  describe('Dispose', () => {
    it('should cleanup on dispose', async () => {
      // Create a new communication instance for this test
      const testComm = new AgentCommunication({
        messageBroker: broker,
        eventBus,
      });

      testComm.subscribe('agent-1', jest.fn());
      testComm.subscribeToBroadcasts(jest.fn());

      const requestPromise = testComm.request('a', 'b', 'test', {}, 10000);
      requestPromise.catch(() => {}); // Suppress unhandled rejection

      // Wait for setup
      await new Promise((resolve) => setImmediate(resolve));

      await testComm.dispose();

      expect(broker.unsubscribe).toHaveBeenCalled();
      expect(testComm.getPendingRequestCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should emit event on message failure', async () => {
      (broker.publish as jest.Mock).mockRejectedValueOnce(new Error('Publish failed'));

      await expect(
        communication.sendToAgent('sender', 'receiver', 'test', {})
      ).rejects.toThrow('Publish failed');

      const failEvent = eventBus.emittedEvents.find(
        (e) => e.type === COMMUNICATION_EVENTS.MESSAGE_FAILED
      );
      expect(failEvent).toBeDefined();
    });

    it('should handle invalid incoming message', async () => {
      const handler = jest.fn();
      communication.subscribe('agent-1', handler);

      // Simulate invalid message
      await broker.simulateMessage('agents.messages.agent-1', 'invalid message');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle handler errors gracefully', async () => {
      const errorHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
      communication.subscribe('agent-1', errorHandler);

      // Should not throw
      await broker.simulateMessage('agents.messages.agent-1', {
        id: 'msg-1',
        from: 'sender',
        type: 'test',
        payload: {},
        timestamp: new Date().toISOString(),
      });

      expect(errorHandler).toHaveBeenCalled();
    });
  });

  describe('createAgentCommunication helper', () => {
    it('should create communication instance', () => {
      const comm = createAgentCommunication({
        messageBroker: broker,
      });

      expect(comm).toBeInstanceOf(AgentCommunication);
    });
  });
});
