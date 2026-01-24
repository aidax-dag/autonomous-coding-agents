/**
 * MCP Client Implementation
 *
 * Implements the IMCPClient interface for communicating with MCP servers.
 *
 * @module core/tools/mcp/mcp-client
 */

import { EventEmitter } from 'events';
import {
  IMCPClient,
  IMCPTransport,
  MCPClientConfig,
  MCPConnectionState,
  MCPServerInfo,
  MCPOperationResult,
  MCPClientStatistics,
  MCPEventType,
  MCPEventCallback,
  MCPSubscription,
  MCPToolListResult,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPTool,
  MCPResourceListResult,
  MCPResourceTemplatesResult,
  MCPResourceReadParams,
  MCPResourceReadResult,
  MCPPromptListResult,
  MCPPromptGetParams,
  MCPPromptGetResult,
  MCPLogLevel,
  MCPTransportType,
  MCPCapabilities,
  MCPClientInfo,
  MCP_PROTOCOL_VERSION,
  DEFAULT_MCP_CLIENT_CONFIG,
  createJsonRpcRequest,
  createJsonRpcNotification,
  isJsonRpcError,
  JsonRpcNotification,
} from './mcp.interface.js';
import { StdioTransport } from './stdio-transport.js';
import { HttpTransport } from './http-transport.js';
import { WebSocketTransport } from './websocket-transport.js';

/**
 * MCP Client implementation
 *
 * Provides a high-level API for interacting with MCP servers.
 */
export class MCPClient extends EventEmitter implements IMCPClient {
  private config: MCPClientConfig;
  private transport: IMCPTransport | null = null;
  private connectionState: MCPConnectionState = MCPConnectionState.DISCONNECTED;
  private serverInfo: MCPServerInfo | undefined;
  private connectedAt: Date | null = null;
  private subscriptionCounter = 0;
  private subscriptions: Map<string, { event: MCPEventType; callback: MCPEventCallback }> =
    new Map();

  // Statistics
  private stats: MCPClientStatistics;

  // Cached data
  private toolsCache: MCPTool[] | null = null;

  constructor(config: MCPClientConfig) {
    super();
    this.config = {
      ...DEFAULT_MCP_CLIENT_CONFIG,
      ...config,
      clientInfo: config.clientInfo ?? DEFAULT_MCP_CLIENT_CONFIG.clientInfo,
      capabilities: config.capabilities ?? DEFAULT_MCP_CLIENT_CONFIG.capabilities,
    };

    this.stats = this.initializeStatistics();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<MCPOperationResult> {
    if (this.connectionState === MCPConnectionState.CONNECTED ||
        this.connectionState === MCPConnectionState.READY) {
      return { success: true };
    }

    const startTime = Date.now();

    try {
      this.setConnectionState(MCPConnectionState.CONNECTING);

      // Create transport based on config
      this.transport = this.createTransport();

      // Setup transport handlers
      this.setupTransportHandlers();

      // Connect transport
      await this.transport.connect();
      this.setConnectionState(MCPConnectionState.CONNECTED);

      // Initialize MCP protocol
      this.setConnectionState(MCPConnectionState.INITIALIZING);
      const initResult = await this.initializeProtocol();

      if (!initResult.success) {
        await this.disconnect();
        return initResult;
      }

      this.setConnectionState(MCPConnectionState.READY);
      this.connectedAt = new Date();

      return {
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.setConnectionState(MCPConnectionState.ERROR);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<MCPOperationResult> {
    if (this.connectionState === MCPConnectionState.DISCONNECTED) {
      return { success: true };
    }

    try {
      if (this.transport) {
        await this.transport.disconnect();
        this.transport = null;
      }

      this.setConnectionState(MCPConnectionState.DISCONNECTED);
      this.serverInfo = undefined;
      this.connectedAt = null;
      this.toolsCache = null;

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): MCPConnectionState {
    return this.connectionState;
  }

  /**
   * Check if client is ready for operations
   */
  isReady(): boolean {
    return this.connectionState === MCPConnectionState.READY;
  }

  /**
   * Get server info (available after initialization)
   */
  getServerInfo(): MCPServerInfo | undefined {
    return this.serverInfo;
  }

  // ===========================================================================
  // Tools
  // ===========================================================================

  /**
   * List available tools
   */
  async listTools(cursor?: string): Promise<MCPOperationResult<MCPToolListResult>> {
    return this.sendRequest<MCPToolListResult>('tools/list', cursor ? { cursor } : undefined);
  }

  /**
   * Call a tool
   */
  async callTool(params: MCPToolCallParams): Promise<MCPOperationResult<MCPToolCallResult>> {
    const startTime = Date.now();
    const result = await this.sendRequest<MCPToolCallResult>('tools/call', params as unknown as Record<string, unknown>);

    if (result.success) {
      this.stats.totalToolCalls++;
    }

    return {
      ...result,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Get a specific tool definition
   */
  async getTool(name: string): Promise<MCPOperationResult<MCPTool | undefined>> {
    // First check cache
    if (this.toolsCache) {
      const tool = this.toolsCache.find((t) => t.name === name);
      return { success: true, data: tool };
    }

    // Fetch tools list
    const listResult = await this.listTools();
    if (!listResult.success) {
      return { success: false, error: listResult.error };
    }

    // Cache tools
    this.toolsCache = listResult.data?.tools ?? [];

    // Find the tool
    const tool = this.toolsCache.find((t) => t.name === name);
    return { success: true, data: tool };
  }

  // ===========================================================================
  // Resources
  // ===========================================================================

  /**
   * List available resources
   */
  async listResources(cursor?: string): Promise<MCPOperationResult<MCPResourceListResult>> {
    return this.sendRequest<MCPResourceListResult>(
      'resources/list',
      cursor ? { cursor } : undefined
    );
  }

  /**
   * List resource templates
   */
  async listResourceTemplates(): Promise<MCPOperationResult<MCPResourceTemplatesResult>> {
    return this.sendRequest<MCPResourceTemplatesResult>('resources/templates/list');
  }

  /**
   * Read a resource
   */
  async readResource(
    params: MCPResourceReadParams
  ): Promise<MCPOperationResult<MCPResourceReadResult>> {
    const result = await this.sendRequest<MCPResourceReadResult>('resources/read', params as unknown as Record<string, unknown>);

    if (result.success) {
      this.stats.totalResourceReads++;
    }

    return result;
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeResource(uri: string): Promise<MCPOperationResult> {
    return this.sendRequest('resources/subscribe', { uri });
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeResource(uri: string): Promise<MCPOperationResult> {
    return this.sendRequest('resources/unsubscribe', { uri });
  }

  // ===========================================================================
  // Prompts
  // ===========================================================================

  /**
   * List available prompts
   */
  async listPrompts(cursor?: string): Promise<MCPOperationResult<MCPPromptListResult>> {
    return this.sendRequest<MCPPromptListResult>('prompts/list', cursor ? { cursor } : undefined);
  }

  /**
   * Get a prompt
   */
  async getPrompt(params: MCPPromptGetParams): Promise<MCPOperationResult<MCPPromptGetResult>> {
    const result = await this.sendRequest<MCPPromptGetResult>('prompts/get', params as unknown as Record<string, unknown>);

    if (result.success) {
      this.stats.totalPromptGets++;
    }

    return result;
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Ping the server
   */
  async ping(): Promise<MCPOperationResult<{ latencyMs: number }>> {
    const startTime = Date.now();
    const result = await this.sendRequest('ping');
    const latencyMs = Date.now() - startTime;

    return {
      ...result,
      data: { latencyMs },
    };
  }

  /**
   * Set logging level
   */
  async setLoggingLevel(level: MCPLogLevel): Promise<MCPOperationResult> {
    return this.sendRequest('logging/setLevel', { level });
  }

  /**
   * Get client statistics
   */
  getStatistics(): MCPClientStatistics {
    return {
      ...this.stats,
      uptimeMs: this.connectedAt ? Date.now() - this.connectedAt.getTime() : 0,
      lastActivityAt: this.stats.lastActivityAt,
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.stats = this.initializeStatistics();
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  /**
   * Subscribe to events
   */
  subscribe(event: MCPEventType, callback: MCPEventCallback): MCPSubscription {
    const id = `sub_${++this.subscriptionCounter}`;
    this.subscriptions.set(id, { event, callback });

    // Add listener to EventEmitter
    super.on(event, callback);

    return {
      id,
      unsubscribe: () => {
        this.subscriptions.delete(id);
        super.off(event, callback);
      },
    };
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void {
    this.subscriptions.clear();
    super.removeAllListeners();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Create transport based on configuration
   */
  private createTransport(): IMCPTransport {
    switch (this.config.transport.type) {
      case MCPTransportType.STDIO:
        return new StdioTransport(this.config.transport);
      case MCPTransportType.HTTP_SSE:
        return new HttpTransport(this.config.transport);
      case MCPTransportType.WEBSOCKET:
        return new WebSocketTransport(this.config.transport);
      default:
        throw new Error(`Unknown transport type: ${(this.config.transport as { type: string }).type}`);
    }
  }

  /**
   * Setup transport event handlers
   */
  private setupTransportHandlers(): void {
    if (!this.transport) return;

    this.transport.onMessage((message) => {
      this.handleNotification(message as JsonRpcNotification);
    });

    this.transport.onError((error) => {
      this.emitEvent(MCPEventType.ERROR, { error: error.message });
    });

    this.transport.onClose((code, _reason) => {
      this.setConnectionState(MCPConnectionState.DISCONNECTED);
      this.serverInfo = undefined;

      if (this.config.autoReconnect && code !== 0) {
        this.reconnect();
      }
    });
  }

  /**
   * Initialize MCP protocol
   */
  private async initializeProtocol(): Promise<MCPOperationResult> {
    const params = {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: this.config.capabilities as MCPCapabilities,
      clientInfo: this.config.clientInfo as MCPClientInfo,
    };

    const result = await this.sendRequest<{
      protocolVersion: string;
      capabilities: MCPCapabilities;
      serverInfo: MCPServerInfo;
      instructions?: string;
    }>('initialize', params);

    if (!result.success || !result.data) {
      return { success: false, error: result.error ?? 'Initialize failed' };
    }

    this.serverInfo = {
      name: result.data.serverInfo?.name ?? 'unknown',
      version: result.data.serverInfo?.version ?? '0.0.0',
      protocolVersion: result.data.protocolVersion,
      capabilities: result.data.capabilities,
      instructions: result.data.instructions,
    };

    // Send initialized notification
    this.sendNotification('notifications/initialized');

    return { success: true };
  }

  /**
   * Send a JSON-RPC request
   */
  private async sendRequest<T>(
    method: string,
    params?: Record<string, unknown>
  ): Promise<MCPOperationResult<T>> {
    if (!this.transport || !this.transport.isConnected()) {
      return { success: false, error: 'Not connected' };
    }

    const startTime = Date.now();

    try {
      const request = createJsonRpcRequest(method, params);
      const response = await this.transport.sendRequest<T>(request);

      this.stats.totalRequests++;
      this.stats.lastActivityAt = new Date();

      if (isJsonRpcError(response)) {
        this.stats.failedRequests++;
        return {
          success: false,
          error: response.error.message,
          errorCode: response.error.code,
          durationMs: Date.now() - startTime,
        };
      }

      this.stats.successfulRequests++;
      this.updateAverageResponseTime(Date.now() - startTime);

      return {
        success: true,
        data: response.result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.stats.totalRequests++;
      this.stats.failedRequests++;
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Send a JSON-RPC notification
   */
  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.transport || !this.transport.isConnected()) {
      return;
    }

    const notification = createJsonRpcNotification(method, params);
    this.transport.sendNotification(notification);
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(notification: JsonRpcNotification): void {
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        this.toolsCache = null;
        this.emitEvent(MCPEventType.TOOLS_CHANGED, notification.params);
        break;
      case 'notifications/resources/list_changed':
        this.emitEvent(MCPEventType.RESOURCES_CHANGED, notification.params);
        break;
      case 'notifications/prompts/list_changed':
        this.emitEvent(MCPEventType.PROMPTS_CHANGED, notification.params);
        break;
      case 'notifications/message':
        this.emitEvent(MCPEventType.LOG_MESSAGE, notification.params);
        break;
      default:
        this.emitEvent(MCPEventType.NOTIFICATION, {
          method: notification.method,
          params: notification.params,
        });
    }
  }

  /**
   * Set connection state and emit event
   */
  private setConnectionState(state: MCPConnectionState): void {
    const previousState = this.connectionState;
    this.connectionState = state;

    this.emitEvent(MCPEventType.CONNECTION_STATE_CHANGED, {
      previousState,
      currentState: state,
    });
  }

  /**
   * Emit an event
   */
  private emitEvent<T>(type: MCPEventType, data: T): void {
    this.emit(type, {
      type,
      serverId: this.config.serverId,
      data,
      timestamp: new Date(),
    });
  }

  /**
   * Reconnect to the server
   */
  private async reconnect(): Promise<void> {
    if (this.connectionState === MCPConnectionState.RECONNECTING) {
      return;
    }

    this.setConnectionState(MCPConnectionState.RECONNECTING);
    this.stats.reconnectionCount++;

    // Wait before reconnecting
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const result = await this.connect();
    if (!result.success) {
      // Retry with exponential backoff
      setTimeout(() => this.reconnect(), Math.min(30000, 1000 * this.stats.reconnectionCount));
    }
  }

  /**
   * Initialize statistics
   */
  private initializeStatistics(): MCPClientStatistics {
    return {
      serverId: this.config.serverId,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTimeMs: 0,
      totalToolCalls: 0,
      totalResourceReads: 0,
      totalPromptGets: 0,
      uptimeMs: 0,
      reconnectionCount: 0,
      lastActivityAt: new Date(),
    };
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(durationMs: number): void {
    const totalResponses = this.stats.successfulRequests;
    this.stats.averageResponseTimeMs =
      (this.stats.averageResponseTimeMs * (totalResponses - 1) + durationMs) / totalResponses;
  }
}
