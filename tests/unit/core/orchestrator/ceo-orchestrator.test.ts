/**
 * CEO Orchestrator Tests
 */

import {
  CEOOrchestrator,
  CEOStatus,
  createOrchestrator,
} from '../../../../src/core/orchestrator/ceo-orchestrator';
import { RoutingStrategy } from '../../../../src/core/orchestrator/task-router';
import { TeamAgentStatus } from '../../../../src/core/orchestrator/team-agent';
import type { ITeamAgent } from '../../../../src/core/orchestrator/team-agent';
import type { TaskDocument } from '../../../../src/core/workspace/task-document';

// ============================================================================
// Mocks
// ============================================================================

const mockWorkspaceInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock('../../../../src/core/workspace/workspace-manager', () => ({
  WorkspaceManager: jest.fn().mockImplementation(() => ({
    initialize: mockWorkspaceInitialize,
  })),
}));

const mockQueueInitialize = jest.fn().mockResolvedValue(undefined);
const mockQueueStop = jest.fn().mockResolvedValue(undefined);
const mockQueueOn = jest.fn();
const mockQueueGetTask = jest.fn().mockResolvedValue(null);
const mockQueueGetTasks = jest.fn().mockResolvedValue([]);

jest.mock('../../../../src/core/workspace/document-queue', () => ({
  DocumentQueue: jest.fn().mockImplementation(() => ({
    initialize: mockQueueInitialize,
    stop: mockQueueStop,
    on: mockQueueOn,
    getTask: mockQueueGetTask,
    getTasks: mockQueueGetTasks,
    emit: jest.fn(),
  })),
}));

const mockRegistryRegister = jest.fn();
const mockRegistryUnregister = jest.fn().mockReturnValue(true);
const mockRegistryStartAll = jest.fn().mockResolvedValue(undefined);
const mockRegistryStopAll = jest.fn().mockResolvedValue(undefined);
const mockRegistryGet = jest.fn().mockReturnValue(null);
const mockRegistryGetAll = jest.fn().mockReturnValue([]);
const mockRegistryGetTeamsByStatus = jest.fn().mockReturnValue([]);
const mockRegistryDestroy = jest.fn();
const mockRegistryOn = jest.fn();

jest.mock('../../../../src/core/orchestrator/team-registry', () => ({
  TeamRegistry: jest.fn().mockImplementation(() => ({
    register: mockRegistryRegister,
    unregister: mockRegistryUnregister,
    startAll: mockRegistryStartAll,
    stopAll: mockRegistryStopAll,
    get: mockRegistryGet,
    getAll: mockRegistryGetAll,
    getTeamsByStatus: mockRegistryGetTeamsByStatus,
    destroy: mockRegistryDestroy,
    on: mockRegistryOn,
  })),
}));

const mockRouterRoute = jest.fn();
const mockRouterGetSuggestedTeam = jest.fn().mockReturnValue('development');
const mockRouterOn = jest.fn();

jest.mock('../../../../src/core/orchestrator/task-router', () => {
  const actual = jest.requireActual('../../../../src/core/orchestrator/task-router');
  return {
    ...actual,
    TaskRouter: jest.fn().mockImplementation(() => ({
      route: mockRouterRoute,
      getSuggestedTeam: mockRouterGetSuggestedTeam,
      on: mockRouterOn,
    })),
  };
});

// ============================================================================
// Helpers
// ============================================================================

function makeTaskDoc(overrides: Partial<{
  id: string;
  title: string;
  type: string;
  to: string;
  from: string;
  priority: string;
  tags: string[];
  projectId: string;
}> = {}): TaskDocument {
  return {
    metadata: {
      id: overrides.id || 'task-1',
      title: overrides.title || 'Test Task',
      type: overrides.type || 'feature',
      from: overrides.from || 'orchestrator',
      to: overrides.to || 'development',
      priority: overrides.priority || 'medium',
      status: 'pending',
      tags: overrides.tags || [],
      projectId: overrides.projectId,
    },
    content: 'task content',
  } as unknown as TaskDocument;
}

function makeMockTeamAgent(teamType: string): ITeamAgent {
  return {
    id: `${teamType}-1`,
    teamType,
    config: { name: `${teamType} team`, teamType, capabilities: [], maxConcurrentTasks: 3, taskTimeout: 300000, autoStart: true, description: '' },
    status: TeamAgentStatus.IDLE,
    metrics: { tasksProcessed: 0, tasksFailed: 0, tasksInProgress: 0, averageProcessingTime: 0, uptime: 0, lastActiveAt: null, successRate: 1 },
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    canHandle: jest.fn().mockReturnValue(true),
    registerHandler: jest.fn(),
    getCapability: jest.fn(),
    getLoad: jest.fn().mockReturnValue(0.2),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true, status: TeamAgentStatus.IDLE }),
  } as unknown as ITeamAgent;
}

// ============================================================================
// Tests
// ============================================================================

describe('CEOOrchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==========================================================================
  // Constructor
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default config', () => {
      const orchestrator = new CEOOrchestrator();
      expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);
    });

    it('should accept custom config', () => {
      const orchestrator = new CEOOrchestrator({
        maxConcurrentTasks: 10,
        routingStrategy: RoutingStrategy.ROUND_ROBIN,
      });
      expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);
    });
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('should start and transition to RUNNING', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });

      await orchestrator.start();

      expect(orchestrator.currentStatus).toBe(CEOStatus.RUNNING);
      expect(mockWorkspaceInitialize).toHaveBeenCalled();
      expect(mockQueueInitialize).toHaveBeenCalled();
      expect(mockRegistryStartAll).toHaveBeenCalled();
    });

    it('should not start again if already RUNNING', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });

      await orchestrator.start();
      mockWorkspaceInitialize.mockClear();
      await orchestrator.start();

      expect(mockWorkspaceInitialize).not.toHaveBeenCalled();
    });

    it('should emit started event', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      const handler = jest.fn();
      orchestrator.on('started', handler);

      await orchestrator.start();

      expect(handler).toHaveBeenCalled();
    });

    it('should stop and transition to STOPPED', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      await orchestrator.stop();

      expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);
      expect(mockRegistryStopAll).toHaveBeenCalled();
      expect(mockQueueStop).toHaveBeenCalled();
    });

    it('should still perform cleanup even if already STOPPED', async () => {
      const orchestrator = new CEOOrchestrator();
      mockRegistryStopAll.mockClear();
      mockQueueStop.mockClear();

      await orchestrator.stop();

      expect(mockRegistryStopAll).toHaveBeenCalledTimes(1);
      expect(mockQueueStop).toHaveBeenCalledTimes(1);
    });

    it('should emit stopped event', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      const handler = jest.fn();
      orchestrator.on('stopped', handler);

      await orchestrator.stop();

      expect(handler).toHaveBeenCalled();
    });

    it('should set ERROR status on start failure', async () => {
      mockWorkspaceInitialize.mockRejectedValueOnce(new Error('init failed'));

      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      const errorHandler = jest.fn();
      orchestrator.on('error', errorHandler);

      await expect(orchestrator.start()).rejects.toThrow('init failed');
      expect(orchestrator.currentStatus).toBe(CEOStatus.ERROR);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should not auto-start teams when disabled', async () => {
      const orchestrator = new CEOOrchestrator({
        autoStartTeams: false,
        healthCheckInterval: 999999,
      });

      await orchestrator.start();

      expect(mockRegistryStartAll).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Pause / Resume
  // ==========================================================================

  describe('pause/resume', () => {
    it('should pause from RUNNING', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      await orchestrator.pause();

      expect(orchestrator.currentStatus).toBe(CEOStatus.PAUSED);
    });

    it('should not pause when not RUNNING', async () => {
      const orchestrator = new CEOOrchestrator();
      await orchestrator.pause();

      expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);
    });

    it('should resume from PAUSED to RUNNING', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();
      await orchestrator.pause();

      await orchestrator.resume();

      expect(orchestrator.currentStatus).toBe(CEOStatus.RUNNING);
    });

    it('should not resume when not PAUSED', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      await orchestrator.resume();

      expect(orchestrator.currentStatus).toBe(CEOStatus.RUNNING);
    });

    it('should emit paused/resumed events', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      const pauseHandler = jest.fn();
      const resumeHandler = jest.fn();
      orchestrator.on('paused', pauseHandler);
      orchestrator.on('resumed', resumeHandler);

      await orchestrator.pause();
      await orchestrator.resume();

      expect(pauseHandler).toHaveBeenCalled();
      expect(resumeHandler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Team registration
  // ==========================================================================

  describe('team registration', () => {
    it('should register a team', () => {
      const orchestrator = new CEOOrchestrator();
      const team = makeMockTeamAgent('development');

      orchestrator.registerTeam(team);

      expect(mockRegistryRegister).toHaveBeenCalledWith(team);
    });

    it('should emit team:registered event', () => {
      const orchestrator = new CEOOrchestrator();
      const team = makeMockTeamAgent('development');
      const handler = jest.fn();
      orchestrator.on('team:registered', handler);

      orchestrator.registerTeam(team);

      expect(handler).toHaveBeenCalledWith(team);
    });

    it('should unregister a team', () => {
      const orchestrator = new CEOOrchestrator();
      orchestrator.registerTeam(makeMockTeamAgent('development'));

      const result = orchestrator.unregisterTeam('development');

      expect(result).toBe(true);
      expect(mockRegistryUnregister).toHaveBeenCalledWith('development');
    });

    it('should emit team:unregistered event', () => {
      const orchestrator = new CEOOrchestrator();
      const handler = jest.fn();
      orchestrator.on('team:unregistered', handler);
      orchestrator.registerTeam(makeMockTeamAgent('qa'));

      orchestrator.unregisterTeam('qa');

      expect(handler).toHaveBeenCalledWith('qa');
    });
  });

  // ==========================================================================
  // Task submission
  // ==========================================================================

  describe('submitTask', () => {
    it('should submit a task when running', async () => {
      const taskDoc = makeTaskDoc();
      mockRouterRoute.mockResolvedValue(taskDoc);

      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      const result = await orchestrator.submitTask({
        title: 'Test Task',
        type: 'feature',
        from: 'orchestrator',
        to: 'development',
        priority: 'medium',
        tags: [],
        content: 'task content',
      });

      expect(result).toBe(taskDoc);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('should throw when not running', async () => {
      const orchestrator = new CEOOrchestrator();

      await expect(
        orchestrator.submitTask({
          title: 'Test',
          type: 'feature',
          from: 'orchestrator',
          to: 'development',
          priority: 'medium',
          tags: [],
          content: '',
        }),
      ).rejects.toThrow('not running');
    });

    it('should emit task:submitted event', async () => {
      const taskDoc = makeTaskDoc();
      mockRouterRoute.mockResolvedValue(taskDoc);

      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      const handler = jest.fn();
      orchestrator.on('task:submitted', handler);

      await orchestrator.submitTask({
        title: 'Test',
        type: 'feature',
        from: 'orchestrator',
        to: 'development',
        priority: 'medium',
        tags: [],
        content: '',
      });

      expect(handler).toHaveBeenCalledWith(taskDoc);
    });

    it('should track submission stats', async () => {
      const taskDoc = makeTaskDoc({ to: 'development' });
      mockRouterRoute.mockResolvedValue(taskDoc);

      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      orchestrator.registerTeam(makeMockTeamAgent('development'));
      await orchestrator.start();

      await orchestrator.submitTask({
        title: 'Test',
        type: 'feature',
        from: 'orchestrator',
        to: 'development',
        priority: 'medium',
        tags: [],
        content: '',
      });

      const stats = orchestrator.getStats();
      expect(stats.totalTasksSubmitted).toBe(1);
    });
  });

  // ==========================================================================
  // submitGoal
  // ==========================================================================

  describe('submitGoal', () => {
    it('should create planning task with decomposition enabled', async () => {
      const planningTask = makeTaskDoc({ type: 'planning', to: 'planning' });
      mockRouterRoute.mockResolvedValue(planningTask);

      const orchestrator = new CEOOrchestrator({
        enableDecomposition: true,
        healthCheckInterval: 999999,
      });
      await orchestrator.start();

      const tasks = await orchestrator.submitGoal('Build auth', 'Implement JWT auth');

      expect(tasks).toHaveLength(1);
      expect(mockRouterRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'planning',
          to: 'planning',
        }),
      );
    });

    it('should create single task when decomposition disabled', async () => {
      const task = makeTaskDoc({ type: 'planning' });
      mockRouterRoute.mockResolvedValue(task);

      const orchestrator = new CEOOrchestrator({
        enableDecomposition: false,
        healthCheckInterval: 999999,
      });
      await orchestrator.start();

      const tasks = await orchestrator.submitGoal('Simple task', 'Do something');

      expect(tasks).toHaveLength(1);
    });

    it('should include goal tags in planning task', async () => {
      const planningTask = makeTaskDoc({ tags: ['goal', 'decomposition', 'auth'] });
      mockRouterRoute.mockResolvedValue(planningTask);

      const orchestrator = new CEOOrchestrator({
        enableDecomposition: true,
        healthCheckInterval: 999999,
      });
      await orchestrator.start();

      await orchestrator.submitGoal('Build auth', 'JWT auth', {
        tags: ['auth'],
        priority: 'high',
      });

      expect(mockRouterRoute).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining(['goal', 'decomposition', 'auth']),
          priority: 'high',
        }),
      );
    });
  });

  // ==========================================================================
  // delegateTasks
  // ==========================================================================

  describe('delegateTasks', () => {
    it('should create sub-tasks from parent task', async () => {
      const subTask1 = makeTaskDoc({ id: 'sub-1' });
      const subTask2 = makeTaskDoc({ id: 'sub-2' });
      mockRouterRoute
        .mockResolvedValueOnce(subTask1)
        .mockResolvedValueOnce(subTask2);

      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      const parentTask = makeTaskDoc({ id: 'parent-1', tags: ['feature'] });
      const tasks = await orchestrator.delegateTasks(parentTask, [
        { title: 'Sub-task 1', type: 'feature' },
        { title: 'Sub-task 2', type: 'test' },
      ]);

      expect(tasks).toHaveLength(2);
      expect(mockRouterRoute).toHaveBeenCalledTimes(2);
    });

    it('should emit task:decomposed event', async () => {
      mockRouterRoute.mockResolvedValue(makeTaskDoc());

      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      const handler = jest.fn();
      orchestrator.on('task:decomposed', handler);

      const parentTask = makeTaskDoc();
      await orchestrator.delegateTasks(parentTask, [
        { title: 'Sub', type: 'feature' },
      ]);

      expect(handler).toHaveBeenCalledWith(parentTask, expect.any(Array));
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe('getStats', () => {
    it('should return initial stats', () => {
      const orchestrator = new CEOOrchestrator();
      const stats = orchestrator.getStats();

      expect(stats.status).toBe(CEOStatus.STOPPED);
      expect(stats.totalTasksSubmitted).toBe(0);
      expect(stats.totalTasksCompleted).toBe(0);
      expect(stats.totalTasksFailed).toBe(0);
      expect(stats.uptime).toBe(0);
    });

    it('should track uptime when started', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      jest.advanceTimersByTime(1000);

      const stats = orchestrator.getStats();
      expect(stats.uptime).toBeGreaterThanOrEqual(1000);
    });

    it('should include team stats', () => {
      const orchestrator = new CEOOrchestrator();
      const team = makeMockTeamAgent('development');
      mockRegistryGet.mockReturnValue(team);
      orchestrator.registerTeam(team);

      const stats = orchestrator.getStats();
      expect(stats.teamStats.has('development')).toBe(true);
    });
  });

  // ==========================================================================
  // getTask / getTasks
  // ==========================================================================

  describe('getTask', () => {
    it('should delegate to queue', async () => {
      const taskDoc = makeTaskDoc();
      mockQueueGetTask.mockResolvedValueOnce(taskDoc);

      const orchestrator = new CEOOrchestrator();
      const result = await orchestrator.getTask('task-1');

      expect(result).toBe(taskDoc);
      expect(mockQueueGetTask).toHaveBeenCalledWith('task-1');
    });
  });

  describe('getTasks', () => {
    it('should delegate to queue with filter', async () => {
      const tasks = [makeTaskDoc()];
      mockQueueGetTasks.mockResolvedValueOnce(tasks);

      const orchestrator = new CEOOrchestrator();
      const result = await orchestrator.getTasks({
        status: ['pending'],
        type: ['feature'],
      });

      expect(result).toBe(tasks);
    });
  });

  // ==========================================================================
  // healthCheck
  // ==========================================================================

  describe('healthCheck', () => {
    it('should check health of all teams', async () => {
      const team = makeMockTeamAgent('development');
      mockRegistryGetAll.mockReturnValue([team]);

      const orchestrator = new CEOOrchestrator();
      const results = await orchestrator.healthCheck();

      expect(results.has('development')).toBe(true);
      expect(results.get('development')!.healthy).toBe(true);
    });

    it('should handle team health check failure', async () => {
      const team = makeMockTeamAgent('qa');
      (team.healthCheck as jest.Mock).mockRejectedValueOnce(new Error('health fail'));
      mockRegistryGetAll.mockReturnValue([team]);

      const orchestrator = new CEOOrchestrator();
      const results = await orchestrator.healthCheck();

      expect(results.get('qa')!.healthy).toBe(false);
      expect(results.get('qa')!.status).toBe(TeamAgentStatus.ERROR);
    });
  });

  // ==========================================================================
  // Accessors
  // ==========================================================================

  describe('accessors', () => {
    it('should expose teams registry', () => {
      const orchestrator = new CEOOrchestrator();
      expect(orchestrator.teams).toBeDefined();
    });

    it('should expose task queue', () => {
      const orchestrator = new CEOOrchestrator();
      expect(orchestrator.taskQueue).toBeDefined();
    });
  });

  // ==========================================================================
  // destroy
  // ==========================================================================

  describe('destroy', () => {
    it('should stop and clean up resources', async () => {
      const orchestrator = new CEOOrchestrator({ healthCheckInterval: 999999 });
      await orchestrator.start();

      await orchestrator.destroy();

      expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);
      expect(mockRegistryDestroy).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Factory
// ============================================================================

describe('createOrchestrator', () => {
  it('should create CEOOrchestrator', () => {
    const orchestrator = createOrchestrator();
    expect(orchestrator).toBeInstanceOf(CEOOrchestrator);
  });

  it('should pass config to constructor', () => {
    const orchestrator = createOrchestrator({
      maxConcurrentTasks: 50,
    });
    expect(orchestrator.currentStatus).toBe(CEOStatus.STOPPED);
  });
});
