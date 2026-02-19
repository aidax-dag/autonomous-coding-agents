/**
 * Parallel Execution Integration Tests
 *
 * Validates the wiring between ParallelExecutor, AgentPool, BackgroundManager,
 * and OrchestratorRunner for end-to-end parallel execution.
 */

import { EventEmitter } from 'events';
import { ParallelExecutor } from '@/core/orchestrator/parallel-executor';
import { AgentPool } from '@/core/orchestrator/agent-pool';
import { BackgroundManager } from '@/core/orchestrator/background-manager';
import { OrchestratorRunner } from '@/core/orchestrator/orchestrator-runner';
import type { TaskDocument } from '@/core/workspace/task-document';
import type { WorkflowResult } from '@/core/orchestrator/orchestrator-runner';
import type { ILLMClient, LLMCompletionResult } from '@/shared/llm/base-client';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function mockTask(id: string, opts?: { deps?: string[]; provider?: string }): TaskDocument {
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
      dependencies: (opts?.deps ?? []).map((d) => ({ taskId: d, status: 'completed' })),
      extra: opts?.provider ? { provider: opts.provider } : undefined,
    },
    content: '',
  } as unknown as TaskDocument;
}

function mockResult(id: string, success = true): WorkflowResult {
  return { success, taskId: id, duration: 10, teamType: 'development' };
}

const mockLLMResult: LLMCompletionResult = {
  content: '{"subtasks": []}',
  model: 'mock',
  usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
  finishReason: 'stop',
};

function makeMockClient(): ILLMClient {
  return {
    getProvider: () => 'mock',
    getDefaultModel: () => 'mock-model',
    chat: jest.fn().mockResolvedValue(mockLLMResult),
    chatStream: jest.fn().mockResolvedValue(mockLLMResult),
    getMaxContextLength: () => 200000,
  };
}

let runnersToDestroy: OrchestratorRunner[] = [];

function createRunner(config: ConstructorParameters<typeof OrchestratorRunner>[0]): OrchestratorRunner {
  const runner = new OrchestratorRunner(config);
  runnersToDestroy.push(runner);
  return runner;
}

beforeEach(() => {
  runnersToDestroy = [];
});

afterEach(async () => {
  await Promise.all(runnersToDestroy.map(async (runner) => {
    try {
      await runner.destroy();
    } catch {
      // Ignore teardown errors to avoid masking assertion failures.
    }
  }));
  runnersToDestroy = [];
});

// ---------------------------------------------------------------------------
// AgentPool + ParallelExecutor integration
// ---------------------------------------------------------------------------

describe('AgentPool + ParallelExecutor integration', () => {
  it('should acquire and release pool slots during batch execution', async () => {
    const pool = new AgentPool({ defaultMaxPerProvider: 5, globalMax: 10 });
    const executor = new ParallelExecutor({
      maxConcurrency: 3,
      agentPool: pool,
    });

    const tasks = [mockTask('t1'), mockTask('t2'), mockTask('t3')];
    const executorFn = jest.fn(async (task: TaskDocument) => {
      // During execution, at least one slot should be acquired
      const stats = pool.stats();
      expect(stats.usedSlots).toBeGreaterThan(0);
      return mockResult(task.metadata.id);
    });

    const results = await executor.execute(tasks, { executeTask: executorFn });

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
    expect(executorFn).toHaveBeenCalledTimes(3);

    // After execution, all slots should be released
    const finalStats = pool.stats();
    expect(finalStats.usedSlots).toBe(0);
  });

  it('should work correctly without agent pool (backward compat)', async () => {
    const executor = new ParallelExecutor({ maxConcurrency: 3 });
    const tasks = [mockTask('t1'), mockTask('t2')];
    const executorFn = jest.fn(async (task: TaskDocument) => mockResult(task.metadata.id));

    const results = await executor.execute(tasks, { executeTask: executorFn });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('should release pool slots even when tasks fail', async () => {
    const pool = new AgentPool({ defaultMaxPerProvider: 5, globalMax: 10 });
    const executor = new ParallelExecutor({
      maxConcurrency: 3,
      agentPool: pool,
    });

    const tasks = [mockTask('t1'), mockTask('t2')];
    const executorFn = jest.fn(async (task: TaskDocument) => {
      if (task.metadata.id === 't1') throw new Error('boom');
      return mockResult(task.metadata.id);
    });

    const results = await executor.execute(tasks, { executeTask: executorFn });

    expect(results).toHaveLength(2);
    expect(results.find((r) => r.taskId === 't1')?.success).toBe(false);
    expect(results.find((r) => r.taskId === 't2')?.success).toBe(true);

    // Slots must be released even after failure
    expect(pool.stats().usedSlots).toBe(0);
  });

  it('should respect provider-specific limits via pool', async () => {
    const pool = new AgentPool({
      providerLimits: { claude: 1 },
      globalMax: 10,
    });
    const executor = new ParallelExecutor({
      maxConcurrency: 5,
      agentPool: pool,
    });

    const executionOrder: string[] = [];
    const tasks = [
      mockTask('t1', { provider: 'claude' }),
      mockTask('t2', { provider: 'claude' }),
    ];

    const executorFn = jest.fn(async (task: TaskDocument) => {
      executionOrder.push(`start-${task.metadata.id}`);
      await new Promise((r) => setTimeout(r, 20));
      executionOrder.push(`end-${task.metadata.id}`);
      return mockResult(task.metadata.id);
    });

    const results = await executor.execute(tasks, { executeTask: executorFn });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);

    // With provider limit of 1, tasks should be serialized
    // start-t1 must complete before start-t2
    const startT1 = executionOrder.indexOf('start-t1');
    const endT1 = executionOrder.indexOf('end-t1');
    const startT2 = executionOrder.indexOf('start-t2');
    expect(startT1).toBeLessThan(endT1);
    expect(endT1).toBeLessThan(startT2);
  });
});

// ---------------------------------------------------------------------------
// Parallel execution events
// ---------------------------------------------------------------------------

describe('Parallel execution events', () => {
  it('should emit parallel:batch-start and parallel:batch-complete events', async () => {
    const emitter = new EventEmitter();
    const events: Array<{ event: string; data: unknown }> = [];

    emitter.on('parallel:batch-start', (data) => events.push({ event: 'batch-start', data }));
    emitter.on('parallel:batch-complete', (data) => events.push({ event: 'batch-complete', data }));

    const executor = new ParallelExecutor({
      maxConcurrency: 3,
      emitter,
    });

    const tasks = [mockTask('t1'), mockTask('t2')];
    const executorFn = jest.fn(async (task: TaskDocument) => mockResult(task.metadata.id));

    await executor.execute(tasks, { executeTask: executorFn });

    const starts = events.filter((e) => e.event === 'batch-start');
    const completes = events.filter((e) => e.event === 'batch-complete');

    expect(starts.length).toBeGreaterThanOrEqual(1);
    expect(completes.length).toBeGreaterThanOrEqual(1);

    // Verify payload shape
    const startPayload = starts[0].data as { groupId: string; taskCount: number };
    expect(startPayload.groupId).toBeDefined();
    expect(startPayload.taskCount).toBe(2);

    const completePayload = completes[0].data as { groupId: string; results: number; duration: number };
    expect(completePayload.results).toBe(2);
    expect(completePayload.duration).toBeGreaterThanOrEqual(0);
  });

  it('should emit pool:acquired and pool:released events when pool is present', async () => {
    const emitter = new EventEmitter();
    const pool = new AgentPool({ defaultMaxPerProvider: 5, globalMax: 10 });
    const events: Array<{ event: string; data: unknown }> = [];

    emitter.on('pool:acquired', (data) => events.push({ event: 'acquired', data }));
    emitter.on('pool:released', (data) => events.push({ event: 'released', data }));

    const executor = new ParallelExecutor({
      maxConcurrency: 3,
      agentPool: pool,
      emitter,
    });

    const tasks = [mockTask('t1'), mockTask('t2')];
    const executorFn = jest.fn(async (task: TaskDocument) => mockResult(task.metadata.id));

    await executor.execute(tasks, { executeTask: executorFn });

    const acquires = events.filter((e) => e.event === 'acquired');
    const releases = events.filter((e) => e.event === 'released');

    expect(acquires).toHaveLength(2);
    expect(releases).toHaveLength(2);

    // Verify payload shape
    const acqPayload = acquires[0].data as { provider: string; taskId: string };
    expect(acqPayload.provider).toBeDefined();
    expect(acqPayload.taskId).toBeDefined();
  });

  it('should not emit pool events when no pool is configured', async () => {
    const emitter = new EventEmitter();
    const events: Array<{ event: string }> = [];

    emitter.on('pool:acquired', () => events.push({ event: 'acquired' }));
    emitter.on('pool:released', () => events.push({ event: 'released' }));

    const executor = new ParallelExecutor({
      maxConcurrency: 3,
      emitter,
    });

    const tasks = [mockTask('t1')];
    const executorFn = jest.fn(async (task: TaskDocument) => mockResult(task.metadata.id));

    await executor.execute(tasks, { executeTask: executorFn });

    expect(events).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Pool stats during execution
// ---------------------------------------------------------------------------

describe('Pool stats during execution', () => {
  it('should reflect active slots during task execution', async () => {
    const pool = new AgentPool({ defaultMaxPerProvider: 5, globalMax: 10 });
    const executor = new ParallelExecutor({
      maxConcurrency: 3,
      agentPool: pool,
    });

    let maxUsed = 0;
    const tasks = [mockTask('t1'), mockTask('t2'), mockTask('t3')];
    const executorFn = jest.fn(async (task: TaskDocument) => {
      const stats = pool.stats();
      if (stats.usedSlots > maxUsed) maxUsed = stats.usedSlots;
      await new Promise((r) => setTimeout(r, 10));
      return mockResult(task.metadata.id);
    });

    await executor.execute(tasks, { executeTask: executorFn });

    // At least one task was using a slot simultaneously
    expect(maxUsed).toBeGreaterThanOrEqual(1);

    // After all tasks complete, all slots released
    expect(pool.stats().usedSlots).toBe(0);
    expect(pool.stats().availableSlots).toBe(pool.stats().totalSlots);
  });
});

// ---------------------------------------------------------------------------
// BackgroundManager + Runner integration
// ---------------------------------------------------------------------------

describe('BackgroundManager + Runner integration', () => {
  it('should create a background manager in OrchestratorRunner', () => {
    const runner = createRunner({ llmClient: makeMockClient() });
    expect(runner.getBackgroundManager()).toBeInstanceOf(BackgroundManager);
  });

  it('should return empty background tasks when none launched', () => {
    const runner = createRunner({ llmClient: makeMockClient() });
    expect(runner.getBackgroundTasks()).toEqual([]);
  });

  it('should expose getAgentPool when parallel execution is enabled', () => {
    const runner = createRunner({
      llmClient: makeMockClient(),
      enableParallelExecution: true,
      parallelConcurrency: 3,
    });
    expect(runner.getAgentPool()).toBeInstanceOf(AgentPool);
  });

  it('should return null for getAgentPool when parallel is disabled', () => {
    const runner = createRunner({
      llmClient: makeMockClient(),
      enableParallelExecution: false,
    });
    expect(runner.getAgentPool()).toBeNull();
  });

  it('should accept new config options (providerLimits, globalMax, enableBackgroundGoals)', () => {
    const runner = createRunner({
      llmClient: makeMockClient(),
      enableParallelExecution: true,
      parallelConcurrency: 5,
      providerLimits: { claude: 3, openai: 5 },
      globalMax: 8,
      enableBackgroundGoals: true,
    });
    expect(runner).toBeDefined();
    expect(runner.getAgentPool()).toBeInstanceOf(AgentPool);
  });

  it('should cancel background tasks on destroy', async () => {
    const runner = createRunner({
      llmClient: makeMockClient(),
      enableBackgroundGoals: true,
    });

    const bgManager = runner.getBackgroundManager();
    const handle = bgManager.launch(
      () => new Promise<WorkflowResult>(() => {}),
      'bg-task-1',
    );

    expect(handle.status).toBe('running');
    expect(bgManager.getRunning()).toHaveLength(1);

    await runner.destroy();

    expect(handle.status).toBe('cancelled');
  });
});

// ---------------------------------------------------------------------------
// Parallel disabled (sequential execution still works)
// ---------------------------------------------------------------------------

describe('Parallel disabled - sequential fallback', () => {
  it('should still support sequential execution when flag is off', () => {
    const runner = createRunner({
      llmClient: makeMockClient(),
      enableParallelExecution: false,
    });
    expect(runner.currentStatus).toBe('idle');
    expect(runner.getAgentPool()).toBeNull();
  });

  it('should create runner with both modes', () => {
    const parallel = createRunner({
      llmClient: makeMockClient(),
      enableParallelExecution: true,
    });
    const sequential = createRunner({
      llmClient: makeMockClient(),
      enableParallelExecution: false,
    });

    expect(parallel.getAgentPool()).not.toBeNull();
    expect(sequential.getAgentPool()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Factory integration with new config
// ---------------------------------------------------------------------------

describe('Factory integration with new config options', () => {
  it('should create runner via createOrchestratorRunner with new config', async () => {
    const { createOrchestratorRunner } = await import('@/core/orchestrator/orchestrator-runner');

    const runner = createOrchestratorRunner({
      llmClient: makeMockClient(),
      enableParallelExecution: true,
      parallelConcurrency: 4,
      providerLimits: { claude: 2 },
      globalMax: 6,
      enableBackgroundGoals: true,
    });
    runnersToDestroy.push(runner);

    expect(runner).toBeInstanceOf(OrchestratorRunner);
    expect(runner.getAgentPool()).toBeInstanceOf(AgentPool);
    expect(runner.getBackgroundManager()).toBeInstanceOf(BackgroundManager);
  });
});
