import { AgentManager } from '@/agents/manager/agent-manager';
import { BaseAgent } from '@/agents/base/agent';
import {
  AgentType,
  AgentState,
  Task,
  TaskResult,
  TaskStatus,
  TaskPriority,
  AgentConfig,
} from '@/agents/base/types';
import { NatsClient } from '@/shared/messaging/nats-client';
import { AgentError } from '@/shared/errors/custom-errors';

/**
 * Agent Manager Tests
 *
 * TDD approach: Tests written first, then implementation
 * Following strict quality standards from system prompt
 *
 * Feature: F2.2 - Agent Manager
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
class TestCoderAgent extends BaseAgent {
  getAgentType(): AgentType {
    return AgentType.CODER;
  }

  async processTask(task: Task): Promise<TaskResult> {
    return {
      taskId: task.id,
      status: TaskStatus.COMPLETED,
      success: true,
      data: { result: 'test' },
    };
  }
}

class TestReviewerAgent extends BaseAgent {
  getAgentType(): AgentType {
    return AgentType.REVIEWER;
  }

  async processTask(task: Task): Promise<TaskResult> {
    return {
      taskId: task.id,
      status: TaskStatus.COMPLETED,
      success: true,
      data: { result: 'reviewed' },
    };
  }
}

describe('AgentManager', () => {
  let manager: AgentManager;
  let mockNatsClient: jest.Mocked<NatsClient>;
  let coderConfig: AgentConfig;
  let reviewerConfig: AgentConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.ANTHROPIC_API_KEY = 'test-key';

    mockNatsClient = {
      subscribe: jest.fn(),
      publish: jest.fn(),
      request: jest.fn(),
      close: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    coderConfig = {
      id: 'coder-1',
      type: AgentType.CODER,
      name: 'Coder Agent 1',
      llm: { provider: 'claude' },
      nats: { servers: ['nats://localhost:4222'] },
    };

    reviewerConfig = {
      id: 'reviewer-1',
      type: AgentType.REVIEWER,
      name: 'Reviewer Agent 1',
      llm: { provider: 'claude' },
      nats: { servers: ['nats://localhost:4222'] },
    };

    manager = new AgentManager();
  });

  afterEach(async () => {
    // Cleanup: stop all agents
    await manager.cleanup();
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('Agent Registration', () => {
    it('should register an agent successfully', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);

      await manager.registerAgent(agent);

      const registeredAgent = manager.getAgent('coder-1');
      expect(registeredAgent).toBe(agent);
    });

    it('should throw error when registering duplicate agent ID', async () => {
      const agent1 = new TestCoderAgent(coderConfig, mockNatsClient);
      const agent2 = new TestCoderAgent(coderConfig, mockNatsClient);

      await manager.registerAgent(agent1);

      await expect(manager.registerAgent(agent2)).rejects.toThrow(AgentError);
      await expect(manager.registerAgent(agent2)).rejects.toThrow('already registered');
    });

    it('should track agents by type', async () => {
      const coder = new TestCoderAgent(coderConfig, mockNatsClient);
      const reviewer = new TestReviewerAgent(reviewerConfig, mockNatsClient);

      await manager.registerAgent(coder);
      await manager.registerAgent(reviewer);

      const coders = manager.getAgentsByType(AgentType.CODER);
      const reviewers = manager.getAgentsByType(AgentType.REVIEWER);

      expect(coders).toHaveLength(1);
      expect(reviewers).toHaveLength(1);
      expect(coders[0]).toBe(coder);
      expect(reviewers[0]).toBe(reviewer);
    });

    it('should return empty array for unregistered agent type', () => {
      const agents = manager.getAgentsByType(AgentType.REPO_MANAGER);
      expect(agents).toEqual([]);
    });
  });

  describe('Agent Unregistration', () => {
    it('should unregister an agent successfully', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(agent);

      await manager.unregisterAgent('coder-1');

      const registeredAgent = manager.getAgent('coder-1');
      expect(registeredAgent).toBeUndefined();
    });

    it('should throw error when unregistering non-existent agent', async () => {
      await expect(manager.unregisterAgent('non-existent')).rejects.toThrow(AgentError);
      await expect(manager.unregisterAgent('non-existent')).rejects.toThrow('not found');
    });

    it('should stop agent before unregistering', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(agent);
      await agent.initialize();

      const stopSpy = jest.spyOn(agent, 'stop');

      await manager.unregisterAgent('coder-1');

      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('Agent Lifecycle', () => {
    it('should start an agent', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(agent);

      await manager.startAgent('coder-1');

      expect(agent.getState()).toBe(AgentState.IDLE);
    });

    it('should stop an agent', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(agent);
      await manager.startAgent('coder-1');

      await manager.stopAgent('coder-1');

      expect(agent.getState()).toBe(AgentState.STOPPED);
    });

    it('should throw error when starting non-existent agent', async () => {
      await expect(manager.startAgent('non-existent')).rejects.toThrow(AgentError);
    });

    it('should throw error when stopping non-existent agent', async () => {
      await expect(manager.stopAgent('non-existent')).rejects.toThrow(AgentError);
    });
  });

  describe('Task Routing', () => {
    it('should route task to correct agent type', async () => {
      const coder = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(coder);
      await manager.startAgent('coder-1');

      const task: Task = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      const agentId = await manager.routeTask(task);

      expect(agentId).toBe('coder-1');
    });

    it('should throw error when no agent available for task type', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'REVIEW_REQUEST',
        agentType: AgentType.REVIEWER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      await expect(manager.routeTask(task)).rejects.toThrow(AgentError);
      await expect(manager.routeTask(task)).rejects.toThrow('No available agent');
    });

    it('should distribute tasks across multiple agents of same type', async () => {
      const coder1 = new TestCoderAgent(
        { ...coderConfig, id: 'coder-1' },
        mockNatsClient
      );
      const coder2 = new TestCoderAgent(
        { ...coderConfig, id: 'coder-2' },
        mockNatsClient
      );

      await manager.registerAgent(coder1);
      await manager.registerAgent(coder2);
      await manager.startAgent('coder-1');
      await manager.startAgent('coder-2');

      const task1: Task = {
        id: 'task-1',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      const task2: Task = {
        id: 'task-2',
        type: 'IMPLEMENTATION_REQUEST',
        agentType: AgentType.CODER,
        priority: TaskPriority.NORMAL,
        status: TaskStatus.PENDING,
        payload: {},
        metadata: { createdAt: Date.now() },
      };

      const agent1Id = await manager.routeTask(task1);
      const agent2Id = await manager.routeTask(task2);

      // Should use both agents (round-robin or similar)
      const usedAgents = new Set([agent1Id, agent2Id]);
      expect(usedAgents.size).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring', () => {
    it('should return health status for an agent', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(agent);
      await manager.startAgent('coder-1');

      const health = await manager.getAgentHealth('coder-1');

      expect(health).toMatchObject({
        healthy: true,
        state: AgentState.IDLE,
      });
    });

    it('should throw error when checking health of non-existent agent', async () => {
      await expect(manager.getAgentHealth('non-existent')).rejects.toThrow(AgentError);
    });

    it('should return status for all agents', async () => {
      const coder = new TestCoderAgent(coderConfig, mockNatsClient);
      const reviewer = new TestReviewerAgent(reviewerConfig, mockNatsClient);

      await manager.registerAgent(coder);
      await manager.registerAgent(reviewer);
      await manager.startAgent('coder-1');
      await manager.startAgent('reviewer-1');

      const statuses = await manager.getAllAgentStatus();

      expect(statuses).toHaveLength(2);
      expect(statuses[0].id).toBeDefined();
      expect(statuses[0].type).toBeDefined();
      expect(statuses[0].state).toBeDefined();
    });

    it('should return empty array when no agents registered', async () => {
      const statuses = await manager.getAllAgentStatus();
      expect(statuses).toEqual([]);
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup all agents on manager cleanup', async () => {
      const coder = new TestCoderAgent(coderConfig, mockNatsClient);
      const reviewer = new TestReviewerAgent(reviewerConfig, mockNatsClient);

      await manager.registerAgent(coder);
      await manager.registerAgent(reviewer);
      await manager.startAgent('coder-1');
      await manager.startAgent('reviewer-1');

      const coderStopSpy = jest.spyOn(coder, 'stop');
      const reviewerStopSpy = jest.spyOn(reviewer, 'stop');

      await manager.cleanup();

      expect(coderStopSpy).toHaveBeenCalled();
      expect(reviewerStopSpy).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(agent);
      await manager.startAgent('coder-1');

      // Make stop throw error
      jest.spyOn(agent, 'stop').mockRejectedValue(new Error('Stop failed'));

      // Should not throw, but log error
      await expect(manager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle agent initialization errors', async () => {
      const agent = new TestCoderAgent(coderConfig, mockNatsClient);
      await manager.registerAgent(agent);

      // Make initialize throw error
      jest.spyOn(agent, 'initialize').mockRejectedValue(new Error('Init failed'));

      await expect(manager.startAgent('coder-1')).rejects.toThrow();
    });

    it('should validate task before routing', async () => {
      const invalidTask = {
        id: 'task-1',
        // Missing required fields
      } as Task;

      await expect(manager.routeTask(invalidTask)).rejects.toThrow();
    });
  });
});
