/**
 * A2A Server Tests
 *
 * @module tests/unit/core/a2a/a2a-server
 */

import {
  A2AServer,
  createA2AServer,
  A2AServerStatus,
  A2AServerEvents,
  validateA2ATask,
  validateAgentCard,
} from '../../../../src/core/a2a';
import {
  IAgent,
  AgentType,
  AgentStatus,
  TaskResultStatus,
  AgentCapability,
  AgentState,
  HealthStatus,
  AgentMetrics,
  ITask,
  TaskResult,
  TaskResultMetadata,
} from '../../../../src/core/interfaces/agent.interface';

// ============================================================================
// Mock Agent Factory
// ============================================================================

function createMockAgent(overrides: Partial<IAgent> = {}): IAgent {
  const defaultCapabilities: AgentCapability[] = [
    { name: 'code-generation', description: 'Generate code' },
    { name: 'code-review', description: 'Review code' },
  ];

  const defaultState: AgentState = {
    status: AgentStatus.IDLE,
    currentTask: null,
    queuedTasks: 0,
    processedTasks: 0,
    lastActiveAt: null,
  };

  const defaultHealth: HealthStatus = {
    healthy: true,
    status: AgentStatus.IDLE,
    uptime: 0,
    lastCheck: new Date(),
  };

  const defaultMetrics: AgentMetrics = {
    tasksProcessed: 0,
    tasksFailed: 0,
    averageTaskDuration: 0,
    totalTokensUsed: 0,
    uptime: 0,
    lastActiveAt: null,
    errorRate: 0,
  };

  return {
    id: 'test-agent-1',
    type: AgentType.CODER,
    name: 'Test Agent',
    version: '1.0.0',
    initialize: jest.fn().mockResolvedValue(undefined),
    start: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    dispose: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockReturnValue(defaultState),
    getHealth: jest.fn().mockReturnValue(defaultHealth),
    getCapabilities: jest.fn().mockReturnValue(defaultCapabilities),
    getMetrics: jest.fn().mockReturnValue(defaultMetrics),
    canHandle: jest.fn().mockReturnValue(true),
    processTask: jest.fn().mockImplementation((task: ITask): Promise<TaskResult> => {
      const now = new Date();
      const metadata: TaskResultMetadata = {
        agentId: 'test-agent-1',
        agentType: AgentType.CODER,
        startedAt: now,
        completedAt: now,
        duration: 0,
      };
      return Promise.resolve({
        taskId: task.id,
        success: true,
        status: TaskResultStatus.COMPLETED,
        data: { output: 'Task completed' },
        metadata,
      });
    }),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('A2AServer', () => {
  describe('constructor', () => {
    it('should create server with default config', () => {
      const server = createA2AServer();
      expect(server.getStatus()).toBe(A2AServerStatus.STOPPED);
      expect(server.getConfig().port).toBe(3000);
      expect(server.getConfig().host).toBe('localhost');
    });

    it('should create server with custom config', () => {
      const server = createA2AServer({
        port: 8080,
        host: '0.0.0.0',
        basePath: '/api/a2a',
      });
      expect(server.getConfig().port).toBe(8080);
      expect(server.getConfig().host).toBe('0.0.0.0');
      expect(server.getConfig().basePath).toBe('/api/a2a');
    });

    it('should validate config', () => {
      expect(() => createA2AServer({ port: -1 })).toThrow();
      expect(() => createA2AServer({ port: 99999 })).toThrow();
    });
  });

  describe('Agent Registration (no server start)', () => {
    let server: A2AServer;

    beforeEach(() => {
      server = createA2AServer();
    });

    describe('registerAgent', () => {
      it('should register agent successfully', () => {
        const agent = createMockAgent();
        server.registerAgent(agent);

        const card = server.getAgentCard(agent.id);
        expect(card).toBeDefined();
        expect(card?.name).toBe(agent.name);
      });

      it('should emit agent registered event', () => {
        const handler = jest.fn();
        server.on(A2AServerEvents.AGENT_REGISTERED, handler);

        const agent = createMockAgent();
        server.registerAgent(agent);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            agentId: agent.id,
            agentType: agent.type,
          })
        );
      });

      it('should build agent card from agent metadata', () => {
        const agent = createMockAgent({
          id: 'custom-agent',
          name: 'Custom Agent',
          version: '2.0.0',
        });

        server.registerAgent(agent);

        const card = server.getAgentCard(agent.id);
        expect(card?.name).toBe('Custom Agent');
        expect(card?.version).toBe('2.0.0');
      });

      it('should accept card overrides', () => {
        const agent = createMockAgent();
        server.registerAgent(agent, {
          description: 'Custom description',
          skills: [{ id: 'skill-1', name: 'Skill 1', description: 'A skill', tags: [] }],
        });

        const card = server.getAgentCard(agent.id);
        expect(card?.description).toBe('Custom description');
        expect(card?.skills).toHaveLength(1);
      });

      it('should throw if agent already registered', () => {
        const agent = createMockAgent();
        server.registerAgent(agent);
        expect(() => server.registerAgent(agent)).toThrow('already registered');
      });
    });

    describe('unregisterAgent', () => {
      it('should unregister agent successfully', () => {
        const agent = createMockAgent();
        server.registerAgent(agent);

        const result = server.unregisterAgent(agent.id);

        expect(result).toBe(true);
        expect(server.getAgentCard(agent.id)).toBeUndefined();
      });

      it('should emit agent unregistered event', () => {
        const handler = jest.fn();
        server.on(A2AServerEvents.AGENT_UNREGISTERED, handler);

        const agent = createMockAgent();
        server.registerAgent(agent);
        server.unregisterAgent(agent.id);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            agentId: agent.id,
          })
        );
      });

      it('should return false for unknown agent', () => {
        expect(server.unregisterAgent('unknown')).toBe(false);
      });
    });

    describe('getAgentCard', () => {
      it('should return agent card', () => {
        const agent = createMockAgent();
        server.registerAgent(agent);

        const card = server.getAgentCard(agent.id);
        expect(card).toBeDefined();
        expect(card?.name).toBe(agent.name);
      });

      it('should return undefined for unknown agent', () => {
        expect(server.getAgentCard('unknown')).toBeUndefined();
      });

      it('should emit card requested event', () => {
        const handler = jest.fn();
        server.on(A2AServerEvents.AGENT_CARD_REQUESTED, handler);

        const agent = createMockAgent();
        server.registerAgent(agent);
        server.getAgentCard(agent.id);

        expect(handler).toHaveBeenCalled();
      });
    });

    describe('getAllAgentCards', () => {
      it('should return all agent cards', () => {
        server.registerAgent(createMockAgent({ id: 'agent-1', name: 'Agent 1' }));
        server.registerAgent(createMockAgent({ id: 'agent-2', name: 'Agent 2' }));

        const cards = server.getAllAgentCards();
        expect(cards).toHaveLength(2);
      });

      it('should return empty array when no agents', () => {
        expect(server.getAllAgentCards()).toEqual([]);
      });
    });

    describe('findAgentsByCapability', () => {
      it('should find agents by capability', () => {
        server.registerAgent(createMockAgent({ id: 'agent-1' }));

        const result = server.findAgentsByCapability('code-generation');
        expect(result).toHaveLength(1);
      });

      it('should return empty array for unknown capability', () => {
        server.registerAgent(createMockAgent());

        const result = server.findAgentsByCapability('unknown-capability');
        expect(result).toEqual([]);
      });
    });
  });

  describe('Server Status (no lifecycle)', () => {
    let server: A2AServer;

    beforeEach(() => {
      server = createA2AServer();
    });

    it('should return STOPPED when not started', () => {
      expect(server.getStatus()).toBe(A2AServerStatus.STOPPED);
    });

    it('should return false for isRunning when stopped', () => {
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('Configuration', () => {
    let server: A2AServer;

    beforeEach(() => {
      server = createA2AServer({
        port: 3000,
        host: 'localhost',
      });
    });

    describe('getConfig', () => {
      it('should return server config', () => {
        const config = server.getConfig();
        expect(config.port).toBe(3000);
        expect(config.host).toBe('localhost');
      });

      it('should return a copy of config', () => {
        const config1 = server.getConfig();
        const config2 = server.getConfig();
        expect(config1).not.toBe(config2);
        expect(config1).toEqual(config2);
      });
    });
  });

  describe('Statistics (without running)', () => {
    let server: A2AServer;

    beforeEach(() => {
      server = createA2AServer();
    });

    it('should return server statistics', () => {
      const stats = server.getStats();
      expect(stats.status).toBe(A2AServerStatus.STOPPED);
      expect(stats.registeredAgents).toBe(0);
      expect(stats.activeTasks).toBe(0);
      expect(stats.completedTasks).toBe(0);
      expect(stats.failedTasks).toBe(0);
    });

    it('should track registered agents count', () => {
      server.registerAgent(createMockAgent({ id: 'agent-1' }));
      server.registerAgent(createMockAgent({ id: 'agent-2' }));

      const stats = server.getStats();
      expect(stats.registeredAgents).toBe(2);
    });
  });

  describe('Validation Utilities', () => {
    describe('validateA2ATask', () => {
      it('should validate valid task', () => {
        const task = {
          id: 'task-1',
          message: {
            role: 'user',
            content: 'Hello',
          },
        };

        expect(() => validateA2ATask(task)).not.toThrow();
      });

      it('should reject invalid task', () => {
        const invalidTask = {
          id: 'task-1',
          // missing message
        };

        expect(() => validateA2ATask(invalidTask)).toThrow();
      });
    });

    describe('validateAgentCard', () => {
      it('should validate valid card', () => {
        const card = {
          name: 'Test Agent',
          description: 'A test agent',
          url: 'http://localhost:3000/agents/test',
          version: '1.0.0',
          capabilities: [{ name: 'test', description: 'Test capability' }],
        };

        expect(() => validateAgentCard(card)).not.toThrow();
      });

      it('should reject invalid card', () => {
        const invalidCard = {
          // missing name
          description: 'A test agent',
          url: 'http://localhost:3000/agents/test',
        };

        expect(() => validateAgentCard(invalidCard)).toThrow();
      });
    });
  });
});
