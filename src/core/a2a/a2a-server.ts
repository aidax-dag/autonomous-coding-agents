/**
 * A2A Protocol Server
 *
 * Implements the Google A2A (Agent-to-Agent) protocol for inter-agent communication.
 * Provides server lifecycle management, agent registration, and task handling.
 *
 * @module core/a2a/a2a-server
 *
 * @example
 * ```typescript
 * import { A2AServer, createA2AServer } from '@core/a2a';
 *
 * const server = createA2AServer({
 *   port: 3000,
 *   host: 'localhost',
 *   basePath: '/a2a',
 * });
 *
 * // Register an agent
 * server.registerAgent(myAgent);
 *
 * // Start the server
 * await server.start();
 *
 * // Handle tasks
 * const result = await server.handleTask(task);
 * ```
 */

import { EventEmitter } from 'events';
import { z } from 'zod';
import { IAgent, AgentType, AgentCapability } from '../interfaces/agent.interface';

// ============================================================================
// Enums
// ============================================================================

/**
 * A2A Server status
 */
export enum A2AServerStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
}

/**
 * A2A Task status
 */
export enum A2ATaskStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  WORKING = 'working',
  INPUT_REQUIRED = 'input_required',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * A2A Input/Output mode
 */
export enum A2AContentMode {
  TEXT = 'text',
  FILE = 'file',
  DATA = 'data',
}

/**
 * A2A Authentication type
 */
export enum A2AAuthType {
  NONE = 'none',
  API_KEY = 'api_key',
  BEARER_TOKEN = 'bearer_token',
  OAUTH2 = 'oauth2',
}

// ============================================================================
// Schemas
// ============================================================================

/**
 * Agent skill schema
 */
export const AgentSkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  examples: z.array(z.string()).optional(),
});

/**
 * Agent capability schema (A2A specific)
 */
export const A2ACapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
});

/**
 * Authentication info schema
 */
export const AuthenticationInfoSchema = z.object({
  type: z.nativeEnum(A2AAuthType),
  schemes: z.array(z.string()).optional(),
  credentials: z.record(z.string()).optional(),
});

/**
 * Agent Card schema (A2A standard)
 */
export const AgentCardSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  url: z.string().url(),
  version: z.string().default('1.0.0'),
  documentationUrl: z.string().url().optional(),
  provider: z
    .object({
      organization: z.string(),
      url: z.string().url().optional(),
    })
    .optional(),
  capabilities: z.array(A2ACapabilitySchema).default([]),
  skills: z.array(AgentSkillSchema).default([]),
  authentication: AuthenticationInfoSchema.optional(),
  defaultInputModes: z.array(z.nativeEnum(A2AContentMode)).default([A2AContentMode.TEXT]),
  defaultOutputModes: z.array(z.nativeEnum(A2AContentMode)).default([A2AContentMode.TEXT]),
  supportsStreaming: z.boolean().default(false),
  supportsPushNotifications: z.boolean().default(false),
  maxConcurrentTasks: z.number().int().min(1).optional(),
});

/**
 * A2A Message schema
 */
export const A2AMessageSchema = z.object({
  role: z.enum(['user', 'agent']),
  content: z.string(),
  parts: z
    .array(
      z.object({
        type: z.enum(['text', 'file', 'data']),
        content: z.string().optional(),
        mimeType: z.string().optional(),
        uri: z.string().optional(),
        data: z.unknown().optional(),
      })
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * A2A Artifact schema
 */
export const A2AArtifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string(),
  parts: z.array(
    z.object({
      type: z.enum(['text', 'file', 'data']),
      content: z.string().optional(),
      uri: z.string().optional(),
      data: z.unknown().optional(),
    })
  ),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * A2A Context schema
 */
export const A2AContextSchema = z.object({
  conversationId: z.string().optional(),
  parentTaskId: z.string().optional(),
  history: z.array(A2AMessageSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * A2A Constraints schema
 */
export const A2AConstraintsSchema = z.object({
  timeout: z.number().int().min(0).optional(),
  maxTokens: z.number().int().min(1).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
});

/**
 * A2A Task schema
 */
export const A2ATaskSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().optional(),
  message: A2AMessageSchema,
  context: A2AContextSchema.optional(),
  constraints: A2AConstraintsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * A2A Task result schema
 */
export const A2ATaskResultSchema = z.object({
  taskId: z.string(),
  status: z.nativeEnum(A2ATaskStatus),
  message: A2AMessageSchema.optional(),
  artifacts: z.array(A2AArtifactSchema).optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.unknown()).optional(),
    })
    .optional(),
  metadata: z.object({
    agentId: z.string(),
    startedAt: z.date(),
    completedAt: z.date().optional(),
    duration: z.number().optional(),
    tokensUsed: z.number().optional(),
  }),
});

/**
 * A2A Task update schema (for streaming)
 */
export const A2ATaskUpdateSchema = z.object({
  taskId: z.string(),
  status: z.nativeEnum(A2ATaskStatus),
  progress: z.number().min(0).max(100).optional(),
  message: A2AMessageSchema.optional(),
  partialArtifact: z.object({
    artifactId: z.string(),
    part: z.object({
      type: z.enum(['text', 'file', 'data']),
      content: z.string().optional(),
      data: z.unknown().optional(),
    }),
    index: z.number().int().min(0),
    isLast: z.boolean(),
  }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * A2A Server config schema
 */
export const A2AServerConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(3000),
  host: z.string().default('localhost'),
  basePath: z.string().default('/a2a'),
  enableCors: z.boolean().default(true),
  corsOrigins: z.array(z.string()).default(['*']),
  authentication: AuthenticationInfoSchema.optional(),
  maxConcurrentTasks: z.number().int().min(1).default(100),
  taskTimeout: z.number().int().min(1000).default(300000), // 5 minutes
  enableStreaming: z.boolean().default(true),
  enablePushNotifications: z.boolean().default(false),
  healthCheckInterval: z.number().int().min(1000).default(30000),
  shutdownTimeout: z.number().int().min(0).default(10000),
  startupDelay: z.number().int().min(0).default(100), // Startup delay for initialization
});

// ============================================================================
// Types
// ============================================================================

export type AgentSkill = z.infer<typeof AgentSkillSchema>;
export type A2ACapability = z.infer<typeof A2ACapabilitySchema>;
export type AuthenticationInfo = z.infer<typeof AuthenticationInfoSchema>;
export type AgentCard = z.infer<typeof AgentCardSchema>;
export type A2AMessage = z.infer<typeof A2AMessageSchema>;
export type A2AArtifact = z.infer<typeof A2AArtifactSchema>;
export type A2AContext = z.infer<typeof A2AContextSchema>;
export type A2AConstraints = z.infer<typeof A2AConstraintsSchema>;
export type A2ATask = z.infer<typeof A2ATaskSchema>;
export type A2ATaskResult = z.infer<typeof A2ATaskResultSchema>;
export type A2ATaskUpdate = z.infer<typeof A2ATaskUpdateSchema>;
export type A2AServerConfig = z.infer<typeof A2AServerConfigSchema>;

/**
 * A2A Error
 */
export interface A2AError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Registered agent info
 */
export interface RegisteredAgent {
  agent: IAgent;
  card: AgentCard;
  registeredAt: Date;
  activeTasks: number;
}

/**
 * Active task info
 */
export interface ActiveTask {
  task: A2ATask;
  agentId: string;
  status: A2ATaskStatus;
  startedAt: Date;
  lastUpdateAt: Date;
  subscribers: Set<(update: A2ATaskUpdate) => void>;
}

/**
 * A2A Server statistics
 */
export interface A2AServerStats {
  status: A2AServerStatus;
  uptime: number;
  registeredAgents: number;
  activeTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalRequests: number;
  averageResponseTime: number;
}

// ============================================================================
// Events
// ============================================================================

/**
 * A2A Server events
 */
export const A2AServerEvents = {
  // Server lifecycle
  SERVER_STARTING: 'a2a:server:starting',
  SERVER_STARTED: 'a2a:server:started',
  SERVER_STOPPING: 'a2a:server:stopping',
  SERVER_STOPPED: 'a2a:server:stopped',
  SERVER_ERROR: 'a2a:server:error',

  // Agent events
  AGENT_REGISTERED: 'a2a:agent:registered',
  AGENT_UNREGISTERED: 'a2a:agent:unregistered',
  AGENT_CARD_REQUESTED: 'a2a:agent:card:requested',

  // Task events
  TASK_RECEIVED: 'a2a:task:received',
  TASK_STARTED: 'a2a:task:started',
  TASK_UPDATED: 'a2a:task:updated',
  TASK_COMPLETED: 'a2a:task:completed',
  TASK_FAILED: 'a2a:task:failed',
  TASK_CANCELLED: 'a2a:task:cancelled',
  TASK_STREAM_STARTED: 'a2a:task:stream:started',
  TASK_STREAM_CHUNK: 'a2a:task:stream:chunk',
  TASK_STREAM_ENDED: 'a2a:task:stream:ended',

  // Health events
  HEALTH_CHECK: 'a2a:health:check',
} as const;

export type A2AServerEventType = (typeof A2AServerEvents)[keyof typeof A2AServerEvents];

/**
 * Server event payload
 */
export interface ServerEventPayload {
  port?: number;
  host?: string;
  error?: A2AError;
}

/**
 * Agent event payload
 */
export interface AgentEventPayload {
  agentId: string;
  agentType?: AgentType;
  card?: AgentCard;
}

/**
 * Task event payload
 */
export interface TaskEventPayload {
  taskId: string;
  agentId?: string;
  status?: A2ATaskStatus;
  progress?: number;
  result?: A2ATaskResult;
  error?: A2AError;
  update?: A2ATaskUpdate;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * A2A Server interface
 */
export interface IA2AServer {
  // === Server Lifecycle ===
  /**
   * Start the A2A server
   */
  start(): Promise<void>;

  /**
   * Stop the A2A server
   */
  stop(): Promise<void>;

  /**
   * Get server status
   */
  getStatus(): A2AServerStatus;

  /**
   * Check if server is running
   */
  isRunning(): boolean;

  // === Agent Registration ===
  /**
   * Register an agent with the server
   */
  registerAgent(agent: IAgent, cardOverrides?: Partial<AgentCard>): void;

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): boolean;

  /**
   * Get agent card by ID
   */
  getAgentCard(agentId: string): AgentCard | undefined;

  /**
   * Get all registered agent cards
   */
  getAllAgentCards(): AgentCard[];

  /**
   * Find agents by capability
   */
  findAgentsByCapability(capabilityName: string): AgentCard[];

  // === Task Handling ===
  /**
   * Handle a task synchronously
   */
  handleTask(task: A2ATask): Promise<A2ATaskResult>;

  /**
   * Handle a task with streaming updates
   */
  handleTaskStream(task: A2ATask): AsyncGenerator<A2ATaskUpdate, A2ATaskResult, undefined>;

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): A2ATaskStatus | undefined;

  /**
   * Cancel a running task
   */
  cancelTask(taskId: string): Promise<boolean>;

  /**
   * Get active tasks
   */
  getActiveTasks(): ActiveTask[];

  // === Events ===
  /**
   * Subscribe to server events
   */
  on(event: A2AServerEventType, listener: (...args: unknown[]) => void): void;

  /**
   * Unsubscribe from server events
   */
  off(event: A2AServerEventType, listener: (...args: unknown[]) => void): void;

  // === Statistics ===
  /**
   * Get server statistics
   */
  getStats(): A2AServerStats;

  // === Configuration ===
  /**
   * Get server configuration
   */
  getConfig(): A2AServerConfig;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * A2A Protocol Server
 *
 * Implements the Google A2A protocol for inter-agent communication.
 */
export class A2AServer extends EventEmitter implements IA2AServer {
  private readonly config: A2AServerConfig;
  private status: A2AServerStatus = A2AServerStatus.STOPPED;
  private startedAt: Date | null = null;

  // Agent management
  private readonly registeredAgents: Map<string, RegisteredAgent> = new Map();

  // Task management
  private readonly activeTasks: Map<string, ActiveTask> = new Map();
  private completedTaskCount: number = 0;
  private failedTaskCount: number = 0;
  private totalRequestCount: number = 0;
  private totalResponseTime: number = 0;

  // Health check
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<A2AServerConfig> = {}) {
    super();
    this.config = A2AServerConfigSchema.parse(config);
  }

  // === Server Lifecycle ===

  async start(): Promise<void> {
    if (this.status === A2AServerStatus.RUNNING) {
      throw new Error('Server is already running');
    }

    if (this.status === A2AServerStatus.STARTING) {
      throw new Error('Server is already starting');
    }

    this.status = A2AServerStatus.STARTING;
    this.emit(A2AServerEvents.SERVER_STARTING, {
      port: this.config.port,
      host: this.config.host,
    } as ServerEventPayload);

    try {
      // Simulate startup delay for initialization
      if (this.config.startupDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.config.startupDelay));
      }

      // Start health check timer
      this.startHealthCheck();

      this.status = A2AServerStatus.RUNNING;
      this.startedAt = new Date();

      this.emit(A2AServerEvents.SERVER_STARTED, {
        port: this.config.port,
        host: this.config.host,
      } as ServerEventPayload);
    } catch (error) {
      this.status = A2AServerStatus.ERROR;
      const a2aError: A2AError = {
        code: 'SERVER_START_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      this.emit(A2AServerEvents.SERVER_ERROR, { error: a2aError } as ServerEventPayload);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.status === A2AServerStatus.STOPPED) {
      return;
    }

    if (this.status === A2AServerStatus.STOPPING) {
      throw new Error('Server is already stopping');
    }

    this.status = A2AServerStatus.STOPPING;
    this.emit(A2AServerEvents.SERVER_STOPPING, {} as ServerEventPayload);

    try {
      // Stop health check timer
      this.stopHealthCheck();

      // Cancel all active tasks
      const cancelPromises = Array.from(this.activeTasks.keys()).map((taskId) =>
        this.cancelTask(taskId).catch(() => false)
      );
      await Promise.all(cancelPromises);

      // Wait for shutdown timeout
      if (this.config.shutdownTimeout > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.config.shutdownTimeout));
      }

      this.status = A2AServerStatus.STOPPED;
      this.startedAt = null;

      this.emit(A2AServerEvents.SERVER_STOPPED, {} as ServerEventPayload);
    } catch (error) {
      this.status = A2AServerStatus.ERROR;
      const a2aError: A2AError = {
        code: 'SERVER_STOP_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
      this.emit(A2AServerEvents.SERVER_ERROR, { error: a2aError } as ServerEventPayload);
      throw error;
    }
  }

  getStatus(): A2AServerStatus {
    return this.status;
  }

  isRunning(): boolean {
    return this.status === A2AServerStatus.RUNNING;
  }

  // === Agent Registration ===

  registerAgent(agent: IAgent, cardOverrides: Partial<AgentCard> = {}): void {
    if (this.registeredAgents.has(agent.id)) {
      throw new Error(`Agent with ID ${agent.id} is already registered`);
    }

    // Build agent card from agent metadata
    const card = this.buildAgentCard(agent, cardOverrides);

    const registeredAgent: RegisteredAgent = {
      agent,
      card,
      registeredAt: new Date(),
      activeTasks: 0,
    };

    this.registeredAgents.set(agent.id, registeredAgent);

    this.emit(A2AServerEvents.AGENT_REGISTERED, {
      agentId: agent.id,
      agentType: agent.type,
      card,
    } as AgentEventPayload);
  }

  unregisterAgent(agentId: string): boolean {
    const registeredAgent = this.registeredAgents.get(agentId);
    if (!registeredAgent) {
      return false;
    }

    // Cancel all active tasks for this agent
    for (const [taskId, activeTask] of Array.from(this.activeTasks.entries())) {
      if (activeTask.agentId === agentId) {
        this.cancelTask(taskId).catch(() => {});
      }
    }

    this.registeredAgents.delete(agentId);

    this.emit(A2AServerEvents.AGENT_UNREGISTERED, {
      agentId,
      agentType: registeredAgent.agent.type,
    } as AgentEventPayload);

    return true;
  }

  getAgentCard(agentId: string): AgentCard | undefined {
    const registeredAgent = this.registeredAgents.get(agentId);
    if (!registeredAgent) {
      return undefined;
    }

    this.emit(A2AServerEvents.AGENT_CARD_REQUESTED, {
      agentId,
      card: registeredAgent.card,
    } as AgentEventPayload);

    return registeredAgent.card;
  }

  getAllAgentCards(): AgentCard[] {
    return Array.from(this.registeredAgents.values()).map((r) => r.card);
  }

  findAgentsByCapability(capabilityName: string): AgentCard[] {
    const results: AgentCard[] = [];

    for (const registeredAgent of Array.from(this.registeredAgents.values())) {
      const hasCapability = registeredAgent.card.capabilities.some(
        (c) => c.name === capabilityName
      );
      if (hasCapability) {
        results.push(registeredAgent.card);
      }
    }

    return results;
  }

  // === Task Handling ===

  async handleTask(task: A2ATask): Promise<A2ATaskResult> {
    const startTime = Date.now();
    this.totalRequestCount++;

    // Validate task
    const validatedTask = A2ATaskSchema.parse(task);

    this.emit(A2AServerEvents.TASK_RECEIVED, {
      taskId: validatedTask.id,
    } as TaskEventPayload);

    // Check concurrent task limit
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      const error: A2AError = {
        code: 'MAX_CONCURRENT_TASKS',
        message: 'Maximum concurrent tasks limit reached',
      };
      this.failedTaskCount++;
      return this.createErrorResult(validatedTask.id, error);
    }

    // Find suitable agent
    const agent = this.findSuitableAgent(validatedTask);
    if (!agent) {
      const error: A2AError = {
        code: 'NO_SUITABLE_AGENT',
        message: 'No suitable agent found to handle this task',
      };
      this.failedTaskCount++;
      return this.createErrorResult(validatedTask.id, error);
    }

    // Create active task
    const activeTask: ActiveTask = {
      task: validatedTask,
      agentId: agent.id,
      status: A2ATaskStatus.WORKING,
      startedAt: new Date(),
      lastUpdateAt: new Date(),
      subscribers: new Set(),
    };
    this.activeTasks.set(validatedTask.id, activeTask);

    // Update registered agent
    const registeredAgent = this.registeredAgents.get(agent.id)!;
    registeredAgent.activeTasks++;

    this.emit(A2AServerEvents.TASK_STARTED, {
      taskId: validatedTask.id,
      agentId: agent.id,
      status: A2ATaskStatus.WORKING,
    } as TaskEventPayload);

    try {
      // Execute task with timeout
      const result = await this.executeTaskWithTimeout(validatedTask, agent);

      const endTime = Date.now();
      this.totalResponseTime += endTime - startTime;
      this.completedTaskCount++;

      // Clean up
      this.activeTasks.delete(validatedTask.id);
      registeredAgent.activeTasks--;

      this.emit(A2AServerEvents.TASK_COMPLETED, {
        taskId: validatedTask.id,
        agentId: agent.id,
        status: A2ATaskStatus.COMPLETED,
        result,
      } as TaskEventPayload);

      return result;
    } catch (error) {
      const endTime = Date.now();
      this.totalResponseTime += endTime - startTime;
      this.failedTaskCount++;

      // Clean up
      this.activeTasks.delete(validatedTask.id);
      registeredAgent.activeTasks--;

      const a2aError: A2AError = {
        code: 'TASK_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      };

      this.emit(A2AServerEvents.TASK_FAILED, {
        taskId: validatedTask.id,
        agentId: agent.id,
        status: A2ATaskStatus.FAILED,
        error: a2aError,
      } as TaskEventPayload);

      return this.createErrorResult(validatedTask.id, a2aError, agent.id);
    }
  }

  async *handleTaskStream(
    task: A2ATask
  ): AsyncGenerator<A2ATaskUpdate, A2ATaskResult, undefined> {
    const startTime = Date.now();
    this.totalRequestCount++;

    // Validate task
    const validatedTask = A2ATaskSchema.parse(task);

    this.emit(A2AServerEvents.TASK_RECEIVED, {
      taskId: validatedTask.id,
    } as TaskEventPayload);

    // Check streaming support
    if (!this.config.enableStreaming) {
      const error: A2AError = {
        code: 'STREAMING_NOT_ENABLED',
        message: 'Streaming is not enabled on this server',
      };
      this.failedTaskCount++;
      return this.createErrorResult(validatedTask.id, error);
    }

    // Check concurrent task limit
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      const error: A2AError = {
        code: 'MAX_CONCURRENT_TASKS',
        message: 'Maximum concurrent tasks limit reached',
      };
      this.failedTaskCount++;
      return this.createErrorResult(validatedTask.id, error);
    }

    // Find suitable agent
    const agent = this.findSuitableAgent(validatedTask);
    if (!agent) {
      const error: A2AError = {
        code: 'NO_SUITABLE_AGENT',
        message: 'No suitable agent found to handle this task',
      };
      this.failedTaskCount++;
      return this.createErrorResult(validatedTask.id, error);
    }

    // Create active task
    const activeTask: ActiveTask = {
      task: validatedTask,
      agentId: agent.id,
      status: A2ATaskStatus.WORKING,
      startedAt: new Date(),
      lastUpdateAt: new Date(),
      subscribers: new Set(),
    };
    this.activeTasks.set(validatedTask.id, activeTask);

    // Update registered agent
    const registeredAgent = this.registeredAgents.get(agent.id)!;
    registeredAgent.activeTasks++;

    this.emit(A2AServerEvents.TASK_STREAM_STARTED, {
      taskId: validatedTask.id,
      agentId: agent.id,
    } as TaskEventPayload);

    try {
      // Yield initial status update
      yield {
        taskId: validatedTask.id,
        status: A2ATaskStatus.WORKING,
        progress: 0,
      };

      // Execute task and yield updates
      const result = await this.executeTaskWithStreaming(
        validatedTask,
        agent,
        async (update) => {
          activeTask.lastUpdateAt = new Date();
          activeTask.status = update.status;

          this.emit(A2AServerEvents.TASK_STREAM_CHUNK, {
            taskId: validatedTask.id,
            update,
          } as TaskEventPayload);

          // Notify subscribers
          for (const subscriber of Array.from(activeTask.subscribers)) {
            subscriber(update);
          }
        }
      );

      const endTime = Date.now();
      this.totalResponseTime += endTime - startTime;
      this.completedTaskCount++;

      // Clean up
      this.activeTasks.delete(validatedTask.id);
      registeredAgent.activeTasks--;

      // Yield final update
      yield {
        taskId: validatedTask.id,
        status: A2ATaskStatus.COMPLETED,
        progress: 100,
      };

      this.emit(A2AServerEvents.TASK_STREAM_ENDED, {
        taskId: validatedTask.id,
        status: A2ATaskStatus.COMPLETED,
        result,
      } as TaskEventPayload);

      return result;
    } catch (error) {
      const endTime = Date.now();
      this.totalResponseTime += endTime - startTime;
      this.failedTaskCount++;

      // Clean up
      this.activeTasks.delete(validatedTask.id);
      registeredAgent.activeTasks--;

      const a2aError: A2AError = {
        code: 'TASK_EXECUTION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      };

      // Yield error update
      yield {
        taskId: validatedTask.id,
        status: A2ATaskStatus.FAILED,
      };

      this.emit(A2AServerEvents.TASK_STREAM_ENDED, {
        taskId: validatedTask.id,
        status: A2ATaskStatus.FAILED,
        error: a2aError,
      } as TaskEventPayload);

      return this.createErrorResult(validatedTask.id, a2aError, agent.id);
    }
  }

  getTaskStatus(taskId: string): A2ATaskStatus | undefined {
    return this.activeTasks.get(taskId)?.status;
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const activeTask = this.activeTasks.get(taskId);
    if (!activeTask) {
      return false;
    }

    activeTask.status = A2ATaskStatus.CANCELLED;

    // Update registered agent
    const registeredAgent = this.registeredAgents.get(activeTask.agentId);
    if (registeredAgent) {
      registeredAgent.activeTasks--;
    }

    this.activeTasks.delete(taskId);

    this.emit(A2AServerEvents.TASK_CANCELLED, {
      taskId,
      agentId: activeTask.agentId,
      status: A2ATaskStatus.CANCELLED,
    } as TaskEventPayload);

    return true;
  }

  getActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values());
  }

  // === Statistics ===

  getStats(): A2AServerStats {
    return {
      status: this.status,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      registeredAgents: this.registeredAgents.size,
      activeTasks: this.activeTasks.size,
      completedTasks: this.completedTaskCount,
      failedTasks: this.failedTaskCount,
      totalRequests: this.totalRequestCount,
      averageResponseTime:
        this.totalRequestCount > 0
          ? this.totalResponseTime / this.totalRequestCount
          : 0,
    };
  }

  // === Configuration ===

  getConfig(): A2AServerConfig {
    return { ...this.config };
  }

  // === Private Methods ===

  private buildAgentCard(agent: IAgent, overrides: Partial<AgentCard>): AgentCard {
    const capabilities = agent.getCapabilities();
    const serverUrl = `http://${this.config.host}:${this.config.port}${this.config.basePath}`;

    const a2aCapabilities: A2ACapability[] = capabilities.map((cap: AgentCapability) => ({
      name: cap.name,
      description: cap.description,
      inputSchema: cap.inputSchema,
      outputSchema: cap.outputSchema,
    }));

    const card: AgentCard = {
      name: agent.name,
      description: `${agent.type} agent - ${agent.name}`,
      url: `${serverUrl}/agents/${agent.id}`,
      version: agent.version,
      capabilities: a2aCapabilities,
      skills: [],
      defaultInputModes: [A2AContentMode.TEXT],
      defaultOutputModes: [A2AContentMode.TEXT],
      supportsStreaming: this.config.enableStreaming,
      supportsPushNotifications: this.config.enablePushNotifications,
      ...overrides,
    };

    return AgentCardSchema.parse(card);
  }

  private findSuitableAgent(task: A2ATask): IAgent | undefined {
    // Check for required capabilities
    const requiredCapabilities = task.constraints?.requiredCapabilities || [];

    // Find agents that can handle the task
    const suitableAgents: Array<{ agent: IAgent; score: number }> = [];

    for (const registeredAgent of Array.from(this.registeredAgents.values())) {
      const { agent, card, activeTasks } = registeredAgent;

      // Check max concurrent tasks
      if (card.maxConcurrentTasks && activeTasks >= card.maxConcurrentTasks) {
        continue;
      }

      // Check required capabilities
      const hasAllCapabilities = requiredCapabilities.every((reqCap) =>
        card.capabilities.some((cap) => cap.name === reqCap)
      );

      if (!hasAllCapabilities) {
        continue;
      }

      // Calculate score (lower is better)
      const score = activeTasks;
      suitableAgents.push({ agent, score });
    }

    // Sort by score and return best agent
    suitableAgents.sort((a, b) => a.score - b.score);
    return suitableAgents[0]?.agent;
  }

  private async executeTaskWithTimeout(task: A2ATask, agent: IAgent): Promise<A2ATaskResult> {
    const timeout = task.constraints?.timeout || this.config.taskTimeout;
    const startedAt = new Date();

    return new Promise<A2ATaskResult>(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Convert A2A task to agent task format
        const agentTask = this.convertToAgentTask(task, agent);
        const result = await agent.processTask(agentTask);

        clearTimeout(timeoutId);

        const completedAt = new Date();
        const a2aResult: A2ATaskResult = {
          taskId: task.id,
          status: result.success ? A2ATaskStatus.COMPLETED : A2ATaskStatus.FAILED,
          message: {
            role: 'agent',
            content: result.data?.response as string || '',
          },
          artifacts: this.extractArtifacts(result.data),
          error: result.error
            ? {
                code: result.error.code,
                message: result.error.message,
                details: result.error.details,
              }
            : undefined,
          metadata: {
            agentId: agent.id,
            startedAt,
            completedAt,
            duration: completedAt.getTime() - startedAt.getTime(),
            tokensUsed: result.metadata?.tokensUsed,
          },
        };

        resolve(a2aResult);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  private async executeTaskWithStreaming(
    task: A2ATask,
    agent: IAgent,
    onUpdate: (update: A2ATaskUpdate) => Promise<void>
  ): Promise<A2ATaskResult> {
    const startedAt = new Date();

    // Convert A2A task to agent task format
    const agentTask = this.convertToAgentTask(task, agent);

    // Simulate progress updates
    let progress = 0;
    const progressInterval = setInterval(async () => {
      progress = Math.min(progress + 10, 90);
      await onUpdate({
        taskId: task.id,
        status: A2ATaskStatus.WORKING,
        progress,
      });
    }, 1000);

    try {
      const result = await agent.processTask(agentTask);
      clearInterval(progressInterval);

      const completedAt = new Date();
      const a2aResult: A2ATaskResult = {
        taskId: task.id,
        status: result.success ? A2ATaskStatus.COMPLETED : A2ATaskStatus.FAILED,
        message: {
          role: 'agent',
          content: result.data?.response as string || '',
        },
        artifacts: this.extractArtifacts(result.data),
        error: result.error
          ? {
              code: result.error.code,
              message: result.error.message,
              details: result.error.details,
            }
          : undefined,
        metadata: {
          agentId: agent.id,
          startedAt,
          completedAt,
          duration: completedAt.getTime() - startedAt.getTime(),
          tokensUsed: result.metadata?.tokensUsed,
        },
      };

      return a2aResult;
    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  private convertToAgentTask(
    a2aTask: A2ATask,
    agent: IAgent
  ): import('../interfaces/agent.interface').ITask {
    return {
      id: a2aTask.id,
      type: 'a2a_task',
      agentType: agent.type,
      priority: this.convertPriority(a2aTask.constraints?.priority),
      payload: {
        message: a2aTask.message,
        context: a2aTask.context,
        constraints: a2aTask.constraints,
      },
      metadata: {
        requestId: a2aTask.sessionId,
        parentTaskId: a2aTask.context?.parentTaskId,
        timeout: a2aTask.constraints?.timeout,
        tags: ['a2a'],
      },
      createdAt: new Date(),
    };
  }

  private convertPriority(
    priority?: 'low' | 'normal' | 'high' | 'urgent'
  ): import('../interfaces/agent.interface').TaskPriority {
    // Import TaskPriority values directly
    const TaskPriority = {
      LOW: 0,
      NORMAL: 1,
      HIGH: 2,
      URGENT: 3,
    } as const;

    switch (priority) {
      case 'low':
        return TaskPriority.LOW;
      case 'high':
        return TaskPriority.HIGH;
      case 'urgent':
        return TaskPriority.URGENT;
      default:
        return TaskPriority.NORMAL;
    }
  }

  private extractArtifacts(data?: Record<string, unknown>): A2AArtifact[] | undefined {
    if (!data || !data.artifacts) {
      return undefined;
    }

    const artifacts = data.artifacts as Array<{
      id: string;
      name: string;
      type: string;
      content: string;
    }>;

    return artifacts.map((artifact, index) => ({
      id: artifact.id || `artifact-${index}`,
      name: artifact.name,
      mimeType: artifact.type || 'text/plain',
      parts: [
        {
          type: 'text' as const,
          content: artifact.content,
        },
      ],
    }));
  }

  private createErrorResult(
    taskId: string,
    error: A2AError,
    agentId?: string
  ): A2ATaskResult {
    const now = new Date();
    return {
      taskId,
      status: A2ATaskStatus.FAILED,
      error,
      metadata: {
        agentId: agentId || 'unknown',
        startedAt: now,
        completedAt: now,
        duration: 0,
      },
    };
  }

  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  private performHealthCheck(): void {
    const stats = this.getStats();

    // Check agent health
    for (const registeredAgent of Array.from(this.registeredAgents.values())) {
      const health = registeredAgent.agent.getHealth();
      if (!health.healthy) {
        // Could emit warning event here
      }
    }

    this.emit(A2AServerEvents.HEALTH_CHECK, { stats });
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new A2A Server with validated configuration
 */
export function createA2AServer(config: Partial<A2AServerConfig> = {}): A2AServer {
  return new A2AServer(config);
}

/**
 * Validate A2A Task
 */
export function validateA2ATask(task: unknown): A2ATask {
  return A2ATaskSchema.parse(task);
}

/**
 * Validate Agent Card
 */
export function validateAgentCard(card: unknown): AgentCard {
  return AgentCardSchema.parse(card);
}
