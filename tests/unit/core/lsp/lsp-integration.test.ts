/**
 * Tests for LSP Integration (end-to-end across modules)
 */

import {
  LSPClient,
  SymbolResolver,
  RefactorEngine,
  DiagnosticsCollector,
} from '@/core/lsp';
import type { Location, Position, SymbolInfo, Diagnostic } from '@/core/lsp';

const pos = (line: number, character: number): Position => ({ line, character });

describe('LSP Integration', () => {
  it('should connect client then resolve symbols', async () => {
    const client = new LSPClient();
    await client.connect({ language: 'typescript', command: 'tsserver' });

    expect(client.isConnected()).toBe(true);

    const definitionLocation: Location = {
      uri: 'file:///src/index.ts',
      range: { start: pos(0, 0), end: pos(0, 15) },
    };

    const resolver = new SymbolResolver({
      definitionResolver: async (_uri, _pos) => {
        // Verify client is connected before resolving
        if (!client.isConnected()) return null;
        return definitionLocation;
      },
    });

    const result = await resolver.findDefinition('file:///test.ts', pos(10, 5));
    expect(result).toEqual(definitionLocation);
  });

  it('should resolve symbols then refactor', async () => {
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

    const resolver = new SymbolResolver({
      documentSymbolsResolver: async () => symbols,
    });

    const docSymbols = await resolver.getDocumentSymbols('file:///src/utils.ts');
    expect(docSymbols).toHaveLength(1);

    const engine = new RefactorEngine();
    const targetSymbol = docSymbols[0];
    const renameResult = await engine.rename(
      targetSymbol.location.uri,
      targetSymbol.location.range.start,
      'newFunction',
    );

    expect(renameResult.success).toBe(true);
    expect(renameResult.changes[0].edits[0].newText).toBe('newFunction');
  });

  it('should collect diagnostics after refactoring', async () => {
    const engine = new RefactorEngine();

    // Perform a refactor
    const refactorResult = await engine.rename('file:///src/app.ts', pos(3, 0), 'updated');
    expect(refactorResult.success).toBe(true);

    // Simulate post-refactor diagnostics collection
    const collector = new DiagnosticsCollector();

    const warning: Diagnostic = {
      range: { start: pos(10, 0), end: pos(10, 20) },
      severity: 'warning',
      message: 'Unused import after refactoring',
      source: 'typescript',
    };

    collector.addDiagnostic('file:///src/app.ts', warning);

    const diagnostics = await collector.collectDiagnostics('file:///src/app.ts');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].severity).toBe('warning');
    expect(collector.getWarningCount()).toBe(1);
    expect(collector.getErrorCount()).toBe(0);
  });

  it('should track diagnostics across multiple files', async () => {
    const collector = new DiagnosticsCollector();

    const errorDiag: Diagnostic = {
      range: { start: pos(1, 0), end: pos(1, 10) },
      severity: 'error',
      message: 'Type mismatch',
      source: 'typescript',
    };

    const warningDiag: Diagnostic = {
      range: { start: pos(5, 0), end: pos(5, 15) },
      severity: 'warning',
      message: 'Deprecated API',
      source: 'typescript',
    };

    collector.addDiagnostic('file:///a.ts', errorDiag);
    collector.addDiagnostic('file:///b.ts', warningDiag);
    collector.addDiagnostic('file:///b.ts', errorDiag);

    const all = await collector.collectAll();
    expect(all.size).toBe(2);
    expect(collector.getErrorCount()).toBe(2);
    expect(collector.getWarningCount()).toBe(1);
  });

  it('should handle full workflow: connect, resolve, refactor, diagnose, disconnect', async () => {
    // 1. Connect
    const client = new LSPClient();
    await client.connect({ language: 'typescript', command: 'tsserver' });
    expect(client.isConnected()).toBe(true);

    // 2. Resolve
    const resolver = new SymbolResolver({
      findDefinition: async () => ({
        uri: 'file:///lib.ts',
        range: { start: pos(0, 0), end: pos(0, 10) },
      }),
    } as never);

    // Use default (returns null) - verifying it does not throw
    const def = await resolver.findDefinition('file:///test.ts', pos(5, 5));
    expect(def).toBeNull();

    // 3. Refactor
    const engine = new RefactorEngine();
    const result = await engine.rename('file:///lib.ts', pos(0, 0), 'renamedExport');
    expect(result.success).toBe(true);

    // 4. Diagnose
    const collector = new DiagnosticsCollector();
    collector.addDiagnostic('file:///lib.ts', {
      range: { start: pos(0, 0), end: pos(0, 10) },
      severity: 'info',
      message: 'Symbol renamed',
    });
    expect(collector.getErrorCount()).toBe(0);

    // 5. Disconnect
    await client.disconnect();
    expect(client.isConnected()).toBe(false);
  });
});
