/**
 * Tool Executor Tests
 */

import { ToolRegistry, ToolExecutor, BaseTool } from '../../../../src/core/tools';
import {
  ToolCategory,
  ToolSchema,
  ToolResult,
  ToolExecutionOptions,
} from '../../../../src/core/interfaces/tool.interface';

/**
 * Mock tool for testing
 */
class MockTool extends BaseTool<{ input: string }, string> {
  readonly name: string;
  readonly description: string;
  readonly schema: ToolSchema;
  private executionDelay: number;
  private shouldFail: boolean;

  constructor(
    name: string,
    options: {
      delay?: number;
      shouldFail?: boolean;
      category?: ToolCategory;
    } = {}
  ) {
    super();
    this.name = name;
    this.description = `Description for ${name}`;
    this.executionDelay = options.delay || 0;
    this.shouldFail = options.shouldFail || false;
    this.schema = {
      name: this.name,
      description: this.description,
      category: options.category || ToolCategory.CUSTOM,
      version: '1.0.0',
      parameters: [
        {
          name: 'input',
          type: 'string',
          description: 'Input value',
          required: true,
        },
      ],
      returns: {
        type: 'string',
        description: 'Output value',
      },
      tags: [],
    };
  }

  async execute(
    params: { input: string },
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<string>> {
    if (this.executionDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.executionDelay));
    }

    if (this.shouldFail) {
      throw new Error('Tool execution failed');
    }

    return this.success(`Result: ${params.input}`, 100);
  }
}

/**
 * Counting tool for retry tests
 */
class CountingTool extends BaseTool<{ input: string }, string> {
  readonly name = 'counting-tool';
  readonly description = 'A tool that counts calls';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.CUSTOM,
    version: '1.0.0',
    parameters: [
      {
        name: 'input',
        type: 'string',
        description: 'Input value',
        required: true,
      },
    ],
    returns: {
      type: 'string',
      description: 'Output value',
    },
    tags: [],
  };

  public callCount = 0;
  private failUntil: number;

  constructor(failUntil: number = 0) {
    super();
    this.failUntil = failUntil;
  }

  async execute(
    _params: { input: string },
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<string>> {
    this.callCount++;
    if (this.callCount <= this.failUntil) {
      throw new Error(`Fail attempt ${this.callCount}`);
    }
    return this.success(`Success on attempt ${this.callCount}`, 10);
  }
}

describe('ToolExecutor', () => {
  let registry: ToolRegistry;
  let executor: ToolExecutor;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ToolExecutor(registry);
  });

  describe('Basic Execution', () => {
    it('should execute a registered tool', async () => {
      registry.register(new MockTool('test-tool'));

      const result = await executor.execute<string>('test-tool', { input: 'hello' });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Result: hello');
    });

    it('should return error for unknown tool', async () => {
      const result = await executor.execute('unknown-tool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
    });

    it('should validate parameters before execution', async () => {
      registry.register(new MockTool('test-tool'));

      const result = await executor.execute('test-tool', {});

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors', async () => {
      registry.register(new MockTool('failing-tool', { shouldFail: true }));

      const result = await executor.execute('failing-tool', { input: 'test' });

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Tool execution failed');
    });
  });

  describe('Timeout', () => {
    it('should timeout slow tools', async () => {
      registry.register(new MockTool('slow-tool', { delay: 200 }));

      const result = await executor.execute(
        'slow-tool',
        { input: 'test' },
        { timeout: 50 }
      );

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    it('should complete before timeout', async () => {
      registry.register(new MockTool('fast-tool', { delay: 10 }));

      const result = await executor.execute<string>(
        'fast-tool',
        { input: 'test' },
        { timeout: 500 }
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Retry', () => {
    it('should retry on failure', async () => {
      const countingTool = new CountingTool(2); // Fail first 2 attempts
      registry.register(countingTool);

      const result = await executor.execute<string>(
        'counting-tool',
        { input: 'test' },
        { retries: 3, retryDelay: 10 }
      );

      expect(result.success).toBe(true);
      expect(countingTool.callCount).toBe(3);
    });

    it('should fail after max retries', async () => {
      const countingTool = new CountingTool(5); // Fail first 5 attempts
      registry.register(countingTool);

      const result = await executor.execute(
        'counting-tool',
        { input: 'test' },
        { retries: 2, retryDelay: 10 }
      );

      expect(result.success).toBe(false);
      expect(countingTool.callCount).toBe(3); // Initial + 2 retries
    });
  });

  describe('Sequential Execution', () => {
    it('should execute tools in sequence', async () => {
      registry.register(new MockTool('tool-1'));
      registry.register(new MockTool('tool-2'));
      registry.register(new MockTool('tool-3'));

      const results = await executor.executeSequence([
        { toolName: 'tool-1', params: { input: 'a' } },
        { toolName: 'tool-2', params: { input: 'b' } },
        { toolName: 'tool-3', params: { input: 'c' } },
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('should stop on failure', async () => {
      registry.register(new MockTool('tool-1'));
      registry.register(new MockTool('failing-tool', { shouldFail: true }));
      registry.register(new MockTool('tool-3'));

      const results = await executor.executeSequence([
        { toolName: 'tool-1', params: { input: 'a' } },
        { toolName: 'failing-tool', params: { input: 'b' } },
        { toolName: 'tool-3', params: { input: 'c' } },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute tools in parallel', async () => {
      registry.register(new MockTool('tool-1', { delay: 50 }));
      registry.register(new MockTool('tool-2', { delay: 50 }));
      registry.register(new MockTool('tool-3', { delay: 50 }));

      const startTime = Date.now();
      const results = await executor.executeParallel([
        { toolName: 'tool-1', params: { input: 'a' } },
        { toolName: 'tool-2', params: { input: 'b' } },
        { toolName: 'tool-3', params: { input: 'c' } },
      ]);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      // Should complete faster than sequential (3 * 50ms = 150ms)
      expect(duration).toBeLessThan(150);
    });

    it('should handle partial failures in parallel', async () => {
      registry.register(new MockTool('tool-1'));
      registry.register(new MockTool('failing-tool', { shouldFail: true }));
      registry.register(new MockTool('tool-3'));

      const results = await executor.executeParallel([
        { toolName: 'tool-1', params: { input: 'a' } },
        { toolName: 'failing-tool', params: { input: 'b' } },
        { toolName: 'tool-3', params: { input: 'c' } },
      ]);

      expect(results).toHaveLength(3);
      const successCount = results.filter((r) => r.success).length;
      expect(successCount).toBe(2);
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      const countingTool = new CountingTool();
      registry.register(countingTool);

      // First call
      await executor.execute('counting-tool', { input: 'test' }, { cache: true });
      // Second call with same params
      await executor.execute('counting-tool', { input: 'test' }, { cache: true });

      expect(countingTool.callCount).toBe(1); // Only called once
    });

    it('should not cache by default', async () => {
      const countingTool = new CountingTool();
      registry.register(countingTool);

      await executor.execute('counting-tool', { input: 'test' });
      await executor.execute('counting-tool', { input: 'test' });

      expect(countingTool.callCount).toBe(2);
    });

    it('should respect cache TTL', async () => {
      const countingTool = new CountingTool();
      registry.register(countingTool);

      await executor.execute(
        'counting-tool',
        { input: 'test' },
        { cache: true, cacheTTL: 50 }
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      await executor.execute(
        'counting-tool',
        { input: 'test' },
        { cache: true, cacheTTL: 50 }
      );

      expect(countingTool.callCount).toBe(2); // Called twice due to TTL expiry
    });

    it('should cache per unique params', async () => {
      const countingTool = new CountingTool();
      registry.register(countingTool);

      await executor.execute('counting-tool', { input: 'a' }, { cache: true });
      await executor.execute('counting-tool', { input: 'b' }, { cache: true });
      await executor.execute('counting-tool', { input: 'a' }, { cache: true });

      expect(countingTool.callCount).toBe(2); // Different params = different cache
    });
  });

  describe('History', () => {
    it('should record execution history', async () => {
      registry.register(new MockTool('test-tool'));

      await executor.execute('test-tool', { input: 'test' });

      const history = executor.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].toolName).toBe('test-tool');
      expect(history[0].result.success).toBe(true);
    });

    it('should limit history with parameter', async () => {
      registry.register(new MockTool('test-tool'));

      await executor.execute('test-tool', { input: '1' });
      await executor.execute('test-tool', { input: '2' });
      await executor.execute('test-tool', { input: '3' });

      const history = executor.getHistory(2);
      expect(history).toHaveLength(2);
    });

    it('should clear history', async () => {
      registry.register(new MockTool('test-tool'));

      await executor.execute('test-tool', { input: 'test' });
      executor.clearHistory();

      expect(executor.getHistory()).toHaveLength(0);
    });

    it('should record failed executions', async () => {
      registry.register(new MockTool('failing-tool', { shouldFail: true }));

      await executor.execute('failing-tool', { input: 'test' });

      const history = executor.getHistory();
      expect(history[0].result.success).toBe(false);
    });
  });

  describe('Dry Run', () => {
    it('should validate without executing in dry run', async () => {
      const countingTool = new CountingTool();
      registry.register(countingTool);

      const result = await executor.execute(
        'counting-tool',
        { input: 'test' },
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(countingTool.callCount).toBe(0); // Not executed
    });

    it('should return validation error in dry run', async () => {
      registry.register(new MockTool('test-tool'));

      const result = await executor.execute(
        'test-tool',
        {},
        { dryRun: true }
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_FAILED');
    });
  });
});
