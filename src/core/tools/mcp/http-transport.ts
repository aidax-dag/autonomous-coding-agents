/**
 * HTTP/SSE Transport for MCP
 *
 * Implements JSON-RPC communication over HTTP with Server-Sent Events (SSE)
 * for server-to-client notifications.
 *
 * @module core/tools/mcp/http-transport
 */

import { EventEmitter } from 'events';
import {
  IMCPTransport,
  MCPHttpTransportConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  isJsonRpcError,
} from './mcp.interface.js';
import { createLogger, ILogger } from '../../services/logger.js';

/**
 * HTTP/SSE Transport implementation
 *
 * Uses HTTP POST for requests and Server-Sent Events for notifications.
 */
export class HttpTransport extends EventEmitter implements IMCPTransport {
  private config: MCPHttpTransportConfig;
  private connected = false;
  private readonly logger: ILogger = createLogger('HttpTransport');
  private messageHandler: ((message: JsonRpcNotification | JsonRpcResponse) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: ((code?: number, reason?: string) => void) | null = null;
  private eventSource: EventSource | null = null;
  private abortController: AbortController | null = null;
  private pendingRequests: Map<
    string | number,
    {
      resolve: (response: JsonRpcResponse) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private requestId = 0;

  constructor(config: MCPHttpTransportConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the MCP server via HTTP/SSE
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Transport is already connected');
    }

    this.abortController = new AbortController();

    try {
      // Test connection with a ping
      const pingResponse = await this.makeRequest({
        jsonrpc: '2.0',
        id: this.nextRequestId(),
        method: 'ping',
      });

      if (isJsonRpcError(pingResponse)) {
        throw new Error(`Connection test failed: ${pingResponse.error.message}`);
      }

      // Setup SSE for notifications if supported
      await this.setupSSE();

      this.connected = true;
      this.logger.info('HTTP/SSE transport connected', { url: this.config.url });
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Setup Server-Sent Events for notifications
   */
  private async setupSSE(): Promise<void> {
    // SSE is optional - some servers may not support it
    const sseUrl = `${this.config.url}/events`;

    try {
      // Check if EventSource is available (not in all Node.js environments)
      if (typeof EventSource === 'undefined') {
        this.logger.debug('EventSource not available, SSE notifications disabled');
        return;
      }

      this.eventSource = new EventSource(sseUrl, {
        withCredentials: this.config.secure,
      });

      this.eventSource.onmessage = (event) => {
        this.handleSSEMessage(event.data);
      };

      this.eventSource.onerror = (error) => {
        this.logger.warn('SSE connection error', { error });
        // Don't disconnect - SSE is optional
      };
    } catch {
      // SSE setup failed - continue without it
      this.logger.debug('SSE setup failed, notifications disabled');
    }
  }

  /**
   * Handle incoming SSE message
   */
  private handleSSEMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Check if this is a response to a pending request
      if ('id' in message && message.id !== null) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.resolve(message as JsonRpcResponse);
          return;
        }
      }

      // Otherwise, it's a notification
      if (this.messageHandler) {
        this.messageHandler(message as JsonRpcNotification | JsonRpcResponse);
      }
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(new Error(`Failed to parse SSE message: ${data}`));
      }
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Transport disconnected'));
      this.pendingRequests.delete(id);
    }

    // Abort any ongoing requests
    if (this.abortController) {
      this.abortController.abort();
    }

    // Close SSE connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    if (this.closeHandler) {
      this.closeHandler(0, 'Disconnected');
    }

    this.cleanup();
  }

  /**
   * Send a request and wait for response
   */
  async sendRequest<T>(request: JsonRpcRequest): Promise<JsonRpcResponse<T>> {
    if (!this.connected) {
      throw new Error('Transport is not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout for ${request.method}`));
      }, this.config.requestTimeoutMs ?? 30000);

      this.pendingRequests.set(request.id, {
        resolve: resolve as (response: JsonRpcResponse) => void,
        reject,
        timeout,
      });

      this.makeRequest(request)
        .then((response) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          resolve(response as JsonRpcResponse<T>);
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          reject(error);
        });
    });
  }

  /**
   * Make HTTP request to server
   */
  private async makeRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(request),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as JsonRpcResponse;
  }

  /**
   * Send a notification (no response expected)
   */
  sendNotification(notification: JsonRpcNotification): void {
    if (!this.connected) {
      throw new Error('Transport is not connected');
    }

    // Fire and forget
    fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(notification),
      signal: this.abortController?.signal,
    }).catch((error) => {
      this.logger.warn('Failed to send notification', { error: error.message });
    });
  }

  /**
   * Set message handler for incoming messages
   */
  onMessage(handler: (message: JsonRpcNotification | JsonRpcResponse) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Set error handler
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Set close handler
   */
  onClose(handler: (code?: number, reason?: string) => void): void {
    this.closeHandler = handler;
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Generate next request ID
   */
  private nextRequestId(): number {
    return ++this.requestId;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.connected = false;
    this.eventSource = null;
    this.abortController = null;
    this.pendingRequests.clear();
  }
}
