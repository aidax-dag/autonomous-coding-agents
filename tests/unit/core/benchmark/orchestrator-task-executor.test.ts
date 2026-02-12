/**
 * OrchestratorTaskExecutor Unit Tests (T17)
 */

import { createOrchestratorTaskExecutor } from '../../../../src/core/benchmark/orchestrator-task-executor';
import type { BenchmarkTask } from '../../../../src/core/benchmark/interfaces/benchmark.interface';
import type { GoalResult } from '../../../../src/core/orchestrator/orchestrator-runner';

function makeMockRunner(goalResult?: Partial<GoalResult>) {
  return {
    executeGoal: jest.fn().mockResolvedValue({
      success: true,
      goalId: 'goal-1',
      tasks: [],
      totalDuration: 100,
      completedTasks: 1,
      failedTasks: 0,
      ...goalResult,
    }),
    getTelemetry: jest.fn().mockReturnValue(null),
  };
}

function makeBenchmarkTask(overrides?: Partial<BenchmarkTask>): BenchmarkTask {
  return {
    id: 'bench-1',
    repo: 'test/repo',
    description: 'Fix the failing test in auth module',
    testCommands: ['npm test -- auth'],
    difficulty: 'medium',
    tags: ['auth'],
    ...overrides,
  };
}

describe('OrchestratorTaskExecutor (T17)', () => {
  it('should return passed=true when goal succeeds', async () => {
    const runner = makeMockRunner();
    const executor = createOrchestratorTaskExecutor({ runner: runner as any });
    const task = makeBenchmarkTask();

    const result = await executor(task);

    expect(result.taskId).toBe('bench-1');
    expect(result.passed).toBe(true);
    expect(result.testsPassedRatio).toBe(1);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it('should return passed=false when goal fails', async () => {
    const runner = makeMockRunner({
      success: false,
      completedTasks: 1,
      failedTasks: 2,
      tasks: [
        { success: false, taskId: 't1', error: 'compile error', duration: 10, teamType: 'development' },
        { success: false, taskId: 't2', error: 'test failed', duration: 10, teamType: 'qa' },
      ],
    });
    const executor = createOrchestratorTaskExecutor({ runner: runner as any });

    const result = await executor(makeBenchmarkTask());

    expect(result.passed).toBe(false);
    expect(result.testsPassedRatio).toBeLessThan(1);
    expect(result.error).toContain('compile error');
    expect(result.error).toContain('test failed');
  });

  it('should handle executeGoal throwing', async () => {
    const runner = makeMockRunner();
    runner.executeGoal.mockRejectedValue(new Error('Runner crashed'));
    const executor = createOrchestratorTaskExecutor({ runner: runner as any });

    const result = await executor(makeBenchmarkTask());

    expect(result.passed).toBe(false);
    expect(result.error).toBe('Runner crashed');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should pass benchmark tags to executeGoal', async () => {
    const runner = makeMockRunner();
    const executor = createOrchestratorTaskExecutor({ runner: runner as any });
    const task = makeBenchmarkTask({ tags: ['security', 'regression'] });

    await executor(task);

    expect(runner.executeGoal).toHaveBeenCalledTimes(1);
    const callArgs = runner.executeGoal.mock.calls[0];
    expect(callArgs[2].tags).toContain('benchmark');
    expect(callArgs[2].tags).toContain('security');
    expect(callArgs[2].tags).toContain('regression');
  });

  it('should use custom priority', async () => {
    const runner = makeMockRunner();
    const executor = createOrchestratorTaskExecutor({
      runner: runner as any,
      defaultPriority: 'critical',
    });

    await executor(makeBenchmarkTask());

    const callArgs = runner.executeGoal.mock.calls[0];
    expect(callArgs[2].priority).toBe('critical');
  });

  it('should include task description in goal title', async () => {
    const runner = makeMockRunner();
    const executor = createOrchestratorTaskExecutor({ runner: runner as any });

    await executor(makeBenchmarkTask({ id: 'SWE-1234' }));

    const goalTitle = runner.executeGoal.mock.calls[0][0] as string;
    expect(goalTitle).toContain('[Benchmark]');
    expect(goalTitle).toContain('SWE-1234');
  });

  it('should include repo and test commands in goal description', async () => {
    const runner = makeMockRunner();
    const executor = createOrchestratorTaskExecutor({ runner: runner as any });

    await executor(makeBenchmarkTask({
      repo: 'owner/project',
      testCommands: ['pytest tests/'],
      expectedPatch: 'diff --git a/file.py',
    }));

    const goalDesc = runner.executeGoal.mock.calls[0][1] as string;
    expect(goalDesc).toContain('Repository: owner/project');
    expect(goalDesc).toContain('$ pytest tests/');
    expect(goalDesc).toContain('Expected patch pattern:');
  });

  it('should extract tokens from telemetry when available', async () => {
    const runner = makeMockRunner();
    runner.getTelemetry.mockReturnValue({
      getTraceManager: () => ({
        getCompletedSpans: () => [
          { name: 'llm.chat', attributes: { 'tokens.total': 150 } },
          { name: 'llm.chat', attributes: { 'tokens.total': 200 } },
          { name: 'executeTask', attributes: {} },
        ],
      }),
    });

    const executor = createOrchestratorTaskExecutor({ runner: runner as any });
    const result = await executor(makeBenchmarkTask());

    expect(result.tokensUsed).toBe(350);
    expect(result.llmCalls).toBe(2);
  });

  it('should calculate correct testsPassedRatio', async () => {
    const runner = makeMockRunner({
      success: false,
      completedTasks: 3,
      failedTasks: 1,
      tasks: [{ success: false, taskId: 't1', error: 'one failure', duration: 10, teamType: 'development' }],
    });
    const executor = createOrchestratorTaskExecutor({ runner: runner as any });

    const result = await executor(makeBenchmarkTask());

    // 3 completed / (3+1) total = 0.75
    expect(result.testsPassedRatio).toBe(0.75);
  });
});
