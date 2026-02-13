/**
 * CORS Middleware Tests
 */

import { installCORS } from '../../../../src/api/middleware/cors';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';

function makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS',
  path: string,
  headers: Record<string, string> = {},
): WebRequest {
  return { method: method as 'GET', path, params: {}, query: {}, headers };
}

describe('CORSMiddleware', () => {
  afterEach(() => {
    delete process.env.CORS_ORIGINS;
  });

  it('should add wildcard origin by default', async () => {
    const server = createWebServer({ corsEnabled: false });
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
    installCORS(server);

    const res = await server.handleRequest(makeRequest('GET', '/api/data'));

    expect(res.status).toBe(200);
    expect(res.headers).toEqual(
      expect.objectContaining({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': expect.stringContaining('GET'),
        'Access-Control-Allow-Headers': expect.stringContaining('Authorization'),
      }),
    );
  });

  it('should use custom allowed origins', async () => {
    const server = createWebServer({ corsEnabled: false });
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
    installCORS(server, { allowedOrigins: ['https://example.com', 'https://app.example.com'] });

    // Request with matching origin
    const res = await server.handleRequest(
      makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
    );
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://example.com');

    // Request with non-matching origin
    const res2 = await server.handleRequest(
      makeRequest('GET', '/api/data', { origin: 'https://evil.com' }),
    );
    expect(res2.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('should use CORS_ORIGINS environment variable', async () => {
    process.env.CORS_ORIGINS = 'https://env1.com, https://env2.com';

    const server = createWebServer({ corsEnabled: false });
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
    installCORS(server);

    const res = await server.handleRequest(
      makeRequest('GET', '/api/data', { origin: 'https://env1.com' }),
    );
    expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://env1.com');

    const res2 = await server.handleRequest(
      makeRequest('GET', '/api/data', { origin: 'https://other.com' }),
    );
    expect(res2.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('should handle preflight OPTIONS requests with 204', async () => {
    const server = createWebServer({ corsEnabled: false });
    server.addRoute('POST', '/api/data', async () => ({ status: 200, body: { ok: true } }));
    installCORS(server);

    // OPTIONS is not in HttpMethod union, but CORS middleware handles it before routing
    const req: WebRequest = {
      method: 'OPTIONS' as 'GET',
      path: '/api/data',
      params: {},
      query: {},
      headers: { origin: 'https://example.com' },
    };

    const res = await server.handleRequest(req);

    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
    expect(res.headers).toEqual(
      expect.objectContaining({
        'Access-Control-Allow-Origin': 'https://example.com',
        'Access-Control-Max-Age': '86400',
      }),
    );
  });
});
