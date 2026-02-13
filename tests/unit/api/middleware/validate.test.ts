/**
 * Request Validation Middleware Tests
 */

import { z } from 'zod';
import { createValidatedRoute } from '../../../../src/api/middleware/validate';
import { createWebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const taskSchema = z.object({
  name: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high']),
  description: z.string().optional(),
});

function makeRequest(body: unknown): WebRequest {
  return {
    method: 'POST',
    path: '/api/tasks',
    params: {},
    query: {},
    headers: { 'content-type': 'application/json' },
    body,
  };
}

describe('ValidateMiddleware', () => {
  it('should pass valid request body to handler', async () => {
    const server = createWebServer();
    createValidatedRoute(server, 'POST', '/api/tasks', taskSchema, async (req) => ({
      status: 201,
      body: { created: req.body },
    }));

    const res = await server.handleRequest(
      makeRequest({ name: 'Test Task', priority: 'high' }),
    );

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      created: { name: 'Test Task', priority: 'high' },
    });
  });

  it('should return 422 for invalid request body', async () => {
    const server = createWebServer();
    createValidatedRoute(server, 'POST', '/api/tasks', taskSchema, async () => ({
      status: 201,
      body: { ok: true },
    }));

    const res = await server.handleRequest(
      makeRequest({ name: '', priority: 'invalid' }),
    );

    expect(res.status).toBe(422);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        status: 422,
        error: expect.any(String),
      }),
    );
  });

  it('should return 422 for missing required fields', async () => {
    const server = createWebServer();
    createValidatedRoute(server, 'POST', '/api/tasks', taskSchema, async () => ({
      status: 201,
      body: { ok: true },
    }));

    const res = await server.handleRequest(makeRequest({}));

    expect(res.status).toBe(422);
    expect(res.body).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        status: 422,
      }),
    );
    // Error message should mention missing fields
    expect((res.body as { error: string }).error).toContain('name');
    expect((res.body as { error: string }).error).toContain('priority');
  });

  it('should include formatted error details in the response', async () => {
    const server = createWebServer();
    createValidatedRoute(server, 'POST', '/api/tasks', taskSchema, async () => ({
      status: 201,
      body: { ok: true },
    }));

    const res = await server.handleRequest(
      makeRequest({ name: 123, priority: 'low' }),
    );

    expect(res.status).toBe(422);
    const body = res.body as { error: string; code: string };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toBeTruthy();
  });
});
