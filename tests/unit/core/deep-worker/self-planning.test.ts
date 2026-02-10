/**
 * SelfPlanning Tests
 */

import { SelfPlanning, createSelfPlanning } from '../../../../src/core/deep-worker/self-planning';
import type {
  DeepWorkerContext,
  ExplorationResult,
} from '../../../../src/core/deep-worker/interfaces/deep-worker.interface';

const context: DeepWorkerContext = {
  workspaceDir: '/tmp/test',
  taskDescription: 'Add user authentication',
};

const exploration: ExplorationResult = {
  relevantFiles: ['src/auth.ts'],
  patterns: ['middleware'],
  dependencies: ['express'],
  summary: 'Found auth files',
  duration: 10,
};

describe('SelfPlanning', () => {
  it('should generate default plan without executor', async () => {
    const planner = new SelfPlanning();
    const result = await planner.plan(context, exploration);

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].type).toBe('explore');
    expect(result.steps[1].type).toBe('implement');
    expect(result.steps[2].type).toBe('test');
    expect(result.steps[1].dependencies).toContain('explore');
    expect(result.summary).toContain('authentication');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should use custom executor', async () => {
    const planner = new SelfPlanning({
      executor: async (ctx) => ({
        steps: [
          {
            id: 'custom',
            description: `Custom step for ${ctx.taskDescription}`,
            type: 'implement',
            dependencies: [],
            effort: 'large',
            completed: false,
          },
        ],
        summary: 'Custom plan',
        totalEffort: 'large',
        duration: 0,
      }),
    });

    const result = await planner.plan(context, exploration);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBe('custom');
  });

  it('should respect maxSteps limit', async () => {
    const planner = new SelfPlanning({
      maxSteps: 1,
      executor: async () => ({
        steps: [
          { id: 'a', description: 'a', type: 'explore', dependencies: [], effort: 'small', completed: false },
          { id: 'b', description: 'b', type: 'implement', dependencies: [], effort: 'small', completed: false },
          { id: 'c', description: 'c', type: 'test', dependencies: [], effort: 'small', completed: false },
        ],
        summary: 'many steps',
        totalEffort: 'medium',
        duration: 0,
      }),
    });

    const result = await planner.plan(context, exploration);
    expect(result.steps).toHaveLength(1);
  });

  it('should be created via factory', () => {
    expect(createSelfPlanning()).toBeInstanceOf(SelfPlanning);
  });
});
