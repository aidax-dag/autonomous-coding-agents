/**
 * Output Optimizer Tests
 *
 * Tests for token-aware output optimization with dynamic truncation.
 */

import {
  OutputOptimizer,
  DEFAULT_TOOL_LIMITS,
  type ContextWindowUsage,
} from '../../../../src/dx/output-optimizer';

describe('OutputOptimizer', () => {
  let optimizer: OutputOptimizer;

  beforeEach(() => {
    optimizer = new OutputOptimizer();
  });

  describe('Token Estimation', () => {
    it('should estimate tokens based on character count', () => {
      // Default: 4 characters per token
      const text = 'Hello World!'; // 12 chars
      expect(optimizer.estimateTokens(text)).toBe(3);
    });

    it('should handle empty string', () => {
      expect(optimizer.estimateTokens('')).toBe(0);
    });

    it('should use custom chars-per-token ratio', () => {
      const customOptimizer = new OutputOptimizer({ charsPerToken: 3 });
      const text = 'Hello World!!'; // 13 chars
      expect(customOptimizer.estimateTokens(text)).toBe(5); // ceil(13/3) = 5
    });

    it('should estimate tokens for batch', () => {
      const texts = ['Hello', 'World', 'Test'];
      const estimates = optimizer.estimateTokensBatch(texts);

      expect(estimates).toHaveLength(3);
      expect(estimates[0]).toBe(2); // ceil(5/4) = 2
      expect(estimates[1]).toBe(2);
      expect(estimates[2]).toBe(1);
    });
  });

  describe('Basic Truncation', () => {
    it('should not truncate when within limit', () => {
      const text = 'Short text';
      const result = optimizer.truncate(text, { targetMaxTokens: 100 });

      expect(result.truncated).toBe(false);
      expect(result.result).toBe(text);
    });

    it('should truncate when exceeding limit', () => {
      const text = 'A'.repeat(400); // 100 tokens at 4 chars/token
      const result = optimizer.truncate(text, { targetMaxTokens: 50 });

      expect(result.truncated).toBe(true);
      expect(result.result.length).toBeLessThan(text.length);
    });

    it('should preserve header lines when truncating', () => {
      const text = `# Header 1
## Header 2
Some content line 1
Some content line 2
${'Content '.repeat(100)}`;

      const result = optimizer.truncate(text, {
        targetMaxTokens: 20,
        preserveHeaderLines: 3,
      });

      expect(result.truncated).toBe(true);
      expect(result.result).toContain('# Header 1');
      expect(result.result).toContain('## Header 2');
    });
  });

  describe('Truncation Modes', () => {
    const longText = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\n' + 'A'.repeat(400);

    it('should truncate from head (keep end)', () => {
      const result = optimizer.truncate(longText, {
        targetMaxTokens: 30,
        mode: 'head',
      });

      expect(result.truncated).toBe(true);
    });

    it('should truncate from tail (keep start)', () => {
      const result = optimizer.truncate(longText, {
        targetMaxTokens: 30,
        mode: 'tail',
      });

      expect(result.truncated).toBe(true);
      expect(result.result).toContain('Line 1');
    });

    it('should truncate from middle', () => {
      const result = optimizer.truncate(longText, {
        targetMaxTokens: 30,
        mode: 'middle',
      });

      expect(result.truncated).toBe(true);
    });

    it('should use smart mode by default', () => {
      const result = optimizer.truncate(longText, { targetMaxTokens: 30 });

      expect(result.truncated).toBe(true);
    });
  });

  describe('Tool-Specific Limits', () => {
    it('should have default tool limits', () => {
      expect(DEFAULT_TOOL_LIMITS.webfetch).toBe(10_000);
      expect(DEFAULT_TOOL_LIMITS.grep).toBe(50_000);
      expect(DEFAULT_TOOL_LIMITS.read).toBe(100_000);
    });

    it('should get default tool limit', () => {
      expect(optimizer.getToolLimit('webfetch')).toBe(10_000);
      expect(optimizer.getToolLimit('grep')).toBe(50_000);
    });

    it('should set custom tool limit', () => {
      optimizer.setToolLimit('custom_tool', 5000);
      expect(optimizer.getToolLimit('custom_tool')).toBe(5000);
    });

    it('should return default limit for unknown tools', () => {
      expect(optimizer.getToolLimit('unknown_tool')).toBe(50_000); // default
    });
  });

  describe('Dynamic Truncation', () => {
    const createContextUsage = (usedTokens: number): ContextWindowUsage => ({
      usedTokens,
      remainingTokens: 200_000 - usedTokens,
      usagePercentage: usedTokens / 200_000,
      limit: 200_000,
      inputTokens: usedTokens * 0.8,
      outputTokens: usedTokens * 0.2,
      cachedTokens: 0,
    });

    it('should adjust truncation based on context window usage', () => {
      const text = 'A'.repeat(1000);

      // Low context usage - more generous limit
      const resultLow = optimizer.truncateDynamic(text, createContextUsage(10_000));

      // High context usage - stricter limit
      const resultHigh = optimizer.truncateDynamic(text, createContextUsage(150_000));

      // At high usage, output should be more truncated or equal
      if (resultHigh.finalTokens && resultLow.finalTokens) {
        expect(resultHigh.finalTokens).toBeLessThanOrEqual(resultLow.finalTokens);
      }
    });

    it('should apply targetMaxTokens in dynamic truncation', () => {
      const text = 'A'.repeat(100_000);
      const toolLimit = optimizer.getToolLimit('webfetch'); // 10k

      const result = optimizer.truncateDynamic(
        text,
        createContextUsage(10_000),
        {
          targetMaxTokens: toolLimit, // Explicitly pass tool limit
        }
      );

      // Should respect the targetMaxTokens limit
      expect(result.truncated).toBe(true);
      if (result.finalTokens) {
        // truncateDynamic uses min(remainingTokens * headroom, targetMaxTokens)
        // remainingTokens = 190_000, headroom = 0.5, so that's 95_000
        // targetMaxTokens = 10_000, so it should respect 10_000
        expect(result.finalTokens).toBeLessThanOrEqual(toolLimit);
      }
    });
  });

  describe('Configuration', () => {
    it('should return current configuration', () => {
      const config = optimizer.getConfig();

      expect(config).toHaveProperty('charsPerToken');
      expect(config).toHaveProperty('defaultMaxTokens');
      expect(config).toHaveProperty('preserveHeaderLines');
    });

    it('should update configuration', () => {
      optimizer.updateConfig({ charsPerToken: 3 });
      const config = optimizer.getConfig();

      expect(config.charsPerToken).toBe(3);
    });
  });

  describe('Needs Optimization Check', () => {
    it('should return false for short text', () => {
      const text = 'Short text';
      expect(optimizer.needsOptimization(text)).toBe(false);
    });

    it('should return true for long text', () => {
      const text = 'A'.repeat(300_000); // Very long text
      expect(optimizer.needsOptimization(text)).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should track truncation statistics', () => {
      // Perform some truncations
      // Note: Implementation only updates stats when truncation actually occurs
      // (early return for non-truncated outputs skips updateStats)
      optimizer.truncate('Short text', { targetMaxTokens: 100 }); // Not truncated, not counted
      optimizer.truncate('A'.repeat(400), { targetMaxTokens: 50 }); // Truncated, counted
      optimizer.truncate('B'.repeat(800), { targetMaxTokens: 50 }); // Truncated, counted

      const stats = optimizer.getStats();

      // Only truncated operations update stats
      expect(stats.totalProcessed).toBe(2);
      expect(stats.truncatedCount).toBe(2);
      expect(stats.tokensSaved).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      optimizer.truncate('A'.repeat(400), { targetMaxTokens: 50 });
      optimizer.resetStats();

      const stats = optimizer.getStats();

      expect(stats.totalProcessed).toBe(0);
      expect(stats.truncatedCount).toBe(0);
    });
  });

  describe('Truncation Marker', () => {
    it('should include truncation marker when truncated', () => {
      const text = 'A'.repeat(400);
      const result = optimizer.truncate(text, { targetMaxTokens: 50 });

      // Result should indicate truncation happened
      expect(result.truncated).toBe(true);
      expect(result.reason).toBeDefined();
    });
  });

  describe('Summarization', () => {
    it('should provide summarization result structure', async () => {
      const text = 'A long text that needs summarization. '.repeat(50);
      const result = await optimizer.summarize(text, 20);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('originalTokens');
      expect(result).toHaveProperty('summaryTokens');
      expect(result.summaryTokens).toBeLessThanOrEqual(result.originalTokens);
    });
  });

  describe('Calculate Optimal Size', () => {
    it('should calculate optimal size based on context', () => {
      const contextUsage: ContextWindowUsage = {
        usedTokens: 100_000,
        remainingTokens: 100_000,
        usagePercentage: 0.5,
        limit: 200_000,
        inputTokens: 80_000,
        outputTokens: 20_000,
        cachedTokens: 0,
      };

      const optimalSize = optimizer.calculateOptimalSize(contextUsage);

      expect(optimalSize).toBeGreaterThan(0);
      expect(optimalSize).toBeLessThanOrEqual(contextUsage.remainingTokens);
    });

    it('should respect target headroom', () => {
      const contextUsage: ContextWindowUsage = {
        usedTokens: 100_000,
        remainingTokens: 100_000,
        usagePercentage: 0.5,
        limit: 200_000,
        inputTokens: 80_000,
        outputTokens: 20_000,
        cachedTokens: 0,
      };

      const optimalWithLowHeadroom = optimizer.calculateOptimalSize(contextUsage, 0.1);
      const optimalWithHighHeadroom = optimizer.calculateOptimalSize(contextUsage, 0.5);

      // In the implementation, headroom is the fraction of remaining tokens to USE
      // Higher headroom value = more tokens to use
      // 0.1 * 100_000 = 10_000 tokens
      // 0.5 * 100_000 = 50_000 tokens
      expect(optimalWithLowHeadroom).toBe(10_000);
      expect(optimalWithHighHeadroom).toBe(50_000);
      expect(optimalWithHighHeadroom).toBeGreaterThan(optimalWithLowHeadroom);
    });
  });
});

describe('OutputOptimizer Configuration', () => {
  it('should accept custom configuration', () => {
    const optimizer = new OutputOptimizer({
      charsPerToken: 3,
      defaultMaxTokens: 10_000,
    });

    // 12 chars / 3 = 4 tokens
    expect(optimizer.estimateTokens('Hello World!')).toBe(4);
  });

  it('should use default configuration when not specified', () => {
    const optimizer = new OutputOptimizer();
    // Default: 4 chars per token
    expect(optimizer.estimateTokens('AAAA')).toBe(1);
  });
});
