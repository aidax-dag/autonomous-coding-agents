/**
 * Tests for LSP Client (with mock transport)
 */

import { LSPClient, createLSPClient } from '@/core/lsp';
import type { ILSPTransport, LspJsonRpcMessage, LSPServerConfig } from '@/core/lsp';

// ============================================================================
// Mock Transport
// ============================================================================

class MockTransport implements ILSPTransport {
  connected = false;
  sentMessages: LspJsonRpcMessage[] = [];
  private messageHandler: ((msg: LspJsonRpcMessage) => void) | null = null;
  private notificationHandler: ((method: string, params: unknown) => void) | null = null;

  /** Auto-respond to requests with this result (set per test) */
  autoResponses: Map<string, unknown> = new Map();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async send(message: LspJsonRpcMessage): Promise<void> {
    this.sentMessages.push(message);

    // Auto-respond to requests (those with id and method)
    if (message.id !== undefined && message.method) {
      const result = this.autoResponses.get(message.method);
      if (result !== undefined) {
        // Simulate async response
        setImmediate(() => {
          this.simulateResponse(message.id!, result);
        });
      }
    }
  }

  onMessage(handler: (message: LspJsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  onNotification(handler: (method: string, params: unknown) => void): void {
    this.notificationHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Test helpers
  simulateResponse(id: string | number, result: unknown): void {
    this.messageHandler?.({ jsonrpc: '2.0', id, result });
  }

  simulateError(id: string | number, code: number, message: string): void {
    this.messageHandler?.({ jsonrpc: '2.0', id, error: { code, message } });
  }

  simulateNotification(method: string, params: unknown): void {
    this.notificationHandler?.(method, params);
  }
}

// ============================================================================
// Helpers
// ============================================================================

const makeConfig = (overrides: Partial<LSPServerConfig> = {}): LSPServerConfig => ({
  language: 'typescript',
  command: 'typescript-language-server',
  args: ['--stdio'],
  rootUri: 'file:///project',
  ...overrides,
});

// ============================================================================
// Tests
// ============================================================================

describe('LSPClient', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
    // Default auto-responses for initialize handshake
    transport.autoResponses.set('initialize', {
      capabilities: {
        definitionProvider: true,
        referencesProvider: true,
        renameProvider: true,
      },
    });
    transport.autoResponses.set('shutdown', null);
  });

  describe('connect', () => {
    it('should perform initialize handshake', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig());

      expect(client.isConnected()).toBe(true);
      expect(client.getConfig()).toEqual(makeConfig());

      // Should have sent: initialize request, then initialized notification
      const initReq = transport.sentMessages.find(m => m.method === 'initialize');
      expect(initReq).toBeDefined();
      expect(initReq!.id).toBeDefined();

      const initializedNotif = transport.sentMessages.find(m => m.method === 'initialized');
      expect(initializedNotif).toBeDefined();
      expect(initializedNotif!.id).toBeUndefined();
    });

    it('should store server capabilities', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig());

      const caps = client.getCapabilities();
      expect(caps).toBeDefined();
      expect(caps!.definitionProvider).toBe(true);
      expect(caps!.referencesProvider).toBe(true);
    });

    it('should include rootUri in initialize params', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig({ rootUri: 'file:///workspace' }));

      const initReq = transport.sentMessages.find(m => m.method === 'initialize');
      const params = initReq!.params as Record<string, unknown>;
      expect(params.rootUri).toBe('file:///workspace');
    });
  });

  describe('disconnect', () => {
    it('should send shutdown request then exit notification', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig());

      transport.sentMessages = [];
      await client.disconnect();

      const shutdown = transport.sentMessages.find(m => m.method === 'shutdown');
      expect(shutdown).toBeDefined();
      expect(shutdown!.id).toBeDefined();

      const exit = transport.sentMessages.find(m => m.method === 'exit');
      expect(exit).toBeDefined();
      expect(exit!.id).toBeUndefined();

      expect(client.isConnected()).toBe(false);
      expect(client.getConfig()).toBeNull();
      expect(client.getCapabilities()).toBeNull();
    });
  });

  describe('sendRequest', () => {
    it('should correlate request/response by id', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig());

      transport.autoResponses.set('textDocument/definition', {
        uri: 'file:///def.ts',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      });

      const result = await client.sendRequest('textDocument/definition', {
        textDocument: { uri: 'file:///test.ts' },
        position: { line: 10, character: 5 },
      });

      expect(result).toEqual({
        uri: 'file:///def.ts',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      });
    });

    it('should reject on server error response', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig());

      // Override auto-respond: manually send error
      const promise = client.sendRequest('textDocument/hover', {});

      // Find the request id
      const hoverReq = transport.sentMessages.find(m => m.method === 'textDocument/hover');
      transport.simulateError(hoverReq!.id!, -32601, 'Method not found');

      await expect(promise).rejects.toThrow('Method not found');
    });

    it('should reject on timeout', async () => {
      const client = new LSPClient({ transport, requestTimeoutMs: 50 });
      await client.connect(makeConfig());

      // Don't auto-respond — let it time out
      transport.autoResponses.delete('textDocument/completion');

      await expect(
        client.sendRequest('textDocument/completion', {}),
      ).rejects.toThrow('Request textDocument/completion timed out');
    });

    it('should throw when not connected', async () => {
      const client = new LSPClient({ transport });

      await expect(
        client.sendRequest('textDocument/definition', {}),
      ).rejects.toThrow('LSP client is not connected');
    });
  });

  describe('sendNotification', () => {
    it('should send without id', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig());

      transport.sentMessages = [];
      await client.sendNotification('textDocument/didOpen', {
        textDocument: { uri: 'file:///test.ts', languageId: 'typescript', version: 1, text: '' },
      });

      const notif = transport.sentMessages[0];
      expect(notif.method).toBe('textDocument/didOpen');
      expect(notif.id).toBeUndefined();
    });

    it('should throw when not connected', async () => {
      const client = new LSPClient({ transport });

      await expect(
        client.sendNotification('textDocument/didOpen', {}),
      ).rejects.toThrow('LSP client is not connected');
    });
  });

  describe('onNotification', () => {
    it('should forward server notifications to handlers', async () => {
      const client = new LSPClient({ transport });
      const handler = jest.fn();
      client.onNotification(handler);

      await client.connect(makeConfig());

      transport.simulateNotification('textDocument/publishDiagnostics', {
        uri: 'file:///test.ts',
        diagnostics: [{ message: 'error', severity: 1 }],
      });

      expect(handler).toHaveBeenCalledWith(
        'textDocument/publishDiagnostics',
        {
          uri: 'file:///test.ts',
          diagnostics: [{ message: 'error', severity: 1 }],
        },
      );
    });

    it('should support multiple notification handlers', async () => {
      const client = new LSPClient({ transport });
      const h1 = jest.fn();
      const h2 = jest.fn();
      client.onNotification(h1);
      client.onNotification(h2);

      await client.connect(makeConfig());

      transport.simulateNotification('window/logMessage', { message: 'log' });

      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });
  });

  describe('backward compatibility', () => {
    it('should expose getConfig()', async () => {
      const client = new LSPClient({ transport });
      expect(client.getConfig()).toBeNull();

      await client.connect(makeConfig());
      expect(client.getConfig()).toEqual(makeConfig());
    });

    it('should expose getRequestTimeoutMs()', () => {
      const client = new LSPClient({ transport, requestTimeoutMs: 5000 });
      expect(client.getRequestTimeoutMs()).toBe(5000);
    });

    it('should expose getNextRequestId()', async () => {
      const client = new LSPClient({ transport });
      await client.connect(makeConfig());

      // After connect, requestId has incremented (initialize was sent)
      const nextId = client.getNextRequestId();
      expect(nextId).toBeGreaterThan(0);
    });

    it('should default requestTimeoutMs to 30000', () => {
      const client = new LSPClient({ transport });
      expect(client.getRequestTimeoutMs()).toBe(30000);
    });
  });

  describe('createLSPClient factory', () => {
    it('should create an LSPClient instance', () => {
      const client = createLSPClient();
      expect(client).toBeInstanceOf(LSPClient);
      expect(client.isConnected()).toBe(false);
    });

    it('should accept options', () => {
      const client = createLSPClient({ requestTimeoutMs: 5000 });
      expect(client).toBeInstanceOf(LSPClient);
      expect(client.getRequestTimeoutMs()).toBe(5000);
    });
  });
});
