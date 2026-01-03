/**
 * Base Agent Implementation
 *
 * Abstract base class implementing IAgent with:
 * - Dependency injection for all external services
 * - Event-driven state management
 * - Task queue with priority ordering
 * - Health monitoring and metrics
 * - Error recovery integration
 *
 * SOLID Principles:
 * - S: Single responsibility - agent lifecycle and task processing
 * - O: Open for extension via abstract methods
 * - L: Implements IAgent, substitutable in all contexts
 * - I: Depends only on required interfaces
 * - D: All dependencies injected via constructor
 *
 * @module core/agents
 */

import {
  IAgent,
  IAgentConfig,
  AgentType,
  AgentStatus,
  AgentState,
  AgentMetrics,
  AgentCapability,
  HealthStatus,
  ITask,
  TaskResult,
  TaskResultStatus,
  TaskPriority,
} from '../interfaces';
import type { IEventBus } from '../events';
import type {
  ILLMClient,
  IMessageBroker,
  IAgentLogger,
  AgentDependencies,
} from './interfaces';

/**
 * Priority queue for tasks
 */
class TaskQueue {
  private tasks: ITask[] = [];

  enqueue(task: ITask): void {
    this.tasks.push(task);
    // Sort by priority (higher priority first)
    this.tasks.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): ITask | undefined {
    return this.tasks.shift();
  }

  peek(): ITask | undefined {
    return this.tasks[0];
  }

  size(): number {
    return this.tasks.length;
  }

  clear(): void {
    this.tasks = [];
  }

  toArray(): ITask[] {
    return [...this.tasks];
  }
}

/**
 * Abstract Base Agent
 *
 * Provides common functionality for all agent implementations.
 * Subclasses must implement:
 * - processTask: Core task processing logic
 * - getCapabilities: Agent-specific capabilities
 */
export abstract class BaseAgent implements IAgent {
  // === Identification ===
  public readonly id: string;
  public readonly type: AgentType;
  public readonly name: string;
  public readonly version: string;

  // === Dependencies (injected) ===
  protected readonly llmClient: ILLMClient;
  protected readonly messageBroker: IMessageBroker;
  protected readonly logger: IAgentLogger;
  protected readonly eventBus?: IEventBus;

  // === Configuration ===
  protected readonly config: IAgentConfig;

  // === Internal State ===
  private _status: AgentStatus = AgentStatus.STOPPED;
  private _currentTask: ITask | null = null;
  private readonly _taskQueue: TaskQueue = new TaskQueue();
  private _processedTasks = 0;
  private _failedTasks = 0;
  private _totalProcessingTime = 0;
  private _totalTokensUsed = 0;
  private _startTime: Date | null = null;
  private _lastActiveAt: Date | null = null;
  private _disposed = false;

  // === Task Processing ===
  private _isProcessing = false;
  private _processingPromise: Promise<void> | null = null;

  constructor(config: IAgentConfig, dependencies: AgentDependencies) {
    // Validate required dependencies
    if (!dependencies.llmClient) {
      throw new Error('LLM client is required');
    }
    if (!dependencies.messageBroker) {
      throw new Error('Message broker is required');
    }
    if (!dependencies.logger) {
      throw new Error('Logger is required');
    }

    // Initialize identification
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
    this.version = config.version || '1.0.0';
    this.config = config;

    // Inject dependencies
    this.llmClient = dependencies.llmClient;
    this.messageBroker = dependencies.messageBroker;
    this.logger = dependencies.logger.child({
      agentId: this.id,
      agentType: this.type,
    });
    this.eventBus = dependencies.eventBus;
  }

  // === Lifecycle Methods ===

  async initialize(): Promise<void> {
    this.ensureNotDisposed();

    if (this._status !== AgentStatus.STOPPED) {
      throw new Error(`Cannot initialize agent in ${this._status} state`);
    }

    this.logger.info('Initializing agent');
    this._status = AgentStatus.INITIALIZING;

    try {
      // Subscribe to task topic
      const taskTopic = this.getTaskTopic();
      await this.messageBroker.subscribe(taskTopic, async (message) => {
        await this.handleIncomingMessage(message);
      });

      // Perform subclass-specific initialization
      await this.onInitialize();

      this._status = AgentStatus.IDLE;
      this.logger.info('Agent initialized successfully');

      await this.publishAgentEvent('agent.initialized', {
        agentId: this.id,
        agentType: this.type,
      });
    } catch (error) {
      this._status = AgentStatus.ERROR;
      this.logger.error('Failed to initialize agent', { error });
      throw error;
    }
  }

  async start(): Promise<void> {
    this.ensureNotDisposed();

    if (this._status === AgentStatus.STOPPED) {
      await this.initialize();
    }

    if (this._status !== AgentStatus.IDLE && this._status !== AgentStatus.PAUSED) {
      throw new Error(`Cannot start agent in ${this._status} state`);
    }

    this.logger.info('Starting agent');
    this._status = AgentStatus.IDLE;
    this._startTime = new Date();

    // Start processing queued tasks
    this.processNextTask();

    await this.publishAgentEvent('agent.started', {
      agentId: this.id,
      agentType: this.type,
    });
  }

  async pause(): Promise<void> {
    this.ensureNotDisposed();

    if (this._status !== AgentStatus.IDLE && this._status !== AgentStatus.PROCESSING) {
      throw new Error(`Cannot pause agent in ${this._status} state`);
    }

    this.logger.info('Pausing agent');
    this._status = AgentStatus.PAUSED;

    await this.publishAgentEvent('agent.paused', {
      agentId: this.id,
      agentType: this.type,
    });
  }

  async resume(): Promise<void> {
    this.ensureNotDisposed();

    if (this._status !== AgentStatus.PAUSED) {
      throw new Error(`Cannot resume agent in ${this._status} state`);
    }

    this.logger.info('Resuming agent');
    this._status = AgentStatus.IDLE;

    // Continue processing
    this.processNextTask();

    await this.publishAgentEvent('agent.resumed', {
      agentId: this.id,
      agentType: this.type,
    });
  }

  async stop(): Promise<void> {
    this.ensureNotDisposed();

    if (this._status === AgentStatus.STOPPED) {
      return;
    }

    this.logger.info('Stopping agent');
    this._status = AgentStatus.STOPPING;

    // Wait for current task to complete
    if (this._processingPromise) {
      try {
        await this._processingPromise;
      } catch {
        // Ignore errors during stop
      }
    }

    // Unsubscribe from topics
    try {
      await this.messageBroker.unsubscribe(this.getTaskTopic());
    } catch (error) {
      this.logger.warn('Error unsubscribing from task topic', { error });
    }

    // Perform subclass-specific cleanup
    await this.onStop();

    this._status = AgentStatus.STOPPED;
    this.logger.info('Agent stopped');

    await this.publishAgentEvent('agent.stopped', {
      agentId: this.id,
      agentType: this.type,
    });
  }

  async dispose(): Promise<void> {
    if (this._disposed) {
      return;
    }

    this.logger.info('Disposing agent');

    // Stop if running
    if (this._status !== AgentStatus.STOPPED) {
      await this.stop();
    }

    // Clear state
    this._taskQueue.clear();
    this._currentTask = null;

    // Perform subclass-specific disposal
    await this.onDispose();

    this._disposed = true;
    this.logger.info('Agent disposed');
  }

  // === Task Processing ===

  canHandle(task: ITask): boolean {
    // Default: can handle if agent type matches
    return task.agentType === this.type;
  }

  /**
   * Process a task - must be implemented by subclasses
   */
  abstract processTask(task: ITask): Promise<TaskResult>;

  /**
   * Get agent capabilities - must be implemented by subclasses
   */
  abstract getCapabilities(): AgentCapability[];

  // === State & Health ===

  getState(): AgentState {
    this.ensureNotDisposed();
    return {
      status: this._status,
      currentTask: this._currentTask,
      queuedTasks: this._taskQueue.size(),
      processedTasks: this._processedTasks,
      lastActiveAt: this._lastActiveAt,
    };
  }

  getHealth(): HealthStatus {
    const uptime = this._startTime
      ? Date.now() - this._startTime.getTime()
      : 0;

    return {
      healthy: this._status !== AgentStatus.ERROR && this._status !== AgentStatus.STOPPED,
      status: this._status,
      uptime,
      lastCheck: new Date(),
      details: {
        currentTask: this._currentTask?.id,
        queueSize: this._taskQueue.size(),
        processedTasks: this._processedTasks,
        failedTasks: this._failedTasks,
      },
    };
  }

  getMetrics(): AgentMetrics {
    const totalTasks = this._processedTasks + this._failedTasks;
    const errorRate = totalTasks > 0 ? this._failedTasks / totalTasks : 0;
    const averageTaskDuration = this._processedTasks > 0
      ? this._totalProcessingTime / this._processedTasks
      : 0;
    const uptime = this._startTime
      ? Date.now() - this._startTime.getTime()
      : 0;

    return {
      tasksProcessed: this._processedTasks,
      tasksFailed: this._failedTasks,
      averageTaskDuration,
      totalTokensUsed: this._totalTokensUsed,
      uptime,
      lastActiveAt: this._lastActiveAt,
      errorRate,
    };
  }

  // === Protected Methods for Subclasses ===

  /**
   * Called during initialization (override for custom setup)
   */
  protected async onInitialize(): Promise<void> {
    // Default: no-op
  }

  /**
   * Called during stop (override for custom cleanup)
   */
  protected async onStop(): Promise<void> {
    // Default: no-op
  }

  /**
   * Called during dispose (override for resource cleanup)
   */
  protected async onDispose(): Promise<void> {
    // Default: no-op
  }

  /**
   * Get the task subscription topic
   */
  protected getTaskTopic(): string {
    return `agent.tasks.${this.type}`;
  }

  /**
   * Get the result publish topic
   */
  protected getResultTopic(): string {
    return `agent.results.${this.type}`;
  }

  /**
   * Update token usage metrics
   */
  protected updateTokenUsage(tokens: number): void {
    this._totalTokensUsed += tokens;
  }

  /**
   * Create a successful task result
   */
  protected createSuccessResult(
    task: ITask,
    data: Record<string, unknown>,
    startTime: Date
  ): TaskResult {
    const completedAt = new Date();
    const duration = completedAt.getTime() - startTime.getTime();

    return {
      taskId: task.id,
      success: true,
      status: TaskResultStatus.COMPLETED,
      data,
      metadata: {
        agentId: this.id,
        agentType: this.type,
        startedAt: startTime,
        completedAt,
        duration,
      },
    };
  }

  /**
   * Create a failed task result
   */
  protected createFailureResult(
    task: ITask,
    error: Error,
    startTime: Date
  ): TaskResult {
    const completedAt = new Date();
    const duration = completedAt.getTime() - startTime.getTime();

    return {
      taskId: task.id,
      success: false,
      status: TaskResultStatus.FAILED,
      error: {
        code: 'TASK_FAILED',
        message: error.message,
        stack: error.stack,
        recoverable: true,
      },
      metadata: {
        agentId: this.id,
        agentType: this.type,
        startedAt: startTime,
        completedAt,
        duration,
      },
    };
  }

  // === Private Methods ===

  private async handleIncomingMessage(message: unknown): Promise<void> {
    try {
      const task = this.parseTask(message);

      if (!this.canHandle(task)) {
        this.logger.warn('Cannot handle task', { taskId: task.id, taskType: task.type });
        return;
      }

      this.logger.info('Task received', { taskId: task.id, priority: task.priority });

      // Add to queue
      this._taskQueue.enqueue(task);

      await this.publishAgentEvent('task.queued', {
        agentId: this.id,
        taskId: task.id,
        queueSize: this._taskQueue.size(),
      });

      // Start processing if idle
      this.processNextTask();
    } catch (error) {
      this.logger.error('Failed to handle message', { error, message });
    }
  }

  private parseTask(message: unknown): ITask {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid task message');
    }

    const msg = message as Record<string, unknown>;

    if (!msg.id || !msg.type || !msg.agentType) {
      throw new Error('Task missing required fields');
    }

    return {
      id: msg.id as string,
      type: msg.type as string,
      agentType: msg.agentType as AgentType,
      priority: (msg.priority as TaskPriority) || TaskPriority.NORMAL,
      payload: (msg.payload as Record<string, unknown>) || {},
      metadata: msg.metadata as ITask['metadata'],
      createdAt: msg.createdAt ? new Date(msg.createdAt as string) : new Date(),
    };
  }

  private processNextTask(): void {
    // Don't process if not in correct state
    if (this._status !== AgentStatus.IDLE || this._isProcessing) {
      return;
    }

    const task = this._taskQueue.dequeue();
    if (!task) {
      return;
    }

    this._isProcessing = true;
    this._processingPromise = this.executeTask(task).finally(() => {
      this._isProcessing = false;
      this._processingPromise = null;

      // Process next task if any
      if (this._status === AgentStatus.IDLE) {
        this.processNextTask();
      }
    });
  }

  private async executeTask(task: ITask): Promise<void> {
    const startTime = new Date();
    this._currentTask = task;
    this._status = AgentStatus.PROCESSING;
    this._lastActiveAt = startTime;

    this.logger.info('Processing task', { taskId: task.id, taskType: task.type });

    await this.publishAgentEvent('task.started', {
      agentId: this.id,
      taskId: task.id,
    });

    try {
      const result = await this.processTask(task);

      // Update metrics
      this._processedTasks++;
      this._totalProcessingTime += result.metadata.duration;

      this.logger.info('Task completed', {
        taskId: task.id,
        duration: result.metadata.duration,
        success: result.success,
      });

      // Publish result
      await this.publishResult(result);

      await this.publishAgentEvent('task.completed', {
        agentId: this.id,
        taskId: task.id,
        duration: result.metadata.duration,
      });
    } catch (error) {
      this._failedTasks++;

      this.logger.error('Task failed', { taskId: task.id, error });

      // Create error result
      const errorResult = this.createFailureResult(task, error as Error, startTime);

      await this.publishResult(errorResult);

      await this.publishAgentEvent('task.failed', {
        agentId: this.id,
        taskId: task.id,
        error: (error as Error).message,
      });
    } finally {
      this._currentTask = null;
      this._status = AgentStatus.IDLE;
    }
  }

  private async publishResult(result: TaskResult): Promise<void> {
    try {
      await this.messageBroker.publish(this.getResultTopic(), result);
    } catch (error) {
      this.logger.error('Failed to publish result', { error, taskId: result.taskId });
    }
  }

  private async publishAgentEvent(
    type: string,
    data: Record<string, unknown>
  ): Promise<void> {
    if (this.eventBus) {
      try {
        this.eventBus.emit({
          id: `${this.id}-${Date.now()}`,
          type,
          source: this.id,
          timestamp: new Date(),
          payload: data,
          metadata: {
            correlationId: data.taskId as string,
          },
        });
      } catch (error) {
        this.logger.warn('Failed to emit event', { type, error });
      }
    }
  }

  private ensureNotDisposed(): void {
    if (this._disposed) {
      throw new Error('Agent has been disposed');
    }
  }
}
