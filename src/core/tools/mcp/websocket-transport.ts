/**
 * WebSocket Transport for MCP
 *
 * Implements JSON-RPC communication over WebSocket with auto-reconnection support.
 *
 * @module core/tools/mcp/websocket-transport
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import {
  IMCPTransport,
  MCPWebSocketTransportConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from './mcp.interface.js';
import { createLogger, ILogger } from '../../services/logger.js';

/**
 * WebSocket Transport implementation
 *
 * Manages communication with MCP server via WebSocket connection.
 * Supports auto-reconnection with configurable backoff.
 */
export class WebSocketTransport extends EventEmitter implements IMCPTransport {
  private config: MCPWebSocketTransportConfig;
  private ws: WebSocket | null = null;
  private connected = false;
  private readonly logger: ILogger = createLogger('WebSocketTransport');
  private messageHandler: ((message: JsonRpcNotification | JsonRpcResponse) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: ((code?: number, reason?: string) => void) | null = null;
  private pendingRequests: Map<
    string | number,
    {
      resolve: (response: JsonRpcResponse) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isReconnecting = false;

  constructor(config: MCPWebSocketTransportConfig) {
    super();
    this.config = {
      autoReconnect: true,
      reconnectIntervalMs: 1000,
      maxReconnectAttempts: 5,
      ...config,
    };
  }

  /**
   * Connect to the MCP server via WebSocket
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Transport is already connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.cleanup();
      }, this.config.connectionTimeoutMs ?? 30000);

      try {
        // Create WebSocket connection
        const wsOptions: WebSocket.ClientOptions = {};
        if (this.config.headers) {
          wsOptions.headers = this.config.headers;
        }

        this.ws = new WebSocket(this.config.url, wsOptions);

        // Handle connection open
        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.connected = true;
          this.reconnectAttempts = 0;
          this.logger.info('WebSocket transport connected', { url: this.config.url });
          resolve();
        });

        // Handle connection error
        this.ws.on('error', (error) => {
          clearTimeout(timeout);
          if (!this.connected) {
            reject(error);
          } else if (this.errorHandler) {
            this.errorHandler(error);
          }
          this.handleDisconnection(1006, error.message);
        });

        // Handle incoming messages
        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        // Handle connection close
        this.ws.on('close', (code, reason) => {
          const wasConnected = this.connected;
          this.connected = false;

          if (this.closeHandler && wasConnected) {
            this.closeHandler(code, reason.toString());
          }

          this.handleDisconnection(code, reason.toString());
        });

        // Handle ping/pong for keep-alive
        this.ws.on('ping', () => {
          this.ws?.pong();
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    // Cancel any pending reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.isReconnecting = false;

    if (!this.connected || !this.ws) {
      return;
    }

    return new Promise((resolve) => {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Transport disconnected'));
        this.pendingRequests.delete(id);
      }

      if (this.ws) {
        let forceCleanupTimer: NodeJS.Timeout | null = null;

        this.ws.once('close', () => {
          // Clear the force cleanup timer since close happened normally
          if (forceCleanupTimer) {
            clearTimeout(forceCleanupTimer);
            forceCleanupTimer = null;
          }
          this.cleanup();
          resolve();
        });

        // Close with normal closure code
        this.ws.close(1000, 'Client disconnect');

        // Force cleanup after timeout
        forceCleanupTimer = setTimeout(() => {
          if (this.ws) {
            this.ws.terminate();
            this.cleanup();
          }
          resolve();
        }, 5000);
        forceCleanupTimer.unref(); // Don't keep process alive for this timer
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a request and wait for response
   */
  async sendRequest<T>(request: JsonRpcRequest): Promise<JsonRpcResponse<T>> {
    if (!this.connected || !this.ws) {
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

      const message = JSON.stringify(request);
      this.ws!.send(message, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          reject(error);
        }
      });
    });
  }

  /**
   * Send a notification (no response expected)
   */
  sendNotification(notification: JsonRpcNotification): void {
    if (!this.connected || !this.ws) {
      throw new Error('Transport is not connected');
    }

    const message = JSON.stringify(notification);
    this.ws.send(message, (error) => {
      if (error) {
        this.logger.warn('Failed to send notification', { error: error.message });
      }
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
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
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
        this.errorHandler(new Error(`Failed to parse WebSocket message: ${data}`));
      }
    }
  }

  /**
   * Handle disconnection and potential reconnection
   */
  private handleDisconnection(code: number, _reason: string): void {
    this.connected = false;

    // Don't reconnect if it was a normal closure or reconnection is disabled
    if (
      code === 1000 ||
      !this.config.autoReconnect ||
      this.isReconnecting ||
      this.reconnectAttempts >= (this.config.maxReconnectAttempts ?? 5)
    ) {
      this.cleanup();
      return;
    }

    this.attemptReconnect();
  }

  /**
   * Attempt to reconnect to the server
   */
  private attemptReconnect(): void {
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(
      (this.config.reconnectIntervalMs ?? 1000) * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    this.logger.info('Attempting reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      delayMs: delay,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.isReconnecting = false;
      } catch (error) {
        this.isReconnecting = false;
        this.logger.warn('Reconnection failed', {
          attempt: this.reconnectAttempts,
          error: error instanceof Error ? error.message : String(error),
        });

        // Try again if we haven't exceeded max attempts
        if (this.reconnectAttempts < (this.config.maxReconnectAttempts ?? 5)) {
          this.attemptReconnect();
        } else {
          this.logger.error('Max reconnection attempts reached');
          this.cleanup();
        }
      }
    }, delay);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.connected = false;
    this.isReconnecting = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws = null;
    }

    this.pendingRequests.clear();
  }
}
