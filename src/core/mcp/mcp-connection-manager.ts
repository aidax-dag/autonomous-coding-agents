/**
 * MCP Connection Manager
 *
 * Manages multiple simultaneous MCP server connections. Handles connecting,
 * disconnecting, tool discovery, health checks, and aggregation of tools
 * across all connected servers.
 *
 * @module core/mcp/mcp-connection-manager
 */

import type {
  MCPToolDefinition,
  MCPToolResult,
} from './interfaces/mcp.interface';
import { MCPClient, createMCPClient } from './mcp-client';
import { createAgentLogger } from '../../shared/logging/logger';

const log = createAgentLogger('MCPConnectionManager', 'mcp-connection-manager');

/**
 * Configuration entry for a single MCP server
 */
export interface MCPServerEntry {
  /** Unique identifier for the server */
  name: string;
  /** Transport type used to communicate with the server */
  transport: 'stdio' | 'http' | 'sse';
  /** Command to launch (stdio transport only) */
  command?: string;
  /** Arguments for the command (stdio transport only) */
  args?: string[];
  /** URL endpoint (http/sse transport only) */
  url?: string;
  /** Extra headers for HTTP/SSE transports */
  headers?: Record<string, string>;
  /** Environment variables for stdio child process */
  env?: Record<string, string>;
  /** Whether this server is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Configuration for the MCPConnectionManager
 */
export interface MCPConnectionManagerConfig {
  /** List of MCP servers to manage */
  servers: MCPServerEntry[];
  /** Whether to automatically reconnect on failure (reserved for future use) */
  autoReconnect?: boolean;
  /** Reconnect interval in milliseconds (reserved for future use) */
  reconnectIntervalMs?: number;
  /** Health check interval in milliseconds (reserved for future use) */
  healthCheckIntervalMs?: number;
}

/**
 * Status information for a single MCP server connection
 */
export interface MCPConnectionStatus {
  /** Server name */
  name: string;
  /** Whether the server is currently connected */
  connected: boolean;
  /** Number of tools discovered from this server */
  toolCount: number;
  /** ISO timestamp of the last health check */
  lastHealthCheck?: string;
  /** Error message if connection failed */
  error?: string;
}

interface MCPConnection {
  client: MCPClient;
  entry: MCPServerEntry;
  tools: MCPToolDefinition[];
  lastHealthCheck?: string;
  error?: string;
}

/**
 * MCPConnectionManager
 *
 * Manages lifecycle and tool aggregation for multiple MCP server connections.
 * Each server connects independently — one failure does not block others.
 */
export class MCPConnectionManager {
  private connections: Map<string, MCPConnection> = new Map();
  private readonly config: MCPConnectionManagerConfig;

  constructor(config: MCPConnectionManagerConfig) {
    this.config = config;
  }

  /**
   * Connect to all enabled servers.
   * Failures are isolated per server — one server failing does not block others.
   */
  async connectAll(): Promise<void> {
    const enabled = this.config.servers.filter((s) => s.enabled !== false);

    if (enabled.length === 0) {
      log.info('No MCP servers configured');
      return;
    }

    log.info('Connecting to MCP servers', { count: enabled.length });

    const results = await Promise.allSettled(
      enabled.map((entry) => this.connectServerInternal(entry)),
    );

    let successCount = 0;
    let failCount = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        successCount++;
      } else {
        failCount++;
      }
    }

    log.info('MCP server connection complete', { successCount, failCount });
  }

  /**
   * Connect to a specific server by name.
   * If the server is already connected, disconnects first.
   */
  async connectServer(name: string): Promise<void> {
    const entry = this.config.servers.find((s) => s.name === name);
    if (!entry) {
      throw new Error(`MCP server '${name}' not found in configuration`);
    }

    if (entry.enabled === false) {
      throw new Error(`MCP server '${name}' is disabled`);
    }

    // Disconnect existing connection if any
    if (this.connections.has(name)) {
      await this.disconnectServer(name);
    }

    await this.connectServerInternal(entry);
  }

  /**
   * Disconnect all connected servers.
   */
  async disconnectAll(): Promise<void> {
    const names = [...this.connections.keys()];

    if (names.length === 0) {
      return;
    }

    log.info('Disconnecting all MCP servers', { count: names.length });

    await Promise.allSettled(
      names.map((name) => this.disconnectServer(name)),
    );

    this.connections.clear();
    log.info('All MCP servers disconnected');
  }

  /**
   * Disconnect a specific server by name.
   */
  async disconnectServer(name: string): Promise<void> {
    const conn = this.connections.get(name);
    if (!conn) {
      return;
    }

    try {
      if (conn.client.isConnected()) {
        await conn.client.disconnect();
      }
    } catch (error) {
      log.warn(`Error disconnecting MCP server '${name}'`, {
        error: (error as Error).message,
      });
    }

    this.connections.delete(name);
    log.debug(`MCP server '${name}' disconnected`);
  }

  /**
   * Get connection status for all configured servers.
   */
  getStatus(): MCPConnectionStatus[] {
    return this.config.servers.map((entry) => {
      const conn = this.connections.get(entry.name);
      if (!conn) {
        return {
          name: entry.name,
          connected: false,
          toolCount: 0,
          error: entry.enabled === false ? 'Disabled' : undefined,
        };
      }

      return {
        name: entry.name,
        connected: conn.client.isConnected(),
        toolCount: conn.tools.length,
        lastHealthCheck: conn.lastHealthCheck,
        error: conn.error,
      };
    });
  }

  /**
   * Get all tools aggregated from every connected server.
   */
  getAllTools(): MCPToolDefinition[] {
    const tools: MCPToolDefinition[] = [];
    for (const conn of this.connections.values()) {
      tools.push(...conn.tools);
    }
    return tools;
  }

  /**
   * Get the MCPClient for a specific server.
   * Returns null if the server is not connected.
   */
  getClient(name: string): MCPClient | null {
    return this.connections.get(name)?.client ?? null;
  }

  /**
   * Get the tools discovered from a specific server.
   */
  getServerTools(name: string): MCPToolDefinition[] {
    return this.connections.get(name)?.tools ?? [];
  }

  /**
   * Call a tool on a specific server.
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPToolResult> {
    const conn = this.connections.get(serverName);
    if (!conn) {
      throw new Error(`MCP server '${serverName}' is not connected`);
    }

    if (!conn.client.isConnected()) {
      throw new Error(`MCP server '${serverName}' connection lost`);
    }

    return conn.client.callTool(toolName, args);
  }

  /**
   * Run a health check on all connected servers.
   * Marks servers with lost connections.
   */
  async healthCheck(): Promise<void> {
    const now = new Date().toISOString();

    for (const [name, conn] of this.connections) {
      conn.lastHealthCheck = now;

      if (!conn.client.isConnected()) {
        conn.error = 'Connection lost';
        log.warn(`MCP server '${name}' health check failed: connection lost`);
      } else {
        conn.error = undefined;
      }
    }
  }

  /**
   * Internal method to connect to a single server entry.
   */
  private async connectServerInternal(entry: MCPServerEntry): Promise<void> {
    // Guard against duplicate names — keep last connection
    if (this.connections.has(entry.name)) {
      log.warn(`Duplicate MCP server name '${entry.name}', replacing existing connection`);
      await this.disconnectServer(entry.name);
    }

    const client = createMCPClient();

    // Inject env vars into process.env for stdio child process inheritance
    const envBackup: Record<string, string | undefined> = {};
    if (entry.env) {
      for (const [key, value] of Object.entries(entry.env)) {
        envBackup[key] = process.env[key];
        process.env[key] = value;
      }
    }

    try {
      log.info(`Connecting to MCP server '${entry.name}'`, {
        transport: entry.transport,
      });

      await client.connect({
        name: entry.name,
        transport: entry.transport,
        command: entry.command,
        args: entry.args,
        url: entry.url,
        headers: entry.headers,
      });

      const tools = await client.listTools();

      this.connections.set(entry.name, {
        client,
        entry,
        tools,
      });

      log.info(`MCP server '${entry.name}' connected`, {
        toolCount: tools.length,
        toolNames: tools.map((t) => t.name),
      });
    } catch (error) {
      const message = (error as Error).message;
      log.error(`Failed to connect to MCP server '${entry.name}'`, undefined, {
        error: message,
        transport: entry.transport,
      });

      // Store the failed connection info for status reporting
      this.connections.set(entry.name, {
        client,
        entry,
        tools: [],
        error: message,
      });

      throw error;
    } finally {
      // Restore env vars
      if (entry.env) {
        for (const [key] of Object.entries(entry.env)) {
          if (envBackup[key] === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = envBackup[key];
          }
        }
      }
    }
  }
}

/**
 * Create an MCP connection manager
 */
export function createMCPConnectionManager(
  config: MCPConnectionManagerConfig,
): MCPConnectionManager {
  return new MCPConnectionManager(config);
}
