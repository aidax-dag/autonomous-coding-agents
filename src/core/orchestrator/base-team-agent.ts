/**
 * Base Team Agent
 *
 * Abstract base implementation of ITeamAgent that provides common functionality
 * for all team agents. Concrete team implementations extend this class.
 *
 * Features:
 * - Task subscription and processing
 * - Handler registration
 * - Metrics tracking
 * - Health monitoring
 * - Lifecycle management
 *
 * Feature: Team Agent Implementation for Agent OS
 */

import { EventEmitter } from 'events';
import {
  TeamType,
  TaskType,
  TaskDocument,
} from '../workspace/task-document';
import { DocumentQueue } from '../workspace/document-queue';
import {
  ITeamAgent,
  TeamAgentStatus,
  TeamAgentConfig,
  TeamMetrics,
  TeamCapability,
  TaskHandler,
  TaskHandlerResult,
  createTeamConfig,
} from './team-agent';

/**
 * Base team agent events
 */
export interface BaseTeamAgentEvents {
  'status-changed': (oldStatus: TeamAgentStatus, newStatus: TeamAgentStatus) => void;
  'task:received': (task: TaskDocument) => void;
  'task:processing': (task: TaskDocument) => void;
  'task:completed': (task: TaskDocument, result: TaskHandlerResult) => void;
  'task:failed': (task: TaskDocument, error: Error) => void;
  'error': (error: Error) => void;
}

/**
 * Base Team Agent Options
 */
export interface BaseTeamAgentOptions {
  /** Team type */
  teamType: TeamType;
  /** Document queue for messaging */
  queue: DocumentQueue;
  /** Configuration overrides */
  config?: Partial<TeamAgentConfig>;
  /** Auto-subscribe to inbox on start */
  autoSubscribe?: boolean;
}

/**
 * Abstract Base Team Agent
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class BaseTeamAgent extends EventEmitter implements ITeamAgent {
  readonly id: string;
  readonly teamType: TeamType;
  readonly config: TeamAgentConfig;

  protected readonly queue: DocumentQueue;
  protected readonly handlers: Map<TaskType, TaskHandler> = new Map();
  protected readonly autoSubscribe: boolean;

  private _status: TeamAgentStatus = TeamAgentStatus.STOPPED;
  private _metrics: TeamMetrics;
  private unsubscribe?: () => void;
  private startTime?: Date;
  private processingCount = 0;
  private totalProcessingTime = 0;

  constructor(options: BaseTeamAgentOptions) {
    super();
    this.teamType = options.teamType;
    this.queue = options.queue;
    this.config = createTeamConfig(options.teamType, options.config);
    this.autoSubscribe = options.autoSubscribe ?? true;
    this.id = `${this.teamType}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    this._metrics = this.initializeMetrics();

    // Register default handlers from subclass
    this.registerDefaultHandlers();
  }

  /**
   * Current status
   */
  get status(): TeamAgentStatus {
    return this._status;
  }

  /**
   * Current metrics
   */
  get metrics(): TeamMetrics {
    return {
      ...this._metrics,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      successRate:
        this._metrics.tasksProcessed > 0
          ? (this._metrics.tasksProcessed - this._metrics.tasksFailed) / this._metrics.tasksProcessed
          : 1,
    };
  }

  /**
   * Start the agent
   */
  async start(): Promise<void> {
    if (this._status === TeamAgentStatus.IDLE || this._status === TeamAgentStatus.PROCESSING) {
      return;
    }

    this.setStatus(TeamAgentStatus.INITIALIZING);

    try {
      // Perform subclass-specific initialization
      await this.onStart();

      // Subscribe to inbox if configured
      if (this.autoSubscribe) {
        this.subscribeToInbox();
      }

      this.startTime = new Date();
      this.setStatus(TeamAgentStatus.IDLE);
    } catch (error) {
      this.setStatus(TeamAgentStatus.ERROR);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    if (this._status === TeamAgentStatus.STOPPED) {
      return;
    }

    this.setStatus(TeamAgentStatus.STOPPING);

    try {
      // Unsubscribe from inbox
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = undefined;
      }

      // Perform subclass-specific cleanup
      await this.onStop();

      this.setStatus(TeamAgentStatus.STOPPED);
    } catch (error) {
      this.setStatus(TeamAgentStatus.ERROR);
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Pause task processing
   */
  async pause(): Promise<void> {
    if (this._status !== TeamAgentStatus.IDLE && this._status !== TeamAgentStatus.PROCESSING) {
      return;
    }

    this.setStatus(TeamAgentStatus.PAUSED);
  }

  /**
   * Resume task processing
   */
  async resume(): Promise<void> {
    if (this._status !== TeamAgentStatus.PAUSED) {
      return;
    }

    this.setStatus(this.processingCount > 0 ? TeamAgentStatus.PROCESSING : TeamAgentStatus.IDLE);
  }

  /**
   * Check if agent can handle a task type
   */
  canHandle(taskType: TaskType): boolean {
    // Check if we have a handler registered
    if (this.handlers.has(taskType)) {
      return true;
    }

    // Check capabilities
    return this.config.capabilities.some((cap) => cap.taskTypes.includes(taskType));
  }

  /**
   * Register a task handler
   */
  registerHandler(taskTypes: TaskType[], handler: TaskHandler): void {
    for (const taskType of taskTypes) {
      this.handlers.set(taskType, handler);
    }
  }

  /**
   * Get capability for a task type
   */
  getCapability(taskType: TaskType): TeamCapability | undefined {
    return this.config.capabilities.find((cap) => cap.taskTypes.includes(taskType));
  }

  /**
   * Get current load (0-1)
   */
  getLoad(): number {
    return Math.min(1, this.processingCount / this.config.maxConcurrentTasks);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    status: TeamAgentStatus;
    details?: Record<string, unknown>;
  }> {
    const healthy =
      this._status !== TeamAgentStatus.ERROR &&
      this._status !== TeamAgentStatus.STOPPED;

    return {
      healthy,
      status: this._status,
      details: {
        id: this.id,
        teamType: this.teamType,
        load: this.getLoad(),
        metrics: this.metrics,
      },
    };
  }

  /**
   * Process a task directly (bypasses queue subscription)
   */
  async processTask(task: TaskDocument): Promise<TaskHandlerResult> {
    this.emit('task:received', task);

    // Check if we're accepting tasks
    if (this._status === TeamAgentStatus.PAUSED || this._status === TeamAgentStatus.STOPPED) {
      throw new Error(`Agent ${this.id} is not accepting tasks (status: ${this._status})`);
    }

    // Check if we're at capacity
    if (this.getLoad() >= 1) {
      throw new Error(`Agent ${this.id} is at capacity`);
    }

    // Find handler for task type
    const handler = this.handlers.get(task.metadata.type) || this.getDefaultHandler();

    if (!handler) {
      throw new Error(`No handler for task type: ${task.metadata.type}`);
    }

    // Process the task
    this.processingCount++;
    if (this._status === TeamAgentStatus.IDLE) {
      this.setStatus(TeamAgentStatus.PROCESSING);
    }

    const startTime = Date.now();
    this.emit('task:processing', task);

    try {
      const result = await this.executeWithTimeout(handler, task);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.totalProcessingTime += processingTime;
      this._metrics.tasksProcessed++;
      this._metrics.averageProcessingTime = this.totalProcessingTime / this._metrics.tasksProcessed;
      this._metrics.lastActiveAt = new Date();

      this.emit('task:completed', task, result);
      return result;
    } catch (error) {
      this._metrics.tasksFailed++;
      this._metrics.lastActiveAt = new Date();

      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('task:failed', task, err);

      return {
        success: false,
        error: err.message,
      };
    } finally {
      this.processingCount--;
      this._metrics.tasksInProgress = this.processingCount;

      if (this.processingCount === 0 && this._status === TeamAgentStatus.PROCESSING) {
        this.setStatus(TeamAgentStatus.IDLE);
      }
    }
  }

  /**
   * Subscribe to team inbox
   */
  protected subscribeToInbox(): void {
    this.unsubscribe = this.queue.subscribe(
      this.teamType,
      async (task) => {
        try {
          await this.processTask(task);
        } catch (error) {
          this.emit('error', error instanceof Error ? error : new Error(String(error)));
        }
      },
      {
        autoAcknowledge: true,
      }
    );
  }

  /**
   * Set status and emit event
   */
  protected setStatus(newStatus: TeamAgentStatus): void {
    const oldStatus = this._status;
    this._status = newStatus;
    this.emit('status-changed', oldStatus, newStatus);
  }

  /**
   * Execute handler with timeout
   */
  private async executeWithTimeout(
    handler: TaskHandler,
    task: TaskDocument
  ): Promise<TaskHandlerResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task processing timeout after ${this.config.taskTimeout}ms`));
      }, this.config.taskTimeout);

      handler(task)
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Initialize metrics
   */
  private initializeMetrics(): TeamMetrics {
    return {
      tasksProcessed: 0,
      tasksFailed: 0,
      tasksInProgress: 0,
      averageProcessingTime: 0,
      uptime: 0,
      lastActiveAt: null,
      successRate: 1,
    };
  }

  // ============================================================================
  // Abstract Methods (to be implemented by subclasses)
  // ============================================================================

  /**
   * Register default handlers for this team type
   * Called during construction
   */
  protected abstract registerDefaultHandlers(): void;

  /**
   * Get the default handler for unregistered task types
   * Returns null if no default handling is available
   */
  protected abstract getDefaultHandler(): TaskHandler | null;

  /**
   * Hook called when agent starts
   */
  protected abstract onStart(): Promise<void>;

  /**
   * Hook called when agent stops
   */
  protected abstract onStop(): Promise<void>;
}

// Type-safe event emitter
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface BaseTeamAgent {
  on<E extends keyof BaseTeamAgentEvents>(event: E, listener: BaseTeamAgentEvents[E]): this;
  emit<E extends keyof BaseTeamAgentEvents>(event: E, ...args: Parameters<BaseTeamAgentEvents[E]>): boolean;
}
