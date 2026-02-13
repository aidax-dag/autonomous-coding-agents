/**
 * Tests for LSP Integration (end-to-end across modules with mock transport)
 */

import {
  LSPClient,
  SymbolResolver,
  RefactorEngine,
  DiagnosticsCollector,
} from '@/core/lsp';
import type {
  ILSPTransport,
  LspJsonRpcMessage,
  Location,
  Position,
  SymbolInfo,
  Diagnostic,
} from '@/core/lsp';

// ============================================================================
// Mock Transport
// ============================================================================

class MockTransport implements ILSPTransport {
  connected = false;
  sentMessages: LspJsonRpcMessage[] = [];
  private messageHandler: ((msg: LspJsonRpcMessage) => void) | null = null;
  private notificationHandler: ((method: string, params: unknown) => void) | null = null;
  autoResponses: Map<string, unknown> = new Map();

  async connect(): Promise<void> { this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }

  async send(message: LspJsonRpcMessage): Promise<void> {
    this.sentMessages.push(message);
    if (message.id !== undefined && message.method) {
      const result = this.autoResponses.get(message.method);
      if (result !== undefined) {
        setImmediate(() => {
          this.messageHandler?.({ jsonrpc: '2.0', id: message.id!, result });
        });
      }
    }
  }

  onMessage(handler: (message: LspJsonRpcMessage) => void): void { this.messageHandler = handler; }
  onNotification(handler: (method: string, params: unknown) => void): void { this.notificationHandler = handler; }
  isConnected(): boolean { return this.connected; }

  simulateNotification(method: string, params: unknown): void {
    this.notificationHandler?.(method, params);
  }
}

// ============================================================================
// Helpers
// ============================================================================

const pos = (line: number, character: number): Position => ({ line, character });

// ============================================================================
// Tests
// ============================================================================

describe('LSP Integration', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = new MockTransport();
    transport.autoResponses.set('initialize', {
      capabilities: {
        definitionProvider: true,
        referencesProvider: true,
        documentSymbolProvider: true,
        renameProvider: true,
      },
    });
    transport.autoResponses.set('shutdown', null);
  });

  it('should connect client then resolve symbols via LSP', async () => {
    const client = new LSPClient({ transport });
    await client.connect({ language: 'typescript', command: 'tsserver' });

    expect(client.isConnected()).toBe(true);

    const definitionLocation: Location = {
      uri: 'file:///src/index.ts',
      range: { start: pos(0, 0), end: pos(0, 15) },
    };

    transport.autoResponses.set('textDocument/definition', definitionLocation);

    const resolver = new SymbolResolver({ client });
    const result = await resolver.findDefinition('file:///test.ts', pos(10, 5));

    expect(result).toEqual(definitionLocation);

    // Verify the LSP request was sent
    const defReq = transport.sentMessages.find(m => m.method === 'textDocument/definition');
    expect(defReq).toBeDefined();
    const params = defReq!.params as Record<string, unknown>;
    expect(params.textDocument).toEqual({ uri: 'file:///test.ts' });
    expect(params.position).toEqual(pos(10, 5));
  });

  it('should resolve symbols then refactor via LSP', async () => {
    const client = new LSPClient({ transport });
    await client.connect({ language: 'typescript', command: 'tsserver' });

    const symbols: SymbolInfo[] = [
      {
        name: 'oldFunction',
        kind: 'function',
        location: {
          uri: 'file:///src/utils.ts',
          range: { start: pos(5, 0), end: pos(5, 15) },
        },
      },
    ];

    transport.autoResponses.set('textDocument/documentSymbol', symbols);
    transport.autoResponses.set('textDocument/rename', {
      changes: {
        'file:///src/utils.ts': [
          { range: { start: pos(5, 0), end: pos(5, 11) }, newText: 'newFunction' },
        ],
      },
    });

    const resolver = new SymbolResolver({ client });
    const docSymbols = await resolver.getDocumentSymbols('file:///src/utils.ts');
    expect(docSymbols).toHaveLength(1);

    const engine = new RefactorEngine({ client });
    const targetSymbol = docSymbols[0];
    const renameResult = await engine.rename(
      targetSymbol.location.uri,
      targetSymbol.location.range.start,
      'newFunction',
    );

    expect(renameResult.success).toBe(true);
    expect(renameResult.changes[0].edits[0].newText).toBe('newFunction');
  });

  it('should collect diagnostics from LSP notifications', async () => {
    const client = new LSPClient({ transport });
    await client.connect({ language: 'typescript', command: 'tsserver' });

    const collector = new DiagnosticsCollector({ client });

    const diagnostics: Diagnostic[] = [
      {
        range: { start: pos(10, 0), end: pos(10, 20) },
        severity: 'warning',
        message: 'Unused import after refactoring',
        source: 'typescript',
      },
      {
        range: { start: pos(5, 0), end: pos(5, 15) },
        severity: 'error',
        message: 'Type mismatch',
        source: 'typescript',
      },
    ];

    // Simulate server pushing diagnostics
    transport.simulateNotification('textDocument/publishDiagnostics', {
      uri: 'file:///src/app.ts',
      diagnostics,
    });

    const collected = await collector.collectDiagnostics('file:///src/app.ts');
    expect(collected).toHaveLength(2);
    expect(collector.getWarningCount()).toBe(1);
    expect(collector.getErrorCount()).toBe(1);
  });

  it('should track diagnostics across multiple files', async () => {
    const client = new LSPClient({ transport });
    await client.connect({ language: 'typescript', command: 'tsserver' });

    const collector = new DiagnosticsCollector({ client });

    transport.simulateNotification('textDocument/publishDiagnostics', {
      uri: 'file:///a.ts',
      diagnostics: [
        { range: { start: pos(1, 0), end: pos(1, 10) }, severity: 'error', message: 'Type mismatch' },
      ],
    });

    transport.simulateNotification('textDocument/publishDiagnostics', {
      uri: 'file:///b.ts',
      diagnostics: [
        { range: { start: pos(5, 0), end: pos(5, 15) }, severity: 'warning', message: 'Deprecated API' },
        { range: { start: pos(8, 0), end: pos(8, 10) }, severity: 'error', message: 'Missing import' },
      ],
    });

    const all = await collector.collectAll();
    expect(all.size).toBe(2);
    expect(collector.getErrorCount()).toBe(2);
    expect(collector.getWarningCount()).toBe(1);
  });

  it('should handle full workflow: connect → resolve → refactor → diagnose → disconnect', async () => {
    const client = new LSPClient({ transport });
    await client.connect({ language: 'typescript', command: 'tsserver' });
    expect(client.isConnected()).toBe(true);

    // Check capabilities
    const caps = client.getCapabilities();
    expect(caps?.definitionProvider).toBe(true);

    // Resolve via custom handler (legacy pattern still works)
    const resolver = new SymbolResolver({
      definitionResolver: async () => ({
        uri: 'file:///lib.ts',
        range: { start: pos(0, 0), end: pos(0, 10) },
      }),
    });
    const def = await resolver.findDefinition('file:///test.ts', pos(5, 5));
    expect(def).not.toBeNull();

    // Refactor with default handler (no client, no custom handler)
    const engine = new RefactorEngine();
    const result = await engine.rename('file:///lib.ts', pos(0, 0), 'renamedExport');
    expect(result.success).toBe(true);

    // Diagnostics via LSP notification
    const collector = new DiagnosticsCollector({ client });
    transport.simulateNotification('textDocument/publishDiagnostics', {
      uri: 'file:///lib.ts',
      diagnostics: [{
        range: { start: pos(0, 0), end: pos(0, 10) },
        severity: 'info',
        message: 'Symbol renamed',
      }],
    });
    expect(collector.getErrorCount()).toBe(0);

    // Disconnect
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });

  it('should prefer custom handlers over LSP client', async () => {
    const client = new LSPClient({ transport });
    await client.connect({ language: 'typescript', command: 'tsserver' });

    const customLocation: Location = {
      uri: 'file:///custom.ts',
      range: { start: pos(99, 0), end: pos(99, 10) },
    };

    // LSP would return different result
    transport.autoResponses.set('textDocument/definition', {
      uri: 'file:///lsp.ts',
      range: { start: pos(0, 0), end: pos(0, 5) },
    });

    const resolver = new SymbolResolver({
      client,
      definitionResolver: async () => customLocation,
    });

    const result = await resolver.findDefinition('file:///test.ts', pos(1, 1));
    expect(result).toEqual(customLocation);
  });

  it('should allow mixing manual diagnostics with LSP notifications', async () => {
    const client = new LSPClient({ transport });
    await client.connect({ language: 'typescript', command: 'tsserver' });

    const collector = new DiagnosticsCollector({ client });

    // Manual diagnostic
    collector.addDiagnostic('file:///manual.ts', {
      range: { start: pos(0, 0), end: pos(0, 5) },
      severity: 'error',
      message: 'Manual error',
    });

    // LSP notification
    transport.simulateNotification('textDocument/publishDiagnostics', {
      uri: 'file:///lsp.ts',
      diagnostics: [{
        range: { start: pos(1, 0), end: pos(1, 5) },
        severity: 'warning',
        message: 'LSP warning',
      }],
    });

    expect(collector.getErrorCount()).toBe(1);
    expect(collector.getWarningCount()).toBe(1);
    expect(collector.getTrackedUris()).toContain('file:///manual.ts');
    expect(collector.getTrackedUris()).toContain('file:///lsp.ts');
  });
});
