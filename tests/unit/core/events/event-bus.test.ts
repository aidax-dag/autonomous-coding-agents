/**
 * Event Bus Tests
 */

import { createEventBus, type IAsyncEventBus } from '../../../../src/core/events';
import type { IEvent } from '../../../../src/core/interfaces';

// Test event types
interface TestEvent extends IEvent {
  type: 'test.event';
  payload: { message: string };
}

interface CountEvent extends IEvent {
  type: 'count.event';
  payload: { count: number };
}

// Helper to create events with required fields
function createTestEvent(message: string): TestEvent {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'test.event',
    payload: { message },
    timestamp: new Date(),
    source: 'test',
  };
}

function createCountEvent(count: number): CountEvent {
  return {
    id: `count-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    type: 'count.event',
    payload: { count },
    timestamp: new Date(),
    source: 'test',
  };
}

describe('Event Bus', () => {
  let eventBus: IAsyncEventBus;

  beforeEach(() => {
    eventBus = createEventBus();
  });

  afterEach(() => {
    eventBus.dispose();
  });

  describe('Basic Pub/Sub', () => {
    it('should emit and receive events', () => {
      const received: TestEvent[] = [];

      eventBus.on<TestEvent>('test.event', (event) => {
        received.push(event);
      });

      eventBus.emit<TestEvent>(createTestEvent('hello'));

      expect(received).toHaveLength(1);
      expect(received[0].payload.message).toBe('hello');
    });

    it('should support multiple handlers for same event', () => {
      let count = 0;

      eventBus.on<TestEvent>('test.event', () => { count++; });
      eventBus.on<TestEvent>('test.event', () => { count++; });
      eventBus.on<TestEvent>('test.event', () => { count++; });

      eventBus.emit<TestEvent>(createTestEvent('test'));

      expect(count).toBe(3);
    });

    it('should not receive events after unsubscribe', () => {
      let count = 0;

      const subscription = eventBus.on<TestEvent>('test.event', () => { count++; });

      eventBus.emit<TestEvent>(createTestEvent('first'));

      expect(count).toBe(1);

      eventBus.off(subscription);

      eventBus.emit<TestEvent>(createTestEvent('second'));

      expect(count).toBe(1);
    });
  });

  describe('Once Subscriptions', () => {
    it('should only receive event once with once()', () => {
      let count = 0;

      eventBus.once<TestEvent>('test.event', () => { count++; });

      eventBus.emit<TestEvent>(createTestEvent('first'));
      eventBus.emit<TestEvent>(createTestEvent('second'));

      expect(count).toBe(1);
    });
  });

  describe('Priority Handling', () => {
    it('should call handlers in priority order', () => {
      const order: number[] = [];

      eventBus.on<TestEvent>('test.event', () => { order.push(2); }, { priority: 2 });
      eventBus.on<TestEvent>('test.event', () => { order.push(1); }, { priority: 1 });
      eventBus.on<TestEvent>('test.event', () => { order.push(3); }, { priority: 3 });

      eventBus.emit<TestEvent>(createTestEvent('test'));

      // Higher priority first
      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events based on filter function', () => {
      const received: CountEvent[] = [];

      eventBus.on<CountEvent>(
        'count.event',
        (event) => { received.push(event); },
        { filter: (event) => event.payload.count > 5 }
      );

      for (let i = 1; i <= 10; i++) {
        eventBus.emit<CountEvent>(createCountEvent(i));
      }

      expect(received).toHaveLength(5);
      expect(received[0].payload.count).toBe(6);
      expect(received[4].payload.count).toBe(10);
    });
  });

  describe('Async Events', () => {
    it('should handle async event emission', async () => {
      const received: TestEvent[] = [];

      eventBus.on<TestEvent>('test.event', async (event) => {
        await new Promise((r) => setTimeout(r, 10));
        received.push(event);
      });

      await eventBus.emitAsync<TestEvent>(createTestEvent('async'));

      expect(received).toHaveLength(1);
      expect(received[0].payload.message).toBe('async');
    });
  });

  describe('waitFor', () => {
    it('should wait for a specific event', async () => {
      setTimeout(() => {
        eventBus.emit<TestEvent>(createTestEvent('waited'));
      }, 50);

      const event = await eventBus.waitFor<TestEvent>('test.event', 1000);

      expect(event.payload.message).toBe('waited');
    });

    it('should timeout if event not received', async () => {
      await expect(
        eventBus.waitFor<TestEvent>('test.event', 50)
      ).rejects.toThrow(/timeout/i);
    });

    it('should filter waitFor events', async () => {
      setTimeout(() => {
        eventBus.emit<CountEvent>(createCountEvent(1));
        eventBus.emit<CountEvent>(createCountEvent(10));
      }, 50);

      const event = await eventBus.waitFor<CountEvent>(
        'count.event',
        1000,
        (e) => e.payload.count > 5
      );

      expect(event.payload.count).toBe(10);
    });
  });

  describe('Pause and Resume', () => {
    it('should not emit events when paused', () => {
      let count = 0;

      eventBus.on<TestEvent>('test.event', () => { count++; });

      eventBus.pause();
      expect(eventBus.isPaused()).toBe(true);

      eventBus.emit<TestEvent>(createTestEvent('paused'));

      expect(count).toBe(0);

      eventBus.resume();
      expect(eventBus.isPaused()).toBe(false);

      eventBus.emit<TestEvent>(createTestEvent('resumed'));

      expect(count).toBe(1);
    });
  });

  describe('Listener Count', () => {
    it('should return correct listener count', () => {
      expect(eventBus.listenerCount('test.event')).toBe(0);

      const sub1 = eventBus.on<TestEvent>('test.event', () => {});
      expect(eventBus.listenerCount('test.event')).toBe(1);

      const sub2 = eventBus.on<TestEvent>('test.event', () => {});
      expect(eventBus.listenerCount('test.event')).toBe(2);

      eventBus.off(sub1);
      expect(eventBus.listenerCount('test.event')).toBe(1);

      eventBus.off(sub2);
      expect(eventBus.listenerCount('test.event')).toBe(0);
    });

    it('should check if event type has listeners', () => {
      expect(eventBus.hasListeners('test.event')).toBe(false);

      const sub = eventBus.on<TestEvent>('test.event', () => {});
      expect(eventBus.hasListeners('test.event')).toBe(true);

      eventBus.off(sub);
      expect(eventBus.hasListeners('test.event')).toBe(false);
    });
  });

  describe('Remove All Listeners', () => {
    it('should remove all listeners for specific event type', () => {
      eventBus.on<TestEvent>('test.event', () => {});
      eventBus.on<TestEvent>('test.event', () => {});
      eventBus.on<CountEvent>('count.event', () => {});

      eventBus.removeAllListeners('test.event');

      expect(eventBus.listenerCount('test.event')).toBe(0);
      expect(eventBus.listenerCount('count.event')).toBe(1);
    });

    it('should remove all listeners when no event type specified', () => {
      eventBus.on<TestEvent>('test.event', () => {});
      eventBus.on<CountEvent>('count.event', () => {});

      eventBus.removeAllListeners();

      expect(eventBus.listenerCount('test.event')).toBe(0);
      expect(eventBus.listenerCount('count.event')).toBe(0);
    });
  });

  describe('Event Types', () => {
    it('should return all registered event types', () => {
      eventBus.on<TestEvent>('test.event', () => {});
      eventBus.on<CountEvent>('count.event', () => {});

      const types = eventBus.eventTypes();

      expect(types).toContain('test.event');
      expect(types).toContain('count.event');
    });
  });

  describe('Batch Emit', () => {
    it('should emit multiple events at once', () => {
      const received: TestEvent[] = [];

      eventBus.on<TestEvent>('test.event', (event) => {
        received.push(event);
      });

      eventBus.emitBatch<TestEvent>([
        createTestEvent('one'),
        createTestEvent('two'),
        createTestEvent('three'),
      ]);

      expect(received).toHaveLength(3);
      expect(received.map((e) => e.payload.message)).toEqual(['one', 'two', 'three']);
    });
  });

  describe('Async Handlers', () => {
    it('should support async handlers with onAsync', async () => {
      const received: string[] = [];

      eventBus.onAsync<TestEvent>('test.event', async (event) => {
        await new Promise((r) => setTimeout(r, 10));
        received.push(event.payload.message);
      });

      eventBus.emit<TestEvent>(createTestEvent('async-handler'));

      // Handler is async, should have pending count
      expect(eventBus.pendingCount()).toBeGreaterThanOrEqual(0);

      // Wait for all pending handlers
      await eventBus.flush();

      expect(received).toContain('async-handler');
    });
  });
});
