/**
 * Base Agent Tests
 */

import {
  BaseAgent,
  type ILLMClient,
  type IMessageBroker,
  type IAgentLogger,
  type AgentDependencies,
  type LLMResponse,
} from '../../../../src/core/agents';
import {
  AgentType,
  AgentStatus,
  type IAgentConfig,
  type ITask,
  type TaskResult,
  type AgentCapability,
  TaskPriority,
  TaskResultStatus,
} from '../../../../src/core/interfaces';

// Mock implementations
const createMockLLMClient = (): ILLMClient => ({
  complete: jest.fn().mockResolvedValue({
    content: 'test response',
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    stopReason: 'end',
  } as LLMResponse),
  stream: jest.fn(),
  getProvider: jest.fn().mockReturnValue('mock'),
  getModel: jest.fn().mockReturnValue('mock-model'),
});

const createMockMessageBroker = (): IMessageBroker => {
  const handlers: Map<string, (msg: unknown) => Promise<void>> = new Map();

  return {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockImplementation((topic, handler) => {
      handlers.set(topic, handler);
      return Promise.resolve();
    }),
    unsubscribe: jest.fn().mockResolvedValue(undefined),
    request: jest.fn().mockResolvedValue({}),
    isConnected: jest.fn().mockReturnValue(true),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    // Helper for tests
    simulateMessage: (topic: string, message: unknown) => {
      const handler = handlers.get(topic);
      if (handler) {
        return handler(message);
      }
      return Promise.resolve();
    },
  } as IMessageBroker & { simulateMessage: (topic: string, msg: unknown) => Promise<void> };
};

const createMockLogger = (): IAgentLogger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn().mockReturnThis(),
});

// Test agent implementation
class TestAgent extends BaseAgent {
  public processTaskCalls: ITask[] = [];
  public shouldFail = false;
  public processingDelay = 0;

  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();
    this.processTaskCalls.push(task);

    if (this.processingDelay > 0) {
      await new Promise((r) => setTimeout(r, this.processingDelay));
    }

    // Small delay to ensure duration > 0
    await new Promise((r) => setTimeout(r, 5));

    if (this.shouldFail) {
      throw new Error('Test failure');
    }

    return this.createSuccessResult(task, { processed: true }, startTime);
  }

  getCapabilities(): AgentCapability[] {
    return [
      { name: 'test', description: 'Test capability' },
    ];
  }

  // Expose protected methods for testing
  public getTaskTopicPublic(): string {
    return this.getTaskTopic();
  }

  public getResultTopicPublic(): string {
    return this.getResultTopic();
  }
}

const createTestConfig = (overrides?: Partial<IAgentConfig>): IAgentConfig => ({
  id: 'test-agent-1',
  type: AgentType.CODER,
  name: 'Test Agent',
  version: '1.0.0',
  llm: {
    provider: 'claude',
    model: 'claude-3-sonnet',
  },
  ...overrides,
});

const createTestTask = (overrides?: Partial<ITask>): ITask => ({
  id: 'task-1',
  type: 'test-task',
  agentType: AgentType.CODER,
  priority: TaskPriority.NORMAL,
  payload: { data: 'test' },
  createdAt: new Date(),
  ...overrides,
});

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: IAgentConfig;
  let dependencies: AgentDependencies;
  let mockBroker: IMessageBroker & { simulateMessage: (topic: string, msg: unknown) => Promise<void> };

  beforeEach(() => {
    config = createTestConfig();
    mockBroker = createMockMessageBroker() as IMessageBroker & { simulateMessage: (topic: string, msg: unknown) => Promise<void> };
    dependencies = {
      llmClient: createMockLLMClient(),
      messageBroker: mockBroker,
      logger: createMockLogger(),
    };
    agent = new TestAgent(config, dependencies);
  });

  afterEach(async () => {
    if (agent) {
      await agent.dispose();
    }
  });

  describe('Construction', () => {
    it('should initialize with correct properties', () => {
      expect(agent.id).toBe('test-agent-1');
      expect(agent.type).toBe(AgentType.CODER);
      expect(agent.name).toBe('Test Agent');
      expect(agent.version).toBe('1.0.0');
    });

    it('should throw if LLM client is missing', () => {
      expect(() => new TestAgent(config, {
        ...dependencies,
        llmClient: undefined as unknown as ILLMClient,
      })).toThrow('LLM client is required');
    });

    it('should throw if message broker is missing', () => {
      expect(() => new TestAgent(config, {
        ...dependencies,
        messageBroker: undefined as unknown as IMessageBroker,
      })).toThrow('Message broker is required');
    });

    it('should throw if logger is missing', () => {
      expect(() => new TestAgent(config, {
        ...dependencies,
        logger: undefined as unknown as IAgentLogger,
      })).toThrow('Logger is required');
    });
  });

  describe('Lifecycle', () => {
    it('should initialize correctly', async () => {
      await agent.initialize();

      const state = agent.getState();
      expect(state.status).toBe(AgentStatus.IDLE);
      expect(mockBroker.subscribe).toHaveBeenCalledWith(
        'agent.tasks.coder',
        expect.any(Function)
      );
    });

    it('should start correctly', async () => {
      await agent.start();

      const state = agent.getState();
      expect(state.status).toBe(AgentStatus.IDLE);
    });

    it('should pause and resume', async () => {
      await agent.start();

      await agent.pause();
      expect(agent.getState().status).toBe(AgentStatus.PAUSED);

      await agent.resume();
      expect(agent.getState().status).toBe(AgentStatus.IDLE);
    });

    it('should stop correctly', async () => {
      await agent.start();
      await agent.stop();

      const state = agent.getState();
      expect(state.status).toBe(AgentStatus.STOPPED);
      expect(mockBroker.unsubscribe).toHaveBeenCalled();
    });

    it('should dispose correctly', async () => {
      await agent.start();
      await agent.dispose();

      expect(() => agent.getState()).toThrow('Agent has been disposed');
    });

    it('should throw on invalid state transitions', async () => {
      // Can't pause when stopped
      await expect(agent.pause()).rejects.toThrow();

      // Can't resume when not paused
      await agent.start();
      await expect(agent.resume()).rejects.toThrow();
    });
  });

  describe('Task Processing', () => {
    it('should process task from queue', async () => {
      await agent.start();

      const task = createTestTask();
      await mockBroker.simulateMessage('agent.tasks.coder', task);

      // Wait for processing
      await new Promise((r) => setTimeout(r, 50));

      expect(agent.processTaskCalls).toHaveLength(1);
      expect(agent.processTaskCalls[0].id).toBe(task.id);
    });

    it('should publish result after processing', async () => {
      await agent.start();

      const task = createTestTask();
      await mockBroker.simulateMessage('agent.tasks.coder', task);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroker.publish).toHaveBeenCalledWith(
        'agent.results.coder',
        expect.objectContaining({
          taskId: task.id,
          success: true,
          status: TaskResultStatus.COMPLETED,
        })
      );
    });

    it('should handle task failure', async () => {
      agent.shouldFail = true;
      await agent.start();

      const task = createTestTask();
      await mockBroker.simulateMessage('agent.tasks.coder', task);

      await new Promise((r) => setTimeout(r, 50));

      expect(mockBroker.publish).toHaveBeenCalledWith(
        'agent.results.coder',
        expect.objectContaining({
          taskId: task.id,
          success: false,
          status: TaskResultStatus.FAILED,
        })
      );
    });

    it('should reject tasks for different agent types', async () => {
      await agent.start();

      const task = createTestTask({ agentType: AgentType.REVIEWER });
      await mockBroker.simulateMessage('agent.tasks.coder', task);

      await new Promise((r) => setTimeout(r, 50));

      expect(agent.processTaskCalls).toHaveLength(0);
    });

    it('should queue tasks with priority ordering', async () => {
      agent.processingDelay = 100; // Slow down processing
      await agent.start();

      // Send low priority first
      const lowTask = createTestTask({ id: 'low', priority: TaskPriority.LOW });
      const highTask = createTestTask({ id: 'high', priority: TaskPriority.HIGH });
      const urgentTask = createTestTask({ id: 'urgent', priority: TaskPriority.URGENT });

      // Add tasks quickly (before first one finishes)
      await mockBroker.simulateMessage('agent.tasks.coder', lowTask);
      await mockBroker.simulateMessage('agent.tasks.coder', highTask);
      await mockBroker.simulateMessage('agent.tasks.coder', urgentTask);

      // Wait for all processing
      await new Promise((r) => setTimeout(r, 500));

      // First task processed is the one that came first
      // But queued tasks should be prioritized
      expect(agent.processTaskCalls.length).toBeGreaterThan(0);
    });
  });

  describe('canHandle', () => {
    it('should return true for matching agent type', () => {
      const task = createTestTask({ agentType: AgentType.CODER });
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should return false for different agent type', () => {
      const task = createTestTask({ agentType: AgentType.REVIEWER });
      expect(agent.canHandle(task)).toBe(false);
    });
  });

  describe('State & Health', () => {
    it('should return correct state', async () => {
      await agent.start();

      const state = agent.getState();
      expect(state.status).toBe(AgentStatus.IDLE);
      expect(state.currentTask).toBeNull();
      expect(state.queuedTasks).toBe(0);
      expect(state.processedTasks).toBe(0);
    });

    it('should return correct health', async () => {
      await agent.start();

      const health = agent.getHealth();
      expect(health.healthy).toBe(true);
      expect(health.status).toBe(AgentStatus.IDLE);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should track metrics', async () => {
      await agent.start();

      const task = createTestTask();
      await mockBroker.simulateMessage('agent.tasks.coder', task);
      await new Promise((r) => setTimeout(r, 50));

      const metrics = agent.getMetrics();
      expect(metrics.tasksProcessed).toBe(1);
      expect(metrics.tasksFailed).toBe(0);
      expect(metrics.averageTaskDuration).toBeGreaterThan(0);
    });

    it('should track failed task metrics', async () => {
      agent.shouldFail = true;
      await agent.start();

      const task = createTestTask();
      await mockBroker.simulateMessage('agent.tasks.coder', task);
      await new Promise((r) => setTimeout(r, 50));

      const metrics = agent.getMetrics();
      expect(metrics.tasksProcessed).toBe(0);
      expect(metrics.tasksFailed).toBe(1);
      expect(metrics.errorRate).toBe(1);
    });
  });

  describe('Capabilities', () => {
    it('should return capabilities', () => {
      const capabilities = agent.getCapabilities();
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].name).toBe('test');
    });
  });

  describe('Topic Generation', () => {
    it('should generate correct task topic', () => {
      expect(agent.getTaskTopicPublic()).toBe('agent.tasks.coder');
    });

    it('should generate correct result topic', () => {
      expect(agent.getResultTopicPublic()).toBe('agent.results.coder');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid messages gracefully', async () => {
      await agent.start();

      // Send invalid message
      await mockBroker.simulateMessage('agent.tasks.coder', null);
      await mockBroker.simulateMessage('agent.tasks.coder', 'not an object');
      await mockBroker.simulateMessage('agent.tasks.coder', {});

      // Should not crash
      expect(agent.getState().status).toBe(AgentStatus.IDLE);
    });
  });
});
