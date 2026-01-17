/**
 * Base Team Tests
 *
 * Tests for the BaseTeam abstract class.
 */

import {
  BaseTeam,
  createTask,
  createRole,
} from '../../../../src/core/teams/base-team';
import {
  TeamConfig,
  TeamType,
  TeamCapability,
  TeamStatus,
  TaskDocument,
  TaskResult,
  TaskPriority,
  TaskStatus,
} from '../../../../src/core/teams/team-types';

// Concrete implementation for testing
class TestTeam extends BaseTeam {
  public processedTasks: TaskDocument[] = [];

  protected async processTask(task: TaskDocument): Promise<TaskResult> {
    this.processedTasks.push(task);
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

describe('BaseTeam', () => {
  let team: TestTeam;

  const createTeamConfig = (overrides: Partial<TeamConfig> = {}): TeamConfig => ({
    id: 'test-team-1',
    name: 'Test Team',
    type: TeamType.PLANNING,
    capabilities: [TeamCapability.TASK_DECOMPOSITION],
    maxConcurrentTasks: 3,
    taskTimeoutMs: 5000,
    autoRetry: false,
    maxRetries: 0,
    metadata: {},
    ...overrides,
  });

  beforeEach(() => {
    team = new TestTeam(createTeamConfig());
  });

  afterEach(async () => {
    if (team.getStatus() !== TeamStatus.TERMINATED) {
      await team.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize correctly', async () => {
      await team.initialize();
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });

    it('should have correct properties', () => {
      expect(team.id).toBe('test-team-1');
      expect(team.name).toBe('Test Team');
      expect(team.type).toBe(TeamType.PLANNING);
      expect(team.capabilities).toContain(TeamCapability.TASK_DECOMPOSITION);
    });
  });

  describe('Lifecycle', () => {
    beforeEach(async () => {
      await team.initialize();
    });

    it('should start correctly', async () => {
      await team.start();
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });

    it('should stop correctly', async () => {
      await team.start();
      await team.stop();
      expect(team.getStatus()).toBe(TeamStatus.TERMINATED);
    });

    it('should pause and resume', async () => {
      await team.start();
      team.pause();
      expect(team.getStatus()).toBe(TeamStatus.PAUSED);

      team.resume();
      expect(team.getStatus()).toBe(TeamStatus.IDLE);
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      await team.initialize();
      await team.start();
    });

    it('should submit tasks', async () => {
      const taskId = await team.submitTask(
        createTask('Test Task', 'A test task')
      );

      expect(taskId).toBeDefined();
      expect(team.getQueueLength()).toBe(1);
    });

    it('should process tasks', async () => {
      await team.submitTask(createTask('Test Task', 'A test task'));

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(team.processedTasks.length).toBe(1);
    });

    it('should track statistics', async () => {
      await team.submitTask(createTask('Test Task', 'A test task'));

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const stats = team.getStats();
      expect(stats.tasksReceived).toBe(1);
      expect(stats.tasksCompleted).toBe(1);
    });

    it('should emit task events', async () => {
      const receivedHandler = jest.fn();
      const completedHandler = jest.fn();

      team.on('task:received', receivedHandler);
      team.on('task:completed', completedHandler);

      await team.submitTask(createTask('Test Task', 'A test task'));

      expect(receivedHandler).toHaveBeenCalled();

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(completedHandler).toHaveBeenCalled();
    });

    it('should respect max concurrent tasks', async () => {
      const manyTeam = new TestTeam(createTeamConfig({ maxConcurrentTasks: 1 }));
      await manyTeam.initialize();
      await manyTeam.start();

      await manyTeam.submitTask(createTask('Task 1', 'First task'));
      await manyTeam.submitTask(createTask('Task 2', 'Second task'));
      await manyTeam.submitTask(createTask('Task 3', 'Third task'));

      expect(manyTeam.getQueueLength()).toBeGreaterThanOrEqual(2);
      expect(manyTeam.getActiveTaskCount()).toBeLessThanOrEqual(1);

      await manyTeam.stop();
    });
  });

  describe('Capability Check', () => {
    it('should correctly check capabilities', () => {
      expect(team.hasCapability('task_decomposition')).toBe(true);
      expect(team.hasCapability('code_generation')).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should return readonly config', () => {
      const config = team.getConfig();
      expect(config.id).toBe('test-team-1');
      expect(config.name).toBe('Test Team');
    });
  });
});

describe('Helper Functions', () => {
  describe('createTask', () => {
    it('should create a task with defaults', () => {
      const task = createTask('Test Task', 'A test task');

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Test Task');
      expect(task.description).toBe('A test task');
      expect(task.priority).toBe(TaskPriority.NORMAL);
      expect(task.status).toBe(TaskStatus.PENDING);
    });

    it('should accept custom options', () => {
      const task = createTask('Test Task', 'A test task', {
        priority: TaskPriority.HIGH,
        type: 'development',
      });

      expect(task.priority).toBe(TaskPriority.HIGH);
      expect(task.type).toBe('development');
    });
  });

  describe('createRole', () => {
    it('should create a role', () => {
      const role = createRole(
        'Test Role',
        'A test role',
        'You are a test agent'
      );

      expect(role.id).toBeDefined();
      expect(role.name).toBe('Test Role');
      expect(role.description).toBe('A test role');
      expect(role.systemPrompt).toBe('You are a test agent');
    });

    it('should accept custom options', () => {
      const role = createRole(
        'Test Role',
        'A test role',
        'You are a test agent',
        {
          capabilities: [TeamCapability.CODE_GENERATION],
          tools: ['read', 'write'],
        }
      );

      expect(role.capabilities).toContain(TeamCapability.CODE_GENERATION);
      expect(role.tools).toContain('read');
    });
  });
});
