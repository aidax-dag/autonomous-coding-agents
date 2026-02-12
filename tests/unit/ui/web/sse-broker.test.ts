/**
 * Tests for SSEBrokerImpl
 *
 * Validates client management, broadcasting,
 * and disconnect-all functionality.
 */

import { SSEBrokerImpl, createSSEBroker } from '@/ui/web/sse-broker';
import type { SSEClient } from '@/ui/web/interfaces/web.interface';

function createMockClient(id: string): SSEClient & { sent: Array<{ event: string; data: unknown }>; closed: boolean } {
  const sent: Array<{ event: string; data: unknown }> = [];
  let closed = false;
  return {
    id,
    sent,
    get closed() { return closed; },
    send(event: string, data: unknown) {
      sent.push({ event, data });
    },
    close() {
      closed = true;
    },
  };
}

describe('SSEBrokerImpl', () => {
  let broker: SSEBrokerImpl;

  beforeEach(() => {
    broker = new SSEBrokerImpl();
  });

  describe('addClient / removeClient', () => {
    it('should add and remove clients tracking count', () => {
      const c1 = createMockClient('c1');
      const c2 = createMockClient('c2');

      broker.addClient(c1);
      broker.addClient(c2);
      expect(broker.getClientCount()).toBe(2);
      expect(broker.getClientIds()).toEqual(['c1', 'c2']);

      broker.removeClient('c1');
      expect(broker.getClientCount()).toBe(1);
      expect(c1.closed).toBe(true);
    });

    it('should not fail when removing non-existent client', () => {
      expect(() => broker.removeClient('non-existent')).not.toThrow();
    });
  });

  describe('broadcast', () => {
    it('should broadcast to all connected clients', () => {
      const c1 = createMockClient('c1');
      const c2 = createMockClient('c2');

      broker.addClient(c1);
      broker.addClient(c2);

      broker.broadcast('agent:status', { agentId: 'a1', state: 'working' });

      expect(c1.sent).toHaveLength(1);
      expect(c1.sent[0]).toEqual({
        event: 'agent:status',
        data: { agentId: 'a1', state: 'working' },
      });
      expect(c2.sent).toHaveLength(1);
      expect(c2.sent[0]).toEqual({
        event: 'agent:status',
        data: { agentId: 'a1', state: 'working' },
      });
    });

    it('should not fail when broadcasting to empty broker', () => {
      expect(() => broker.broadcast('test', {})).not.toThrow();
    });
  });

  describe('disconnectAll', () => {
    it('should close all clients and clear the map', () => {
      const c1 = createMockClient('c1');
      const c2 = createMockClient('c2');

      broker.addClient(c1);
      broker.addClient(c2);

      broker.disconnectAll();

      expect(broker.getClientCount()).toBe(0);
      expect(c1.closed).toBe(true);
      expect(c2.closed).toBe(true);
    });
  });

  describe('createSSEBroker factory', () => {
    it('should create an SSEBrokerImpl instance', () => {
      const b = createSSEBroker();
      expect(b).toBeInstanceOf(SSEBrokerImpl);
      expect(b.getClientCount()).toBe(0);
    });
  });
});
