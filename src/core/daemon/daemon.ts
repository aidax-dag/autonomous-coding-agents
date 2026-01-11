/**
 * Daemon Module
 *
 * Provides 24/7 continuous execution loop for autonomous project management.
 * Polls for pending tasks, dispatches to agents, handles failures, and
 * monitors system health.
 *
 * Key Features:
 * - Multi-project management
 * - Task polling and scheduling
 * - Agent dispatch (abstract interface)
 * - Health monitoring
 * - Graceful shutdown
 * - Error recovery
 *
 * @module core/daemon/daemon
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import {
  ProjectStore,
  ProjectState,
  ProjectStatus,
  TaskStatus,
  TaskRecord,
} from '../memory/project-store';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Daemon status
 */
export enum DaemonStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error',
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  success: boolean;
  taskId: string;
  projectId: string;
  result?: unknown;
  error?: string;
  duration: number;
  agentId?: string;
}

/**
 * Agent dispatch interface
 * Implementations will connect to actual agents (Claude, GPT, etc.)
 */
export interface IAgentDispatcher {
  /** Dispatch a task to an agent */
  dispatch(task: TaskRecord, project: ProjectState): Promise<TaskExecutionResult>;

  /** Check if dispatcher is available */
  isAvailable(): Promise<boolean>;

  /** Get dispatcher status */
  getStatus(): Promise<DispatcherStatus>;
}

/**
 * Dispatcher status
 */
export interface DispatcherStatus {
  available: boolean;
  activeAgents: number;
  maxAgents: number;
  queuedTasks: number;
}

/**
 * Health metrics
 */
export interface HealthMetrics {
  status: DaemonStatus;
  uptime: number;
  startedAt: Date;
  lastActivityAt?: Date;
  projectCount: number;
  activeProjects: number;
  totalTasksProcessed: number;
  totalTasksSucceeded: number;
  totalTasksFailed: number;
  averageTaskDuration: number;
  memoryUsage: NodeJS.MemoryUsage;
  errors: DaemonError[];
}

/**
 * Daemon error record
 */
export interface DaemonError {
  timestamp: Date;
  projectId?: string;
  taskId?: string;
  error: string;
  recovered: boolean;
}

/**
 * Project registration
 */
export interface ProjectRegistration {
  projectId: string;
  priority: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** Polling interval in milliseconds */
  pollInterval: number;
  /** Maximum concurrent projects */
  maxConcurrentProjects: number;
  /** Maximum concurrent tasks per project */
  maxConcurrentTasks: number;
  /** Default task timeout in milliseconds */
  defaultTaskTimeout: number;
  /** Default retry count */
  defaultMaxRetries: number;
  /** Delay between retries in milliseconds */
  defaultRetryDelay: number;
  /** Health check interval in milliseconds */
  healthCheckInterval: number;
  /** Enable verbose logging */
  verbose: boolean;
  /** Maximum errors before stopping */
  maxConsecutiveErrors: number;
  /** Auto-restart on error */
  autoRestart: boolean;
  /** Auto-restart delay in milliseconds */
  autoRestartDelay: number;
}

/**
 * Daemon interface
 */
export interface IDaemon {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;

  // Project management
  addProject(projectId: string, options?: Partial<ProjectRegistration>): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  getProjects(): ProjectRegistration[];

  // Status
  getStatus(): DaemonStatus;
  getHealth(): HealthMetrics;

  // Events
  on(event: 'started' | 'stopped' | 'paused' | 'resumed', listener: () => void): this;
  on(event: 'task:started', listener: (task: TaskRecord, project: ProjectState) => void): this;
  on(event: 'task:completed', listener: (result: TaskExecutionResult) => void): this;
  on(event: 'task:failed', listener: (result: TaskExecutionResult) => void): this;
  on(event: 'error', listener: (error: DaemonError) => void): this;
}

/**
 * Daemon events
 */
export enum DaemonEvent {
  STARTED = 'started',
  STOPPED = 'stopped',
  PAUSED = 'paused',
  RESUMED = 'resumed',
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  PROJECT_ADDED = 'project:added',
  PROJECT_REMOVED = 'project:removed',
  PROJECT_COMPLETED = 'project:completed',
  HEALTH_CHECK = 'health:check',
  ERROR = 'error',
}

// ============================================================================
// Configuration Schema
// ============================================================================

export const DaemonConfigSchema = z.object({
  pollInterval: z.number().min(100).default(5000),
  maxConcurrentProjects: z.number().min(1).default(5),
  maxConcurrentTasks: z.number().min(1).default(3),
  defaultTaskTimeout: z.number().min(1000).default(300000), // 5 minutes
  defaultMaxRetries: z.number().min(0).default(3),
  defaultRetryDelay: z.number().min(100).default(5000),
  healthCheckInterval: z.number().min(1000).default(30000),
  verbose: z.boolean().default(false),
  maxConsecutiveErrors: z.number().min(1).default(10),
  autoRestart: z.boolean().default(true),
  autoRestartDelay: z.number().min(1000).default(30000),
});

export const DEFAULT_DAEMON_CONFIG: DaemonConfig = {
  pollInterval: 5000,
  maxConcurrentProjects: 5,
  maxConcurrentTasks: 3,
  defaultTaskTimeout: 300000,
  defaultMaxRetries: 3,
  defaultRetryDelay: 5000,
  healthCheckInterval: 30000,
  verbose: false,
  maxConsecutiveErrors: 10,
  autoRestart: true,
  autoRestartDelay: 30000,
};

// ============================================================================
// Mock Agent Dispatcher (for testing)
// ============================================================================

/**
 * Mock agent dispatcher for testing
 */
export class MockAgentDispatcher implements IAgentDispatcher {
  private simulatedDelay: number;
  private failureRate: number;

  constructor(simulatedDelay = 100, failureRate = 0) {
    this.simulatedDelay = simulatedDelay;
    this.failureRate = failureRate;
  }

  async dispatch(task: TaskRecord, project: ProjectState): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    await new Promise(resolve => setTimeout(resolve, this.simulatedDelay));

    const shouldFail = Math.random() < this.failureRate;

    return {
      success: !shouldFail,
      taskId: task.id,
      projectId: project.id,
      result: shouldFail ? undefined : { mock: true, taskName: task.name },
      error: shouldFail ? 'Simulated failure' : undefined,
      duration: Date.now() - startTime,
      agentId: 'mock-agent',
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async getStatus(): Promise<DispatcherStatus> {
    return {
      available: true,
      activeAgents: 0,
      maxAgents: 10,
      queuedTasks: 0,
    };
  }
}

// ============================================================================
// Daemon Implementation
// ============================================================================

/**
 * Daemon implementation for 24/7 autonomous execution
 */
export class Daemon extends EventEmitter implements IDaemon {
  private config: DaemonConfig;
  private projectStore: ProjectStore;
  private dispatcher: IAgentDispatcher;
  private status: DaemonStatus = DaemonStatus.STOPPED;
  private projects: Map<string, ProjectRegistration> = new Map();
  private activeTasks: Map<string, Promise<TaskExecutionResult>> = new Map();

  private pollTimer?: NodeJS.Timeout;
  private healthTimer?: NodeJS.Timeout;
  private startedAt?: Date;
  private lastActivityAt?: Date;

  private metrics = {
    totalTasksProcessed: 0,
    totalTasksSucceeded: 0,
    totalTasksFailed: 0,
    totalTaskDuration: 0,
    consecutiveErrors: 0,
  };

  private errors: DaemonError[] = [];
  private readonly maxErrorHistory = 100;

  constructor(
    projectStore: ProjectStore,
    dispatcher: IAgentDispatcher,
    config: Partial<DaemonConfig> = {}
  ) {
    super();
    this.projectStore = projectStore;
    this.dispatcher = dispatcher;
    this.config = { ...DEFAULT_DAEMON_CONFIG, ...config };
  }

  // ==================== Lifecycle ====================

  async start(): Promise<void> {
    if (this.status === DaemonStatus.RUNNING) {
      this.log('Daemon is already running');
      return;
    }

    this.status = DaemonStatus.STARTING;
    this.log('Starting daemon...');

    try {
      // Initialize project store
      await this.projectStore.initialize();

      // Verify dispatcher availability
      const available = await this.dispatcher.isAvailable();
      if (!available) {
        throw new Error('Agent dispatcher is not available');
      }

      this.startedAt = new Date();
      this.status = DaemonStatus.RUNNING;

      // Start polling loop
      this.startPolling();

      // Start health monitoring
      this.startHealthMonitoring();

      this.emit(DaemonEvent.STARTED);
      this.log('Daemon started successfully');
    } catch (error) {
      this.status = DaemonStatus.ERROR;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordError(undefined, undefined, errorMsg);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.status === DaemonStatus.STOPPED) {
      this.log('Daemon is already stopped');
      return;
    }

    this.status = DaemonStatus.STOPPING;
    this.log('Stopping daemon...');

    // Stop timers
    this.stopPolling();
    this.stopHealthMonitoring();

    // Wait for active tasks to complete (with timeout)
    await this.waitForActiveTasks(30000);

    // Clean up
    this.activeTasks.clear();
    this.status = DaemonStatus.STOPPED;

    this.emit(DaemonEvent.STOPPED);
    this.log('Daemon stopped');
  }

  async pause(): Promise<void> {
    if (this.status !== DaemonStatus.RUNNING) {
      throw new Error('Can only pause a running daemon');
    }

    this.status = DaemonStatus.PAUSED;
    this.stopPolling();

    this.emit(DaemonEvent.PAUSED);
    this.log('Daemon paused');
  }

  async resume(): Promise<void> {
    if (this.status !== DaemonStatus.PAUSED) {
      throw new Error('Can only resume a paused daemon');
    }

    this.status = DaemonStatus.RUNNING;
    this.startPolling();

    this.emit(DaemonEvent.RESUMED);
    this.log('Daemon resumed');
  }

  // ==================== Project Management ====================

  async addProject(projectId: string, options?: Partial<ProjectRegistration>): Promise<void> {
    if (this.projects.has(projectId)) {
      this.log(`Project ${projectId} is already registered`);
      return;
    }

    // Verify project exists
    const project = await this.projectStore.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const registration: ProjectRegistration = {
      projectId,
      priority: options?.priority ?? 1,
      maxRetries: options?.maxRetries ?? this.config.defaultMaxRetries,
      retryDelay: options?.retryDelay ?? this.config.defaultRetryDelay,
      timeout: options?.timeout ?? this.config.defaultTaskTimeout,
    };

    this.projects.set(projectId, registration);

    // Update project status
    await this.projectStore.updateProject(projectId, {
      status: ProjectStatus.IN_PROGRESS,
    });

    this.emit(DaemonEvent.PROJECT_ADDED, registration);
    this.log(`Project added: ${projectId}`);
  }

  async removeProject(projectId: string): Promise<void> {
    if (!this.projects.has(projectId)) {
      this.log(`Project ${projectId} is not registered`);
      return;
    }

    this.projects.delete(projectId);
    this.emit(DaemonEvent.PROJECT_REMOVED, { projectId });
    this.log(`Project removed: ${projectId}`);
  }

  getProjects(): ProjectRegistration[] {
    return Array.from(this.projects.values());
  }

  // ==================== Status ====================

  getStatus(): DaemonStatus {
    return this.status;
  }

  getHealth(): HealthMetrics {
    const activeProjects = this.getProjects().length;

    return {
      status: this.status,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      startedAt: this.startedAt || new Date(),
      lastActivityAt: this.lastActivityAt,
      projectCount: this.projects.size,
      activeProjects,
      totalTasksProcessed: this.metrics.totalTasksProcessed,
      totalTasksSucceeded: this.metrics.totalTasksSucceeded,
      totalTasksFailed: this.metrics.totalTasksFailed,
      averageTaskDuration:
        this.metrics.totalTasksProcessed > 0
          ? this.metrics.totalTaskDuration / this.metrics.totalTasksProcessed
          : 0,
      memoryUsage: process.memoryUsage(),
      errors: this.errors.slice(-10), // Last 10 errors
    };
  }

  // ==================== Polling Loop ====================

  private startPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(
      () => this.pollCycle().catch(e => this.handlePollError(e)),
      this.config.pollInterval
    );

    // Run immediately
    this.pollCycle().catch(e => this.handlePollError(e));
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  private async pollCycle(): Promise<void> {
    if (this.status !== DaemonStatus.RUNNING) {
      return;
    }

    // Check concurrent limits
    if (this.activeTasks.size >= this.config.maxConcurrentProjects * this.config.maxConcurrentTasks) {
      this.log('Max concurrent tasks reached, skipping poll');
      return;
    }

    // Get projects sorted by priority
    const registrations = Array.from(this.projects.values())
      .sort((a, b) => b.priority - a.priority);

    for (const registration of registrations) {
      try {
        await this.processProject(registration);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.recordError(registration.projectId, undefined, errorMsg);
      }
    }
  }

  private async processProject(registration: ProjectRegistration): Promise<void> {
    const project = await this.projectStore.getProject(registration.projectId);
    if (!project) {
      this.log(`Project ${registration.projectId} not found, removing from daemon`);
      this.projects.delete(registration.projectId);
      return;
    }

    // Skip if project is not in progress
    if (project.status !== ProjectStatus.IN_PROGRESS) {
      return;
    }

    // Get next task
    const task = await this.projectStore.getNextTask(registration.projectId);
    if (!task) {
      // Check if project is complete
      await this.checkProjectCompletion(project);
      return;
    }

    // Check if we have capacity
    const projectActiveTasks = Array.from(this.activeTasks.keys())
      .filter(key => key.startsWith(`${registration.projectId}:`))
      .length;

    if (projectActiveTasks >= this.config.maxConcurrentTasks) {
      return;
    }

    // Execute task
    await this.executeTask(task, project, registration);
  }

  private async executeTask(
    task: TaskRecord,
    project: ProjectState,
    registration: ProjectRegistration
  ): Promise<void> {
    const taskKey = `${project.id}:${task.id}`;

    // Skip if already executing
    if (this.activeTasks.has(taskKey)) {
      return;
    }

    this.log(`Starting task: ${task.name} (${task.id})`);
    this.lastActivityAt = new Date();

    // Mark task as in progress
    await this.projectStore.updateTask(project.id, task.id, {
      status: TaskStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    this.emit(DaemonEvent.TASK_STARTED, task, project);

    // Execute with timeout
    const execution = this.executeWithTimeout(task, project, registration);
    this.activeTasks.set(taskKey, execution);

    try {
      const result = await execution;
      this.metrics.totalTasksProcessed++;
      this.metrics.totalTaskDuration += result.duration;

      if (result.success) {
        this.metrics.totalTasksSucceeded++;
        this.metrics.consecutiveErrors = 0;
        await this.projectStore.markTaskComplete(project.id, task.id, result.result);
        this.emit(DaemonEvent.TASK_COMPLETED, result);
        this.log(`Task completed: ${task.name}`);
      } else {
        this.metrics.totalTasksFailed++;
        this.metrics.consecutiveErrors++;
        await this.handleTaskFailure(task, project, registration, result.error || 'Unknown error');
        this.emit(DaemonEvent.TASK_FAILED, result);
      }
    } catch (error) {
      this.metrics.totalTasksFailed++;
      this.metrics.consecutiveErrors++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      await this.handleTaskFailure(task, project, registration, errorMsg);
    } finally {
      this.activeTasks.delete(taskKey);
    }

    // Check for too many consecutive errors
    if (this.metrics.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      this.log('Too many consecutive errors, pausing daemon');
      await this.pause();
      if (this.config.autoRestart) {
        setTimeout(() => this.resume().catch(e => this.log(`Auto-restart failed: ${e}`)),
          this.config.autoRestartDelay);
      }
    }
  }

  private async executeWithTimeout(
    task: TaskRecord,
    project: ProjectState,
    registration: ProjectRegistration
  ): Promise<TaskExecutionResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timeout after ${registration.timeout}ms`));
      }, registration.timeout);

      this.dispatcher.dispatch(task, project)
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private async handleTaskFailure(
    task: TaskRecord,
    project: ProjectState,
    registration: ProjectRegistration,
    error: string
  ): Promise<void> {
    this.log(`Task failed: ${task.name} - ${error}`);
    this.recordError(project.id, task.id, error);

    // Check retry count
    if (task.attempts < registration.maxRetries) {
      // Schedule retry
      await this.projectStore.updateTask(project.id, task.id, {
        status: TaskStatus.PENDING,
        error,
      });
      this.log(`Task ${task.name} will be retried (attempt ${task.attempts + 1}/${registration.maxRetries})`);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, registration.retryDelay));
    } else {
      // Mark as failed permanently
      await this.projectStore.markTaskFailed(project.id, task.id, error);
      this.log(`Task ${task.name} failed permanently after ${task.attempts} attempts`);
    }
  }

  private async checkProjectCompletion(project: ProjectState): Promise<void> {
    // Check if all tasks are complete
    const allComplete = Array.from(project.tasks.values())
      .every(t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SKIPPED);

    if (allComplete) {
      await this.projectStore.updateProject(project.id, {
        status: ProjectStatus.COMPLETED,
      });
      this.emit(DaemonEvent.PROJECT_COMPLETED, { projectId: project.id });
      this.log(`Project completed: ${project.name}`);

      // Remove from active projects
      this.projects.delete(project.id);
    }
  }

  // ==================== Health Monitoring ====================

  private startHealthMonitoring(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
    }

    this.healthTimer = setInterval(() => {
      const health = this.getHealth();
      this.emit(DaemonEvent.HEALTH_CHECK, health);

      if (this.config.verbose) {
        this.log(`Health check: ${health.activeProjects} active projects, ${this.activeTasks.size} active tasks`);
      }
    }, this.config.healthCheckInterval);
  }

  private stopHealthMonitoring(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = undefined;
    }
  }

  // ==================== Error Handling ====================

  private recordError(projectId: string | undefined, taskId: string | undefined, error: string): void {
    const daemonError: DaemonError = {
      timestamp: new Date(),
      projectId,
      taskId,
      error,
      recovered: false,
    };

    this.errors.push(daemonError);

    // Trim error history
    if (this.errors.length > this.maxErrorHistory) {
      this.errors = this.errors.slice(-this.maxErrorHistory);
    }

    this.emit(DaemonEvent.ERROR, daemonError);
  }

  private handlePollError(error: unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error);
    this.log(`Poll error: ${errorMsg}`);
    this.recordError(undefined, undefined, errorMsg);
  }

  // ==================== Utilities ====================

  private async waitForActiveTasks(timeout: number): Promise<void> {
    const startTime = Date.now();

    while (this.activeTasks.size > 0) {
      if (Date.now() - startTime > timeout) {
        this.log(`Timeout waiting for ${this.activeTasks.size} active tasks`);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private log(message: string): void {
    if (this.config.verbose) {
      console.log(`[Daemon] ${message}`);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a daemon instance
 */
export function createDaemon(
  projectStore: ProjectStore,
  dispatcher: IAgentDispatcher,
  config: Partial<DaemonConfig> = {}
): Daemon {
  return new Daemon(projectStore, dispatcher, config);
}
