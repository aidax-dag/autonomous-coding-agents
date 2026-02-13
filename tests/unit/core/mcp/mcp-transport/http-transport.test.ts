/**
 * HTTP Transport Tests
 *
 * Validates HTTP Streamable MCP transport:
 * - Lifecycle (connect / disconnect / isConnected)
 * - JSON response handling
 * - SSE stream response handling
 * - Session ID tracking
 * - Timeout / error handling
 * - Array (batch) JSON-RPC responses
 */

import http from 'http';
import { HttpTransport } from '@/core/mcp/mcp-transport/http-transport';
import type { JsonRpcMessage } from '@/core/mcp/interfaces/mcp.interface';

/** Spin up a tiny HTTP server that speaks JSON-RPC */
function createMockServer(): {
  server: http.Server;
  port: () => number;
  close: () => Promise<void>;
  handler: jest.Mock;
} {
  const handler = jest.fn<
    void,
    [http.IncomingMessage, http.ServerResponse]
  >();

  const server = http.createServer((req, res) => handler(req, res));

  return {
    server,
    port: () => (server.address() as { port: number }).port,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
    handler,
  };
}

function listenOnRandomPort(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: Buffer) => (data += chunk.toString()));
    req.on('end', () => resolve(data));
  });
}

describe('HttpTransport', () => {
  // -----------------------------------------------------------------------
  // Unit tests (no server needed)
  // -----------------------------------------------------------------------

  describe('lifecycle', () => {
    it('should create with url and default options', () => {
      const t = new HttpTransport({ url: 'http://localhost:9999/mcp' });
      expect(t).toBeDefined();
      expect(t.isConnected()).toBe(false);
      expect(t.getSessionId()).toBeNull();
    });

    it('should connect and set connected state', async () => {
      const t = new HttpTransport({ url: 'http://localhost:9999/mcp' });
      await t.connect();
      expect(t.isConnected()).toBe(true);
    });

    it('should be idempotent on connect', async () => {
      const t = new HttpTransport({ url: 'http://localhost:9999/mcp' });
      await t.connect();
      await t.connect();
      expect(t.isConnected()).toBe(true);
    });

    it('should disconnect', async () => {
      const t = new HttpTransport({ url: 'http://localhost:9999/mcp' });
      await t.connect();
      await t.disconnect();
      expect(t.isConnected()).toBe(false);
      expect(t.getSessionId()).toBeNull();
    });

    it('should register message handler', () => {
      const t = new HttpTransport({ url: 'http://localhost:9999/mcp' });
      const handler = jest.fn();
      t.onMessage(handler);
      expect(t).toBeDefined();
    });

    it('should throw on send when not connected', async () => {
      const t = new HttpTransport({ url: 'http://localhost:9999/mcp' });
      await expect(
        t.send({ jsonrpc: '2.0', id: 1, method: 'test' }),
      ).rejects.toThrow('not connected');
    });
  });

  // -----------------------------------------------------------------------
  // Integration tests (real HTTP server)
  // -----------------------------------------------------------------------

  describe('JSON response', () => {
    let mock: ReturnType<typeof createMockServer>;
    let transport: HttpTransport;

    beforeEach(async () => {
      mock = createMockServer();
      await listenOnRandomPort(mock.server);
    });

    afterEach(async () => {
      await transport?.disconnect();
      await mock.close();
    });

    it('should send JSON-RPC POST and receive JSON response', async () => {
      const response: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: { tools: [] } };

      mock.handler.mockImplementation(async (req, res) => {
        if (req.method === 'GET') {
          // SSE listener — just close it
          res.writeHead(204);
          res.end();
          return;
        }
        const body = await readBody(req);
        const msg = JSON.parse(body) as JsonRpcMessage;
        expect(msg.method).toBe('tools/list');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...response, id: msg.id }));
      });

      transport = new HttpTransport({ url: `http://127.0.0.1:${mock.port()}/mcp` });
      const received: JsonRpcMessage[] = [];
      transport.onMessage((msg) => received.push(msg));
      await transport.connect();

      await transport.send({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });

      expect(received).toHaveLength(1);
      expect(received[0].result).toEqual({ tools: [] });
    });

    it('should handle batch (array) JSON-RPC responses', async () => {
      mock.handler.mockImplementation(async (req, res) => {
        if (req.method === 'GET') { res.writeHead(204); res.end(); return; }

        const batch: JsonRpcMessage[] = [
          { jsonrpc: '2.0', id: 1, result: 'a' },
          { jsonrpc: '2.0', id: 2, result: 'b' },
        ];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(batch));
      });

      transport = new HttpTransport({ url: `http://127.0.0.1:${mock.port()}/mcp` });
      const received: JsonRpcMessage[] = [];
      transport.onMessage((msg) => received.push(msg));
      await transport.connect();

      await transport.send({ jsonrpc: '2.0', id: 1, method: 'batch' });

      expect(received).toHaveLength(2);
      expect(received[0].result).toBe('a');
      expect(received[1].result).toBe('b');
    });

    it('should capture Mcp-Session-Id from response', async () => {
      mock.handler.mockImplementation(async (req, res) => {
        if (req.method === 'GET') { res.writeHead(204); res.end(); return; }

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': 'sess-abc123',
        });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }));
      });

      transport = new HttpTransport({ url: `http://127.0.0.1:${mock.port()}/mcp` });
      transport.onMessage(() => {});
      await transport.connect();

      expect(transport.getSessionId()).toBeNull();
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'init' });
      expect(transport.getSessionId()).toBe('sess-abc123');
    });

    it('should send extra headers and session id', async () => {
      let capturedHeaders: http.IncomingHttpHeaders = {};

      mock.handler.mockImplementation(async (req, res) => {
        if (req.method === 'GET') { res.writeHead(204); res.end(); return; }
        capturedHeaders = req.headers;

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Mcp-Session-Id': 'sess-xyz',
        });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'ok' }));
      });

      transport = new HttpTransport({
        url: `http://127.0.0.1:${mock.port()}/mcp`,
        headers: { Authorization: 'Bearer tok-123' },
      });
      transport.onMessage(() => {});
      await transport.connect();

      // First call — no session id yet
      await transport.send({ jsonrpc: '2.0', id: 1, method: 'init' });
      expect(capturedHeaders['authorization']).toBe('Bearer tok-123');

      // Second call — session id should be sent
      await transport.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
      expect(capturedHeaders['mcp-session-id']).toBe('sess-xyz');
    });

    it('should throw on non-OK HTTP status', async () => {
      mock.handler.mockImplementation((_req, res) => {
        res.writeHead(500);
        res.end('Internal Server Error');
      });

      transport = new HttpTransport({ url: `http://127.0.0.1:${mock.port()}/mcp` });
      transport.onMessage(() => {});
      await transport.connect();

      await expect(
        transport.send({ jsonrpc: '2.0', id: 1, method: 'fail' }),
      ).rejects.toThrow('HTTP transport error: 500');
    });
  });

  describe('SSE stream response', () => {
    let mock: ReturnType<typeof createMockServer>;
    let transport: HttpTransport;

    beforeEach(async () => {
      mock = createMockServer();
      await listenOnRandomPort(mock.server);
    });

    afterEach(async () => {
      await transport?.disconnect();
      await mock.close();
    });

    it('should parse SSE streamed responses from POST', async () => {
      mock.handler.mockImplementation(async (req, res) => {
        if (req.method === 'GET') { res.writeHead(204); res.end(); return; }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        });

        const msg1: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: 'step1' };
        const msg2: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: 'step2' };

        res.write(`data: ${JSON.stringify(msg1)}\n\n`);
        res.write(`data: ${JSON.stringify(msg2)}\n\n`);
        res.end();
      });

      transport = new HttpTransport({ url: `http://127.0.0.1:${mock.port()}/mcp` });
      const received: JsonRpcMessage[] = [];
      transport.onMessage((msg) => received.push(msg));
      await transport.connect();

      await transport.send({ jsonrpc: '2.0', id: 1, method: 'stream' });

      expect(received).toHaveLength(2);
      expect(received[0].result).toBe('step1');
      expect(received[1].result).toBe('step2');
    });

    it('should handle 202 Accepted with no body (notification)', async () => {
      mock.handler.mockImplementation(async (req, res) => {
        if (req.method === 'GET') { res.writeHead(204); res.end(); return; }

        res.writeHead(202);
        res.end();
      });

      transport = new HttpTransport({ url: `http://127.0.0.1:${mock.port()}/mcp` });
      const received: JsonRpcMessage[] = [];
      transport.onMessage((msg) => received.push(msg));
      await transport.connect();

      // Should not throw
      await transport.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      expect(received).toHaveLength(0);
    });
  });

  describe('MCPClient integration', () => {
    it('should be selectable via MCPServerConfig transport: "http"', async () => {
      // Verify the import path works and the client can instantiate
      const { MCPClient } = await import('@/core/mcp/mcp-client');
      const client = new MCPClient();
      expect(client).toBeDefined();
    });
  });
});
