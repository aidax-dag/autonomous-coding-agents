/**
 * LSP Client
 *
 * Manages connection to an LSP server using JSON-RPC transport with
 * Content-Length framing. Handles initialize/initialized handshake,
 * request/response correlation, and notification dispatch.
 *
 * @module core/lsp
 */

import type {
  ILSPClient,
  ILSPTransport,
  LspJsonRpcMessage,
  LSPServerCapabilities,
  LSPServerConfig,
} from './interfaces/lsp.interface';
import { LspStdioTransport } from './lsp-transport';

// ============================================================================
// Types
// ============================================================================

export interface LSPClientOptions {
  /** Timeout for requests in milliseconds */
  requestTimeoutMs?: number;
  /** Inject a custom transport (for testing) */
  transport?: ILSPTransport;
}

// ============================================================================
// Implementation
// ============================================================================

export class LSPClient implements ILSPClient {
  private config: LSPServerConfig | null = null;
  private connected = false;
  private requestId = 0;
  private readonly requestTimeoutMs: number;
  private readonly injectedTransport: ILSPTransport | null;
  private transport: ILSPTransport | null = null;
  private capabilities: LSPServerCapabilities | null = null;
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private notificationHandlers: Array<(method: string, params: unknown) => void> = [];

  constructor(options?: LSPClientOptions) {
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 30_000;
    this.injectedTransport = options?.transport ?? null;
  }

  async connect(config: LSPServerConfig): Promise<void> {
    this.config = config;
    this.requestId = 0;

    // Create or use injected transport
    this.transport = this.injectedTransport ?? new LspStdioTransport(
      config.command,
      config.args,
    );

    // Wire up message handlers before connecting
    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.onNotification((method, params) => {
      for (const handler of this.notificationHandlers) {
        handler(method, params);
      }
    });

    await this.transport.connect();

    // LSP initialize handshake
    const initResult = await this.sendRequest<{
      capabilities: LSPServerCapabilities;
    }>('initialize', {
      processId: process.pid,
      capabilities: {},
      rootUri: config.rootUri ?? null,
      clientInfo: { name: 'aca-lsp-client', version: '1.0.0' },
    });

    this.capabilities = initResult?.capabilities ?? {};

    // Send initialized notification (no response expected)
    await this.sendNotification('initialized', {});
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.transport && this.connected) {
      try {
        // LSP graceful shutdown: request then notification
        await this.sendRequest('shutdown');
        await this.sendNotification('exit');
      } catch {
        // Best-effort shutdown
      }
    }

    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }

    this.config = null;
    this.connected = false;
    this.requestId = 0;
    this.capabilities = null;
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }

  getConfig(): LSPServerConfig | null {
    return this.config;
  }

  getRequestTimeoutMs(): number {
    return this.requestTimeoutMs;
  }

  getNextRequestId(): number {
    return this.requestId + 1;
  }

  getCapabilities(): LSPServerCapabilities | null {
    return this.capabilities;
  }

  /**
   * Send a JSON-RPC request and await the correlated response.
   */
  async sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.transport) {
      throw new Error('LSP client is not connected');
    }

    const id = ++this.requestId;
    const message: LspJsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, this.requestTimeoutMs);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.transport!.send(message).catch(reject);
    });
  }

  /**
   * Send a JSON-RPC notification (no id, no response expected).
   */
  async sendNotification(method: string, params?: unknown): Promise<void> {
    if (!this.transport) {
      throw new Error('LSP client is not connected');
    }

    const message: LspJsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    await this.transport.send(message);
  }

  /**
   * Register a handler for server-initiated notifications.
   */
  onNotification(handler: (method: string, params: unknown) => void): void {
    this.notificationHandlers.push(handler);
  }

  // ============================================================================
  // Internal
  // ============================================================================

  private handleMessage(message: LspJsonRpcMessage): void {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLSPClient(options?: LSPClientOptions): LSPClient {
  return new LSPClient(options);
}
