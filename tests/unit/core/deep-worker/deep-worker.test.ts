/**
 * DeepWorker Integration Tests
 */

import { DeepWorker, createDeepWorker } from '../../../../src/core/deep-worker/deep-worker';
import { PreExploration } from '../../../../src/core/deep-worker/pre-exploration';
import { SelfPlanning } from '../../../../src/core/deep-worker/self-planning';
import { RetryStrategy } from '../../../../src/core/deep-worker/retry-strategy';
import { TodoContinuationEnforcer } from '../../../../src/core/deep-worker/todo-enforcer';
import type { DeepWorkerContext } from '../../../../src/core/deep-worker/interfaces/deep-worker.interface';

const context: DeepWorkerContext = {
  workspaceDir: '/tmp/test',
  taskDescription: 'Build feature X',
  maxRetries: 2,
};

function createComponents() {
  return {
    exploration: new PreExploration(),
    planning: new SelfPlanning(),
    retry: new RetryStrategy({ maxRetries: 2 }),
    continuation: new TodoContinuationEnforcer(),
  };
}

describe('DeepWorker', () => {
  it('should complete full cycle with default stubs', async () => {
    const worker = new DeepWorker({
      name: 'test-worker',
      ...createComponents(),
    });

    const result = await worker.execute(context);

    expect(result.success).toBe(true);
    expect(result.exploration.summary).toContain('Build feature X');
    expect(result.plan.steps).toHaveLength(3); // explore, implement, test
    expect(result.todoStatus.allComplete).toBe(true);
    expect(result.todoStatus.completedSteps).toBe(3);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it('should call step executor for each step', async () => {
    const executedSteps: string[] = [];

    const worker = new DeepWorker({
      name: 'test-worker',
      ...createComponents(),
      stepExecutor: async (stepId) => {
        executedSteps.push(stepId);
      },
    });

    const result = await worker.execute(context);

    expect(result.success).toBe(true);
    expect(executedSteps).toEqual(['explore', 'implement', 'test']);
  });

  it('should handle step failures with retry', async () => {
    let implAttempts = 0;

    const worker = new DeepWorker({
      name: 'test-worker',
      ...createComponents(),
      stepExecutor: async (stepId) => {
        if (stepId === 'implement') {
          implAttempts++;
          if (implAttempts < 2) {
            throw new Error('build failed');
          }
        }
      },
    });

    const result = await worker.execute(context);

    expect(result.success).toBe(true);
    expect(implAttempts).toBe(2); // retried once
  });

  it('should report failure when step exhausts retries', async () => {
    const worker = new DeepWorker({
      name: 'test-worker',
      ...createComponents(),
      stepExecutor: async (stepId) => {
        if (stepId === 'implement') {
          throw new Error('always fails');
        }
      },
    });

    const result = await worker.execute(context);

    expect(result.success).toBe(false);
    expect(result.todoStatus.failedSteps).toBeGreaterThan(0);
    expect(result.error).toContain('failed');
  });

  it('should use custom exploration executor', async () => {
    const components = createComponents();
    const worker = new DeepWorker({
      name: 'test-worker',
      ...components,
      exploration: new PreExploration({
        executor: async () => ({
          relevantFiles: ['custom.ts'],
          patterns: ['custom-pattern'],
          dependencies: [],
          summary: 'custom exploration',
          duration: 0,
        }),
      }),
    });

    const result = await worker.execute(context);

    expect(result.exploration.relevantFiles).toEqual(['custom.ts']);
    expect(result.exploration.patterns).toEqual(['custom-pattern']);
  });

  it('should expose components', () => {
    const components = createComponents();
    const worker = new DeepWorker({ name: 'test', ...components });

    expect(worker.name).toBe('test');
    expect(worker.exploration).toBe(components.exploration);
    expect(worker.planning).toBe(components.planning);
    expect(worker.retry).toBe(components.retry);
    expect(worker.continuation).toBe(components.continuation);
  });

  it('should be created via factory', () => {
    const worker = createDeepWorker({
      name: 'factory-worker',
      ...createComponents(),
    });
    expect(worker).toBeInstanceOf(DeepWorker);
    expect(worker.name).toBe('factory-worker');
  });
});
