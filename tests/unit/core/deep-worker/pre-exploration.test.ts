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
});
