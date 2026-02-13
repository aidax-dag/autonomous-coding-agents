/**
 * HTTP Transport
 *
 * MCP Streamable HTTP transport — JSON-RPC over HTTP POST with
 * optional server-initiated streaming via SSE on the same endpoint.
 *
 * Spec reference: MCP "Streamable HTTP" transport
 *   - Client → Server: POST with JSON-RPC body
 *   - Server → Client: JSON response OR SSE stream (content-type based)
 *   - Session management via Mcp-Session-Id header
 *
 * @module core/mcp/mcp-transport/http-transport
 */

import type { IMCPTransport, JsonRpcMessage } from '../interfaces/mcp.interface';

export interface HttpTransportOptions {
  /** Base URL of the MCP HTTP server (e.g. "http://localhost:3100/mcp") */
  url: string;
  /** Extra headers sent with every request */
  headers?: Record<string, string>;
  /** Request timeout in ms (default 30 000) */
  timeoutMs?: number;
}

/**
 * HTTP Transport
 *
 * Sends JSON-RPC messages via HTTP POST. Handles two response modes:
 *   1. application/json → single response message
 *   2. text/event-stream → streamed responses (parsed and forwarded)
 *
 * Optionally opens a persistent GET SSE listener for server-initiated
 * notifications (e.g. progress, log).
 */
export class HttpTransport implements IMCPTransport {
  private readonly url: string;
  private readonly extraHeaders: Record<string, string>;
  private readonly timeoutMs: number;
  private connected = false;
  private messageHandler: ((msg: JsonRpcMessage) => void) | null = null;
  private sessionId: string | null = null;
  private sseAbort: AbortController | null = null;

  constructor(options: HttpTransportOptions) {
    this.url = options.url;
    this.extraHeaders = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;

    // Open persistent SSE listener for server-initiated messages
    this.openSSEListener();
  }

  async disconnect(): Promise<void> {
    this.sseAbort?.abort();
    this.sseAbort = null;
    this.connected = false;
    this.sessionId = null;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...this.extraHeaders,
      };
      if (this.sessionId) {
        headers['Mcp-Session-Id'] = this.sessionId;
      }

      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: abort.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP transport error: ${response.status} ${response.statusText}`);
      }

      // Capture session id
      const sid = response.headers.get('mcp-session-id');
      if (sid) this.sessionId = sid;

      const contentType = response.headers.get('content-type') ?? '';

      if (contentType.includes('text/event-stream') && response.body) {
        // Streamed response — parse SSE events
        await this.consumeSSEStream(response);
      } else if (contentType.includes('application/json')) {
        const data = (await response.json()) as JsonRpcMessage | JsonRpcMessage[];
        if (Array.isArray(data)) {
          for (const msg of data) this.messageHandler?.(msg);
        } else {
          this.messageHandler?.(data);
        }
      }
      // 202 Accepted with no body (notification) — nothing to parse
    } finally {
      clearTimeout(timer);
    }
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Opens a persistent GET SSE connection for server-initiated messages.
   * Non-blocking — failures are silently ignored; the transport remains usable
   * in pure request/response mode.
   */
  private openSSEListener(): void {
    this.sseAbort = new AbortController();

    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      ...this.extraHeaders,
    };
    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    fetch(this.url, { method: 'GET', headers, signal: this.sseAbort.signal })
      .then(async (res) => {
        if (!res.ok || !res.body) return;

        const sid = res.headers.get('mcp-session-id');
        if (sid) this.sessionId = sid;

        await this.readSSEBody(res.body);
      })
      .catch(() => {
        // Connection refused / aborted — acceptable
      });
  }

  /**
   * Consume an SSE response body, forwarding each data event to the handler.
   */
  private async consumeSSEStream(response: Response): Promise<void> {
    if (!response.body) return;
    await this.readSSEBody(response.body);
  }

  private async readSSEBody(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          this.parseSSEBlock(block);
        }
      }
      // Process any remaining data
      if (buffer.trim()) {
        this.parseSSEBlock(buffer);
      }
    } catch {
      // Stream ended or aborted
    }
  }

  private parseSSEBlock(block: string): void {
    const dataLine = block
      .split('\n')
      .find((l) => l.startsWith('data:'));
    if (!dataLine) return;

    const raw = dataLine.slice(5).trim();
    if (!raw) return;

    try {
      const msg = JSON.parse(raw) as JsonRpcMessage;
      this.messageHandler?.(msg);
    } catch {
      // Invalid JSON — skip
    }
  }
}

/**
 * Create an HTTP transport
 */
export function createHttpTransport(options: HttpTransportOptions): HttpTransport {
  return new HttpTransport(options);
}
