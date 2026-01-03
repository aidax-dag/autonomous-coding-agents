/**
 * Coder Agent Tests
 */

import {
  CoderAgent,
  createCoderAgent,
} from '../../../../src/core/agents/specialized/coder-agent';
import {
  AgentType,
  AgentStatus,
  TaskPriority,
  TaskResultStatus,
  type ITask,
} from '../../../../src/core/interfaces';
import type {
  AgentDependencies,
  ILLMClient,
  IMessageBroker,
  IAgentLogger,
  LLMMessage,
  LLMResponse,
} from '../../../../src/core/agents/interfaces';

// Mock dependencies
const createMockLLMClient = (): ILLMClient => ({
  complete: jest.fn().mockResolvedValue({
    content: JSON.stringify({
      files: [
        {
          path: 'src/feature.ts',
          content: 'export function feature() { return true; }',
          action: 'create',
        },
      ],
      summary: 'Created feature function',
    }),
    usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    stopReason: 'end',
  } as LLMResponse),
  stream: jest.fn(),
  getProvider: jest.fn().mockReturnValue('mock'),
  getModel: jest.fn().mockReturnValue('mock-model'),
});

const createMockMessageBroker = (): IMessageBroker => ({
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  unsubscribe: jest.fn().mockResolvedValue(undefined),
  request: jest.fn().mockResolvedValue({}),
  isConnected: jest.fn().mockReturnValue(true),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
});

const createMockLogger = (): IAgentLogger => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  child: jest.fn().mockReturnThis(),
});

const createMockDependencies = (): AgentDependencies => ({
  llmClient: createMockLLMClient(),
  messageBroker: createMockMessageBroker(),
  logger: createMockLogger(),
});

const createValidImplementationTask = (): ITask => ({
  id: 'task-1',
  type: 'implementation',
  agentType: AgentType.CODER,
  priority: TaskPriority.NORMAL,
  payload: {
    repository: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    feature: {
      title: 'Add new feature',
      description: 'Implement a new feature for testing',
      requirements: ['Create a function', 'Export the function', 'Add types'],
    },
  },
  createdAt: new Date(),
});

describe('CoderAgent', () => {
  let agent: CoderAgent;
  let dependencies: AgentDependencies;

  beforeEach(() => {
    dependencies = createMockDependencies();
    agent = new CoderAgent(
      {
        id: 'coder-1',
        type: AgentType.CODER,
        name: 'Test Coder Agent',
        version: '1.0.0',
        llm: { provider: 'claude', model: 'claude-3' },
      },
      dependencies
    );
  });

  describe('Constructor', () => {
    it('should create instance with correct identification', () => {
      expect(agent.id).toBe('coder-1');
      expect(agent.type).toBe(AgentType.CODER);
      expect(agent.name).toBe('Test Coder Agent');
      expect(agent.version).toBe('1.0.0');
    });

    it('should use default workDir when not specified', () => {
      // Default should be /tmp/coder-agent or WORK_DIR env
      const state = agent.getState();
      expect(state.status).toBe(AgentStatus.STOPPED);
    });

    it('should use custom workDir when specified', () => {
      const customAgent = new CoderAgent(
        {
          id: 'coder-2',
          type: AgentType.CODER,
          name: 'Custom Coder',
          llm: { provider: 'claude', model: 'claude-3' },
          workDir: '/custom/work/dir',
        },
        dependencies
      );
      expect(customAgent.id).toBe('coder-2');
    });

    it('should accept custom retry configuration', () => {
      const customAgent = new CoderAgent(
        {
          id: 'coder-3',
          type: AgentType.CODER,
          name: 'Retry Coder',
          llm: { provider: 'claude', model: 'claude-3' },
          maxRetries: 5,
          baseRetryDelay: 2000,
        },
        dependencies
      );
      expect(customAgent.id).toBe('coder-3');
    });
  });

  describe('getCapabilities', () => {
    it('should return coder capabilities', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toHaveLength(3);
      expect(capabilities.map((c) => c.name)).toContain('code-generation');
      expect(capabilities.map((c) => c.name)).toContain('code-modification');
      expect(capabilities.map((c) => c.name)).toContain('syntax-validation');
    });

    it('should have code-generation capability with schema', () => {
      const capabilities = agent.getCapabilities();
      const codeGen = capabilities.find((c) => c.name === 'code-generation');

      expect(codeGen).toBeDefined();
      expect(codeGen!.description).toContain('Generate TypeScript');
      expect(codeGen!.inputSchema).toBeDefined();
      expect(codeGen!.outputSchema).toBeDefined();
    });
  });

  describe('canHandle', () => {
    it('should handle tasks with matching agent type', () => {
      const task = createValidImplementationTask();
      expect(agent.canHandle(task)).toBe(true);
    });

    it('should not handle tasks with different agent type', () => {
      const task: ITask = {
        ...createValidImplementationTask(),
        agentType: AgentType.REVIEWER,
      };
      expect(agent.canHandle(task)).toBe(false);
    });
  });

  describe('processTask', () => {
    it('should process valid implementation task successfully', async () => {
      const task = createValidImplementationTask();

      const result = await agent.processTask(task);

      expect(result.taskId).toBe(task.id);
      expect(result.success).toBe(true);
      expect(result.status).toBe(TaskResultStatus.COMPLETED);
      expect(result.data).toBeDefined();
      expect(result.data!.generatedFiles).toBeDefined();
    });

    it('should include metadata in result', async () => {
      const task = createValidImplementationTask();

      const result = await agent.processTask(task);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.agentId).toBe('coder-1');
      expect(result.metadata.agentType).toBe(AgentType.CODER);
      expect(result.metadata.startedAt).toBeInstanceOf(Date);
      expect(result.metadata.completedAt).toBeInstanceOf(Date);
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
    });

    it('should call LLM client with correct prompt', async () => {
      const task = createValidImplementationTask();

      await agent.processTask(task);

      expect(dependencies.llmClient.complete).toHaveBeenCalled();
      const callArgs = (dependencies.llmClient.complete as jest.Mock).mock.calls[0];
      const messages = callArgs[0] as LLMMessage[];

      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(messages[1].content).toContain('Add new feature');
    });

    it('should fail on invalid payload', async () => {
      const task: ITask = {
        id: 'task-invalid',
        type: 'implementation',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        payload: {
          // Missing required fields
          invalidField: 'test',
        },
        createdAt: new Date(),
      };

      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe(TaskResultStatus.FAILED);
      expect(result.error).toBeDefined();
    });

    it('should fail when LLM returns invalid JSON', async () => {
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: 'not valid json',
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });

      const task = createValidImplementationTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe(TaskResultStatus.FAILED);
    });

    it('should fail when LLM returns non-conforming JSON', async () => {
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({ wrongField: 'wrong' }),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });

      const task = createValidImplementationTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(false);
      expect(result.status).toBe(TaskResultStatus.FAILED);
    });

    it('should validate generated TypeScript syntax', async () => {
      // LLM returns valid TypeScript
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          files: [
            {
              path: 'src/valid.ts',
              content: 'export function test() { return 42; }',
              action: 'create',
            },
          ],
          summary: 'Valid code',
        }),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });

      const task = createValidImplementationTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true);
      expect((result.data!.validationResults as { syntaxCheck: boolean }).syntaxCheck).toBe(true);
    });

    it('should detect unbalanced braces', async () => {
      // LLM returns code with unbalanced braces
      (dependencies.llmClient.complete as jest.Mock).mockResolvedValueOnce({
        content: JSON.stringify({
          files: [
            {
              path: 'src/invalid.ts',
              content: 'export function test() { return 42; ', // missing closing brace
              action: 'create',
            },
          ],
          summary: 'Invalid code',
        }),
        usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
        stopReason: 'end',
      });

      const task = createValidImplementationTask();
      const result = await agent.processTask(task);

      expect(result.success).toBe(true); // Task succeeds but validation reports errors
      const validation = result.data!.validationResults as {
        syntaxCheck: boolean;
        errors: string[];
      };
      expect(validation.syntaxCheck).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should log task processing', async () => {
      const task = createValidImplementationTask();
      await agent.processTask(task);

      expect(dependencies.logger.info).toHaveBeenCalledWith(
        'Processing implementation request',
        expect.objectContaining({ taskId: task.id })
      );
    });
  });

  describe('Lifecycle', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      const state = agent.getState();
      expect(state.status).toBe(AgentStatus.IDLE);
    });

    it('should start after initialization', async () => {
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

    it('should stop gracefully', async () => {
      await agent.start();
      await agent.stop();
      expect(agent.getState().status).toBe(AgentStatus.STOPPED);
    });

    it('should dispose resources', async () => {
      await agent.start();
      await agent.dispose();

      // Agent should throw when used after disposal
      expect(() => agent.getState()).toThrow('Agent has been disposed');
    });
  });

  describe('Health & Metrics', () => {
    it('should report health status', async () => {
      await agent.start();
      const health = agent.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe(AgentStatus.IDLE);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should have initial metrics at zero', async () => {
      await agent.start();
      const metrics = agent.getMetrics();

      expect(metrics.tasksProcessed).toBe(0);
      expect(metrics.tasksFailed).toBe(0);
      expect(metrics.totalTokensUsed).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should track token usage when updated manually', async () => {
      // Note: Direct processTask calls update token usage via updateTokenUsage
      // but don't increment task counters (those are tracked by executeTask in BaseAgent)
      await agent.start();
      const task = createValidImplementationTask();
      await agent.processTask(task);

      const metrics = agent.getMetrics();
      // Token usage is updated via updateTokenUsage in generateCode
      expect(metrics.totalTokensUsed).toBe(300);
    });

    it('should calculate error rate', () => {
      const metrics = agent.getMetrics();
      // Initial state: no tasks = 0 error rate
      expect(metrics.errorRate).toBe(0);
    });
  });

  describe('createCoderAgent helper', () => {
    it('should create agent with CODER type', () => {
      const createdAgent = createCoderAgent(
        {
          id: 'helper-coder',
          name: 'Helper Created Coder',
          llm: { provider: 'claude', model: 'claude-3' },
        },
        dependencies
      );

      expect(createdAgent).toBeInstanceOf(CoderAgent);
      expect(createdAgent.type).toBe(AgentType.CODER);
    });
  });
});
