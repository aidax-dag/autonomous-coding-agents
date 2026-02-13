/**
 * Error Handler Middleware Tests
 */

import { installErrorHandler } from '../../../../src/api/middleware/error-handler';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';

describe('ErrorHandler', () => {
  function makeRequest(method: 'GET' | 'POST', path: string): WebRequest {
    return { method, path, params: {}, query: {}, headers: {} };
  }

  it('should normalize 404 responses to standard format', async () => {
    const server = createWebServer();
    // No routes → 404
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('GET', '/missing'));

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Not found',
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('should normalize 500 responses to standard format', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/crash', async () => {
      throw new Error('boom');
    });
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('GET', '/crash'));

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'boom',
      code: 'INTERNAL_ERROR',
      status: 500,
    });
  });

  it('should normalize 400 responses', async () => {
    const server = createWebServer();
    server.addRoute('POST', '/api/tasks', async () => ({
      status: 400,
      body: { error: 'Task name is required' },
    }));
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('POST', '/api/tasks'));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Task name is required',
      code: 'BAD_REQUEST',
      status: 400,
    });
  });

  it('should normalize 503 responses', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/snapshot', async () => ({
      status: 503,
      body: { error: 'Dashboard not configured' },
    }));
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('GET', '/api/snapshot'));

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: 'Dashboard not configured',
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
    });
  });

  it('should pass through 2xx responses unchanged', async () => {
    const server = createWebServer();
    const successBody = { status: 'ok', health: 100 };
    server.addRoute('GET', '/api/health', async () => ({
      status: 200,
      body: successBody,
    }));
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('GET', '/api/health'));

    expect(res.status).toBe(200);
    expect(res.body).toEqual(successBody);
  });

  it('should preserve headers on error responses', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/limited', async () => ({
      status: 429,
      body: { error: 'Too many requests' },
      headers: { 'Retry-After': '60' },
    }));
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('GET', '/api/limited'));

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: 'Too many requests',
      code: 'RATE_LIMITED',
      status: 429,
    });
    expect(res.headers).toEqual(expect.objectContaining({ 'Retry-After': '60' }));
  });

  it('should handle error body without error field', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/weird', async () => ({
      status: 422,
      body: { message: 'Something went wrong' },
    }));
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('GET', '/api/weird'));

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      error: 'Request failed',
      code: 'VALIDATION_ERROR',
      status: 422,
    });
  });

  it('should classify unknown 4xx as CLIENT_ERROR', async () => {
    const server = createWebServer();
    server.addRoute('GET', '/api/teapot', async () => ({
      status: 418,
      body: { error: "I'm a teapot" },
    }));
    installErrorHandler(server);

    const res = await server.handleRequest(makeRequest('GET', '/api/teapot'));

    expect(res.body).toEqual({
      error: "I'm a teapot",
      code: 'CLIENT_ERROR',
      status: 418,
    });
  });
});
