/**
 * Rate Limiter Middleware Tests
 *
 * Tests the RateLimiter class with sliding window algorithm,
 * per-endpoint configuration, custom key generation, and skip paths.
 */

import { RateLimiter, createRateLimiter } from '../../../../src/api/middleware/rate-limiter';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';

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
  path: string,
  ip: string = '192.168.1.1',
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
): WebRequest {
  return {
    method,
    path,
    params: {},
    query: {},
    headers: { 'x-forwarded-for': ip },
  };
}

function setupServer(): WebServer {
  const server = createWebServer();
  server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
  server.addRoute('GET', '/api/health', async () => ({ status: 200, body: { status: 'ok' } }));
  server.addRoute('POST', '/api/login', async () => ({ status: 200, body: { token: 'abc' } }));
  server.addRoute('GET', '/api/tasks', async () => ({ status: 200, body: { tasks: [] } }));
  server.addRoute('POST', '/api/tasks', async () => ({ status: 201, body: { id: '1' } }));
  return server;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  afterEach(() => {
    if (limiter) {
      limiter.destroy();
    }
  });

  describe('requests within limit', () => {
    it('should allow requests under the default limit', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      const res = await server.handleRequest(makeRequest('/api/data'));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(res.headers).toEqual(
        expect.objectContaining({
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '4',
        }),
      );
    });

    it('should decrement remaining count with each request', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 3,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      const res1 = await server.handleRequest(makeRequest('/api/data'));
      expect(res1.headers?.['X-RateLimit-Remaining']).toBe('2');

      const res2 = await server.handleRequest(makeRequest('/api/data'));
      expect(res2.headers?.['X-RateLimit-Remaining']).toBe('1');

      const res3 = await server.handleRequest(makeRequest('/api/data'));
      expect(res3.headers?.['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('requests exceeding limit', () => {
    it('should return 429 when limit is exceeded', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      // Exhaust the limit
      await server.handleRequest(makeRequest('/api/data'));
      await server.handleRequest(makeRequest('/api/data'));

      // Third request should be blocked
      const res = await server.handleRequest(makeRequest('/api/data'));

      expect(res.status).toBe(429);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: expect.any(String),
          code: 'RATE_LIMITED',
          status: 429,
        }),
      );
    });

    it('should set Retry-After header on 429', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      await server.handleRequest(makeRequest('/api/data'));
      const res = await server.handleRequest(makeRequest('/api/data'));

      expect(res.status).toBe(429);
      expect(res.headers).toBeDefined();
      expect(res.headers!['Retry-After']).toBeDefined();

      const retryAfter = parseInt(res.headers!['Retry-After'], 10);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('should set X-RateLimit-Remaining to 0 on 429', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      await server.handleRequest(makeRequest('/api/data'));
      const res = await server.handleRequest(makeRequest('/api/data'));

      expect(res.headers!['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('skipPaths', () => {
    it('should bypass rate limiting for skipped paths', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: ['/api/health'],
      });
      limiter.install(server);

      // Make many requests to the health endpoint
      for (let i = 0; i < 10; i++) {
        const res = await server.handleRequest(makeRequest('/api/health'));
        expect(res.status).toBe(200);
      }
    });

    it('should not add rate limit headers to skipped paths', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 5,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: ['/api/health'],
      });
      limiter.install(server);

      const res = await server.handleRequest(makeRequest('/api/health'));
      expect(res.status).toBe(200);
      expect(res.headers?.['X-RateLimit-Limit']).toBeUndefined();
    });

    it('should use default skip paths when none provided', async () => {
      const server = setupServer();
      // Default skipPaths includes /api/health
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
      });
      limiter.install(server);

      // Exhaust limit on data endpoint
      await server.handleRequest(makeRequest('/api/data'));
      const blocked = await server.handleRequest(makeRequest('/api/data'));
      expect(blocked.status).toBe(429);

      // Health should still work
      const health = await server.handleRequest(makeRequest('/api/health'));
      expect(health.status).toBe(200);
    });
  });

  describe('per-endpoint configuration', () => {
    it('should apply endpoint-specific limits', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 100,
        windowMs: 60_000,
        endpointLimits: {
          '/api/login': { windowMs: 60_000, maxRequests: 2 },
        },
        skipPaths: [],
      });
      limiter.install(server);

      // Login endpoint should be limited to 2
      await server.handleRequest(makeRequest('/api/login', '10.0.0.1', 'POST'));
      await server.handleRequest(makeRequest('/api/login', '10.0.0.1', 'POST'));
      const loginRes = await server.handleRequest(makeRequest('/api/login', '10.0.0.1', 'POST'));
      expect(loginRes.status).toBe(429);

      // General endpoint should still work (100 limit)
      const dataRes = await server.handleRequest(makeRequest('/api/data', '10.0.0.1'));
      expect(dataRes.status).toBe(200);
    });

    it('should track endpoint limits independently from default limits', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60_000,
        endpointLimits: {
          '/api/tasks': { windowMs: 60_000, maxRequests: 3 },
        },
        skipPaths: [],
      });
      limiter.install(server);

      // Exhaust the default limit on /api/data
      await server.handleRequest(makeRequest('/api/data'));
      await server.handleRequest(makeRequest('/api/data'));
      const dataRes = await server.handleRequest(makeRequest('/api/data'));
      expect(dataRes.status).toBe(429);

      // /api/tasks should still work (separate bucket)
      const tasksRes = await server.handleRequest(makeRequest('/api/tasks'));
      expect(tasksRes.status).toBe(200);
    });

    it('should report correct limit in headers for endpoint-specific limits', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 100,
        windowMs: 60_000,
        endpointLimits: {
          '/api/login': { windowMs: 60_000, maxRequests: 10 },
        },
        skipPaths: [],
      });
      limiter.install(server);

      const res = await server.handleRequest(makeRequest('/api/login', '10.0.0.1', 'POST'));
      expect(res.headers?.['X-RateLimit-Limit']).toBe('10');
      expect(res.headers?.['X-RateLimit-Remaining']).toBe('9');
    });
  });

  describe('key generation', () => {
    it('should track different IPs separately', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      // Exhaust limit for IP 10.0.0.1
      await server.handleRequest(makeRequest('/api/data', '10.0.0.1'));
      await server.handleRequest(makeRequest('/api/data', '10.0.0.1'));
      const res1 = await server.handleRequest(makeRequest('/api/data', '10.0.0.1'));
      expect(res1.status).toBe(429);

      // IP 10.0.0.2 should still be allowed
      const res2 = await server.handleRequest(makeRequest('/api/data', '10.0.0.2'));
      expect(res2.status).toBe(200);
    });

    it('should support custom key generator', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
        keyGenerator: (req) => req.headers['x-api-key'] || 'anonymous',
      });
      limiter.install(server);

      const makeReqWithKey = (apiKey: string): WebRequest => ({
        method: 'GET',
        path: '/api/data',
        params: {},
        query: {},
        headers: { 'x-forwarded-for': '10.0.0.1', 'x-api-key': apiKey },
      });

      // Exhaust limit for key-a
      await server.handleRequest(makeReqWithKey('key-a'));
      await server.handleRequest(makeReqWithKey('key-a'));
      const res1 = await server.handleRequest(makeReqWithKey('key-a'));
      expect(res1.status).toBe(429);

      // key-b should still pass (same IP, different key)
      const res2 = await server.handleRequest(makeReqWithKey('key-b'));
      expect(res2.status).toBe(200);
    });

    it('should default to x-forwarded-for header', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      const req: WebRequest = {
        method: 'GET',
        path: '/api/data',
        params: {},
        query: {},
        headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
      };

      await server.handleRequest(req);

      // Second request from same first IP should count against the same bucket
      const res = await server.handleRequest(req);
      expect(res.status).toBe(429);
    });
  });

  describe('window reset', () => {
    it('should allow requests again after window expires', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 50, // 50ms window for fast test
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      // First request passes
      const res1 = await server.handleRequest(makeRequest('/api/data'));
      expect(res1.status).toBe(200);

      // Second request blocked
      const res2 = await server.handleRequest(makeRequest('/api/data'));
      expect(res2.status).toBe(429);

      // Wait for the sliding window to expire
      await new Promise(resolve => setTimeout(resolve, 60));

      // Should be allowed again
      const res3 = await server.handleRequest(makeRequest('/api/data'));
      expect(res3.status).toBe(200);
    });

    it('should use sliding window (not fixed window)', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 2,
        windowMs: 100, // 100ms window
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      // Request at t=0
      const res1 = await server.handleRequest(makeRequest('/api/data'));
      expect(res1.status).toBe(200);

      // Wait 60ms, then request at t~60ms
      await new Promise(resolve => setTimeout(resolve, 60));
      const res2 = await server.handleRequest(makeRequest('/api/data'));
      expect(res2.status).toBe(200);

      // Request at t~60ms should be blocked (2 requests in last 100ms)
      const res3 = await server.handleRequest(makeRequest('/api/data'));
      expect(res3.status).toBe(429);

      // Wait 50ms so that the first request (t=0) slides out of the 100ms window
      // Now at t~110ms, the first request from t=0 is outside the window
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should be allowed again (only request from t~60ms is still in window)
      const res4 = await server.handleRequest(makeRequest('/api/data'));
      expect(res4.status).toBe(200);
    });
  });

  describe('custom error message', () => {
    it('should use custom message on 429 response', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
        message: 'Slow down, partner',
      });
      limiter.install(server);

      await server.handleRequest(makeRequest('/api/data'));
      const res = await server.handleRequest(makeRequest('/api/data'));

      expect(res.status).toBe(429);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: 'Slow down, partner',
        }),
      );
    });

    it('should use default message when none provided', async () => {
      const server = setupServer();
      limiter = new RateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      await server.handleRequest(makeRequest('/api/data'));
      const res = await server.handleRequest(makeRequest('/api/data'));

      expect(res.status).toBe(429);
      expect(res.body).toEqual(
        expect.objectContaining({
          error: 'Too many requests, please try again later',
        }),
      );
    });
  });

  describe('createRateLimiter factory', () => {
    it('should create a RateLimiter instance', () => {
      limiter = createRateLimiter();
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should accept options', () => {
      limiter = createRateLimiter({
        maxRequests: 50,
        windowMs: 30_000,
        message: 'Custom',
      });
      expect(limiter).toBeInstanceOf(RateLimiter);
    });

    it('should create a working rate limiter', async () => {
      const server = setupServer();
      limiter = createRateLimiter({
        maxRequests: 1,
        windowMs: 60_000,
        endpointLimits: {},
        skipPaths: [],
      });
      limiter.install(server);

      const res1 = await server.handleRequest(makeRequest('/api/data'));
      expect(res1.status).toBe(200);

      const res2 = await server.handleRequest(makeRequest('/api/data'));
      expect(res2.status).toBe(429);
    });
  });

  describe('destroy', () => {
    it('should clear all entries and stop cleanup timer', () => {
      limiter = new RateLimiter();

      // Should not throw
      expect(() => limiter.destroy()).not.toThrow();
    });

    it('should be safe to call multiple times', () => {
      limiter = new RateLimiter();
      limiter.destroy();

      expect(() => limiter.destroy()).not.toThrow();
    });
  });
});
