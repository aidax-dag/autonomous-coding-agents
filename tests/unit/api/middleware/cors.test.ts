/**
 * CORS Middleware Tests
 *
 * Tests the CORSMiddleware class with configurable origins,
 * preflight handling, credentials, custom headers/methods,
 * wildcard mode, and environment-based configuration.
 */

import { CORSMiddleware, createCORSMiddleware } from '../../../../src/api/middleware/cors';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';
import type { WebServer } from '../../../../src/ui/web/web-server';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────

function makeRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'OPTIONS' | 'PATCH',
  path: string,
  headers: Record<string, string> = {},
): WebRequest {
  return { method: method as 'GET', path, params: {}, query: {}, headers };
}

function setupServer(): WebServer {
  const server = createWebServer({ corsEnabled: false });
  server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
  server.addRoute('POST', '/api/data', async () => ({ status: 201, body: { created: true } }));
  return server;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CORSMiddleware', () => {
  const originalEnv = process.env.CORS_ORIGINS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = originalEnv;
    }
  });

  describe('allowed origin passes with correct headers', () => {
    it('should add CORS headers for an allowed origin', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://example.com'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.status).toBe(200);
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(res.headers?.['Access-Control-Allow-Methods']).toContain('GET');
      expect(res.headers?.['Access-Control-Allow-Methods']).toContain('PATCH');
      expect(res.headers?.['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(res.headers?.['Access-Control-Allow-Headers']).toContain('X-Requested-With');
      expect(res.headers?.['Access-Control-Expose-Headers']).toContain('X-RateLimit-Limit');
      expect(res.headers?.['Vary']).toBe('Origin');
    });
  });

  describe('disallowed origin is rejected', () => {
    it('should return 403 for a disallowed origin', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://trusted.com'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://evil.com' }),
      );

      expect(res.status).toBe(403);
      expect((res.body as Record<string, unknown>).code).toBe('CORS_REJECTED');
    });

    it('should not set Access-Control-Allow-Origin for rejected origin', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://trusted.com'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://evil.com' }),
      );

      expect(res.headers?.['Access-Control-Allow-Origin']).toBeUndefined();
    });
  });

  describe('wildcard allows all origins', () => {
    it('should allow any origin with wildcard *', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({ allowedOrigins: '*' });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://anything.com' }),
      );

      expect(res.status).toBe(200);
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should default to wildcard when no origins provided', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware();
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://any-origin.com' }),
      );

      expect(res.status).toBe(200);
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });

    it('should not set Vary header when using wildcard', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({ allowedOrigins: '*' });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.headers?.['Vary']).toBeUndefined();
    });
  });

  describe('preflight OPTIONS request handling', () => {
    it('should respond with 204 and CORS headers for preflight', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://app.example.com'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('OPTIONS', '/api/data', { origin: 'https://app.example.com' }),
      );

      expect(res.status).toBe(204);
      expect(res.body).toBeNull();
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://app.example.com');
      expect(res.headers?.['Access-Control-Allow-Methods']).toContain('POST');
      expect(res.headers?.['Access-Control-Allow-Methods']).toContain('OPTIONS');
      expect(res.headers?.['Access-Control-Max-Age']).toBe('86400');
    });

    it('should not call the original handler for OPTIONS preflight', async () => {
      const handler = jest.fn(async () => ({ status: 200, body: 'should not reach' }));
      const server = createWebServer({ corsEnabled: false });
      server.addRoute('GET', '/api/test', handler);

      const middleware = createCORSMiddleware();
      middleware.install(server);

      await server.handleRequest(
        makeRequest('OPTIONS', '/api/test', { origin: 'https://example.com' }),
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('credentials header', () => {
    it('should include credentials header by default', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware();
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.headers?.['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should omit credentials header when disabled', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({ credentials: false });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.headers?.['Access-Control-Allow-Credentials']).toBeUndefined();
    });
  });

  describe('custom methods and headers', () => {
    it('should use custom allowed methods', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedMethods: ['GET', 'POST'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.headers?.['Access-Control-Allow-Methods']).toBe('GET, POST');
    });

    it('should use custom allowed headers', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedHeaders: ['Content-Type', 'X-Custom-Header'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.headers?.['Access-Control-Allow-Headers']).toBe('Content-Type, X-Custom-Header');
    });

    it('should use custom exposed headers', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        exposedHeaders: ['X-Custom-Response'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.headers?.['Access-Control-Expose-Headers']).toBe('X-Custom-Response');
    });

    it('should use custom max age', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({ maxAge: 3600 });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://example.com' }),
      );

      expect(res.headers?.['Access-Control-Max-Age']).toBe('3600');
    });
  });

  describe('multiple allowed origins', () => {
    it('should allow requests from any listed origin', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://app1.com', 'https://app2.com', 'https://app3.com'],
      });
      middleware.install(server);

      const res1 = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://app1.com' }),
      );
      expect(res1.status).toBe(200);
      expect(res1.headers?.['Access-Control-Allow-Origin']).toBe('https://app1.com');

      // Re-install on a fresh server for the second origin
      const server2 = setupServer();
      const middleware2 = createCORSMiddleware({
        allowedOrigins: ['https://app1.com', 'https://app2.com', 'https://app3.com'],
      });
      middleware2.install(server2);

      const res2 = await server2.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://app3.com' }),
      );
      expect(res2.status).toBe(200);
      expect(res2.headers?.['Access-Control-Allow-Origin']).toBe('https://app3.com');
    });

    it('should reject origins not in the allowed list', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://app1.com', 'https://app2.com'],
      });
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://not-listed.com' }),
      );

      expect(res.status).toBe(403);
    });
  });

  describe('env-based configuration', () => {
    it('should read origins from CORS_ORIGINS environment variable', async () => {
      process.env.CORS_ORIGINS = 'https://env-origin1.com, https://env-origin2.com';

      const server = setupServer();
      const middleware = createCORSMiddleware();
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://env-origin1.com' }),
      );
      expect(res.status).toBe(200);
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('https://env-origin1.com');

      // Second origin from env
      const server2 = setupServer();
      const middleware2 = createCORSMiddleware();
      middleware2.install(server2);

      const res2 = await server2.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://env-origin2.com' }),
      );
      expect(res2.status).toBe(200);
      expect(res2.headers?.['Access-Control-Allow-Origin']).toBe('https://env-origin2.com');
    });

    it('should override option origins when CORS_ORIGINS env is set', async () => {
      process.env.CORS_ORIGINS = 'https://env-only.com';

      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://option-origin.com'],
      });
      middleware.install(server);

      // Env takes precedence: option-origin should be rejected
      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://option-origin.com' }),
      );
      expect(res.status).toBe(403);

      // Env origin should be accepted
      const server2 = setupServer();
      const middleware2 = createCORSMiddleware({
        allowedOrigins: ['https://option-origin.com'],
      });
      middleware2.install(server2);

      const res2 = await server2.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://env-only.com' }),
      );
      expect(res2.status).toBe(200);
      expect(res2.headers?.['Access-Control-Allow-Origin']).toBe('https://env-only.com');
    });

    it('should handle wildcard in CORS_ORIGINS env variable', async () => {
      process.env.CORS_ORIGINS = '*';

      const server = setupServer();
      const middleware = createCORSMiddleware();
      middleware.install(server);

      const res = await server.handleRequest(
        makeRequest('GET', '/api/data', { origin: 'https://wildcard-test.com' }),
      );

      expect(res.status).toBe(200);
      expect(res.headers?.['Access-Control-Allow-Origin']).toBe('*');
    });
  });

  describe('factory function', () => {
    it('should create a CORSMiddleware instance', () => {
      const middleware = createCORSMiddleware();
      expect(middleware).toBeInstanceOf(CORSMiddleware);
    });

    it('should accept options in factory', () => {
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://factory.com'],
        credentials: false,
        maxAge: 1800,
      });
      expect(middleware).toBeInstanceOf(CORSMiddleware);
    });
  });

  describe('requests without Origin header', () => {
    it('should pass through requests without an Origin header', async () => {
      const server = setupServer();
      const middleware = createCORSMiddleware({
        allowedOrigins: ['https://trusted.com'],
      });
      middleware.install(server);

      const res = await server.handleRequest(makeRequest('GET', '/api/data'));

      // No Origin header means no CORS enforcement needed; request passes through
      expect(res.status).toBe(200);
    });
  });
});
