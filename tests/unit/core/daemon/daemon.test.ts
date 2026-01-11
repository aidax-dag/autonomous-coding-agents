/**
 * Daemon Tests
 *
 * Tests for 24/7 continuous execution, task polling, project management,
 * and health monitoring.
 *
 * @module tests/unit/core/daemon/daemon
 */

import {
  Daemon,
  createDaemon,
  MockAgentDispatcher,
  DaemonStatus,
  DaemonEvent,
  DEFAULT_DAEMON_CONFIG,
} from '../../../../src/core/daemon/daemon';
import {
  ProjectStore,
  InMemoryStorageAdapter,
  TaskStatus,
} from '../../../../src/core/memory/project-store';

// ============================================================================
// Test Helpers
// ============================================================================

async function createTestSetup(dispatcherOptions?: { delay?: number; failureRate?: number }) {
  const storage = new InMemoryStorageAdapter();
  const projectStore = new ProjectStore({ verbose: false }, storage);
  await projectStore.initialize();

  const dispatcher = new MockAgentDispatcher(
    dispatcherOptions?.delay ?? 50,
    dispatcherOptions?.failureRate ?? 0
  );

  const daemon = new Daemon(projectStore, dispatcher, {
    pollInterval: 100,
    verbose: false,
    maxConsecutiveErrors: 5,
    autoRestart: false,
  });

  return { projectStore, dispatcher, daemon };
}

async function createProjectWithTasks(projectStore: ProjectStore, taskCount = 3) {
  const project = await projectStore.createProject({
    name: 'Test Project',
    description: 'A test project for daemon',
  });

  for (let i = 0; i < taskCount; i++) {
    await projectStore.addTask(project.id, {
      id: `task_${i}`,
      name: `Task ${i}`,
      description: `Description for task ${i}`,
      status: TaskStatus.PENDING,
      dependencies: i > 0 ? [`task_${i - 1}`] : [],
      metadata: {},
    });
  }

  return project;
}

// ============================================================================
// Tests
// ============================================================================

describe('Daemon', () => {
  let projectStore: ProjectStore;
  let daemon: Daemon;

  afterEach(async () => {
    if (daemon && daemon.getStatus() !== DaemonStatus.STOPPED) {
      await daemon.stop();
    }
    if (projectStore) {
      await projectStore.dispose();
    }
  });

  describe('Factory Function', () => {
    it('should create instance via createDaemon', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      const instance = createDaemon(setup.projectStore, setup.dispatcher);
      expect(instance).toBeInstanceOf(Daemon);
    });

    it('should accept custom configuration', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      const instance = createDaemon(setup.projectStore, setup.dispatcher, {
        pollInterval: 1000,
        maxConcurrentProjects: 10,
      });
      expect(instance).toBeInstanceOf(Daemon);
    });
  });

  describe('Lifecycle', () => {
    it('should start and stop', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      expect(daemon.getStatus()).toBe(DaemonStatus.STOPPED);

      await daemon.start();
      expect(daemon.getStatus()).toBe(DaemonStatus.RUNNING);

      await daemon.stop();
      expect(daemon.getStatus()).toBe(DaemonStatus.STOPPED);
    });

    it('should not start twice', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      await daemon.start();
      await daemon.start(); // Should not throw

      expect(daemon.getStatus()).toBe(DaemonStatus.RUNNING);
    });

    it('should pause and resume', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      await daemon.start();
      expect(daemon.getStatus()).toBe(DaemonStatus.RUNNING);

      await daemon.pause();
      expect(daemon.getStatus()).toBe(DaemonStatus.PAUSED);

      await daemon.resume();
      expect(daemon.getStatus()).toBe(DaemonStatus.RUNNING);
    });

    it('should emit lifecycle events', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const events: string[] = [];
      daemon.on(DaemonEvent.STARTED, () => events.push('started'));
      daemon.on(DaemonEvent.PAUSED, () => events.push('paused'));
      daemon.on(DaemonEvent.RESUMED, () => events.push('resumed'));
      daemon.on(DaemonEvent.STOPPED, () => events.push('stopped'));

      await daemon.start();
      await daemon.pause();
      await daemon.resume();
      await daemon.stop();

      expect(events).toEqual(['started', 'paused', 'resumed', 'stopped']);
    });

    it('should throw when pausing non-running daemon', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      await expect(daemon.pause()).rejects.toThrow('Can only pause a running daemon');
    });

    it('should throw when resuming non-paused daemon', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      await daemon.start();
      await expect(daemon.resume()).rejects.toThrow('Can only resume a paused daemon');
    });
  });

  describe('Project Management', () => {
    it('should add project', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await createProjectWithTasks(projectStore, 1);

      await daemon.start();
      await daemon.addProject(project.id);

      const projects = daemon.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].projectId).toBe(project.id);
    });

    it('should remove project', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await createProjectWithTasks(projectStore, 1);

      await daemon.start();
      await daemon.addProject(project.id);
      expect(daemon.getProjects()).toHaveLength(1);

      await daemon.removeProject(project.id);
      expect(daemon.getProjects()).toHaveLength(0);
    });

    it('should throw when adding non-existent project', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      await daemon.start();
      await expect(daemon.addProject('non_existent')).rejects.toThrow('Project not found');
    });

    it('should emit project events', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const events: string[] = [];
      daemon.on(DaemonEvent.PROJECT_ADDED, () => events.push('added'));
      daemon.on(DaemonEvent.PROJECT_REMOVED, () => events.push('removed'));

      const project = await createProjectWithTasks(projectStore, 1);

      await daemon.start();
      await daemon.addProject(project.id);
      await daemon.removeProject(project.id);

      expect(events).toContain('added');
      expect(events).toContain('removed');
    });

    it('should accept project options', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await createProjectWithTasks(projectStore, 1);

      await daemon.start();
      await daemon.addProject(project.id, {
        priority: 10,
        maxRetries: 5,
        timeout: 60000,
      });

      const projects = daemon.getProjects();
      expect(projects[0].priority).toBe(10);
      expect(projects[0].maxRetries).toBe(5);
      expect(projects[0].timeout).toBe(60000);
    });
  });

  describe('Task Execution', () => {
    it('should process tasks', async () => {
      const setup = await createTestSetup({ delay: 10 });
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await createProjectWithTasks(projectStore, 2);

      const taskEvents: string[] = [];
      daemon.on(DaemonEvent.TASK_STARTED, () => taskEvents.push('started'));
      daemon.on(DaemonEvent.TASK_COMPLETED, () => taskEvents.push('completed'));

      await daemon.start();
      await daemon.addProject(project.id);

      // Wait for tasks to be processed
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(taskEvents).toContain('started');
      expect(taskEvents).toContain('completed');
    });

    it('should respect task dependencies', async () => {
      const setup = await createTestSetup({ delay: 10 });
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await createProjectWithTasks(projectStore, 3);

      const completedTasks: string[] = [];
      daemon.on(DaemonEvent.TASK_COMPLETED, (result) => {
        completedTasks.push(result.taskId);
      });

      await daemon.start();
      await daemon.addProject(project.id);

      // Wait for all tasks
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Tasks should complete in order due to dependencies
      expect(completedTasks.indexOf('task_0')).toBeLessThan(completedTasks.indexOf('task_1'));
      expect(completedTasks.indexOf('task_1')).toBeLessThan(completedTasks.indexOf('task_2'));
    });

    it('should handle task failures', async () => {
      const setup = await createTestSetup({ delay: 10, failureRate: 1.0 }); // Always fail
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await projectStore.createProject({ name: 'Fail Project' });
      await projectStore.addTask(project.id, {
        id: 'fail_task',
        name: 'Failing Task',
        description: 'This task will fail',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      const failEvents: string[] = [];
      daemon.on(DaemonEvent.TASK_FAILED, () => failEvents.push('failed'));
      daemon.on(DaemonEvent.ERROR, () => {}); // Prevent unhandled error

      await daemon.start();
      await daemon.addProject(project.id, { maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(failEvents).toContain('failed');
    });

    it('should complete project when all tasks done', async () => {
      const setup = await createTestSetup({ delay: 10 });
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await createProjectWithTasks(projectStore, 1);

      const projectEvents: string[] = [];
      daemon.on(DaemonEvent.PROJECT_COMPLETED, () => projectEvents.push('completed'));

      await daemon.start();
      await daemon.addProject(project.id);

      // Wait for completion
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(projectEvents).toContain('completed');
    });
  });

  describe('Health Monitoring', () => {
    it('should provide health metrics', async () => {
      const setup = await createTestSetup();
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      await daemon.start();

      const health = daemon.getHealth();

      expect(health.status).toBe(DaemonStatus.RUNNING);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
      expect(health.projectCount).toBe(0);
      expect(health.totalTasksProcessed).toBe(0);
      expect(health.memoryUsage).toBeDefined();
    });

    it('should track task metrics', async () => {
      const setup = await createTestSetup({ delay: 10 });
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await createProjectWithTasks(projectStore, 2);

      await daemon.start();
      await daemon.addProject(project.id);

      // Wait for tasks
      await new Promise(resolve => setTimeout(resolve, 500));

      const health = daemon.getHealth();
      expect(health.totalTasksProcessed).toBeGreaterThan(0);
      expect(health.totalTasksSucceeded).toBeGreaterThan(0);
    });

    it('should emit health check events', async () => {
      const storage = new InMemoryStorageAdapter();
      projectStore = new ProjectStore({ verbose: false }, storage);
      await projectStore.initialize();

      const dispatcher = new MockAgentDispatcher(10, 0);
      daemon = new Daemon(projectStore, dispatcher, {
        pollInterval: 1000,
        healthCheckInterval: 100, // Fast health checks for testing
        verbose: false,
      });

      const healthEvents: number[] = [];
      daemon.on(DaemonEvent.HEALTH_CHECK, () => healthEvents.push(Date.now()));

      await daemon.start();
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(healthEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should record errors', async () => {
      const setup = await createTestSetup({ delay: 10, failureRate: 1.0 });
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const project = await projectStore.createProject({ name: 'Error Project' });
      await projectStore.addTask(project.id, {
        id: 'error_task',
        name: 'Error Task',
        description: 'This task will error',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      daemon.on(DaemonEvent.ERROR, () => {}); // Prevent unhandled error

      await daemon.start();
      await daemon.addProject(project.id, { maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 300));

      const health = daemon.getHealth();
      expect(health.errors.length).toBeGreaterThan(0);
    });

    it('should emit error events', async () => {
      const setup = await createTestSetup({ delay: 10, failureRate: 1.0 });
      projectStore = setup.projectStore;
      daemon = setup.daemon;

      const errorEvents: string[] = [];
      daemon.on(DaemonEvent.ERROR, (error) => errorEvents.push(error.error));

      const project = await projectStore.createProject({ name: 'Error Project' });
      await projectStore.addTask(project.id, {
        id: 'error_task',
        name: 'Error Task',
        description: 'This task will error',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      await daemon.start();
      await daemon.addProject(project.id, { maxRetries: 0 });

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(errorEvents.length).toBeGreaterThan(0);
    });

    it('should pause after too many consecutive errors', async () => {
      const storage = new InMemoryStorageAdapter();
      projectStore = new ProjectStore({ verbose: false }, storage);
      await projectStore.initialize();

      const dispatcher = new MockAgentDispatcher(10, 1.0); // Always fail
      daemon = new Daemon(projectStore, dispatcher, {
        pollInterval: 50,
        verbose: false,
        maxConsecutiveErrors: 3,
        autoRestart: false,
      });

      daemon.on(DaemonEvent.ERROR, () => {}); // Prevent unhandled error

      // Create project with multiple independent tasks
      const project = await projectStore.createProject({ name: 'Error Project' });
      for (let i = 0; i < 5; i++) {
        await projectStore.addTask(project.id, {
          id: `task_${i}`,
          name: `Task ${i}`,
          description: 'Will fail',
          status: TaskStatus.PENDING,
          dependencies: [],
          metadata: {},
        });
      }

      await daemon.start();
      await daemon.addProject(project.id, { maxRetries: 0 });

      // Wait for errors to accumulate
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(daemon.getStatus()).toBe(DaemonStatus.PAUSED);
    });
  });

  describe('Defaults', () => {
    it('should have correct default configuration values', () => {
      expect(DEFAULT_DAEMON_CONFIG.pollInterval).toBe(5000);
      expect(DEFAULT_DAEMON_CONFIG.maxConcurrentProjects).toBe(5);
      expect(DEFAULT_DAEMON_CONFIG.maxConcurrentTasks).toBe(3);
      expect(DEFAULT_DAEMON_CONFIG.defaultMaxRetries).toBe(3);
      expect(DEFAULT_DAEMON_CONFIG.autoRestart).toBe(true);
    });
  });
});

describe('MockAgentDispatcher', () => {
  it('should dispatch tasks successfully', async () => {
    const dispatcher = new MockAgentDispatcher(10, 0);

    const task = {
      id: 'test_task',
      name: 'Test Task',
      description: 'Test',
      status: TaskStatus.PENDING,
      dependencies: [],
      attempts: 0,
      metadata: {},
    };

    const project = {
      id: 'test_project',
      name: 'Test Project',
    } as any;

    const result = await dispatcher.dispatch(task, project);

    expect(result.success).toBe(true);
    expect(result.taskId).toBe('test_task');
    expect(result.agentId).toBe('mock-agent');
  });

  it('should simulate failures', async () => {
    const dispatcher = new MockAgentDispatcher(10, 1.0); // Always fail

    const task = {
      id: 'fail_task',
      name: 'Fail Task',
      description: 'Will fail',
      status: TaskStatus.PENDING,
      dependencies: [],
      attempts: 0,
      metadata: {},
    };

    const result = await dispatcher.dispatch(task, {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Simulated failure');
  });

  it('should be available', async () => {
    const dispatcher = new MockAgentDispatcher();
    const available = await dispatcher.isAvailable();
    expect(available).toBe(true);
  });

  it('should return status', async () => {
    const dispatcher = new MockAgentDispatcher();
    const status = await dispatcher.getStatus();
    expect(status.available).toBe(true);
    expect(status.maxAgents).toBe(10);
  });
});
