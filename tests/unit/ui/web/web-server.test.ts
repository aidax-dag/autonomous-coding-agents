/**
 * Tests for WebServer
 *
 * Validates HTTP routing, path parameter extraction,
 * CORS header injection, and error handling.
 */

import { WebServer, createWebServer } from '@/ui/web/web-server';
import type { WebRequest, WebResponse } from '@/ui/web/interfaces/web.interface';

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

describe('WebServer', () => {
  let server: WebServer;

  beforeEach(() => {
    server = new WebServer();
  });

  describe('start / stop', () => {
    it('should start and stop the server', () => {
      expect(server.isRunning()).toBe(false);
      server.start();
      expect(server.isRunning()).toBe(true);
      server.stop();
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('addRoute and handleRequest', () => {
    it('should add and handle a GET route', async () => {
      const handler = async (_req: WebRequest): Promise<WebResponse> => ({
        status: 200,
        body: { message: 'ok' },
      });

      server.addRoute('GET', '/api/test', handler);

      const response = await server.handleRequest(makeRequest({ path: '/api/test' }));
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'ok' });
    });

    it('should add and handle a POST route', async () => {
      const handler = async (req: WebRequest): Promise<WebResponse> => ({
        status: 201,
        body: { received: req.body },
      });

      server.addRoute('POST', '/api/items', handler);

      const response = await server.handleRequest(
        makeRequest({ method: 'POST', path: '/api/items', body: { name: 'item1' } }),
      );
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ received: { name: 'item1' } });
    });

    it('should extract path parameters', async () => {
      const handler = async (req: WebRequest): Promise<WebResponse> => ({
        status: 200,
        body: { agentId: req.params.agentId },
      });

      server.addRoute('GET', '/api/agents/:agentId', handler);

      const response = await server.handleRequest(
        makeRequest({ path: '/api/agents/agent-42' }),
      );
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ agentId: 'agent-42' });
    });
  });

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await server.handleRequest(makeRequest({ path: '/unknown' }));
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found' });
    });
  });

  describe('error handling', () => {
    it('should return 500 when handler throws', async () => {
      server.addRoute('GET', '/api/fail', async () => {
        throw new Error('handler crashed');
      });

      const response = await server.handleRequest(makeRequest({ path: '/api/fail' }));
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'handler crashed' });
    });
  });

  describe('CORS headers', () => {
    it('should add CORS headers when enabled', async () => {
      server.addRoute('GET', '/api/data', async () => ({
        status: 200,
        body: 'ok',
      }));

      const response = await server.handleRequest(makeRequest({ path: '/api/data' }));
      expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should not add CORS headers when disabled', async () => {
      const noCorsServer = new WebServer({ corsEnabled: false });
      noCorsServer.addRoute('GET', '/api/data', async () => ({
        status: 200,
        body: 'ok',
      }));

      const response = await noCorsServer.handleRequest(makeRequest({ path: '/api/data' }));
      expect(response.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  describe('route replacement', () => {
    it('should replace an existing route with same method and path', async () => {
      server.addRoute('GET', '/api/v', async () => ({
        status: 200,
        body: 'v1',
      }));

      server.addRoute('GET', '/api/v', async () => ({
        status: 200,
        body: 'v2',
      }));

      const routes = server.getRoutes();
      const matching = routes.filter(r => r.method === 'GET' && r.path === '/api/v');
      expect(matching).toHaveLength(1);

      const response = await server.handleRequest(makeRequest({ path: '/api/v' }));
      expect(response.body).toBe('v2');
    });
  });

  describe('removeRoute', () => {
    it('should remove a route so it returns 404', async () => {
      server.addRoute('GET', '/api/temp', async () => ({
        status: 200,
        body: 'temp',
      }));

      server.removeRoute('GET', '/api/temp');

      const response = await server.handleRequest(makeRequest({ path: '/api/temp' }));
      expect(response.status).toBe(404);
    });
  });

  describe('createWebServer factory', () => {
    it('should create a WebServer instance with config', () => {
      const s = createWebServer({ port: 8080, host: '0.0.0.0' });
      expect(s).toBeInstanceOf(WebServer);
      expect(s.getConfig().port).toBe(8080);
      expect(s.getConfig().host).toBe('0.0.0.0');
    });
  });
});
