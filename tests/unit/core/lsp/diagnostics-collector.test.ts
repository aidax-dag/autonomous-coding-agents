/**
 * Tests for Diagnostics Collector
 */

import { DiagnosticsCollector, createDiagnosticsCollector } from '@/core/lsp';
import type { Diagnostic } from '@/core/lsp';

function makeDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    range: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 10 },
    },
    severity: 'error',
    message: 'Test error',
    source: 'test',
    ...overrides,
  };
}

describe('DiagnosticsCollector', () => {
  describe('addDiagnostic and collectDiagnostics', () => {
    it('should add and retrieve diagnostics for a URI', async () => {
      const collector = new DiagnosticsCollector();

      collector.addDiagnostic('file:///test.ts', makeDiagnostic({ message: 'err1' }));
      collector.addDiagnostic('file:///test.ts', makeDiagnostic({ message: 'err2' }));

      const diagnostics = await collector.collectDiagnostics('file:///test.ts');
      expect(diagnostics).toHaveLength(2);
      expect(diagnostics[0].message).toBe('err1');
      expect(diagnostics[1].message).toBe('err2');
    });

    it('should return empty array for unknown URI', async () => {
      const collector = new DiagnosticsCollector();
      const diagnostics = await collector.collectDiagnostics('file:///unknown.ts');
      expect(diagnostics).toEqual([]);
    });
  });

  describe('collectAll', () => {
    it('should return all diagnostics grouped by URI', async () => {
      const collector = new DiagnosticsCollector();

      collector.addDiagnostic('file:///a.ts', makeDiagnostic());
      collector.addDiagnostic('file:///b.ts', makeDiagnostic());
      collector.addDiagnostic('file:///b.ts', makeDiagnostic({ severity: 'warning' }));

      const all = await collector.collectAll();
      expect(all.size).toBe(2);
      expect(all.get('file:///a.ts')).toHaveLength(1);
      expect(all.get('file:///b.ts')).toHaveLength(2);
    });
  });

  describe('getErrorCount and getWarningCount', () => {
    it('should count errors and warnings correctly', () => {
      const collector = new DiagnosticsCollector();

      collector.addDiagnostic('file:///a.ts', makeDiagnostic({ severity: 'error' }));
      collector.addDiagnostic('file:///a.ts', makeDiagnostic({ severity: 'error' }));
      collector.addDiagnostic('file:///a.ts', makeDiagnostic({ severity: 'warning' }));
      collector.addDiagnostic('file:///b.ts', makeDiagnostic({ severity: 'warning' }));
      collector.addDiagnostic('file:///b.ts', makeDiagnostic({ severity: 'info' }));

      expect(collector.getErrorCount()).toBe(2);
      expect(collector.getWarningCount()).toBe(2);
    });

    it('should return 0 when no diagnostics', () => {
      const collector = new DiagnosticsCollector();
      expect(collector.getErrorCount()).toBe(0);
      expect(collector.getWarningCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all stored diagnostics', async () => {
      const collector = new DiagnosticsCollector();

      collector.addDiagnostic('file:///a.ts', makeDiagnostic());
      collector.addDiagnostic('file:///b.ts', makeDiagnostic());

      collector.clear();

      expect(collector.getErrorCount()).toBe(0);
      const all = await collector.collectAll();
      expect(all.size).toBe(0);
    });
  });

  describe('createDiagnosticsCollector factory', () => {
    it('should create a DiagnosticsCollector instance', () => {
      const collector = createDiagnosticsCollector();
      expect(collector).toBeInstanceOf(DiagnosticsCollector);
    });

    it('should use custom uriCollector when provided', async () => {
      const mockDiags: Diagnostic[] = [
        makeDiagnostic({ message: 'from collector' }),
      ];

      const collector = createDiagnosticsCollector({
        uriCollector: async () => mockDiags,
      });

      const result = await collector.collectDiagnostics('file:///any.ts');
      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('from collector');
    });
  });
});
