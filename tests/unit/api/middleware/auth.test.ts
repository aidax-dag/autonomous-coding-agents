/**
 * Auth Middleware Tests
 */

import { installAuthMiddleware } from '../../../../src/api/middleware/auth';
import { createJWTService } from '../../../../src/api/auth/jwt';
import { createAPIKeyService } from '../../../../src/api/auth/api-key';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const TEST_SECRET = 'test-secret-key-that-is-long-enough';

function makeRequest(
  method: 'GET' | 'POST',
  path: string,
  headers: Record<string, string> = {},
): WebRequest {
  return { method, path, params: {}, query: {}, headers };
}

describe('AuthMiddleware', () => {
  const jwtService = createJWTService({ secret: TEST_SECRET });
  const apiKeyService = createAPIKeyService({ keys: ['valid-api-key-123'] });

  it('should allow requests to excluded paths without auth', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/health', async () => ({ status: 200, body: { ok: true } }));
    installAuthMiddleware(server, { jwtService });

    const res = await server.handleRequest(makeRequest('GET', '/api/health'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('should allow custom excluded paths', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/public/info', async () => ({ status: 200, body: { info: 'open' } }));
    installAuthMiddleware(server, {
      jwtService,
      excludePaths: ['/public/info', '/api/health'],
    });

    const res = await server.handleRequest(makeRequest('GET', '/public/info'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ info: 'open' });
  });

  it('should accept a valid Bearer token', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { data: 'secret' } }));
    installAuthMiddleware(server, { jwtService });

    const token = jwtService.generateAccessToken('user1', 'admin');
    const res = await server.handleRequest(
      makeRequest('GET', '/api/data', { authorization: `Bearer ${token}` }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: 'secret' });
  });

  it('should attach user info to request headers on valid JWT', async () => {
    const server = createWebServer();
    let capturedHeaders: Record<string, string> = {};
    server.addRoute('GET', '/api/profile', async (req) => {
      capturedHeaders = req.headers;
      return { status: 200, body: { ok: true } };
    });
    installAuthMiddleware(server, { jwtService });

    const token = jwtService.generateAccessToken('user42', 'editor');
    await server.handleRequest(
      makeRequest('GET', '/api/profile', { authorization: `Bearer ${token}` }),
    );

    expect(capturedHeaders['x-auth-sub']).toBe('user42');
    expect(capturedHeaders['x-auth-role']).toBe('editor');
  });

  it('should reject an invalid Bearer token with 401', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { data: 'secret' } }));
    installAuthMiddleware(server, { jwtService });

    const res = await server.handleRequest(
      makeRequest('GET', '/api/data', { authorization: 'Bearer invalid-token' }),
    );

    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      expect.objectContaining({ code: 'UNAUTHORIZED', status: 401 }),
    );
  });

  it('should accept a valid API key', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { data: 'open' } }));
    installAuthMiddleware(server, { jwtService, apiKeyService });

    const res = await server.handleRequest(
      makeRequest('GET', '/api/data', { 'x-api-key': 'valid-api-key-123' }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: 'open' });
  });

  it('should return 401 when no credentials are provided', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: { data: 'secret' } }));
    installAuthMiddleware(server, { jwtService, apiKeyService });

    const res = await server.handleRequest(makeRequest('GET', '/api/data'));

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      status: 401,
    });
  });

  it('should return 401 for expired token', async () => {
    const expiredService = createJWTService({
      secret: TEST_SECRET,
      accessTokenTTL: -10,
    });
    const token = expiredService.generateAccessToken('user1', 'admin');

    const server = createWebServer();
    server.addRoute('GET', '/api/data', async () => ({ status: 200, body: {} }));
    installAuthMiddleware(server, { jwtService });

    const res = await server.handleRequest(
      makeRequest('GET', '/api/data', { authorization: `Bearer ${token}` }),
    );

    expect(res.status).toBe(401);
    expect(res.body).toEqual(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });
});
