/**
 * Tests for Symbol Resolver
 */

import { SymbolResolver, createSymbolResolver } from '@/core/lsp';
import type { Location, Position, SymbolInfo } from '@/core/lsp';

const pos = (line: number, character: number): Position => ({ line, character });

describe('SymbolResolver', () => {
  describe('findDefinition', () => {
    it('should return null with default resolver', async () => {
      const resolver = new SymbolResolver();
      const result = await resolver.findDefinition('file:///test.ts', pos(10, 5));
      expect(result).toBeNull();
    });

    it('should delegate to custom definitionResolver', async () => {
      const expectedLocation: Location = {
        uri: 'file:///src/utils.ts',
        range: { start: pos(5, 0), end: pos(5, 20) },
      };

      const resolver = new SymbolResolver({
        definitionResolver: async () => expectedLocation,
      });

      const result = await resolver.findDefinition('file:///test.ts', pos(10, 5));
      expect(result).toEqual(expectedLocation);
    });
  });

  describe('findReferences', () => {
    it('should return empty array with default resolver', async () => {
      const resolver = new SymbolResolver();
      const result = await resolver.findReferences('file:///test.ts', pos(10, 5));
      expect(result).toEqual([]);
    });

    it('should delegate to custom referencesResolver', async () => {
      const refs: Location[] = [
        { uri: 'file:///a.ts', range: { start: pos(1, 0), end: pos(1, 10) } },
        { uri: 'file:///b.ts', range: { start: pos(2, 0), end: pos(2, 10) } },
      ];

      const resolver = new SymbolResolver({
        referencesResolver: async () => refs,
      });

      const result = await resolver.findReferences('file:///test.ts', pos(10, 5));
      expect(result).toHaveLength(2);
      expect(result).toEqual(refs);
    });
  });

  describe('getDocumentSymbols', () => {
    it('should return empty array with default resolver', async () => {
      const resolver = new SymbolResolver();
      const result = await resolver.getDocumentSymbols('file:///test.ts');
      expect(result).toEqual([]);
    });

    it('should delegate to custom documentSymbolsResolver', async () => {
      const symbols: SymbolInfo[] = [
        {
          name: 'MyClass',
          kind: 'class',
          location: { uri: 'file:///test.ts', range: { start: pos(0, 0), end: pos(10, 0) } },
        },
      ];

      const resolver = new SymbolResolver({
        documentSymbolsResolver: async () => symbols,
      });

      const result = await resolver.getDocumentSymbols('file:///test.ts');
      expect(result).toEqual(symbols);
    });
  });

  describe('getWorkspaceSymbols', () => {
    it('should return empty array with default resolver', async () => {
      const resolver = new SymbolResolver();
      const result = await resolver.getWorkspaceSymbols('MyClass');
      expect(result).toEqual([]);
    });
  });

  describe('createSymbolResolver factory', () => {
    it('should create a SymbolResolver instance', () => {
      const resolver = createSymbolResolver();
      expect(resolver).toBeInstanceOf(SymbolResolver);
    });
  });
});
