/**
 * Orchestrator Service
 *
 * Coordinates agent execution, task distribution, and workflow orchestration.
 * Provides intelligent task routing, load balancing, and failure handling.
 *
 * @module core/orchestrator/orchestrator-service
 */

import { z } from 'zod';
import {
  IAgent,
  IAgentRegistry,
  ITask,
  TaskResult,
  TaskPriority,
  AgentType,
  AgentStatus,
  TaskError,
} from '../interfaces/agent.interface';
import { IEventBus, SystemEvents, IEvent } from '../interfaces/event.interface';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Task routing strategy
 */
export enum RoutingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_LOADED = 'least_loaded',
  RANDOM = 'random',
  CAPABILITY_MATCH = 'capability_match',
  PRIORITY_BASED = 'priority_based',
}

/**
 * Orchestrator status
 */
export enum OrchestratorStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error',
}

/**
 * Queued task with metadata
 */
export interface QueuedTask {
  task: ITask;
  addedAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  assignedAgentId?: string;
  status: QueuedTaskStatus;
}

/**
 * Queued task status
 */
export enum QueuedTaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Task assignment result
 */
export interface TaskAssignment {
  task: ITask;
  agent: IAgent;
  assignedAt: Date;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  routingStrategy: RoutingStrategy;
  maxQueueSize: number;
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  healthCheckInterval: number;
  loadBalancingThreshold: number;
}

/**
 * Orchestrator statistics
 */
export interface OrchestratorStats {
  status: OrchestratorStatus;
  queuedTasks: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalProcessed: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  agentUtilization: Map<string, number>;
  uptime: number;
}

/**
 * Orchestrator events
 */
export const OrchestratorEvents = {
  TASK_QUEUED: 'orchestrator:task:queued',
  TASK_ASSIGNED: 'orchestrator:task:assigned',
  TASK_STARTED: 'orchestrator:task:started',
  TASK_COMPLETED: 'orchestrator:task:completed',
  TASK_FAILED: 'orchestrator:task:failed',
  TASK_RETRYING: 'orchestrator:task:retrying',
  TASK_TIMEOUT: 'orchestrator:task:timeout',
  TASK_CANCELLED: 'orchestrator:task:cancelled',
  AGENT_OVERLOADED: 'orchestrator:agent:overloaded',
  AGENT_RECOVERED: 'orchestrator:agent:recovered',
  QUEUE_FULL: 'orchestrator:queue:full',
  HEALTH_CHECK: 'orchestrator:health:check',
} as const;

export type OrchestratorEventType = typeof OrchestratorEvents[keyof typeof OrchestratorEvents];

/**
 * Orchestrator event payload
 */
export interface OrchestratorEventPayload {
  taskId?: string;
  agentId?: string;
  queueSize?: number;
  error?: TaskError;
  stats?: Partial<OrchestratorStats>;
}

// ============================================================================
// Schemas
// ============================================================================

export const OrchestratorConfigSchema = z.object({
  routingStrategy: z.nativeEnum(RoutingStrategy).default(RoutingStrategy.LEAST_LOADED),
  maxQueueSize: z.number().int().min(1).max(10000).default(1000),
  maxConcurrentTasks: z.number().int().min(1).max(100).default(10),
  taskTimeout: z.number().int().min(1000).default(300000), // 5 minutes
  retryAttempts: z.number().int().min(0).max(10).default(3),
  retryDelay: z.number().int().min(100).default(1000),
  healthCheckInterval: z.number().int().min(1000).default(30000), // 30 seconds
  loadBalancingThreshold: z.number().min(0).max(1).default(0.8),
});

// ============================================================================
// Orchestrator Interface
// ============================================================================

/**
 * Orchestrator service interface
 */
export interface IOrchestrator {
  // Lifecycle
  start(): Promise<void>;
  stop(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;

  // Task Management
  submitTask(task: ITask): Promise<string>;
  cancelTask(taskId: string): Promise<boolean>;
  getTaskStatus(taskId: string): QueuedTaskStatus | undefined;
  getQueuedTasks(): QueuedTask[];

  // Agent Management
  getAvailableAgents(agentType?: AgentType): IAgent[];
  getAgentLoad(agentId: string): number;

  // Statistics
  getStats(): OrchestratorStats;

  // Events
  on(event: OrchestratorEventType, handler: (payload: OrchestratorEventPayload) => void): void;
  off(event: OrchestratorEventType, handler: (payload: OrchestratorEventPayload) => void): void;
}

// ============================================================================
// Orchestrator Implementation
// ============================================================================

/**
 * Orchestrator service implementation
 */
export class OrchestratorService implements IOrchestrator {
  private readonly config: OrchestratorConfig;
  private readonly agentRegistry: IAgentRegistry;
  private readonly eventBus?: IEventBus;

  private status: OrchestratorStatus = OrchestratorStatus.STOPPED;
  private taskQueue: Map<string, QueuedTask> = new Map();
  private activeTasks: Map<string, TaskAssignment> = new Map();
  private completedCount = 0;
  private failedCount = 0;
  private totalWaitTime = 0;
  private totalProcessingTime = 0;
  private startTime?: Date;
  private healthCheckTimer?: ReturnType<typeof setInterval>;
  private roundRobinIndex = 0;

  private readonly eventHandlers: Map<OrchestratorEventType, Set<(payload: OrchestratorEventPayload) => void>> = new Map();

  constructor(
    agentRegistry: IAgentRegistry,
    eventBus?: IEventBus,
    config?: Partial<OrchestratorConfig>
  ) {
    this.agentRegistry = agentRegistry;
    this.eventBus = eventBus;
    this.config = {
      routingStrategy: config?.routingStrategy ?? RoutingStrategy.LEAST_LOADED,
      maxQueueSize: config?.maxQueueSize ?? 1000,
      maxConcurrentTasks: config?.maxConcurrentTasks ?? 10,
      taskTimeout: config?.taskTimeout ?? 300000,
      retryAttempts: config?.retryAttempts ?? 3,
      retryDelay: config?.retryDelay ?? 1000,
      healthCheckInterval: config?.healthCheckInterval ?? 30000,
      loadBalancingThreshold: config?.loadBalancingThreshold ?? 0.8,
    };
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.status === OrchestratorStatus.RUNNING) {
      return;
    }

    this.status = OrchestratorStatus.STARTING;
    this.startTime = new Date();

    // Start health check timer
    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckInterval
    );

    // Start processing queue
    this.status = OrchestratorStatus.RUNNING;
    this.processQueue();

    this.emitSystemEvent(SystemEvents.AgentStarted, {
      agentId: 'orchestrator',
      agentType: 'orchestrator',
      name: 'OrchestratorService',
    });
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (this.status === OrchestratorStatus.STOPPED) {
      return;
    }

    this.status = OrchestratorStatus.STOPPING;

    // Stop health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // Wait for active tasks to complete (with timeout)
    const timeout = 30000;
    const startWait = Date.now();
    while (this.activeTasks.size > 0 && Date.now() - startWait < timeout) {
      await this.sleep(100);
    }

    this.status = OrchestratorStatus.STOPPED;

    this.emitSystemEvent(SystemEvents.AgentStopped, {
      agentId: 'orchestrator',
      agentType: 'orchestrator',
      reason: 'shutdown',
    });
  }

  /**
   * Pause the orchestrator
   */
  async pause(): Promise<void> {
    if (this.status !== OrchestratorStatus.RUNNING) {
      return;
    }

    this.status = OrchestratorStatus.PAUSED;

    this.emitSystemEvent(SystemEvents.AgentPaused, {
      agentId: 'orchestrator',
      agentType: 'orchestrator',
    });
  }

  /**
   * Resume the orchestrator
   */
  async resume(): Promise<void> {
    if (this.status !== OrchestratorStatus.PAUSED) {
      return;
    }

    this.status = OrchestratorStatus.RUNNING;
    this.processQueue();

    this.emitSystemEvent(SystemEvents.AgentResumed, {
      agentId: 'orchestrator',
      agentType: 'orchestrator',
    });
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  /**
   * Submit a task to the queue
   */
  async submitTask(task: ITask): Promise<string> {
    // Check queue capacity
    if (this.taskQueue.size >= this.config.maxQueueSize) {
      this.emit(OrchestratorEvents.QUEUE_FULL, { queueSize: this.taskQueue.size });
      throw new Error('Task queue is full');
    }

    // Create queued task
    const queuedTask: QueuedTask = {
      task,
      addedAt: new Date(),
      attempts: 0,
      status: QueuedTaskStatus.PENDING,
    };

    this.taskQueue.set(task.id, queuedTask);

    this.emit(OrchestratorEvents.TASK_QUEUED, { taskId: task.id, queueSize: this.taskQueue.size });
    this.emitSystemEvent(SystemEvents.TaskQueued, {
      taskId: task.id,
      agentType: task.agentType,
      priority: task.priority,
    });

    // Trigger queue processing
    if (this.status === OrchestratorStatus.RUNNING) {
      this.processQueue();
    }

    return task.id;
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const queuedTask = this.taskQueue.get(taskId);

    if (!queuedTask) {
      return false;
    }

    if (queuedTask.status === QueuedTaskStatus.PROCESSING) {
      // Cannot cancel processing task directly
      return false;
    }

    queuedTask.status = QueuedTaskStatus.CANCELLED;
    this.taskQueue.delete(taskId);

    this.emit(OrchestratorEvents.TASK_CANCELLED, { taskId });
    this.emitSystemEvent(SystemEvents.TaskCancelled, { taskId });

    return true;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): QueuedTaskStatus | undefined {
    return this.taskQueue.get(taskId)?.status;
  }

  /**
   * Get all queued tasks
   */
  getQueuedTasks(): QueuedTask[] {
    return Array.from(this.taskQueue.values());
  }

  // ============================================================================
  // Agent Management
  // ============================================================================

  /**
   * Get available agents for a type
   */
  getAvailableAgents(agentType?: AgentType): IAgent[] {
    let agents: IAgent[];

    if (agentType) {
      agents = this.agentRegistry.getByType(agentType);
    } else {
      agents = this.agentRegistry.getAll();
    }

    // Filter to only available agents
    return agents.filter(agent => {
      const state = agent.getState();
      return state.status === AgentStatus.IDLE || state.status === AgentStatus.PROCESSING;
    });
  }

  /**
   * Get agent load (0-1)
   */
  getAgentLoad(agentId: string): number {
    const agent = this.agentRegistry.get(agentId);
    if (!agent) {
      return 0;
    }

    const state = agent.getState();
    const activeTasks = Array.from(this.activeTasks.values())
      .filter(a => a.agent.id === agentId).length;

    // Calculate load based on active tasks and queue
    const maxTasks = 5; // Assume max concurrent tasks per agent
    return Math.min(1, (activeTasks + state.queuedTasks) / maxTasks);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get orchestrator statistics
   */
  getStats(): OrchestratorStats {
    const agentUtilization = new Map<string, number>();
    const agents = this.agentRegistry.getAll();

    for (const agent of agents) {
      agentUtilization.set(agent.id, this.getAgentLoad(agent.id));
    }

    const totalCompleted = this.completedCount + this.failedCount;
    const uptime = this.startTime
      ? Date.now() - this.startTime.getTime()
      : 0;

    return {
      status: this.status,
      queuedTasks: this.taskQueue.size,
      activeTasks: this.activeTasks.size,
      completedTasks: this.completedCount,
      failedTasks: this.failedCount,
      totalProcessed: totalCompleted,
      averageWaitTime: totalCompleted > 0 ? this.totalWaitTime / totalCompleted : 0,
      averageProcessingTime: totalCompleted > 0 ? this.totalProcessingTime / totalCompleted : 0,
      agentUtilization,
      uptime,
    };
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Subscribe to events
   */
  on(event: OrchestratorEventType, handler: (payload: OrchestratorEventPayload) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from events
   */
  off(event: OrchestratorEventType, handler: (payload: OrchestratorEventPayload) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Process the task queue
   */
  private async processQueue(): Promise<void> {
    if (this.status !== OrchestratorStatus.RUNNING) {
      return;
    }

    // Check concurrent task limit
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    // Get pending tasks sorted by priority
    const pendingTasks = Array.from(this.taskQueue.values())
      .filter(t => t.status === QueuedTaskStatus.PENDING)
      .sort((a, b) => b.task.priority - a.task.priority);

    for (const queuedTask of pendingTasks) {
      if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
        break;
      }

      const agent = this.selectAgent(queuedTask.task);
      if (agent) {
        await this.assignTask(queuedTask, agent);
      }
    }
  }

  /**
   * Select an agent for a task
   */
  private selectAgent(task: ITask): IAgent | undefined {
    const availableAgents = this.getAvailableAgents(task.agentType);

    if (availableAgents.length === 0) {
      return undefined;
    }

    switch (this.config.routingStrategy) {
      case RoutingStrategy.ROUND_ROBIN:
        return this.selectRoundRobin(availableAgents);

      case RoutingStrategy.LEAST_LOADED:
        return this.selectLeastLoaded(availableAgents);

      case RoutingStrategy.RANDOM:
        return this.selectRandom(availableAgents);

      case RoutingStrategy.CAPABILITY_MATCH:
        return this.selectByCapability(availableAgents, task);

      case RoutingStrategy.PRIORITY_BASED:
        return this.selectByPriority(availableAgents, task);

      default:
        return availableAgents[0];
    }
  }

  /**
   * Round-robin agent selection
   */
  private selectRoundRobin(agents: IAgent[]): IAgent {
    const agent = agents[this.roundRobinIndex % agents.length];
    this.roundRobinIndex++;
    return agent;
  }

  /**
   * Select least loaded agent
   */
  private selectLeastLoaded(agents: IAgent[]): IAgent {
    let minLoad = Infinity;
    let selectedAgent = agents[0];

    for (const agent of agents) {
      const load = this.getAgentLoad(agent.id);
      if (load < minLoad) {
        minLoad = load;
        selectedAgent = agent;
      }
    }

    return selectedAgent;
  }

  /**
   * Random agent selection
   */
  private selectRandom(agents: IAgent[]): IAgent {
    const index = Math.floor(Math.random() * agents.length);
    return agents[index];
  }

  /**
   * Select agent by capability match
   */
  private selectByCapability(agents: IAgent[], task: ITask): IAgent {
    // Filter agents that can handle the task
    const capableAgents = agents.filter(agent => agent.canHandle(task));

    if (capableAgents.length === 0) {
      return agents[0]; // Fallback to first agent
    }

    // Select least loaded among capable agents
    return this.selectLeastLoaded(capableAgents);
  }

  /**
   * Select agent by priority
   */
  private selectByPriority(agents: IAgent[], task: ITask): IAgent {
    // For high priority tasks, select least loaded
    if (task.priority >= TaskPriority.HIGH) {
      return this.selectLeastLoaded(agents);
    }

    // For normal/low priority, use round-robin
    return this.selectRoundRobin(agents);
  }

  /**
   * Assign a task to an agent
   */
  private async assignTask(queuedTask: QueuedTask, agent: IAgent): Promise<void> {
    const task = queuedTask.task;

    // Update queued task status
    queuedTask.status = QueuedTaskStatus.ASSIGNED;
    queuedTask.assignedAgentId = agent.id;
    queuedTask.lastAttemptAt = new Date();
    queuedTask.attempts++;

    // Create assignment
    const assignment: TaskAssignment = {
      task,
      agent,
      assignedAt: new Date(),
    };

    this.activeTasks.set(task.id, assignment);

    this.emit(OrchestratorEvents.TASK_ASSIGNED, { taskId: task.id, agentId: agent.id });

    // Execute task asynchronously
    this.executeTask(queuedTask, assignment);
  }

  /**
   * Execute a task on an agent
   */
  private async executeTask(queuedTask: QueuedTask, assignment: TaskAssignment): Promise<void> {
    const { task, agent, assignedAt } = assignment;

    queuedTask.status = QueuedTaskStatus.PROCESSING;

    this.emit(OrchestratorEvents.TASK_STARTED, { taskId: task.id, agentId: agent.id });
    this.emitSystemEvent(SystemEvents.TaskStarted, {
      taskId: task.id,
      agentId: agent.id,
    });

    try {
      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task execution timed out after ${this.config.taskTimeout}ms`));
        }, this.config.taskTimeout);
      });

      const result = await Promise.race([
        agent.processTask(task),
        timeoutPromise,
      ]);

      // Calculate timing
      const processingTime = Date.now() - assignedAt.getTime();
      const waitTime = assignedAt.getTime() - queuedTask.addedAt.getTime();

      this.totalProcessingTime += processingTime;
      this.totalWaitTime += waitTime;

      if (result.success) {
        this.handleTaskSuccess(queuedTask, result);
      } else {
        this.handleTaskFailure(queuedTask, result.error);
      }

    } catch (error) {
      const taskError: TaskError = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoverable: true,
      };

      if (error instanceof Error && error.message.includes('timed out')) {
        taskError.code = 'TIMEOUT';
        taskError.recoverable = false;
        this.emit(OrchestratorEvents.TASK_TIMEOUT, { taskId: task.id, error: taskError });
      }

      this.handleTaskFailure(queuedTask, taskError);
    } finally {
      this.activeTasks.delete(task.id);

      // Continue processing queue
      if (this.status === OrchestratorStatus.RUNNING) {
        this.processQueue();
      }
    }
  }

  /**
   * Handle successful task completion
   */
  private handleTaskSuccess(queuedTask: QueuedTask, result: TaskResult): void {
    queuedTask.status = QueuedTaskStatus.COMPLETED;
    this.completedCount++;

    this.emit(OrchestratorEvents.TASK_COMPLETED, {
      taskId: queuedTask.task.id,
      agentId: queuedTask.assignedAgentId,
    });

    this.emitSystemEvent(SystemEvents.TaskCompleted, {
      taskId: queuedTask.task.id,
      agentId: queuedTask.assignedAgentId,
      duration: result.metadata.duration,
      success: true,
    });

    // Remove from queue
    this.taskQueue.delete(queuedTask.task.id);
  }

  /**
   * Handle task failure
   */
  private handleTaskFailure(queuedTask: QueuedTask, error?: TaskError): void {
    const shouldRetry = error?.recoverable !== false &&
      queuedTask.attempts < this.config.retryAttempts;

    if (shouldRetry) {
      // Reset for retry
      queuedTask.status = QueuedTaskStatus.PENDING;
      queuedTask.assignedAgentId = undefined;

      this.emit(OrchestratorEvents.TASK_RETRYING, {
        taskId: queuedTask.task.id,
        error,
      });

      this.emitSystemEvent(SystemEvents.TaskRetry, {
        taskId: queuedTask.task.id,
        attempt: queuedTask.attempts,
        maxAttempts: this.config.retryAttempts,
      });

      // Schedule retry with delay
      setTimeout(() => {
        if (this.status === OrchestratorStatus.RUNNING) {
          this.processQueue();
        }
      }, this.config.retryDelay);

    } else {
      // Final failure
      queuedTask.status = QueuedTaskStatus.FAILED;
      this.failedCount++;

      this.emit(OrchestratorEvents.TASK_FAILED, {
        taskId: queuedTask.task.id,
        agentId: queuedTask.assignedAgentId,
        error,
      });

      this.emitSystemEvent(SystemEvents.TaskFailed, {
        taskId: queuedTask.task.id,
        agentId: queuedTask.assignedAgentId,
        error: error?.message ?? 'Unknown error',
        recoverable: false,
      });

      // Remove from queue
      this.taskQueue.delete(queuedTask.task.id);
    }
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    const stats = this.getStats();

    this.emit(OrchestratorEvents.HEALTH_CHECK, { stats });

    // Check for overloaded agents
    for (const [agentId, load] of stats.agentUtilization) {
      if (load >= this.config.loadBalancingThreshold) {
        this.emit(OrchestratorEvents.AGENT_OVERLOADED, { agentId });
      }
    }

    this.emitSystemEvent(SystemEvents.SystemHealthCheck, {
      component: 'orchestrator',
      healthy: this.status === OrchestratorStatus.RUNNING,
      stats,
    });
  }

  /**
   * Emit local event
   */
  private emit(event: OrchestratorEventType, payload: OrchestratorEventPayload): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch {
          // Ignore handler errors
        }
      }
    }
  }

  /**
   * Emit system event
   */
  private emitSystemEvent<T>(type: string, payload: T): void {
    if (this.eventBus) {
      const event: IEvent<T> = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        type,
        payload,
        timestamp: new Date(),
        source: 'orchestrator',
      };
      this.eventBus.emit(event);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an orchestrator service instance
 */
export function createOrchestrator(
  agentRegistry: IAgentRegistry,
  eventBus?: IEventBus,
  config?: Partial<OrchestratorConfig>
): OrchestratorService {
  return new OrchestratorService(agentRegistry, eventBus, config);
}
