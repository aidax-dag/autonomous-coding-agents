import { ILLMClient, createLLMClient } from '@/shared/llm';
import { NatsClient } from '@/shared/messaging/nats-client';
import { AgentLogger, createAgentLogger } from '@/shared/logging/logger';
import { AgentError, ErrorCode } from '@/shared/errors/custom-errors';
import {
  AgentConfig,
  AgentType,
  AgentState,
  Task,
  TaskResult,
  TaskStatus,
  HealthStatus,
  AgentEvent,
  AgentEventType,
} from '@/agents/base/types';

/**
 * Base Agent Class
 *
 * Abstract base class that all agents inherit from.
 * Provides common functionality for agent lifecycle, message handling,
 * and state management.
 *
 * Feature: F2.1 - Base Agent Class
 */

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected llmClient: ILLMClient;
  protected natsClient: NatsClient;
  protected logger: AgentLogger;

  protected state: AgentState;
  protected currentTask?: Task;
  protected taskQueue: Task[];

  // Metrics
  protected startTime: number;
  protected tasksProcessed: number;
  protected tasksFailed: number;
  protected lastTaskCompletedAt?: number;
  protected totalTaskDuration: number;

  constructor(config: AgentConfig, natsClient: NatsClient) {
    this.config = config;
    this.natsClient = natsClient;
    this.logger = createAgentLogger(config.type, config.id);

    this.state = AgentState.IDLE;
    this.taskQueue = [];
    this.startTime = 0;
    this.tasksProcessed = 0;
    this.tasksFailed = 0;
    this.totalTaskDuration = 0;

    // Initialize LLM client
    this.llmClient = createLLMClient(
      config.llm.provider,
      this.getLLMApiKey(config.llm.provider),
      config.llm.model
    );
  }

  /**
   * Get LLM API key from environment
   */
  private getLLMApiKey(provider: 'claude' | 'openai' | 'gemini'): string {
    const envVars: Record<string, string> = {
      claude: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      gemini: 'GOOGLE_API_KEY',
    };

    const key = process.env[envVars[provider]];
    if (!key) {
      throw new AgentError(
        `Missing API key for ${provider}`,
        ErrorCode.CONFIG_MISSING,
        false,
        { provider }
      );
    }

    return key;
  }

  /**
   * Get agent type (must be implemented by subclasses)
   */
  abstract getAgentType(): AgentType;

  /**
   * Process a task (must be implemented by subclasses)
   */
  abstract processTask(task: Task): Promise<TaskResult>;

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing agent', {
      agentId: this.config.id,
      agentType: this.getAgentType(),
    });

    try {
      this.state = AgentState.INITIALIZING;

      // Subscribe to agent-specific topic
      const topic = this.getTaskTopic();
      await this.natsClient.subscribe(topic, async (message) => {
        await this.handleMessage(message);
      });

      this.logger.info('Agent initialized successfully', { topic });
      this.state = AgentState.IDLE;
      this.startTime = Date.now();

      await this.publishEvent({
        type: AgentEventType.STARTED,
        agentId: this.config.id,
        agentType: this.getAgentType(),
        timestamp: Date.now(),
      });
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error('Failed to initialize agent', { error });
      throw new AgentError(
        'Agent initialization failed',
        ErrorCode.AGENT_INITIALIZATION_ERROR,
        false,
        { originalError: String(error) }
      );
    }
  }

  /**
   * Start the agent (alias for initialize for clarity)
   */
  async start(): Promise<void> {
    await this.initialize();
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping agent', { agentId: this.config.id });

    try {
      this.state = AgentState.STOPPED;

      // Cancel current task if any
      if (this.currentTask) {
        this.logger.warn('Stopping agent with active task', {
          taskId: this.currentTask.id,
        });
      }

      // Clear task queue
      this.taskQueue = [];

      await this.publishEvent({
        type: AgentEventType.STOPPED,
        agentId: this.config.id,
        agentType: this.getAgentType(),
        timestamp: Date.now(),
      });

      this.logger.info('Agent stopped successfully');
    } catch (error) {
      this.logger.error('Error while stopping agent', { error });
      throw new AgentError(
        'Failed to stop agent',
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { originalError: String(error) }
      );
    }
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message: unknown): Promise<void> {
    try {
      // Parse task from message
      const task = this.parseTask(message);

      this.logger.info('Received task', {
        taskId: task.id,
        taskType: task.type,
        priority: task.priority,
      });

      await this.publishEvent({
        type: AgentEventType.TASK_RECEIVED,
        agentId: this.config.id,
        agentType: this.getAgentType(),
        timestamp: Date.now(),
        data: { taskId: task.id, taskType: task.type },
      });

      // Add to queue or process immediately
      if (this.state === AgentState.IDLE) {
        await this.executeTask(task);
      } else {
        this.taskQueue.push(task);
        this.logger.info('Task queued', {
          taskId: task.id,
          queueSize: this.taskQueue.length,
        });
      }
    } catch (error) {
      this.logger.error('Failed to handle message', { error, message });
      await this.publishEvent({
        type: AgentEventType.ERROR,
        agentId: this.config.id,
        agentType: this.getAgentType(),
        timestamp: Date.now(),
        data: { error: String(error) },
      });
    }
  }

  /**
   * Execute a task
   */
  private async executeTask(task: Task): Promise<void> {
    const startTime = Date.now();

    try {
      this.state = AgentState.WORKING;
      this.currentTask = task;

      await this.publishEvent({
        type: AgentEventType.TASK_STARTED,
        agentId: this.config.id,
        agentType: this.getAgentType(),
        timestamp: Date.now(),
        data: { taskId: task.id },
      });

      this.logger.info('Processing task', { taskId: task.id });

      // Process task (implemented by subclass)
      const result = await this.processTask(task);

      const duration = Date.now() - startTime;
      this.tasksProcessed++;
      this.lastTaskCompletedAt = Date.now();
      this.totalTaskDuration += duration;

      // Add metadata to result
      result.metadata = {
        ...result.metadata,
        completedAt: Date.now(),
        duration,
        agentId: this.config.id,
      };

      this.logger.info('Task completed successfully', {
        taskId: task.id,
        duration,
      });

      // Publish result
      await this.publishResult(result);

      await this.publishEvent({
        type: AgentEventType.TASK_COMPLETED,
        agentId: this.config.id,
        agentType: this.getAgentType(),
        timestamp: Date.now(),
        data: { taskId: task.id, duration },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.tasksFailed++;

      this.logger.error('Task failed', {
        taskId: task.id,
        duration,
        error,
      });

      // Create error result
      const errorResult: TaskResult = {
        taskId: task.id,
        status: TaskStatus.FAILED,
        success: false,
        error: {
          code: error instanceof AgentError ? error.code : ErrorCode.UNKNOWN_ERROR,
          message: String(error),
          details: error instanceof AgentError ? error.context : undefined,
        },
        metadata: {
          completedAt: Date.now(),
          duration,
          agentId: this.config.id,
        },
      };

      await this.publishResult(errorResult);

      await this.publishEvent({
        type: AgentEventType.TASK_FAILED,
        agentId: this.config.id,
        agentType: this.getAgentType(),
        timestamp: Date.now(),
        data: { taskId: task.id, error: String(error) },
      });
    } finally {
      this.currentTask = undefined;
      this.state = AgentState.IDLE;

      // Process next task in queue
      if (this.taskQueue.length > 0) {
        const nextTask = this.taskQueue.shift();
        if (nextTask) {
          await this.executeTask(nextTask);
        }
      }
    }
  }

  /**
   * Publish task result
   */
  async publishResult(result: TaskResult): Promise<void> {
    try {
      const topic = this.getResultTopic();
      await this.natsClient.publish(topic, result);

      this.logger.info('Published task result', {
        taskId: result.taskId,
        topic,
        success: result.success,
      });
    } catch (error) {
      this.logger.error('Failed to publish result', { error, result });
      throw new AgentError(
        'Failed to publish task result',
        ErrorCode.MESSAGE_BROKER_ERROR,
        true,
        { originalError: String(error) }
      );
    }
  }

  /**
   * Publish agent event
   */
  protected async publishEvent(event: AgentEvent): Promise<void> {
    try {
      await this.natsClient.publish('agent.events', event);
    } catch (error) {
      // Don't throw - events are best-effort
      this.logger.warn('Failed to publish event', { error, event });
    }
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return this.state;
  }

  /**
   * Get health status
   */
  getHealth(): HealthStatus {
    const uptime = this.startTime > 0 ? Date.now() - this.startTime : 0;
    const averageTaskDuration =
      this.tasksProcessed > 0 ? this.totalTaskDuration / this.tasksProcessed : undefined;
    const totalTasks = this.tasksProcessed + this.tasksFailed;
    const errorRate = totalTasks > 0 ? (this.tasksFailed / totalTasks) * 100 : undefined;

    return {
      healthy: this.state !== AgentState.ERROR && this.state !== AgentState.STOPPED,
      state: this.state,
      uptime,
      lastTaskCompletedAt: this.lastTaskCompletedAt,
      tasksProcessed: this.tasksProcessed,
      tasksFailed: this.tasksFailed,
      averageTaskDuration,
      errorRate,
      details: {
        currentTask: this.currentTask?.id,
        queueSize: this.taskQueue.length,
      },
    };
  }

  /**
   * Get task topic for this agent type
   */
  protected getTaskTopic(): string {
    return `agent.tasks.${this.getAgentType().toLowerCase()}`;
  }

  /**
   * Get result topic for this agent type
   */
  protected getResultTopic(): string {
    return `agent.results.${this.getAgentType().toLowerCase()}`;
  }

  /**
   * Parse task from message
   */
  protected parseTask(message: unknown): Task {
    // Basic validation
    if (!message || typeof message !== 'object') {
      throw new AgentError(
        'Invalid task message',
        ErrorCode.MESSAGE_VALIDATION_ERROR,
        false,
        { message }
      );
    }

    const msg = message as Record<string, unknown>;

    if (!msg.id || !msg.type || !msg.agentType) {
      throw new AgentError(
        'Task missing required fields',
        ErrorCode.MESSAGE_VALIDATION_ERROR,
        false,
        { message }
      );
    }

    // Verify agent type matches
    if (msg.agentType !== this.getAgentType()) {
      throw new AgentError(
        'Task agent type mismatch',
        ErrorCode.MESSAGE_VALIDATION_ERROR,
        false,
        { expected: this.getAgentType(), actual: msg.agentType }
      );
    }

    return message as Task;
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.config.id;
  }

  /**
   * Get agent config
   */
  getConfig(): AgentConfig {
    return this.config;
  }
}
