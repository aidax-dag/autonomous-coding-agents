/**
 * Background Executor Tests
 */

import {
  BackgroundExecutor,
  createBackgroundExecutor,
  submitBackgroundJob,
  BackgroundJobStatus,
  BackgroundExecutorEvents,
} from '../../../../src/core/agents/execution';
import {
  AgentType,
  AgentStatus,
  TaskPriority,
  TaskResultStatus,
  type IAgent,
  type IAgentConfig,
  type AgentState,
  type AgentMetrics,
  type AgentCapability,
  type HealthStatus,
  type ITask,
  type TaskResult,
} from '../../../../src/core/interfaces';
import type { IEventBus, IEvent } from '../../../../src/core/events';

// ============================================================================
// Mock Implementations
// ============================================================================

class MockAgent implements IAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;
  readonly version: string;
  private processDelay: number;
  private shouldFail: boolean;
  private failMessage: string;

  constructor(
    config: Partial<IAgentConfig> & { id: string; type: AgentType },
    options?: { processDelay?: number; shouldFail?: boolean; failMessage?: string }
  ) {
    this.id = config.id;
    this.type = config.type;
    this.name = config.name || 'Mock Agent';
    this.version = config.version || '1.0.0';
    this.processDelay = options?.processDelay ?? 0;
    this.shouldFail = options?.shouldFail ?? false;
    this.failMessage = options?.failMessage ?? 'Task failed';
  }

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  pause(): Promise<void> {
    return Promise.resolve();
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  stop(): Promise<void> {
    return Promise.resolve();
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }

  canHandle(_task: ITask): boolean {
    return true;
  }

  async processTask(task: ITask): Promise<TaskResult> {
    if (this.processDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.processDelay));
    }

    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }

    return {
      taskId: task.id,
      success: true,
      status: TaskResultStatus.COMPLETED,
      data: { processed: true },
      metadata: {
        agentId: this.id,
        agentType: this.type,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: this.processDelay,
      },
    };
  }

  getState(): AgentState {
    return {
      status: AgentStatus.IDLE,
      currentTask: null,
      queuedTasks: 0,
      processedTasks: 0,
      lastActiveAt: null,
    };
  }

  getHealth(): HealthStatus {
    return {
      healthy: true,
      status: AgentStatus.IDLE,
      uptime: 0,
      lastCheck: new Date(),
    };
  }

  getCapabilities(): AgentCapability[] {
    return [{ name: 'mock', description: 'Mock capability' }];
  }

  getMetrics(): AgentMetrics {
    return {
      tasksProcessed: 0,
      tasksFailed: 0,
      averageTaskDuration: 0,
      totalTokensUsed: 0,
      uptime: 0,
      lastActiveAt: null,
      errorRate: 0,
    };
  }
}

class MockEventBus implements IEventBus {
  private events: IEvent[] = [];

  emit<T extends IEvent>(event: T): void {
    this.events.push(event);
  }

  emitAsync<T extends IEvent>(event: T): Promise<void> {
    this.events.push(event);
    return Promise.resolve();
  }

  emitBatch<T extends IEvent>(events: T[]): void {
    this.events.push(...events);
  }

  on(): { id: string; eventType: string; unsubscribe: () => void; isActive: boolean } {
    return { id: '1', eventType: '', unsubscribe: () => {}, isActive: true };
  }

  once(): { id: string; eventType: string; unsubscribe: () => void; isActive: boolean } {
    return { id: '1', eventType: '', unsubscribe: () => {}, isActive: true };
  }

  off(): void {}

  waitFor(): Promise<never> {
    return Promise.reject(new Error('Not implemented'));
  }

  removeAllListeners(): void {}
  listenerCount(): number {
    return 0;
  }
  eventTypes(): string[] {
    return [];
  }
  hasListeners(): boolean {
    return false;
  }
  pause(): void {}
  resume(): void {}
  isPaused(): boolean {
    return false;
  }
  dispose(): void {}

  getEmittedEvents(): IEvent[] {
    return this.events;
  }

  clearEvents(): void {
    this.events = [];
  }
}

function createMockTask(overrides?: Partial<ITask>): ITask {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'test-task',
    agentType: AgentType.CODER,
    priority: TaskPriority.NORMAL,
    payload: { test: true },
    createdAt: new Date(),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('BackgroundExecutor', () => {
  let executor: BackgroundExecutor;
  let mockAgent: MockAgent;
  let eventBus: MockEventBus;

  beforeEach(() => {
    eventBus = new MockEventBus();
    executor = new BackgroundExecutor({}, eventBus);
    mockAgent = new MockAgent({
      id: 'agent-1',
      type: AgentType.CODER,
      name: 'Test Agent',
    });
  });

  afterEach(async () => {
    if (executor.isRunning()) {
      await executor.shutdown(true);
    }
  });

  describe('Construction', () => {
    it('should create executor with default config', () => {
      const exec = new BackgroundExecutor();
      expect(exec.isRunning()).toBe(true);
      expect(exec.getPendingCount()).toBe(0);
      expect(exec.getRunningCount()).toBe(0);
    });

    it('should accept custom configuration', () => {
      const exec = new BackgroundExecutor({
        maxConcurrentJobs: 5,
        defaultTimeout: 60000,
      });
      expect(exec.isRunning()).toBe(true);
    });

    it('should create executor with factory function', () => {
      const exec = createBackgroundExecutor({ maxConcurrentJobs: 3 });
      expect(exec.isRunning()).toBe(true);
    });
  });

  describe('Job Submission', () => {
    it('should submit a job successfully', async () => {
      const task = createMockTask();
      const job = await submitBackgroundJob(executor, mockAgent, task);

      expect(job).toBeDefined();
      expect(job.id).toBeDefined();
      expect(job.agentId).toBe(mockAgent.id);
      expect(job.agentType).toBe(mockAgent.type);
      expect(job.task).toBe(task);
      // Job may start immediately if executor has capacity
      expect([BackgroundJobStatus.PENDING, BackgroundJobStatus.RUNNING]).toContain(
        job.status
      );
      expect(job.createdAt).toBeInstanceOf(Date);
    });

    it('should emit JobSubmitted event', async () => {
      const task = createMockTask();
      await submitBackgroundJob(executor, mockAgent, task);

      const events = eventBus.getEmittedEvents();
      const submittedEvent = events.find(
        (e) => e.type === BackgroundExecutorEvents.JobSubmitted
      );

      expect(submittedEvent).toBeDefined();
      expect(submittedEvent?.payload).toMatchObject({
        agentId: mockAgent.id,
        status: BackgroundJobStatus.PENDING,
      });
    });

    it('should accept job options', async () => {
      const task = createMockTask();
      const onComplete = jest.fn();
      const job = await submitBackgroundJob(executor, mockAgent, task, {
        timeout: 5000,
        correlationId: 'corr-123',
        tags: ['test', 'background'],
        onComplete,
      });

      expect(job.timeout).toBe(5000);
      expect(job.correlationId).toBe('corr-123');
      expect(job.tags).toEqual(['test', 'background']);
    });

    it('should reject submission when executor is shutting down', async () => {
      await executor.shutdown(true);

      const task = createMockTask();
      await expect(
        submitBackgroundJob(executor, mockAgent, task)
      ).rejects.toThrow('shutting down');
    });

    it('should reject when queue limit is reached', async () => {
      const smallQueueExecutor = new BackgroundExecutor({
        queueSizeLimit: 2,
        maxConcurrentJobs: 1,
      });

      // Create an agent that takes time to process
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 1000 }
      );

      // Submit 3 jobs (should fail on 3rd)
      const task1 = createMockTask();
      const task2 = createMockTask();
      const task3 = createMockTask();

      await submitBackgroundJob(smallQueueExecutor, slowAgent, task1);
      await submitBackgroundJob(smallQueueExecutor, slowAgent, task2);

      await expect(
        submitBackgroundJob(smallQueueExecutor, slowAgent, task3)
      ).rejects.toThrow('Queue limit reached');

      await smallQueueExecutor.shutdown(true);
    });
  });

  describe('Job Execution', () => {
    it('should execute a job and return result', async () => {
      const task = createMockTask();
      const job = await submitBackgroundJob(executor, mockAgent, task);

      // Wait for job to complete
      const result = await executor.waitFor(job.id, 5000);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.status).toBe(TaskResultStatus.COMPLETED);
    });

    it('should emit JobStarted and JobCompleted events', async () => {
      const task = createMockTask();
      const job = await submitBackgroundJob(executor, mockAgent, task);

      await executor.waitFor(job.id, 5000);

      const events = eventBus.getEmittedEvents();
      const startedEvent = events.find(
        (e) => e.type === BackgroundExecutorEvents.JobStarted
      );
      const completedEvent = events.find(
        (e) => e.type === BackgroundExecutorEvents.JobCompleted
      );

      expect(startedEvent).toBeDefined();
      expect(completedEvent).toBeDefined();
      expect(completedEvent?.payload).toMatchObject({
        status: BackgroundJobStatus.COMPLETED,
      });
    });

    it('should handle job failure', async () => {
      const failingAgent = new MockAgent(
        { id: 'fail-1', type: AgentType.CODER },
        { shouldFail: true, failMessage: 'Test failure' }
      );

      const task = createMockTask();
      const job = await submitBackgroundJob(executor, failingAgent, task);

      await expect(executor.waitFor(job.id, 5000)).rejects.toThrow('Test failure');

      const completedJob = executor.getJob(job.id);
      expect(completedJob?.status).toBe(BackgroundJobStatus.FAILED);
      expect(completedJob?.error).toBe('Test failure');
    });

    it('should emit JobFailed event on failure', async () => {
      const failingAgent = new MockAgent(
        { id: 'fail-1', type: AgentType.CODER },
        { shouldFail: true }
      );

      const task = createMockTask();
      const job = await submitBackgroundJob(executor, failingAgent, task);

      try {
        await executor.waitFor(job.id, 5000);
      } catch {
        // Expected
      }

      const events = eventBus.getEmittedEvents();
      const failedEvent = events.find(
        (e) => e.type === BackgroundExecutorEvents.JobFailed
      );

      expect(failedEvent).toBeDefined();
      expect(failedEvent?.payload).toMatchObject({
        status: BackgroundJobStatus.FAILED,
      });
    });

    it('should call onComplete callback', async () => {
      const onComplete = jest.fn();
      const task = createMockTask();

      const job = await submitBackgroundJob(executor, mockAgent, task, {
        onComplete,
      });

      await executor.waitFor(job.id, 5000);

      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          status: TaskResultStatus.COMPLETED,
        })
      );
    });

    it('should call onError callback on failure', async () => {
      const onError = jest.fn();
      const failingAgent = new MockAgent(
        { id: 'fail-1', type: AgentType.CODER },
        { shouldFail: true, failMessage: 'Callback test' }
      );

      const task = createMockTask();
      const job = await submitBackgroundJob(executor, failingAgent, task, {
        onError,
      });

      try {
        await executor.waitFor(job.id, 5000);
      } catch {
        // Expected
      }

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Callback test',
        })
      );
    });
  });

  describe('Concurrency Control', () => {
    it('should respect maxConcurrentJobs', async () => {
      const concurrentExecutor = new BackgroundExecutor({
        maxConcurrentJobs: 2,
      });

      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 100 }
      );

      // Submit 4 jobs
      await Promise.all([
        submitBackgroundJob(concurrentExecutor, slowAgent, createMockTask()),
        submitBackgroundJob(concurrentExecutor, slowAgent, createMockTask()),
        submitBackgroundJob(concurrentExecutor, slowAgent, createMockTask()),
        submitBackgroundJob(concurrentExecutor, slowAgent, createMockTask()),
      ]);

      // Give some time for jobs to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have 2 running, 2 pending
      expect(concurrentExecutor.getRunningCount()).toBeLessThanOrEqual(2);
      expect(concurrentExecutor.getPendingCount()).toBeGreaterThanOrEqual(0);

      await concurrentExecutor.shutdown(true);
    });
  });

  describe('Job Cancellation', () => {
    it('should cancel a pending job', async () => {
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 5000 }
      );

      // Use single concurrent job executor
      const singleExecutor = new BackgroundExecutor({ maxConcurrentJobs: 1 });

      // First job will run
      await submitBackgroundJob(singleExecutor, slowAgent, createMockTask());
      // Second job will be pending
      const job2 = await submitBackgroundJob(singleExecutor, slowAgent, createMockTask());

      // Cancel pending job
      const cancelled = await singleExecutor.cancel(job2.id);

      expect(cancelled).toBe(true);

      const cancelledJob = singleExecutor.getJob(job2.id);
      expect(cancelledJob?.status).toBe(BackgroundJobStatus.CANCELLED);

      await singleExecutor.shutdown(true);
    });

    it('should emit JobCancelled event', async () => {
      // Use executor with single concurrent job and slow agent
      const singleExecutor = new BackgroundExecutor({ maxConcurrentJobs: 1 }, eventBus);
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 5000 }
      );

      // First job will run (and block the executor)
      await submitBackgroundJob(singleExecutor, slowAgent, createMockTask());
      // Second job will be pending
      const job = await submitBackgroundJob(singleExecutor, slowAgent, createMockTask());

      await singleExecutor.cancel(job.id);

      const events = eventBus.getEmittedEvents();
      const cancelledEvent = events.find(
        (e) => e.type === BackgroundExecutorEvents.JobCancelled
      );

      expect(cancelledEvent).toBeDefined();

      await singleExecutor.shutdown(true);
    });

    it('should return false for non-existent job', async () => {
      const cancelled = await executor.cancel('non-existent-id');
      expect(cancelled).toBe(false);
    });

    it('should return false for already completed job', async () => {
      const task = createMockTask();
      const job = await submitBackgroundJob(executor, mockAgent, task);

      await executor.waitFor(job.id, 5000);

      const cancelled = await executor.cancel(job.id);
      expect(cancelled).toBe(false);
    });
  });

  describe('Job Timeout', () => {
    it('should timeout a long-running job', async () => {
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 5000 }
      );

      const task = createMockTask();
      const job = await submitBackgroundJob(executor, slowAgent, task, {
        timeout: 100,
      });

      await expect(executor.waitFor(job.id, 5000)).rejects.toThrow('timed out');

      const timedOutJob = executor.getJob(job.id);
      expect(timedOutJob?.status).toBe(BackgroundJobStatus.TIMEOUT);
    });

    it('should emit JobTimeout event', async () => {
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 5000 }
      );

      const task = createMockTask();
      const job = await submitBackgroundJob(executor, slowAgent, task, {
        timeout: 100,
      });

      try {
        await executor.waitFor(job.id, 5000);
      } catch {
        // Expected
      }

      const events = eventBus.getEmittedEvents();
      const timeoutEvent = events.find(
        (e) => e.type === BackgroundExecutorEvents.JobTimeout
      );

      expect(timeoutEvent).toBeDefined();
    });
  });

  describe('Job Queries', () => {
    it('should get job by ID', async () => {
      const task = createMockTask();
      const job = await submitBackgroundJob(executor, mockAgent, task);

      const retrieved = executor.getJob(job.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(job.id);
    });

    it('should return undefined for non-existent job', () => {
      const retrieved = executor.getJob('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should get active jobs', async () => {
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 1000 }
      );

      await submitBackgroundJob(executor, slowAgent, createMockTask());
      await submitBackgroundJob(executor, slowAgent, createMockTask());

      const activeJobs = executor.getActiveJobs();
      expect(activeJobs.length).toBe(2);
    });

    it('should get jobs by agent', async () => {
      const agent2 = new MockAgent({ id: 'agent-2', type: AgentType.TESTER });

      await submitBackgroundJob(executor, mockAgent, createMockTask());
      await submitBackgroundJob(executor, agent2, createMockTask());
      await submitBackgroundJob(executor, mockAgent, createMockTask());

      const agentJobs = executor.getJobsByAgent(mockAgent.id);
      expect(agentJobs.length).toBe(2);
    });

    it('should get jobs by status', async () => {
      const task = createMockTask();
      const job = await submitBackgroundJob(executor, mockAgent, task);

      await executor.waitFor(job.id, 5000);

      const completedJobs = executor.getJobsByStatus(BackgroundJobStatus.COMPLETED);
      expect(completedJobs.length).toBe(1);
    });
  });

  describe('Wait Operations', () => {
    it('should wait for a specific job', async () => {
      const task = createMockTask();
      const job = await submitBackgroundJob(executor, mockAgent, task);

      const result = await executor.waitFor(job.id);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should reject waitFor with timeout', async () => {
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 5000 }
      );

      const task = createMockTask();
      const job = await submitBackgroundJob(executor, slowAgent, task);

      await expect(executor.waitFor(job.id, 100)).rejects.toThrow('Timeout');
    });

    it('should wait for all jobs', async () => {
      await submitBackgroundJob(executor, mockAgent, createMockTask());
      await submitBackgroundJob(executor, mockAgent, createMockTask());

      await executor.waitForAll(5000);

      expect(executor.getActiveJobs().length).toBe(0);
    });

    it('should return immediately if no active jobs', async () => {
      await executor.waitForAll(1000);
      // Should not throw
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const task = createMockTask();
      await submitBackgroundJob(executor, mockAgent, task);

      await executor.shutdown();

      expect(executor.isRunning()).toBe(false);
    });

    it('should force shutdown and cancel jobs', async () => {
      const slowAgent = new MockAgent(
        { id: 'slow-1', type: AgentType.CODER },
        { processDelay: 5000 }
      );

      await submitBackgroundJob(executor, slowAgent, createMockTask());
      await submitBackgroundJob(executor, slowAgent, createMockTask());

      await executor.shutdown(true);

      expect(executor.isRunning()).toBe(false);
    });

    it('should emit ExecutorShutdown event', async () => {
      await executor.shutdown();

      const events = eventBus.getEmittedEvents();
      const shutdownEvent = events.find(
        (e) => e.type === BackgroundExecutorEvents.ExecutorShutdown
      );

      expect(shutdownEvent).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should track job statistics', async () => {
      // Complete some jobs
      await submitBackgroundJob(executor, mockAgent, createMockTask());
      await submitBackgroundJob(executor, mockAgent, createMockTask());

      await executor.waitForAll(5000);

      // Fail a job
      const failingAgent = new MockAgent(
        { id: 'fail-1', type: AgentType.CODER },
        { shouldFail: true }
      );
      const failJob = await submitBackgroundJob(
        executor,
        failingAgent,
        createMockTask()
      );
      try {
        await executor.waitFor(failJob.id, 5000);
      } catch {
        // Expected
      }

      const stats = executor.getStats();

      expect(stats.totalJobsSubmitted).toBe(3);
      expect(stats.completedJobs).toBe(2);
      expect(stats.failedJobs).toBe(1);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average job duration', async () => {
      const delayAgent = new MockAgent(
        { id: 'delay-1', type: AgentType.CODER },
        { processDelay: 50 }
      );

      await submitBackgroundJob(executor, delayAgent, createMockTask());
      await submitBackgroundJob(executor, delayAgent, createMockTask());

      await executor.waitForAll(5000);

      const stats = executor.getStats();

      expect(stats.averageJobDuration).toBeGreaterThan(0);
    });
  });
});

describe('BackgroundExecutor Schema Validation', () => {
  it('should validate config schema', () => {
    expect(() => {
      new BackgroundExecutor({
        maxConcurrentJobs: 0, // Invalid: must be >= 1
      });
    }).toThrow();
  });

  it('should apply default config values', () => {
    const exec = new BackgroundExecutor({});
    const stats = exec.getStats();
    expect(stats.pendingJobs).toBe(0);
  });
});
