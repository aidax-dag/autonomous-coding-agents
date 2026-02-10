/**
 * Tests for Benchmark Runner
 */

import {
  BenchmarkRunner,
  createBenchmarkRunner,
  type TaskExecutor,
  type SuiteLoader,
} from '@/core/benchmark';
import type { BenchmarkTask } from '@/core/benchmark';

describe('BenchmarkRunner', () => {
  const sampleTask: BenchmarkTask = {
    id: 'task-001',
    repo: 'user/repo',
    description: 'Fix import sorting',
    testCommands: ['npm test'],
    difficulty: 'easy',
    tags: ['refactoring'],
  };

  describe('constructor', () => {
    it('should create with default config', () => {
      const runner = new BenchmarkRunner();
      expect(runner).toBeInstanceOf(BenchmarkRunner);
    });
  });

  describe('loadSuite', () => {
    it('should return empty when no loader', async () => {
      const runner = new BenchmarkRunner();
      const tasks = await runner.loadSuite('swe-bench-lite');
      expect(tasks).toEqual([]);
    });

    it('should use custom loader', async () => {
      const loader: SuiteLoader = async () => [sampleTask];
      const runner = new BenchmarkRunner({ loader });

      const tasks = await runner.loadSuite('test-suite');
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('task-001');
    });
  });

  describe('runTask', () => {
    it('should return failure stub when no executor', async () => {
      const runner = new BenchmarkRunner();
      const result = await runner.runTask(sampleTask);

      expect(result.taskId).toBe('task-001');
      expect(result.passed).toBe(false);
      expect(result.error).toContain('No executor');
    });

    it('should use custom executor', async () => {
      const executor: TaskExecutor = async (task) => ({
        taskId: task.id,
        passed: true,
        testsPassedRatio: 1.0,
        generatedPatch: 'diff --git ...',
        tokensUsed: 5000,
        durationMs: 30000,
        llmCalls: 3,
      });

      const runner = new BenchmarkRunner({ executor });
      const result = await runner.runTask(sampleTask);

      expect(result.passed).toBe(true);
      expect(result.tokensUsed).toBe(5000);
    });
  });

  describe('runSuite', () => {
    it('should return empty suite result when no tasks', async () => {
      const runner = new BenchmarkRunner();
      const result = await runner.runSuite('empty');

      expect(result.suiteName).toBe('empty');
      expect(result.results).toEqual([]);
      expect(result.passRate).toBe(0);
      expect(result.avgTokensPerTask).toBe(0);
    });

    it('should run all tasks and aggregate results', async () => {
      const tasks: BenchmarkTask[] = [
        { ...sampleTask, id: 't1' },
        { ...sampleTask, id: 't2' },
        { ...sampleTask, id: 't3' },
      ];

      const loader: SuiteLoader = async () => tasks;
      const executor: TaskExecutor = async (task) => ({
        taskId: task.id,
        passed: task.id !== 't2', // t2 fails
        testsPassedRatio: task.id !== 't2' ? 1.0 : 0.5,
        generatedPatch: '',
        tokensUsed: 1000,
        durationMs: 10000,
        llmCalls: 2,
      });

      const runner = new BenchmarkRunner({ loader, executor });
      const result = await runner.runSuite('test');

      expect(result.results).toHaveLength(3);
      expect(result.passRate).toBeCloseTo(2 / 3);
      expect(result.avgTokensPerTask).toBe(1000);
      expect(result.avgDurationMs).toBe(10000);
    });

    it('should calculate cost estimate', async () => {
      const loader: SuiteLoader = async () => [sampleTask];
      const executor: TaskExecutor = async () => ({
        taskId: 't1',
        passed: true,
        testsPassedRatio: 1,
        generatedPatch: '',
        tokensUsed: 10000,
        durationMs: 0,
        llmCalls: 1,
      });

      const runner = new BenchmarkRunner({
        loader,
        executor,
        costPer1KTokens: 0.01,
      });
      const result = await runner.runSuite('test');

      expect(result.totalCostEstimate).toBeCloseTo(0.1); // 10K tokens * $0.01/1K
    });
  });

  describe('listSuites', () => {
    it('should return default suite', async () => {
      const runner = new BenchmarkRunner();
      const suites = await runner.listSuites();
      expect(suites).toContain('swe-bench-lite');
    });

    it('should return custom suites', async () => {
      const runner = new BenchmarkRunner({ suites: ['a', 'b'] });
      const suites = await runner.listSuites();
      expect(suites).toEqual(['a', 'b']);
    });
  });

  describe('createBenchmarkRunner', () => {
    it('should create via factory', () => {
      const runner = createBenchmarkRunner();
      expect(runner).toBeInstanceOf(BenchmarkRunner);
    });
  });
});
