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
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  // ── New: plan generation with dependencies ──────────

  it('should generate default steps with correct dependency chain', async () => {
    const planner = new SelfPlanning();
    const result = await planner.plan(context, exploration);

    // explore has no dependencies
    expect(result.steps[0].id).toBe('explore');
    expect(result.steps[0].dependencies).toEqual([]);

    // implement depends on explore
    expect(result.steps[1].id).toBe('implement');
    expect(result.steps[1].dependencies).toEqual(['explore']);

    // test depends on implement
    expect(result.steps[2].id).toBe('test');
    expect(result.steps[2].dependencies).toEqual(['implement']);
  });

  it('should set all default steps to not completed', async () => {
    const planner = new SelfPlanning();
    const result = await planner.plan(context, exploration);

    for (const step of result.steps) {
      expect(step.completed).toBe(false);
    }
  });

  it('should assign effort estimates to default steps', async () => {
    const planner = new SelfPlanning();
    const result = await planner.plan(context, exploration);

    expect(result.steps[0].effort).toBe('small');   // explore
    expect(result.steps[1].effort).toBe('medium');   // implement
    expect(result.steps[2].effort).toBe('small');    // test
    expect(result.totalEffort).toBe('medium');
  });

  it('should include taskDescription in default step descriptions', async () => {
    const planner = new SelfPlanning();
    const result = await planner.plan(context, exploration);

    for (const step of result.steps) {
      expect(step.description).toContain('Add user authentication');
    }
  });

  it('should overwrite executor duration with actual elapsed time', async () => {
    const planner = new SelfPlanning({
      executor: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          steps: [],
          summary: 'done',
          totalEffort: 'small',
          duration: 999, // arbitrary value from executor
        };
      },
    });

    const result = await planner.plan(context, exploration);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.duration).not.toBe(999);
  });

  it('should pass both context and exploration to executor', async () => {
    const executorSpy = jest.fn().mockResolvedValue({
      steps: [],
      summary: 'spy plan',
      totalEffort: 'small',
      duration: 0,
    });

    const planner = new SelfPlanning({ executor: executorSpy });
    await planner.plan(context, exploration);

    expect(executorSpy).toHaveBeenCalledTimes(1);
    expect(executorSpy).toHaveBeenCalledWith(context, exploration);
  });

  it('should default maxSteps to 20', async () => {
    const steps = Array.from({ length: 25 }, (_, i) => ({
      id: `step-${i}`,
      description: `Step ${i}`,
      type: 'implement' as const,
      dependencies: [],
      effort: 'small' as const,
      completed: false,
    }));

    const planner = new SelfPlanning({
      executor: async () => ({
        steps,
        summary: 'big plan',
        totalEffort: 'large',
        duration: 0,
      }),
    });

    const result = await planner.plan(context, exploration);
    expect(result.steps).toHaveLength(20);
  });

  it('should not truncate when steps are under maxSteps', async () => {
    const planner = new SelfPlanning({
      maxSteps: 10,
      executor: async () => ({
        steps: [
          { id: 'a', description: 'a', type: 'explore', dependencies: [], effort: 'small', completed: false },
        ],
        summary: 'small plan',
        totalEffort: 'small',
        duration: 0,
      }),
    });

    const result = await planner.plan(context, exploration);
    expect(result.steps).toHaveLength(1);
  });

  it('should preserve executor summary and totalEffort', async () => {
    const planner = new SelfPlanning({
      executor: async () => ({
        steps: [],
        summary: 'Custom summary from LLM',
        totalEffort: 'large',
        duration: 0,
      }),
    });

    const result = await planner.plan(context, exploration);
    expect(result.summary).toBe('Custom summary from LLM');
    expect(result.totalEffort).toBe('large');
  });

  it('should propagate executor errors', async () => {
    const planner = new SelfPlanning({
      executor: async () => {
        throw new Error('LLM service unavailable');
      },
    });

    await expect(planner.plan(context, exploration)).rejects.toThrow('LLM service unavailable');
  });

  it('should handle empty taskDescription in default plan', async () => {
    const planner = new SelfPlanning();
    const emptyCtx: DeepWorkerContext = {
      workspaceDir: '/tmp',
      taskDescription: '',
    };

    const result = await planner.plan(emptyCtx, exploration);
    expect(result.steps).toHaveLength(3);
    expect(result.summary).toBe('Plan for: ');
  });

  it('should slice preserving step order', async () => {
    const planner = new SelfPlanning({
      maxSteps: 2,
      executor: async () => ({
        steps: [
          { id: 'first', description: 'first', type: 'explore', dependencies: [], effort: 'small', completed: false },
          { id: 'second', description: 'second', type: 'implement', dependencies: [], effort: 'medium', completed: false },
          { id: 'third', description: 'third', type: 'test', dependencies: [], effort: 'small', completed: false },
        ],
        summary: 'ordered plan',
        totalEffort: 'medium',
        duration: 0,
      }),
    });

    const result = await planner.plan(context, exploration);
    expect(result.steps.map((s) => s.id)).toEqual(['first', 'second']);
  });

  it('should accept factory with options', () => {
    const planner = createSelfPlanning({ maxSteps: 5 });
    expect(planner).toBeInstanceOf(SelfPlanning);
  });

  it('should work with different exploration inputs', async () => {
    const planner = new SelfPlanning();
    const emptyExploration: ExplorationResult = {
      relevantFiles: [],
      patterns: [],
      dependencies: [],
      summary: 'Nothing found',
      duration: 0,
    };

    const result = await planner.plan(context, emptyExploration);
    // Default plan is generated regardless of exploration content
    expect(result.steps).toHaveLength(3);
    expect(result.totalEffort).toBe('medium');
  });
});
