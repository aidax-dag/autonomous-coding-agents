/**
 * LSP Client
 *
 * Manages connection to an LSP server using JSON-RPC transport pattern.
 * Stores configuration, tracks connection state, and provides
 * a request dispatch mechanism.
 *
 * @module core/lsp
 */

import type { ILSPClient, LSPServerConfig } from './interfaces/lsp.interface';

// ============================================================================
// Types
// ============================================================================

export interface LSPClientOptions {
  /** Timeout for requests in milliseconds */
  requestTimeoutMs?: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class LSPClient implements ILSPClient {
  private config: LSPServerConfig | null = null;
  private connected: boolean = false;
  private requestId: number = 0;
  private readonly requestTimeoutMs: number;

  constructor(options?: LSPClientOptions) {
    this.requestTimeoutMs = options?.requestTimeoutMs ?? 30_000;
  }

  async connect(config: LSPServerConfig): Promise<void> {
    this.config = config;
    this.connected = true;
    this.requestId = 0;
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.connected = false;
    this.requestId = 0;
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

  /**
   * Send a JSON-RPC style request to the LSP server.
   * Throws if not connected.
   */
  sendRequest<T = unknown>(method: string, params?: Record<string, unknown>): T {
    if (!this.connected) {
      throw new Error('LSP client is not connected');
    }

    this.requestId++;

    // In a real implementation, this would send via stdio/socket transport.
    // For now, consume parameters and return a placeholder.
    void method;
    void params;
    return null as T;
  }

  getNextRequestId(): number {
    return this.requestId + 1;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLSPClient(options?: LSPClientOptions): LSPClient {
  return new LSPClient(options);
}
