/**
 * Agents Router Tests
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module tests/unit/api/routes/agents
 */

import { AgentsRouter, createAgentsRouter } from '../../../../src/api/routes/agents.router';
import { AgentType } from '../../../../src/core/interfaces/agent.interface';

describe('AgentsRouter', () => {
  let router: AgentsRouter;

  beforeEach(() => {
    router = new AgentsRouter();
  });

  describe('constructor', () => {
    it('should create router with correct prefix', () => {
      expect(router.prefix).toBe('/agents');
    });

    it('should initialize routes', () => {
      const routes = router.getRoutes();
      expect(routes.length).toBeGreaterThan(0);
    });
  });

  describe('createAgentsRouter', () => {
    it('should create router via factory function', () => {
      const router = createAgentsRouter();
      expect(router).toBeInstanceOf(AgentsRouter);
    });
  });

  describe('getRoutes', () => {
    it('should return route definitions', () => {
      const routes = router.getRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });

    it('should include list agents route', () => {
      const routes = router.getRoutes();
      const listRoute = routes.find((r) => r.method === 'GET' && r.path === '');
      expect(listRoute).toBeDefined();
      expect(listRoute?.schema?.summary).toBe('List all agents');
    });

    it('should include create agent route', () => {
      const routes = router.getRoutes();
      const createRoute = routes.find((r) => r.method === 'POST' && r.path === '');
      expect(createRoute).toBeDefined();
      expect(createRoute?.schema?.summary).toBe('Create a new agent');
    });

    it('should include get agent route', () => {
      const routes = router.getRoutes();
      const getRoute = routes.find((r) => r.method === 'GET' && r.path === '/:agentId');
      expect(getRoute).toBeDefined();
      expect(getRoute?.schema?.summary).toBe('Get agent by ID');
    });

    it('should include update agent route', () => {
      const routes = router.getRoutes();
      const updateRoute = routes.find((r) => r.method === 'PATCH' && r.path === '/:agentId');
      expect(updateRoute).toBeDefined();
      expect(updateRoute?.schema?.summary).toBe('Update agent');
    });

    it('should include delete agent route', () => {
      const routes = router.getRoutes();
      const deleteRoute = routes.find((r) => r.method === 'DELETE' && r.path === '/:agentId');
      expect(deleteRoute).toBeDefined();
      expect(deleteRoute?.schema?.summary).toBe('Delete agent');
    });

    it('should include start agent route', () => {
      const routes = router.getRoutes();
      const startRoute = routes.find((r) => r.method === 'POST' && r.path === '/:agentId/start');
      expect(startRoute).toBeDefined();
    });

    it('should include stop agent route', () => {
      const routes = router.getRoutes();
      const stopRoute = routes.find((r) => r.method === 'POST' && r.path === '/:agentId/stop');
      expect(stopRoute).toBeDefined();
    });

    it('should include pause agent route', () => {
      const routes = router.getRoutes();
      const pauseRoute = routes.find((r) => r.method === 'POST' && r.path === '/:agentId/pause');
      expect(pauseRoute).toBeDefined();
    });

    it('should include resume agent route', () => {
      const routes = router.getRoutes();
      const resumeRoute = routes.find((r) => r.method === 'POST' && r.path === '/:agentId/resume');
      expect(resumeRoute).toBeDefined();
    });

    it('should include submit task route', () => {
      const routes = router.getRoutes();
      const taskRoute = routes.find((r) => r.method === 'POST' && r.path === '/:agentId/tasks');
      expect(taskRoute).toBeDefined();
    });

    it('should include health route', () => {
      const routes = router.getRoutes();
      const healthRoute = routes.find((r) => r.method === 'GET' && r.path === '/:agentId/health');
      expect(healthRoute).toBeDefined();
    });

    it('should include capabilities route', () => {
      const routes = router.getRoutes();
      const capRoute = routes.find((r) => r.method === 'GET' && r.path === '/:agentId/capabilities');
      expect(capRoute).toBeDefined();
    });

    it('should include task status route', () => {
      const routes = router.getRoutes();
      const taskStatusRoute = routes.find((r) => r.method === 'GET' && r.path === '/:agentId/tasks/:taskId');
      expect(taskStatusRoute).toBeDefined();
    });
  });

  describe('route schemas', () => {
    it('should have valid schema for create agent', () => {
      const routes = router.getRoutes();
      const createRoute = routes.find((r) => r.method === 'POST' && r.path === '');
      const schema = createRoute?.schema;

      expect(schema?.body).toBeDefined();
      const body = schema?.body as Record<string, unknown>;
      expect(body?.type).toBe('object');
      expect(body?.required).toContain('type');
      expect(body?.required).toContain('name');
      expect(body?.required).toContain('llm');
    });

    it('should have valid enum values for agent type', () => {
      const routes = router.getRoutes();
      const createRoute = routes.find((r) => r.method === 'POST' && r.path === '');
      const schema = createRoute?.schema;
      const body = schema?.body as Record<string, unknown>;
      const properties = body?.properties as Record<string, Record<string, unknown>>;

      expect(properties?.type?.enum).toEqual(Object.values(AgentType));
    });

    it('should have valid query schema for list', () => {
      const routes = router.getRoutes();
      const listRoute = routes.find((r) => r.method === 'GET' && r.path === '');
      const schema = listRoute?.schema;

      expect(schema?.querystring).toBeDefined();
      const querystring = schema?.querystring as Record<string, unknown>;
      const properties = querystring?.properties as Record<string, unknown>;
      expect(properties?.page).toBeDefined();
      expect(properties?.limit).toBeDefined();
    });

    it('should have valid params schema for get', () => {
      const routes = router.getRoutes();
      const getRoute = routes.find((r) => r.method === 'GET' && r.path === '/:agentId');
      const schema = getRoute?.schema;

      expect(schema?.params).toBeDefined();
      const params = schema?.params as Record<string, unknown>;
      expect(params?.required).toContain('agentId');
    });
  });

  describe('route handlers', () => {
    it('should have handler for all routes', () => {
      const routes = router.getRoutes();
      for (const route of routes) {
        expect(route.handler).toBeDefined();
        expect(typeof route.handler).toBe('function');
      }
    });
  });

  describe('route tags', () => {
    it('should have Agents tag for all routes', () => {
      const routes = router.getRoutes();
      for (const route of routes) {
        expect(route.schema?.tags).toContain('Agents');
      }
    });
  });

  describe('route count', () => {
    it('should have expected number of routes', () => {
      const routes = router.getRoutes();
      // List, Create, Get, Update, Delete, Start, Stop, Pause, Resume, Tasks, Health, Capabilities, TaskStatus
      expect(routes.length).toBe(13);
    });
  });
});
