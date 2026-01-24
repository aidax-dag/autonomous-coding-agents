/**
 * Agents Service Tests
 *
 * Tests for the Agents API service layer.
 */

import { AgentType, AgentStatus } from '@/core/interfaces/agent.interface';
import { AgentsService, CreateAgentData, TaskSubmission } from '@/api/services/agents.service';

// Mock logger
jest.mock('@/core/services/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock crypto.randomUUID
let uuidCounter = 1;
Object.defineProperty(global.crypto, 'randomUUID', {
  value: jest.fn(() => `test-uuid-${uuidCounter++}`),
  writable: true,
});

describe('AgentsService', () => {
  let service: AgentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    uuidCounter = 1;
    service = new AgentsService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createAgent', () => {
    it('should create an agent with default values', async () => {
      const data: CreateAgentData = {
        type: AgentType.CODER,
        name: 'Test Agent',
      };

      const agent = await service.createAgent(data);

      expect(agent.id).toBe('test-uuid-1');
      expect(agent.type).toBe(AgentType.CODER);
      expect(agent.name).toBe('Test Agent');
      expect(agent.status).toBe(AgentStatus.INITIALIZING);
      expect(agent.version).toBe('1.0.0');
      expect(agent.config.maxConcurrentTasks).toBe(1);
      expect(agent.config.taskTimeout).toBe(60000);
      expect(agent.config.retryAttempts).toBe(3);
      expect(agent.metrics.tasksProcessed).toBe(0);
      expect(agent.health.healthy).toBe(true);
    });

    it('should create an agent with custom LLM config', async () => {
      const data: CreateAgentData = {
        type: AgentType.CODER,
        name: 'Test Agent',
        llm: {
          provider: 'claude',
          model: 'claude-3-opus',
          temperature: 0.5,
          maxTokens: 4096,
        },
      };

      const agent = await service.createAgent(data);

      expect(agent.config.llm).toEqual({
        provider: 'claude',
        model: 'claude-3-opus',
        temperature: 0.5,
        maxTokens: 4096,
      });
    });

    it('should create an agent with custom settings', async () => {
      const data: CreateAgentData = {
        type: AgentType.REVIEWER,
        name: 'Custom Agent',
        description: 'A custom test agent',
        maxConcurrentTasks: 5,
        taskTimeout: 120000,
        retryAttempts: 5,
        capabilities: ['code-review', 'testing'],
      };

      const agent = await service.createAgent(data);

      expect(agent.description).toBe('A custom test agent');
      expect(agent.config.maxConcurrentTasks).toBe(5);
      expect(agent.config.taskTimeout).toBe(120000);
      expect(agent.config.retryAttempts).toBe(5);
      expect(agent.capabilities).toEqual(['code-review', 'testing']);
    });

    it('should transition to IDLE status after initialization', async () => {
      const data: CreateAgentData = {
        type: AgentType.CODER,
        name: 'Test Agent',
      };

      const agent = await service.createAgent(data);
      expect(agent.status).toBe(AgentStatus.INITIALIZING);

      // Advance timers to trigger the setTimeout
      jest.advanceTimersByTime(100);

      const retrievedAgent = await service.getAgent(agent.id);
      expect(retrievedAgent?.status).toBe(AgentStatus.IDLE);
    });
  });

  describe('getAgent', () => {
    it('should return agent by ID', async () => {
      const data: CreateAgentData = {
        type: AgentType.CODER,
        name: 'Test Agent',
      };

      const created = await service.createAgent(data);
      const retrieved = await service.getAgent(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.getAgent('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('listAgents', () => {
    beforeEach(async () => {
      // Create multiple agents for testing
      await service.createAgent({ type: AgentType.CODER, name: 'Coder Agent 1' });
      await service.createAgent({ type: AgentType.CODER, name: 'Coder Agent 2' });
      await service.createAgent({ type: AgentType.REVIEWER, name: 'Reviewer Agent' });
      await service.createAgent({ type: AgentType.TESTER, name: 'Tester Agent' });

      // Transition some agents to different statuses
      jest.advanceTimersByTime(100);
    });

    it('should list all agents without filters', async () => {
      const result = await service.listAgents();

      expect(result.agents).toHaveLength(4);
      expect(result.total).toBe(4);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter agents by type', async () => {
      const result = await service.listAgents({ type: AgentType.CODER });

      expect(result.agents).toHaveLength(2);
      expect(result.agents.every((a) => a.type === AgentType.CODER)).toBe(true);
    });

    it('should filter agents by status', async () => {
      const result = await service.listAgents({ status: AgentStatus.IDLE });

      expect(result.agents).toHaveLength(4);
    });

    it('should filter agents by name (case-insensitive)', async () => {
      const result = await service.listAgents({ name: 'coder' });

      expect(result.agents).toHaveLength(2);
      expect(result.agents.every((a) => a.name.toLowerCase().includes('coder'))).toBe(true);
    });

    it('should handle pagination', async () => {
      const page1 = await service.listAgents({ page: 1, limit: 2 });
      const page2 = await service.listAgents({ page: 2, limit: 2 });

      expect(page1.agents).toHaveLength(2);
      expect(page1.total).toBe(4);
      expect(page2.agents).toHaveLength(2);
      expect(page2.total).toBe(4);
    });

    it('should sort agents', async () => {
      const resultAsc = await service.listAgents({ sortBy: 'name', sortOrder: 'asc' });
      const resultDesc = await service.listAgents({ sortBy: 'name', sortOrder: 'desc' });

      expect(resultAsc.agents[0].name).toBe('Coder Agent 1');
      expect(resultDesc.agents[0].name).toBe('Tester Agent');
    });

    it('should combine filters', async () => {
      const result = await service.listAgents({
        type: AgentType.CODER,
        name: '1',
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('Coder Agent 1');
    });
  });

  describe('updateAgent', () => {
    let agentId: string;

    beforeEach(async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
        llm: {
          provider: 'claude',
          model: 'claude-3-opus',
        },
      });
      agentId = agent.id;
    });

    it('should update agent name', async () => {
      const updated = await service.updateAgent(agentId, { name: 'Updated Agent' });

      expect(updated?.name).toBe('Updated Agent');
    });

    it('should update agent description', async () => {
      const updated = await service.updateAgent(agentId, { description: 'New description' });

      expect(updated?.description).toBe('New description');
    });

    it('should update LLM config', async () => {
      const updated = await service.updateAgent(agentId, {
        llm: { temperature: 0.8 },
      });

      expect((updated?.config.llm as Record<string, unknown>)?.temperature).toBe(0.8);
    });

    it('should update task config', async () => {
      const updated = await service.updateAgent(agentId, {
        maxConcurrentTasks: 10,
        taskTimeout: 300000,
        retryAttempts: 10,
      });

      expect(updated?.config.maxConcurrentTasks).toBe(10);
      expect(updated?.config.taskTimeout).toBe(300000);
      expect(updated?.config.retryAttempts).toBe(10);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.updateAgent('non-existent-id', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should preserve unchanged fields', async () => {
      const original = await service.getAgent(agentId);
      await service.updateAgent(agentId, { name: 'Updated' });
      const updated = await service.getAgent(agentId);

      expect(updated?.type).toBe(original?.type);
      expect(updated?.config.taskTimeout).toBe(original?.config.taskTimeout);
    });
  });

  describe('deleteAgent', () => {
    it('should delete an existing agent', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });

      const result = await service.deleteAgent(agent.id);
      expect(result).toBe(true);

      const retrieved = await service.getAgent(agent.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent agent', async () => {
      const result = await service.deleteAgent('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('startAgent', () => {
    it('should start an agent', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);

      const started = await service.startAgent(agent.id);

      expect(started?.status).toBe(AgentStatus.PROCESSING);
      expect(started?.health.status).toBe(AgentStatus.PROCESSING);
      expect(started?.health.healthy).toBe(true);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.startAgent('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return current state if already processing', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);

      await service.startAgent(agent.id);
      const started = await service.startAgent(agent.id);

      expect(started?.status).toBe(AgentStatus.PROCESSING);
    });
  });

  describe('stopAgent', () => {
    it('should stop an agent', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);
      await service.startAgent(agent.id);

      const stopped = await service.stopAgent(agent.id);

      expect(stopped?.status).toBe(AgentStatus.STOPPED);
      expect(stopped?.health.status).toBe(AgentStatus.STOPPED);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.stopAgent('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('pauseAgent', () => {
    it('should pause an agent', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);
      await service.startAgent(agent.id);

      const paused = await service.pauseAgent(agent.id);

      expect(paused?.status).toBe(AgentStatus.PAUSED);
      expect(paused?.health.status).toBe(AgentStatus.PAUSED);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.pauseAgent('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('resumeAgent', () => {
    it('should resume a paused agent', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);
      await service.startAgent(agent.id);
      await service.pauseAgent(agent.id);

      const resumed = await service.resumeAgent(agent.id);

      expect(resumed?.status).toBe(AgentStatus.PROCESSING);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.resumeAgent('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getAgentHealth', () => {
    it('should return agent health', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);

      const health = await service.getAgentHealth(agent.id);

      expect(health).toBeDefined();
      expect(health?.healthy).toBe(true);
      expect(health?.status).toBe(AgentStatus.IDLE);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.getAgentHealth('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getAgentCapabilities', () => {
    it('should return agent capabilities', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
        capabilities: ['code', 'review'],
      });

      const capabilities = await service.getAgentCapabilities(agent.id);

      expect(capabilities).toBeDefined();
      expect(capabilities).toEqual(['code', 'review']);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.getAgentCapabilities('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('submitTask', () => {
    it('should submit a task to an agent', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);
      await service.startAgent(agent.id);

      const taskSubmission: TaskSubmission = {
        type: 'code',
        payload: { code: 'console.log("hello")' },
      };

      const task = await service.submitTask(agent.id, taskSubmission);

      expect(task).toBeDefined();
      expect(task?.status).toBe('queued');
      expect(task?.agentId).toBe(agent.id);
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.submitTask('non-existent-id', {
        type: 'test',
        payload: {},
      });
      expect(result).toBeNull();
    });

    it('should include task metadata', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);
      await service.startAgent(agent.id);

      const task = await service.submitTask(agent.id, {
        type: 'code',
        payload: {},
        priority: 10,
        timeout: 30000,
        metadata: {
          requestId: 'req-123',
          tags: ['test'],
        },
      });

      expect(task).toBeDefined();
    });
  });

  describe('getTaskStatus', () => {
    it('should return task status', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      jest.advanceTimersByTime(100);
      await service.startAgent(agent.id);

      const task = await service.submitTask(agent.id, {
        type: 'code',
        payload: {},
      });

      const status = await service.getTaskStatus(agent.id, task!.taskId);

      expect(status).toBeDefined();
      expect(status?.status).toBe('queued');
    });

    it('should return null for non-existent agent', async () => {
      const result = await service.getTaskStatus('non-existent-id', 'task-id');
      expect(result).toBeNull();
    });

    it('should return null for non-existent task', async () => {
      const agent = await service.createAgent({
        type: AgentType.CODER,
        name: 'Test Agent',
      });

      const result = await service.getTaskStatus(agent.id, 'non-existent-task');
      expect(result).toBeNull();
    });
  });
});
