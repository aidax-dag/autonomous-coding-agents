/**
 * Team Registry Tests
 */

import {
  TeamRegistry,
  createDefaultRegistry,
} from '../../../../src/core/orchestrator/team-registry';
import {
  TeamAgentStatus,
} from '../../../../src/core/orchestrator/team-agent';
import type {
  ITeamAgent,
  TeamAgentConfig,
  TeamCapability,
  TeamMetrics,
} from '../../../../src/core/orchestrator/team-agent';
import type { TeamType } from '../../../../src/core/workspace/task-document';

// ============================================================================
// Helpers
// ============================================================================

function makeMetrics(overrides: Partial<TeamMetrics> = {}): TeamMetrics {
  return {
    tasksProcessed: 0,
    tasksFailed: 0,
    tasksInProgress: 0,
    averageProcessingTime: 0,
    uptime: 0,
    lastActiveAt: null,
    successRate: 1,
    ...overrides,
  };
}

function makeCapability(overrides: Partial<TeamCapability> = {}): TeamCapability {
  return {
    name: 'test-capability',
    description: 'A test capability',
    taskTypes: ['feature'],
    priority: 50,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<TeamAgentConfig> = {}): TeamAgentConfig {
  return {
    teamType: 'development' as TeamType,
    name: 'Dev Team',
    description: 'Development team',
    capabilities: [makeCapability()],
    maxConcurrentTasks: 3,
    taskTimeout: 300000,
    autoStart: false,
    ...overrides,
  };
}

function makeMockTeam(
  teamType: TeamType = 'development' as TeamType,
  overrides: Partial<ITeamAgent> = {}
): ITeamAgent {
  const config = makeConfig({ teamType, ...overrides.config });
  return {
    id: `${teamType}-1`,
    teamType,
    config,
    status: TeamAgentStatus.IDLE,
    metrics: makeMetrics(),
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    canHandle: jest.fn().mockReturnValue(false),
    registerHandler: jest.fn(),
    getCapability: jest.fn().mockReturnValue(undefined),
    getLoad: jest.fn().mockReturnValue(0),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, status: TeamAgentStatus.IDLE }),
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('TeamRegistry', () => {
  let registry: TeamRegistry;

  beforeEach(() => {
    jest.useFakeTimers();
    registry = new TeamRegistry();
  });

  afterEach(() => {
    registry.destroy();
    jest.useRealTimers();
  });

  // ==========================================================================
  // register / unregister
  // ==========================================================================

  describe('register', () => {
    it('should register a team', () => {
      const team = makeMockTeam('development');
      registry.register(team);
      expect(registry.has('development')).toBe(true);
    });

    it('should throw for duplicate registration', () => {
      const team = makeMockTeam('development');
      registry.register(team);
      expect(() => registry.register(team)).toThrow('already registered');
    });

    it('should emit team:registered event', () => {
      const listener = jest.fn();
      registry.on('team:registered', listener);
      const team = makeMockTeam('qa');
      registry.register(team);
      expect(listener).toHaveBeenCalledWith(team);
    });

    it('should auto-start when configured', () => {
      const team = makeMockTeam('development', {
        config: makeConfig({ teamType: 'development', autoStart: true }),
      });
      registry.register(team);
      expect(team.start).toHaveBeenCalled();
    });

    it('should not auto-start when not configured', () => {
      const team = makeMockTeam('development', {
        config: makeConfig({ teamType: 'development', autoStart: false }),
      });
      registry.register(team);
      expect(team.start).not.toHaveBeenCalled();
    });
  });

  describe('unregister', () => {
    it('should unregister existing team', () => {
      const team = makeMockTeam('development');
      registry.register(team);
      const result = registry.unregister('development');
      expect(result).toBe(true);
      expect(registry.has('development')).toBe(false);
    });

    it('should return false for non-existent team', () => {
      expect(registry.unregister('development')).toBe(false);
    });

    it('should emit team:unregistered event', () => {
      const listener = jest.fn();
      registry.on('team:unregistered', listener);
      const team = makeMockTeam('development');
      registry.register(team);
      registry.unregister('development');
      expect(listener).toHaveBeenCalledWith('development');
    });

    it('should stop running team on unregister', () => {
      const team = makeMockTeam('development', { status: TeamAgentStatus.IDLE });
      registry.register(team);
      registry.unregister('development');
      expect(team.stop).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // get / getAll / has
  // ==========================================================================

  describe('get', () => {
    it('should return registered team', () => {
      const team = makeMockTeam('development');
      registry.register(team);
      expect(registry.get('development')).toBe(team);
    });

    it('should return undefined for unregistered team', () => {
      expect(registry.get('development')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered teams', () => {
      registry.register(makeMockTeam('development'));
      registry.register(makeMockTeam('qa'));
      expect(registry.getAll()).toHaveLength(2);
    });

    it('should return empty array when no teams registered', () => {
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  // ==========================================================================
  // findTeamsForTaskType
  // ==========================================================================

  describe('findTeamsForTaskType', () => {
    it('should return matching teams sorted by score', () => {
      const devTeam = makeMockTeam('development', {
        canHandle: jest.fn().mockReturnValue(true),
        getCapability: jest.fn().mockReturnValue(makeCapability({ priority: 70 })),
        getLoad: jest.fn().mockReturnValue(0.2),
      });
      const qaTeam = makeMockTeam('qa', {
        canHandle: jest.fn().mockReturnValue(true),
        getCapability: jest.fn().mockReturnValue(makeCapability({ priority: 80, taskTypes: ['test'] })),
        getLoad: jest.fn().mockReturnValue(0),
      });

      registry.register(devTeam);
      registry.register(qaTeam);

      const results = registry.findTeamsForTaskType('feature');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Higher score first
      if (results.length >= 2) {
        expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      }
    });

    it('should return empty for no matching teams', () => {
      const team = makeMockTeam('development', {
        canHandle: jest.fn().mockReturnValue(false),
      });
      registry.register(team);
      expect(registry.findTeamsForTaskType('test')).toHaveLength(0);
    });

    it('should factor in load when scoring', () => {
      const team = makeMockTeam('development', {
        canHandle: jest.fn().mockReturnValue(true),
        getCapability: jest.fn().mockReturnValue(makeCapability({ priority: 100 })),
        getLoad: jest.fn().mockReturnValue(0.5),
      });
      registry.register(team);

      const results = registry.findTeamsForTaskType('feature');
      expect(results).toHaveLength(1);
      // score = priority * (1 - load) = 100 * 0.5 = 50
      expect(results[0].score).toBe(50);
    });
  });

  // ==========================================================================
  // getBestTeamForTaskType
  // ==========================================================================

  describe('getBestTeamForTaskType', () => {
    it('should return best available team', () => {
      const team = makeMockTeam('development', {
        status: TeamAgentStatus.IDLE,
        canHandle: jest.fn().mockReturnValue(true),
        getCapability: jest.fn().mockReturnValue(makeCapability({ priority: 70 })),
        getLoad: jest.fn().mockReturnValue(0),
      });
      registry.register(team);

      const result = registry.getBestTeamForTaskType('feature');
      expect(result).toBeDefined();
      expect(result!.team.teamType).toBe('development');
    });

    it('should exclude stopped teams', () => {
      const team = makeMockTeam('development', {
        status: TeamAgentStatus.STOPPED,
        canHandle: jest.fn().mockReturnValue(true),
        getCapability: jest.fn().mockReturnValue(makeCapability({ priority: 70 })),
        getLoad: jest.fn().mockReturnValue(0),
      });
      registry.register(team);

      expect(registry.getBestTeamForTaskType('feature')).toBeUndefined();
    });

    it('should return undefined when no teams match', () => {
      expect(registry.getBestTeamForTaskType('feature')).toBeUndefined();
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe('getStats', () => {
    it('should return correct stats', () => {
      const idle = makeMockTeam('development', { status: TeamAgentStatus.IDLE });
      const active = makeMockTeam('qa', { status: TeamAgentStatus.PROCESSING });
      const error = makeMockTeam('planning', { status: TeamAgentStatus.ERROR });

      registry.register(idle);
      registry.register(active);
      registry.register(error);

      const stats = registry.getStats();
      expect(stats.totalTeams).toBe(3);
      expect(stats.idleTeams).toBe(1);
      expect(stats.activeTeams).toBe(1);
      expect(stats.errorTeams).toBe(1);
    });

    it('should return empty stats when no teams', () => {
      const stats = registry.getStats();
      expect(stats.totalTeams).toBe(0);
      expect(stats.activeTeams).toBe(0);
    });
  });

  // ==========================================================================
  // startAll / stopAll
  // ==========================================================================

  describe('startAll', () => {
    it('should start all teams', async () => {
      const team1 = makeMockTeam('development');
      const team2 = makeMockTeam('qa');
      registry.register(team1);
      registry.register(team2);

      await registry.startAll();
      expect(team1.start).toHaveBeenCalled();
      expect(team2.start).toHaveBeenCalled();
    });

    it('should emit error for failed starts', async () => {
      const team = makeMockTeam('development', {
        start: jest.fn().mockRejectedValue(new Error('start failed')),
      });
      const errorListener = jest.fn();
      registry.on('team:error', errorListener);
      registry.register(team);

      await registry.startAll();
      expect(errorListener).toHaveBeenCalled();
    });
  });

  describe('stopAll', () => {
    it('should stop all teams', async () => {
      const team1 = makeMockTeam('development');
      const team2 = makeMockTeam('qa');
      registry.register(team1);
      registry.register(team2);

      await registry.stopAll();
      expect(team1.stop).toHaveBeenCalled();
      expect(team2.stop).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getTeamsByStatus / getAvailableTeams
  // ==========================================================================

  describe('getTeamsByStatus', () => {
    it('should filter by status', () => {
      registry.register(makeMockTeam('development', { status: TeamAgentStatus.IDLE }));
      registry.register(makeMockTeam('qa', { status: TeamAgentStatus.PROCESSING }));
      registry.register(makeMockTeam('planning', { status: TeamAgentStatus.IDLE }));

      expect(registry.getTeamsByStatus(TeamAgentStatus.IDLE)).toHaveLength(2);
      expect(registry.getTeamsByStatus(TeamAgentStatus.PROCESSING)).toHaveLength(1);
    });
  });

  describe('getAvailableTeams', () => {
    it('should return idle and processing-with-capacity teams', () => {
      registry.register(makeMockTeam('development', {
        status: TeamAgentStatus.IDLE,
        getLoad: jest.fn().mockReturnValue(0),
      }));
      registry.register(makeMockTeam('qa', {
        status: TeamAgentStatus.PROCESSING,
        getLoad: jest.fn().mockReturnValue(0.5),
      }));
      registry.register(makeMockTeam('planning', {
        status: TeamAgentStatus.STOPPED,
        getLoad: jest.fn().mockReturnValue(0),
      }));

      expect(registry.getAvailableTeams()).toHaveLength(2);
    });
  });

  // ==========================================================================
  // getTeamConfigs / destroy
  // ==========================================================================

  describe('getTeamConfigs', () => {
    it('should return config map', () => {
      registry.register(makeMockTeam('development'));
      const configs = registry.getTeamConfigs();
      expect(configs.has('development')).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clear all teams and listeners', () => {
      registry.register(makeMockTeam('development'));
      registry.register(makeMockTeam('qa'));
      registry.destroy();
      expect(registry.getAll()).toHaveLength(0);
    });
  });
});

// ============================================================================
// createDefaultRegistry
// ============================================================================

describe('createDefaultRegistry', () => {
  it('should create a TeamRegistry', () => {
    const registry = createDefaultRegistry();
    expect(registry).toBeInstanceOf(TeamRegistry);
    registry.destroy();
  });
});
