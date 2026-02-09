/**
 * Document Queue Tests
 */

import { DocumentQueue } from '../../../../src/core/workspace/document-queue';
import type { TeamType, CreateTaskInput } from '../../../../src/core/workspace/task-document';

// ============================================================================
// Mocks
// ============================================================================

// Mock workspace-manager
const mockEnsureInitialized = jest.fn().mockResolvedValue(undefined);
const mockGetInboxPath = jest.fn().mockReturnValue('/workspace/inbox/development');
const mockGetInProgressPath = jest.fn().mockReturnValue('/workspace/in-progress');
const mockGetOutboxPath = jest.fn().mockReturnValue('/workspace/outbox');
const mockGetFailedPath = jest.fn().mockReturnValue('/workspace/failed');
const mockGetArchivePath = jest.fn().mockReturnValue('/workspace/archive');
const mockWriteFile = jest.fn().mockResolvedValue(undefined);
const mockReadFile = jest.fn().mockResolvedValue('# Task\n\ncontent');
const mockMoveFile = jest.fn().mockImplementation(async (src: string, dest: string) => {
  const name = src.split('/').pop();
  return `${dest}/${name}`;
});
const mockListFiles = jest.fn().mockResolvedValue([]);
const mockDeleteFile = jest.fn().mockResolvedValue(undefined);
const mockFileExists = jest.fn().mockResolvedValue(true);
const mockCleanupOldFiles = jest.fn().mockResolvedValue(0);
const mockGetStats = jest.fn().mockResolvedValue({
  inboxCount: { development: 0, qa: 0, planning: 0, design: 0, frontend: 0, backend: 0, 'code-quality': 0, infrastructure: 0, pm: 0, 'issue-response': 0, orchestrator: 0 },
  outboxCount: 0,
  inProgressCount: 0,
  failedCount: 0,
  archiveCount: 0,
});

jest.mock('../../../../src/core/workspace/workspace-manager', () => ({
  WorkspaceManager: jest.fn().mockImplementation(() => ({
    ensureInitialized: mockEnsureInitialized,
    getInboxPath: mockGetInboxPath,
    getInProgressPath: mockGetInProgressPath,
    getOutboxPath: mockGetOutboxPath,
    getFailedPath: mockGetFailedPath,
    getArchivePath: mockGetArchivePath,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    moveFile: mockMoveFile,
    listFiles: mockListFiles,
    deleteFile: mockDeleteFile,
    fileExists: mockFileExists,
    cleanupOldFiles: mockCleanupOldFiles,
    getStats: mockGetStats,
  })),
}));

// Mock task-document
const mockCreateTask = jest.fn().mockImplementation((input: any) => ({
  metadata: {
    id: 'task-1',
    title: input.title || 'Test Task',
    type: input.type || 'feature',
    from: input.from || 'orchestrator',
    to: input.to || 'development',
    priority: input.priority || 'medium',
    status: 'pending',
    tags: input.tags || [],
    files: input.files || [],
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 3,
  },
  content: input.content || 'Task content',
}));
const mockUpdateTaskStatus = jest.fn().mockImplementation((task: any, status: string) => ({
  ...task,
  metadata: { ...task.metadata, status },
}));
const mockIncrementRetry = jest.fn().mockImplementation((task: any) => ({
  ...task,
  metadata: { ...task.metadata, retryCount: (task.metadata.retryCount || 0) + 1 },
}));
const mockCanRetry = jest.fn().mockReturnValue(false);

jest.mock('../../../../src/core/workspace/task-document', () => ({
  createTask: (...args: any[]) => mockCreateTask(...args),
  updateTaskStatus: (...args: any[]) => mockUpdateTaskStatus(...args),
  incrementRetry: (...args: any[]) => mockIncrementRetry(...args),
  canRetry: (...args: any[]) => mockCanRetry(...args),
}));

// Mock task-document-parser
const mockParseTaskDocument = jest.fn().mockImplementation((_content: string, _filePath: string) => ({
  metadata: {
    id: 'task-1',
    title: 'Parsed Task',
    type: 'feature',
    from: 'orchestrator',
    to: 'development',
    priority: 'medium',
    status: 'pending',
    tags: [],
    files: [],
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 3,
    projectId: undefined,
    parentTaskId: undefined,
  },
  content: 'Task content',
}));
const mockSerializeTaskDocument = jest.fn().mockReturnValue('# Serialized Task\n\ncontent');
const mockGenerateTaskFilename = jest.fn().mockReturnValue('medium_feature_test-task_task-1.md');

jest.mock('../../../../src/core/workspace/task-document-parser', () => ({
  parseTaskDocument: (...args: any[]) => mockParseTaskDocument(...args),
  serializeTaskDocument: (...args: any[]) => mockSerializeTaskDocument(...args),
  generateTaskFilename: (...args: any[]) => mockGenerateTaskFilename(...args),
}));

// Mock fs.watch — created inside factory to avoid hoisting issues
jest.mock('fs', () => {
  const _close = jest.fn();
  const _on = jest.fn();
  return {
    watch: jest.fn().mockReturnValue({ close: _close, on: _on }),
    __mockWatcherClose: _close,
    __mockWatcherOn: _on,
  };
});

// ============================================================================
// Helpers
// ============================================================================

function createQueue(): DocumentQueue {
  return new DocumentQueue();
}

function makeTaskInput(overrides: Partial<CreateTaskInput> = {}): CreateTaskInput {
  return {
    title: 'Test Task',
    type: 'feature',
    from: 'orchestrator' as TeamType,
    to: 'development' as TeamType,
    priority: 'medium',
    content: 'Task content',
    ...overrides,
  } as CreateTaskInput;
}

// ============================================================================
// Tests
// ============================================================================

describe('DocumentQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ==========================================================================
  // Constructor & Lifecycle
  // ==========================================================================

  describe('constructor', () => {
    it('should create with default workspace', () => {
      const queue = createQueue();
      expect(queue).toBeDefined();
    });

    it('should create with provided workspace', () => {
      const workspace = { ensureInitialized: jest.fn() } as any;
      const queue = new DocumentQueue(workspace);
      expect(queue).toBeDefined();
    });
  });

  describe('lifecycle', () => {
    it('should initialize workspace', async () => {
      const queue = createQueue();
      await queue.initialize();

      expect(mockEnsureInitialized).toHaveBeenCalled();
    });

    it('should start the queue', async () => {
      const queue = createQueue();
      await queue.start();

      expect(mockEnsureInitialized).toHaveBeenCalled();
    });

    it('should not start again if already started', async () => {
      const queue = createQueue();
      await queue.start();
      mockEnsureInitialized.mockClear();
      await queue.start();

      expect(mockEnsureInitialized).not.toHaveBeenCalled();
    });

    it('should stop and cleanup watchers', async () => {
      const queue = createQueue();
      await queue.start();
      await queue.stop();

      // Should clear subscriptions and watchers
    });

    it('should stop even when not started', async () => {
      const queue = createQueue();
      await queue.stop();
      // Should not throw
    });
  });

  // ==========================================================================
  // Publish
  // ==========================================================================

  describe('publish', () => {
    it('should create and write task document', async () => {
      const queue = createQueue();
      const result = await queue.publish(makeTaskInput());

      expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Test Task',
        type: 'feature',
      }));
      expect(mockGenerateTaskFilename).toHaveBeenCalled();
      expect(mockSerializeTaskDocument).toHaveBeenCalled();
      expect(mockWriteFile).toHaveBeenCalled();
      expect(result.metadata.id).toBe('task-1');
    });

    it('should emit task:published event', async () => {
      const queue = createQueue();
      const handler = jest.fn();
      queue.on('task:published', handler);

      await queue.publish(makeTaskInput());

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.objectContaining({ id: 'task-1' }) }),
        'development',
      );
    });
  });

  // ==========================================================================
  // Subscribe
  // ==========================================================================

  describe('subscribe', () => {
    it('should add subscription and return unsubscribe function', () => {
      const queue = createQueue();
      const callback = jest.fn();

      const unsubscribe = queue.subscribe('development' as TeamType, callback);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should setup file watcher by default', () => {
      const { watch } = require('fs');
      const queue = createQueue();
      queue.subscribe('development' as TeamType, jest.fn());

      expect(watch).toHaveBeenCalled();
    });

    it('should setup polling when interval is specified', () => {
      jest.useFakeTimers();
      const queue = createQueue();
      queue.subscribe('development' as TeamType, jest.fn(), { pollingInterval: 1000 });

      // Polling should be set up
      jest.advanceTimersByTime(1000);
      jest.useRealTimers();
    });

    it('should unsubscribe and stop watching', () => {
      const queue = createQueue();
      const callback = jest.fn();

      const unsubscribe = queue.subscribe('development' as TeamType, callback);
      unsubscribe();

      // Should have cleaned up
    });

    it('should process existing tasks on subscribe', async () => {
      mockListFiles.mockResolvedValueOnce([]);
      const queue = createQueue();
      queue.subscribe('development' as TeamType, jest.fn());

      // processExistingTasks is called asynchronously
      await new Promise(r => setTimeout(r, 10));
      expect(mockListFiles).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Acknowledge
  // ==========================================================================

  describe('acknowledge', () => {
    it('should move completed task to outbox', async () => {
      mockListFiles.mockResolvedValueOnce([
        { name: 'task-1.md', path: '/workspace/in-progress/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
      ]);

      const queue = createQueue();
      await queue.acknowledge('task-1', 'completed');

      expect(mockWriteFile).toHaveBeenCalled();
      expect(mockMoveFile).toHaveBeenCalledWith(
        '/workspace/in-progress/task-1.md',
        '/workspace/outbox',
      );
    });

    it('should move failed task to failed directory', async () => {
      mockListFiles.mockResolvedValueOnce([
        { name: 'task-1.md', path: '/workspace/in-progress/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
      ]);

      const queue = createQueue();
      await queue.acknowledge('task-1', 'failed');

      expect(mockMoveFile).toHaveBeenCalledWith(
        '/workspace/in-progress/task-1.md',
        '/workspace/failed',
      );
    });

    it('should append result to content', async () => {
      mockListFiles.mockResolvedValueOnce([
        { name: 'task-1.md', path: '/workspace/in-progress/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
      ]);

      const queue = createQueue();
      await queue.acknowledge('task-1', 'completed', 'All tests passed');

      expect(mockSerializeTaskDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('All tests passed'),
        }),
      );
    });

    it('should throw when task not found', async () => {
      mockListFiles.mockResolvedValueOnce([]);

      const queue = createQueue();
      await expect(queue.acknowledge('nonexistent', 'completed')).rejects.toThrow('not found');
    });

    it('should emit task:completed event', async () => {
      mockListFiles.mockResolvedValueOnce([
        { name: 'task-1.md', path: '/workspace/in-progress/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
      ]);

      const queue = createQueue();
      const handler = jest.fn();
      queue.on('task:completed', handler);

      await queue.acknowledge('task-1', 'completed');
      expect(handler).toHaveBeenCalled();
    });

    it('should emit task:failed event', async () => {
      mockListFiles.mockResolvedValueOnce([
        { name: 'task-1.md', path: '/workspace/in-progress/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
      ]);

      const queue = createQueue();
      const handler = jest.fn();
      queue.on('task:failed', handler);

      await queue.acknowledge('task-1', 'failed');
      expect(handler).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getTask
  // ==========================================================================

  describe('getTask', () => {
    it('should find task in directories', async () => {
      mockListFiles
        .mockResolvedValueOnce([]) // in-progress: empty
        .mockResolvedValueOnce([   // outbox: found
          { name: 'task-1.md', path: '/workspace/outbox/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
        ]);

      const queue = createQueue();
      const task = await queue.getTask('task-1');

      expect(task).not.toBeNull();
      expect(task!.metadata.id).toBe('task-1');
    });

    it('should return null when task not found', async () => {
      mockListFiles.mockResolvedValue([]);

      const queue = createQueue();
      const task = await queue.getTask('nonexistent');

      expect(task).toBeNull();
    });
  });

  // ==========================================================================
  // getTasks
  // ==========================================================================

  describe('getTasks', () => {
    it('should return all tasks without filter', async () => {
      mockListFiles
        .mockResolvedValueOnce([
          { name: 'task-1.md', path: '/workspace/in-progress/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
        ])
        .mockResolvedValueOnce([]) // outbox
        .mockResolvedValueOnce([]); // failed

      const queue = createQueue();
      const tasks = await queue.getTasks();

      expect(tasks).toHaveLength(1);
    });

    it('should filter tasks by status', async () => {
      const pendingTask = {
        metadata: {
          id: 'task-1', title: 'T', type: 'feature', from: 'orchestrator', to: 'development',
          priority: 'medium', status: 'in_progress', tags: [], files: [],
          createdAt: new Date().toISOString(),
        },
        content: 'content',
      };
      mockParseTaskDocument.mockReturnValueOnce(pendingTask);
      mockListFiles
        .mockResolvedValueOnce([
          { name: 'task-1.md', path: '/workspace/in-progress/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const queue = createQueue();
      const tasks = await queue.getTasks({ status: ['completed'] });

      expect(tasks).toHaveLength(0);
    });

    it('should skip invalid files', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('Invalid'));
      mockParseTaskDocument.mockImplementationOnce(() => { throw new Error('Parse error'); });
      mockListFiles
        .mockResolvedValueOnce([
          { name: 'bad.md', path: '/workspace/in-progress/bad.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const queue = createQueue();
      const tasks = await queue.getTasks();

      expect(tasks).toHaveLength(0);
    });
  });

  // ==========================================================================
  // getStats
  // ==========================================================================

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const queue = createQueue();
      const stats = await queue.getStats();

      expect(stats.pending).toBe(0);
      expect(stats.inProgress).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.byTeam).toBeDefined();
    });

    it('should calculate pending from team inboxes', async () => {
      mockGetStats.mockResolvedValueOnce({
        inboxCount: { development: 3, qa: 2, planning: 0, design: 0, frontend: 0, backend: 0, 'code-quality': 0, infrastructure: 0, pm: 0, 'issue-response': 0, orchestrator: 0 },
        outboxCount: 1,
        inProgressCount: 2,
        failedCount: 0,
        archiveCount: 5,
      });

      const queue = createQueue();
      const stats = await queue.getStats();

      expect(stats.pending).toBe(5);
      expect(stats.inProgress).toBe(2);
      expect(stats.completed).toBe(1);
    });
  });

  // ==========================================================================
  // Archive & Purge
  // ==========================================================================

  describe('archiveOldTasks', () => {
    it('should move old completed tasks to archive', async () => {
      const now = Date.now();
      mockListFiles.mockResolvedValueOnce([
        { name: 'old.md', path: '/workspace/outbox/old.md', size: 100, createdAt: new Date(now - 100000), modifiedAt: new Date(now - 100000) },
        { name: 'new.md', path: '/workspace/outbox/new.md', size: 100, createdAt: new Date(now - 1000), modifiedAt: new Date(now - 1000) },
      ]);

      const queue = createQueue();
      const count = await queue.archiveOldTasks(50000);

      expect(count).toBe(1);
      expect(mockMoveFile).toHaveBeenCalledWith(
        '/workspace/outbox/old.md',
        '/workspace/archive',
      );
    });
  });

  describe('purgeArchive', () => {
    it('should delegate to workspace cleanupOldFiles', async () => {
      mockCleanupOldFiles.mockResolvedValue(3);

      const queue = createQueue();
      const count = await queue.purgeArchive(86400000);

      expect(mockCleanupOldFiles).toHaveBeenCalledWith('/workspace/archive', 86400000);
      expect(count).toBe(3);
    });
  });

  // ==========================================================================
  // Filter matching
  // ==========================================================================

  describe('filter matching (via getTasks)', () => {
    function setupTaskForFilter(taskOverrides: Record<string, any>) {
      const task = {
        metadata: {
          id: 'task-1', title: 'T', type: 'feature', from: 'orchestrator', to: 'development',
          priority: 'medium', status: 'pending', tags: ['urgent'], files: [],
          createdAt: '2024-06-15T00:00:00.000Z',
          projectId: 'proj-1',
          parentTaskId: 'parent-1',
          ...taskOverrides,
        },
        content: 'content',
      };
      mockParseTaskDocument.mockReturnValue(task);
      mockListFiles
        .mockResolvedValueOnce([
          { name: 'task-1.md', path: '/p/task-1.md', size: 100, createdAt: new Date(), modifiedAt: new Date() },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
    }

    it('should filter by priority', async () => {
      setupTaskForFilter({ priority: 'low' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ priority: ['high'] });
      expect(tasks).toHaveLength(0);
    });

    it('should match by priority', async () => {
      setupTaskForFilter({ priority: 'high' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ priority: ['high'] });
      expect(tasks).toHaveLength(1);
    });

    it('should filter by type', async () => {
      setupTaskForFilter({ type: 'bugfix' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ type: ['feature'] });
      expect(tasks).toHaveLength(0);
    });

    it('should filter by from', async () => {
      setupTaskForFilter({ from: 'qa' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ from: ['orchestrator'] });
      expect(tasks).toHaveLength(0);
    });

    it('should filter by to', async () => {
      setupTaskForFilter({ to: 'qa' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ to: ['development'] });
      expect(tasks).toHaveLength(0);
    });

    it('should filter by tags', async () => {
      setupTaskForFilter({ tags: ['frontend'] });
      const queue = createQueue();
      const tasks = await queue.getTasks({ tags: ['backend'] });
      expect(tasks).toHaveLength(0);
    });

    it('should match by tags', async () => {
      setupTaskForFilter({ tags: ['urgent', 'frontend'] });
      const queue = createQueue();
      const tasks = await queue.getTasks({ tags: ['urgent'] });
      expect(tasks).toHaveLength(1);
    });

    it('should filter by projectId', async () => {
      setupTaskForFilter({ projectId: 'proj-1' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ projectId: 'proj-2' });
      expect(tasks).toHaveLength(0);
    });

    it('should filter by parentTaskId', async () => {
      setupTaskForFilter({ parentTaskId: 'parent-1' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ parentTaskId: 'parent-2' });
      expect(tasks).toHaveLength(0);
    });

    it('should filter by createdAfter', async () => {
      setupTaskForFilter({ createdAt: '2024-01-01T00:00:00.000Z' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ createdAfter: '2024-06-01T00:00:00.000Z' });
      expect(tasks).toHaveLength(0);
    });

    it('should filter by createdBefore', async () => {
      setupTaskForFilter({ createdAt: '2024-12-01T00:00:00.000Z' });
      const queue = createQueue();
      const tasks = await queue.getTasks({ createdBefore: '2024-06-01T00:00:00.000Z' });
      expect(tasks).toHaveLength(0);
    });
  });
});
