/**
 * Agent Factory Tests
 */

import {
  AgentFactory,
  createAgentFactory,
  BaseAgent,
  type ILLMClient,
  type IMessageBroker,
  type IAgentLogger,
  type AgentDependencies,
  type LLMResponse,
  AGENT_TOKENS,
} from '../../../../src/core/agents';
import {
  AgentType,
  type IAgentConfig,
  type ITask,
  type TaskResult,
  type AgentCapability,
} from '../../../../src/core/interfaces';
import { Container } from '../../../../src/core/di';

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

// Test agent implementation
class TestAgent extends BaseAgent {
  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();
    return this.createSuccessResult(task, { processed: true }, startTime);
  }

  getCapabilities(): AgentCapability[] {
    return [{ name: 'test', description: 'Test capability' }];
  }
}

// Alternative test agent
class AlternativeAgent extends BaseAgent {
  async processTask(task: ITask): Promise<TaskResult> {
    const startTime = new Date();
    return this.createSuccessResult(task, { alternative: true }, startTime);
  }

  getCapabilities(): AgentCapability[] {
    return [{ name: 'alternative', description: 'Alternative capability' }];
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

describe('AgentFactory', () => {
  let factory: AgentFactory;
  let mockDependencies: AgentDependencies;

  beforeEach(() => {
    mockDependencies = {
      llmClient: createMockLLMClient(),
      messageBroker: createMockMessageBroker(),
      logger: createMockLogger(),
    };
    factory = new AgentFactory({
      defaultDependencies: mockDependencies,
    });
  });

  describe('Registration', () => {
    it('should register an agent class', () => {
      factory.registerAgentClass(AgentType.CODER, TestAgent);
      expect(factory.hasAgentType(AgentType.CODER)).toBe(true);
    });

    it('should throw when registering duplicate type', () => {
      factory.registerAgentClass(AgentType.CODER, TestAgent);
      expect(() => {
        factory.registerAgentClass(AgentType.CODER, AlternativeAgent);
      }).toThrow("Agent type 'coder' is already registered");
    });

    it('should unregister an agent class', () => {
      factory.registerAgentClass(AgentType.CODER, TestAgent);
      expect(factory.unregisterAgentClass(AgentType.CODER)).toBe(true);
      expect(factory.hasAgentType(AgentType.CODER)).toBe(false);
    });

    it('should return false when unregistering non-existent type', () => {
      expect(factory.unregisterAgentClass(AgentType.CODER)).toBe(false);
    });

    it('should get registered types', () => {
      factory.registerAgentClass(AgentType.CODER, TestAgent);
      factory.registerAgentClass(AgentType.REVIEWER, AlternativeAgent);

      const types = factory.getRegisteredTypes();
      expect(types).toContain(AgentType.CODER);
      expect(types).toContain(AgentType.REVIEWER);
      expect(types).toHaveLength(2);
    });
  });

  describe('Agent Creation', () => {
    beforeEach(() => {
      factory.registerAgentClass(AgentType.CODER, TestAgent);
    });

    it('should create an agent', () => {
      const config = createTestConfig();
      const agent = factory.createAgent(config);

      expect(agent).toBeInstanceOf(TestAgent);
      expect(agent.id).toBe(config.id);
      expect(agent.type).toBe(AgentType.CODER);
    });

    it('should throw for unregistered type', () => {
      const config = createTestConfig({ type: AgentType.REVIEWER });
      expect(() => factory.createAgent(config)).toThrow(
        "No agent class registered for type 'reviewer'"
      );
    });

    it('should create agent asynchronously', async () => {
      const config = createTestConfig();
      const agent = await factory.createAgentAsync(config);

      expect(agent).toBeInstanceOf(TestAgent);
      expect(agent.id).toBe(config.id);
    });
  });

  describe('Dependency Injection', () => {
    it('should resolve dependencies from container', () => {
      const container = new Container();
      const llmClient = createMockLLMClient();
      const messageBroker = createMockMessageBroker();
      const logger = createMockLogger();

      container.registerFactory(AGENT_TOKENS.LLM_CLIENT, () => llmClient);
      container.registerFactory(AGENT_TOKENS.MESSAGE_BROKER, () => messageBroker);
      container.registerFactory(AGENT_TOKENS.AGENT_LOGGER, () => logger);

      const containerFactory = new AgentFactory({ container });
      containerFactory.registerAgentClass(AgentType.CODER, TestAgent);

      const config = createTestConfig();
      const agent = containerFactory.createAgent(config);

      expect(agent).toBeInstanceOf(TestAgent);
    });

    it('should fall back to default dependencies', () => {
      const factoryWithDefaults = new AgentFactory({
        defaultDependencies: mockDependencies,
      });
      factoryWithDefaults.registerAgentClass(AgentType.CODER, TestAgent);

      const config = createTestConfig();
      const agent = factoryWithDefaults.createAgent(config);

      expect(agent).toBeInstanceOf(TestAgent);
    });

    it('should throw when no dependencies available', () => {
      const emptyFactory = new AgentFactory();
      emptyFactory.registerAgentClass(AgentType.CODER, TestAgent);

      const config = createTestConfig();
      expect(() => emptyFactory.createAgent(config)).toThrow(
        'LLM client not available'
      );
    });

    it('should resolve dependencies asynchronously from container', async () => {
      const container = new Container();
      const llmClient = createMockLLMClient();
      const messageBroker = createMockMessageBroker();
      const logger = createMockLogger();

      container.registerFactory(AGENT_TOKENS.LLM_CLIENT, () => llmClient);
      container.registerFactory(AGENT_TOKENS.MESSAGE_BROKER, () => messageBroker);
      container.registerFactory(AGENT_TOKENS.AGENT_LOGGER, () => logger);

      const containerFactory = new AgentFactory({ container });
      containerFactory.registerAgentClass(AgentType.CODER, TestAgent);

      const config = createTestConfig();
      const agent = await containerFactory.createAgentAsync(config);

      expect(agent).toBeInstanceOf(TestAgent);
    });
  });

  describe('Hooks', () => {
    beforeEach(() => {
      factory.registerAgentClass(AgentType.CODER, TestAgent);
    });

    it('should run pre-create hooks', () => {
      const hookFn = jest.fn();
      factory.addPreCreateHook(hookFn);

      const config = createTestConfig();
      factory.createAgent(config);

      expect(hookFn).toHaveBeenCalledWith(
        expect.objectContaining({
          config,
          dependencies: expect.any(Object),
        })
      );
    });

    it('should run post-create hooks', () => {
      const hookFn = jest.fn();
      factory.addPostCreateHook(hookFn);

      const config = createTestConfig();
      factory.createAgent(config);

      expect(hookFn).toHaveBeenCalledWith(
        expect.objectContaining({
          config,
          dependencies: expect.any(Object),
        })
      );
    });

    it('should throw for async hooks in sync createAgent', () => {
      const asyncHook = jest.fn().mockResolvedValue(undefined);
      factory.addPreCreateHook(asyncHook);

      const config = createTestConfig();
      expect(() => factory.createAgent(config)).toThrow(
        'Pre-create hooks must be synchronous'
      );
    });

    it('should support async hooks in createAgentAsync', async () => {
      const asyncPreHook = jest.fn().mockResolvedValue(undefined);
      const asyncPostHook = jest.fn().mockResolvedValue(undefined);

      factory.addPreCreateHook(asyncPreHook);
      factory.addPostCreateHook(asyncPostHook);

      const config = createTestConfig();
      const agent = await factory.createAgentAsync(config);

      expect(asyncPreHook).toHaveBeenCalled();
      expect(asyncPostHook).toHaveBeenCalled();
      expect(agent).toBeInstanceOf(TestAgent);
    });

    it('should remove pre-create hook', () => {
      const hookFn = jest.fn();
      factory.addPreCreateHook(hookFn);
      expect(factory.removePreCreateHook(hookFn)).toBe(true);

      const config = createTestConfig();
      factory.createAgent(config);

      expect(hookFn).not.toHaveBeenCalled();
    });

    it('should remove post-create hook', () => {
      const hookFn = jest.fn();
      factory.addPostCreateHook(hookFn);
      expect(factory.removePostCreateHook(hookFn)).toBe(true);

      const config = createTestConfig();
      factory.createAgent(config);

      expect(hookFn).not.toHaveBeenCalled();
    });

    it('should return false when removing non-existent hook', () => {
      const hookFn = jest.fn();
      expect(factory.removePreCreateHook(hookFn)).toBe(false);
      expect(factory.removePostCreateHook(hookFn)).toBe(false);
    });

    it('should run multiple hooks in order', () => {
      const order: number[] = [];
      factory.addPreCreateHook(() => { order.push(1); });
      factory.addPreCreateHook(() => { order.push(2); });
      factory.addPostCreateHook(() => { order.push(3); });
      factory.addPostCreateHook(() => { order.push(4); });

      const config = createTestConfig();
      factory.createAgent(config);

      expect(order).toEqual([1, 2, 3, 4]);
    });
  });

  describe('createAgentFactory helper', () => {
    it('should create a factory instance', () => {
      const helperFactory = createAgentFactory({
        defaultDependencies: mockDependencies,
      });

      expect(helperFactory).toBeInstanceOf(AgentFactory);
    });

    it('should work without options', () => {
      const helperFactory = createAgentFactory();
      expect(helperFactory).toBeInstanceOf(AgentFactory);
    });
  });
});
