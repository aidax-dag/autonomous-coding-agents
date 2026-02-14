/**
 * ACA JetBrains Client
 *
 * JSON-RPC 2.0 client for communication between JetBrains IDE plugins
 * and the ACA server. Connects over TCP, supports request/response and
 * notification subscription patterns for task management and agent monitoring.
 *
 * @module platform/jetbrains
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import type {
  JetBrainsClientConfig,
  TaskSubmission,
  TaskStatus,
  AgentInfo,
  TaskUpdateEvent,
  AgentEvent,
} from './types';
import {
  DEFAULT_RPC_PORT,
  DEFAULT_CONNECT_TIMEOUT,
  DEFAULT_REQUEST_TIMEOUT,
} from './types';
import {
  createRequest,
  createNotification,
  serializeMessage,
  parseMessages,
  isResponse,
  isNotification,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type JsonRpcMessage,
} from './json-rpc';

// ── Types ──────────────────────────────────────────────────────────

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

type NotificationCallback = (params: unknown) => void;

// ── Client ─────────────────────────────────────────────────────────

export class ACAJetBrainsClient extends EventEmitter {
  private readonly serverUrl: string;
  private readonly rpcPort: number;
  private readonly authToken?: string;
  private readonly connectTimeout: number;
  private readonly requestTimeout: number;

  private socket: net.Socket | null = null;
  private connected = false;
  private buffer: Buffer = Buffer.alloc(0);
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private notificationHandlers: Map<string, NotificationCallback[]> = new Map();
  private disposed = false;

  constructor(config: JetBrainsClientConfig) {
    super();
    this.serverUrl = config.serverUrl;
    this.rpcPort = config.rpcPort ?? DEFAULT_RPC_PORT;
    this.authToken = config.authToken;
    this.connectTimeout = config.connectTimeout ?? DEFAULT_CONNECT_TIMEOUT;
    this.requestTimeout = config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
  }

  /**
   * Establish a JSON-RPC connection to the ACA server via TCP.
   * Resolves when the connection is established or rejects on timeout/error.
   */
  connect(): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('Client is disposed'));
    }
    if (this.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const host = this.extractHost(this.serverUrl);
      this.socket = new net.Socket();

      const connectTimer = setTimeout(() => {
        this.socket?.destroy();
        reject(new Error(`Connection timeout after ${this.connectTimeout}ms`));
      }, this.connectTimeout);

      this.socket.on('connect', () => {
        clearTimeout(connectTimer);
        this.connected = true;
        this.buffer = Buffer.alloc(0);
        this.emit('connected');

        // If auth token is configured, send authentication notification
        if (this.authToken) {
          const authNotification = createNotification('auth.token', {
            token: this.authToken,
          });
          this.socket!.write(serializeMessage(authNotification));
        }

        resolve();
      });

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on('error', (err: Error) => {
        clearTimeout(connectTimer);
        if (!this.connected) {
          reject(err);
        } else {
          this.emit('error', err);
        }
      });

      this.socket.on('close', () => {
        this.handleDisconnect();
      });

      this.socket.connect(this.rpcPort, host);
    });
  }

  /**
   * Cleanly disconnect from the ACA server.
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    this.handleDisconnect();
  }

  /**
   * Check whether the client is currently connected.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Send a JSON-RPC request and wait for the matching response.
   * Rejects if the server returns an error or the request times out.
   */
  sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.connected || !this.socket) {
      return Promise.reject(new Error('Not connected'));
    }

    const request = createRequest(method, params);
    const serialized = serializeMessage(request);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout for '${method}' after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.pendingRequests.set(request.id, { resolve, reject, timer });
      this.socket!.write(serialized);
    });
  }

  /**
   * Subscribe to JSON-RPC notifications for a given method.
   * Returns an unsubscribe function.
   */
  onNotification(method: string, callback: NotificationCallback): () => void {
    const handlers = this.notificationHandlers.get(method) ?? [];
    handlers.push(callback);
    this.notificationHandlers.set(method, handlers);

    return () => {
      const list = this.notificationHandlers.get(method);
      if (list) {
        const idx = list.indexOf(callback);
        if (idx >= 0) list.splice(idx, 1);
        if (list.length === 0) this.notificationHandlers.delete(method);
      }
    };
  }

  // ── High-Level API ─────────────────────────────────────────────

  /**
   * Submit a task to the ACA server for autonomous execution.
   */
  async submitTask(goal: string, options?: Omit<TaskSubmission, 'goal'>): Promise<TaskStatus> {
    const params: TaskSubmission = { goal, ...options };
    const result = await this.sendRequest('task.submit', params);
    return result as TaskStatus;
  }

  /**
   * Get the current status of a task by ID, or the overall system status.
   */
  async getStatus(taskId?: string): Promise<TaskStatus | TaskStatus[]> {
    const result = await this.sendRequest('status.get', { taskId });
    return result as TaskStatus | TaskStatus[];
  }

  /**
   * List all active agents in the ACA system.
   */
  async getAgents(): Promise<AgentInfo[]> {
    const result = await this.sendRequest('agents.list');
    return result as AgentInfo[];
  }

  /**
   * Cancel a running task by ID.
   */
  async cancelTask(taskId: string): Promise<{ success: boolean }> {
    const result = await this.sendRequest('task.cancel', { taskId });
    return result as { success: boolean };
  }

  /**
   * Subscribe to task update notifications.
   * Returns an unsubscribe function.
   */
  onTaskUpdate(callback: (event: TaskUpdateEvent) => void): () => void {
    return this.onNotification('task.update', (params) => {
      callback(params as TaskUpdateEvent);
    });
  }

  /**
   * Subscribe to agent lifecycle event notifications.
   * Returns an unsubscribe function.
   */
  onAgentEvent(callback: (event: AgentEvent) => void): () => void {
    return this.onNotification('agent.event', (params) => {
      callback(params as AgentEvent);
    });
  }

  /**
   * Dispose the client, disconnecting and rejecting all pending requests.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Client disposed'));
    }
    this.pendingRequests.clear();
    this.notificationHandlers.clear();
    this.disconnect();
    this.removeAllListeners();
  }

  // ── Private ────────────────────────────────────────────────────

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    const { messages, remainder } = parseMessages(this.buffer);
    this.buffer = remainder;

    for (const msg of messages) {
      this.dispatchMessage(msg);
    }
  }

  private dispatchMessage(msg: JsonRpcMessage): void {
    if (isResponse(msg)) {
      this.handleResponse(msg);
    } else if (isNotification(msg)) {
      this.handleNotification(msg);
    }
    // Incoming requests from server are not expected in this client
  }

  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      const err = new Error(response.error.message);
      (err as Error & { code: number }).code = response.error.code;
      pending.reject(err);
    } else {
      pending.resolve(response.result);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    const handlers = this.notificationHandlers.get(notification.method);
    if (handlers) {
      for (const handler of handlers) {
        handler(notification.params);
      }
    }
    this.emit('notification', notification);
  }

  private handleDisconnect(): void {
    const wasConnected = this.connected;
    this.connected = false;
    this.buffer = Buffer.alloc(0);

    // Reject all pending requests on disconnect
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection lost'));
    }
    this.pendingRequests.clear();

    if (wasConnected) {
      this.emit('disconnected');
    }
  }

  private extractHost(url: string): string {
    try {
      // Handle URLs with protocol
      if (url.includes('://')) {
        return new URL(url).hostname;
      }
      // Handle bare host:port or host
      const colonIdx = url.lastIndexOf(':');
      if (colonIdx > 0) {
        return url.slice(0, colonIdx);
      }
      return url;
    } catch {
      return url;
    }
  }
}

/**
 * Factory function for creating an ACA JetBrains client.
 */
export function createACAJetBrainsClient(config: JetBrainsClientConfig): ACAJetBrainsClient {
  return new ACAJetBrainsClient(config);
}
