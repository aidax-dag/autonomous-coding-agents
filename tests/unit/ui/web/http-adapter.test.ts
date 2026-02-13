/**
 * Tests for HttpAdapter
 *
 * Validates real HTTP request handling through the adapter:
 * routing, body parsing, query strings, SSE, CORS, and error cases.
 */

import http from 'http';
import { WebServer } from '@/ui/web/web-server';
import { HttpAdapter } from '@/ui/web/http-adapter';
import { SSEBrokerImpl } from '@/ui/web/sse-broker';
import type { WebRequest, WebResponse } from '@/ui/web/interfaces/web.interface';

function request(
  port: number,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data }),
        );
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('HttpAdapter', () => {
  let server: WebServer;
  let broker: SSEBrokerImpl;
  let adapter: HttpAdapter;
  let boundPort: number;

  beforeEach(async () => {
    server = new WebServer({ port: 0, host: '127.0.0.1' });
    broker = new SSEBrokerImpl();
    adapter = new HttpAdapter(server, broker);

    // Register a health route
    server.addRoute('GET', '/api/health', async () => ({
      status: 200,
      body: { status: 'ok', health: 100 },
    }));

    // Register a POST route
    server.addRoute('POST', '/api/tasks', async (req: WebRequest): Promise<WebResponse> => ({
      status: 201,
      body: { received: req.body },
    }));

    // Register a param route
    server.addRoute('GET', '/api/agents/:agentId', async (req: WebRequest): Promise<WebResponse> => ({
      status: 200,
      body: { agentId: req.params.agentId },
    }));

    // Register a query route
    server.addRoute('GET', '/api/search', async (req: WebRequest): Promise<WebResponse> => ({
      status: 200,
      body: { query: req.query },
    }));

    // Use port 0 for OS-assigned port
    await adapter.listen(0, '127.0.0.1');
    // Extract the actual port
    boundPort = (adapter as any).server.address().port;
  });

  afterEach(async () => {
    await adapter.close();
  });

  it('GET /api/health returns 200 + JSON', async () => {
    const res = await request(boundPort, 'GET', '/api/health');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json).toEqual({ status: 'ok', health: 100 });
    expect(res.headers['content-type']).toContain('application/json');
  });

  it('POST /api/tasks parses JSON body', async () => {
    const res = await request(boundPort, 'POST', '/api/tasks', { name: 'test-task' });
    expect(res.status).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.received).toEqual({ name: 'test-task' });
  });

  it('/api/agents/:agentId extracts path params', async () => {
    const res = await request(boundPort, 'GET', '/api/agents/agent-42');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.agentId).toBe('agent-42');
  });

  it('query string is parsed', async () => {
    const res = await request(boundPort, 'GET', '/api/search?q=hello&limit=10');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.query).toEqual({ q: 'hello', limit: '10' });
  });

  it('unknown route returns 404', async () => {
    const res = await request(boundPort, 'GET', '/api/nonexistent');
    expect(res.status).toBe(404);
    const json = JSON.parse(res.body);
    expect(json.error).toBe('Not found');
  });

  it('OPTIONS preflight returns CORS headers', async () => {
    const res = await request(boundPort, 'OPTIONS', '/api/health');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
  });

  it('GET /api/sse establishes SSE stream and receives broadcast', async () => {
    const received = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SSE timeout')), 4000);

      const req = http.get(
        { hostname: '127.0.0.1', port: boundPort, path: '/api/sse' },
        (res) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers['content-type']).toContain('text/event-stream');

          res.once('data', (chunk: Buffer) => {
            clearTimeout(timeout);
            req.destroy();
            resolve(chunk.toString());
          });

          // Broadcast after a delay to ensure client is fully registered
          setTimeout(() => {
            broker.broadcast('test-event', { msg: 'hello' });
          }, 100);
        },
      );
      req.on('error', (err) => {
        // ECONNRESET is expected when we destroy the request
        if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') {
          clearTimeout(timeout);
          reject(err);
        }
      });
    });

    expect(received).toContain('event: test-event');
    expect(received).toContain('"msg":"hello"');
  });

  it('close() shuts down the server', async () => {
    await adapter.close();

    await expect(
      request(boundPort, 'GET', '/api/health'),
    ).rejects.toThrow();

    // Re-create for afterEach cleanup (no-op since already closed)
    adapter = new HttpAdapter(server, broker);
  });

  it('invalid JSON body returns 400', async () => {
    const invalidPayload = 'not valid json';
    const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: boundPort,
          path: '/api/tasks',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(invalidPayload)),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        },
      );
      req.on('error', reject);
      req.write(invalidPayload);
      req.end();
    });

    expect(res.status).toBe(400);
    expect(JSON.parse(res.body)).toEqual({ error: 'Invalid JSON body' });
  });
});
