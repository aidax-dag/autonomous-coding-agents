/**
 * A2A Transport Layer
 *
 * Provides HTTP/JSON-RPC transport for the A2A protocol.
 * Can be used with any HTTP server framework (Express, Fastify, etc.)
 *
 * @module core/a2a/a2a-transport
 *
 * @example
 * ```typescript
 * import { A2ATransport, createA2ATransport } from '@core/a2a';
 *
 * const transport = createA2ATransport(server);
 *
 * // Handle requests
 * const response = await transport.handleRequest(request);
 * ```
 */

import { z } from 'zod';
import {
  IA2AServer,
  A2ATaskSchema,
} from './a2a-server';

// ============================================================================
// JSON-RPC Types
// ============================================================================

/**
 * JSON-RPC request schema
 */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional(),
});

/**
 * JSON-RPC error schema
 */
export const JsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});

/**
 * JSON-RPC response schema
 */
export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).nullable(),
  result: z.unknown().optional(),
  error: JsonRpcErrorSchema.optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// ============================================================================
// Error Codes
// ============================================================================

/**
 * JSON-RPC standard error codes
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // A2A specific error codes (application errors)
  TASK_NOT_FOUND: -32000,
  AGENT_NOT_FOUND: -32001,
  TASK_CANCELLED: -32002,
  TASK_TIMEOUT: -32003,
  MAX_CONCURRENT_TASKS: -32004,
  STREAMING_NOT_ENABLED: -32005,
  SERVER_NOT_RUNNING: -32006,
} as const;

// ============================================================================
// A2A Methods
// ============================================================================

/**
 * A2A JSON-RPC methods
 */
export const A2AMethods = {
  // Discovery
  GET_AGENT_CARD: 'agent.getCard',
  LIST_AGENTS: 'agent.list',
  FIND_AGENTS: 'agent.find',

  // Task handling
  SEND_TASK: 'task.send',
  SEND_TASK_STREAM: 'task.send/subscribe',
  GET_TASK_STATUS: 'task.getStatus',
  CANCEL_TASK: 'task.cancel',

  // Server info
  GET_SERVER_INFO: 'server.info',
  GET_SERVER_STATS: 'server.stats',
} as const;

export type A2AMethod = (typeof A2AMethods)[keyof typeof A2AMethods];

// ============================================================================
// HTTP Request/Response Types
// ============================================================================

/**
 * HTTP request wrapper
 */
export interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * HTTP response wrapper
 */
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Stream event for SSE
 */
export interface StreamEvent {
  event: string;
  data: string;
  id?: string;
}

// ============================================================================
// Transport Interface
// ============================================================================

/**
 * A2A Transport interface
 */
export interface IA2ATransport {
  /**
   * Handle HTTP request
   */
  handleRequest(request: HttpRequest): Promise<HttpResponse>;

  /**
   * Handle streaming request (SSE)
   */
  handleStreamRequest(
    request: HttpRequest
  ): AsyncGenerator<StreamEvent, void, undefined>;

  /**
   * Validate authentication
   */
  validateAuth(request: HttpRequest): Promise<boolean>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * A2A Transport Layer
 *
 * Provides HTTP/JSON-RPC transport for A2A protocol
 */
export class A2ATransport implements IA2ATransport {
  private readonly server: IA2AServer;

  constructor(server: IA2AServer) {
    this.server = server;
  }

  async handleRequest(request: HttpRequest): Promise<HttpResponse> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return this.createCorsResponse();
    }

    // Route based on path
    const path = request.path.replace(/\/$/, ''); // Remove trailing slash

    try {
      // REST-style endpoints
      if (request.method === 'GET') {
        if (path.endsWith('/agents')) {
          return this.handleListAgents();
        }
        if (path.match(/\/agents\/[^/]+$/)) {
          const agentId = path.split('/').pop()!;
          return this.handleGetAgentCard(agentId);
        }
        if (path.endsWith('/info')) {
          return this.handleGetServerInfo();
        }
        if (path.endsWith('/stats')) {
          return this.handleGetServerStats();
        }
        if (path.match(/\/tasks\/[^/]+\/status$/)) {
          const taskId = path.split('/').slice(-2)[0];
          return this.handleGetTaskStatus(taskId);
        }
      }

      // JSON-RPC endpoint
      if (request.method === 'POST' && path.endsWith('/rpc')) {
        return this.handleJsonRpcRequest(request);
      }

      // Task submission endpoint
      if (request.method === 'POST' && path.endsWith('/tasks')) {
        return this.handleSendTask(request);
      }

      // Task cancellation endpoint
      if (request.method === 'DELETE' && path.match(/\/tasks\/[^/]+$/)) {
        const taskId = path.split('/').pop()!;
        return this.handleCancelTask(taskId);
      }

      // Not found
      return this.createErrorResponse(404, 'Not Found', 'Endpoint not found');
    } catch (error) {
      return this.createErrorResponse(
        500,
        'Internal Server Error',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async *handleStreamRequest(
    request: HttpRequest
  ): AsyncGenerator<StreamEvent, void, undefined> {
    if (!this.server.isRunning()) {
      yield {
        event: 'error',
        data: JSON.stringify({
          code: JsonRpcErrorCodes.SERVER_NOT_RUNNING,
          message: 'Server is not running',
        }),
      };
      return;
    }

    try {
      const task = A2ATaskSchema.parse(request.body);

      // Start streaming
      yield {
        event: 'connected',
        data: JSON.stringify({ taskId: task.id }),
      };

      // Handle task with streaming
      const generator = this.server.handleTaskStream(task);

      for await (const update of generator) {
        yield {
          event: 'update',
          data: JSON.stringify(update),
          id: `${task.id}-${Date.now()}`,
        };
      }

      // Get final result
      const result = await generator.next();
      if (result.value) {
        yield {
          event: 'result',
          data: JSON.stringify(result.value),
        };
      }

      yield {
        event: 'complete',
        data: JSON.stringify({ taskId: task.id }),
      };
    } catch (error) {
      yield {
        event: 'error',
        data: JSON.stringify({
          code: JsonRpcErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      };
    }
  }

  async validateAuth(request: HttpRequest): Promise<boolean> {
    const config = this.server.getConfig();

    if (!config.authentication) {
      return true; // No auth required
    }

    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      return false;
    }

    const authValue = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    switch (config.authentication.type) {
      case 'api_key':
        return authValue === config.authentication.credentials?.apiKey;

      case 'bearer_token':
        if (!authValue.startsWith('Bearer ')) {
          return false;
        }
        const token = authValue.slice(7);
        return token === config.authentication.credentials?.token;

      default:
        return true;
    }
  }

  // === JSON-RPC Handler ===

  private async handleJsonRpcRequest(request: HttpRequest): Promise<HttpResponse> {
    try {
      const rpcRequest = JsonRpcRequestSchema.parse(request.body);
      const result = await this.executeMethod(rpcRequest.method, rpcRequest.params);

      return this.createJsonRpcResponse(rpcRequest.id, result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.createJsonRpcErrorResponse(
          null,
          JsonRpcErrorCodes.INVALID_REQUEST,
          'Invalid JSON-RPC request',
          error.errors
        );
      }

      return this.createJsonRpcErrorResponse(
        null,
        JsonRpcErrorCodes.INTERNAL_ERROR,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async executeMethod(
    method: string,
    params: unknown
  ): Promise<unknown> {
    if (!this.server.isRunning()) {
      throw new JsonRpcException(
        JsonRpcErrorCodes.SERVER_NOT_RUNNING,
        'Server is not running'
      );
    }

    switch (method) {
      case A2AMethods.GET_AGENT_CARD: {
        const { agentId } = params as { agentId: string };
        const card = this.server.getAgentCard(agentId);
        if (!card) {
          throw new JsonRpcException(
            JsonRpcErrorCodes.AGENT_NOT_FOUND,
            `Agent not found: ${agentId}`
          );
        }
        return card;
      }

      case A2AMethods.LIST_AGENTS: {
        return this.server.getAllAgentCards();
      }

      case A2AMethods.FIND_AGENTS: {
        const { capability } = params as { capability: string };
        return this.server.findAgentsByCapability(capability);
      }

      case A2AMethods.SEND_TASK: {
        const task = A2ATaskSchema.parse(params);
        return this.server.handleTask(task);
      }

      case A2AMethods.GET_TASK_STATUS: {
        const { taskId } = params as { taskId: string };
        const status = this.server.getTaskStatus(taskId);
        if (!status) {
          throw new JsonRpcException(
            JsonRpcErrorCodes.TASK_NOT_FOUND,
            `Task not found: ${taskId}`
          );
        }
        return { taskId, status };
      }

      case A2AMethods.CANCEL_TASK: {
        const { taskId } = params as { taskId: string };
        const cancelled = await this.server.cancelTask(taskId);
        return { taskId, cancelled };
      }

      case A2AMethods.GET_SERVER_INFO: {
        const config = this.server.getConfig();
        return {
          version: '1.0.0',
          protocol: 'a2a',
          host: config.host,
          port: config.port,
          basePath: config.basePath,
          streaming: config.enableStreaming,
          pushNotifications: config.enablePushNotifications,
        };
      }

      case A2AMethods.GET_SERVER_STATS: {
        return this.server.getStats();
      }

      default:
        throw new JsonRpcException(
          JsonRpcErrorCodes.METHOD_NOT_FOUND,
          `Method not found: ${method}`
        );
    }
  }

  // === REST Handlers ===

  private handleListAgents(): HttpResponse {
    if (!this.server.isRunning()) {
      return this.createErrorResponse(503, 'Service Unavailable', 'Server is not running');
    }

    const cards = this.server.getAllAgentCards();
    return this.createJsonResponse(200, { agents: cards });
  }

  private handleGetAgentCard(agentId: string): HttpResponse {
    if (!this.server.isRunning()) {
      return this.createErrorResponse(503, 'Service Unavailable', 'Server is not running');
    }

    const card = this.server.getAgentCard(agentId);
    if (!card) {
      return this.createErrorResponse(404, 'Not Found', `Agent not found: ${agentId}`);
    }

    return this.createJsonResponse(200, card);
  }

  private handleGetServerInfo(): HttpResponse {
    const config = this.server.getConfig();
    return this.createJsonResponse(200, {
      version: '1.0.0',
      protocol: 'a2a',
      status: this.server.getStatus(),
      host: config.host,
      port: config.port,
      basePath: config.basePath,
      streaming: config.enableStreaming,
      pushNotifications: config.enablePushNotifications,
    });
  }

  private handleGetServerStats(): HttpResponse {
    if (!this.server.isRunning()) {
      return this.createErrorResponse(503, 'Service Unavailable', 'Server is not running');
    }

    const stats = this.server.getStats();
    return this.createJsonResponse(200, stats);
  }

  private handleGetTaskStatus(taskId: string): HttpResponse {
    if (!this.server.isRunning()) {
      return this.createErrorResponse(503, 'Service Unavailable', 'Server is not running');
    }

    const status = this.server.getTaskStatus(taskId);
    if (!status) {
      return this.createErrorResponse(404, 'Not Found', `Task not found: ${taskId}`);
    }

    return this.createJsonResponse(200, { taskId, status });
  }

  private async handleSendTask(request: HttpRequest): Promise<HttpResponse> {
    if (!this.server.isRunning()) {
      return this.createErrorResponse(503, 'Service Unavailable', 'Server is not running');
    }

    try {
      const task = A2ATaskSchema.parse(request.body);
      const result = await this.server.handleTask(task);
      return this.createJsonResponse(200, result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return this.createErrorResponse(400, 'Bad Request', 'Invalid task format', error.errors);
      }
      return this.createErrorResponse(
        500,
        'Internal Server Error',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  private async handleCancelTask(taskId: string): Promise<HttpResponse> {
    if (!this.server.isRunning()) {
      return this.createErrorResponse(503, 'Service Unavailable', 'Server is not running');
    }

    const cancelled = await this.server.cancelTask(taskId);
    if (!cancelled) {
      return this.createErrorResponse(404, 'Not Found', `Task not found: ${taskId}`);
    }

    return this.createJsonResponse(200, { taskId, cancelled: true });
  }

  // === Response Helpers ===

  private createJsonResponse(status: number, body: unknown): HttpResponse {
    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body,
    };
  }

  private createErrorResponse(
    status: number,
    error: string,
    message: string,
    details?: unknown
  ): HttpResponse {
    return this.createJsonResponse(status, {
      error,
      message,
      details,
    });
  }

  private createCorsResponse(): HttpResponse {
    return {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
      body: null,
    };
  }

  private createJsonRpcResponse(
    id: string | number,
    result: unknown
  ): HttpResponse {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      result,
    };
    return this.createJsonResponse(200, response);
  }

  private createJsonRpcErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown
  ): HttpResponse {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
    return this.createJsonResponse(200, response);
  }
}

// ============================================================================
// Exceptions
// ============================================================================

/**
 * JSON-RPC Exception
 */
export class JsonRpcException extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'JsonRpcException';
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a new A2A Transport
 */
export function createA2ATransport(server: IA2AServer): A2ATransport {
  return new A2ATransport(server);
}
