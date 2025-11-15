import { BaseAgent } from '@/agents/base/agent';
import {
  AgentConfig,
  AgentType,
  AgentState,
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { AgentError, ErrorCode } from '@/shared/errors/custom-errors';

/**
 * Base Agent Tests
 *
 * Tests base agent functionality including lifecycle, message handling,
 * and state management.
 *
 * Feature: F2.1 - Base Agent Class
 */

// Mock NatsClient
jest.mock('@/shared/messaging/nats-client');

// Mock LLM client creation
jest.mock('@/shared/llm', () => ({
  createLLMClient: jest.fn().mockReturnValue({
    getProvider: () => 'claude',
    chat: jest.fn(),
  }),
}));

// Test agent implementation
class TestAgent extends BaseAgent {
  getAgentType(): AgentType {
    return AgentType.CODER;
  }

  async processTask(task: Task): Promise<TaskResult> {
    // Simple test implementation
    return {
      taskId: task.id,
      status: TaskStatus.COMPLETED,
      success: true,
      data: { result: 'test' },
    };
  }
}

// Failing test agent
class FailingAgent extends BaseAgent {
  getAgentType(): AgentType {
    return AgentType.CODER;
  }

  async processTask(_task: Task): Promise<TaskResult> {
    throw new AgentError('Task processing failed', ErrorCode.IMPLEMENTATION_FAILED, false);
  }
}

describe('BaseAgent', () => {
  let mockNatsClient: jest.Mocked<NatsClient>;
  let config: AgentConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set required environment variables
    process.env.ANTHROPIC_API_KEY = 'test-key';

    mockNatsClient = {
      subscribe: jest.fn(),
      publish: jest.fn(),
      request: jest.fn(),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    config = {
      id: 'test-agent-1',
      type: AgentType.CODER,
      name: 'Test Agent',
      description: 'Test agent for unit tests',
      llm: {
        provider: 'claude',
        model: 'claude-3-5-sonnet-20241022',
      },
      nats: {
        servers: ['nats://localhost:4222'],
      },
      maxConcurrentTasks: 1,
      retryAttempts: 3,
      timeout: 30000,
    };
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('Constructor', () => {
    it('should create agent with valid config', () => {
      const agent = new TestAgent(config, mockNatsClient);

      expect(agent).toBeInstanceOf(BaseAgent);
      expect(agent.getId()).toBe('test-agent-1');
      expect(agent.getAgentType()).toBe(AgentType.CODER);
      expect(agent.getState()).toBe(AgentState.IDLE);
    });

    it('should throw error when LLM API key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => new TestAgent(config, mockNatsClient)).toThrow(AgentError);
      expect(() => new TestAgent(config, mockNatsClient)).toThrow('Missing API key');
    });
  });

  describe('Initialization', () => {
    it('should initialize agent successfully', async () => {
      const agent = new TestAgent(config, mockNatsClient);

      await agent.initialize();

      expect(mockNatsClient.subscribe).toHaveBeenCalledWith(
        'agent.tasks.coder',
        expect.any(Function)
      );
      expect(agent.getState()).toBe(AgentState.IDLE);
      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.events',
        expect.objectContaining({
          type: 'AGENT_STARTED',
          agentId: 'test-agent-1',
        })
      );
    });

    it('should set state to INITIALIZING during init', async () => {
      const agent = new TestAgent(config, mockNatsClient);

      let stateduringInit: AgentState | undefined;

      mockNatsClient.subscribe.mockImplementation(async () => {
        stateduringInit = agent.getState();
      });

      await agent.initialize();

      expect(stateduringInit).toBe(AgentState.INITIALIZING);
      expect(agent.getState()).toBe(AgentState.IDLE);
    });

    it('should handle initialization errors', async () => {
      const agent = new TestAgent(config, mockNatsClient);

      mockNatsClient.subscribe.mockRejectedValue(new Error('Connection failed'));

      await expect(agent.initialize()).rejects.toThrow(AgentError);
      await expect(agent.initialize()).rejects.toThrow('Agent initialization failed');
      expect(agent.getState()).toBe(AgentState.ERROR);
    });
  });

  describe('Start and Stop', () => {
    it('should start agent', async () => {
      const agent = new TestAgent(config, mockNatsClient);

      await agent.start();

      expect(agent.getState()).toBe(AgentState.IDLE);
      expect(mockNatsClient.subscribe).toHaveBeenCalled();
    });

    it('should stop agent', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      await agent.stop();

      expect(agent.getState()).toBe(AgentState.STOPPED);
      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.events',
        expect.objectContaining({
          type: 'AGENT_STOPPED',
        })
      );
    });

    it('should clear task queue when stopped', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      // Add tasks to queue
      (agent as any).taskQueue = [
        { id: 'task-1', type: 'TEST', agentType: AgentType.CODER },
        { id: 'task-2', type: 'TEST', agentType: AgentType.CODER },
      ];

      await agent.stop();

      expect((agent as any).taskQueue).toHaveLength(0);
    });
  });

  describe('Message Handling', () => {
    it('should handle valid task message', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: { test: 'data' },
        metadata: {
          createdAt: Date.now(),
        },
      };

      await agent.handleMessage(task);

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.results.coder',
        expect.objectContaining({
          taskId: 'task-1',
          status: TaskStatus.COMPLETED,
          success: true,
        })
      );
    });

    it('should queue tasks when busy', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      // Set agent to working state
      (agent as any).state = AgentState.WORKING;

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      expect((agent as any).taskQueue).toHaveLength(1);
      expect((agent as any).taskQueue[0].id).toBe('task-1');
    });

    it('should reject task with wrong agent type', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.REVIEWER, // Wrong type!
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      // Should publish error event
      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.events',
        expect.objectContaining({
          type: 'AGENT_ERROR',
        })
      );
    });

    it('should reject invalid message format', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      await agent.handleMessage({ invalid: 'message' });

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.events',
        expect.objectContaining({
          type: 'AGENT_ERROR',
        })
      );
    });
  });

  describe('Task Execution', () => {
    it('should execute task successfully', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.results.coder',
        expect.objectContaining({
          taskId: 'task-1',
          success: true,
          metadata: expect.objectContaining({
            agentId: 'test-agent-1',
            completedAt: expect.any(Number),
            duration: expect.any(Number),
          }),
        })
      );
    });

    it('should handle task failure', async () => {
      const agent = new FailingAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.results.coder',
        expect.objectContaining({
          taskId: 'task-1',
          status: TaskStatus.FAILED,
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.IMPLEMENTATION_FAILED,
            message: expect.stringContaining('Task processing failed'),
          }),
        })
      );
    });

    it('should process queued tasks after current task completes', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      // Override processTask to add delay
      const originalProcessTask = agent.processTask.bind(agent);
      let processCount = 0;

      agent.processTask = jest.fn().mockImplementation(async (task: Task) => {
        processCount++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return originalProcessTask(task);
      });

      const task1: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      const task2: Task = {
        id: 'task-2',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      // Send both tasks
      await agent.handleMessage(task1);
      await agent.handleMessage(task2);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(processCount).toBe(2);
      expect((agent as any).taskQueue).toHaveLength(0);
    });
  });

  describe('Health and Metrics', () => {
    it('should return health status', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const health = agent.getHealth();

      expect(health).toMatchObject({
        healthy: true,
        state: AgentState.IDLE,
        uptime: expect.any(Number),
        tasksProcessed: 0,
        tasksFailed: 0,
        details: {
          queueSize: 0,
        },
      });
    });

    it('should track task metrics', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      const health = agent.getHealth();

      expect(health.tasksProcessed).toBe(1);
      expect(health.tasksFailed).toBe(0);
      expect(health.lastTaskCompletedAt).toBeDefined();
      expect(health.averageTaskDuration).toBeGreaterThan(0);
    });

    it('should calculate error rate', async () => {
      const agent = new FailingAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      const health = agent.getHealth();

      expect(health.tasksFailed).toBe(1);
      expect(health.errorRate).toBe(100);
    });

    it('should report unhealthy when in ERROR state', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      (agent as any).state = AgentState.ERROR;

      const health = agent.getHealth();

      expect(health.healthy).toBe(false);
      expect(health.state).toBe(AgentState.ERROR);
    });
  });

  describe('Event Publishing', () => {
    it('should publish TASK_STARTED event', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.events',
        expect.objectContaining({
          type: 'TASK_STARTED',
          agentId: 'test-agent-1',
          data: expect.objectContaining({
            taskId: 'task-1',
          }),
        })
      );
    });

    it('should publish TASK_COMPLETED event', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.events',
        expect.objectContaining({
          type: 'TASK_COMPLETED',
          agentId: 'test-agent-1',
        })
      );
    });

    it('should publish TASK_FAILED event on error', async () => {
      const agent = new FailingAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.events',
        expect.objectContaining({
          type: 'TASK_FAILED',
          agentId: 'test-agent-1',
        })
      );
    });
  });

  describe('Configuration', () => {
    it('should return agent config', () => {
      const agent = new TestAgent(config, mockNatsClient);

      const agentConfig = agent.getConfig();

      expect(agentConfig).toEqual(config);
    });

    it('should use correct task topic', async () => {
      const agent = new TestAgent(config, mockNatsClient);

      await agent.initialize();

      expect(mockNatsClient.subscribe).toHaveBeenCalledWith(
        'agent.tasks.coder',
        expect.any(Function)
      );
    });

    it('should use correct result topic', async () => {
      const agent = new TestAgent(config, mockNatsClient);
      await agent.initialize();

      const task: Task = {
        id: 'task-1',
        type: 'TEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await agent.handleMessage(task);

      expect(mockNatsClient.publish).toHaveBeenCalledWith(
        'agent.results.coder',
        expect.anything()
      );
    });
  });
});
