/**
 * Dashboard API Coverage Tests
 *
 * Supplements the existing dashboard-api.test.ts to cover uncovered
 * endpoints: MCP servers, pool stats, instincts, analytics,
 * collaboration sessions, and edge cases.
 */

import { DashboardAPI, createDashboardAPI } from '@/ui/web/dashboard-api';
import { WebServer } from '@/ui/web/web-server';
import type { WebRequest } from '@/ui/web/interfaces/web.interface';
import type { IHUDDashboard, HUDSnapshot, AgentHUDStatus } from '@/core/hud';
import type { IACPMessageBus, ACPMessage, ACPMessageType, ACPHandler, ACPSubscription } from '@/core/protocols';
import { ServiceRegistry } from '@/core/services/service-registry';

// ---------------------------------------------------------------------------
// Mock ServiceRegistry so we can control what each getter returns
// ---------------------------------------------------------------------------

jest.mock('@/core/services/service-registry', () => {
  const mockInstance = {
    getMCPConnectionManager: jest.fn(),
    getInstinctStore: jest.fn(),
    getUsageTracker: jest.fn(),
    getCollaborationHub: jest.fn(),
  };
  return {
    ServiceRegistry: {
      getInstance: jest.fn(() => mockInstance),
      __mockInstance: mockInstance,
    },
  };
});

jest.mock('@/core/analytics/cost-reporter', () => {
  return {
    CostReporter: jest.fn().mockImplementation(() => ({
      generateReport: jest.fn(() => ({
        totalCost: 42.5,
        period: { start: '2025-01-01', end: '2025-01-31' },
      })),
    })),
  };
});

jest.mock('@/core/learning/instinct-export', () => {
  return {
    InstinctBundleExporter: jest.fn().mockImplementation(() => ({
      export: jest.fn(() => ({
        version: '1.0.0',
        instincts: [],
        exportedAt: '2025-01-01T00:00:00Z',
      })),
    })),
  };
});

jest.mock('@/core/learning/instinct-import', () => {
  return {
    InstinctBundleImporter: jest.fn().mockImplementation(() => ({
      import: jest.fn(() => ({
        imported: 2,
        skipped: 1,
        errors: [],
      })),
    })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function createMockDashboard(
  overrides: Partial<{ agents: AgentHUDStatus[]; systemHealth: number }> = {},
): IHUDDashboard {
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

function getMockRegistryInstance(): Record<string, jest.Mock> {
  return (ServiceRegistry as any).__mockInstance;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardAPI - Coverage Supplement', () => {
  let server: WebServer;
  let registryMock: Record<string, jest.Mock>;

  beforeEach(() => {
    server = new WebServer();
    registryMock = getMockRegistryInstance();
    // Reset all registry mocks to return null by default
    Object.values(registryMock).forEach((fn) => fn.mockReturnValue(null));
  });

  // =========================================================================
  // Health edge case: unhealthy
  // =========================================================================

  describe('GET /api/health - unhealthy threshold', () => {
    it('should return unhealthy when health < 40', async () => {
      const dashboard = createMockDashboard({ systemHealth: 20 });
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/health' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'unhealthy', health: 20 });
    });

    it('should return degraded when health equals 40', async () => {
      const dashboard = createMockDashboard({ systemHealth: 40 });
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/health' }),
      );
      expect(response.body).toEqual({ status: 'degraded', health: 40 });
    });

    it('should return healthy when health equals 70', async () => {
      const dashboard = createMockDashboard({ systemHealth: 70 });
      void createDashboardAPI({ server, dashboard });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/health' }),
      );
      expect(response.body).toEqual({ status: 'healthy', health: 70 });
    });
  });

  // =========================================================================
  // Agents - no dashboard
  // =========================================================================

  describe('GET /api/agents - no dashboard', () => {
    it('should return 503 when dashboard is not configured', async () => {
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/agents' }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Dashboard not configured' });
    });
  });

  describe('GET /api/agents/:agentId - no dashboard', () => {
    it('should return 503 when dashboard is not configured', async () => {
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/agents/some-id' }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Dashboard not configured' });
    });
  });

  // =========================================================================
  // POST /api/tasks - no body
  // =========================================================================

  describe('POST /api/tasks - no body at all', () => {
    it('should return 400 when body is undefined', async () => {
      const bus: IACPMessageBus = {
        publish: jest.fn(),
        subscribe: jest.fn(),
        on: jest.fn(() => ({ unsubscribe: jest.fn() })),
        request: jest.fn(),
        subscriptionCount: jest.fn(() => 0),
        clear: jest.fn(),
      };
      void createDashboardAPI({ server, messageBus: bus });

      const response = await server.handleRequest(
        makeRequest({ method: 'POST', path: '/api/tasks' }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Task name is required' });
    });
  });

  // =========================================================================
  // MCP Servers
  // =========================================================================

  describe('GET /api/mcp/servers', () => {
    it('should return disabled state when no MCP manager', async () => {
      registryMock.getMCPConnectionManager.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/mcp/servers' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ servers: [], enabled: false, totalTools: 0 });
    });

    it('should return MCP server status when manager exists', async () => {
      registryMock.getMCPConnectionManager.mockReturnValue({
        getStatus: jest.fn(() => [
          { name: 'test-server', status: 'connected' },
        ]),
        getAllTools: jest.fn(() => ['tool-a', 'tool-b', 'tool-c']),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/mcp/servers' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        servers: [{ name: 'test-server', status: 'connected' }],
        totalTools: 3,
      });
    });
  });

  // =========================================================================
  // Pool Stats
  // =========================================================================

  describe('GET /api/pool/stats', () => {
    it('should return disabled when no runner', async () => {
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/pool/stats' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false });
    });

    it('should return disabled when runner has no pool', async () => {
      const runner = { getAgentPool: jest.fn(() => null), getBackgroundTasks: jest.fn() } as any;
      void createDashboardAPI({ server, runner });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/pool/stats' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false });
    });

    it('should return pool stats when pool exists', async () => {
      const pool = {
        stats: jest.fn(() => ({ active: 2, idle: 1, total: 3 })),
      };
      const runner = {
        getAgentPool: jest.fn(() => pool),
        getBackgroundTasks: jest.fn(() => ['t1', 't2']),
      } as any;
      void createDashboardAPI({ server, runner });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/pool/stats' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        active: 2,
        idle: 1,
        total: 3,
        backgroundTasks: 2,
      });
    });

    it('should handle null backgroundTasks gracefully', async () => {
      const pool = {
        stats: jest.fn(() => ({ active: 0, idle: 0, total: 0 })),
      };
      const runner = {
        getAgentPool: jest.fn(() => pool),
        getBackgroundTasks: jest.fn(() => null),
      } as any;
      void createDashboardAPI({ server, runner });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/pool/stats' }),
      );
      expect(response.status).toBe(200);
      expect((response.body as any).backgroundTasks).toBe(0);
    });
  });

  // =========================================================================
  // Instincts
  // =========================================================================

  describe('GET /api/instincts', () => {
    it('should return disabled state when no instinct store', async () => {
      registryMock.getInstinctStore.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/instincts' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false, instincts: [] });
    });

    it('should return instincts list when store exists', async () => {
      const mockInstincts = [
        { id: '1', trigger: 'test', confidence: 0.9 },
        { id: '2', trigger: 'build', confidence: 0.8 },
      ];
      registryMock.getInstinctStore.mockReturnValue({
        list: jest.fn(async () => mockInstincts),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/instincts' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        count: 2,
        instincts: mockInstincts,
      });
    });
  });

  // =========================================================================
  // Instinct Export
  // =========================================================================

  describe('POST /api/instincts/export', () => {
    it('should return 503 when no instinct store', async () => {
      registryMock.getInstinctStore.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ method: 'POST', path: '/api/instincts/export' }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Instinct store not configured' });
    });

    it('should export instincts successfully', async () => {
      registryMock.getInstinctStore.mockReturnValue({
        list: jest.fn(async () => []),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/instincts/export',
          body: { minConfidence: 0.5 },
        }),
      );
      expect(response.status).toBe(200);
      expect((response.body as any).version).toBe('1.0.0');
    });

    it('should export with default options when body is empty', async () => {
      registryMock.getInstinctStore.mockReturnValue({
        list: jest.fn(async () => []),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ method: 'POST', path: '/api/instincts/export' }),
      );
      expect(response.status).toBe(200);
    });
  });

  // =========================================================================
  // Instinct Import
  // =========================================================================

  describe('POST /api/instincts/import', () => {
    it('should return 503 when no instinct store', async () => {
      registryMock.getInstinctStore.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/instincts/import',
          body: { bundle: {} },
        }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Instinct store not configured' });
    });

    it('should return 400 when bundle is missing', async () => {
      registryMock.getInstinctStore.mockReturnValue({
        list: jest.fn(async () => []),
        create: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/instincts/import',
          body: {},
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Bundle is required in request body' });
    });

    it('should return 400 when body is undefined', async () => {
      registryMock.getInstinctStore.mockReturnValue({
        list: jest.fn(async () => []),
        create: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ method: 'POST', path: '/api/instincts/import' }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Bundle is required in request body' });
    });

    it('should import instincts successfully', async () => {
      const mockCreate = jest.fn();
      registryMock.getInstinctStore.mockReturnValue({
        list: jest.fn(async () => [
          { trigger: 'existing', confidence: 0.5 },
        ]),
        create: mockCreate,
      });
      void createDashboardAPI({ server });

      const bundle = {
        version: '1.0.0',
        instincts: [
          { pattern: 'test', action: 'run', confidence: 0.8, category: 'general' },
        ],
        exportedAt: '2025-01-01T00:00:00Z',
      };

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/instincts/import',
          body: { bundle, options: {} },
        }),
      );
      expect(response.status).toBe(200);
      expect((response.body as any).imported).toBe(2);
    });
  });

  // =========================================================================
  // Analytics Summary
  // =========================================================================

  describe('GET /api/analytics/summary', () => {
    it('should return disabled when no usage tracker', async () => {
      registryMock.getUsageTracker.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/analytics/summary' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false });
    });

    it('should return analytics summary with query parameters', async () => {
      const mockSummary = { totalRequests: 100, totalCost: 50.0 };
      registryMock.getUsageTracker.mockReturnValue({
        getSummary: jest.fn(() => mockSummary),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          path: '/api/analytics/summary',
          query: { since: '2025-01-01', until: '2025-01-31' },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        enabled: true,
        totalRequests: 100,
        totalCost: 50.0,
      });
    });
  });

  // =========================================================================
  // Analytics Cost Report
  // =========================================================================

  describe('GET /api/analytics/cost-report', () => {
    it('should return disabled when no usage tracker', async () => {
      registryMock.getUsageTracker.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/analytics/cost-report' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false });
    });

    it('should return cost report when tracker exists', async () => {
      registryMock.getUsageTracker.mockReturnValue({
        getSummary: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          path: '/api/analytics/cost-report',
          query: { since: '2025-01-01', until: '2025-01-31' },
        }),
      );
      expect(response.status).toBe(200);
      expect((response.body as any).enabled).toBe(true);
      expect((response.body as any).totalCost).toBe(42.5);
    });
  });

  // =========================================================================
  // Collaboration Sessions
  // =========================================================================

  describe('GET /api/collaboration/sessions', () => {
    it('should return disabled when no hub', async () => {
      registryMock.getCollaborationHub.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/collaboration/sessions' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false, sessions: [] });
    });

    it('should return sessions list when hub exists', async () => {
      const mockSessions = [{ id: 's1', name: 'Session 1' }];
      registryMock.getCollaborationHub.mockReturnValue({
        listSessions: jest.fn(() => mockSessions),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/collaboration/sessions' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: true, sessions: mockSessions });
    });
  });

  // =========================================================================
  // Create Collaboration Session
  // =========================================================================

  describe('POST /api/collaboration/sessions', () => {
    it('should return 503 when no hub', async () => {
      registryMock.getCollaborationHub.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions',
          body: { id: 'x', name: 'y', createdBy: 'z' },
        }),
      );
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Collaboration not configured' });
    });

    it('should return 400 when required fields are missing', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        createSession: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions',
          body: { id: 'x' },
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'id, name, and createdBy are required' });
    });

    it('should return 400 when body is undefined', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        createSession: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ method: 'POST', path: '/api/collaboration/sessions' }),
      );
      expect(response.status).toBe(400);
    });

    it('should create session successfully', async () => {
      const mockSession = { id: 's1', name: 'Test', createdBy: 'user1' };
      registryMock.getCollaborationHub.mockReturnValue({
        createSession: jest.fn(() => mockSession),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions',
          body: { id: 's1', name: 'Test', createdBy: 'user1' },
        }),
      );
      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockSession);
    });
  });

  // =========================================================================
  // Join Collaboration Session
  // =========================================================================

  describe('POST /api/collaboration/sessions/:id/join', () => {
    it('should return 503 when no hub', async () => {
      registryMock.getCollaborationHub.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/join',
          body: { userId: 'u1' },
        }),
      );
      expect(response.status).toBe(503);
    });

    it('should return 400 when userId is missing', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        joinSession: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/join',
          body: {},
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'userId is required' });
    });

    it('should return 404 when session not found', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        joinSession: jest.fn(() => null),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/nonexistent/join',
          body: { userId: 'u1' },
        }),
      );
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Session not found or inactive' });
    });

    it('should join session successfully', async () => {
      const session = { id: 's1', participants: ['u1'] };
      registryMock.getCollaborationHub.mockReturnValue({
        joinSession: jest.fn(() => session),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/join',
          body: { userId: 'u1' },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual(session);
    });
  });

  // =========================================================================
  // Leave Collaboration Session
  // =========================================================================

  describe('POST /api/collaboration/sessions/:id/leave', () => {
    it('should return 503 when no hub', async () => {
      registryMock.getCollaborationHub.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/leave',
          body: { userId: 'u1' },
        }),
      );
      expect(response.status).toBe(503);
    });

    it('should return 400 when userId is missing', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        leaveSession: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/leave',
          body: {},
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'userId is required' });
    });

    it('should return 404 when session not found', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        leaveSession: jest.fn(() => false),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/nonexistent/leave',
          body: { userId: 'u1' },
        }),
      );
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Session not found' });
    });

    it('should leave session successfully', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        leaveSession: jest.fn(() => true),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/leave',
          body: { userId: 'u1' },
        }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });
  });

  // =========================================================================
  // Send Collaboration Message
  // =========================================================================

  describe('POST /api/collaboration/sessions/:id/messages', () => {
    it('should return 503 when no hub', async () => {
      registryMock.getCollaborationHub.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/messages',
          body: { type: 'chat', senderId: 'u1' },
        }),
      );
      expect(response.status).toBe(503);
    });

    it('should return 400 when type or senderId is missing', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        broadcast: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/messages',
          body: { senderId: 'u1' },
        }),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'type and senderId are required' });
    });

    it('should return 400 when body is undefined', async () => {
      registryMock.getCollaborationHub.mockReturnValue({
        broadcast: jest.fn(),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/messages',
        }),
      );
      expect(response.status).toBe(400);
    });

    it('should send message successfully', async () => {
      const broadcastFn = jest.fn();
      registryMock.getCollaborationHub.mockReturnValue({
        broadcast: broadcastFn,
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/messages',
          body: { type: 'chat', senderId: 'u1', payload: { text: 'hello' } },
        }),
      );
      expect(response.status).toBe(202);
      expect(response.body).toEqual({ status: 'sent' });
      expect(broadcastFn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'chat',
          senderId: 'u1',
          sessionId: 's1',
          payload: { text: 'hello' },
        }),
      );
    });

    it('should use null payload when not provided', async () => {
      const broadcastFn = jest.fn();
      registryMock.getCollaborationHub.mockReturnValue({
        broadcast: broadcastFn,
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({
          method: 'POST',
          path: '/api/collaboration/sessions/s1/messages',
          body: { type: 'status', senderId: 'u1' },
        }),
      );
      expect(response.status).toBe(202);
      expect(broadcastFn).toHaveBeenCalledWith(
        expect.objectContaining({ payload: null }),
      );
    });
  });

  // =========================================================================
  // Get Collaboration Messages
  // =========================================================================

  describe('GET /api/collaboration/sessions/:id/messages', () => {
    it('should return disabled when no hub', async () => {
      registryMock.getCollaborationHub.mockReturnValue(null);
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/collaboration/sessions/s1/messages' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: false, messages: [] });
    });

    it('should return messages when hub exists', async () => {
      const mockMessages = [
        { type: 'chat', senderId: 'u1', payload: 'hi' },
      ];
      registryMock.getCollaborationHub.mockReturnValue({
        getMessageHistory: jest.fn(() => mockMessages),
      });
      void createDashboardAPI({ server });

      const response = await server.handleRequest(
        makeRequest({ path: '/api/collaboration/sessions/s1/messages' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ enabled: true, messages: mockMessages });
    });
  });

  // =========================================================================
  // getServer
  // =========================================================================

  describe('getServer()', () => {
    it('should return the web server instance', () => {
      const api = createDashboardAPI({ server });
      expect(api.getServer()).toBe(server);
    });
  });
});
