/**
 * Compaction Strategy Tests
 */

import {
  CompactionStrategy,
  createCompactionStrategy,
} from '../../../../src/core/context/compaction-strategy';
import type { CompressionStrategy, CompressionTechnique } from '../../../../src/core/context/interfaces/quality-curve.interface';

// ============================================================================
// Helpers
// ============================================================================

function makeTechnique(name: string, enabled = true, tokenSaving = 100): CompressionTechnique {
  return { name, enabled, tokenSaving, description: '', applicableTo: ['text'] };
}

function makeStrategy(
  name: string,
  techniques: CompressionTechnique[],
  tokenReduction = 0.3,
): CompressionStrategy {
  return { name, techniques, tokenReduction, qualityImpact: 0.1 };
}

describe('CompactionStrategy', () => {
  let compactor: CompactionStrategy;

  beforeEach(() => {
    compactor = new CompactionStrategy();
  });

  // ==========================================================================
  // apply
  // ==========================================================================

  describe('apply', () => {
    it('should return content unchanged for empty strategy', async () => {
      const result = await compactor.apply('hello', makeStrategy('none', []));
      expect(result).toBe('hello');
    });

    it('should return empty content unchanged', async () => {
      const result = await compactor.apply('', makeStrategy('light', [makeTechnique('remove_verbose_comments')]));
      expect(result).toBe('');
    });

    it('should skip disabled techniques', async () => {
      const content = '/* verbose comment */ code';
      const strategy = makeStrategy('light', [makeTechnique('remove_verbose_comments', false)]);
      const result = await compactor.apply(content, strategy);
      expect(result).toBe(content);
    });

    it('should remove verbose comments', async () => {
      const content = '/* this is a long comment */\ncode here\n/** jsdoc comment */\nmore code';
      const strategy = makeStrategy('light', [makeTechnique('remove_verbose_comments')]);
      const result = await compactor.apply(content, strategy);
      expect(result).not.toContain('long comment');
      expect(result).toContain('code here');
    });

    it('should remove all comments', async () => {
      const content = '// single line\n/* multi\nline */\n# python\ncode';
      const strategy = makeStrategy('moderate', [makeTechnique('remove_all_comments')]);
      const result = await compactor.apply(content, strategy);
      expect(result).not.toContain('single line');
      expect(result).not.toContain('multi');
      expect(result).not.toContain('python');
      expect(result).toContain('code');
    });

    it('should summarize explanations', async () => {
      const content = 'In other words, the data is valid. The result follows.';
      const strategy = makeStrategy('moderate', [makeTechnique('summarize_explanations')]);
      const result = await compactor.apply(content, strategy);
      expect(result).not.toContain('In other words,');
    });

    it('should abbreviate identifiers', async () => {
      const content = 'The configuration and implementation of the documentation.';
      const strategy = makeStrategy('moderate', [makeTechnique('abbreviate_identifiers')]);
      const result = await compactor.apply(content, strategy);
      expect(result).toContain('config');
      expect(result).toContain('impl');
      expect(result).toContain('docs');
    });

    it('should apply minimal output', async () => {
      const content = '## Header\n**bold** text\n\n\n\nmore';
      const strategy = makeStrategy('aggressive', [makeTechnique('minimal_output')]);
      const result = await compactor.apply(content, strategy);
      expect(result).not.toContain('##');
      expect(result).not.toContain('**');
    });

    it('should skip examples', async () => {
      const content = 'Main text\n```\ncode example\n```\nAfter';
      const strategy = makeStrategy('aggressive', [makeTechnique('skip_examples')]);
      const result = await compactor.apply(content, strategy);
      expect(result).toContain('[code example removed]');
    });

    it('should extract code only', async () => {
      const content = 'Explanation text\n```js\nconst x = 1;\n```\nMore text\n```ts\nconst y = 2;\n```';
      const strategy = makeStrategy('aggressive', [makeTechnique('code_only')]);
      const result = await compactor.apply(content, strategy);
      expect(result).toContain('const x = 1;');
      expect(result).toContain('const y = 2;');
      expect(result).not.toContain('Explanation text');
    });

    it('should return original if no code blocks for code_only', async () => {
      const content = 'just plain text with no code blocks';
      const strategy = makeStrategy('aggressive', [makeTechnique('code_only')]);
      const result = await compactor.apply(content, strategy);
      expect(result).toBe(content);
    });

    it('should handle unknown technique gracefully', async () => {
      const content = 'test content';
      const strategy = makeStrategy('custom', [makeTechnique('unknown_technique')]);
      const result = await compactor.apply(content, strategy);
      expect(result).toBe(content);
    });

    it('should apply multiple techniques in order', async () => {
      const content = '/* comment */ The configuration works. In other words, it is good.';
      const strategy = makeStrategy('moderate', [
        makeTechnique('remove_all_comments'),
        makeTechnique('abbreviate_identifiers'),
        makeTechnique('summarize_explanations'),
      ]);
      const result = await compactor.apply(content, strategy);
      expect(result).not.toContain('comment');
      expect(result).toContain('config');
      expect(result).not.toContain('In other words,');
    });
  });

  // ==========================================================================
  // estimateSavings
  // ==========================================================================

  describe('estimateSavings', () => {
    it('should return 0 for empty content', () => {
      const strategy = makeStrategy('light', [makeTechnique('x', true, 100)]);
      expect(compactor.estimateSavings('', strategy)).toBe(0);
    });

    it('should return 0 for none strategy', () => {
      expect(compactor.estimateSavings('content', makeStrategy('none', []))).toBe(0);
    });

    it('should estimate savings based on techniques and reduction', () => {
      const content = 'a'.repeat(400); // ~100 tokens
      const strategy = makeStrategy('light', [
        makeTechnique('t1', true, 50),
        makeTechnique('t2', true, 30),
      ], 0.5);
      const savings = compactor.estimateSavings(content, strategy);
      expect(savings).toBeGreaterThan(0);
      expect(savings).toBeLessThanOrEqual(100); // can't save more than total
    });

    it('should skip disabled techniques', () => {
      const content = 'a'.repeat(400);
      const strategy = makeStrategy('light', [
        makeTechnique('t1', false, 50),
      ], 0.5);
      const savings = compactor.estimateSavings(content, strategy);
      expect(savings).toBe(0);
    });
  });

  // ==========================================================================
  // canApply
  // ==========================================================================

  describe('canApply', () => {
    it('should return false for empty content', () => {
      expect(compactor.canApply('')).toBe(false);
    });

    it('should return false for short content', () => {
      expect(compactor.canApply('short')).toBe(false);
    });

    it('should return true for content > 100 chars', () => {
      expect(compactor.canApply('a'.repeat(101))).toBe(true);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createCompactionStrategy', () => {
    it('should create instance', () => {
      expect(createCompactionStrategy()).toBeInstanceOf(CompactionStrategy);
    });
  });
});
