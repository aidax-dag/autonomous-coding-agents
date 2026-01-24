/**
 * Background Executor
 *
 * Manages background execution of agent tasks with lifecycle management,
 * progress tracking, and event-based monitoring.
 *
 * Features:
 * - Concurrent job execution with limits
 * - Job lifecycle management (submit, cancel, pause, resume)
 * - Event-based progress and status updates
 * - Timeout handling
 * - Clean shutdown
 *
 * @module core/agents/execution
 */

import { z } from 'zod';
import {
  IAgent,
  ITask,
  TaskResult,
  TaskResultStatus,
  AgentType,
  TaskPriority,
} from '../../interfaces/agent.interface';
import { IEventBus, IEvent } from '../../interfaces/event.interface';

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Enums
// ============================================================================

/**
 * Background job status
 */
export enum BackgroundJobStatus {
  /** Job is queued and waiting to start */
  PENDING = 'pending',
  /** Job is currently running */
  RUNNING = 'running',
  /** Job completed successfully */
  COMPLETED = 'completed',
  /** Job failed with an error */
  FAILED = 'failed',
  /** Job was cancelled */
  CANCELLED = 'cancelled',
  /** Job timed out */
  TIMEOUT = 'timeout',
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Concurrency scope for group-based limiting
 *
 * Reference: oh-my-opencode providerConcurrency, modelConcurrency pattern
 */
export type ConcurrencyScope = 'global' | 'provider' | 'model' | 'agent' | 'custom';

/**
 * Concurrency group configuration
 */
export interface ConcurrencyGroupConfig {
  /** Group name */
  name: string;
  /** Maximum concurrent jobs in this group */
  maxConcurrent: number;
  /** Scope type */
  scope: ConcurrencyScope;
  /** Priority boost for this group (negative = higher priority) */
  priorityBoost?: number;
}

/**
 * Background job options schema
 */
export const BackgroundJobOptionsSchema = z.object({
  /** Timeout in milliseconds */
  timeout: z.number().positive().optional(),
  /** Priority level */
  priority: z.nativeEnum(TaskPriority).optional(),
  /** Correlation ID for tracking */
  correlationId: z.string().optional(),
  /** Tags for categorization */
  tags: z.array(z.string()).optional(),
  /** Concurrency group for limiting parallel jobs */
  concurrencyGroup: z.string().optional(),
  /** Callback on completion */
  onComplete: z.function().optional(),
  /** Callback on failure */
  onError: z.function().optional(),
  /** Callback on progress */
  onProgress: z.function().optional(),
});

export type BackgroundJobOptions = z.infer<typeof BackgroundJobOptionsSchema>;

/**
 * Background executor config schema
 */
export const BackgroundExecutorConfigSchema = z.object({
  /** Maximum concurrent jobs (global limit) */
  maxConcurrentJobs: z.number().min(1).max(100).default(10),
  /** Default job timeout in milliseconds */
  defaultTimeout: z.number().positive().default(300000), // 5 minutes
  /** Enable event emission */
  enableEvents: z.boolean().default(true),
  /** Job queue size limit */
  queueSizeLimit: z.number().positive().default(1000),
  /** Default concurrency limits by scope */
  defaultConcurrencyLimits: z
    .record(z.string(), z.number().min(1).max(50))
    .default({
      provider: 5,
      model: 3,
      agent: 2,
    }),
});

export type BackgroundExecutorConfig = z.infer<typeof BackgroundExecutorConfigSchema>;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Background job information
 */
export interface BackgroundJob {
  /** Unique job ID */
  readonly id: string;
  /** Agent ID executing the job */
  readonly agentId: string;
  /** Agent type */
  readonly agentType: AgentType;
  /** Task being executed */
  readonly task: ITask;
  /** Current job status */
  status: BackgroundJobStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Job result (when completed) */
  result?: TaskResult;
  /** Error message (when failed) */
  error?: string;
  /** Job creation time */
  readonly createdAt: Date;
  /** Job start time */
  startedAt?: Date;
  /** Job completion time */
  completedAt?: Date;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Correlation ID for tracking */
  correlationId?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Concurrency group for limiting parallel jobs */
  concurrencyGroup?: string;
}

/**
 * Background executor interface
 */
export interface IBackgroundExecutor {
  /**
   * Submit a task for background execution
   */
  submit(
    agent: IAgent,
    task: ITask,
    options?: BackgroundJobOptions
  ): Promise<BackgroundJob>;

  /**
   * Cancel a running job
   */
  cancel(jobId: string): Promise<boolean>;

  /**
   * Get job by ID
   */
  getJob(jobId: string): BackgroundJob | undefined;

  /**
   * Get all active jobs
   */
  getActiveJobs(): BackgroundJob[];

  /**
   * Get all jobs for an agent
   */
  getJobsByAgent(agentId: string): BackgroundJob[];

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: BackgroundJobStatus): BackgroundJob[];

  /**
   * Get pending job count
   */
  getPendingCount(): number;

  /**
   * Get running job count
   */
  getRunningCount(): number;

  /**
   * Wait for a job to complete
   */
  waitFor(jobId: string, timeout?: number): Promise<TaskResult>;

  /**
   * Wait for all jobs to complete
   */
  waitForAll(timeout?: number): Promise<void>;

  /**
   * Shutdown the executor gracefully
   */
  shutdown(force?: boolean): Promise<void>;

  // === Concurrency Management ===

  /**
   * Set concurrency limit for a group
   */
  setConcurrencyLimit(group: string, limit: number): void;

  /**
   * Get concurrency limit for a group
   */
  getConcurrencyLimit(group: string): number;

  /**
   * Get running count for a specific group
   */
  getRunningCountByGroup(group: string): number;

  /**
   * Get jobs by concurrency group
   */
  getJobsByGroup(group: string): BackgroundJob[];

  /**
   * Check if executor is running
   */
  isRunning(): boolean;

  /**
   * Get executor statistics
   */
  getStats(): BackgroundExecutorStats;
}

/**
 * Executor statistics
 */
export interface BackgroundExecutorStats {
  pendingJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  timedOutJobs: number;
  totalJobsSubmitted: number;
  averageJobDuration: number;
  uptime: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Background job event payload
 */
export interface BackgroundJobEventPayload {
  jobId: string;
  agentId: string;
  agentType: AgentType;
  taskId: string;
  status: BackgroundJobStatus;
  progress?: number;
  error?: string;
  result?: TaskResult;
  duration?: number;
}

/**
 * Background executor events
 */
export const BackgroundExecutorEvents = {
  JobSubmitted: 'background.job.submitted',
  JobStarted: 'background.job.started',
  JobProgress: 'background.job.progress',
  JobCompleted: 'background.job.completed',
  JobFailed: 'background.job.failed',
  JobCancelled: 'background.job.cancelled',
  JobTimeout: 'background.job.timeout',
  ExecutorShutdown: 'background.executor.shutdown',
} as const;

export type BackgroundExecutorEventType =
  typeof BackgroundExecutorEvents[keyof typeof BackgroundExecutorEvents];

// ============================================================================
// Implementation
// ============================================================================

/**
 * Internal job state with control mechanisms
 */
interface InternalJob extends BackgroundJob {
  /** Agent reference for execution */
  agent: IAgent;
  /** Abort controller for cancellation */
  abortController?: AbortController;
  /** Promise resolvers for waitFor */
  resolvers: Array<{
    resolve: (result: TaskResult) => void;
    reject: (error: Error) => void;
  }>;
  /** Timeout handle */
  timeoutHandle?: NodeJS.Timeout;
  /** Options */
  options?: BackgroundJobOptions;
}

/**
 * Background Executor Implementation
 *
 * Manages concurrent background execution of agent tasks.
 */
export class BackgroundExecutor implements IBackgroundExecutor {
  private readonly config: BackgroundExecutorConfig;
  private readonly eventBus?: IEventBus;
  private readonly jobs: Map<string, InternalJob> = new Map();
  private readonly pendingQueue: string[] = [];
  private running = true;
  private readonly startTime: Date = new Date();

  // Statistics
  private completedCount = 0;
  private failedCount = 0;
  private cancelledCount = 0;
  private timedOutCount = 0;
  private totalSubmitted = 0;
  private totalDuration = 0;

  // Concurrency group limits (group name -> max concurrent jobs)
  private readonly concurrencyGroupLimits: Map<string, number> = new Map();

  constructor(config?: Partial<BackgroundExecutorConfig>, eventBus?: IEventBus) {
    this.config = BackgroundExecutorConfigSchema.parse(config ?? {});
    this.eventBus = eventBus;
  }

  /**
   * Submit a task for background execution
   */
  async submit(
    agent: IAgent,
    task: ITask,
    options?: BackgroundJobOptions
  ): Promise<BackgroundJob> {
    if (!this.running) {
      throw new Error('BackgroundExecutor is shutting down');
    }

    // Check queue limit (pending + running jobs)
    const activeJobCount = this.pendingQueue.length + this.getRunningCount();
    if (activeJobCount >= this.config.queueSizeLimit) {
      throw new Error(
        `Queue limit reached (${this.config.queueSizeLimit}). Cannot submit new job.`
      );
    }

    const jobId = generateId();
    const timeout = options?.timeout ?? this.config.defaultTimeout;

    const job: InternalJob = {
      id: jobId,
      agentId: agent.id,
      agentType: agent.type,
      task,
      status: BackgroundJobStatus.PENDING,
      progress: 0,
      createdAt: new Date(),
      timeout,
      correlationId: options?.correlationId,
      tags: options?.tags,
      concurrencyGroup: options?.concurrencyGroup,
      agent,
      resolvers: [],
      options,
    };

    this.jobs.set(jobId, job);
    this.pendingQueue.push(jobId);
    this.totalSubmitted++;

    // Emit job submitted event
    this.emitEvent(BackgroundExecutorEvents.JobSubmitted, {
      jobId,
      agentId: agent.id,
      agentType: agent.type,
      taskId: task.id,
      status: BackgroundJobStatus.PENDING,
    });

    // Try to start the job immediately if there's capacity
    this.processQueue();

    return this.toPublicJob(job);
  }

  /**
   * Cancel a running or pending job
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    // Can only cancel pending or running jobs
    if (
      job.status !== BackgroundJobStatus.PENDING &&
      job.status !== BackgroundJobStatus.RUNNING
    ) {
      return false;
    }

    // Remove from pending queue if pending
    const pendingIndex = this.pendingQueue.indexOf(jobId);
    if (pendingIndex !== -1) {
      this.pendingQueue.splice(pendingIndex, 1);
    }

    // Abort if running
    if (job.abortController) {
      job.abortController.abort();
    }

    // Clear timeout
    if (job.timeoutHandle) {
      clearTimeout(job.timeoutHandle);
    }

    job.status = BackgroundJobStatus.CANCELLED;
    job.completedAt = new Date();
    this.cancelledCount++;

    // Reject waiters
    const error = new Error('Job cancelled');
    for (const resolver of job.resolvers) {
      resolver.reject(error);
    }
    job.resolvers = [];

    // Emit cancelled event
    this.emitEvent(BackgroundExecutorEvents.JobCancelled, {
      jobId,
      agentId: job.agentId,
      agentType: job.agentType,
      taskId: job.task.id,
      status: BackgroundJobStatus.CANCELLED,
    });

    // Call error callback
    job.options?.onError?.(error);

    // Process next in queue
    this.processQueue();

    return true;
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): BackgroundJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? this.toPublicJob(job) : undefined;
  }

  /**
   * Get all active (pending or running) jobs
   */
  getActiveJobs(): BackgroundJob[] {
    return Array.from(this.jobs.values())
      .filter(
        (job) =>
          job.status === BackgroundJobStatus.PENDING ||
          job.status === BackgroundJobStatus.RUNNING
      )
      .map((job) => this.toPublicJob(job));
  }

  /**
   * Get all jobs for an agent
   */
  getJobsByAgent(agentId: string): BackgroundJob[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.agentId === agentId)
      .map((job) => this.toPublicJob(job));
  }

  /**
   * Get jobs by status
   */
  getJobsByStatus(status: BackgroundJobStatus): BackgroundJob[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.status === status)
      .map((job) => this.toPublicJob(job));
  }

  /**
   * Get pending job count
   */
  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  /**
   * Get running job count
   */
  getRunningCount(): number {
    return Array.from(this.jobs.values()).filter(
      (job) => job.status === BackgroundJobStatus.RUNNING
    ).length;
  }

  /**
   * Set concurrency limit for a specific group
   */
  setConcurrencyLimit(group: string, limit: number): void {
    if (limit < 1) {
      throw new Error(`Concurrency limit must be at least 1, got ${limit}`);
    }
    this.concurrencyGroupLimits.set(group, limit);
  }

  /**
   * Get concurrency limit for a specific group
   * Returns the group-specific limit or the default from config
   */
  getConcurrencyLimit(group: string): number {
    // Check if there's a specific limit for this group
    const specificLimit = this.concurrencyGroupLimits.get(group);
    if (specificLimit !== undefined) {
      return specificLimit;
    }

    // Check default limits from config
    const defaults = this.config.defaultConcurrencyLimits;
    if (defaults) {
      // Try to match group name with scope defaults
      if (group.startsWith('provider:') && defaults.provider !== undefined) {
        return defaults.provider;
      }
      if (group.startsWith('model:') && defaults.model !== undefined) {
        return defaults.model;
      }
      if (group.startsWith('agent:') && defaults.agent !== undefined) {
        return defaults.agent;
      }
    }

    // Fall back to global max concurrent jobs
    return this.config.maxConcurrentJobs;
  }

  /**
   * Get the count of currently running jobs in a specific group
   */
  getRunningCountByGroup(group: string): number {
    return Array.from(this.jobs.values()).filter(
      (job) =>
        job.status === BackgroundJobStatus.RUNNING &&
        job.concurrencyGroup === group
    ).length;
  }

  /**
   * Get all jobs in a specific concurrency group
   */
  getJobsByGroup(group: string): BackgroundJob[] {
    return Array.from(this.jobs.values())
      .filter((job) => job.concurrencyGroup === group)
      .map((job) => this.toPublicJob(job));
  }

  /**
   * Check if a job can be started based on its concurrency group limit
   */
  private canStartJob(job: InternalJob): boolean {
    // If no concurrency group, only check global limit
    if (!job.concurrencyGroup) {
      return this.getRunningCount() < this.config.maxConcurrentJobs;
    }

    // Check both global and group-specific limits
    const globalOk = this.getRunningCount() < this.config.maxConcurrentJobs;
    const groupLimit = this.getConcurrencyLimit(job.concurrencyGroup);
    const groupRunning = this.getRunningCountByGroup(job.concurrencyGroup);
    const groupOk = groupRunning < groupLimit;

    return globalOk && groupOk;
  }

  /**
   * Wait for a job to complete
   */
  async waitFor(jobId: string, timeout?: number): Promise<TaskResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // If already completed, return result
    if (job.status === BackgroundJobStatus.COMPLETED && job.result) {
      return job.result;
    }

    // If already failed/cancelled/timeout, throw error
    if (
      job.status === BackgroundJobStatus.FAILED ||
      job.status === BackgroundJobStatus.CANCELLED ||
      job.status === BackgroundJobStatus.TIMEOUT
    ) {
      throw new Error(job.error ?? `Job ${job.status}`);
    }

    // Wait for completion
    return new Promise<TaskResult>((resolve, reject) => {
      job.resolvers.push({ resolve, reject });

      // Set timeout if specified
      if (timeout) {
        setTimeout(() => {
          reject(new Error(`Timeout waiting for job: ${jobId}`));
        }, timeout);
      }
    });
  }

  /**
   * Wait for all active jobs to complete
   */
  async waitForAll(timeout?: number): Promise<void> {
    const activeJobs = this.getActiveJobs();
    if (activeJobs.length === 0) {
      return;
    }

    const startTime = Date.now();
    const checkInterval = 100;

    return new Promise<void>((resolve, reject) => {
      const check = () => {
        const stillActive = this.getActiveJobs();
        if (stillActive.length === 0) {
          resolve();
          return;
        }

        if (timeout && Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for all jobs'));
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * Shutdown the executor gracefully
   */
  async shutdown(force = false): Promise<void> {
    this.running = false;

    if (force) {
      // Cancel all running jobs
      for (const [jobId, job] of this.jobs.entries()) {
        if (
          job.status === BackgroundJobStatus.PENDING ||
          job.status === BackgroundJobStatus.RUNNING
        ) {
          await this.cancel(jobId);
        }
      }
    } else {
      // Wait for active jobs to complete
      await this.waitForAll();
    }

    // Emit shutdown event
    this.emitEvent(BackgroundExecutorEvents.ExecutorShutdown, {
      jobId: '',
      agentId: '',
      agentType: AgentType.CUSTOM,
      taskId: '',
      status: BackgroundJobStatus.COMPLETED,
    });
  }

  /**
   * Check if executor is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get executor statistics
   */
  getStats(): BackgroundExecutorStats {
    const totalCompleted = this.completedCount + this.failedCount;
    return {
      pendingJobs: this.getPendingCount(),
      runningJobs: this.getRunningCount(),
      completedJobs: this.completedCount,
      failedJobs: this.failedCount,
      cancelledJobs: this.cancelledCount,
      timedOutJobs: this.timedOutCount,
      totalJobsSubmitted: this.totalSubmitted,
      averageJobDuration:
        totalCompleted > 0 ? this.totalDuration / totalCompleted : 0,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Process pending jobs queue
   *
   * Enhanced to respect both global and group-specific concurrency limits.
   * Jobs that can't start due to group limits are kept in queue for later processing.
   */
  private processQueue(): void {
    if (!this.running) return;

    // Global check: if we're at global capacity, don't process
    if (this.getRunningCount() >= this.config.maxConcurrentJobs) {
      return;
    }

    // Track jobs that couldn't start due to group limits
    const deferredJobIds: string[] = [];
    let startedCount = 0;
    const maxToProcess = this.pendingQueue.length;

    for (let i = 0; i < maxToProcess && this.pendingQueue.length > 0; i++) {
      const jobId = this.pendingQueue.shift();
      if (!jobId) continue;

      const job = this.jobs.get(jobId);
      if (!job || job.status !== BackgroundJobStatus.PENDING) {
        continue;
      }

      // Check if this specific job can start (respects group limits)
      if (this.canStartJob(job)) {
        this.executeJob(job);
        startedCount++;

        // Re-check global limit after each start
        if (this.getRunningCount() >= this.config.maxConcurrentJobs) {
          // Put remaining pending jobs back and exit
          while (this.pendingQueue.length > 0) {
            const remaining = this.pendingQueue.shift();
            if (remaining) deferredJobIds.push(remaining);
          }
          break;
        }
      } else {
        // Job can't start due to group limit, defer it
        deferredJobIds.push(jobId);
      }
    }

    // Put deferred jobs back at the end of the queue
    this.pendingQueue.push(...deferredJobIds);
  }

  /**
   * Execute a job
   */
  private async executeJob(job: InternalJob): Promise<void> {
    job.status = BackgroundJobStatus.RUNNING;
    job.startedAt = new Date();
    job.abortController = new AbortController();

    // Set timeout
    if (job.timeout) {
      job.timeoutHandle = setTimeout(() => {
        this.handleTimeout(job);
      }, job.timeout);
    }

    // Emit started event
    this.emitEvent(BackgroundExecutorEvents.JobStarted, {
      jobId: job.id,
      agentId: job.agentId,
      agentType: job.agentType,
      taskId: job.task.id,
      status: BackgroundJobStatus.RUNNING,
    });

    try {
      // Execute the task using the stored agent reference
      const result = await job.agent.processTask(job.task);

      // Check if cancelled during execution
      if (job.abortController?.signal.aborted) {
        return;
      }

      // Clear timeout
      if (job.timeoutHandle) {
        clearTimeout(job.timeoutHandle);
      }

      // Update job state
      job.status = BackgroundJobStatus.COMPLETED;
      job.completedAt = new Date();
      job.result = result;
      job.progress = 100;

      const duration = job.completedAt.getTime() - job.startedAt!.getTime();
      this.totalDuration += duration;
      this.completedCount++;

      // Emit completed event
      this.emitEvent(BackgroundExecutorEvents.JobCompleted, {
        jobId: job.id,
        agentId: job.agentId,
        agentType: job.agentType,
        taskId: job.task.id,
        status: BackgroundJobStatus.COMPLETED,
        result,
        duration,
      });

      // Resolve waiters
      for (const resolver of job.resolvers) {
        resolver.resolve(result);
      }
      job.resolvers = [];

      // Call completion callback
      job.options?.onComplete?.(result);
    } catch (error) {
      // Check if cancelled during execution
      if (job.abortController?.signal.aborted) {
        return;
      }

      // Clear timeout
      if (job.timeoutHandle) {
        clearTimeout(job.timeoutHandle);
      }

      // Update job state
      job.status = BackgroundJobStatus.FAILED;
      job.completedAt = new Date();
      job.error = error instanceof Error ? error.message : String(error);

      const duration = job.completedAt.getTime() - job.startedAt!.getTime();
      this.totalDuration += duration;
      this.failedCount++;

      // Create failure result
      job.result = {
        taskId: job.task.id,
        success: false,
        status: TaskResultStatus.FAILED,
        error: {
          code: 'BACKGROUND_JOB_FAILED',
          message: job.error,
          recoverable: false,
        },
        metadata: {
          agentId: job.agentId,
          agentType: job.agentType,
          startedAt: job.startedAt!,
          completedAt: job.completedAt,
          duration,
        },
      };

      // Emit failed event
      this.emitEvent(BackgroundExecutorEvents.JobFailed, {
        jobId: job.id,
        agentId: job.agentId,
        agentType: job.agentType,
        taskId: job.task.id,
        status: BackgroundJobStatus.FAILED,
        error: job.error,
        duration,
      });

      // Reject waiters
      const err = new Error(job.error);
      for (const resolver of job.resolvers) {
        resolver.reject(err);
      }
      job.resolvers = [];

      // Call error callback
      job.options?.onError?.(err);
    } finally {
      // Process next job in queue
      this.processQueue();
    }
  }

  /**
   * Handle job timeout
   */
  private handleTimeout(job: InternalJob): void {
    if (
      job.status !== BackgroundJobStatus.RUNNING ||
      job.abortController?.signal.aborted
    ) {
      return;
    }

    // Abort the job
    job.abortController?.abort();

    job.status = BackgroundJobStatus.TIMEOUT;
    job.completedAt = new Date();
    job.error = `Job timed out after ${job.timeout}ms`;
    this.timedOutCount++;

    const duration = job.startedAt
      ? job.completedAt.getTime() - job.startedAt.getTime()
      : 0;

    // Create timeout result
    job.result = {
      taskId: job.task.id,
      success: false,
      status: TaskResultStatus.TIMEOUT,
      error: {
        code: 'BACKGROUND_JOB_TIMEOUT',
        message: job.error,
        recoverable: true,
      },
      metadata: {
        agentId: job.agentId,
        agentType: job.agentType,
        startedAt: job.startedAt ?? new Date(),
        completedAt: job.completedAt,
        duration,
      },
    };

    // Emit timeout event
    this.emitEvent(BackgroundExecutorEvents.JobTimeout, {
      jobId: job.id,
      agentId: job.agentId,
      agentType: job.agentType,
      taskId: job.task.id,
      status: BackgroundJobStatus.TIMEOUT,
      error: job.error,
      duration,
    });

    // Reject waiters
    const err = new Error(job.error);
    for (const resolver of job.resolvers) {
      resolver.reject(err);
    }
    job.resolvers = [];

    // Call error callback
    job.options?.onError?.(err);

    // Process next job
    this.processQueue();
  }

  /**
   * Emit an event
   */
  private emitEvent(
    type: BackgroundExecutorEventType,
    payload: BackgroundJobEventPayload
  ): void {
    if (!this.config.enableEvents || !this.eventBus) {
      return;
    }

    const event: IEvent<BackgroundJobEventPayload> = {
      id: generateId(),
      type,
      payload,
      timestamp: new Date(),
      source: 'BackgroundExecutor',
      metadata: {
        correlationId: payload.jobId,
        agentId: payload.agentId,
      },
    };

    this.eventBus.emit(event);
  }

  /**
   * Convert internal job to public job (hide internal fields)
   */
  private toPublicJob(job: InternalJob): BackgroundJob {
    return {
      id: job.id,
      agentId: job.agentId,
      agentType: job.agentType,
      task: job.task,
      status: job.status,
      progress: job.progress,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      timeout: job.timeout,
      correlationId: job.correlationId,
      tags: job.tags,
      concurrencyGroup: job.concurrencyGroup,
    };
  }
}

/**
 * Factory function to create BackgroundExecutor
 */
export function createBackgroundExecutor(
  config?: Partial<BackgroundExecutorConfig>,
  eventBus?: IEventBus
): IBackgroundExecutor {
  return new BackgroundExecutor(config, eventBus);
}

/**
 * Submit helper function
 * Convenience wrapper around executor.submit()
 */
export async function submitBackgroundJob(
  executor: IBackgroundExecutor,
  agent: IAgent,
  task: ITask,
  options?: BackgroundJobOptions
): Promise<BackgroundJob> {
  return executor.submit(agent, task, options);
}
