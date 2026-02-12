/**
 * Tests for Refactor Engine
 */

import { RefactorEngine, createRefactorEngine } from '@/core/lsp';
import type { Position, Range, RefactorResult } from '@/core/lsp';

const pos = (line: number, character: number): Position => ({ line, character });
const range = (sl: number, sc: number, el: number, ec: number): Range => ({
  start: pos(sl, sc),
  end: pos(el, ec),
});

describe('RefactorEngine', () => {
  describe('rename', () => {
    it('should rename successfully with default handler', async () => {
      const engine = new RefactorEngine();
      const result = await engine.rename('file:///test.ts', pos(5, 10), 'newName');

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].uri).toBe('file:///test.ts');
      expect(result.changes[0].edits[0].newText).toBe('newName');
    });

    it('should return failure for empty name', async () => {
      const engine = new RefactorEngine();
      const result = await engine.rename('file:///test.ts', pos(5, 10), '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('New name cannot be empty');
      expect(result.changes).toHaveLength(0);
    });

    it('should delegate to custom rename handler', async () => {
      const customResult: RefactorResult = {
        success: true,
        changes: [
          {
            uri: 'file:///test.ts',
            edits: [{ range: range(5, 10, 5, 15), newText: 'custom' }],
          },
          {
            uri: 'file:///other.ts',
            edits: [{ range: range(3, 0, 3, 5), newText: 'custom' }],
          },
        ],
      };

      const engine = new RefactorEngine({
        renameHandler: async () => customResult,
      });

      const result = await engine.rename('file:///test.ts', pos(5, 10), 'custom');
      expect(result.changes).toHaveLength(2);
    });
  });

  describe('extractFunction', () => {
    it('should extract function with default handler', async () => {
      const engine = new RefactorEngine();
      const r = range(10, 0, 15, 0);
      const result = await engine.extractFunction('file:///test.ts', r, 'extractedFn');

      expect(result.success).toBe(true);
      expect(result.changes[0].edits[0].newText).toBe('extractedFn()');
    });

    it('should return failure for empty function name', async () => {
      const engine = new RefactorEngine();
      const result = await engine.extractFunction('file:///test.ts', range(10, 0, 15, 0), '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Function name cannot be empty');
    });
  });

  describe('createRefactorEngine factory', () => {
    it('should create a RefactorEngine instance', () => {
      const engine = createRefactorEngine();
      expect(engine).toBeInstanceOf(RefactorEngine);
    });
  });
});
