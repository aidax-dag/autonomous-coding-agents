/**
 * Tests for DryRunExecutor
 */

import {
  createDryRunExecutor,
  DRY_RUN_REASON_CODE,
} from '../../../../src/core/benchmark/dry-run-executor';
import type { BenchmarkTask, BenchmarkResult } from '../../../../src/core/benchmark/interfaces/benchmark.interface';
import type { TaskExecutor } from '../../../../src/core/benchmark/benchmark-runner';

function makeBenchmarkTask(overrides?: Partial<BenchmarkTask>): BenchmarkTask {
  return {
    id: 'test-task-1',
    repo: 'test/repo',
    description: 'A test task',
    testCommands: ['npm test'],
    difficulty: 'easy',
    tags: ['test'],
    ...overrides,
  };
}

describe('DryRunExecutor', () => {
  describe('without delegate', () => {
    it('should return structured dry-run result', async () => {
      const executor = createDryRunExecutor();
      const task = makeBenchmarkTask();

      const result = await executor(task);

      expect(result.taskId).toBe('test-task-1');
      expect(result.passed).toBe(false);
      expect(result.testsPassedRatio).toBe(0);
      expect(result.generatedPatch).toBe('');
      expect(result.tokensUsed).toBe(0);
      expect(result.durationMs).toBe(0);
      expect(result.llmCalls).toBe(0);
      expect(result.error).toContain('Dry-run mode');
      expect(result.error).toContain('no LLM executor configured');
      expect(result.error).toContain(DRY_RUN_REASON_CODE);
    });

    it('should include correct task ID for different tasks', async () => {
      const executor = createDryRunExecutor();

      const result1 = await executor(makeBenchmarkTask({ id: 'alpha' }));
      const result2 = await executor(makeBenchmarkTask({ id: 'beta' }));

      expect(result1.taskId).toBe('alpha');
      expect(result2.taskId).toBe('beta');
    });

    it('should never make LLM calls', async () => {
      const executor = createDryRunExecutor();
      const task = makeBenchmarkTask();

      const result = await executor(task);

      expect(result.tokensUsed).toBe(0);
      expect(result.llmCalls).toBe(0);
      expect(result.durationMs).toBe(0);
    });
  });

  describe('with delegate', () => {
    it('should pass through to delegate executor', async () => {
      const delegate: TaskExecutor = async (task) => ({
        taskId: task.id,
        passed: true,
        testsPassedRatio: 1.0,
        generatedPatch: 'some patch',
        tokensUsed: 5000,
        durationMs: 15000,
        llmCalls: 3,
      });

      const executor = createDryRunExecutor({ delegate });
      const result = await executor(makeBenchmarkTask());

      expect(result.passed).toBe(true);
      expect(result.tokensUsed).toBe(5000);
      expect(result.durationMs).toBe(15000);
      expect(result.llmCalls).toBe(3);
      expect(result.generatedPatch).toBe('some patch');
      expect(result.error).toBeUndefined();
    });

    it('should pass the full task object to delegate', async () => {
      let receivedTask: BenchmarkTask | null = null;
      const delegate: TaskExecutor = async (task) => {
        receivedTask = task;
        return {
          taskId: task.id,
          passed: true,
          testsPassedRatio: 1,
          generatedPatch: '',
          tokensUsed: 0,
          durationMs: 0,
          llmCalls: 0,
        };
      };

      const task = makeBenchmarkTask({
        id: 'delegate-check',
        repo: 'owner/project',
        difficulty: 'hard',
        tags: ['security', 'auth'],
      });

      const executor = createDryRunExecutor({ delegate });
      await executor(task);

      expect(receivedTask).not.toBeNull();
      expect(receivedTask!.id).toBe('delegate-check');
      expect(receivedTask!.repo).toBe('owner/project');
      expect(receivedTask!.difficulty).toBe('hard');
      expect(receivedTask!.tags).toEqual(['security', 'auth']);
    });

    it('should propagate delegate errors', async () => {
      const delegate: TaskExecutor = async (task) => ({
        taskId: task.id,
        passed: false,
        testsPassedRatio: 0,
        generatedPatch: '',
        tokensUsed: 100,
        durationMs: 500,
        llmCalls: 1,
        error: 'LLM call failed: timeout',
      });

      const executor = createDryRunExecutor({ delegate });
      const result = await executor(makeBenchmarkTask());

      expect(result.passed).toBe(false);
      expect(result.error).toBe('LLM call failed: timeout');
      expect(result.tokensUsed).toBe(100);
    });
  });

  describe('DRY_RUN_REASON_CODE', () => {
    it('should be the string DRY_RUN', () => {
      expect(DRY_RUN_REASON_CODE).toBe('DRY_RUN');
    });
  });
});
