/**
 * OpenAPI Documentation Serve Tests
 *
 * Validates that the OpenAPI spec and Swagger UI routes
 * are installed correctly and return expected content.
 *
 * @module tests/unit/api/docs/openapi-serve
 */

import { installOpenAPIDocs, buildOpenAPISpec } from '@/api/docs/openapi-serve';
import type { IWebServer, RouteHandler } from '@/ui/web/interfaces/web.interface';

describe('OpenAPI Documentation', () => {
  let mockServer: IWebServer;
  let registeredRoutes: Map<string, RouteHandler>;

  beforeEach(() => {
    registeredRoutes = new Map();
    mockServer = {
      addRoute: jest.fn((method: string, path: string, handler: RouteHandler) => {
        registeredRoutes.set(`${method} ${path}`, handler);
      }),
      removeRoute: jest.fn(),
      handleRequest: jest.fn(),
      getRoutes: jest.fn(() => []),
      isRunning: jest.fn(() => false),
      start: jest.fn(),
      stop: jest.fn(),
    };
  });

  describe('installOpenAPIDocs', () => {
    it('should register GET /api/docs/openapi.json route', () => {
      installOpenAPIDocs(mockServer);

      expect(mockServer.addRoute).toHaveBeenCalledWith(
        'GET',
        '/api/docs/openapi.json',
        expect.any(Function),
      );
    });

    it('should register GET /api/docs route', () => {
      installOpenAPIDocs(mockServer);

      expect(mockServer.addRoute).toHaveBeenCalledWith(
        'GET',
        '/api/docs',
        expect.any(Function),
      );
    });

    it('should register exactly two routes', () => {
      installOpenAPIDocs(mockServer);

      expect(mockServer.addRoute).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET /api/docs/openapi.json', () => {
    it('should return valid OpenAPI JSON with openapi field', async () => {
      installOpenAPIDocs(mockServer);
      const handler = registeredRoutes.get('GET /api/docs/openapi.json')!;
      expect(handler).toBeDefined();

      const response = await handler({
        method: 'GET',
        path: '/api/docs/openapi.json',
        params: {},
        query: {},
        headers: {},
      });

      expect(response.status).toBe(200);
      const body = response.body as Record<string, unknown>;
      expect(body.openapi).toBe('3.0.3');
    });

    it('should include info section with title and version', async () => {
      installOpenAPIDocs(mockServer);
      const handler = registeredRoutes.get('GET /api/docs/openapi.json')!;

      const response = await handler({
        method: 'GET',
        path: '/api/docs/openapi.json',
        params: {},
        query: {},
        headers: {},
      });

      const body = response.body as Record<string, unknown>;
      const info = body.info as Record<string, unknown>;
      expect(info.title).toBe('ACA API');
      expect(info.version).toBeDefined();
    });

    it('should set Content-Type to application/json', async () => {
      installOpenAPIDocs(mockServer);
      const handler = registeredRoutes.get('GET /api/docs/openapi.json')!;

      const response = await handler({
        method: 'GET',
        path: '/api/docs/openapi.json',
        params: {},
        query: {},
        headers: {},
      });

      expect(response.headers).toEqual(
        expect.objectContaining({ 'Content-Type': 'application/json' }),
      );
    });

    it('should contain expected API paths', async () => {
      installOpenAPIDocs(mockServer);
      const handler = registeredRoutes.get('GET /api/docs/openapi.json')!;

      const response = await handler({
        method: 'GET',
        path: '/api/docs/openapi.json',
        params: {},
        query: {},
        headers: {},
      });

      const body = response.body as Record<string, unknown>;
      const paths = body.paths as Record<string, unknown>;
      expect(paths['/api/health']).toBeDefined();
      expect(paths['/api/login']).toBeDefined();
      expect(paths['/api/agents']).toBeDefined();
      expect(paths['/api/tasks']).toBeDefined();
    });
  });

  describe('GET /api/docs', () => {
    it('should return HTML containing swagger-ui', async () => {
      installOpenAPIDocs(mockServer);
      const handler = registeredRoutes.get('GET /api/docs')!;
      expect(handler).toBeDefined();

      const response = await handler({
        method: 'GET',
        path: '/api/docs',
        params: {},
        query: {},
        headers: {},
      });

      expect(response.status).toBe(200);
      const html = response.body as string;
      expect(html).toContain('swagger-ui');
      expect(html).toContain('SwaggerUIBundle');
      expect(html).toContain('/api/docs/openapi.json');
    });

    it('should set Content-Type to text/html', async () => {
      installOpenAPIDocs(mockServer);
      const handler = registeredRoutes.get('GET /api/docs')!;

      const response = await handler({
        method: 'GET',
        path: '/api/docs',
        params: {},
        query: {},
        headers: {},
      });

      expect(response.headers).toEqual(
        expect.objectContaining({ 'Content-Type': 'text/html; charset=utf-8' }),
      );
    });
  });

  describe('buildOpenAPISpec', () => {
    it('should return a valid OpenAPI 3.0 spec object', () => {
      const spec = buildOpenAPISpec();

      expect(spec.openapi).toBe('3.0.3');
      expect(spec.info).toBeDefined();
      expect(spec.paths).toBeDefined();
      expect(spec.components).toBeDefined();
      expect(spec.tags).toBeDefined();
    });

    it('should contain security schemes', () => {
      const spec = buildOpenAPISpec();

      expect(spec.components.securitySchemes).toBeDefined();
      expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
    });

    it('should include tags from registered endpoints', () => {
      const spec = buildOpenAPISpec();
      const tagNames = spec.tags.map((t) => t.name);

      expect(tagNames).toContain('system');
      expect(tagNames).toContain('auth');
      expect(tagNames).toContain('agents');
    });
  });
});
