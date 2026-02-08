/**
 * Output Optimizer Tests
 */

import {
  OutputOptimizer,
  createOutputOptimizer,
} from '../../../../src/core/context/output-optimizer';
import { CHARS_PER_TOKEN } from '../../../../src/core/context/constants/context.constants';

describe('OutputOptimizer', () => {
  let optimizer: OutputOptimizer;

  beforeEach(() => {
    optimizer = new OutputOptimizer();
  });

  // ==========================================================================
  // estimateTokens
  // ==========================================================================

  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(optimizer.estimateTokens('')).toBe(0);
    });

    it('should estimate tokens based on character count', () => {
      const text = 'a'.repeat(CHARS_PER_TOKEN * 10);
      expect(optimizer.estimateTokens(text)).toBe(10);
    });

    it('should ceil fractional token counts', () => {
      const text = 'a'.repeat(CHARS_PER_TOKEN + 1);
      expect(optimizer.estimateTokens(text)).toBe(2);
    });
  });

  // ==========================================================================
  // optimize
  // ==========================================================================

  describe('optimize', () => {
    it('should return no compression when disabled', async () => {
      const disabled = new OutputOptimizer({ enabled: false });
      const result = await disabled.optimize('test content', {
        level: 'moderate',
        preserveCodeBlocks: true,
        techniques: ['remove_redundant_whitespace'],
      });
      expect(result.savedTokens).toBe(0);
      expect(result.compressed).toBe('test content');
    });

    it('should return no compression when level is none', async () => {
      const result = await optimizer.optimize('test content', {
        level: 'none',
        preserveCodeBlocks: true,
        techniques: ['remove_redundant_whitespace'],
      });
      expect(result.savedTokens).toBe(0);
    });

    it('should remove redundant whitespace', async () => {
      const input = 'hello\n\n\n\n\nworld   test';
      const result = await optimizer.optimize(input, {
        level: 'light',
        preserveCodeBlocks: false,
        techniques: ['remove_redundant_whitespace'],
      });
      expect(result.compressed).toBe('hello\n\nworld test');
      expect(result.savedTokens).toBeGreaterThanOrEqual(0);
    });

    it('should shorten verbose text', async () => {
      const input = 'In order to complete this task, It is important to note that we proceed.';
      const result = await optimizer.optimize(input, {
        level: 'light',
        preserveCodeBlocks: false,
        techniques: ['shorten_verbose_text'],
      });
      expect(result.compressed).toContain('To complete');
      expect(result.compressed).toContain('Note:');
    });

    it('should abbreviate common terms', async () => {
      const input = 'The configuration and implementation of the documentation.';
      const result = await optimizer.optimize(input, {
        level: 'moderate',
        preserveCodeBlocks: false,
        techniques: ['abbreviate_common_terms'],
      });
      expect(result.compressed).toContain('config');
      expect(result.compressed).toContain('impl');
      expect(result.compressed).toContain('docs');
    });

    it('should summarize explanations', async () => {
      const input = 'As you can see, the data is valid. To clarify, it works.';
      const result = await optimizer.optimize(input, {
        level: 'moderate',
        preserveCodeBlocks: false,
        techniques: ['summarize_explanations'],
      });
      expect(result.compressed).not.toContain('As you can see,');
      expect(result.compressed).not.toContain('To clarify,');
    });

    it('should apply minimal formatting', async () => {
      const input = '## Header\n**bold** and *italic* with `code`';
      const result = await optimizer.optimize(input, {
        level: 'aggressive',
        preserveCodeBlocks: false,
        techniques: ['minimal_formatting'],
      });
      expect(result.compressed).not.toContain('##');
      expect(result.compressed).not.toContain('**');
      expect(result.compressed).toContain('bold');
    });

    it('should preserve code blocks when enabled', async () => {
      const input = 'Text with   spaces\n```\ncode   block\n```\nMore   text';
      const result = await optimizer.optimize(input, {
        level: 'light',
        preserveCodeBlocks: true,
        techniques: ['remove_redundant_whitespace'],
      });
      expect(result.compressed).toContain('code   block');
      expect(result.compressed).toContain('Text with spaces');
    });

    it('should return compression ratio', async () => {
      const input = 'In order to do this. In order to do that. In order to do more.';
      const result = await optimizer.optimize(input, {
        level: 'light',
        preserveCodeBlocks: false,
        techniques: ['shorten_verbose_text'],
      });
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.originalTokens).toBeGreaterThan(result.compressedTokens);
    });

    it('should apply multiple techniques in order', async () => {
      const input = 'In order to\n\n\n\nThe configuration of the application.';
      const result = await optimizer.optimize(input, {
        level: 'moderate',
        preserveCodeBlocks: false,
        techniques: ['remove_redundant_whitespace', 'shorten_verbose_text', 'abbreviate_common_terms'],
      });
      expect(result.compressed).toContain('To');
      expect(result.compressed).toContain('config');
      expect(result.compressed).not.toContain('\n\n\n');
    });
  });

  // ==========================================================================
  // summarize
  // ==========================================================================

  describe('summarize', () => {
    it('should return content unchanged if within target', async () => {
      const content = 'short text';
      const result = await optimizer.summarize({
        content,
        targetTokens: 100,
      });
      expect(result).toBe(content);
    });

    it('should truncate content exceeding target', async () => {
      const content = 'a'.repeat(1000);
      const result = await optimizer.summarize({
        content,
        targetTokens: 10,
      });
      expect(result.length).toBeLessThan(content.length);
      expect(result).toContain('[truncated]');
    });

    it('should preserve key sentences when preserveKeys provided', async () => {
      const content = 'The error was critical. Performance was normal. The error caused failures.';
      const result = await optimizer.summarize({
        content,
        targetTokens: 10,
        preserveKeys: ['error'],
      });
      expect(result).toContain('error');
    });

    it('should truncate without preserveKeys', async () => {
      const content = 'A'.repeat(200) + ' important data here';
      const result = await optimizer.summarize({
        content,
        targetTokens: 5,
      });
      expect(result).toContain('[truncated]');
    });
  });

  // ==========================================================================
  // configure / getConfig
  // ==========================================================================

  describe('configure', () => {
    it('should update configuration', () => {
      optimizer.configure({ enabled: false });
      expect(optimizer.getConfig().enabled).toBe(false);
    });

    it('should merge with existing config', () => {
      const original = optimizer.getConfig();
      optimizer.configure({ compressionLevel: 'aggressive' });
      const updated = optimizer.getConfig();
      expect(updated.compressionLevel).toBe('aggressive');
      expect(updated.preserveCodeBlocks).toBe(original.preserveCodeBlocks);
    });
  });

  // ==========================================================================
  // createOutputOptimizer
  // ==========================================================================

  describe('createOutputOptimizer', () => {
    it('should create instance with defaults', () => {
      const opt = createOutputOptimizer();
      expect(opt).toBeInstanceOf(OutputOptimizer);
    });

    it('should create instance with custom config', () => {
      const opt = createOutputOptimizer({ enabled: false });
      expect(opt.getConfig().enabled).toBe(false);
    });
  });
});
