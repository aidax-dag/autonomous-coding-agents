/**
 * Base Team Abstract Class
 *
 * Foundation for all team implementations in the Agent OS.
 * Provides core functionality for task processing, messaging,
 * and team lifecycle management.
 *
 * Feature: Team System
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  TeamConfig,
  TeamStatus,
  TeamStats,
  TaskDocument,
  TaskResult,
  TeamMessage,
  TeamEvents,
  TeamMember,
  AgentRole,
  TaskStatus,
  TaskDocumentSchema,
  TeamMessageSchema,
} from './team-types';

// ============================================================================
// Abstract Base Team
// ============================================================================

/**
 * Abstract base class for all teams
 *
 * @example
 * ```typescript
 * class PlanningTeam extends BaseTeam {
 *   protected async processTask(task: TaskDocument): Promise<TaskResult> {
 *     // Decompose requirements into subtasks
 *     const subtasks = await this.decompose(task);
 *     return {
 *       taskId: task.id,
 *       success: true,
 *       outputs: { plan: subtasks },
 *       subtasks,
 *       artifacts: [],
 *       duration: Date.now() - task.startedAt!.getTime(),
 *       tokensUsed: this.tokenCounter,
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseTeam extends EventEmitter {
  /** Team configuration */
  protected readonly config: TeamConfig;

  /** Current team status */
  protected status: TeamStatus = TeamStatus.INITIALIZING;

  /** Team members (agents) */
  protected members: Map<string, TeamMember> = new Map();

  /** Pending tasks queue */
  protected taskQueue: TaskDocument[] = [];

  /** Active tasks */
  protected activeTasks: Map<string, TaskDocument> = new Map();

  /** Completed tasks */
  protected completedTasks: Map<string, TaskResult> = new Map();

  /** Message inbox */
  protected inbox: TeamMessage[] = [];

  /** Message outbox */
  protected outbox: TeamMessage[] = [];

  /** Statistics */
  protected stats: TeamStats = {
    tasksReceived: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    tasksInProgress: 0,
    averageTaskDuration: 0,
    totalTokensUsed: 0,
    uptime: 0,
    lastActivity: new Date(),
  };

  /** Start time for uptime calculation */
  protected startTime?: Date;

  /** Task processing interval */
  protected processingInterval?: ReturnType<typeof setInterval>;

  /** Token counter for current operation */
  protected tokenCounter: number = 0;

  /** Logger instance */
  protected logger: Console = console;

  constructor(config: TeamConfig) {
    super();
    this.config = config;
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Initialize the team
   */
  async initialize(): Promise<void> {
    this.status = TeamStatus.INITIALIZING;

    // Initialize team members
    await this.initializeMembers();

    // Setup message handlers
    this.setupMessageHandlers();

    // Emit initialized event
    this.emit('team:initialized', this.config.id);

    this.status = TeamStatus.IDLE;
  }

  /**
   * Start the team (begin processing tasks)
   */
  async start(): Promise<void> {
    if (this.status === TeamStatus.WORKING) {
      return;
    }

    this.startTime = new Date();
    this.status = TeamStatus.IDLE;

    // Start task processing loop
    this.processingInterval = setInterval(() => {
      this.processNextTask().catch((error) => {
        this.handleError(error);
      });
    }, 1000);

    this.emit('team:started', this.config.id);
  }

  /**
   * Stop the team
   */
  async stop(): Promise<void> {
    this.status = TeamStatus.SHUTTING_DOWN;

    // Stop processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for active tasks to complete (with timeout)
    const timeout = 30000;
    const startWait = Date.now();

    while (this.activeTasks.size > 0 && Date.now() - startWait < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Cancel remaining tasks
    for (const [taskId, task] of this.activeTasks) {
      task.status = TaskStatus.CANCELLED;
      this.activeTasks.delete(taskId);
    }

    this.status = TeamStatus.TERMINATED;
    this.emit('team:stopped', this.config.id);
  }

  /**
   * Pause the team
   */
  pause(): void {
    if (this.status === TeamStatus.WORKING || this.status === TeamStatus.IDLE) {
      this.status = TeamStatus.PAUSED;
    }
  }

  /**
   * Resume the team
   */
  resume(): void {
    if (this.status === TeamStatus.PAUSED) {
      this.status = this.activeTasks.size > 0 ? TeamStatus.WORKING : TeamStatus.IDLE;
    }
  }

  // ============================================================================
  // Task Management
  // ============================================================================

  /**
   * Submit a task to the team
   */
  async submitTask(task: TaskDocument): Promise<string> {
    const validatedTask = TaskDocumentSchema.parse({
      ...task,
      id: task.id || uuidv4(),
      assignedTeam: this.config.id,
      status: TaskStatus.PENDING,
    });

    this.taskQueue.push(validatedTask);
    this.stats.tasksReceived++;
    this.stats.lastActivity = new Date();

    this.emit('task:received', this.config.id, validatedTask);

    return validatedTask.id;
  }

  /**
   * Process the next task in the queue
   */
  protected async processNextTask(): Promise<void> {
    if (this.status === TeamStatus.PAUSED || this.status === TeamStatus.SHUTTING_DOWN) {
      return;
    }

    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) {
      return;
    }

    // Check dependencies
    if (!this.areDependenciesSatisfied(task)) {
      this.taskQueue.push(task);
      return;
    }

    // Start processing
    this.status = TeamStatus.WORKING;
    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();
    this.activeTasks.set(task.id, task);
    this.stats.tasksInProgress++;

    this.emit('task:started', this.config.id, task);

    try {
      // Process the task (implemented by subclasses)
      const result = await this.executeWithTimeout(task);

      // Handle success
      task.status = TaskStatus.COMPLETED;
      task.completedAt = new Date();
      task.outputs = result.outputs;

      this.completedTasks.set(task.id, result);
      this.stats.tasksCompleted++;
      this.updateAverageDuration(result.duration);
      this.stats.totalTokensUsed += result.tokensUsed;

      this.emit('task:completed', this.config.id, result);

      // Submit subtasks if any
      for (const subtask of result.subtasks) {
        await this.submitTask(subtask);
      }
    } catch (error) {
      // Handle failure
      task.status = TaskStatus.FAILED;
      task.error = error instanceof Error ? error.message : String(error);
      this.stats.tasksFailed++;

      this.emit('task:failed', this.config.id, task, error as Error);

      // Retry if configured
      if (this.config.autoRetry && this.shouldRetry(task)) {
        task.status = TaskStatus.PENDING;
        task.metadata.retryCount = ((task.metadata.retryCount as number) || 0) + 1;
        this.taskQueue.push(task);
      }
    } finally {
      this.activeTasks.delete(task.id);
      this.stats.tasksInProgress--;
      this.stats.lastActivity = new Date();

      if (this.activeTasks.size === 0 && this.taskQueue.length === 0) {
        this.status = TeamStatus.IDLE;
      }
    }
  }

  /**
   * Execute task with timeout
   */
  protected async executeWithTimeout(task: TaskDocument): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task ${task.id} timed out after ${this.config.taskTimeoutMs}ms`));
      }, this.config.taskTimeoutMs);

      this.processTask(task)
        .then((result) => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Process a single task (to be implemented by subclasses)
   */
  protected abstract processTask(task: TaskDocument): Promise<TaskResult>;

  /**
   * Check if task dependencies are satisfied
   */
  protected areDependenciesSatisfied(task: TaskDocument): boolean {
    for (const depId of task.dependencies) {
      const result = this.completedTasks.get(depId);
      if (!result || !result.success) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if task should be retried
   */
  protected shouldRetry(task: TaskDocument): boolean {
    const retryCount = (task.metadata.retryCount as number) || 0;
    return retryCount < this.config.maxRetries;
  }

  /**
   * Update average duration statistic
   */
  protected updateAverageDuration(duration: number): void {
    const total = this.stats.tasksCompleted;
    if (total === 1) {
      this.stats.averageTaskDuration = duration;
    } else {
      this.stats.averageTaskDuration =
        (this.stats.averageTaskDuration * (total - 1) + duration) / total;
    }
  }

  // ============================================================================
  // Messaging
  // ============================================================================

  /**
   * Send a message to another team
   */
  async sendMessage(message: Omit<TeamMessage, 'id' | 'from' | 'timestamp'>): Promise<string> {
    const fullMessage = TeamMessageSchema.parse({
      ...message,
      id: uuidv4(),
      from: this.config.id,
      timestamp: new Date(),
    });

    this.outbox.push(fullMessage);
    this.emit('message:sent', this.config.id, fullMessage);

    return fullMessage.id;
  }

  /**
   * Receive a message
   */
  async receiveMessage(message: TeamMessage): Promise<void> {
    const validated = TeamMessageSchema.parse(message);
    this.inbox.push(validated);
    this.emit('message:received', this.config.id, validated);

    // Handle message based on type
    await this.handleMessage(validated);

    // Send acknowledgment if required
    if (validated.requiresAck) {
      await this.acknowledgeMessage(validated);
    }
  }

  /**
   * Handle incoming message (can be overridden by subclasses)
   */
  protected async handleMessage(message: TeamMessage): Promise<void> {
    switch (message.type) {
      case 'task_assignment':
        await this.submitTask(message.body as TaskDocument);
        break;
      case 'status_request':
        await this.sendStatusResponse(message);
        break;
      case 'capability_query':
        await this.sendCapabilityResponse(message);
        break;
      default:
        // Subclasses can handle other message types
        break;
    }
  }

  /**
   * Acknowledge a message
   */
  protected async acknowledgeMessage(message: TeamMessage): Promise<void> {
    await this.sendMessage({
      type: 'notification',
      to: message.from,
      subject: 'Message Acknowledged',
      body: { originalMessageId: message.id },
      correlationId: message.id,
      priority: message.priority,
      requiresAck: false,
      acknowledged: false,
      metadata: {},
    });
  }

  /**
   * Send status response
   */
  protected async sendStatusResponse(request: TeamMessage): Promise<void> {
    await this.sendMessage({
      type: 'status_response',
      to: request.from,
      subject: 'Status Report',
      body: {
        status: this.status,
        stats: this.getStats(),
        activeTasks: Array.from(this.activeTasks.keys()),
        queuedTasks: this.taskQueue.length,
      },
      correlationId: request.id,
      priority: request.priority,
      requiresAck: false,
      acknowledged: false,
      metadata: {},
    });
  }

  /**
   * Send capability response
   */
  protected async sendCapabilityResponse(request: TeamMessage): Promise<void> {
    await this.sendMessage({
      type: 'capability_response',
      to: request.from,
      subject: 'Capability Report',
      body: {
        capabilities: this.config.capabilities,
        type: this.config.type,
        available: this.status === TeamStatus.IDLE || this.status === TeamStatus.WORKING,
        capacity: this.config.maxConcurrentTasks - this.activeTasks.size,
      },
      correlationId: request.id,
      priority: request.priority,
      requiresAck: false,
      acknowledged: false,
      metadata: {},
    });
  }

  // ============================================================================
  // Member Management
  // ============================================================================

  /**
   * Initialize team members (to be overridden by subclasses)
   */
  protected async initializeMembers(): Promise<void> {
    // Default implementation - subclasses can add specific agents
  }

  /**
   * Add a team member
   */
  protected addMember(role: AgentRole): TeamMember {
    const member: TeamMember = {
      id: uuidv4(),
      role,
      status: 'idle',
      tasksCompleted: 0,
      lastActivity: new Date(),
    };

    this.members.set(member.id, member);
    return member;
  }

  /**
   * Get available member for a task
   */
  protected getAvailableMember(): TeamMember | undefined {
    for (const member of this.members.values()) {
      if (member.status === 'idle') {
        return member;
      }
    }
    return undefined;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Setup message handlers
   */
  protected setupMessageHandlers(): void {
    // Default setup - subclasses can add custom handlers
  }

  /**
   * Handle errors
   */
  protected handleError(error: Error): void {
    this.logger.error(`[${this.config.name}] Error:`, error);
    this.emit('team:error', this.config.id, error);

    if (this.status !== TeamStatus.SHUTTING_DOWN && this.status !== TeamStatus.TERMINATED) {
      this.status = TeamStatus.ERROR;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get team ID
   */
  get id(): string {
    return this.config.id;
  }

  /**
   * Get team name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get team type
   */
  get type() {
    return this.config.type;
  }

  /**
   * Get team capabilities
   */
  get capabilities() {
    return this.config.capabilities;
  }

  /**
   * Get current status
   */
  getStatus(): TeamStatus {
    return this.status;
  }

  /**
   * Get team statistics
   */
  getStats(): TeamStats {
    return {
      ...this.stats,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
    };
  }

  /**
   * Get task queue length
   */
  getQueueLength(): number {
    return this.taskQueue.length;
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Get team configuration
   */
  getConfig(): Readonly<TeamConfig> {
    return this.config;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TaskDocument | TaskResult | undefined {
    return this.activeTasks.get(taskId) || this.completedTasks.get(taskId);
  }

  /**
   * Check if team has capability
   */
  hasCapability(capability: string): boolean {
    return this.config.capabilities.includes(capability as never);
  }

  // ============================================================================
  // Event Typing
  // ============================================================================

  override on<K extends keyof TeamEvents>(
    event: K,
    listener: TeamEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof TeamEvents>(
    event: K,
    ...args: Parameters<TeamEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a task document
 */
export function createTask(
  title: string,
  description: string,
  options: Partial<TaskDocument> = {}
): TaskDocument {
  return TaskDocumentSchema.parse({
    id: uuidv4(),
    title,
    description,
    type: options.type || 'generic',
    ...options,
  });
}

/**
 * Create an agent role
 */
export function createRole(
  name: string,
  description: string,
  systemPrompt: string,
  options: Partial<AgentRole> = {}
): AgentRole {
  return {
    id: uuidv4(),
    name,
    description,
    systemPrompt,
    capabilities: options.capabilities || [],
    tools: options.tools || [],
    ...options,
  };
}
