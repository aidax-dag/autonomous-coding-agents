/**
 * Request Logger Middleware Tests
 */

import { createRequestLogger } from '../../../../src/api/middleware/request-logger';
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

const { logger } = jest.requireMock('../../../../src/shared/logging/logger');

describe('RequestLogger', () => {
  it('should log successful requests at info level', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/health', async () => ({
      status: 200,
      body: { status: 'ok' },
    }));

    const requestLogger = createRequestLogger();
    requestLogger.install(server);

    const req: WebRequest = {
      method: 'GET',
      path: '/api/health',
      params: {},
      query: {},
      headers: {},
    };

    const res = await server.handleRequest(req);

    expect(res.status).toBe(200);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/health 200'),
      expect.objectContaining({
        method: 'GET',
        path: '/api/health',
        status: 200,
        duration: expect.any(Number),
      }),
    );
  });

  it('should log 4xx responses at warn level', async () => {
    const server = createWebServer();
    // No routes registered — will return 404

    const requestLogger = createRequestLogger();
    requestLogger.install(server);

    const req: WebRequest = {
      method: 'GET',
      path: '/api/missing',
      params: {},
      query: {},
      headers: {},
    };

    const res = await server.handleRequest(req);

    expect(res.status).toBe(404);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/missing 404'),
      expect.objectContaining({ status: 404 }),
    );
  });

  it('should log 5xx responses at error level', async () => {
    const server = createWebServer();
    server.addRoute('POST', '/api/crash', async () => {
      throw new Error('boom');
    });

    const requestLogger = createRequestLogger();
    requestLogger.install(server);

    const req: WebRequest = {
      method: 'POST',
      path: '/api/crash',
      params: {},
      query: {},
      headers: {},
    };

    const res = await server.handleRequest(req);

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('POST /api/crash 500'),
      expect.objectContaining({ status: 500 }),
    );
  });

  it('should include duration in log metadata', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { status: 200, body: { ok: true } };
    });

    const requestLogger = createRequestLogger();
    requestLogger.install(server);

    const req: WebRequest = {
      method: 'GET',
      path: '/api/slow',
      params: {},
      query: {},
      headers: {},
    };

    await server.handleRequest(req);

    const logCall = (logger.info as jest.Mock).mock.calls[0];
    expect(logCall[1].duration).toBeGreaterThanOrEqual(0);
  });
});
