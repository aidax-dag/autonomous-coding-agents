/**
 * Agent Registry Tests
 */

import {
  AgentRegistry,
  createAgentRegistry,
  REGISTRY_EVENTS,
} from '../../../../src/core/agents';
import {
  AgentType,
  AgentStatus,
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

// Mock agent implementation
class MockAgent implements IAgent {
  readonly id: string;
  readonly type: AgentType;
  readonly name: string;
  readonly version: string;

  constructor(config: Partial<IAgentConfig> & { id: string; type: AgentType }) {
    this.id = config.id;
    this.type = config.type;
    this.name = config.name || 'Mock Agent';
    this.version = config.version || '1.0.0';
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

  processTask(task: ITask): Promise<TaskResult> {
    return Promise.resolve({
      taskId: task.id,
      success: true,
      status: TaskResultStatus.COMPLETED,
      data: {},
      metadata: {
        agentId: this.id,
        agentType: this.type,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 0,
      },
    });
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

  getCapabilities(): AgentCapability[] {
    return [];
  }
}

// Mock event bus
const createMockEventBus = (): IEventBus & { emittedEvents: IEvent[] } => {
  const emittedEvents: IEvent[] = [];

  return {
    // IEventPublisher
    emit: jest.fn((event: IEvent) => {
      emittedEvents.push(event);
    }),
    emitAsync: jest.fn().mockResolvedValue(undefined),
    emitBatch: jest.fn(),
    // IEventSubscriber
    on: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    once: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    off: jest.fn(),
    waitFor: jest.fn().mockResolvedValue({}),
    // IEventBus
    removeAllListeners: jest.fn(),
    listenerCount: jest.fn().mockReturnValue(0),
    eventTypes: jest.fn().mockReturnValue([]),
    hasListeners: jest.fn().mockReturnValue(false),
    pause: jest.fn(),
    resume: jest.fn(),
    isPaused: jest.fn().mockReturnValue(false),
    dispose: jest.fn(),
    // Extra for tests
    emittedEvents,
  };
};

describe('AgentRegistry', () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
  });

  describe('Registration', () => {
    it('should register an agent', () => {
      const agent = new MockAgent({ id: 'agent-1', type: AgentType.CODER });

      registry.register(agent);

      expect(registry.has('agent-1')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should throw when registering duplicate ID', () => {
      const agent1 = new MockAgent({ id: 'agent-1', type: AgentType.CODER });
      const agent2 = new MockAgent({ id: 'agent-1', type: AgentType.REVIEWER });

      registry.register(agent1);

      expect(() => registry.register(agent2)).toThrow(
        "Agent with ID 'agent-1' is already registered"
      );
    });

    it('should respect max agents limit', () => {
      const limitedRegistry = new AgentRegistry({ maxAgents: 2 });

      limitedRegistry.register(new MockAgent({ id: 'agent-1', type: AgentType.CODER }));
      limitedRegistry.register(new MockAgent({ id: 'agent-2', type: AgentType.CODER }));

      expect(() => {
        limitedRegistry.register(new MockAgent({ id: 'agent-3', type: AgentType.CODER }));
      }).toThrow('Maximum agent limit (2) reached');
    });

    it('should emit event on registration', () => {
      const eventBus = createMockEventBus();
      const registryWithEvents = new AgentRegistry({ eventBus });

      const agent = new MockAgent({
        id: 'agent-1',
        type: AgentType.CODER,
        name: 'Test Agent',
      });
      registryWithEvents.register(agent);

      expect(eventBus.emit).toHaveBeenCalled();
      expect(eventBus.emittedEvents[0].type).toBe(REGISTRY_EVENTS.AGENT_REGISTERED);
      expect(eventBus.emittedEvents[0].payload).toEqual({
        agentId: 'agent-1',
        agentType: AgentType.CODER,
        agentName: 'Test Agent',
      });
    });
  });

  describe('Unregistration', () => {
    it('should unregister an agent', () => {
      const agent = new MockAgent({ id: 'agent-1', type: AgentType.CODER });

      registry.register(agent);
      expect(registry.unregister('agent-1')).toBe(true);
      expect(registry.has('agent-1')).toBe(false);
    });

    it('should return false when unregistering non-existent agent', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });

    it('should emit event on unregistration', () => {
      const eventBus = createMockEventBus();
      const registryWithEvents = new AgentRegistry({ eventBus });

      const agent = new MockAgent({ id: 'agent-1', type: AgentType.CODER });
      registryWithEvents.register(agent);
      registryWithEvents.unregister('agent-1');

      const unregisterEvent = eventBus.emittedEvents.find(
        (e) => e.type === REGISTRY_EVENTS.AGENT_UNREGISTERED
      );
      expect(unregisterEvent).toBeDefined();
      expect(unregisterEvent!.payload).toEqual({
        agentId: 'agent-1',
        agentType: AgentType.CODER,
      });
    });

    it('should update type index on unregistration', () => {
      const agent = new MockAgent({ id: 'agent-1', type: AgentType.CODER });

      registry.register(agent);
      expect(registry.countByType(AgentType.CODER)).toBe(1);

      registry.unregister('agent-1');
      expect(registry.countByType(AgentType.CODER)).toBe(0);
    });
  });

  describe('Lookup', () => {
    beforeEach(() => {
      registry.register(new MockAgent({ id: 'coder-1', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'coder-2', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'reviewer-1', type: AgentType.REVIEWER }));
    });

    it('should get agent by ID', () => {
      const agent = registry.get('coder-1');

      expect(agent).toBeDefined();
      expect(agent!.id).toBe('coder-1');
    });

    it('should return undefined for unknown ID', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should get agents by type', () => {
      const coders = registry.getByType(AgentType.CODER);

      expect(coders).toHaveLength(2);
      expect(coders.map((a) => a.id)).toContain('coder-1');
      expect(coders.map((a) => a.id)).toContain('coder-2');
    });

    it('should return empty array for unregistered type', () => {
      const testers = registry.getByType(AgentType.TESTER);
      expect(testers).toHaveLength(0);
    });

    it('should get all agents', () => {
      const all = registry.getAll();

      expect(all).toHaveLength(3);
    });

    it('should check if agent exists', () => {
      expect(registry.has('coder-1')).toBe(true);
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('Counting', () => {
    it('should count all agents', () => {
      expect(registry.count()).toBe(0);

      registry.register(new MockAgent({ id: 'agent-1', type: AgentType.CODER }));
      expect(registry.count()).toBe(1);

      registry.register(new MockAgent({ id: 'agent-2', type: AgentType.CODER }));
      expect(registry.count()).toBe(2);
    });

    it('should count by type', () => {
      registry.register(new MockAgent({ id: 'coder-1', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'coder-2', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'reviewer-1', type: AgentType.REVIEWER }));

      expect(registry.countByType(AgentType.CODER)).toBe(2);
      expect(registry.countByType(AgentType.REVIEWER)).toBe(1);
      expect(registry.countByType(AgentType.TESTER)).toBe(0);
    });
  });

  describe('Type Index', () => {
    it('should get registered types', () => {
      registry.register(new MockAgent({ id: 'coder-1', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'reviewer-1', type: AgentType.REVIEWER }));

      const types = registry.getRegisteredTypes();

      expect(types).toContain(AgentType.CODER);
      expect(types).toContain(AgentType.REVIEWER);
      expect(types).toHaveLength(2);
    });

    it('should remove type from index when last agent unregistered', () => {
      registry.register(new MockAgent({ id: 'coder-1', type: AgentType.CODER }));

      expect(registry.getRegisteredTypes()).toContain(AgentType.CODER);

      registry.unregister('coder-1');

      expect(registry.getRegisteredTypes()).not.toContain(AgentType.CODER);
    });
  });

  describe('Find', () => {
    beforeEach(() => {
      registry.register(
        new MockAgent({ id: 'coder-1', type: AgentType.CODER, name: 'Alpha Coder' })
      );
      registry.register(
        new MockAgent({ id: 'coder-2', type: AgentType.CODER, name: 'Beta Coder' })
      );
      registry.register(
        new MockAgent({ id: 'reviewer-1', type: AgentType.REVIEWER, name: 'Alpha Reviewer' })
      );
    });

    it('should find agents matching predicate', () => {
      const alphaAgents = registry.find((a) => a.name.includes('Alpha'));

      expect(alphaAgents).toHaveLength(2);
    });

    it('should find first agent matching predicate', () => {
      const coder = registry.findOne((a) => a.type === AgentType.CODER);

      expect(coder).toBeDefined();
      expect(coder!.type).toBe(AgentType.CODER);
    });

    it('should return undefined when no match', () => {
      const notFound = registry.findOne((a) => a.name === 'NonExistent');
      expect(notFound).toBeUndefined();
    });
  });

  describe('Clear', () => {
    it('should clear all agents', () => {
      registry.register(new MockAgent({ id: 'agent-1', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'agent-2', type: AgentType.REVIEWER }));

      registry.clear();

      expect(registry.count()).toBe(0);
      expect(registry.getRegisteredTypes()).toHaveLength(0);
    });

    it('should emit event on clear', () => {
      const eventBus = createMockEventBus();
      const registryWithEvents = new AgentRegistry({ eventBus });

      registryWithEvents.register(new MockAgent({ id: 'agent-1', type: AgentType.CODER }));
      registryWithEvents.register(new MockAgent({ id: 'agent-2', type: AgentType.CODER }));
      registryWithEvents.clear();

      const clearEvent = eventBus.emittedEvents.find(
        (e) => e.type === REGISTRY_EVENTS.REGISTRY_CLEARED
      );
      expect(clearEvent).toBeDefined();
      expect(clearEvent!.payload).toEqual({ clearedCount: 2 });
    });
  });

  describe('Statistics', () => {
    it('should return registry stats', () => {
      registry.register(new MockAgent({ id: 'coder-1', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'coder-2', type: AgentType.CODER }));
      registry.register(new MockAgent({ id: 'reviewer-1', type: AgentType.REVIEWER }));

      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.typeDistribution[AgentType.CODER]).toBe(2);
      expect(stats.typeDistribution[AgentType.REVIEWER]).toBe(1);
      expect(stats.registeredTypes).toContain(AgentType.CODER);
      expect(stats.registeredTypes).toContain(AgentType.REVIEWER);
    });
  });

  describe('createAgentRegistry helper', () => {
    it('should create a registry instance', () => {
      const createdRegistry = createAgentRegistry();
      expect(createdRegistry).toBeInstanceOf(AgentRegistry);
    });

    it('should accept options', () => {
      const eventBus = createMockEventBus();
      const createdRegistry = createAgentRegistry({ eventBus, maxAgents: 5 });

      // Register should trigger event
      (createdRegistry as AgentRegistry).register(
        new MockAgent({ id: 'agent-1', type: AgentType.CODER })
      );
      expect(eventBus.emit).toHaveBeenCalled();
    });
  });
});
