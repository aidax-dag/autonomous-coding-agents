/**
 * PreExploration Tests
 */

import { PreExploration, createPreExploration } from '../../../../src/core/deep-worker/pre-exploration';
import type { DeepWorkerContext } from '../../../../src/core/deep-worker/interfaces/deep-worker.interface';

const context: DeepWorkerContext = {
  workspaceDir: '/tmp/test',
  taskDescription: 'Implement auth feature',
};

describe('PreExploration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return stub result without executor', async () => {
    const explorer = new PreExploration();
    const result = await explorer.explore(context);

    expect(result.summary).toContain('auth feature');
    expect(result.relevantFiles).toEqual([]);
    expect(result.patterns).toEqual([]);
    expect(result.dependencies).toEqual([]);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should use custom executor', async () => {
    const explorer = new PreExploration({
      executor: async (ctx) => ({
        relevantFiles: ['src/auth.ts'],
        patterns: ['middleware pattern'],
        dependencies: ['express'],
        summary: `Found files for: ${ctx.taskDescription}`,
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);

    expect(result.relevantFiles).toEqual(['src/auth.ts']);
    expect(result.patterns).toEqual(['middleware pattern']);
    expect(result.dependencies).toEqual(['express']);
  });

  it('should respect maxFiles limit', async () => {
    const explorer = new PreExploration({
      maxFiles: 2,
      executor: async () => ({
        relevantFiles: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
        patterns: [],
        dependencies: [],
        summary: 'many files',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toHaveLength(2);
  });

  it('should timeout long-running executor', async () => {
    const explorer = new PreExploration({
      timeout: 50,
      executor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return { relevantFiles: [], patterns: [], dependencies: [], summary: 'late', duration: 0 };
      },
    });

    await expect(explorer.explore(context)).rejects.toThrow('timed out');
  });

  it('should be created via factory', () => {
    expect(createPreExploration()).toBeInstanceOf(PreExploration);
  });

  // ── New: explore() with different project contexts ──────────

  it('should include taskDescription in stub summary', async () => {
    const explorer = new PreExploration();
    const ctx: DeepWorkerContext = {
      workspaceDir: '/project',
      taskDescription: 'Refactor database layer',
    };
    const result = await explorer.explore(ctx);
    expect(result.summary).toBe('Exploration of: Refactor database layer');
  });

  it('should default maxFiles to 50', async () => {
    const files = Array.from({ length: 60 }, (_, i) => `file${i}.ts`);
    const explorer = new PreExploration({
      executor: async () => ({
        relevantFiles: files,
        patterns: [],
        dependencies: [],
        summary: 'many',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toHaveLength(50);
  });

  it('should not truncate when files are under maxFiles', async () => {
    const explorer = new PreExploration({
      maxFiles: 10,
      executor: async () => ({
        relevantFiles: ['a.ts', 'b.ts'],
        patterns: [],
        dependencies: [],
        summary: 'few',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toHaveLength(2);
  });

  it('should overwrite executor duration with actual elapsed time', async () => {
    const explorer = new PreExploration({
      executor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          relevantFiles: [],
          patterns: [],
          dependencies: [],
          summary: 'done',
          duration: 999, // executor returns arbitrary duration
        };
      },
    });

    const result = await explorer.explore(context);
    // The implementation overwrites duration with Date.now() - start
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.duration).not.toBe(999);
  });

  it('should pass the full context to executor', async () => {
    const executorSpy = jest.fn().mockResolvedValue({
      relevantFiles: [],
      patterns: [],
      dependencies: [],
      summary: 'spy',
      duration: 0,
    });

    const fullContext: DeepWorkerContext = {
      workspaceDir: '/workspace',
      taskDescription: 'Fix bug #123',
      projectContext: 'Node.js backend',
      maxRetries: 3,
      stepTimeout: 5000,
      metadata: { priority: 'high' },
    };

    const explorer = new PreExploration({ executor: executorSpy });
    await explorer.explore(fullContext);

    expect(executorSpy).toHaveBeenCalledTimes(1);
    expect(executorSpy).toHaveBeenCalledWith(fullContext);
  });

  it('should preserve patterns and dependencies from executor', async () => {
    const explorer = new PreExploration({
      executor: async () => ({
        relevantFiles: ['index.ts'],
        patterns: ['singleton', 'factory', 'observer'],
        dependencies: ['lodash', 'express', 'pg'],
        summary: 'Rich exploration',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.patterns).toEqual(['singleton', 'factory', 'observer']);
    expect(result.dependencies).toEqual(['lodash', 'express', 'pg']);
    expect(result.summary).toBe('Rich exploration');
  });

  it('should propagate executor errors (non-timeout)', async () => {
    const explorer = new PreExploration({
      executor: async () => {
        throw new Error('Permission denied');
      },
    });

    await expect(explorer.explore(context)).rejects.toThrow('Permission denied');
  });

  it('should clear timeout after successful execution', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    const explorer = new PreExploration({
      timeout: 5000,
      executor: async () => ({
        relevantFiles: [],
        patterns: [],
        dependencies: [],
        summary: 'fast',
        duration: 0,
      }),
    });

    await explorer.explore(context);
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should report duration of zero for stub (no executor) on fast machine', async () => {
    const explorer = new PreExploration();
    const result = await explorer.explore(context);
    // Duration should be very small (0 or a few ms)
    expect(result.duration).toBeLessThan(50);
  });

  it('should handle context with minimal fields', async () => {
    const minimalContext: DeepWorkerContext = {
      workspaceDir: '',
      taskDescription: '',
    };

    const explorer = new PreExploration();
    const result = await explorer.explore(minimalContext);
    expect(result.summary).toBe('Exploration of: ');
    expect(result.relevantFiles).toEqual([]);
  });

  it('should accept factory options', () => {
    const explorer = createPreExploration({ maxFiles: 5, timeout: 1000 });
    expect(explorer).toBeInstanceOf(PreExploration);
  });

  it('should timeout error include the configured timeout value', async () => {
    const explorer = new PreExploration({
      timeout: 75,
      executor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return { relevantFiles: [], patterns: [], dependencies: [], summary: 'late', duration: 0 };
      },
    });

    await expect(explorer.explore(context)).rejects.toThrow('75ms');
  });

  it('should slice relevantFiles preserving order', async () => {
    const explorer = new PreExploration({
      maxFiles: 3,
      executor: async () => ({
        relevantFiles: ['first.ts', 'second.ts', 'third.ts', 'fourth.ts', 'fifth.ts'],
        patterns: [],
        dependencies: [],
        summary: 'ordered',
        duration: 0,
      }),
    });

    const result = await explorer.explore(context);
    expect(result.relevantFiles).toEqual(['first.ts', 'second.ts', 'third.ts']);
  });
});
