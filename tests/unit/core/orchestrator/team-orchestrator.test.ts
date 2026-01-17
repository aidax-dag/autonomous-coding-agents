import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  // Team Agent
  TeamAgentStatus,
  createTeamConfig,
  ITeamAgent,
  TeamAgentConfig,
  TeamMetrics,
  TaskHandler,
  TeamCapability,
  // Team Registry
  TeamRegistry,
  // Task Router
  TaskRouter,
  // CEO Orchestrator
  CEOOrchestrator,
  CEOStatus,
} from '@/core/orchestrator';
import {
  TeamType,
  TaskType,
} from '@/core/workspace';

/**
 * Mock Team Agent for testing
 */
class MockTeamAgent implements ITeamAgent {
  readonly id: string;
  readonly teamType: TeamType;
  readonly config: TeamAgentConfig;
  private _status: TeamAgentStatus = TeamAgentStatus.STOPPED;
  private _metrics: TeamMetrics = {
    tasksProcessed: 0,
    tasksFailed: 0,
    tasksInProgress: 0,
    averageProcessingTime: 0,
    uptime: 0,
    lastActiveAt: null,
    successRate: 1,
  };
  private handlers: Map<TaskType, TaskHandler> = new Map();
  private currentLoad = 0;

  constructor(teamType: TeamType, config?: Partial<TeamAgentConfig>) {
    this.teamType = teamType;
    this.config = createTeamConfig(teamType, config);
    this.id = `${teamType}-${Date.now()}`;
  }

  get status(): TeamAgentStatus {
    return this._status;
  }

  get metrics(): TeamMetrics {
    return this._metrics;
  }

  async start(): Promise<void> {
    this._status = TeamAgentStatus.IDLE;
  }

  async stop(): Promise<void> {
    this._status = TeamAgentStatus.STOPPED;
  }

  async pause(): Promise<void> {
    this._status = TeamAgentStatus.PAUSED;
  }

  async resume(): Promise<void> {
    this._status = TeamAgentStatus.IDLE;
  }

  canHandle(taskType: TaskType): boolean {
    return this.config.capabilities.some((cap) => cap.taskTypes.includes(taskType));
  }

  registerHandler(taskTypes: TaskType[], handler: TaskHandler): void {
    for (const type of taskTypes) {
      this.handlers.set(type, handler);
    }
  }

  getCapability(taskType: TaskType): TeamCapability | undefined {
    return this.config.capabilities.find((cap) => cap.taskTypes.includes(taskType));
  }

  getLoad(): number {
    return this.currentLoad;
  }

  setLoad(load: number): void {
    this.currentLoad = load;
  }

  async healthCheck(): Promise<{ healthy: boolean; status: TeamAgentStatus }> {
    return { healthy: this._status !== TeamAgentStatus.ERROR, status: this._status };
  }
}

describe('Team Orchestrator Module', () => {
  describe('createTeamConfig', () => {
    it('should create config with defaults for known team types', () => {
      const config = createTeamConfig('development');

      expect(config.teamType).toBe('development');
      expect(config.name).toBe('Development Team');
      expect(config.capabilities.length).toBeGreaterThan(0);
      expect(config.maxConcurrentTasks).toBeGreaterThan(0);
    });

    it('should allow overriding defaults', () => {
      const config = createTeamConfig('development', {
        name: 'Custom Dev Team',
        maxConcurrentTasks: 10,
      });

      expect(config.name).toBe('Custom Dev Team');
      expect(config.maxConcurrentTasks).toBe(10);
    });

    it('should handle unknown team types gracefully', () => {
      const config = createTeamConfig('orchestrator');

      expect(config.teamType).toBe('orchestrator');
      expect(config.name).toBe('CEO Orchestrator');
    });
  });

  describe('TeamRegistry', () => {
    let registry: TeamRegistry;
    let mockTeam: MockTeamAgent;

    beforeEach(() => {
      registry = new TeamRegistry();
      mockTeam = new MockTeamAgent('development', {
        capabilities: [
          {
            name: 'feature-dev',
            description: 'Feature development',
            taskTypes: ['feature', 'bugfix'],
            priority: 80,
          },
        ],
      });
    });

    afterEach(() => {
      registry.destroy();
    });

    it('should register a team', () => {
      registry.register(mockTeam);

      expect(registry.has('development')).toBe(true);
      expect(registry.get('development')).toBe(mockTeam);
    });

    it('should throw error when registering duplicate team', () => {
      registry.register(mockTeam);

      expect(() => {
        registry.register(new MockTeamAgent('development'));
      }).toThrow('Team development is already registered');
    });

    it('should unregister a team', () => {
      registry.register(mockTeam);

      const result = registry.unregister('development');

      expect(result).toBe(true);
      expect(registry.has('development')).toBe(false);
    });

    it('should return false when unregistering non-existent team', () => {
      const result = registry.unregister('qa');

      expect(result).toBe(false);
    });

    it('should get all registered teams', () => {
      const qaTeam = new MockTeamAgent('qa');
      registry.register(mockTeam);
      registry.register(qaTeam);

      const teams = registry.getAll();

      expect(teams.length).toBe(2);
      expect(teams).toContain(mockTeam);
      expect(teams).toContain(qaTeam);
    });

    it('should find teams for task type', async () => {
      await mockTeam.start();
      registry.register(mockTeam);

      const results = registry.findTeamsForTaskType('feature');

      expect(results.length).toBe(1);
      expect(results[0].team).toBe(mockTeam);
      expect(results[0].capability.name).toBe('feature-dev');
    });

    it('should get best team for task type', async () => {
      await mockTeam.start();
      registry.register(mockTeam);

      const result = registry.getBestTeamForTaskType('feature');

      expect(result).toBeDefined();
      expect(result?.team).toBe(mockTeam);
    });

    it('should return undefined when no team can handle task type', () => {
      registry.register(mockTeam);

      const result = registry.getBestTeamForTaskType('infrastructure');

      expect(result).toBeUndefined();
    });

    it('should get registry statistics', () => {
      registry.register(mockTeam);

      const stats = registry.getStats();

      expect(stats.totalTeams).toBe(1);
      expect(stats.totalCapabilities).toBe(1);
    });

    it('should start all teams', async () => {
      registry.register(mockTeam);

      await registry.startAll();

      expect(mockTeam.status).toBe(TeamAgentStatus.IDLE);
    });

    it('should stop all teams', async () => {
      registry.register(mockTeam);
      await mockTeam.start();

      await registry.stopAll();

      expect(mockTeam.status).toBe(TeamAgentStatus.STOPPED);
    });

    it('should emit events on registration', (done) => {
      registry.on('team:registered', (team) => {
        expect(team).toBe(mockTeam);
        done();
      });

      registry.register(mockTeam);
    });
  });

  describe('TaskRouter', () => {
    let registry: TeamRegistry;
    let router: TaskRouter;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'router-test-'));
      registry = new TeamRegistry();

      // Create mock queue (we'll use the real DocumentQueue)
      const { DocumentQueue, WorkspaceManager } = await import('@/core/workspace');
      const workspace = new WorkspaceManager({ baseDir: tempDir });
      const queue = new DocumentQueue(workspace);
      await queue.initialize();

      router = new TaskRouter(registry, queue);
    });

    afterEach(async () => {
      registry.destroy();
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should make routing decision by capability', async () => {
      const devTeam = new MockTeamAgent('development', {
        capabilities: [
          {
            name: 'feature-dev',
            description: 'Feature development',
            taskTypes: ['feature'],
            priority: 80,
          },
        ],
      });
      await devTeam.start();
      registry.register(devTeam);

      const decision = router.makeRoutingDecision('feature');

      expect(decision).toBeDefined();
      expect(decision?.targetTeam).toBe('development');
    });

    it('should use default mapping when no team registered', () => {
      const decision = router.makeRoutingDecision('feature');

      expect(decision).toBeDefined();
      expect(decision?.targetTeam).toBe('development'); // Default mapping
      expect(decision?.confidence).toBeLessThan(1);
    });

    it('should get suggested team', async () => {
      const devTeam = new MockTeamAgent('development', {
        capabilities: [
          {
            name: 'feature-dev',
            description: 'Feature development',
            taskTypes: ['feature'],
            priority: 80,
          },
        ],
      });
      await devTeam.start();
      registry.register(devTeam);

      const suggested = router.getSuggestedTeam('feature');

      expect(suggested).toBe('development');
    });

    it('should get all possible teams for task type', () => {
      const teams = router.getPossibleTeams('feature');

      expect(teams).toContain('development');
      expect(teams).toContain('frontend');
      expect(teams).toContain('backend');
    });

    it('should validate routing configuration', () => {
      const validation = router.validateRouting('feature');

      expect(validation.valid).toBe(true);
      expect(validation.hasDefaultMapping).toBe(true);
      expect(validation.availableTeams.length).toBeGreaterThan(0);
    });

    it('should route task and publish to queue', async () => {
      const task = await router.route({
        title: 'Test Task',
        type: 'feature',
        from: 'planning',
        to: 'development', // Will be overridden
      });

      expect(task.metadata.id).toMatch(/^task_/);
      expect(task.metadata.to).toBe('development'); // Should match routing decision
    });
  });

  describe('CEOOrchestrator', () => {
    let orchestrator: CEOOrchestrator;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ceo-test-'));
      orchestrator = new CEOOrchestrator({
        workspaceDir: tempDir,
        autoStartTeams: false,
        healthCheckInterval: 60000, // Long interval to avoid interference
      });
    });

    afterEach(async () => {
      await orchestrator.destroy();
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    });

    it('should start and stop', async () => {
      expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);

      await orchestrator.start();
      expect(orchestrator.currentStatus).toBe(CEOStatus.RUNNING);

      await orchestrator.stop();
      expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);
    });

    it('should pause and resume', async () => {
      await orchestrator.start();

      await orchestrator.pause();
      expect(orchestrator.currentStatus).toBe(CEOStatus.PAUSED);

      await orchestrator.resume();
      expect(orchestrator.currentStatus).toBe(CEOStatus.RUNNING);
    });

    it('should register and unregister teams', async () => {
      const mockTeam = new MockTeamAgent('development');

      orchestrator.registerTeam(mockTeam);
      expect(orchestrator.teams.has('development')).toBe(true);

      orchestrator.unregisterTeam('development');
      expect(orchestrator.teams.has('development')).toBe(false);
    });

    it('should submit task when running', async () => {
      await orchestrator.start();

      const task = await orchestrator.submitTask({
        title: 'Test Task',
        type: 'feature',
        from: 'orchestrator',
        to: 'development',
      });

      expect(task.metadata.id).toMatch(/^task_/);
      expect(task.metadata.title).toBe('Test Task');
    });

    it('should throw error when submitting task while stopped', async () => {
      await expect(
        orchestrator.submitTask({
          title: 'Test Task',
          type: 'feature',
          from: 'orchestrator',
          to: 'development',
        })
      ).rejects.toThrow('Orchestrator is not running');
    });

    it('should get statistics', async () => {
      await orchestrator.start();

      const stats = orchestrator.getStats();

      expect(stats.status).toBe(CEOStatus.RUNNING);
      expect(stats.totalTasksSubmitted).toBe(0);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should perform health check', async () => {
      const mockTeam = new MockTeamAgent('development');
      await mockTeam.start();
      orchestrator.registerTeam(mockTeam);
      await orchestrator.start();

      const health = await orchestrator.healthCheck();

      expect(health.get('development')).toEqual({
        healthy: true,
        status: TeamAgentStatus.IDLE,
      });
    });

    it('should emit events', async () => {
      const events: string[] = [];

      orchestrator.on('started', () => events.push('started'));
      orchestrator.on('stopped', () => events.push('stopped'));

      await orchestrator.start();
      await orchestrator.stop();

      expect(events).toContain('started');
      expect(events).toContain('stopped');
    });

    it('should submit goal and create planning task', async () => {
      await orchestrator.start();

      const tasks = await orchestrator.submitGoal(
        'Implement User Authentication',
        'Add login, registration, and password reset features',
        { priority: 'high' }
      );

      expect(tasks.length).toBe(1);
      expect(tasks[0].metadata.type).toBe('planning');
      expect(tasks[0].metadata.tags).toContain('goal');
    });
  });
});
