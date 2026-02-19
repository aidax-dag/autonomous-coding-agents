/**
 * SSE Transport
 *
 * HTTP POST for sending, Server-Sent Events for receiving.
 *
 * @module core/mcp/mcp-transport/sse-transport
 */

import type { IMCPTransport, JsonRpcMessage } from '../interfaces/mcp.interface';

/**
 * SSE Transport
 *
 * Uses HTTP POST to send JSON-RPC messages and SSE to receive responses.
 */
export class SSETransport implements IMCPTransport {
  private url: string;
  private connected = false;
  private messageHandler: ((message: JsonRpcMessage) => void) | null = null;
  private abortController: AbortController | null = null;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    this.abortController = new AbortController();
    this.connected = true;

    // Start SSE listener
    this.startSSEListener().catch(() => {
      this.connected = false;
    });
  }

  async disconnect(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
    this.connected = false;
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.connected) {
      throw new Error('Transport not connected');
    }

    const response = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`MCP SSE transport HTTP error: ${response.status}`);
    }

    // If response has JSON body, treat as immediate response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = (await response.json()) as JsonRpcMessage;
      this.messageHandler?.(data);
    }
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async startSSEListener(): Promise<void> {
    try {
      const sseUrl = this.url.replace(/\/?$/, '/events');
      const response = await fetch(sseUrl, {
        headers: { Accept: 'text/event-stream' },
        signal: this.abortController?.signal,
      });

      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (this.connected) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const event of lines) {
          const dataLine = event
            .split('\n')
            .find((line) => line.startsWith('data:'));
          if (dataLine) {
            try {
              const data = JSON.parse(dataLine.slice(5).trim()) as JsonRpcMessage;
              this.messageHandler?.(data);
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      }
    } catch {
      // Connection closed or aborted
    }
  }
}

/**
 * Create an SSE transport
 */
export function createSSETransport(url: string): SSETransport {
  return new SSETransport(url);
}
