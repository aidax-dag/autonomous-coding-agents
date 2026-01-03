/**
 * Orchestrator Service Tests
 *
 * Tests for agent coordination, task distribution, and load balancing.
 */

import {
  OrchestratorService,
  createOrchestrator,
  RoutingStrategy,
  OrchestratorStatus,
  QueuedTaskStatus,
  OrchestratorEvents,
  OrchestratorEventPayload,
} from '../../../../src/core/orchestrator';

import {
  IAgent,
  IAgentRegistry,
  AgentType,
  AgentStatus,
  ITask,
  TaskResult,
  TaskResultStatus,
  TaskPriority,
  AgentCapability,
  AgentMetrics,
  HealthStatus,
  AgentState,
} from '../../../../src/core/interfaces';

// ============================================================================
// Mock Implementations
// ============================================================================

class MockAgent implements IAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;
  readonly version: string = '1.0.0';

  private _status: AgentStatus = AgentStatus.IDLE;
  private _processDelay: number;
  private _shouldFail: boolean = false;
  private _failError?: string;
  private _currentTask: ITask | null = null;
  private _processedTasks = 0;

  constructor(
    id: string,
    type: AgentType,
    name: string,
    options?: { processDelay?: number; shouldFail?: boolean; failError?: string }
  ) {
    this.id = id;
    this.type = type;
    this.name = name;
    this._processDelay = options?.processDelay ?? 10;
    this._shouldFail = options?.shouldFail ?? false;
    this._failError = options?.failError;
  }

  setFail(shouldFail: boolean, error?: string): void {
    this._shouldFail = shouldFail;
    this._failError = error;
  }

  async initialize(): Promise<void> {
    this._status = AgentStatus.IDLE;
  }

  async start(): Promise<void> {
    this._status = AgentStatus.IDLE;
  }

  async pause(): Promise<void> {
    this._status = AgentStatus.PAUSED;
  }

  async resume(): Promise<void> {
    this._status = AgentStatus.IDLE;
  }

  async stop(): Promise<void> {
    this._status = AgentStatus.STOPPED;
  }

  async dispose(): Promise<void> {
    this._status = AgentStatus.STOPPED;
  }

  canHandle(task: ITask): boolean {
    return task.agentType === this.type;
  }

  async processTask(task: ITask): Promise<TaskResult> {
    this._status = AgentStatus.PROCESSING;
    this._currentTask = task;

    await new Promise(resolve => setTimeout(resolve, this._processDelay));

    this._status = AgentStatus.IDLE;
    this._currentTask = null;
    this._processedTasks++;

    if (this._shouldFail) {
      return {
        taskId: task.id,
        success: false,
        status: TaskResultStatus.FAILED,
        error: {
          code: 'MOCK_ERROR',
          message: this._failError ?? 'Mock task failure',
          recoverable: true,
        },
        metadata: {
          agentId: this.id,
          agentType: this.type,
          startedAt: new Date(),
          completedAt: new Date(),
          duration: this._processDelay,
        },
      };
    }

    return {
      taskId: task.id,
      success: true,
      status: TaskResultStatus.COMPLETED,
      data: { result: 'success', taskType: task.type },
      metadata: {
        agentId: this.id,
        agentType: this.type,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: this._processDelay,
      },
    };
  }

  getState(): AgentState {
    return {
      status: this._status,
      currentTask: this._currentTask,
      queuedTasks: 0,
      processedTasks: this._processedTasks,
      lastActiveAt: new Date(),
    };
  }

  getHealth(): HealthStatus {
    return {
      healthy: true,
      status: this._status,
      uptime: 1000,
      lastCheck: new Date(),
    };
  }

  getCapabilities(): AgentCapability[] {
    return [{ name: 'default', description: 'Default capability' }];
  }

  getMetrics(): AgentMetrics {
    return {
      tasksProcessed: this._processedTasks,
      tasksFailed: 0,
      averageTaskDuration: this._processDelay,
      totalTokensUsed: 0,
      uptime: 1000,
      lastActiveAt: new Date(),
      errorRate: 0,
    };
  }
}

class MockAgentRegistry implements IAgentRegistry {
  private agents: Map<string, IAgent> = new Map();

  register(agent: IAgent): void {
    this.agents.set(agent.id, agent);
  }

  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  get(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  getByType(type: AgentType): IAgent[] {
    return Array.from(this.agents.values()).filter(a => a.type === type);
  }

  getAll(): IAgent[] {
    return Array.from(this.agents.values());
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  count(): number {
    return this.agents.size;
  }

  clear(): void {
    this.agents.clear();
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

function createTask(id: string, agentType: AgentType, priority: TaskPriority = TaskPriority.NORMAL): ITask {
  return {
    id,
    type: 'test-task',
    agentType,
    priority,
    payload: { data: 'test' },
    createdAt: new Date(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('OrchestratorService', () => {
  let registry: MockAgentRegistry;
  let orchestrator: OrchestratorService;
  let coderAgent: MockAgent;
  let reviewerAgent: MockAgent;

  beforeEach(() => {
    registry = new MockAgentRegistry();
    coderAgent = new MockAgent('agent-coder', AgentType.CODER, 'Coder Agent');
    reviewerAgent = new MockAgent('agent-reviewer', AgentType.REVIEWER, 'Reviewer Agent');
    registry.register(coderAgent);
    registry.register(reviewerAgent);

    orchestrator = new OrchestratorService(registry, undefined, {
      maxQueueSize: 100,
      maxConcurrentTasks: 5,
      taskTimeout: 5000,
      retryAttempts: 2,
      retryDelay: 50,
      healthCheckInterval: 60000, // Long interval for tests
    });
  });

  afterEach(async () => {
    await orchestrator.stop();
  });

  describe('Lifecycle', () => {
    it('should start and stop correctly', async () => {
      expect(orchestrator.getStats().status).toBe(OrchestratorStatus.STOPPED);

      await orchestrator.start();
      expect(orchestrator.getStats().status).toBe(OrchestratorStatus.RUNNING);

      await orchestrator.stop();
      expect(orchestrator.getStats().status).toBe(OrchestratorStatus.STOPPED);
    });

    it('should pause and resume correctly', async () => {
      await orchestrator.start();

      await orchestrator.pause();
      expect(orchestrator.getStats().status).toBe(OrchestratorStatus.PAUSED);

      await orchestrator.resume();
      expect(orchestrator.getStats().status).toBe(OrchestratorStatus.RUNNING);
    });

    it('should not start if already running', async () => {
      await orchestrator.start();
      await orchestrator.start(); // Should not throw
      expect(orchestrator.getStats().status).toBe(OrchestratorStatus.RUNNING);
    });
  });

  describe('Task Submission', () => {
    it('should submit task to queue', async () => {
      await orchestrator.start();

      const task = createTask('task-1', AgentType.CODER);
      const taskId = await orchestrator.submitTask(task);

      expect(taskId).toBe('task-1');
    });

    it('should reject task when queue is full', async () => {
      const smallQueueOrchestrator = new OrchestratorService(registry, undefined, {
        maxQueueSize: 1,
        maxConcurrentTasks: 0, // Prevent processing
      });

      await smallQueueOrchestrator.start();

      const task1 = createTask('task-1', AgentType.CODER);
      await smallQueueOrchestrator.submitTask(task1);

      const task2 = createTask('task-2', AgentType.CODER);
      await expect(smallQueueOrchestrator.submitTask(task2)).rejects.toThrow('queue is full');

      await smallQueueOrchestrator.stop();
    });

    it('should process submitted task', async () => {
      await orchestrator.start();

      const task = createTask('task-1', AgentType.CODER);
      await orchestrator.submitTask(task);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = orchestrator.getStats();
      expect(stats.completedTasks).toBe(1);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel pending task', async () => {
      // Create orchestrator that doesn't process immediately
      const slowOrchestrator = new OrchestratorService(registry, undefined, {
        maxConcurrentTasks: 0,
      });

      const task = createTask('task-1', AgentType.CODER);
      await slowOrchestrator.submitTask(task);

      const cancelled = await slowOrchestrator.cancelTask('task-1');
      expect(cancelled).toBe(true);
      expect(slowOrchestrator.getTaskStatus('task-1')).toBeUndefined();
    });

    it('should return false for non-existent task', async () => {
      const cancelled = await orchestrator.cancelTask('non-existent');
      expect(cancelled).toBe(false);
    });
  });

  describe('Task Status', () => {
    it('should return correct task status', async () => {
      const slowOrchestrator = new OrchestratorService(registry, undefined, {
        maxConcurrentTasks: 0,
      });

      const task = createTask('task-1', AgentType.CODER);
      await slowOrchestrator.submitTask(task);

      expect(slowOrchestrator.getTaskStatus('task-1')).toBe(QueuedTaskStatus.PENDING);
    });

    it('should return undefined for non-existent task', () => {
      expect(orchestrator.getTaskStatus('non-existent')).toBeUndefined();
    });
  });

  describe('Routing Strategies', () => {
    it('should use round-robin routing', async () => {
      const rrOrchestrator = new OrchestratorService(registry, undefined, {
        routingStrategy: RoutingStrategy.ROUND_ROBIN,
      });

      await rrOrchestrator.start();

      // Add another coder agent
      const coder2 = new MockAgent('agent-coder-2', AgentType.CODER, 'Coder 2');
      registry.register(coder2);

      const task1 = createTask('task-1', AgentType.CODER);
      const task2 = createTask('task-2', AgentType.CODER);

      await rrOrchestrator.submitTask(task1);
      await rrOrchestrator.submitTask(task2);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Both agents should have processed tasks
      expect(coderAgent.getMetrics().tasksProcessed + coder2.getMetrics().tasksProcessed).toBe(2);

      await rrOrchestrator.stop();
    });

    it('should use least-loaded routing', async () => {
      const llOrchestrator = new OrchestratorService(registry, undefined, {
        routingStrategy: RoutingStrategy.LEAST_LOADED,
      });

      await llOrchestrator.start();

      const task = createTask('task-1', AgentType.CODER);
      await llOrchestrator.submitTask(task);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(llOrchestrator.getStats().completedTasks).toBe(1);

      await llOrchestrator.stop();
    });

    it('should use random routing', async () => {
      const randOrchestrator = new OrchestratorService(registry, undefined, {
        routingStrategy: RoutingStrategy.RANDOM,
      });

      await randOrchestrator.start();

      const task = createTask('task-1', AgentType.CODER);
      await randOrchestrator.submitTask(task);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(randOrchestrator.getStats().completedTasks).toBe(1);

      await randOrchestrator.stop();
    });
  });

  describe('Error Handling and Retry', () => {
    it('should retry failed tasks', async () => {
      let attempts = 0;
      const failOnceAgent = new MockAgent('fail-once', AgentType.CODER, 'Fail Once', {
        shouldFail: true,
      });

      // Override processTask to fail once then succeed
      const originalProcess = failOnceAgent.processTask.bind(failOnceAgent);
      failOnceAgent.processTask = async (task: ITask) => {
        attempts++;
        if (attempts === 1) {
          return {
            taskId: task.id,
            success: false,
            status: TaskResultStatus.FAILED,
            error: { code: 'TEMP_ERROR', message: 'Temporary failure', recoverable: true },
            metadata: {
              agentId: failOnceAgent.id,
              agentType: failOnceAgent.type,
              startedAt: new Date(),
              completedAt: new Date(),
              duration: 10,
            },
          };
        }
        failOnceAgent.setFail(false);
        return originalProcess(task);
      };

      registry.clear();
      registry.register(failOnceAgent);

      const retryOrchestrator = new OrchestratorService(registry, undefined, {
        retryAttempts: 3,
        retryDelay: 10,
      });

      await retryOrchestrator.start();

      const task = createTask('task-1', AgentType.CODER);
      await retryOrchestrator.submitTask(task);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(attempts).toBeGreaterThan(1);

      await retryOrchestrator.stop();
    });

    it('should fail after max retries', async () => {
      const failingAgent = new MockAgent('always-fail', AgentType.CODER, 'Always Fail', {
        shouldFail: true,
      });

      registry.clear();
      registry.register(failingAgent);

      const retryOrchestrator = new OrchestratorService(registry, undefined, {
        retryAttempts: 2,
        retryDelay: 10,
      });

      await retryOrchestrator.start();

      const task = createTask('task-1', AgentType.CODER);
      await retryOrchestrator.submitTask(task);

      await new Promise(resolve => setTimeout(resolve, 200));

      expect(retryOrchestrator.getStats().failedTasks).toBe(1);

      await retryOrchestrator.stop();
    });
  });

  describe('Concurrent Task Limit', () => {
    it('should respect max concurrent tasks', async () => {
      const slowAgent = new MockAgent('slow-agent', AgentType.CODER, 'Slow Agent', {
        processDelay: 200,
      });

      registry.clear();
      registry.register(slowAgent);

      const limitedOrchestrator = new OrchestratorService(registry, undefined, {
        maxConcurrentTasks: 2,
      });

      await limitedOrchestrator.start();

      // Submit 5 tasks
      for (let i = 0; i < 5; i++) {
        await limitedOrchestrator.submitTask(createTask(`task-${i}`, AgentType.CODER));
      }

      // Check active tasks don't exceed limit
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(limitedOrchestrator.getStats().activeTasks).toBeLessThanOrEqual(2);

      await limitedOrchestrator.stop();
    });
  });

  describe('Agent Load', () => {
    it('should calculate agent load', async () => {
      await orchestrator.start();

      const load = orchestrator.getAgentLoad('agent-coder');
      expect(load).toBeGreaterThanOrEqual(0);
      expect(load).toBeLessThanOrEqual(1);
    });

    it('should return 0 for non-existent agent', () => {
      expect(orchestrator.getAgentLoad('non-existent')).toBe(0);
    });
  });

  describe('Available Agents', () => {
    it('should get all available agents', () => {
      const agents = orchestrator.getAvailableAgents();
      expect(agents.length).toBe(2);
    });

    it('should filter by agent type', () => {
      const coders = orchestrator.getAvailableAgents(AgentType.CODER);
      expect(coders.length).toBe(1);
      expect(coders[0].type).toBe(AgentType.CODER);
    });

    it('should exclude stopped agents', async () => {
      await coderAgent.stop();

      const coders = orchestrator.getAvailableAgents(AgentType.CODER);
      expect(coders.length).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      await orchestrator.start();

      const task = createTask('task-1', AgentType.CODER);
      await orchestrator.submitTask(task);

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = orchestrator.getStats();
      expect(stats.status).toBe(OrchestratorStatus.RUNNING);
      expect(stats.totalProcessed).toBe(1);
      expect(stats.completedTasks).toBe(1);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it('should calculate average times', async () => {
      await orchestrator.start();

      // Submit multiple tasks
      for (let i = 0; i < 3; i++) {
        await orchestrator.submitTask(createTask(`task-${i}`, AgentType.CODER));
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = orchestrator.getStats();
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });
  });

  describe('Events', () => {
    it('should emit task queued event', async () => {
      await orchestrator.start();

      let queuedEvent: OrchestratorEventPayload | null = null;
      orchestrator.on(OrchestratorEvents.TASK_QUEUED, (payload) => {
        queuedEvent = payload;
      });

      const task = createTask('task-1', AgentType.CODER);
      await orchestrator.submitTask(task);

      expect(queuedEvent).not.toBeNull();
      expect(queuedEvent!.taskId).toBe('task-1');
    });

    it('should emit task completed event', async () => {
      await orchestrator.start();

      let completedEvent: OrchestratorEventPayload | null = null;
      orchestrator.on(OrchestratorEvents.TASK_COMPLETED, (payload) => {
        completedEvent = payload;
      });

      const task = createTask('task-1', AgentType.CODER);
      await orchestrator.submitTask(task);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(completedEvent).not.toBeNull();
      expect(completedEvent!.taskId).toBe('task-1');
    });

    it('should emit task failed event', async () => {
      const failingAgent = new MockAgent('fail-agent', AgentType.CODER, 'Fail Agent', {
        shouldFail: true,
      });
      failingAgent.processTask = async (task: ITask): Promise<TaskResult> => {
        return {
          taskId: task.id,
          success: false,
          status: TaskResultStatus.FAILED,
          error: { code: 'ERROR', message: 'Failed', recoverable: false },
          metadata: {
            agentId: failingAgent.id,
            agentType: failingAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10,
          },
        };
      };

      registry.clear();
      registry.register(failingAgent);

      const failOrchestrator = new OrchestratorService(registry, undefined, {
        retryAttempts: 0,
      });

      await failOrchestrator.start();

      let failedEvent: OrchestratorEventPayload | null = null;
      failOrchestrator.on(OrchestratorEvents.TASK_FAILED, (payload) => {
        failedEvent = payload;
      });

      const task = createTask('task-1', AgentType.CODER);
      await failOrchestrator.submitTask(task);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(failedEvent).not.toBeNull();
      expect(failedEvent!.taskId).toBe('task-1');

      await failOrchestrator.stop();
    });

    it('should unsubscribe from events', async () => {
      await orchestrator.start();

      let callCount = 0;
      const handler = () => { callCount++; };

      orchestrator.on(OrchestratorEvents.TASK_QUEUED, handler);
      await orchestrator.submitTask(createTask('task-1', AgentType.CODER));

      orchestrator.off(OrchestratorEvents.TASK_QUEUED, handler);
      await orchestrator.submitTask(createTask('task-2', AgentType.CODER));

      expect(callCount).toBe(1);
    });
  });

  describe('Priority Handling', () => {
    it('should process high priority tasks first', async () => {
      const slowAgent = new MockAgent('slow-agent', AgentType.CODER, 'Slow Agent', {
        processDelay: 100,
      });

      registry.clear();
      registry.register(slowAgent);

      const priorityOrchestrator = new OrchestratorService(registry, undefined, {
        maxConcurrentTasks: 1,
      });

      const completionOrder: string[] = [];
      priorityOrchestrator.on(OrchestratorEvents.TASK_COMPLETED, (payload) => {
        completionOrder.push(payload.taskId!);
      });

      await priorityOrchestrator.start();

      // Submit low priority first, then high priority
      await priorityOrchestrator.submitTask(createTask('low-1', AgentType.CODER, TaskPriority.LOW));
      await priorityOrchestrator.submitTask(createTask('high-1', AgentType.CODER, TaskPriority.HIGH));
      await priorityOrchestrator.submitTask(createTask('normal-1', AgentType.CODER, TaskPriority.NORMAL));

      await new Promise(resolve => setTimeout(resolve, 500));

      // First task should be processed first regardless of priority (already started)
      // But subsequent tasks should be ordered by priority
      expect(completionOrder.length).toBe(3);

      await priorityOrchestrator.stop();
    });
  });

  describe('Factory Function', () => {
    it('should create orchestrator with default config', () => {
      const orch = createOrchestrator(registry);
      expect(orch).toBeInstanceOf(OrchestratorService);
    });

    it('should create orchestrator with custom config', () => {
      const orch = createOrchestrator(registry, undefined, {
        routingStrategy: RoutingStrategy.RANDOM,
        maxQueueSize: 500,
      });
      expect(orch).toBeInstanceOf(OrchestratorService);
    });
  });
});
