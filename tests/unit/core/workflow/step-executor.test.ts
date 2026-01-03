/**
 * Step Executor Tests
 *
 * Tests for step execution, retry logic, timeout handling, and hooks.
 */

import {
  StepExecutor,
  createStepExecutor,
  StepExecutorEvents,
  RetryStrategy,
  StepExecutionContext,
  StepExecutorEventPayload,
} from '../../../../src/core/workflow';

import {
  StepType,
  AgentStep,
} from '../../../../src/core/workflow';

import {
  IAgent,
  IAgentRegistry,
  AgentType,
  AgentStatus,
  ITask,
  TaskResult,
  TaskResultStatus,
} from '../../../../src/core/interfaces';

// ============================================================================
// Mock Implementations
// ============================================================================

class MockAgent implements IAgent {
  public readonly id: string;
  public readonly type: AgentType;
  public readonly name: string;
  public readonly version = '1.0.0';
  public processTaskFn: (task: ITask) => Promise<TaskResult>;

  constructor(id: string, type: AgentType, name: string) {
    this.id = id;
    this.type = type;
    this.name = name;
    this.processTaskFn = async (task: ITask) => ({
      taskId: task.id,
      success: true,
      status: TaskResultStatus.COMPLETED,
      data: { result: 'mock-result' },
      metadata: {
        agentId: this.id,
        agentType: this.type,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 10,
      },
    });
  }

  async initialize(): Promise<void> {}
  async start(): Promise<void> {}
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async stop(): Promise<void> {}
  async dispose(): Promise<void> {}

  canHandle(task: ITask): boolean {
    return task.agentType === this.type;
  }

  async processTask(task: ITask): Promise<TaskResult> {
    return this.processTaskFn(task);
  }

  getState() {
    return {
      status: AgentStatus.IDLE,
      currentTask: null,
      queuedTasks: 0,
      processedTasks: 0,
      lastActiveAt: null,
    };
  }

  getHealth() {
    return {
      healthy: true,
      status: AgentStatus.IDLE,
      uptime: 1000,
      lastCheck: new Date(),
    };
  }

  getCapabilities() {
    return [];
  }

  getMetrics() {
    return {
      tasksProcessed: 0,
      tasksFailed: 0,
      averageTaskDuration: 0,
      totalTokensUsed: 0,
      uptime: 1000,
      lastActiveAt: null,
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
// Test Setup
// ============================================================================

describe('StepExecutor', () => {
  let executor: StepExecutor;
  let registry: MockAgentRegistry;
  let coderAgent: MockAgent;

  const createContext = (overrides?: Partial<StepExecutionContext>): StepExecutionContext => ({
    workflowInstanceId: 'test-workflow-1',
    stepId: 'test-step-1',
    inputs: {},
    variables: {},
    stepOutputs: {},
    executionDepth: 0,
    ...overrides,
  });

  const createAgentStep = (id: string, name: string): AgentStep => ({
    id,
    name,
    type: StepType.AGENT,
    config: {
      agentType: AgentType.CODER,
      taskType: 'test-task',
      payload: {},
    },
  });

  beforeEach(() => {
    registry = new MockAgentRegistry();
    coderAgent = new MockAgent('coder-1', AgentType.CODER, 'Coder Agent');
    registry.register(coderAgent);

    executor = createStepExecutor(registry, {
      defaultTimeout: 5000,
      defaultRetryPolicy: {
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
      },
    });
  });

  // ==========================================================================
  // Basic Execution Tests
  // ==========================================================================

  describe('Basic Execution', () => {
    it('should execute a simple agent step', async () => {
      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(true);
      expect(result.output).toEqual({ result: 'mock-result' });
      expect(result.retryCount).toBe(0);
      expect(result.skipped).toBe(false);
    });

    it('should pass payload to agent', async () => {
      let receivedPayload: Record<string, unknown> | undefined;

      coderAgent.processTaskFn = async (task: ITask) => {
        receivedPayload = task.payload as Record<string, unknown>;
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: {},
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10,
          },
        };
      };

      const step: AgentStep = {
        id: 'step1',
        name: 'Test Step',
        type: StepType.AGENT,
        config: {
          agentType: AgentType.CODER,
          taskType: 'test-task',
          payload: { key: 'value', count: 42 },
        },
      };
      const context = createContext();

      await executor.execute(step, context);

      expect(receivedPayload).toEqual({ key: 'value', count: 42 });
    });

    it('should resolve variables in payload', async () => {
      let receivedPayload: Record<string, unknown> | undefined;

      coderAgent.processTaskFn = async (task: ITask) => {
        receivedPayload = task.payload as Record<string, unknown>;
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: {},
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10,
          },
        };
      };

      const step: AgentStep = {
        id: 'step1',
        name: 'Test Step',
        type: StepType.AGENT,
        config: {
          agentType: AgentType.CODER,
          taskType: 'test-task',
          payload: { name: '${inputs.userName}' },
        },
      };

      const context = createContext({
        inputs: { userName: 'TestUser' },
      });

      await executor.execute(step, context);

      expect(receivedPayload).toEqual({ name: 'TestUser' });
    });

    it('should track execution duration', async () => {
      coderAgent.processTaskFn = async (task: ITask) => {
        await new Promise(r => setTimeout(r, 50));
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: {},
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 50,
          },
        };
      };

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.duration).toBeGreaterThanOrEqual(45);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('Error Handling', () => {
    it('should return failed result when agent throws', async () => {
      coderAgent.processTaskFn = async () => {
        throw new Error('Agent execution failed');
      };

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Agent execution failed');
    });

    it('should return failed result when agent returns failure', async () => {
      coderAgent.processTaskFn = async (task: ITask) => ({
        taskId: task.id,
        success: false,
        status: TaskResultStatus.FAILED,
        data: {},
        error: { message: 'Task failed', code: 'TASK_ERROR', recoverable: false },
        metadata: {
          agentId: coderAgent.id,
          agentType: coderAgent.type,
          startedAt: new Date(),
          completedAt: new Date(),
          duration: 10,
        },
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Task failed');
    });

    it('should fail when agent not found', async () => {
      const step: AgentStep = {
        id: 'step1',
        name: 'Test Step',
        type: StepType.AGENT,
        config: {
          agentType: AgentType.REVIEWER, // Not registered
          taskType: 'test-task',
          payload: {},
        },
      };
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No agent found');
    });
  });

  // ==========================================================================
  // Retry Logic Tests
  // ==========================================================================

  describe('Retry Logic', () => {
    it('should retry on failure', async () => {
      let attempts = 0;

      coderAgent.processTaskFn = async (task: ITask) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: { result: 'success' },
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10,
          },
        };
      };

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(attempts).toBe(3);
    });

    it('should fail after max retries exceeded', async () => {
      coderAgent.processTaskFn = async () => {
        throw new Error('Persistent failure');
      };

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(false);
      expect(result.retryCount).toBe(3); // maxAttempts
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;

      coderAgent.processTaskFn = async () => {
        attempts++;
        const error = new Error('Step execution timed out after 1000ms');
        throw error;
      };

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(false);
      expect(attempts).toBe(1); // No retries for timeout
    });
  });

  // ==========================================================================
  // Retry Delay Calculation Tests
  // ==========================================================================

  describe('Retry Delay Calculation', () => {
    const policy = {
      maxAttempts: 5,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
    };

    it('should calculate exponential backoff', () => {
      const delay1 = executor.calculateRetryDelay(1, policy, RetryStrategy.EXPONENTIAL);
      const delay2 = executor.calculateRetryDelay(2, policy, RetryStrategy.EXPONENTIAL);
      const delay3 = executor.calculateRetryDelay(3, policy, RetryStrategy.EXPONENTIAL);

      // With 10% jitter, delays should be approximately:
      // 100, 200, 400
      expect(delay1).toBeGreaterThanOrEqual(90);
      expect(delay1).toBeLessThanOrEqual(110);

      expect(delay2).toBeGreaterThanOrEqual(180);
      expect(delay2).toBeLessThanOrEqual(220);

      expect(delay3).toBeGreaterThanOrEqual(360);
      expect(delay3).toBeLessThanOrEqual(440);
    });

    it('should calculate fixed delay', () => {
      const delay1 = executor.calculateRetryDelay(1, policy, RetryStrategy.FIXED);
      const delay2 = executor.calculateRetryDelay(2, policy, RetryStrategy.FIXED);
      const delay3 = executor.calculateRetryDelay(3, policy, RetryStrategy.FIXED);

      // Fixed delay with jitter
      expect(delay1).toBeGreaterThanOrEqual(90);
      expect(delay1).toBeLessThanOrEqual(110);
      expect(delay2).toBeGreaterThanOrEqual(90);
      expect(delay2).toBeLessThanOrEqual(110);
      expect(delay3).toBeGreaterThanOrEqual(90);
      expect(delay3).toBeLessThanOrEqual(110);
    });

    it('should calculate linear delay', () => {
      const delay1 = executor.calculateRetryDelay(1, policy, RetryStrategy.LINEAR);
      const delay2 = executor.calculateRetryDelay(2, policy, RetryStrategy.LINEAR);
      const delay3 = executor.calculateRetryDelay(3, policy, RetryStrategy.LINEAR);

      // Linear delay: 100*1, 100*2, 100*3 with jitter
      expect(delay1).toBeGreaterThanOrEqual(90);
      expect(delay1).toBeLessThanOrEqual(110);

      expect(delay2).toBeGreaterThanOrEqual(180);
      expect(delay2).toBeLessThanOrEqual(220);

      expect(delay3).toBeGreaterThanOrEqual(270);
      expect(delay3).toBeLessThanOrEqual(330);
    });

    it('should respect max delay', () => {
      const delay = executor.calculateRetryDelay(10, policy, RetryStrategy.EXPONENTIAL);

      // Should be capped at maxDelay (1000)
      expect(delay).toBeLessThanOrEqual(1100); // 1000 + 10% jitter
    });
  });

  // ==========================================================================
  // shouldRetry Tests
  // ==========================================================================

  describe('shouldRetry', () => {
    const policy = {
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffMultiplier: 2,
    };

    it('should return true for retryable errors below max attempts', () => {
      const error = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        recoverable: true,
        retryable: true,
      };

      expect(executor.shouldRetry(error, 0, policy)).toBe(true);
      expect(executor.shouldRetry(error, 1, policy)).toBe(true);
      expect(executor.shouldRetry(error, 2, policy)).toBe(true);
    });

    it('should return false when max attempts exceeded', () => {
      const error = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        recoverable: true,
        retryable: true,
      };

      expect(executor.shouldRetry(error, 3, policy)).toBe(false);
      expect(executor.shouldRetry(error, 4, policy)).toBe(false);
    });

    it('should return false for non-retryable errors', () => {
      const error = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        recoverable: false,
        retryable: false,
      };

      expect(executor.shouldRetry(error, 0, policy)).toBe(false);
    });

    it('should check retryable error codes when specified', () => {
      const policyWithCodes = {
        ...policy,
        retryableErrors: ['NETWORK_ERROR', 'TIMEOUT'],
      };

      const networkError = {
        code: 'NETWORK_ERROR',
        message: 'Connection failed',
        recoverable: true,
        retryable: true,
      };

      const validationError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        recoverable: true,
        retryable: true,
      };

      expect(executor.shouldRetry(networkError, 0, policyWithCodes)).toBe(true);
      expect(executor.shouldRetry(validationError, 0, policyWithCodes)).toBe(false);
    });
  });

  // ==========================================================================
  // Timeout Tests
  // ==========================================================================

  describe('Timeout Handling', () => {
    it('should timeout long-running steps', async () => {
      coderAgent.processTaskFn = async (task: ITask) => {
        await new Promise(r => setTimeout(r, 10000)); // 10 seconds
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: {},
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10000,
          },
        };
      };

      const step: AgentStep = {
        id: 'step1',
        name: 'Test Step',
        type: StepType.AGENT,
        timeout: 100, // 100ms timeout
        config: {
          agentType: AgentType.CODER,
          taskType: 'test-task',
          payload: {},
        },
      };
      const context = createContext();

      const result = await executor.execute(step, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });
  });

  // ==========================================================================
  // Execution Depth Tests
  // ==========================================================================

  describe('Execution Depth', () => {
    it('should fail when max execution depth exceeded', async () => {
      const step = createAgentStep('step1', 'Test Step');
      const context = createContext({
        executionDepth: 15, // Above default max of 10
      });

      const result = await executor.execute(step, context);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MAX_DEPTH_EXCEEDED');
    });
  });

  // ==========================================================================
  // Event Tests
  // ==========================================================================

  describe('Events', () => {
    it('should emit step starting event', async () => {
      const events: StepExecutorEventPayload[] = [];

      executor.on(StepExecutorEvents.STEP_STARTING, (payload) => {
        events.push(payload);
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executor.execute(step, context);

      expect(events.length).toBe(1);
      expect(events[0].step.id).toBe('step1');
    });

    it('should emit step completed event', async () => {
      const events: StepExecutorEventPayload[] = [];

      executor.on(StepExecutorEvents.STEP_COMPLETED, (payload) => {
        events.push(payload);
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executor.execute(step, context);

      expect(events.length).toBe(1);
      expect(events[0].result?.success).toBe(true);
    });

    it('should emit step failed event', async () => {
      const events: StepExecutorEventPayload[] = [];

      coderAgent.processTaskFn = async () => {
        throw new Error('Step execution timed out after 1000ms');
      };

      executor.on(StepExecutorEvents.STEP_FAILED, (payload) => {
        events.push(payload);
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executor.execute(step, context);

      expect(events.length).toBe(1);
      expect(events[0].error).toBeDefined();
    });

    it('should emit step retrying event', async () => {
      let attempts = 0;
      const retryEvents: StepExecutorEventPayload[] = [];

      coderAgent.processTaskFn = async (task: ITask) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: {},
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10,
          },
        };
      };

      executor.on(StepExecutorEvents.STEP_RETRYING, (payload) => {
        retryEvents.push(payload);
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executor.execute(step, context);

      expect(retryEvents.length).toBe(2); // 2 retries
    });

    it('should unsubscribe from events', async () => {
      let eventCount = 0;
      const handler = () => { eventCount++; };

      executor.on(StepExecutorEvents.STEP_COMPLETED, handler);
      executor.off(StepExecutorEvents.STEP_COMPLETED, handler);

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executor.execute(step, context);

      expect(eventCount).toBe(0);
    });
  });

  // ==========================================================================
  // Hook Tests
  // ==========================================================================

  describe('Hooks', () => {
    it('should call beforeStep hook', async () => {
      let hookCalled = false;

      const executorWithHooks = createStepExecutor(registry, {
        defaultTimeout: 5000,
        defaultRetryPolicy: {
          maxAttempts: 3,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
        },
        hooks: {
          beforeStep: async () => {
            hookCalled = true;
          },
        },
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executorWithHooks.execute(step, context);

      expect(hookCalled).toBe(true);
    });

    it('should call afterStep hook', async () => {
      let hookCalled = false;

      const executorWithHooks = createStepExecutor(registry, {
        defaultTimeout: 5000,
        defaultRetryPolicy: {
          maxAttempts: 3,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
        },
        hooks: {
          afterStep: async () => {
            hookCalled = true;
          },
        },
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executorWithHooks.execute(step, context);

      expect(hookCalled).toBe(true);
    });

    it('should call onStepError hook', async () => {
      let hookCalled = false;

      coderAgent.processTaskFn = async () => {
        throw new Error('Step execution timed out after 1000ms');
      };

      const executorWithHooks = createStepExecutor(registry, {
        defaultTimeout: 5000,
        defaultRetryPolicy: {
          maxAttempts: 1, // No retries
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
        },
        hooks: {
          onStepError: async () => {
            hookCalled = true;
          },
        },
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executorWithHooks.execute(step, context);

      expect(hookCalled).toBe(true);
    });

    it('should call onStepRetry hook', async () => {
      let retryHookCount = 0;

      let attempts = 0;
      coderAgent.processTaskFn = async (task: ITask) => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: {},
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10,
          },
        };
      };

      const executorWithHooks = createStepExecutor(registry, {
        defaultTimeout: 5000,
        defaultRetryPolicy: {
          maxAttempts: 5,
          initialDelay: 100,
          maxDelay: 1000,
          backoffMultiplier: 2,
        },
        hooks: {
          onStepRetry: async () => {
            retryHookCount++;
          },
        },
      });

      const step = createAgentStep('step1', 'Test Step');
      const context = createContext();

      await executorWithHooks.execute(step, context);

      expect(retryHookCount).toBe(2);
    });
  });

  // ==========================================================================
  // Skipped Result Tests
  // ==========================================================================

  describe('Skipped Result', () => {
    it('should create skipped result', () => {
      const result = executor.createSkippedResult('Condition not met');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('Condition not met');
      expect(result.duration).toBe(0);
      expect(result.retryCount).toBe(0);
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('Factory Function', () => {
    it('should create executor with default config', () => {
      const defaultExecutor = createStepExecutor(registry);
      expect(defaultExecutor).toBeInstanceOf(StepExecutor);
    });

    it('should create executor with custom config', () => {
      const customExecutor = createStepExecutor(registry, {
        defaultTimeout: 10000,
        maxExecutionDepth: 5,
      });

      expect(customExecutor).toBeInstanceOf(StepExecutor);
    });
  });

  // ==========================================================================
  // Loop Variable Resolution Tests
  // ==========================================================================

  describe('Loop Variable Resolution', () => {
    it('should resolve loop variables from context', async () => {
      let receivedPayload: Record<string, unknown> | undefined;

      coderAgent.processTaskFn = async (task: ITask) => {
        receivedPayload = task.payload as Record<string, unknown>;
        return {
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
          data: {},
          metadata: {
            agentId: coderAgent.id,
            agentType: coderAgent.type,
            startedAt: new Date(),
            completedAt: new Date(),
            duration: 10,
          },
        };
      };

      const step: AgentStep = {
        id: 'step1',
        name: 'Test Step',
        type: StepType.AGENT,
        config: {
          agentType: AgentType.CODER,
          taskType: 'test-task',
          payload: { item: '${item}', index: '${index}' },
        },
      };

      const context = createContext({
        variables: { item: 'test-item', index: 0 },
        loopContext: {
          currentIndex: 0,
          totalIterations: 3,
          currentItem: 'test-item',
          items: ['test-item', 'item2', 'item3'],
        },
      });

      await executor.execute(step, context);

      expect(receivedPayload).toEqual({ item: 'test-item', index: 0 });
    });
  });
});
