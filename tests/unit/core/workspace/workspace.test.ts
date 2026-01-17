import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  // Task Document
  TaskDocument,
  CreateTaskInput,
  TeamType,
  generateTaskId,
  createTask,
  updateTaskStatus,
  hasUnmetDependencies,
  canRetry,
  incrementRetry,
  // Parser
  parseTaskDocument,
  serializeTaskDocument,
  generateTaskFilename,
  extractTaskIdFromFilename,
  validateTaskDocument,
  createTaskTemplate,
  TaskDocumentParseError,
  // Workspace Manager
  WorkspaceManager,
  WORKSPACE_DIRS,
  // Document Queue
  DocumentQueue,
} from '@/core/workspace';

/**
 * Workspace Module Tests
 *
 * Tests for the document-based task queue system.
 */

describe('Workspace Module', () => {
  describe('Task Document', () => {
    describe('generateTaskId', () => {
      it('should generate unique task IDs', () => {
        const id1 = generateTaskId();
        const id2 = generateTaskId();

        expect(id1).toMatch(/^task_[a-z0-9]+_[a-z0-9]+$/);
        expect(id2).toMatch(/^task_[a-z0-9]+_[a-z0-9]+$/);
        expect(id1).not.toBe(id2);
      });
    });

    describe('createTask', () => {
      it('should create task with required fields', () => {
        const input: CreateTaskInput = {
          title: 'Implement login',
          type: 'feature',
          from: 'planning',
          to: 'development',
        };

        const task = createTask(input);

        expect(task.metadata.id).toMatch(/^task_/);
        expect(task.metadata.title).toBe('Implement login');
        expect(task.metadata.type).toBe('feature');
        expect(task.metadata.from).toBe('planning');
        expect(task.metadata.to).toBe('development');
        expect(task.metadata.status).toBe('pending');
        expect(task.metadata.priority).toBe('medium');
        expect(task.metadata.retryCount).toBe(0);
        expect(task.metadata.createdAt).toBeDefined();
      });

      it('should create task with optional fields', () => {
        const input: CreateTaskInput = {
          title: 'Fix bug',
          type: 'bugfix',
          from: 'qa',
          to: 'development',
          priority: 'critical',
          tags: ['urgent', 'security'],
          projectId: 'proj-123',
        };

        const task = createTask(input);

        expect(task.metadata.priority).toBe('critical');
        expect(task.metadata.tags).toEqual(['urgent', 'security']);
        expect(task.metadata.projectId).toBe('proj-123');
      });
    });

    describe('updateTaskStatus', () => {
      it('should update status and timestamp', () => {
        const task = createTask({
          title: 'Test task',
          type: 'test',
          from: 'qa',
          to: 'development',
        });

        const updated = updateTaskStatus(task, 'in_progress');

        expect(updated.metadata.status).toBe('in_progress');
        expect(updated.metadata.updatedAt).toBeDefined();
      });

      it('should set completedAt for terminal states', () => {
        const task = createTask({
          title: 'Test task',
          type: 'test',
          from: 'qa',
          to: 'development',
        });

        const completed = updateTaskStatus(task, 'completed');
        expect(completed.metadata.completedAt).toBeDefined();

        const task2 = createTask({
          title: 'Test task 2',
          type: 'test',
          from: 'qa',
          to: 'development',
        });

        const failed = updateTaskStatus(task2, 'failed');
        expect(failed.metadata.completedAt).toBeDefined();
      });
    });

    describe('hasUnmetDependencies', () => {
      it('should return false for task without dependencies', () => {
        const task = createTask({
          title: 'Independent task',
          type: 'feature',
          from: 'planning',
          to: 'development',
        });

        expect(hasUnmetDependencies(task)).toBe(false);
      });

      it('should return true for blocked task', () => {
        const task = createTask({
          title: 'Dependent task',
          type: 'feature',
          from: 'planning',
          to: 'development',
          dependencies: [
            { taskId: 'task_123', type: 'blocked_by', status: 'pending' },
          ],
        });

        expect(hasUnmetDependencies(task)).toBe(true);
      });

      it('should return false when blocker is completed', () => {
        const task = createTask({
          title: 'Dependent task',
          type: 'feature',
          from: 'planning',
          to: 'development',
          dependencies: [
            { taskId: 'task_123', type: 'blocked_by', status: 'completed' },
          ],
        });

        expect(hasUnmetDependencies(task)).toBe(false);
      });
    });

    describe('retry functions', () => {
      it('should check if task can be retried', () => {
        const task = createTask({
          title: 'Retryable task',
          type: 'feature',
          from: 'planning',
          to: 'development',
          maxRetries: 3,
        });

        expect(canRetry(task)).toBe(true);

        const exhausted = {
          ...task,
          metadata: { ...task.metadata, retryCount: 3 },
        };

        expect(canRetry(exhausted)).toBe(false);
      });

      it('should increment retry count', () => {
        const task = createTask({
          title: 'Retryable task',
          type: 'feature',
          from: 'planning',
          to: 'development',
        });

        const retried = incrementRetry(task);

        expect(retried.metadata.retryCount).toBe(1);
        expect(retried.metadata.updatedAt).toBeDefined();
      });
    });
  });

  describe('Task Document Parser', () => {
    const sampleDocument = `---
id: task_abc123_def456
title: Implement user authentication
type: feature
from: planning
to: development
priority: high
status: pending
createdAt: "2024-01-15T10:30:00.000Z"
dependencies: []
files: []
retryCount: 0
maxRetries: 3
tags:
  - security
  - auth
---

# Implement user authentication

## Description

Implement JWT-based authentication for the API.

## Acceptance Criteria

- [ ] Users can log in with email/password
- [ ] JWT tokens are issued on successful login
`;

    describe('parseTaskDocument', () => {
      it('should parse valid task document', () => {
        const task = parseTaskDocument(sampleDocument);

        expect(task.metadata.id).toBe('task_abc123_def456');
        expect(task.metadata.title).toBe('Implement user authentication');
        expect(task.metadata.type).toBe('feature');
        expect(task.metadata.from).toBe('planning');
        expect(task.metadata.to).toBe('development');
        expect(task.metadata.priority).toBe('high');
        expect(task.metadata.tags).toEqual(['security', 'auth']);
        expect(task.content).toContain('JWT-based authentication');
      });

      it('should throw error for missing frontmatter', () => {
        const invalid = '# Just a heading\n\nSome content';

        expect(() => parseTaskDocument(invalid)).toThrow(TaskDocumentParseError);
      });

      it('should throw error for invalid YAML', () => {
        const invalid = `---
id: task_123
title: invalid: yaml: here
---

Content`;

        expect(() => parseTaskDocument(invalid)).toThrow();
      });
    });

    describe('serializeTaskDocument', () => {
      it('should serialize task to markdown with frontmatter', () => {
        const task = createTask({
          title: 'Test serialization',
          type: 'test',
          from: 'qa',
          to: 'development',
          content: '# Test Content\n\nThis is a test.',
        });

        const serialized = serializeTaskDocument(task);

        expect(serialized).toContain('---');
        expect(serialized).toContain('title: Test serialization');
        expect(serialized).toContain('type: test');
        expect(serialized).toContain('# Test Content');
      });

      it('should round-trip parse/serialize', () => {
        const task = parseTaskDocument(sampleDocument);
        const serialized = serializeTaskDocument(task);
        const reparsed = parseTaskDocument(serialized);

        expect(reparsed.metadata.id).toBe(task.metadata.id);
        expect(reparsed.metadata.title).toBe(task.metadata.title);
        expect(reparsed.metadata.type).toBe(task.metadata.type);
      });
    });

    describe('generateTaskFilename', () => {
      it('should generate filename with priority and type', () => {
        const task = createTask({
          title: 'Implement Feature XYZ',
          type: 'feature',
          from: 'planning',
          to: 'development',
          priority: 'high',
        });

        const filename = generateTaskFilename(task);

        expect(filename).toContain('high_');
        expect(filename).toContain('feature_');
        expect(filename).toContain('implement-feature-xyz');
        expect(filename).toContain(task.metadata.id);
        expect(filename).toMatch(/\.md$/);
      });
    });

    describe('extractTaskIdFromFilename', () => {
      it('should extract task ID from filename', () => {
        const filename = 'high_feature_implement-login_task_abc123_def456.md';
        const id = extractTaskIdFromFilename(filename);

        expect(id).toBe('task_abc123_def456');
      });

      it('should return null for invalid filename', () => {
        const filename = 'random_file.md';
        const id = extractTaskIdFromFilename(filename);

        expect(id).toBeNull();
      });
    });

    describe('validateTaskDocument', () => {
      it('should validate correct document', () => {
        const result = validateTaskDocument(sampleDocument);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.document).toBeDefined();
      });

      it('should return errors for invalid document', () => {
        const invalid = '# No frontmatter';
        const result = validateTaskDocument(invalid);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('createTaskTemplate', () => {
      it('should create template with required fields', () => {
        const template = createTaskTemplate({
          title: 'New Feature',
          type: 'feature',
          from: 'planning',
          to: 'development',
        });

        expect(template).toContain('---');
        expect(template).toContain('title: New Feature');
        expect(template).toContain('type: feature');
        expect(template).toContain('# New Feature');
        expect(template).toContain('## Description');
      });
    });
  });

  describe('Workspace Manager', () => {
    let tempDir: string;
    let workspace: WorkspaceManager;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-test-'));
      workspace = new WorkspaceManager({
        baseDir: tempDir,
        autoCreate: true,
      });
    });

    afterEach(async () => {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('initialization', () => {
      it('should create workspace directory structure', async () => {
        await workspace.initialize();

        const rootExists = await workspace.exists();
        expect(rootExists).toBe(true);

        // Check main directories
        const dirs = [
          WORKSPACE_DIRS.INBOX,
          WORKSPACE_DIRS.OUTBOX,
          WORKSPACE_DIRS.IN_PROGRESS,
          WORKSPACE_DIRS.FAILED,
          WORKSPACE_DIRS.ARCHIVE,
          WORKSPACE_DIRS.KNOWLEDGE,
          WORKSPACE_DIRS.METRICS,
        ];

        for (const dir of dirs) {
          const dirPath = workspace.getPath(dir);
          const stat = await fs.stat(dirPath);
          expect(stat.isDirectory()).toBe(true);
        }
      });

      it('should create team inbox directories', async () => {
        await workspace.initialize();

        const teams: TeamType[] = ['planning', 'development', 'qa'];

        for (const team of teams) {
          const inboxPath = workspace.getInboxPath(team);
          const stat = await fs.stat(inboxPath);
          expect(stat.isDirectory()).toBe(true);
        }
      });
    });

    describe('file operations', () => {
      beforeEach(async () => {
        await workspace.initialize();
      });

      it('should write and read files', async () => {
        const filePath = path.join(workspace.getInboxPath('planning'), 'test.md');
        const content = '# Test\n\nContent here';

        await workspace.writeFile(filePath, content);
        const read = await workspace.readFile(filePath);

        expect(read).toBe(content);
      });

      it('should list files in directory', async () => {
        const dir = workspace.getInboxPath('development');
        await workspace.writeFile(path.join(dir, 'task1.md'), 'Task 1');
        await workspace.writeFile(path.join(dir, 'task2.md'), 'Task 2');

        const files = await workspace.listFiles(dir);

        expect(files.length).toBe(2);
        expect(files.map((f) => f.name)).toContain('task1.md');
        expect(files.map((f) => f.name)).toContain('task2.md');
      });

      it('should move files between directories', async () => {
        const sourcePath = path.join(workspace.getInboxPath('planning'), 'task.md');
        await workspace.writeFile(sourcePath, 'Task content');

        const destPath = await workspace.moveFile(
          sourcePath,
          workspace.getInProgressPath()
        );

        const sourceExists = await workspace.fileExists(sourcePath);
        const destExists = await workspace.fileExists(destPath);

        expect(sourceExists).toBe(false);
        expect(destExists).toBe(true);
      });

      it('should delete files', async () => {
        const filePath = path.join(workspace.getOutboxPath(), 'temp.md');
        await workspace.writeFile(filePath, 'Temp');

        await workspace.deleteFile(filePath);

        const exists = await workspace.fileExists(filePath);
        expect(exists).toBe(false);
      });
    });

    describe('workspace stats', () => {
      beforeEach(async () => {
        await workspace.initialize();
      });

      it('should return workspace statistics', async () => {
        // Add some test files
        await workspace.writeFile(
          path.join(workspace.getInboxPath('planning'), 'task1.md'),
          'Task 1'
        );
        await workspace.writeFile(
          path.join(workspace.getInboxPath('development'), 'task2.md'),
          'Task 2'
        );

        const stats = await workspace.getStats();

        expect(stats.inboxCount.planning).toBe(1);
        expect(stats.inboxCount.development).toBe(1);
        expect(stats.outboxCount).toBe(0);
        expect(stats.inProgressCount).toBe(0);
      });
    });
  });

  describe('Document Queue', () => {
    let tempDir: string;
    let workspace: WorkspaceManager;
    let queue: DocumentQueue;

    beforeEach(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'queue-test-'));
      workspace = new WorkspaceManager({
        baseDir: tempDir,
        autoCreate: true,
      });
      queue = new DocumentQueue(workspace);
      await queue.initialize();
    });

    afterEach(async () => {
      await queue.stop();
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    describe('publish', () => {
      it('should publish task to team inbox', async () => {
        const task = await queue.publish({
          title: 'Test Task',
          type: 'feature',
          from: 'planning',
          to: 'development',
        });

        expect(task.metadata.id).toMatch(/^task_/);
        expect(task.metadata.status).toBe('pending');

        // Check file was created
        const files = await workspace.listFiles(
          workspace.getInboxPath('development'),
          /\.md$/
        );
        expect(files.length).toBe(1);
      });

      it('should emit task:published event', async () => {
        const publishedTasks: TaskDocument[] = [];
        queue.on('task:published', (task) => {
          publishedTasks.push(task);
        });

        await queue.publish({
          title: 'Event Test',
          type: 'test',
          from: 'qa',
          to: 'development',
        });

        expect(publishedTasks.length).toBe(1);
        expect(publishedTasks[0].metadata.title).toBe('Event Test');
      });
    });

    describe('subscribe and process', () => {
      it('should process tasks via subscription', async () => {
        const processedTasks: TaskDocument[] = [];

        // Subscribe to development team
        queue.subscribe(
          'development',
          async (task) => {
            processedTasks.push(task);
          },
          { autoAcknowledge: true, pollingInterval: 100 }
        );

        // Publish a task
        await queue.publish({
          title: 'Process Test',
          type: 'feature',
          from: 'planning',
          to: 'development',
        });

        // Wait for processing
        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(processedTasks.length).toBe(1);
        expect(processedTasks[0].metadata.title).toBe('Process Test');
      });
    });

    describe('getStats', () => {
      it('should return queue statistics', async () => {
        await queue.publish({
          title: 'Task 1',
          type: 'feature',
          from: 'planning',
          to: 'development',
        });

        await queue.publish({
          title: 'Task 2',
          type: 'bugfix',
          from: 'qa',
          to: 'development',
        });

        const stats = await queue.getStats();

        expect(stats.pending).toBe(2);
        expect(stats.byTeam.development).toBe(2);
        expect(stats.inProgress).toBe(0);
        expect(stats.completed).toBe(0);
      });
    });

    describe('getTasks', () => {
      it('should filter tasks by criteria', async () => {
        await queue.publish({
          title: 'Feature 1',
          type: 'feature',
          from: 'planning',
          to: 'development',
          priority: 'high',
        });

        await queue.publish({
          title: 'Bug 1',
          type: 'bugfix',
          from: 'qa',
          to: 'development',
          priority: 'critical',
        });

        // Process to move to outbox
        queue.subscribe(
          'development',
          async () => {},
          { autoAcknowledge: true, pollingInterval: 100 }
        );

        await new Promise((resolve) => setTimeout(resolve, 500));

        const allTasks = await queue.getTasks();
        expect(allTasks.length).toBe(2);

        const criticalTasks = await queue.getTasks({
          priority: ['critical'],
        });
        expect(criticalTasks.length).toBe(1);
        expect(criticalTasks[0].metadata.title).toBe('Bug 1');
      });
    });
  });
});
