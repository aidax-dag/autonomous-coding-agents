/**
 * Parallel Executor Tests
 */

import { ParallelExecutor } from '@/core/orchestrator/parallel-executor';
import type { TaskDocument } from '@/core/workspace/task-document';
import type { WorkflowResult } from '@/core/orchestrator/orchestrator-runner';
import type { TaskNode } from '@/core/orchestrator/interfaces/parallel.interface';

function mockTask(id: string, deps: string[] = []): TaskDocument {
  return {
    metadata: {
      id,
      title: `Task ${id}`,
      type: 'feature',
      status: 'pending',
      from: 'orchestrator',
      to: 'development',
      priority: 'medium',
      tags: [],
      dependencies: deps.map((d) => ({ taskId: d, status: 'completed' })),
    },
    content: '',
  } as unknown as TaskDocument;
}

function mockResult(id: string, success = true): WorkflowResult {
  return { success, taskId: id, duration: 10, teamType: 'development' };
}

describe('ParallelExecutor', () => {
  let executor: ParallelExecutor;

  beforeEach(() => {
    executor = new ParallelExecutor({ maxConcurrency: 3 });
  });

  it('should execute empty task list', async () => {
    const results = await executor.execute([], { executeTask: jest.fn() });
    expect(results).toEqual([]);
  });

  it('should execute independent tasks in parallel', async () => {
    const tasks = [mockTask('t1'), mockTask('t2'), mockTask('t3')];
    const executionOrder: string[] = [];
    const executorFn = jest.fn(async (task: TaskDocument) => {
      executionOrder.push(task.metadata.id);
      return mockResult(task.metadata.id);
    });

    const results = await executor.execute(tasks, { executeTask: executorFn });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
    expect(executorFn).toHaveBeenCalledTimes(3);
  });

  it('should handle task failures gracefully', async () => {
    const tasks = [mockTask('t1'), mockTask('t2')];
    const executorFn = jest.fn(async (task: TaskDocument) => {
      if (task.metadata.id === 't1') throw new Error('fail');
      return mockResult(task.metadata.id);
    });

    const results = await executor.execute(tasks, { executeTask: executorFn });
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.taskId === 't1')?.success).toBe(false);
    expect(results.find((r) => r.taskId === 't2')?.success).toBe(true);
  });

  it('should stop on first failure with failFast', async () => {
    const failFastExecutor = new ParallelExecutor({ maxConcurrency: 1, failFast: true });
    const tasks = [mockTask('t1'), mockTask('t2')];
    const executorFn = jest.fn(async (task: TaskDocument) => {
      if (task.metadata.id === 't1') return { ...mockResult('t1'), success: false };
      return mockResult(task.metadata.id);
    });

    const results = await failFastExecutor.execute(tasks, { executeTask: executorFn });
    const t2 = results.find((r) => r.taskId === 't2');
    expect(t2?.success).toBe(false);
    expect(t2?.error).toContain('fail-fast');
  });

  it('should respect maxConcurrency', async () => {
    const narrowExecutor = new ParallelExecutor({ maxConcurrency: 2 });
    const tasks = [mockTask('t1'), mockTask('t2'), mockTask('t3'), mockTask('t4')];
    const executorFn = jest.fn(async (task: TaskDocument) => mockResult(task.metadata.id));

    const results = await narrowExecutor.execute(tasks, { executeTask: executorFn });
    expect(results).toHaveLength(4);
  });

  it('should build groups from dependency graph', () => {
    const nodes: TaskNode[] = [
      { task: mockTask('t1'), dependsOn: [] },
      { task: mockTask('t2'), dependsOn: [] },
      { task: mockTask('t3'), dependsOn: ['t1', 't2'] },
    ];
    const groups = executor.buildGroups(nodes);
    expect(groups.length).toBeGreaterThanOrEqual(2);
    // t1 and t2 should be in earlier group than t3
    const t3Group = groups.find((g) => g.tasks.some((t) => t.metadata.id === 't3'));
    const t1Group = groups.find((g) => g.tasks.some((t) => t.metadata.id === 't1'));
    expect(groups.indexOf(t3Group!)).toBeGreaterThan(groups.indexOf(t1Group!));
  });

  it('should handle circular dependencies gracefully', () => {
    const nodes: TaskNode[] = [
      { task: mockTask('t1'), dependsOn: ['t2'] },
      { task: mockTask('t2'), dependsOn: ['t1'] },
    ];
    const groups = executor.buildGroups(nodes);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    // Should still include all tasks
    const allTasks = groups.flatMap((g) => g.tasks);
    expect(allTasks).toHaveLength(2);
  });

  it('should timeout slow tasks', async () => {
    const timeoutExecutor = new ParallelExecutor({ maxConcurrency: 3, taskTimeout: 50 });
    const tasks = [mockTask('t1')];
    const executorFn = jest.fn(
      () => new Promise<WorkflowResult>((resolve) => setTimeout(() => resolve(mockResult('t1')), 200)),
    );

    const results = await timeoutExecutor.execute(tasks, { executeTask: executorFn });
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('timed out');
  });

  it('should handle dependencies from task metadata', async () => {
    const tasks = [mockTask('t1'), mockTask('t2', ['t1'])];
    const order: string[] = [];
    const executorFn = jest.fn(async (task: TaskDocument) => {
      order.push(task.metadata.id);
      return mockResult(task.metadata.id);
    });

    await executor.execute(tasks, { executeTask: executorFn });
    expect(order.indexOf('t1')).toBeLessThan(order.indexOf('t2'));
  });
});
