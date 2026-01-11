/**
 * MCP Manager Implementation
 *
 * Manages multiple MCP clients and provides unified access to MCP servers.
 *
 * @module core/tools/mcp/mcp-manager
 */

import {
  IMCPManager,
  IMCPClient,
  MCPClientConfig,
  MCPManagerConfig,
  MCPOperationResult,
  MCPTool,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPConnectionState,
  DEFAULT_MCP_MANAGER_CONFIG,
  validateMCPClientConfig,
} from './mcp.interface.js';
import { MCPClient } from './mcp-client.js';

/**
 * MCP Manager implementation
 *
 * Provides centralized management of multiple MCP server connections.
 */
export class MCPManager implements IMCPManager {
  private config: MCPManagerConfig;
  private clients: Map<string, IMCPClient> = new Map();
  private serverConfigs: Map<string, MCPClientConfig> = new Map();
  private toolToServerMap: Map<string, string[]> = new Map();
  private disposed = false;

  constructor(config: MCPManagerConfig = {}) {
    this.config = { ...DEFAULT_MCP_MANAGER_CONFIG, ...config };
  }

  /**
   * Register a server configuration
   */
  registerServer(config: MCPClientConfig): void {
    this.ensureNotDisposed();

    // Validate configuration
    const errors = validateMCPClientConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid server configuration: ${errors.join(', ')}`);
    }

    // Check for duplicate
    if (this.serverConfigs.has(config.serverId)) {
      throw new Error(`Server '${config.serverId}' is already registered`);
    }

    // Check connection limit
    if (this.serverConfigs.size >= (this.config.maxConcurrentConnections ?? 10)) {
      throw new Error(
        `Maximum concurrent connections (${this.config.maxConcurrentConnections}) reached`
      );
    }

    // Store configuration
    this.serverConfigs.set(config.serverId, {
      ...config,
      requestTimeoutMs: config.requestTimeoutMs ?? this.config.defaultRequestTimeoutMs,
      autoReconnect: config.autoReconnect ?? this.config.defaultAutoReconnect,
      debug: config.debug ?? this.config.debug,
    });
  }

  /**
   * Unregister a server
   */
  unregisterServer(serverId: string): void {
    this.ensureNotDisposed();

    // Disconnect if connected
    const client = this.clients.get(serverId);
    if (client) {
      client.disconnect().catch(() => {
        // Ignore disconnect errors during unregister
      });
      this.clients.delete(serverId);
    }

    // Remove configuration
    this.serverConfigs.delete(serverId);

    // Update tool mapping
    this.updateToolMapping();
  }

  /**
   * Get a client by server ID
   */
  getClient(serverId: string): IMCPClient | undefined {
    return this.clients.get(serverId);
  }

  /**
   * Get all registered clients
   */
  getAllClients(): Map<string, IMCPClient> {
    return new Map(this.clients);
  }

  /**
   * Connect to a specific server
   */
  async connect(serverId: string): Promise<MCPOperationResult> {
    this.ensureNotDisposed();

    const config = this.serverConfigs.get(serverId);
    if (!config) {
      return { success: false, error: `Server '${serverId}' is not registered` };
    }

    // Check if already connected
    const existingClient = this.clients.get(serverId);
    if (existingClient?.isReady()) {
      return { success: true };
    }

    try {
      // Create client if needed
      let client = this.clients.get(serverId);
      if (!client) {
        client = new MCPClient(config);
        this.clients.set(serverId, client);
      }

      // Connect
      const result = await client.connect();

      if (result.success) {
        // Update tool mapping
        await this.updateToolMappingForServer(serverId);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Connect to all registered servers
   */
  async connectAll(): Promise<Map<string, MCPOperationResult>> {
    this.ensureNotDisposed();

    const results = new Map<string, MCPOperationResult>();
    const promises = Array.from(this.serverConfigs.keys()).map(async (serverId) => {
      const result = await this.connect(serverId);
      results.set(serverId, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Disconnect from a specific server
   */
  async disconnect(serverId: string): Promise<MCPOperationResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      return { success: true };
    }

    const result = await client.disconnect();
    this.clients.delete(serverId);
    this.updateToolMapping();

    return result;
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<Map<string, MCPOperationResult>> {
    const results = new Map<string, MCPOperationResult>();
    const promises = Array.from(this.clients.keys()).map(async (serverId) => {
      const result = await this.disconnect(serverId);
      results.set(serverId, result);
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * List all available tools across all connected servers
   */
  async listAllTools(): Promise<Map<string, MCPTool[]>> {
    this.ensureNotDisposed();

    const toolsByServer = new Map<string, MCPTool[]>();

    for (const [serverId, client] of this.clients) {
      if (client.isReady()) {
        const result = await client.listTools();
        if (result.success && result.data) {
          toolsByServer.set(serverId, result.data.tools);
        }
      }
    }

    return toolsByServer;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverId: string,
    params: MCPToolCallParams
  ): Promise<MCPOperationResult<MCPToolCallResult>> {
    this.ensureNotDisposed();

    const client = this.clients.get(serverId);
    if (!client) {
      return { success: false, error: `Server '${serverId}' is not connected` };
    }

    if (!client.isReady()) {
      return { success: false, error: `Server '${serverId}' is not ready` };
    }

    return client.callTool(params);
  }

  /**
   * Find servers that provide a specific tool
   */
  findServersWithTool(toolName: string): string[] {
    return this.toolToServerMap.get(toolName) ?? [];
  }

  /**
   * Get manager statistics
   */
  getStatistics(): {
    totalServers: number;
    connectedServers: number;
    totalToolCalls: number;
    totalResourceReads: number;
  } {
    let connectedServers = 0;
    let totalToolCalls = 0;
    let totalResourceReads = 0;

    for (const client of this.clients.values()) {
      if (client.getConnectionState() === MCPConnectionState.READY) {
        connectedServers++;
      }
      const stats = client.getStatistics();
      totalToolCalls += stats.totalToolCalls;
      totalResourceReads += stats.totalResourceReads;
    }

    return {
      totalServers: this.serverConfigs.size,
      connectedServers,
      totalToolCalls,
      totalResourceReads,
    };
  }

  /**
   * Dispose the manager and all clients
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Disconnect all clients
    await this.disconnectAll();

    // Clear all data
    this.clients.clear();
    this.serverConfigs.clear();
    this.toolToServerMap.clear();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Ensure manager is not disposed
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('MCPManager has been disposed');
    }
  }

  /**
   * Update tool to server mapping
   */
  private updateToolMapping(): void {
    this.toolToServerMap.clear();
  }

  /**
   * Update tool mapping for a specific server
   */
  private async updateToolMappingForServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client?.isReady()) {
      return;
    }

    const result = await client.listTools();
    if (!result.success || !result.data) {
      return;
    }

    for (const tool of result.data.tools) {
      const servers = this.toolToServerMap.get(tool.name) ?? [];
      if (!servers.includes(serverId)) {
        servers.push(serverId);
        this.toolToServerMap.set(tool.name, servers);
      }
    }
  }
}

/**
 * Create a singleton MCP Manager instance
 */
let globalManager: MCPManager | null = null;

/**
 * Get the global MCP Manager instance
 */
export function getMCPManager(config?: MCPManagerConfig): MCPManager {
  if (!globalManager) {
    globalManager = new MCPManager(config);
  }
  return globalManager;
}

/**
 * Reset the global MCP Manager (for testing)
 */
export async function resetMCPManager(): Promise<void> {
  if (globalManager) {
    await globalManager.dispose();
    globalManager = null;
  }
}
