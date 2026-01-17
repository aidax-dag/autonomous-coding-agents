/**
 * Agent OS Scheduler
 *
 * Advanced task scheduling system for agent coordination.
 * Supports multiple scheduling algorithms:
 * - Priority-based scheduling
 * - Fair share scheduling
 * - Deadline-aware scheduling
 * - Cost-aware scheduling
 *
 * Feature: Agent OS Kernel
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

/**
 * Task priority levels
 */
export enum TaskPriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BACKGROUND = 4,
}

/**
 * Task state
 */
export enum TaskState {
  PENDING = 'pending',
  READY = 'ready',
  RUNNING = 'running',
  WAITING = 'waiting',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Scheduling algorithm
 */
export enum SchedulingAlgorithm {
  PRIORITY = 'priority',
  FAIR_SHARE = 'fair_share',
  DEADLINE = 'deadline',
  COST_AWARE = 'cost_aware',
  ROUND_ROBIN = 'round_robin',
}

/**
 * Schedulable task
 */
export interface SchedulableTask {
  /** Unique task ID */
  id: string;
  /** Task name */
  name: string;
  /** Owner agent/team ID */
  ownerId: string;
  /** Priority level */
  priority: TaskPriority;
  /** Current state */
  state: TaskState;
  /** Estimated token cost */
  estimatedTokens: number;
  /** Actual tokens used */
  actualTokens: number;
  /** Deadline (optional) */
  deadline?: Date;
  /** Creation time */
  createdAt: Date;
  /** Start time (when running) */
  startedAt?: Date;
  /** Completion time */
  completedAt?: Date;
  /** Dependencies (task IDs that must complete first) */
  dependencies: string[];
  /** Metadata */
  metadata: Record<string, unknown>;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Default scheduling algorithm */
  algorithm: SchedulingAlgorithm;
  /** Maximum concurrent tasks */
  maxConcurrent: number;
  /** Time slice in tokens (for fair share) */
  timeSliceTokens: number;
  /** Enable preemption */
  preemption: boolean;
  /** Priority boost interval (ms) to prevent starvation */
  priorityBoostInterval: number;
  /** Maximum wait time before priority boost (ms) */
  maxWaitTime: number;
}

/**
 * Scheduler statistics
 */
export interface SchedulerStats {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageWaitTime: number;
  averageExecutionTime: number;
  throughput: number; // tasks per minute
  tokenUsage: number;
}

/**
 * Scheduler events
 */
export interface SchedulerEvents {
  'task:scheduled': (task: SchedulableTask) => void;
  'task:started': (task: SchedulableTask) => void;
  'task:completed': (task: SchedulableTask) => void;
  'task:failed': (task: SchedulableTask, error: Error) => void;
  'task:preempted': (task: SchedulableTask, reason: string) => void;
  'task:blocked': (task: SchedulableTask, reason: string) => void;
  'task:unblocked': (task: SchedulableTask) => void;
  'task:waiting': (task: SchedulableTask, waitingFor: string) => void;
  'task:cancelled': (task: SchedulableTask) => void;
  'task:boosted': (task: SchedulableTask, oldPriority: TaskPriority) => void;
  'queue:empty': () => void;
  'queue:full': () => void;
}

// ============================================================================
// Priority Queue Implementation
// ============================================================================

/**
 * Priority queue for task scheduling
 */
class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  constructor(private compareFn: (a: T, b: T) => number) {}

  enqueue(item: T, priority: number): void {
    const element = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (this.compareFn(item, this.items[i].item) < 0) {
        this.items.splice(i, 0, element);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(element);
    }
  }

  dequeue(): T | undefined {
    return this.items.shift()?.item;
  }

  peek(): T | undefined {
    return this.items[0]?.item;
  }

  remove(predicate: (item: T) => boolean): T | undefined {
    const index = this.items.findIndex((e) => predicate(e.item));
    if (index !== -1) {
      return this.items.splice(index, 1)[0].item;
    }
    return undefined;
  }

  find(predicate: (item: T) => boolean): T | undefined {
    return this.items.find((e) => predicate(e.item))?.item;
  }

  toArray(): T[] {
    return this.items.map((e) => e.item);
  }

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }
}

// ============================================================================
// Scheduler Implementation
// ============================================================================

/**
 * Default scheduler configuration
 */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  algorithm: SchedulingAlgorithm.PRIORITY,
  maxConcurrent: 5,
  timeSliceTokens: 10000,
  preemption: false,
  priorityBoostInterval: 60000, // 1 minute
  maxWaitTime: 300000, // 5 minutes
};

/**
 * Agent OS Scheduler
 */
export class Scheduler extends EventEmitter {
  private config: SchedulerConfig;
  private readyQueue: PriorityQueue<SchedulableTask>;
  private waitingTasks = new Map<string, SchedulableTask>();
  private runningTasks = new Map<string, SchedulableTask>();
  private completedTasks = new Map<string, SchedulableTask>();
  private taskHistory: Array<{ taskId: string; completedAt: Date; duration: number }> = [];
  private ownerTokenUsage = new Map<string, number>();
  private priorityBoostTimer?: NodeJS.Timeout;
  private started = false;

  constructor(config: Partial<SchedulerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_SCHEDULER_CONFIG, ...config };
    this.readyQueue = new PriorityQueue(this.getComparator());
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    // Start priority boost timer
    if (this.config.priorityBoostInterval > 0) {
      this.priorityBoostTimer = setInterval(
        () => this.boostStarvedTasks(),
        this.config.priorityBoostInterval
      );
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.priorityBoostTimer) {
      clearInterval(this.priorityBoostTimer);
      this.priorityBoostTimer = undefined;
    }
  }

  /**
   * Schedule a new task
   */
  schedule(task: Omit<SchedulableTask, 'state' | 'createdAt' | 'actualTokens'>): SchedulableTask {
    const schedulableTask: SchedulableTask = {
      ...task,
      state: TaskState.PENDING,
      createdAt: new Date(),
      actualTokens: 0,
    };

    // Check if dependencies are satisfied
    if (this.areDependenciesSatisfied(schedulableTask)) {
      schedulableTask.state = TaskState.READY;
      this.readyQueue.enqueue(schedulableTask, schedulableTask.priority);
    } else {
      schedulableTask.state = TaskState.WAITING;
      this.waitingTasks.set(schedulableTask.id, schedulableTask);
    }

    this.emit('task:scheduled', schedulableTask);
    return schedulableTask;
  }

  /**
   * Get the next task to execute
   */
  getNextTask(): SchedulableTask | undefined {
    if (this.runningTasks.size >= this.config.maxConcurrent) {
      return undefined;
    }

    const task = this.readyQueue.dequeue();
    if (!task) {
      if (this.readyQueue.isEmpty() && this.waitingTasks.size === 0) {
        this.emit('queue:empty');
      }
      return undefined;
    }

    task.state = TaskState.RUNNING;
    task.startedAt = new Date();
    this.runningTasks.set(task.id, task);
    this.emit('task:started', task);

    return task;
  }

  /**
   * Mark a task as completed
   */
  completeTask(taskId: string, tokensUsed: number): SchedulableTask | undefined {
    const task = this.runningTasks.get(taskId);
    if (!task) return undefined;

    task.state = TaskState.COMPLETED;
    task.completedAt = new Date();
    task.actualTokens = tokensUsed;

    this.runningTasks.delete(taskId);
    this.completedTasks.set(taskId, task);

    // Update owner token usage
    const currentUsage = this.ownerTokenUsage.get(task.ownerId) || 0;
    this.ownerTokenUsage.set(task.ownerId, currentUsage + tokensUsed);

    // Record history
    const duration = task.completedAt.getTime() - (task.startedAt?.getTime() || task.createdAt.getTime());
    this.taskHistory.push({ taskId, completedAt: task.completedAt, duration });

    // Trim history to last 1000 entries
    if (this.taskHistory.length > 1000) {
      this.taskHistory = this.taskHistory.slice(-1000);
    }

    this.emit('task:completed', task);

    // Check waiting tasks for dependency resolution
    this.checkWaitingTasks();

    return task;
  }

  /**
   * Mark a task as failed
   */
  failTask(taskId: string, error: Error): SchedulableTask | undefined {
    const task = this.runningTasks.get(taskId);
    if (!task) return undefined;

    task.state = TaskState.FAILED;
    task.completedAt = new Date();

    this.runningTasks.delete(taskId);
    this.completedTasks.set(taskId, task);

    this.emit('task:failed', task, error);

    // Check waiting tasks (some might need to handle the failure)
    this.checkWaitingTasks();

    return task;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): SchedulableTask | undefined {
    // Check ready queue
    let task = this.readyQueue.remove((t) => t.id === taskId);
    if (task) {
      task.state = TaskState.CANCELLED;
      this.completedTasks.set(taskId, task);
      return task;
    }

    // Check waiting tasks
    task = this.waitingTasks.get(taskId);
    if (task) {
      task.state = TaskState.CANCELLED;
      this.waitingTasks.delete(taskId);
      this.completedTasks.set(taskId, task);
      return task;
    }

    // Check running tasks
    task = this.runningTasks.get(taskId);
    if (task) {
      task.state = TaskState.CANCELLED;
      this.runningTasks.delete(taskId);
      this.completedTasks.set(taskId, task);
      return task;
    }

    return undefined;
  }

  /**
   * Preempt a running task (if enabled)
   */
  preemptTask(taskId: string, reason: string): boolean {
    if (!this.config.preemption) return false;

    const task = this.runningTasks.get(taskId);
    if (!task) return false;

    task.state = TaskState.READY;
    this.runningTasks.delete(taskId);
    this.readyQueue.enqueue(task, task.priority);

    this.emit('task:preempted', task, reason);
    return true;
  }

  /**
   * Block a running task (waiting for resource)
   */
  blockTask(taskId: string, reason: string): boolean {
    const task = this.runningTasks.get(taskId);
    if (!task) return false;

    task.state = TaskState.BLOCKED;
    this.runningTasks.delete(taskId);
    this.waitingTasks.set(taskId, task);

    this.emit('task:blocked', task, reason);
    return true;
  }

  /**
   * Unblock a blocked task (resource available)
   */
  unblockTask(taskId: string): boolean {
    const task = this.waitingTasks.get(taskId);
    if (!task || task.state !== TaskState.BLOCKED) return false;

    task.state = TaskState.READY;
    this.waitingTasks.delete(taskId);
    this.readyQueue.enqueue(task, task.priority);

    this.emit('task:unblocked', task);
    return true;
  }

  /**
   * Set task to waiting state (waiting for another task)
   */
  waitTask(taskId: string, waitingFor: string): boolean {
    const task = this.runningTasks.get(taskId);
    if (!task) return false;

    task.state = TaskState.WAITING;
    task.metadata.waitingFor = waitingFor;
    this.runningTasks.delete(taskId);
    this.waitingTasks.set(taskId, task);

    this.emit('task:waiting', task, waitingFor);
    return true;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): SchedulableTask | undefined {
    return (
      this.runningTasks.get(taskId) ||
      this.waitingTasks.get(taskId) ||
      this.readyQueue.find((t) => t.id === taskId) ||
      this.completedTasks.get(taskId)
    );
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    const completedHistory = this.taskHistory.filter(
      (h) => h.completedAt.getTime() > Date.now() - 60000 // Last minute
    );

    const totalWaitTime = this.taskHistory.reduce((sum, h) => sum + h.duration, 0);
    const avgWaitTime = this.taskHistory.length > 0 ? totalWaitTime / this.taskHistory.length : 0;

    const totalTokens = Array.from(this.ownerTokenUsage.values()).reduce((sum, t) => sum + t, 0);

    return {
      totalTasks:
        this.readyQueue.size +
        this.waitingTasks.size +
        this.runningTasks.size +
        this.completedTasks.size,
      pendingTasks: this.readyQueue.size + this.waitingTasks.size,
      runningTasks: this.runningTasks.size,
      completedTasks: Array.from(this.completedTasks.values()).filter(
        (t) => t.state === TaskState.COMPLETED
      ).length,
      failedTasks: Array.from(this.completedTasks.values()).filter(
        (t) => t.state === TaskState.FAILED
      ).length,
      averageWaitTime: avgWaitTime,
      averageExecutionTime: avgWaitTime, // Simplified
      throughput: completedHistory.length,
      tokenUsage: totalTokens,
    };
  }

  /**
   * Get ready queue tasks
   */
  getReadyQueue(): SchedulableTask[] {
    return this.readyQueue.toArray();
  }

  /**
   * Get running tasks
   */
  getRunningTasks(): SchedulableTask[] {
    return Array.from(this.runningTasks.values());
  }

  /**
   * Get waiting tasks
   */
  getWaitingTasks(): SchedulableTask[] {
    return Array.from(this.waitingTasks.values());
  }

  /**
   * Clear completed tasks history
   */
  clearHistory(): void {
    this.completedTasks.clear();
    this.taskHistory = [];
  }

  /**
   * Update scheduling algorithm
   */
  setAlgorithm(algorithm: SchedulingAlgorithm): void {
    this.config.algorithm = algorithm;
    // Re-sort the queue with new comparator
    const tasks = this.readyQueue.toArray();
    this.readyQueue = new PriorityQueue(this.getComparator());
    for (const task of tasks) {
      this.readyQueue.enqueue(task, task.priority);
    }
  }

  /**
   * Get comparator based on scheduling algorithm
   */
  private getComparator(): (a: SchedulableTask, b: SchedulableTask) => number {
    switch (this.config.algorithm) {
      case SchedulingAlgorithm.PRIORITY:
        return this.priorityComparator.bind(this);
      case SchedulingAlgorithm.FAIR_SHARE:
        return this.fairShareComparator.bind(this);
      case SchedulingAlgorithm.DEADLINE:
        return this.deadlineComparator.bind(this);
      case SchedulingAlgorithm.COST_AWARE:
        return this.costAwareComparator.bind(this);
      case SchedulingAlgorithm.ROUND_ROBIN:
        return this.roundRobinComparator.bind(this);
      default:
        return this.priorityComparator.bind(this);
    }
  }

  /**
   * Priority-based comparator
   */
  private priorityComparator(a: SchedulableTask, b: SchedulableTask): number {
    if (a.priority !== b.priority) {
      return a.priority - b.priority; // Lower number = higher priority
    }
    return a.createdAt.getTime() - b.createdAt.getTime(); // FIFO for same priority
  }

  /**
   * Fair share comparator (balances resource usage across owners)
   */
  private fairShareComparator(a: SchedulableTask, b: SchedulableTask): number {
    const aUsage = this.ownerTokenUsage.get(a.ownerId) || 0;
    const bUsage = this.ownerTokenUsage.get(b.ownerId) || 0;

    // Prefer tasks from owners with lower token usage
    if (aUsage !== bUsage) {
      return aUsage - bUsage;
    }
    return this.priorityComparator(a, b);
  }

  /**
   * Deadline-based comparator (Earliest Deadline First)
   */
  private deadlineComparator(a: SchedulableTask, b: SchedulableTask): number {
    // Tasks with deadlines come first
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && b.deadline) {
      const deadlineDiff = a.deadline.getTime() - b.deadline.getTime();
      if (deadlineDiff !== 0) return deadlineDiff;
    }
    return this.priorityComparator(a, b);
  }

  /**
   * Cost-aware comparator (prefers cheaper tasks)
   */
  private costAwareComparator(a: SchedulableTask, b: SchedulableTask): number {
    // Consider priority first for critical tasks
    if (a.priority <= TaskPriority.HIGH || b.priority <= TaskPriority.HIGH) {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
    }
    // Then prefer lower cost tasks
    if (a.estimatedTokens !== b.estimatedTokens) {
      return a.estimatedTokens - b.estimatedTokens;
    }
    return this.priorityComparator(a, b);
  }

  /**
   * Round-robin comparator (simple FIFO)
   */
  private roundRobinComparator(a: SchedulableTask, b: SchedulableTask): number {
    return a.createdAt.getTime() - b.createdAt.getTime();
  }

  /**
   * Check if task dependencies are satisfied
   */
  private areDependenciesSatisfied(task: SchedulableTask): boolean {
    for (const depId of task.dependencies) {
      const depTask = this.completedTasks.get(depId);
      if (!depTask || depTask.state !== TaskState.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check waiting tasks for dependency resolution
   */
  private checkWaitingTasks(): void {
    for (const [taskId, task] of this.waitingTasks) {
      if (this.areDependenciesSatisfied(task)) {
        this.waitingTasks.delete(taskId);
        task.state = TaskState.READY;
        this.readyQueue.enqueue(task, task.priority);
      }
    }
  }

  /**
   * Boost priority of starved tasks
   */
  private boostStarvedTasks(): void {
    const now = Date.now();
    const tasks = this.readyQueue.toArray();

    for (const task of tasks) {
      const waitTime = now - task.createdAt.getTime();
      if (waitTime > this.config.maxWaitTime && task.priority > TaskPriority.CRITICAL) {
        const oldPriority = task.priority;
        task.priority = Math.max(TaskPriority.CRITICAL, task.priority - 1);

        // Re-enqueue with new priority
        this.readyQueue.remove((t) => t.id === task.id);
        this.readyQueue.enqueue(task, task.priority);

        this.emit('task:boosted', task, oldPriority);
      }
    }
  }
}

// Type-safe event emitter
export interface Scheduler {
  on<E extends keyof SchedulerEvents>(event: E, listener: SchedulerEvents[E]): this;
  emit<E extends keyof SchedulerEvents>(
    event: E,
    ...args: Parameters<SchedulerEvents[E]>
  ): boolean;
}

/**
 * Create a scheduler instance
 */
export function createScheduler(config?: Partial<SchedulerConfig>): Scheduler {
  return new Scheduler(config);
}
