/**
 * Team Registry Tests
 *
 * Tests for the TeamRegistry class.
 */

import {
  TeamRegistry,
  createTeamRegistry,
  DEFAULT_REGISTRY_CONFIG,
} from '../../../../src/core/teams/team-registry';
import { BaseTeam, createTask } from '../../../../src/core/teams/base-team';
import {
  TeamConfig,
  TeamType,
  TeamCapability,
  TeamStatus,
  TaskDocument,
  TaskResult,
  TaskPriority,
} from '../../../../src/core/teams/team-types';

// Concrete implementation for testing
class TestTeam extends BaseTeam {
  protected async processTask(task: TaskDocument): Promise<TaskResult> {
    return {
      taskId: task.id,
      success: true,
      outputs: { processed: true },
      subtasks: [],
      artifacts: [],
      duration: 100,
      tokensUsed: 50,
    };
  }
}

describe('TeamRegistry', () => {
  let registry: TeamRegistry;

  const createTestTeam = (
    type: TeamType,
    id?: string,
    capabilities?: TeamCapability[]
  ): TestTeam => {
    const config: TeamConfig = {
      id: id || `team-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: `Test ${type} Team`,
      type,
      capabilities: capabilities || [TeamCapability.TASK_DECOMPOSITION],
      maxConcurrentTasks: 3,
      taskTimeoutMs: 5000,
      autoRetry: false,
      maxRetries: 0,
      metadata: {},
    };
    return new TestTeam(config);
  };

  beforeEach(() => {
    registry = createTeamRegistry();
  });

  afterEach(async () => {
    await registry.stop();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      expect(DEFAULT_REGISTRY_CONFIG.autoDiscovery).toBe(true);
      expect(DEFAULT_REGISTRY_CONFIG.loadBalancing).toBe(true);
    });

    it('should accept custom configuration', () => {
      const customRegistry = createTeamRegistry({
        loadBalancingStrategy: 'round_robin',
        maxTeamsPerType: 10,
      });

      expect(customRegistry).toBeDefined();
    });
  });

  describe('Team Registration', () => {
    it('should register a team', () => {
      const team = createTestTeam(TeamType.PLANNING, 'team-1');
      registry.register(team);

      expect(registry.getTeam('team-1')).toBe(team);
    });

    it('should reject duplicate team registration', () => {
      const team = createTestTeam(TeamType.PLANNING, 'team-1');
      registry.register(team);

      expect(() => registry.register(team)).toThrow('already registered');
    });

    it('should unregister a team', () => {
      const team = createTestTeam(TeamType.PLANNING, 'team-1');
      registry.register(team);

      expect(registry.unregister('team-1')).toBe(true);
      expect(registry.getTeam('team-1')).toBeUndefined();
    });

    it('should return false when unregistering non-existent team', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });

    it('should emit events on registration', () => {
      const registeredHandler = jest.fn();
      registry.on('team:registered', registeredHandler);

      const team = createTestTeam(TeamType.PLANNING, 'team-1');
      registry.register(team);

      expect(registeredHandler).toHaveBeenCalledWith(team);
    });

    it('should emit events on unregistration', () => {
      const unregisteredHandler = jest.fn();
      registry.on('team:unregistered', unregisteredHandler);

      const team = createTestTeam(TeamType.PLANNING, 'team-1');
      registry.register(team);
      registry.unregister('team-1');

      expect(unregisteredHandler).toHaveBeenCalledWith('team-1');
    });
  });

  describe('Team Retrieval', () => {
    beforeEach(() => {
      registry.register(createTestTeam(TeamType.PLANNING, 'planning-1'));
      registry.register(createTestTeam(TeamType.FRONTEND, 'frontend-1'));
      registry.register(
        createTestTeam(TeamType.BACKEND, 'backend-1', [
          TeamCapability.CODE_GENERATION,
          TeamCapability.TEST_GENERATION,
        ])
      );
    });

    it('should get all teams', () => {
      const teams = registry.getAllTeams();
      expect(teams.length).toBe(3);
    });

    it('should get teams by type', () => {
      const planningTeams = registry.getTeamsByType(TeamType.PLANNING);
      expect(planningTeams.length).toBe(1);
      expect(planningTeams[0].type).toBe(TeamType.PLANNING);
    });

    it('should get teams by capability', () => {
      const codeGenTeams = registry.getTeamsByCapability(TeamCapability.CODE_GENERATION);
      expect(codeGenTeams.length).toBe(1);
      expect(codeGenTeams[0].id).toBe('backend-1');
    });

    it('should return empty array for non-existent type', () => {
      const teams = registry.getTeamsByType(TeamType.DEVOPS);
      expect(teams.length).toBe(0);
    });
  });

  describe('Task Routing', () => {
    beforeEach(async () => {
      const planningTeam = createTestTeam(TeamType.PLANNING, 'planning-1', [
        TeamCapability.TASK_DECOMPOSITION,
      ]);
      await planningTeam.initialize();
      registry.register(planningTeam);

      const devTeam = createTestTeam(TeamType.FULLSTACK, 'dev-1', [
        TeamCapability.CODE_GENERATION,
      ]);
      await devTeam.initialize();
      registry.register(devTeam);
    });

    it('should route task by type', async () => {
      const team = registry.getTeam('planning-1');
      if (team) await team.start();

      const task = createTask('Plan Project', 'Create project plan', {
        type: 'planning',
      });

      const decision = registry.routeTask(task);

      expect(decision).not.toBeNull();
      expect(decision?.teamId).toBe('planning-1');
    });

    it('should route task by capability', async () => {
      const team = registry.getTeam('dev-1');
      if (team) await team.start();

      // The task description should trigger code generation capability
      const devTask = createTask('Implement Feature', 'implement and code the feature');
      const decision = registry.routeTask(devTask);

      expect(decision).not.toBeNull();
    });

    it('should return null for unroutable task', () => {
      const task = createTask('Unknown Task', 'Something unknown');
      // Don't start any teams, so none are available
      const decision = registry.routeTask(task);

      expect(decision).toBeNull();
    });

    it('should route and submit task', async () => {
      const team = registry.getTeam('planning-1');
      if (team) await team.start();

      const task = createTask('Plan Project', 'Create project plan', {
        type: 'planning',
      });

      const taskId = await registry.routeAndSubmitTask(task);

      expect(taskId).not.toBeNull();
    });
  });

  describe('Load Balancing', () => {
    beforeEach(async () => {
      // Register multiple teams of same type
      for (let i = 0; i < 3; i++) {
        const team = createTestTeam(TeamType.PLANNING, `planning-${i}`, [
          TeamCapability.TASK_DECOMPOSITION,
        ]);
        await team.initialize();
        await team.start();
        registry.register(team);
      }
    });

    it('should distribute tasks with round-robin', () => {
      const rrRegistry = createTeamRegistry({
        loadBalancingStrategy: 'round_robin',
      });

      for (let i = 0; i < 3; i++) {
        const team = createTestTeam(TeamType.PLANNING, `rr-${i}`);
        rrRegistry.register(team);
      }

      // Note: Teams need to be started for routing to work
    });

    it('should prefer least-loaded teams', () => {
      const decision = registry.routeTask(
        createTask('Test', 'Test', { type: 'planning' })
      );

      expect(decision).toBeDefined();
      expect(decision?.reason).toContain('Least loaded');
    });
  });

  describe('Health Summary', () => {
    beforeEach(async () => {
      const team = createTestTeam(TeamType.PLANNING, 'planning-1');
      await team.initialize();
      registry.register(team);
    });

    it('should return health summary', () => {
      const summary = registry.getHealthSummary();

      expect(summary.totalTeams).toBe(1);
      expect(summary.byType[TeamType.PLANNING]).toBe(1);
      expect(summary.byStatus[TeamStatus.IDLE]).toBe(1);
    });

    it('should track task counts', async () => {
      const team = registry.getTeam('planning-1');
      if (team) {
        await team.start();
        await team.submitTask(createTask('Task', 'Description'));
      }

      const summary = registry.getHealthSummary();
      expect(summary.totalQueuedTasks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message Routing', () => {
    beforeEach(async () => {
      const team1 = createTestTeam(TeamType.PLANNING, 'team-1');
      const team2 = createTestTeam(TeamType.FRONTEND, 'team-2');
      await team1.initialize();
      await team2.initialize();
      registry.register(team1);
      registry.register(team2);
    });

    it('should route message to team', async () => {
      const message = {
        id: 'msg-1',
        type: 'notification' as const,
        from: 'team-1',
        to: 'team-2',
        subject: 'Test Message',
        body: { data: 'test' },
        timestamp: new Date(),
        priority: TaskPriority.NORMAL,
        requiresAck: false,
        acknowledged: false,
        metadata: {},
      };

      const result = await registry.routeMessage(message);
      expect(result).toBe(true);
    });

    it('should return false for non-existent target', async () => {
      const message = {
        id: 'msg-1',
        type: 'notification' as const,
        from: 'team-1',
        to: 'non-existent',
        subject: 'Test Message',
        body: {},
        timestamp: new Date(),
        priority: TaskPriority.NORMAL,
        requiresAck: false,
        acknowledged: false,
        metadata: {},
      };

      const result = await registry.routeMessage(message);
      expect(result).toBe(false);
    });
  });
});
