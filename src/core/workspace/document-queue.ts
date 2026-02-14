/**
 * Document Queue
 *
 * File system based message queue for inter-team communication.
 * Implements publish/subscribe/acknowledge pattern using task documents.
 *
 * Features:
 * - Publish tasks to team inboxes
 * - Subscribe to incoming tasks
 * - Acknowledge task completion/failure
 * - File watching for real-time updates
 * - Priority-based ordering
 * - Retry handling for failed tasks
 *
 * Feature: Document-based Task Queue for Agent OS
 */

import * as path from 'path';
import { watch, FSWatcher } from 'fs';
import { EventEmitter } from 'events';
import { WorkspaceManager, WorkspaceFile } from './workspace-manager';
import {
  TaskDocument,
  TeamType,
  TaskFilter,
  TaskPriority,
  updateTaskStatus,
  incrementRetry,
  canRetry,
  CreateTaskInput,
  createTask,
} from './task-document';
import {
  parseTaskDocument,
  serializeTaskDocument,
  generateTaskFilename,
} from './task-document-parser';

/**
 * Queue events
 */
export interface QueueEvents {
  'task:received': (task: TaskDocument, team: TeamType) => void;
  'task:published': (task: TaskDocument, team: TeamType) => void;
  'task:started': (task: TaskDocument) => void;
  'task:completed': (task: TaskDocument) => void;
  'task:failed': (task: TaskDocument, error: Error) => void;
  'task:retry': (task: TaskDocument) => void;
  'error': (error: Error) => void;
}

/**
 * Subscription callback
 */
export type TaskSubscriber = (task: TaskDocument) => Promise<void> | void;

/**
 * Subscription options
 */
export interface SubscriptionOptions {
  /** Filter tasks by criteria */
  filter?: TaskFilter;
  /** Auto-acknowledge after processing */
  autoAcknowledge?: boolean;
  /** Polling interval in ms (if not using file watcher) */
  pollingInterval?: number;
}

/**
 * Document Queue
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DocumentQueue extends EventEmitter {
  private readonly workspace: WorkspaceManager;
  private readonly subscriptions: Map<TeamType, Set<TaskSubscriber>> = new Map();
  private readonly watchers: Map<string, FSWatcher> = new Map();
  private readonly processingTasks: Set<string> = new Set();
  private pollingIntervals: Map<TeamType, NodeJS.Timeout> = new Map();
  private started: boolean = false;
  private stopped: boolean = false;

  constructor(workspace?: WorkspaceManager) {
    super();
    this.workspace = workspace || new WorkspaceManager();
  }

  /**
   * Initialize the queue
   */
  async initialize(): Promise<void> {
    await this.workspace.ensureInitialized();
  }

  /**
   * Start the queue (begin watching for tasks)
   */
  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await this.initialize();
    this.stopped = false;
    this.started = true;
  }

  /**
   * Stop the queue
   */
  async stop(): Promise<void> {
    // Stop all watchers (always clean up regardless of started flag)
    for (const [, watcher] of this.watchers) {
      watcher.close();
    }
    this.watchers.clear();

    // Stop all polling intervals
    for (const [, interval] of this.pollingIntervals) {
      clearInterval(interval);
    }
    this.pollingIntervals.clear();

    // Clear subscriptions
    this.subscriptions.clear();

    this.stopped = true;
    this.started = false;
  }

  /**
   * Publish a task to a team's inbox
   */
  async publish(input: CreateTaskInput): Promise<TaskDocument> {
    await this.initialize();

    // Create task document
    const task = createTask(input);

    // Generate filename and path
    const filename = generateTaskFilename(task);
    const inboxPath = this.workspace.getInboxPath(task.metadata.to);
    const filePath = path.join(inboxPath, filename);

    // Serialize and write
    const content = serializeTaskDocument(task);
    await this.workspace.writeFile(filePath, content);

    // Emit event
    this.emit('task:published', task, task.metadata.to);

    return task;
  }

  /**
   * Subscribe to tasks for a team
   */
  subscribe(
    team: TeamType,
    callback: TaskSubscriber,
    options: SubscriptionOptions = {}
  ): () => void {
    // Add subscription
    if (!this.subscriptions.has(team)) {
      this.subscriptions.set(team, new Set());
    }
    this.subscriptions.get(team)!.add(callback);

    // Setup file watching or polling
    const inboxPath = this.workspace.getInboxPath(team);

    if (options.pollingInterval) {
      // Use polling
      this.setupPolling(team, inboxPath, options);
    } else {
      // Use file watching
      this.setupWatcher(team, inboxPath, options);
    }

    // Process existing tasks
    this.processExistingTasks(team, options).catch((error) => {
      this.emit('error', error);
    });

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(team);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscriptions.delete(team);
          this.stopWatchingTeam(team);
        }
      }
    };
  }

  /**
   * Setup file watcher for a team's inbox
   */
  private setupWatcher(team: TeamType, inboxPath: string, options: SubscriptionOptions): void {
    if (this.watchers.has(inboxPath)) {
      return;
    }

    try {
      const watcher = watch(inboxPath, { persistent: true }, (eventType, filename) => {
        if (this.stopped) return;
        if (eventType === 'rename' && filename && filename.endsWith('.md')) {
          const filePath = path.join(inboxPath, filename);
          this.handleNewFile(team, filePath, options).catch((error) => {
            if (this.stopped) return;
            this.emit('error', error);
          });
        }
      });

      this.watchers.set(inboxPath, watcher);

      watcher.on('error', (error) => {
        this.emit('error', error);
      });
    } catch {
      // Fall back to polling if watch fails
      this.setupPolling(team, inboxPath, { ...options, pollingInterval: 5000 });
    }
  }

  /**
   * Setup polling for a team's inbox
   */
  private setupPolling(team: TeamType, _inboxPath: string, options: SubscriptionOptions): void {
    if (this.pollingIntervals.has(team)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.processExistingTasks(team, options);
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    }, options.pollingInterval || 5000);

    this.pollingIntervals.set(team, interval);
  }

  /**
   * Stop watching a team's inbox
   */
  private stopWatchingTeam(team: TeamType): void {
    const teamInboxPath = this.workspace.getInboxPath(team);

    const watcher = this.watchers.get(teamInboxPath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(teamInboxPath);
    }

    const interval = this.pollingIntervals.get(team);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(team);
    }
  }

  /**
   * Handle new file in inbox
   */
  private async handleNewFile(
    team: TeamType,
    filePath: string,
    options: SubscriptionOptions
  ): Promise<void> {
    // Ignore events after queue has been stopped (watcher callbacks may fire after close)
    if (this.stopped) {
      return;
    }

    // Check if file exists and is not being processed
    const taskId = path.basename(filePath);
    if (this.processingTasks.has(taskId)) {
      return;
    }

    try {
      const exists = await this.workspace.fileExists(filePath);
      if (!exists) {
        return;
      }

      const content = await this.workspace.readFile(filePath);
      const task = parseTaskDocument(content, filePath);

      // Apply filter if specified
      if (options.filter && !this.matchesFilter(task, options.filter)) {
        return;
      }

      // Process task
      await this.processTask(team, task, filePath, options);
    } catch (error) {
      // After stop, silently ignore all errors from stale watcher callbacks
      if (this.stopped) {
        return;
      }

      // Handle race condition: file/directory may have been deleted/moved
      // This is expected behavior in file watching systems, not an error
      const isFileNotFoundError =
        error instanceof Error &&
        ((error as NodeJS.ErrnoException).code === 'ENOENT' ||
          error.message.includes('ENOENT') ||
          error.message.includes('no such file'));

      if (isFileNotFoundError) {
        return;
      }

      this.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Process existing tasks in inbox
   */
  private async processExistingTasks(team: TeamType, options: SubscriptionOptions): Promise<void> {
    const inboxPath = this.workspace.getInboxPath(team);
    const files = await this.workspace.listFiles(inboxPath, /\.md$/);

    // Sort by priority and creation time
    const sortedFiles = await this.sortFilesByPriority(files);

    // Process in batches for better throughput
    const batchSize = 5;
    for (let i = 0; i < sortedFiles.length; i += batchSize) {
      const batch = sortedFiles.slice(i, i + batchSize);
      await Promise.all(batch.map((file) => this.handleNewFile(team, file.path, options)));
    }
  }

  /**
   * Sort files by priority (embedded in filename)
   */
  private async sortFilesByPriority(files: WorkspaceFile[]): Promise<WorkspaceFile[]> {
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return files.sort((a, b) => {
      // Extract priority from filename (format: priority_type_title_id.md)
      const priorityA = this.extractPriorityFromFilename(a.name);
      const priorityB = this.extractPriorityFromFilename(b.name);

      const orderA = priorityOrder[priorityA] ?? 2;
      const orderB = priorityOrder[priorityB] ?? 2;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      // Same priority: sort by creation time
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Extract priority from filename
   */
  private extractPriorityFromFilename(filename: string): TaskPriority {
    const match = filename.match(/^(critical|high|medium|low)_/);
    return (match?.[1] as TaskPriority) || 'medium';
  }

  /**
   * Process a single task
   */
  private async processTask(
    team: TeamType,
    task: TaskDocument,
    filePath: string,
    options: SubscriptionOptions
  ): Promise<void> {
    const taskId = task.metadata.id;

    // Mark as processing
    if (this.processingTasks.has(taskId)) {
      return;
    }
    this.processingTasks.add(taskId);

    try {
      // Move to in-progress
      const inProgressPath = await this.workspace.moveFile(
        filePath,
        this.workspace.getInProgressPath()
      );

      // Update status
      const updatedTask = updateTaskStatus(task, 'in_progress');
      await this.workspace.writeFile(inProgressPath, serializeTaskDocument(updatedTask));

      this.emit('task:received', updatedTask, team);
      this.emit('task:started', updatedTask);

      // Get subscribers
      const subscribers = this.subscriptions.get(team);
      if (subscribers) {
        for (const subscriber of subscribers) {
          await subscriber(updatedTask);
        }
      }

      // Auto-acknowledge if enabled
      if (options.autoAcknowledge) {
        await this.acknowledge(taskId, 'completed');
      }
    } catch (error) {
      // Handle failure
      await this.handleTaskFailure(task, error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.processingTasks.delete(taskId);
    }
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(task: TaskDocument, error: Error): Promise<void> {
    const inProgressPath = path.join(
      this.workspace.getInProgressPath(),
      generateTaskFilename(task)
    );

    if (canRetry(task)) {
      // Retry: move back to inbox
      const retriedTask = incrementRetry(updateTaskStatus(task, 'pending'));
      const inboxPath = this.workspace.getInboxPath(task.metadata.to);
      const filename = generateTaskFilename(retriedTask);

      await this.workspace.writeFile(
        path.join(inboxPath, filename),
        serializeTaskDocument(retriedTask)
      );

      // Remove from in-progress
      try {
        await this.workspace.deleteFile(inProgressPath);
      } catch {
        // Ignore if file doesn't exist
      }

      this.emit('task:retry', retriedTask);
    } else {
      // Max retries exceeded: move to failed
      const failedTask = updateTaskStatus(task, 'failed');

      await this.workspace.moveFile(inProgressPath, this.workspace.getFailedPath());
      this.emit('task:failed', failedTask, error);
    }
  }

  /**
   * Acknowledge task completion or failure
   */
  async acknowledge(
    taskId: string,
    status: 'completed' | 'failed',
    result?: string
  ): Promise<void> {
    await this.initialize();

    // Find task in in-progress
    const inProgressFiles = await this.workspace.listFiles(
      this.workspace.getInProgressPath(),
      /\.md$/
    );

    const taskFile = inProgressFiles.find((f) => f.name.includes(taskId));
    if (!taskFile) {
      throw new Error(`Task ${taskId} not found in in-progress`);
    }

    // Read and update task
    const content = await this.workspace.readFile(taskFile.path);
    let task = parseTaskDocument(content, taskFile.path);
    task = updateTaskStatus(task, status);

    // Add result to content if provided
    if (result) {
      task = {
        ...task,
        content: task.content + '\n\n## Result\n\n' + result,
      };
    }

    // Move to appropriate directory
    const destDir =
      status === 'completed'
        ? this.workspace.getOutboxPath()
        : this.workspace.getFailedPath();

    await this.workspace.writeFile(taskFile.path, serializeTaskDocument(task));
    await this.workspace.moveFile(taskFile.path, destDir);

    // Emit event
    if (status === 'completed') {
      this.emit('task:completed', task);
    } else {
      this.emit('task:failed', task, new Error('Task failed'));
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskDocument | null> {
    await this.initialize();

    // Search in all directories
    const directories = [
      this.workspace.getInProgressPath(),
      this.workspace.getOutboxPath(),
      this.workspace.getFailedPath(),
      this.workspace.getArchivePath(),
    ];

    for (const dir of directories) {
      const files = await this.workspace.listFiles(dir, /\.md$/);
      const taskFile = files.find((f) => f.name.includes(taskId));

      if (taskFile) {
        const content = await this.workspace.readFile(taskFile.path);
        return parseTaskDocument(content, taskFile.path);
      }
    }

    return null;
  }

  /**
   * Get all tasks matching filter
   */
  async getTasks(filter?: TaskFilter): Promise<TaskDocument[]> {
    await this.initialize();

    const tasks: TaskDocument[] = [];

    // Search in all directories
    const directories = [
      this.workspace.getInProgressPath(),
      this.workspace.getOutboxPath(),
      this.workspace.getFailedPath(),
    ];

    for (const dir of directories) {
      const files = await this.workspace.listFiles(dir, /\.md$/);

      for (const file of files) {
        try {
          const content = await this.workspace.readFile(file.path);
          const task = parseTaskDocument(content, file.path);

          if (!filter || this.matchesFilter(task, filter)) {
            tasks.push(task);
          }
        } catch {
          // Skip invalid files
        }
      }
    }

    return tasks;
  }

  /**
   * Check if task matches filter
   */
  private matchesFilter(task: TaskDocument, filter: TaskFilter): boolean {
    const { metadata } = task;

    if (filter.status && !filter.status.includes(metadata.status)) {
      return false;
    }

    if (filter.priority && !filter.priority.includes(metadata.priority)) {
      return false;
    }

    if (filter.type && !filter.type.includes(metadata.type)) {
      return false;
    }

    if (filter.from && !filter.from.includes(metadata.from)) {
      return false;
    }

    if (filter.to && !filter.to.includes(metadata.to)) {
      return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const hasTag = filter.tags.some((tag) => metadata.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }

    if (filter.projectId && metadata.projectId !== filter.projectId) {
      return false;
    }

    if (filter.parentTaskId && metadata.parentTaskId !== filter.parentTaskId) {
      return false;
    }

    if (filter.createdAfter) {
      const createdAt = new Date(metadata.createdAt);
      const afterDate = new Date(filter.createdAfter);
      if (createdAt < afterDate) {
        return false;
      }
    }

    if (filter.createdBefore) {
      const createdAt = new Date(metadata.createdAt);
      const beforeDate = new Date(filter.createdBefore);
      if (createdAt > beforeDate) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    byTeam: Record<TeamType, number>;
  }> {
    const workspaceStats = await this.workspace.getStats();

    let pending = 0;
    const byTeam = workspaceStats.inboxCount;

    for (const count of Object.values(byTeam)) {
      pending += count;
    }

    return {
      pending,
      inProgress: workspaceStats.inProgressCount,
      completed: workspaceStats.outboxCount,
      failed: workspaceStats.failedCount,
      byTeam,
    };
  }

  /**
   * Archive completed tasks older than specified age
   */
  async archiveOldTasks(maxAgeMs: number): Promise<number> {
    const outboxFiles = await this.workspace.listFiles(
      this.workspace.getOutboxPath(),
      /\.md$/
    );

    const now = Date.now();
    let archivedCount = 0;

    for (const file of outboxFiles) {
      const age = now - file.modifiedAt.getTime();
      if (age > maxAgeMs) {
        await this.workspace.moveFile(file.path, this.workspace.getArchivePath());
        archivedCount++;
      }
    }

    return archivedCount;
  }

  /**
   * Purge old archived tasks
   */
  async purgeArchive(maxAgeMs: number): Promise<number> {
    return this.workspace.cleanupOldFiles(this.workspace.getArchivePath(), maxAgeMs);
  }
}

// Type-safe event emitter
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface DocumentQueue {
  on<E extends keyof QueueEvents>(event: E, listener: QueueEvents[E]): this;
  emit<E extends keyof QueueEvents>(event: E, ...args: Parameters<QueueEvents[E]>): boolean;
}
