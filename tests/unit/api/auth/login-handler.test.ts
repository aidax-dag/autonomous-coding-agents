/**
 * Login Handler Tests
 */

import { installLoginHandler } from '../../../../src/api/auth/login-handler';
import { JWTService } from '../../../../src/api/auth/jwt';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

describe('LoginHandler', () => {
  const jwtService = new JWTService({ secret: 'test-secret-at-least-16' });

  function makeRequest(
    method: 'POST',
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): WebRequest {
    return { method, path, params: {}, query: {}, headers: headers ?? {}, body };
  }

  describe('POST /api/login', () => {
    it('should return tokens for valid credentials', async () => {
      const server = createWebServer();
      installLoginHandler(server, {
        jwtService,
        adminEmail: 'admin@test.com',
        adminPassword: 'secret-password',
      });

      const res = await server.handleRequest(
        makeRequest('POST', '/api/login', {
          email: 'admin@test.com',
          password: 'secret-password',
        }),
      );

      expect(res.status).toBe(200);
      const body = res.body as { accessToken: string; refreshToken: string; expiresIn: number };
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(body.expiresIn).toBe(3600);

      // Verify the access token is valid
      const payload = jwtService.verify(body.accessToken);
      expect(payload.sub).toBe('admin@test.com');
      expect(payload.role).toBe('admin');
      expect(payload.type).toBe('access');
    });

    it('should return 401 for invalid email', async () => {
      const server = createWebServer();
      installLoginHandler(server, {
        jwtService,
        adminEmail: 'admin@test.com',
        adminPassword: 'secret-password',
      });

      const res = await server.handleRequest(
        makeRequest('POST', '/api/login', {
          email: 'wrong@test.com',
          password: 'secret-password',
        }),
      );

      expect(res.status).toBe(401);
      expect((res.body as { error: string }).error).toBe('Invalid credentials');
    });

    it('should return 401 for invalid password', async () => {
      const server = createWebServer();
      installLoginHandler(server, {
        jwtService,
        adminEmail: 'admin@test.com',
        adminPassword: 'secret-password',
      });

      const res = await server.handleRequest(
        makeRequest('POST', '/api/login', {
          email: 'admin@test.com',
          password: 'wrong-password',
        }),
      );

      expect(res.status).toBe(401);
    });

    it('should return 400 for missing email or password', async () => {
      const server = createWebServer();
      installLoginHandler(server, {
        jwtService,
        adminEmail: 'admin@test.com',
        adminPassword: 'secret-password',
      });

      const res1 = await server.handleRequest(
        makeRequest('POST', '/api/login', { email: 'admin@test.com' }),
      );
      expect(res1.status).toBe(400);

      const res2 = await server.handleRequest(
        makeRequest('POST', '/api/login', { password: 'secret' }),
      );
      expect(res2.status).toBe(400);
    });

    it('should return 503 when admin password is not configured', async () => {
      const server = createWebServer();
      installLoginHandler(server, {
        jwtService,
        adminEmail: 'admin@test.com',
        adminPassword: '',
      });

      const res = await server.handleRequest(
        makeRequest('POST', '/api/login', {
          email: 'admin@test.com',
          password: 'anything',
        }),
      );

      expect(res.status).toBe(503);
      expect((res.body as { error: string }).error).toBe('Authentication not configured');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should return new access token for valid refresh token', async () => {
      const server = createWebServer();
      installLoginHandler(server, { jwtService, adminEmail: 'a@b.c', adminPassword: 'pass' });

      const refreshToken = jwtService.generateRefreshToken('admin@test.com', 'admin');

      const res = await server.handleRequest(
        makeRequest('POST', '/api/auth/refresh', { refreshToken }),
      );

      expect(res.status).toBe(200);
      const body = res.body as { accessToken: string; expiresIn: number };
      expect(body.accessToken).toBeDefined();
      expect(body.expiresIn).toBe(3600);

      const payload = jwtService.verify(body.accessToken);
      expect(payload.sub).toBe('admin@test.com');
      expect(payload.type).toBe('access');
    });

    it('should reject access token used as refresh token', async () => {
      const server = createWebServer();
      installLoginHandler(server, { jwtService, adminEmail: 'a@b.c', adminPassword: 'pass' });

      const accessToken = jwtService.generateAccessToken('admin@test.com', 'admin');

      const res = await server.handleRequest(
        makeRequest('POST', '/api/auth/refresh', { refreshToken: accessToken }),
      );

      expect(res.status).toBe(401);
      expect((res.body as { error: string }).error).toBe('Invalid token type');
    });

    it('should return 400 for missing refresh token', async () => {
      const server = createWebServer();
      installLoginHandler(server, { jwtService, adminEmail: 'a@b.c', adminPassword: 'pass' });

      const res = await server.handleRequest(
        makeRequest('POST', '/api/auth/refresh', {}),
      );

      expect(res.status).toBe(400);
    });

    it('should return 401 for tampered refresh token', async () => {
      const server = createWebServer();
      installLoginHandler(server, { jwtService, adminEmail: 'a@b.c', adminPassword: 'pass' });

      const res = await server.handleRequest(
        makeRequest('POST', '/api/auth/refresh', { refreshToken: 'invalid.token.here' }),
      );

      expect(res.status).toBe(401);
    });
  });
});
