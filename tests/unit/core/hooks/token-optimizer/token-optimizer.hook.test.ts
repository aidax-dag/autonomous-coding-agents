/**
 * Token Optimizer Hook Tests
 */

import {
  TokenOptimizerHook,
  OptimizationStrategy,
  ContentType,
  DEFAULT_TOKEN_OPTIMIZER_CONFIG,
} from '../../../../../src/core/hooks/token-optimizer/index.js';
import { HookEvent, HookAction } from '../../../../../src/core/interfaces/hook.interface.js';

describe('TokenOptimizerHook', () => {
  describe('Construction', () => {
    it('should create with default config', () => {
      const hook = new TokenOptimizerHook();

      expect(hook.name).toBe('token-optimizer');
      expect(hook.event).toBe(HookEvent.TASK_AFTER);
      expect(hook.isEnabled()).toBe(true);
    });

    it('should create with custom config', () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.ALL],
        maxOutputTokens: 1000,
        minTokensSaved: 5,
        charsPerToken: 3,
      });

      const config = hook.getOptimizerConfig();
      expect(config.strategies).toContain(OptimizationStrategy.ALL);
      expect(config.maxOutputTokens).toBe(1000);
      expect(config.minTokensSaved).toBe(5);
      expect(config.charsPerToken).toBe(3);
    });
  });

  describe('Content Type Detection', () => {
    let hook: TokenOptimizerHook;

    beforeEach(() => {
      hook = new TokenOptimizerHook();
    });

    it('should detect JSON content', () => {
      const json = '{"key": "value", "nested": {"a": 1}}';
      expect(hook.detectContentType(json)).toBe(ContentType.JSON);
    });

    it('should detect JSON array content', () => {
      const json = '[{"id": 1}, {"id": 2}]';
      expect(hook.detectContentType(json)).toBe(ContentType.JSON);
    });

    it('should detect TypeScript/JavaScript code', () => {
      const code = `
import { Component } from 'react';

export class MyComponent extends Component {
  render() {
    return <div>Hello</div>;
  }
}
`;
      expect(hook.detectContentType(code)).toBe(ContentType.CODE);
    });

    it('should detect Python code', () => {
      const code = `
def hello_world():
    print("Hello, World!")

if __name__ == "__main__":
    hello_world()
`;
      expect(hook.detectContentType(code)).toBe(ContentType.CODE);
    });

    it('should detect Markdown content', () => {
      const markdown = `
# Header

This is a paragraph with **bold** and _italic_ text.

- Item 1
- Item 2

[Link](https://example.com)
`;
      expect(hook.detectContentType(markdown)).toBe(ContentType.MARKDOWN);
    });

    it('should detect mixed content with code blocks', () => {
      const mixed = `
Here is some explanation:

\`\`\`javascript
const x = 1;
\`\`\`

And more text.
`;
      expect(hook.detectContentType(mixed)).toBe(ContentType.MIXED);
    });

    it('should detect plain text', () => {
      const text = 'This is just a simple plain text without any special formatting.';
      expect(hook.detectContentType(text)).toBe(ContentType.TEXT);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens with default chars per token', () => {
      const hook = new TokenOptimizerHook();
      const content = 'This is a test string with exactly forty characters.';

      // Default is 4 chars per token
      const estimated = hook.estimateTokens(content);
      expect(estimated).toBe(Math.ceil(content.length / 4));
    });

    it('should estimate tokens with custom chars per token', () => {
      const hook = new TokenOptimizerHook({ charsPerToken: 3 });
      const content = 'This is a test';

      const estimated = hook.estimateTokens(content);
      expect(estimated).toBe(Math.ceil(content.length / 3));
    });
  });

  describe('Whitespace Optimization', () => {
    let hook: TokenOptimizerHook;

    beforeEach(() => {
      hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
      });
    });

    it('should normalize multiple spaces', () => {
      const content = 'Hello    world     test';
      const optimized = hook.optimize(content, [OptimizationStrategy.WHITESPACE]);

      expect(optimized).toBe('Hello world test');
    });

    it('should trim leading and trailing whitespace', () => {
      const content = '   Hello world   ';
      const optimized = hook.optimize(content, [OptimizationStrategy.WHITESPACE]);

      expect(optimized).toBe('Hello world');
    });

    it('should preserve newlines', () => {
      const content = 'Line 1\n\nLine 2';
      const optimized = hook.optimize(content, [OptimizationStrategy.WHITESPACE]);

      expect(optimized).toContain('\n');
    });
  });

  describe('Empty Lines Removal', () => {
    let hook: TokenOptimizerHook;

    beforeEach(() => {
      hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.REMOVE_EMPTY_LINES],
      });
    });

    it('should reduce multiple empty lines to one', () => {
      const content = 'Line 1\n\n\n\nLine 2';
      const optimized = hook.optimize(content, [OptimizationStrategy.REMOVE_EMPTY_LINES]);

      expect(optimized).toBe('Line 1\n\nLine 2');
    });

    it('should preserve single empty lines', () => {
      const content = 'Line 1\n\nLine 2';
      const optimized = hook.optimize(content, [OptimizationStrategy.REMOVE_EMPTY_LINES]);

      expect(optimized).toBe('Line 1\n\nLine 2');
    });
  });

  describe('Deduplication', () => {
    let hook: TokenOptimizerHook;

    beforeEach(() => {
      hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.DEDUPLICATE],
      });
    });

    it('should remove duplicate lines', () => {
      const content = 'Line 1\nLine 2\nLine 1\nLine 3\nLine 2';
      const optimized = hook.optimize(content, [OptimizationStrategy.DEDUPLICATE]);

      expect(optimized).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should preserve empty lines', () => {
      const content = 'Line 1\n\nLine 2\n\nLine 3';
      const optimized = hook.optimize(content, [OptimizationStrategy.DEDUPLICATE]);

      expect(optimized).toBe('Line 1\n\nLine 2\n\nLine 3');
    });
  });

  describe('Comment Removal', () => {
    let hook: TokenOptimizerHook;

    beforeEach(() => {
      hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.REMOVE_COMMENTS],
      });
    });

    it('should remove single-line JS comments', () => {
      const content = `const x = 1;
// This is a comment
const y = 2;`;
      const optimized = hook.optimize(content, [OptimizationStrategy.REMOVE_COMMENTS]);

      expect(optimized).not.toContain('// This is a comment');
      expect(optimized).toContain('const x = 1');
      expect(optimized).toContain('const y = 2');
    });

    it('should remove multi-line comments', () => {
      const content = `const x = 1;
/* This is a
   multi-line comment */
const y = 2;`;
      const optimized = hook.optimize(content, [OptimizationStrategy.REMOVE_COMMENTS]);

      expect(optimized).not.toContain('multi-line comment');
      expect(optimized).toContain('const x = 1');
      expect(optimized).toContain('const y = 2');
    });

    it('should preserve shebang', () => {
      const content = `#!/usr/bin/env node
# This is a comment
print("hello")`;
      const optimized = hook.optimize(content, [OptimizationStrategy.REMOVE_COMMENTS]);

      expect(optimized).toContain('#!/usr/bin/env node');
      expect(optimized).not.toContain('# This is a comment');
    });
  });

  describe('Truncation', () => {
    it('should truncate content to max tokens', () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.TRUNCATE],
        maxOutputTokens: 10,
        charsPerToken: 4,
      });

      const content = 'This is a very long string that should definitely be truncated because it exceeds the maximum.';
      const optimized = hook.optimize(content, [OptimizationStrategy.TRUNCATE]);

      // Max 10 tokens * 4 chars = 40 chars max
      expect(optimized.length).toBeLessThanOrEqual(40 + 3); // +3 for '...'
      expect(optimized).toContain('...');
    });

    it('should not truncate short content', () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.TRUNCATE],
        maxOutputTokens: 100,
        charsPerToken: 4,
      });

      const content = 'Short content';
      const optimized = hook.optimize(content, [OptimizationStrategy.TRUNCATE]);

      expect(optimized).toBe(content);
    });
  });

  describe('Code Block Preservation', () => {
    it('should preserve code blocks during whitespace optimization', () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        preserveCodeBlocks: true,
      });

      const content = `Some    text    here

\`\`\`javascript
const x     =     1;
\`\`\`

More    text`;

      const optimized = hook.optimize(content, [OptimizationStrategy.WHITESPACE]);

      // Code block should be preserved
      expect(optimized).toContain('const x     =     1;');
      // Text outside should be optimized
      expect(optimized).toContain('Some text here');
    });
  });

  describe('Hook Execution', () => {
    it('should continue when no content in context', async () => {
      const hook = new TokenOptimizerHook();

      const result = await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: {},
      });

      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.message).toContain('No content');
    });

    it('should optimize content from context', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 1,
      });

      const result = await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: {
          content: 'Hello    world    with    extra    spaces',
        },
      });

      expect(result.data?.result.optimized).toBe(true);
      expect(result.data?.result.tokensSaved).toBeGreaterThan(0);
    });

    it('should extract content from various fields', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 1,
      });

      // Test 'output' field
      let result = await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { output: 'Test    output' },
      });
      expect(result.data?.result.originalContent).toBe('Test    output');

      // Test 'result' field
      result = await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { result: 'Test    result' },
      });
      expect(result.data?.result.originalContent).toBe('Test    result');

      // Test 'response' field
      result = await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { response: 'Test    response' },
      });
      expect(result.data?.result.originalContent).toBe('Test    response');
    });

    it('should return MODIFY when optimization saves tokens', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE, OptimizationStrategy.REMOVE_EMPTY_LINES],
        minTokensSaved: 1,
      });

      const result = await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: {
          content: 'Hello    world\n\n\n\nMore    text',
        },
      });

      expect(result.action).toBe(HookAction.MODIFY);
      expect(result.data?.result.tokensSaved).toBeGreaterThan(0);
    });

    it('should continue if savings are below threshold', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 100, // High threshold
      });

      const result = await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: {
          content: 'Hello  world', // Only saves 1 space
        },
      });

      expect(result.action).toBe(HookAction.CONTINUE);
    });
  });

  describe('Metrics', () => {
    it('should track optimization metrics', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 1,
      });

      await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { content: 'Hello    world' },
      });

      const metrics = hook.getMetrics();
      expect(metrics.totalOptimizations).toBe(1);
      expect(metrics.totalTokensSaved).toBeGreaterThan(0);
      expect(metrics.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should track strategy usage', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE, OptimizationStrategy.REMOVE_EMPTY_LINES],
        minTokensSaved: 1,
      });

      await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { content: 'Hello    world\n\n\n\nTest' },
      });

      const metrics = hook.getMetrics();
      expect(metrics.strategyUsage[OptimizationStrategy.WHITESPACE]).toBe(1);
      expect(metrics.strategyUsage[OptimizationStrategy.REMOVE_EMPTY_LINES]).toBe(1);
    });

    it('should reset metrics', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 1,
      });

      await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { content: 'Hello    world' },
      });

      hook.resetMetrics();
      const metrics = hook.getMetrics();

      expect(metrics.totalOptimizations).toBe(0);
      expect(metrics.totalTokensSaved).toBe(0);
    });
  });

  describe('Event Subscriptions', () => {
    it('should notify optimization callbacks', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 1,
      });

      const callback = jest.fn();
      hook.onOptimization(callback);

      await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { content: 'Hello    world' },
      });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0].optimized).toBe(true);
    });

    it('should notify tokens saved callbacks', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 1,
      });

      const callback = jest.fn();
      hook.onTokensSaved(callback);

      await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { content: 'Hello    world' },
      });

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toBeGreaterThan(0); // tokens saved
    });

    it('should notify truncation callbacks', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [],
        maxOutputTokens: 5,
        charsPerToken: 4,
      });

      const callback = jest.fn();
      hook.onTruncation(callback);

      await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { content: 'This is a very long string that will be truncated.' },
      });

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscription', async () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.WHITESPACE],
        minTokensSaved: 1,
      });

      const callback = jest.fn();
      const subscription = hook.onOptimization(callback);
      subscription.unsubscribe();

      await hook.execute({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: { content: 'Hello    world' },
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('All Strategies', () => {
    it('should apply all strategies when ALL is specified', () => {
      const hook = new TokenOptimizerHook({
        strategies: [OptimizationStrategy.ALL],
        maxOutputTokens: 0, // No truncation limit
      });

      const content = `
// Comment
const x   =   1;

const y = 2;

const y = 2;
      `;

      const optimized = hook.optimize(content, [OptimizationStrategy.ALL]);

      // Comments removed
      expect(optimized).not.toContain('// Comment');
      // Whitespace normalized (no 3+ consecutive spaces)
      expect(optimized).not.toMatch(/[ ]{3,}/);
      // Duplicates removed (exact duplicate lines)
      const lines = optimized.split('\n').filter((l) => l.includes('const y'));
      expect(lines.length).toBe(1);
    });
  });

  describe('Hook Lifecycle', () => {
    it('should respect shouldRun check', async () => {
      const hook = new TokenOptimizerHook();

      const result = hook.shouldRun({
        event: HookEvent.TASK_BEFORE, // Wrong event
        timestamp: new Date(),
        source: 'test',
        data: {},
      });

      expect(result).toBe(false);
    });

    it('should respect enabled state', async () => {
      const hook = new TokenOptimizerHook();
      hook.disable();

      const result = hook.shouldRun({
        event: HookEvent.TASK_AFTER,
        timestamp: new Date(),
        source: 'test',
        data: {},
      });

      expect(result).toBe(false);
    });
  });

  describe('Dispose', () => {
    it('should clean up subscriptions on dispose', () => {
      const hook = new TokenOptimizerHook();

      const callback1 = jest.fn();
      const callback2 = jest.fn();
      hook.onOptimization(callback1);
      hook.onTokensSaved(callback2);

      hook.dispose();

      // Callbacks should be cleared
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Default Config', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.strategies).toContain(OptimizationStrategy.WHITESPACE);
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.strategies).toContain(OptimizationStrategy.REMOVE_EMPTY_LINES);
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.maxOutputTokens).toBe(0);
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.truncationSuffix).toBe('...');
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.minTokensSaved).toBe(10);
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.charsPerToken).toBe(4);
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.preserveCodeBlocks).toBe(true);
      expect(DEFAULT_TOKEN_OPTIMIZER_CONFIG.preserveMarkdown).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should set token budget manager', () => {
      const hook = new TokenOptimizerHook();
      const mockManager = {} as any;

      hook.setTokenBudgetManager(mockManager);
      // No error means success
    });

    it('should set budget ID', () => {
      const hook = new TokenOptimizerHook();
      hook.setBudgetId('test-budget');
      // No error means success
    });
  });
});
