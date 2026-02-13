/**
 * HTTP Adapter
 * Bridges Node.js http.Server to WebServer.handleRequest().
 * @module ui/web
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import type { WebServer } from './web-server';
import type { HttpMethod, WebRequest, SSEClient } from './interfaces/web.interface';
import type { SSEBrokerImpl } from './sse-broker';

let sseIdCounter = 0;

export class HttpAdapter {
  private server: Server | null = null;
  private readonly connections = new Set<import('net').Socket>();

  constructor(
    private readonly webServer: WebServer,
    private readonly sseBroker?: SSEBrokerImpl,
  ) {}

  async listen(port: number, host: string): Promise<void> {
    if (this.server) return;

    this.server = createServer((req, res) => this.handleIncoming(req, res));

    this.server.on('connection', (socket) => {
      this.connections.add(socket);
      socket.once('close', () => this.connections.delete(socket));
    });

    await new Promise<void>((resolve, reject) => {
      this.server!.listen(port, host, () => resolve());
      this.server!.once('error', reject);
    });
  }

  async close(): Promise<void> {
    if (!this.server) return;
    const srv = this.server;
    this.server = null;

    // Destroy open connections to allow fast shutdown
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    await new Promise<void>((resolve, reject) => {
      srv.close((err) => (err ? reject(err) : resolve()));
    });
  }

  private handleIncoming(req: IncomingMessage, res: ServerResponse): void {
    const config = this.webServer.getConfig();

    // OPTIONS preflight
    if (req.method === 'OPTIONS') {
      if (config.corsEnabled) {
        res.writeHead(204, this.corsHeaders(config.corsOrigins));
      } else {
        res.writeHead(204);
      }
      res.end();
      return;
    }

    // SSE endpoint
    if (req.method === 'GET' && this.parsePath(req.url ?? '/') === '/api/sse') {
      this.handleSSE(req, res, config);
      return;
    }

    // Collect body then delegate to WebServer
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', async () => {
      try {
        const webReq = this.toWebRequest(req, body);
        const webRes = await this.webServer.handleRequest(webReq);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...webRes.headers,
        };
        if (config.corsEnabled) {
          Object.assign(headers, this.corsHeaders(config.corsOrigins));
        }

        res.writeHead(webRes.status, headers);
        res.end(JSON.stringify(webRes.body));
      } catch (err) {
        if (err instanceof InvalidJsonError) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
        } else {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    });
  }

  private toWebRequest(req: IncomingMessage, rawBody: string): WebRequest {
    const method = (req.method ?? 'GET').toUpperCase() as HttpMethod;
    const { pathname, query } = this.parseUrl(req.url ?? '/');

    let parsedBody: unknown = undefined;
    if (rawBody.length > 0 && (method === 'POST' || method === 'PUT')) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        throw new InvalidJsonError();
      }
    }

    const headers: Record<string, string> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (typeof val === 'string') headers[key] = val;
    }

    return {
      method,
      path: pathname,
      params: {},
      query,
      body: parsedBody,
      headers,
    };
  }

  private handleSSE(
    _req: IncomingMessage,
    res: ServerResponse,
    config: { corsEnabled: boolean; corsOrigins: string[] },
  ): void {
    if (!this.sseBroker) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SSE not configured' }));
      return;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    };
    if (config.corsEnabled) {
      Object.assign(headers, this.corsHeaders(config.corsOrigins));
    }
    res.writeHead(200, headers);
    res.flushHeaders();

    const clientId = `sse-${++sseIdCounter}-${Date.now()}`;
    const client: SSEClient = {
      id: clientId,
      send: (event: string, data: unknown) => {
        if (!res.destroyed) {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        }
      },
      close: () => {
        if (!res.destroyed) {
          res.end();
        }
      },
    };

    this.sseBroker.addClient(client);

    res.on('close', () => {
      this.sseBroker!.removeClient(clientId);
    });
  }

  private parsePath(url: string): string {
    const qIdx = url.indexOf('?');
    return qIdx >= 0 ? url.slice(0, qIdx) : url;
  }

  private parseUrl(url: string): { pathname: string; query: Record<string, string> } {
    const qIdx = url.indexOf('?');
    if (qIdx < 0) return { pathname: url, query: {} };

    const pathname = url.slice(0, qIdx);
    const qs = url.slice(qIdx + 1);
    const query: Record<string, string> = {};
    for (const pair of qs.split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx >= 0) {
        query[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(pair.slice(eqIdx + 1));
      } else if (pair.length > 0) {
        query[decodeURIComponent(pair)] = '';
      }
    }
    return { pathname, query };
  }

  private corsHeaders(origins: string[]): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': origins.join(', '),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
  }
}

class InvalidJsonError extends Error {
  constructor() {
    super('Invalid JSON body');
  }
}

export function createHttpAdapter(webServer: WebServer, sseBroker?: SSEBrokerImpl): HttpAdapter {
  return new HttpAdapter(webServer, sseBroker);
}
