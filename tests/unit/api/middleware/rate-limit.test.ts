/**
 * Rate Limiter Middleware Tests
 */

import { installRateLimiter } from '../../../../src/api/middleware/rate-limit';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

function makeRequest(
  path: string,
  ip: string = '192.168.1.1',
): WebRequest {
  return {
    method: 'GET',
    path,
    params: {},
    query: {},
    headers: { 'x-forwarded-for': ip },
  };
}

describe('RateLimiter', () => {
  it('should allow requests under the limit', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
    installRateLimiter(server, { maxRequests: 5, windowMs: 60000 });

    const res = await server.handleRequest(makeRequest('/api/data'));

    expect(res.status).toBe(200);
    expect(res.headers).toEqual(
      expect.objectContaining({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '4',
      }),
    );
  });

  it('should return 429 when limit is exceeded', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
    installRateLimiter(server, { maxRequests: 3, windowMs: 60000 });

    // Make 3 requests (at limit)
    for (let i = 0; i < 3; i++) {
      const res = await server.handleRequest(makeRequest('/api/data'));
      expect(res.status).toBe(200);
    }

    // 4th request should be rejected
    const res = await server.handleRequest(makeRequest('/api/data'));

    expect(res.status).toBe(429);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        status: 429,
      }),
    );
    expect(res.headers).toEqual(
      expect.objectContaining({
        'Retry-After': expect.any(String),
        'X-RateLimit-Remaining': '0',
      }),
    );
  });

  it('should track different IPs separately', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));
    installRateLimiter(server, { maxRequests: 2, windowMs: 60000 });

    // Exhaust limit for IP1
    await server.handleRequest(makeRequest('/api/data', '10.0.0.1'));
    await server.handleRequest(makeRequest('/api/data', '10.0.0.1'));
    const res1 = await server.handleRequest(makeRequest('/api/data', '10.0.0.1'));
    expect(res1.status).toBe(429);

    // IP2 should still work
    const res2 = await server.handleRequest(makeRequest('/api/data', '10.0.0.2'));
    expect(res2.status).toBe(200);
  });

  it('should reset after window expires', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { ok: true } }));

    // Use a very short window
    installRateLimiter(server, { maxRequests: 1, windowMs: 50 });

    // First request passes
    const res1 = await server.handleRequest(makeRequest('/api/data'));
    expect(res1.status).toBe(200);

    // Second request blocked
    const res2 = await server.handleRequest(makeRequest('/api/data'));
    expect(res2.status).toBe(429);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 60));

    // Should pass again
    const res3 = await server.handleRequest(makeRequest('/api/data'));
    expect(res3.status).toBe(200);
  });

  it('should skip excluded paths', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/health', async () => ({ status: 200, body: { ok: true } }));
    installRateLimiter(server, {
      maxRequests: 1,
      windowMs: 60000,
      excludePaths: ['/api/health'],
    });

    // Exhaust the limit
    await server.handleRequest(makeRequest('/api/health'));
    await server.handleRequest(makeRequest('/api/health'));

    // Health endpoint should still work (excluded from rate limiting)
    const res = await server.handleRequest(makeRequest('/api/health'));
    expect(res.status).toBe(200);
  });
});
