/**
 * Tests for DashboardAPI
 *
 * Validates REST endpoint behavior including health checks,
 * snapshot retrieval, agent queries, task submission, and SSE client counts.
 */

import { DashboardAPI, createDashboardAPI } from '@/ui/web/dashboard-api';
import { WebServer } from '@/ui/web/web-server';
import type { WebRequest } from '@/ui/web/interfaces/web.interface';
import type { IHUDDashboard, HUDSnapshot, AgentHUDStatus } from '@/core/hud';
import type { IACPMessageBus, ACPMessage, ACPMessageType, ACPHandler, ACPSubscription } from '@/core/protocols';

function makeRequest(overrides: Partial<WebRequest> = {}): WebRequest {
  return {
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    headers: {},
    ...overrides,
  };
}

function createMockDashboard(overrides: Partial<{ agents: AgentHUDStatus[]; systemHealth: number }> = {}): IHUDDashboard {
  const agents: AgentHUDStatus[] = overrides.agents ?? [
    {
      agentId: 'agent-1',
      agentType: 'planning',
      state: 'working',
      progress: 50,
      tokensUsed: 1000,
      elapsedMs: 5000,
      updatedAt: new Date().toISOString(),
    },
  ];
  const systemHealth = overrides.systemHealth ?? 85;

  return {
    snapshot: jest.fn((): HUDSnapshot => ({
      timestamp: new Date().toISOString(),
      agents,
      metrics: [],
      warnings: [],
      systemHealth,
    })),
    updateAgent: jest.fn(),
    removeAgent: jest.fn(),
    addWarning: jest.fn(),
    clearWarnings: jest.fn(),
  };
}

function createMockBus(): IACPMessageBus {
  const handlers = new Map<string, ACPHandler[]>();

  return {
    publish: jest.fn(async (msg: ACPMessage) => {
      const list = handlers.get(msg.type) || [];
      for (const h of list) await h(msg);
    }),
    subscribe: jest.fn(),
    on: jest.fn((type: ACPMessageType, handler: ACPHandler): ACPSubscription => {
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
    request: jest.fn(),
    subscriptionCount: jest.fn(() => 0),
    clear: jest.fn(),
  };
}

describe('DashboardAPI', () => {
  let server: WebServer;

  beforeEach(() => {
    server = new WebServer();
  });

  describe('GET /api/health', () => {
    it('should return ok status when no dashboard is configured', async () => {
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/health' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', health: 100 });
    });

    it('should return health derived from dashboard snapshot', async () => {
      const dashboard = createMockDashboard({ systemHealth: 85 });
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/health' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'healthy', health: 85 });
    });

    it('should return degraded when health is between 40 and 70', async () => {
      const dashboard = createMockDashboard({ systemHealth: 55 });
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/health' }),
      );
      expect(response.body).toEqual({ status: 'degraded', health: 55 });
    });
  });

  describe('GET /api/snapshot', () => {
    it('should return 503 when dashboard is not configured', async () => {
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/snapshot' }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Dashboard not configured' });
    });

    it('should return the full HUD snapshot', async () => {
      const dashboard = createMockDashboard();
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/snapshot' }),
      );
      expect(response.status).toBe(200);
      const body = response.body as HUDSnapshot;
      expect(body.agents).toHaveLength(1);
      expect(body.systemHealth).toBe(85);
    });
  });

  describe('GET /api/agents', () => {
    it('should return the list of agents', async () => {
      const dashboard = createMockDashboard();
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/agents' }),
      );
      expect(response.status).toBe(200);
      const body = response.body as { agents: AgentHUDStatus[] };
      expect(body.agents).toHaveLength(1);
      expect(body.agents[0].agentId).toBe('agent-1');
    });
  });

  describe('GET /api/agents/:agentId', () => {
    it('should return a specific agent by ID', async () => {
      const dashboard = createMockDashboard();
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/agents/agent-1' }),
      );
      expect(response.status).toBe(200);
      const body = response.body as AgentHUDStatus;
      expect(body.agentId).toBe('agent-1');
    });

    it('should return 404 for unknown agent', async () => {
      const dashboard = createMockDashboard();
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/agents/unknown-agent' }),
      );
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Agent not found' });
    });
  });

  describe('POST /api/tasks', () => {
    it('should submit a task via the message bus', async () => {
      const bus = createMockBus();
      void createDashboardAPI({ server, messageBus: bus });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/tasks',
          body: { name: 'Fix bug', description: 'Critical bug fix' },
        }),
      );

      expect(response.status).toBe(202);
      const body = response.body as { taskId: string; status: string };
      expect(body.status).toBe('accepted');
      expect(body.taskId).toBeDefined();
      expect(bus.publish).toHaveBeenCalledTimes(1);
    });

    it('should return 400 when task name is missing', async () => {
      const bus = createMockBus();
      void createDashboardAPI({ server, messageBus: bus });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/tasks',
          body: { description: 'no name' },
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Task name is required' });
    });

    it('should return 503 when message bus is not configured', async () => {
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/tasks',
          body: { name: 'test' },
        }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Message bus not configured' });
    });
  });

  describe('GET /api/sse/clients', () => {
    it('should return 0 clients when no SSE broker is configured', async () => {
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/sse/clients' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ clients: 0 });
    });

    it('should return client count from SSE broker', async () => {
      const sseBroker = {
        addClient: jest.fn(),
        removeClient: jest.fn(),
        broadcast: jest.fn(),
        getClientCount: jest.fn(() => 3),
      };
      void createDashboardAPI({ server, sseBroker });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/sse/clients' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ clients: 3 });
    });
  });

  describe('createDashboardAPI factory', () => {
    it('should create a DashboardAPI instance', () => {
      const api = createDashboardAPI({ server });
      expect(api).toBeInstanceOf(DashboardAPI);
      expect(api.getServer()).toBe(server);
    });
  });
});
