/**
 * IDE Bridge
 *
 * Server-side communication layer for IDE extensions (VS Code, JetBrains).
 * Provides JSON-RPC message handling, command dispatch, and client
 * connection management for multiple concurrent IDE instances.
 *
 * @module ui/ide
 */

import { EventEmitter } from 'events';
import { createAgentLogger } from '../../shared/logging/logger';
import { IDECommandRegistry } from './ide-command-registry';

const logger = createAgentLogger('IDE', 'ide-bridge');

// ── Types ────────────────────────────────────────────────────────

/**
 * Configuration for the IDE bridge
 */
export interface IDEBridgeConfig {
  /** Maximum number of concurrent IDE clients (default: 5) */
  maxClients?: number;
  /** Timeout for command execution in ms (default: 30000) */
  commandTimeout?: number;
}

/**
 * Represents a connected IDE client
 */
export interface IDEClient {
  id: string;
  type: 'vscode' | 'jetbrains' | 'other';
  connectedAt: string;
  capabilities: string[];
}

/**
 * JSON-RPC 2.0 request
 */
export interface RPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 response
 */
export interface RPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: RPCError;
}

/**
 * JSON-RPC 2.0 notification (no id, no response expected)
 */
export interface RPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC 2.0 error object
 */
export interface RPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * Handler function for a registered command
 */
export type CommandHandler = (params: Record<string, unknown>) => Promise<unknown>;

/**
 * Standard JSON-RPC error codes
 */
export const RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ── IDEBridge ────────────────────────────────────────────────────

/**
 * IDEBridge
 *
 * Manages IDE client connections and dispatches JSON-RPC messages
 * to registered command handlers. Emits typed events for integration
 * with other system components.
 *
 * Events emitted:
 * - `client:connected`    – when an IDE client connects
 * - `client:disconnected` – when an IDE client disconnects
 * - `command:executed`     – after a command handler completes
 * - `notification:sent`    – after a notification is sent
 */
export class IDEBridge extends EventEmitter {
  private clients: Map<string, IDEClient> = new Map();
  private readonly commandRegistry: IDECommandRegistry;
  private readonly maxClients: number;
  private readonly commandTimeout: number;

  constructor(config: IDEBridgeConfig = {}) {
    super();
    this.maxClients = config.maxClients ?? 5;
    this.commandTimeout = config.commandTimeout ?? 30000;
    this.commandRegistry = new IDECommandRegistry();
    this.registerBuiltInCommands();
  }

  // ── Command Registration ─────────────────────────────────────

  /**
   * Register a command handler for a given method name.
   */
  registerCommand(method: string, handler: CommandHandler): void {
    this.commandRegistry.register(
      { method, description: '' },
      handler,
    );
  }

  // ── Message Handling ─────────────────────────────────────────

  /**
   * Handle an incoming JSON-RPC request from a client.
   * Validates the request, dispatches to the registered handler,
   * and returns an appropriate RPC response.
   */
  async handleMessage(clientId: string, message: RPCRequest): Promise<RPCResponse> {
    // Validate client is connected
    if (!this.clients.has(clientId)) {
      return this.errorResponse(
        message.id ?? 0,
        RPC_ERRORS.INVALID_REQUEST,
        'Client not connected',
      );
    }

    // Validate JSON-RPC structure
    if (!this.isValidRequest(message)) {
      return this.errorResponse(
        message.id ?? 0,
        RPC_ERRORS.INVALID_REQUEST,
        'Invalid JSON-RPC request',
      );
    }

    // Look up the handler
    const handler = this.commandRegistry.getHandler(message.method);
    if (!handler) {
      return this.errorResponse(
        message.id,
        RPC_ERRORS.METHOD_NOT_FOUND,
        `Method not found: ${message.method}`,
      );
    }

    // Execute with timeout
    try {
      const result = await this.executeWithTimeout(
        handler,
        message.params ?? {},
        this.commandTimeout,
      );
      const response: RPCResponse = {
        jsonrpc: '2.0',
        id: message.id,
        result,
      };
      this.emit('command:executed', { method: message.method, clientId });
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Internal error';
      logger.error(`Command ${message.method} failed: ${errorMessage}`);
      return this.errorResponse(
        message.id,
        RPC_ERRORS.INTERNAL_ERROR,
        errorMessage,
      );
    }
  }

  // ── Notifications ────────────────────────────────────────────

  /**
   * Send a notification to a specific connected client.
   * Emits 'notification:sent' if the client exists.
   */
  sendNotification(clientId: string, notification: RPCNotification): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.emit('notification:sent', { clientId, notification });
  }

  /**
   * Broadcast a notification to all connected clients.
   */
  broadcastNotification(notification: RPCNotification): void {
    for (const clientId of this.clients.keys()) {
      this.sendNotification(clientId, notification);
    }
  }

  // ── Client Management ────────────────────────────────────────

  /**
   * Connect a new IDE client. Rejects if at max capacity.
   */
  connectClient(client: IDEClient): void {
    if (this.clients.size >= this.maxClients) {
      throw new Error(`Maximum client limit reached (${this.maxClients})`);
    }
    this.clients.set(client.id, client);
    this.emit('client:connected', client);
    logger.info(`IDE client connected: ${client.id} (${client.type})`);
  }

  /**
   * Disconnect an IDE client by ID.
   * Returns true if the client was found and disconnected.
   */
  disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    this.clients.delete(clientId);
    this.emit('client:disconnected', client);
    logger.info(`IDE client disconnected: ${clientId}`);
    return true;
  }

  /**
   * Get all currently connected clients.
   */
  getConnectedClients(): IDEClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get a specific client by ID, or null if not found.
   */
  getClient(id: string): IDEClient | null {
    return this.clients.get(id) ?? null;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Dispose all resources, disconnect all clients, and clear state.
   */
  dispose(): void {
    this.clients.clear();
    this.removeAllListeners();
    logger.info('IDE bridge disposed');
  }

  // ── Private Helpers ──────────────────────────────────────────

  private isValidRequest(message: RPCRequest): boolean {
    return (
      message.jsonrpc === '2.0' &&
      message.id !== undefined &&
      message.id !== null &&
      typeof message.method === 'string' &&
      message.method.length > 0
    );
  }

  private errorResponse(id: string | number, code: number, message: string): RPCResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message },
    };
  }

  private executeWithTimeout(
    handler: CommandHandler,
    params: Record<string, unknown>,
    timeout: number,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Command execution timed out'));
      }, timeout);

      handler(params)
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private registerBuiltInCommands(): void {
    this.registerCommand('getStatus', async () => {
      return {
        connectedClients: this.clients.size,
        maxClients: this.maxClients,
        uptime: process.uptime(),
      };
    });

    this.registerCommand('listAgents', async () => {
      return { agents: [] };
    });

    this.registerCommand('submitTask', async (params) => {
      const name = params.name as string | undefined;
      if (!name) {
        throw new Error('Task name is required');
      }
      return { taskId: `task-${Date.now()}`, status: 'accepted' };
    });

    this.registerCommand('getTaskResult', async (params) => {
      const taskId = params.taskId as string | undefined;
      if (!taskId) {
        throw new Error('Task ID is required');
      }
      return { taskId, status: 'pending', result: null };
    });

    this.registerCommand('listSkills', async () => {
      return { skills: [] };
    });
  }
}

/**
 * Factory function for creating an IDEBridge
 */
export function createIDEBridge(config?: IDEBridgeConfig): IDEBridge {
  return new IDEBridge(config);
}
