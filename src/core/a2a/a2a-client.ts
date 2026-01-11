/**
 * A2A Protocol Client
 *
 * Client for connecting to external A2A-compatible agents.
 * Supports agent discovery, task delegation, and streaming.
 *
 * @module core/a2a/a2a-client
 *
 * @example
 * ```typescript
 * import { createA2AClient } from '@core/a2a';
 *
 * const client = createA2AClient();
 *
 * // Connect to remote A2A server
 * await client.connect('http://localhost:3000/a2a');
 *
 * // Discover available agents
 * const agents = await client.discoverAgents();
 *
 * // Delegate task to specific agent
 * const result = await client.delegateTask('agent-1', {
 *   id: 'task-1',
 *   message: { role: 'user', content: 'Generate code' },
 * });
 * ```
 */

import { z } from 'zod';
import { EventEmitter } from 'events';
import {
  AgentCard,
  AgentCardSchema,
  A2ATask,
  A2ATaskResult,
  A2ATaskUpdate,
  A2ATaskSchema,
  A2ATaskResultSchema,
  A2ATaskUpdateSchema,
  A2AServerStats,
} from './a2a-server';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcResponseSchema,
  A2AMethods,
} from './a2a-transport';

// ============================================================================
// Enums
// ============================================================================

/**
 * A2A Client connection status
 */
export enum A2AClientStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// ============================================================================
// Configuration Schema
// ============================================================================

/**
 * Retry configuration schema
 */
const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().min(0).default(3),
  baseDelay: z.number().int().min(100).default(1000),
  maxDelay: z.number().int().min(1000).default(30000),
  backoffMultiplier: z.number().min(1).default(2),
});

/**
 * Keep-alive configuration schema
 */
const KeepAliveConfigSchema = z.object({
  enabled: z.boolean().default(true),
  interval: z.number().int().min(5000).default(30000),
});

/**
 * A2A Client configuration schema
 */
export const A2AClientConfigSchema = z
  .object({
    /** Request timeout in milliseconds */
    timeout: z.number().int().min(1000).default(30000),

    /** Retry configuration */
    retry: z.preprocess(
      (val) => val ?? {},
      RetryConfigSchema
    ),

    /** Keep-alive configuration */
    keepAlive: z.preprocess(
      (val) => val ?? {},
      KeepAliveConfigSchema
    ),

    /** Authentication */
    authentication: z
      .object({
        type: z.enum(['api_key', 'bearer_token', 'none']).default('none'),
        credentials: z
          .object({
            apiKey: z.string().optional(),
            token: z.string().optional(),
          })
          .optional(),
      })
      .optional(),

    /** Auto-reconnect on disconnect */
    autoReconnect: z.boolean().default(true),

    /** Maximum reconnection attempts */
    maxReconnectAttempts: z.number().int().min(0).default(5),
  })
  .transform((config) => ({
    ...config,
    retry: RetryConfigSchema.parse(config.retry),
    keepAlive: KeepAliveConfigSchema.parse(config.keepAlive),
  }));

export type A2AClientConfig = z.infer<typeof A2AClientConfigSchema>;

/**
 * A2A Client configuration input type (allows partial nested objects)
 */
export type A2AClientConfigInput = z.input<typeof A2AClientConfigSchema>;

// ============================================================================
// Types
// ============================================================================

/**
 * Connection options
 */
export interface ConnectionOptions {
  /** Custom headers */
  headers?: Record<string, string>;
  /** Override default timeout */
  timeout?: number;
}

/**
 * Task delegation options
 */
export interface DelegationOptions {
  /** Request timeout */
  timeout?: number;
  /** Priority hint */
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Metadata to include */
  metadata?: Record<string, unknown>;
}

/**
 * Collaboration result
 */
export interface A2ACollaborationResult {
  taskId: string;
  participants: string[];
  results: Map<string, A2ATaskResult>;
  aggregatedOutput?: unknown;
  duration: number;
  success: boolean;
}

/**
 * Server info response
 */
export interface A2AServerInfo {
  version: string;
  protocol: string;
  status: string;
  host: string;
  port: number;
  basePath?: string;
  streaming: boolean;
  pushNotifications: boolean;
}

/**
 * Client event types
 */
export const A2AClientEvents = {
  CONNECTED: 'a2a:client:connected',
  DISCONNECTED: 'a2a:client:disconnected',
  RECONNECTING: 'a2a:client:reconnecting',
  RECONNECTED: 'a2a:client:reconnected',
  ERROR: 'a2a:client:error',
  TASK_STARTED: 'a2a:client:task:started',
  TASK_UPDATE: 'a2a:client:task:update',
  TASK_COMPLETED: 'a2a:client:task:completed',
  TASK_FAILED: 'a2a:client:task:failed',
} as const;

export type A2AClientEventType = (typeof A2AClientEvents)[keyof typeof A2AClientEvents];

// ============================================================================
// Interface
// ============================================================================

/**
 * A2A Client interface
 */
export interface IA2AClient {
  // Connection management
  connect(url: string, options?: ConnectionOptions): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getStatus(): A2AClientStatus;

  // Agent discovery
  discoverAgents(): Promise<AgentCard[]>;
  getAgentCard(agentId: string): Promise<AgentCard>;
  findAgentsByCapability(capability: string): Promise<AgentCard[]>;

  // Task delegation
  delegateTask(agentId: string, task: A2ATask, options?: DelegationOptions): Promise<A2ATaskResult>;
  delegateTaskStream(
    agentId: string,
    task: A2ATask,
    options?: DelegationOptions
  ): AsyncGenerator<A2ATaskUpdate, A2ATaskResult, undefined>;

  // Task management
  getTaskStatus(taskId: string): Promise<{ taskId: string; status: string }>;
  cancelTask(taskId: string): Promise<boolean>;

  // Server info
  getServerInfo(): Promise<A2AServerInfo>;
  getServerStats(): Promise<A2AServerStats>;

  // Collaboration
  collaborate(
    agentIds: string[],
    task: A2ATask,
    options?: DelegationOptions
  ): Promise<A2ACollaborationResult>;

  // Events
  on(event: A2AClientEventType, handler: (payload: unknown) => void): void;
  off(event: A2AClientEventType, handler: (payload: unknown) => void): void;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * A2A Protocol Client
 *
 * Connects to external A2A-compatible agents for task delegation and collaboration.
 */
export class A2AClient extends EventEmitter implements IA2AClient {
  private config: A2AClientConfig;
  private status: A2AClientStatus = A2AClientStatus.DISCONNECTED;
  private serverUrl: string | null = null;
  private connectionOptions: ConnectionOptions = {};
  private reconnectAttempts = 0;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private requestId = 0;

  constructor(config: A2AClientConfigInput = {}) {
    super();
    this.config = A2AClientConfigSchema.parse(config);
  }

  // === Connection Management ===

  async connect(url: string, options: ConnectionOptions = {}): Promise<void> {
    if (this.status === A2AClientStatus.CONNECTED) {
      throw new Error('Client is already connected');
    }

    this.status = A2AClientStatus.CONNECTING;
    this.serverUrl = url.replace(/\/$/, ''); // Remove trailing slash
    this.connectionOptions = options;

    try {
      // Verify connection by fetching server info
      await this.getServerInfo();

      this.status = A2AClientStatus.CONNECTED;
      this.reconnectAttempts = 0;

      // Start keep-alive if enabled
      if (this.config.keepAlive.enabled) {
        this.startKeepAlive();
      }

      this.emit(A2AClientEvents.CONNECTED, {
        url: this.serverUrl,
        timestamp: new Date(),
      });
    } catch (error) {
      this.status = A2AClientStatus.ERROR;
      this.emit(A2AClientEvents.ERROR, {
        error: error instanceof Error ? error.message : 'Connection failed',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.status === A2AClientStatus.DISCONNECTED) {
      return;
    }

    this.stopKeepAlive();
    this.status = A2AClientStatus.DISCONNECTED;
    this.serverUrl = null;
    this.connectionOptions = {};

    this.emit(A2AClientEvents.DISCONNECTED, {
      timestamp: new Date(),
    });
  }

  isConnected(): boolean {
    return this.status === A2AClientStatus.CONNECTED;
  }

  getStatus(): A2AClientStatus {
    return this.status;
  }

  // === Agent Discovery ===

  async discoverAgents(): Promise<AgentCard[]> {
    this.ensureConnected();

    const response = await this.sendRestRequest<{ agents: unknown[] }>('GET', '/agents');
    return response.agents.map((agent) => AgentCardSchema.parse(agent));
  }

  async getAgentCard(agentId: string): Promise<AgentCard> {
    this.ensureConnected();

    const response = await this.sendRestRequest<unknown>('GET', `/agents/${agentId}`);
    return AgentCardSchema.parse(response);
  }

  async findAgentsByCapability(capability: string): Promise<AgentCard[]> {
    this.ensureConnected();

    const result = await this.sendRpcRequest<unknown[]>(A2AMethods.FIND_AGENTS, {
      capability,
    });

    return result.map((agent) => AgentCardSchema.parse(agent));
  }

  // === Task Delegation ===

  async delegateTask(
    agentId: string,
    task: A2ATask,
    options: DelegationOptions = {}
  ): Promise<A2ATaskResult> {
    this.ensureConnected();

    // Validate task
    const validatedTask = A2ATaskSchema.parse(task);

    // Add target agent to task metadata
    const taskWithTarget = {
      ...validatedTask,
      metadata: {
        ...validatedTask.metadata,
        targetAgentId: agentId,
        priority: options.priority || 'normal',
        ...options.metadata,
      },
    };

    this.emit(A2AClientEvents.TASK_STARTED, {
      taskId: validatedTask.id,
      agentId,
      timestamp: new Date(),
    });

    try {
      const response = await this.sendRestRequest<unknown>(
        'POST',
        '/tasks',
        taskWithTarget,
        options.timeout
      );

      const result = A2ATaskResultSchema.parse(response);

      this.emit(A2AClientEvents.TASK_COMPLETED, {
        taskId: validatedTask.id,
        agentId,
        result,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      this.emit(A2AClientEvents.TASK_FAILED, {
        taskId: validatedTask.id,
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  async *delegateTaskStream(
    agentId: string,
    task: A2ATask,
    options: DelegationOptions = {}
  ): AsyncGenerator<A2ATaskUpdate, A2ATaskResult, undefined> {
    this.ensureConnected();

    const validatedTask = A2ATaskSchema.parse(task);
    const taskWithTarget = {
      ...validatedTask,
      metadata: {
        ...validatedTask.metadata,
        targetAgentId: agentId,
        priority: options.priority || 'normal',
        ...options.metadata,
      },
    };

    this.emit(A2AClientEvents.TASK_STARTED, {
      taskId: validatedTask.id,
      agentId,
      streaming: true,
      timestamp: new Date(),
    });

    try {
      const response = await this.sendStreamRequest('/tasks/stream', taskWithTarget);

      for await (const event of response) {
        if (event.type === 'update') {
          const update = A2ATaskUpdateSchema.parse(event.data);
          this.emit(A2AClientEvents.TASK_UPDATE, {
            taskId: validatedTask.id,
            agentId,
            update,
            timestamp: new Date(),
          });
          yield update;
        } else if (event.type === 'result') {
          const result = A2ATaskResultSchema.parse(event.data);
          this.emit(A2AClientEvents.TASK_COMPLETED, {
            taskId: validatedTask.id,
            agentId,
            result,
            timestamp: new Date(),
          });
          return result;
        } else if (event.type === 'error') {
          const errorData = event.data as { message?: string } | undefined;
          throw new Error(errorData?.message || 'Stream error');
        }
      }

      throw new Error('Stream ended without result');
    } catch (error) {
      this.emit(A2AClientEvents.TASK_FAILED, {
        taskId: validatedTask.id,
        agentId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });
      throw error;
    }
  }

  // === Task Management ===

  async getTaskStatus(taskId: string): Promise<{ taskId: string; status: string }> {
    this.ensureConnected();

    return this.sendRestRequest<{ taskId: string; status: string }>(
      'GET',
      `/tasks/${taskId}/status`
    );
  }

  async cancelTask(taskId: string): Promise<boolean> {
    this.ensureConnected();

    const response = await this.sendRestRequest<{ taskId: string; cancelled: boolean }>(
      'DELETE',
      `/tasks/${taskId}`
    );

    return response.cancelled;
  }

  // === Server Info ===

  async getServerInfo(): Promise<A2AServerInfo> {
    // Can be called before fully connected (for connection verification)
    if (!this.serverUrl) {
      throw new Error('Server URL not set');
    }

    return this.sendRestRequest<A2AServerInfo>('GET', '/info');
  }

  async getServerStats(): Promise<A2AServerStats> {
    this.ensureConnected();

    return this.sendRestRequest<A2AServerStats>('GET', '/stats');
  }

  // === Collaboration ===

  async collaborate(
    agentIds: string[],
    task: A2ATask,
    options: DelegationOptions = {}
  ): Promise<A2ACollaborationResult> {
    this.ensureConnected();

    if (agentIds.length === 0) {
      throw new Error('At least one agent ID is required for collaboration');
    }

    const startTime = Date.now();
    const results = new Map<string, A2ATaskResult>();
    const errors: Array<{ agentId: string; error: string }> = [];

    // Delegate task to all agents in parallel
    const promises = agentIds.map(async (agentId) => {
      try {
        const result = await this.delegateTask(agentId, task, options);
        results.set(agentId, result);
      } catch (error) {
        errors.push({
          agentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    const success = errors.length === 0;

    // Aggregate outputs from successful results
    const outputs = Array.from(results.values())
      .filter((r) => r.status === 'completed')
      .map((r) => r.artifacts || [])
      .flat();

    return {
      taskId: task.id,
      participants: agentIds,
      results,
      aggregatedOutput: outputs.length > 0 ? outputs : undefined,
      duration,
      success,
    };
  }

  // === Configuration ===

  getConfig(): A2AClientConfig {
    return { ...this.config };
  }

  getServerUrl(): string | null {
    return this.serverUrl;
  }

  // === Private Methods ===

  private ensureConnected(): void {
    if (this.status !== A2AClientStatus.CONNECTED) {
      throw new Error(`Client is not connected (status: ${this.status})`);
    }
  }

  private async sendRestRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    timeout?: number
  ): Promise<T> {
    if (!this.serverUrl) {
      throw new Error('Server URL not set');
    }

    const url = `${this.serverUrl}${path}`;
    const requestTimeout = timeout || this.config.timeout;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.connectionOptions.headers,
      ...this.getAuthHeaders(),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${requestTimeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async sendRpcRequest<T>(method: string, params?: unknown): Promise<T> {
    if (!this.serverUrl) {
      throw new Error('Server URL not set');
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++this.requestId,
      method,
      params,
    };

    const response = await this.sendRestRequest<JsonRpcResponse>('POST', '/rpc', request);

    const validatedResponse = JsonRpcResponseSchema.parse(response);

    if (validatedResponse.error) {
      throw new Error(
        `RPC Error ${validatedResponse.error.code}: ${validatedResponse.error.message}`
      );
    }

    return validatedResponse.result as T;
  }

  private async *sendStreamRequest(
    path: string,
    body: unknown
  ): AsyncGenerator<{ type: string; data: unknown }, void, undefined> {
    if (!this.serverUrl) {
      throw new Error('Server URL not set');
    }

    const url = `${this.serverUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...this.connectionOptions.headers,
      ...this.getAuthHeaders(),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim();
            const dataLine = lines[lines.indexOf(line) + 1];
            if (dataLine?.startsWith('data:')) {
              const data = JSON.parse(dataLine.slice(5).trim());
              yield { type: eventType, data };
            }
          } else if (line.startsWith('data:')) {
            const data = JSON.parse(line.slice(5).trim());
            yield { type: 'data', data };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.config.authentication || this.config.authentication.type === 'none') {
      return {};
    }

    const { type, credentials } = this.config.authentication;

    switch (type) {
      case 'api_key':
        return credentials?.apiKey ? { Authorization: credentials.apiKey } : {};
      case 'bearer_token':
        return credentials?.token ? { Authorization: `Bearer ${credentials.token}` } : {};
      default:
        return {};
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();

    this.keepAliveTimer = setInterval(async () => {
      try {
        await this.getServerInfo();
      } catch {
        this.handleConnectionLoss();
      }
    }, this.config.keepAlive.interval);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private async handleConnectionLoss(): Promise<void> {
    if (!this.config.autoReconnect) {
      this.status = A2AClientStatus.DISCONNECTED;
      this.emit(A2AClientEvents.DISCONNECTED, {
        reason: 'connection_lost',
        timestamp: new Date(),
      });
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.status = A2AClientStatus.ERROR;
      this.emit(A2AClientEvents.ERROR, {
        error: 'Max reconnection attempts reached',
        timestamp: new Date(),
      });
      return;
    }

    this.status = A2AClientStatus.RECONNECTING;
    this.reconnectAttempts++;

    this.emit(A2AClientEvents.RECONNECTING, {
      attempt: this.reconnectAttempts,
      maxAttempts: this.config.maxReconnectAttempts,
      timestamp: new Date(),
    });

    const delay = Math.min(
      this.config.retry.baseDelay * Math.pow(this.config.retry.backoffMultiplier, this.reconnectAttempts - 1),
      this.config.retry.maxDelay
    );

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      if (this.serverUrl) {
        await this.connect(this.serverUrl, this.connectionOptions);
        this.emit(A2AClientEvents.RECONNECTED, {
          attempt: this.reconnectAttempts,
          timestamp: new Date(),
        });
      }
    } catch {
      await this.handleConnectionLoss();
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new A2A Client
 */
export function createA2AClient(config: A2AClientConfigInput = {}): A2AClient {
  return new A2AClient(config);
}
