/**
 * Tests for WebDashboardApp
 *
 * Validates dashboard lifecycle (start/stop), ACP subscription
 * for SSE broadcast, and component exposure.
 */

import { WebDashboardApp, createWebDashboard } from '@/ui/web/web-dashboard';
import { WebServer } from '@/ui/web/web-server';
import { DashboardAPI } from '@/ui/web/dashboard-api';
import type { IACPMessageBus, ACPMessage, ACPMessageType, ACPHandler, ACPSubscription } from '@/core/protocols';

function createMockBus(): IACPMessageBus & { fireAgentStatus: (payload: unknown) => Promise<void> } {
  const handlers = new Map<string, ACPHandler[]>();

  const bus: IACPMessageBus & { fireAgentStatus: (payload: unknown) => Promise<void> } = {
    publish: jest.fn(async (msg: ACPMessage) => {
      const list = handlers.get(msg.type) || [];
      for (const h of list) await h(msg);
    }),
    subscribe: jest.fn(),
    on: jest.fn((type: ACPMessageType, handler: ACPHandler): ACPSubscription => {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type)!.push(handler);
      return {
        unsubscribe: jest.fn(() => {
          const list = handlers.get(type)!;
          const idx = list.indexOf(handler);
          if (idx >= 0) list.splice(idx, 1);
        }),
      };
    }),
    request: jest.fn(),
    subscriptionCount: jest.fn(() => 0),
    clear: jest.fn(),
    fireAgentStatus: async (payload: unknown) => {
      const list = handlers.get('agent:status') || [];
      for (const h of list) {
        await h({
          id: 'test-msg',
          type: 'agent:status',
          source: 'test',
          target: 'broadcast',
          payload,
          priority: 'normal',
          timestamp: new Date().toISOString(),
        });
      }
    },
  };

  return bus;
}

describe('WebDashboardApp', () => {
  describe('start / stop lifecycle', () => {
    it('should create, start, and stop successfully', () => {
      const app = new WebDashboardApp();
      expect(app.isRunning()).toBe(false);

      app.start();
      expect(app.isRunning()).toBe(true);

      app.stop();
      expect(app.isRunning()).toBe(false);
    });

    it('should be idempotent for multiple start/stop calls', () => {
      const app = new WebDashboardApp();

      app.start();
      app.start(); // second start should be no-op
      expect(app.isRunning()).toBe(true);

      app.stop();
      app.stop(); // second stop should be no-op
      expect(app.isRunning()).toBe(false);
    });
  });

  describe('ACP subscription', () => {
    it('should subscribe to agent:status on start', () => {
      const bus = createMockBus();
      const app = new WebDashboardApp({ messageBus: bus });

      app.start();
      expect(bus.on).toHaveBeenCalledWith('agent:status', expect.any(Function));

      app.stop();
    });

    it('should unsubscribe on stop', () => {
      const bus = createMockBus();
      const app = new WebDashboardApp({ messageBus: bus });

      app.start();

      // Get the subscription's unsubscribe mock
      const onCall = (bus.on as jest.Mock).mock.results[0];
      const subscription = onCall.value as ACPSubscription;

      app.stop();
      expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('should broadcast agent:status events via SSE broker', async () => {
      const bus = createMockBus();
      const app = new WebDashboardApp({ messageBus: bus });
      const sseBroker = app.getSSEBroker();

      // Spy on broadcast
      const broadcastSpy = jest.spyOn(sseBroker as any, 'broadcast');

      app.start();

      // Simulate agent:status event through the message bus
      await bus.fireAgentStatus({ agentId: 'a1', status: 'busy' });

      expect(broadcastSpy).toHaveBeenCalledWith('agent:status', { agentId: 'a1', status: 'busy' });

      app.stop();
    });
  });

  describe('component exposure', () => {
    it('should expose server, API, and SSE broker', () => {
      const app = new WebDashboardApp();

      expect(app.getServer()).toBeInstanceOf(WebServer);
      expect(app.getAPI()).toBeInstanceOf(DashboardAPI);
      expect(app.getSSEBroker()).toBeDefined();
      expect(app.getSSEBroker().getClientCount()).toBe(0);
    });
  });

  describe('createWebDashboard factory', () => {
    it('should create a WebDashboardApp with options', () => {
      const app = createWebDashboard({
        config: { server: { port: 9090 } },
      });
      expect(app).toBeInstanceOf(WebDashboardApp);
      expect(app.getServer().getConfig().port).toBe(9090);
    });
  });
});
