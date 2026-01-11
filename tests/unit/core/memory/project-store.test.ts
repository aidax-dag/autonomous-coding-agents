/**
 * Project Store Tests
 *
 * Tests for project state persistence, checkpoints, context management,
 * and task tracking.
 *
 * @module tests/unit/core/memory/project-store
 */

import {
  ProjectStore,
  createProjectStore,
  InMemoryStorageAdapter,
  ProjectStatus,
  TaskStatus,
  ProjectStoreEvent,
  DEFAULT_PROJECT_STORE_CONFIG,
  type ProjectState,
} from '../../../../src/core/memory/project-store';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestStore(): ProjectStore {
  const storage = new InMemoryStorageAdapter();
  return new ProjectStore({ verbose: false }, storage);
}

async function createTestProject(store: ProjectStore, name = 'Test Project'): Promise<ProjectState> {
  return store.createProject({
    name,
    description: 'A test project',
    metadata: { test: true },
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('ProjectStore', () => {
  let store: ProjectStore;

  beforeEach(async () => {
    store = createTestStore();
    await store.initialize();
  });

  afterEach(async () => {
    await store.dispose();
  });

  describe('Factory Function', () => {
    it('should create instance via createProjectStore', () => {
      const instance = createProjectStore({}, new InMemoryStorageAdapter());
      expect(instance).toBeInstanceOf(ProjectStore);
    });

    it('should accept custom configuration', () => {
      const config = { maxCheckpoints: 5, verbose: true };
      const instance = createProjectStore(config, new InMemoryStorageAdapter());
      expect(instance).toBeInstanceOf(ProjectStore);
    });
  });

  describe('Project Lifecycle', () => {
    it('should create a new project', async () => {
      const project = await createTestProject(store);

      expect(project).toBeDefined();
      expect(project.id).toMatch(/^proj_/);
      expect(project.name).toBe('Test Project');
      expect(project.status).toBe(ProjectStatus.CREATED);
      expect(project.version).toBe(1);
    });

    it('should generate unique project IDs', async () => {
      const project1 = await createTestProject(store, 'Project 1');
      const project2 = await createTestProject(store, 'Project 2');

      expect(project1.id).not.toBe(project2.id);
    });

    it('should get project by ID', async () => {
      const created = await createTestProject(store);
      const retrieved = await store.getProject(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe(created.name);
    });

    it('should return null for non-existent project', async () => {
      const project = await store.getProject('non_existent_id');
      expect(project).toBeNull();
    });

    it('should update project', async () => {
      const project = await createTestProject(store);
      const updated = await store.updateProject(project.id, {
        status: ProjectStatus.IN_PROGRESS,
        description: 'Updated description',
      });

      expect(updated.status).toBe(ProjectStatus.IN_PROGRESS);
      expect(updated.description).toBe('Updated description');
      expect(updated.version).toBe(2);
    });

    it('should delete project', async () => {
      const project = await createTestProject(store);
      const deleted = await store.deleteProject(project.id);

      expect(deleted).toBe(true);
      const retrieved = await store.getProject(project.id);
      expect(retrieved).toBeNull();
    });

    it('should list projects', async () => {
      await createTestProject(store, 'Project 1');
      await createTestProject(store, 'Project 2');
      await createTestProject(store, 'Project 3');

      const projects = await store.listProjects();
      expect(projects).toHaveLength(3);
    });

    it('should filter projects by status', async () => {
      const p1 = await createTestProject(store, 'Project 1');
      await createTestProject(store, 'Project 2');
      await store.updateProject(p1.id, { status: ProjectStatus.COMPLETED });

      const completed = await store.listProjects({ status: ProjectStatus.COMPLETED });
      expect(completed).toHaveLength(1);
      expect(completed[0].name).toBe('Project 1');
    });
  });

  describe('State Persistence', () => {
    it('should save and load state', async () => {
      const project = await createTestProject(store);
      await store.updateProject(project.id, {
        status: ProjectStatus.IN_PROGRESS,
      });

      await store.saveState(project.id);

      // Clear cache and reload
      const newStore = createTestStore();
      await newStore.initialize();

      // Note: InMemoryStorageAdapter doesn't persist across instances
      // This test validates the API works correctly
      const loaded = await store.loadState(project.id);
      expect(loaded).toBeDefined();
      expect(loaded?.status).toBe(ProjectStatus.IN_PROGRESS);
    });

    it('should emit events on save/load', async () => {
      const project = await createTestProject(store);
      const events: string[] = [];

      store.on(ProjectStoreEvent.STATE_SAVED, () => events.push('saved'));
      store.on(ProjectStoreEvent.STATE_LOADED, () => events.push('loaded'));

      await store.saveState(project.id);
      await store.loadState(project.id);

      expect(events).toContain('saved');
      expect(events).toContain('loaded');
    });
  });

  describe('Checkpoints', () => {
    it('should create checkpoint', async () => {
      const project = await createTestProject(store);
      const checkpoint = await store.createCheckpoint(project.id, 'Initial state');

      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toMatch(/^chkpt_/);
      expect(checkpoint.name).toBe('Initial state');
      expect(checkpoint.projectId).toBe(project.id);
    });

    it('should list checkpoints for project', async () => {
      const project = await createTestProject(store);
      await store.createCheckpoint(project.id, 'Checkpoint 1');
      await store.createCheckpoint(project.id, 'Checkpoint 2');

      const checkpoints = await store.listCheckpoints(project.id);
      expect(checkpoints).toHaveLength(2);
    });

    it('should restore from checkpoint', async () => {
      const project = await createTestProject(store);

      // Make changes
      await store.updateProject(project.id, {
        description: 'Modified description',
        status: ProjectStatus.IN_PROGRESS,
      });

      // Create checkpoint
      const checkpoint = await store.createCheckpoint(project.id, 'Before breaking change');

      // Make more changes
      await store.updateProject(project.id, {
        description: 'Broken state',
        status: ProjectStatus.FAILED,
      });

      // Restore
      const restored = await store.restoreCheckpoint(checkpoint.id);

      expect(restored.description).toBe('Modified description');
      expect(restored.status).toBe(ProjectStatus.IN_PROGRESS);
    });

    it('should enforce max checkpoints', async () => {
      const store2 = new ProjectStore(
        { maxCheckpoints: 2, verbose: false },
        new InMemoryStorageAdapter()
      );
      await store2.initialize();

      const project = await store2.createProject({ name: 'Test' });

      await store2.createCheckpoint(project.id, 'Checkpoint 1');
      await store2.createCheckpoint(project.id, 'Checkpoint 2');
      await store2.createCheckpoint(project.id, 'Checkpoint 3');

      const checkpoints = await store2.listCheckpoints(project.id);
      expect(checkpoints).toHaveLength(2);

      await store2.dispose();
    });

    it('should delete checkpoint', async () => {
      const project = await createTestProject(store);
      const checkpoint = await store.createCheckpoint(project.id, 'To delete');

      const deleted = await store.deleteCheckpoint(checkpoint.id);
      expect(deleted).toBe(true);

      const checkpoints = await store.listCheckpoints(project.id);
      expect(checkpoints).toHaveLength(0);
    });
  });

  describe('Context Management', () => {
    it('should get project context', async () => {
      const project = await createTestProject(store);
      const context = await store.getContext(project.id);

      expect(context).toBeDefined();
      expect(context.currentPhase).toBe('initialization');
      expect(context.activeGoals).toEqual([]);
    });

    it('should update context', async () => {
      const project = await createTestProject(store);
      await store.updateContext(project.id, {
        currentPhase: 'development',
        activeGoals: ['Implement feature A'],
      });

      const context = await store.getContext(project.id);
      expect(context.currentPhase).toBe('development');
      expect(context.activeGoals).toContain('Implement feature A');
    });

    it('should add decision', async () => {
      const project = await createTestProject(store);
      await store.addDecision(
        project.id,
        'Use PostgreSQL for database',
        'Better support for JSON and scalability',
        ['MySQL', 'MongoDB']
      );

      const context = await store.getContext(project.id);
      expect(context.decisions).toHaveLength(1);
      expect(context.decisions[0].decision).toBe('Use PostgreSQL for database');
      expect(context.decisions[0].alternatives).toContain('MySQL');
    });

    it('should add insight', async () => {
      const project = await createTestProject(store);
      await store.addInsight(
        project.id,
        'Performance bottleneck in auth module',
        'Profiling session'
      );

      const context = await store.getContext(project.id);
      expect(context.insights).toHaveLength(1);
      expect(context.insights[0].insight).toBe('Performance bottleneck in auth module');
    });

    it('should add and resolve blocker', async () => {
      const project = await createTestProject(store);
      const blockerId = await store.addBlocker(project.id, 'API rate limit exceeded');

      let retrieved = await store.getProject(project.id);
      expect(retrieved?.status).toBe(ProjectStatus.BLOCKED);
      expect(retrieved?.context.blockers).toHaveLength(1);

      await store.resolveBlocker(project.id, blockerId, 'Upgraded API tier');

      retrieved = await store.getProject(project.id);
      expect(retrieved?.status).toBe(ProjectStatus.IN_PROGRESS);
      expect(retrieved?.context.blockers[0].resolvedAt).toBeDefined();
    });
  });

  describe('Task Management', () => {
    it('should add task to project', async () => {
      const project = await createTestProject(store);
      const task = await store.addTask(project.id, {
        id: 'task_1',
        name: 'Implement login',
        description: 'Create login functionality',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      expect(task).toBeDefined();
      expect(task.id).toBe('task_1');
      expect(task.attempts).toBe(0);
    });

    it('should get next pending task', async () => {
      const project = await createTestProject(store);
      await store.addTask(project.id, {
        id: 'task_1',
        name: 'Setup database',
        description: 'Initialize database',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });
      await store.addTask(project.id, {
        id: 'task_2',
        name: 'Implement auth',
        description: 'Create auth module',
        status: TaskStatus.PENDING,
        dependencies: ['task_1'],
        metadata: {},
      });

      const nextTask = await store.getNextTask(project.id);
      expect(nextTask?.id).toBe('task_1');
    });

    it('should respect task dependencies', async () => {
      const project = await createTestProject(store);
      await store.addTask(project.id, {
        id: 'task_1',
        name: 'Setup database',
        description: 'Initialize database',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });
      await store.addTask(project.id, {
        id: 'task_2',
        name: 'Implement auth',
        description: 'Create auth module',
        status: TaskStatus.PENDING,
        dependencies: ['task_1'],
        metadata: {},
      });

      // task_2 has dependency on task_1, so only task_1 should be returned
      let next = await store.getNextTask(project.id);
      expect(next?.id).toBe('task_1');

      // Complete task_1
      await store.markTaskComplete(project.id, 'task_1');

      // Now task_2 should be available
      next = await store.getNextTask(project.id);
      expect(next?.id).toBe('task_2');
    });

    it('should mark task complete', async () => {
      const project = await createTestProject(store);
      await store.addTask(project.id, {
        id: 'task_1',
        name: 'Test task',
        description: 'Test',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      await store.markTaskComplete(project.id, 'task_1', { success: true });

      const updated = await store.getProject(project.id);
      const task = updated?.tasks.get('task_1');
      expect(task?.status).toBe(TaskStatus.COMPLETED);
      expect(task?.result).toEqual({ success: true });
      expect(task?.completedAt).toBeDefined();
    });

    it('should mark task failed', async () => {
      const project = await createTestProject(store);
      await store.addTask(project.id, {
        id: 'task_1',
        name: 'Test task',
        description: 'Test',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      await store.markTaskFailed(project.id, 'task_1', 'Connection timeout');

      const updated = await store.getProject(project.id);
      const task = updated?.tasks.get('task_1');
      expect(task?.status).toBe(TaskStatus.FAILED);
      expect(task?.error).toBe('Connection timeout');
      expect(task?.attempts).toBe(1);
    });

    it('should update task', async () => {
      const project = await createTestProject(store);
      await store.addTask(project.id, {
        id: 'task_1',
        name: 'Test task',
        description: 'Test',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      const updated = await store.updateTask(project.id, 'task_1', {
        status: TaskStatus.IN_PROGRESS,
        assignedAgent: 'coder-agent',
        startedAt: new Date(),
      });

      expect(updated.status).toBe(TaskStatus.IN_PROGRESS);
      expect(updated.assignedAgent).toBe('coder-agent');
    });
  });

  describe('Session Tracking', () => {
    it('should associate session with project', async () => {
      const project = await createTestProject(store);
      await store.associateSession(project.id, 'session_123');

      const sessions = await store.getActiveSessions(project.id);
      expect(sessions).toContain('session_123');
    });

    it('should not duplicate session IDs', async () => {
      const project = await createTestProject(store);
      await store.associateSession(project.id, 'session_123');
      await store.associateSession(project.id, 'session_123');

      const sessions = await store.getActiveSessions(project.id);
      expect(sessions.filter(s => s === 'session_123')).toHaveLength(1);
    });
  });

  describe('Events', () => {
    it('should emit project created event', async () => {
      const events: ProjectState[] = [];
      store.on(ProjectStoreEvent.PROJECT_CREATED, (project) => events.push(project));

      await createTestProject(store);

      expect(events).toHaveLength(1);
      expect(events[0].name).toBe('Test Project');
    });

    it('should emit task completed event', async () => {
      const events: { projectId: string; taskId: string }[] = [];
      store.on(ProjectStoreEvent.TASK_COMPLETED, (data) => events.push(data));

      const project = await createTestProject(store);
      await store.addTask(project.id, {
        id: 'task_1',
        name: 'Test',
        description: 'Test',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      await store.markTaskComplete(project.id, 'task_1');

      expect(events).toHaveLength(1);
      expect(events[0].taskId).toBe('task_1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty project list', async () => {
      const projects = await store.listProjects();
      expect(projects).toEqual([]);
    });

    it('should throw error for operations on non-existent project', async () => {
      await expect(
        store.updateProject('non_existent', { status: ProjectStatus.COMPLETED })
      ).rejects.toThrow('Project not found');
    });

    it('should throw error for operations on non-existent task', async () => {
      const project = await createTestProject(store);

      await expect(
        store.updateTask(project.id, 'non_existent', { status: TaskStatus.COMPLETED })
      ).rejects.toThrow('Task not found');
    });

    it('should throw error for restoring non-existent checkpoint', async () => {
      await expect(
        store.restoreCheckpoint('non_existent_checkpoint')
      ).rejects.toThrow('Checkpoint not found');
    });

    it('should return null for getNextTask when all tasks complete', async () => {
      const project = await createTestProject(store);
      await store.addTask(project.id, {
        id: 'task_1',
        name: 'Test',
        description: 'Test',
        status: TaskStatus.PENDING,
        dependencies: [],
        metadata: {},
      });

      await store.markTaskComplete(project.id, 'task_1');

      const next = await store.getNextTask(project.id);
      expect(next).toBeNull();
    });
  });

  describe('Defaults', () => {
    it('should have correct default configuration values', () => {
      expect(DEFAULT_PROJECT_STORE_CONFIG.storagePath).toBe('./.codeavengers/projects');
      expect(DEFAULT_PROJECT_STORE_CONFIG.autoSaveInterval).toBe(30000);
      expect(DEFAULT_PROJECT_STORE_CONFIG.maxCheckpoints).toBe(10);
      expect(DEFAULT_PROJECT_STORE_CONFIG.compression).toBe(false);
    });
  });
});
