/**
 * MCP (Model Context Protocol) Interface
 *
 * Provides types and interfaces for MCP server communication.
 * Supports stdio, HTTP/SSE, and WebSocket transports.
 *
 * @module core/tools/mcp
 */

// ============================================================================
// Transport Types
// ============================================================================

/**
 * MCP transport types
 */
export enum MCPTransportType {
  /** Standard I/O transport (local process) */
  STDIO = 'stdio',
  /** HTTP with Server-Sent Events transport */
  HTTP_SSE = 'http_sse',
  /** WebSocket transport */
  WEBSOCKET = 'websocket',
}

/**
 * Base transport configuration
 */
export interface MCPTransportConfig {
  /** Transport type */
  type: MCPTransportType;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs?: number;
  /** Request timeout in milliseconds */
  requestTimeoutMs?: number;
}

/**
 * STDIO transport configuration
 */
export interface MCPStdioTransportConfig extends MCPTransportConfig {
  type: MCPTransportType.STDIO;
  /** Command to execute */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * HTTP/SSE transport configuration
 */
export interface MCPHttpTransportConfig extends MCPTransportConfig {
  type: MCPTransportType.HTTP_SSE;
  /** Server URL */
  url: string;
  /** HTTP headers */
  headers?: Record<string, string>;
  /** Enable SSL/TLS */
  secure?: boolean;
}

/**
 * WebSocket transport configuration
 */
export interface MCPWebSocketTransportConfig extends MCPTransportConfig {
  type: MCPTransportType.WEBSOCKET;
  /** WebSocket URL */
  url: string;
  /** HTTP headers for handshake */
  headers?: Record<string, string>;
  /** Reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in milliseconds */
  reconnectIntervalMs?: number;
  /** Maximum reconnect attempts */
  maxReconnectAttempts?: number;
}

/**
 * Union type for all transport configurations
 */
export type MCPTransportConfigUnion =
  | MCPStdioTransportConfig
  | MCPHttpTransportConfig
  | MCPWebSocketTransportConfig;

// ============================================================================
// JSON-RPC Protocol Types
// ============================================================================

/**
 * JSON-RPC request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC notification (no id, no response expected)
 */
export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC success response
 */
export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result: T;
}

/**
 * JSON-RPC error object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC error response
 */
export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcError;
}

/**
 * JSON-RPC response (success or error)
 */
export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse;

/**
 * Standard JSON-RPC error codes
 */
export enum JsonRpcErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP protocol version
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05';

/**
 * MCP capability flags
 */
export interface MCPCapabilities {
  /** Tool capabilities */
  tools?: {
    listChanged?: boolean;
  };
  /** Resource capabilities */
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  /** Prompt capabilities */
  prompts?: {
    listChanged?: boolean;
  };
  /** Logging capabilities */
  logging?: Record<string, never>;
  /** Experimental capabilities */
  experimental?: Record<string, unknown>;
}

/**
 * MCP client info (sent during initialization)
 */
export interface MCPClientInfo {
  /** Client name */
  name: string;
  /** Client version */
  version: string;
}

/**
 * MCP server info (received during initialization)
 */
export interface MCPServerInfo {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Protocol version */
  protocolVersion: string;
  /** Server capabilities */
  capabilities: MCPCapabilities;
  /** Server instructions (optional) */
  instructions?: string;
}

/**
 * Initialize request parameters
 */
export interface MCPInitializeParams {
  /** Protocol version */
  protocolVersion: string;
  /** Client capabilities */
  capabilities: MCPCapabilities;
  /** Client info */
  clientInfo: MCPClientInfo;
}

/**
 * Initialize response
 */
export interface MCPInitializeResult {
  /** Protocol version */
  protocolVersion: string;
  /** Server capabilities */
  capabilities: MCPCapabilities;
  /** Server info */
  serverInfo: MCPServerInfo;
  /** Server instructions */
  instructions?: string;
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * JSON Schema type for tool parameters
 */
export interface MCPJsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, MCPJsonSchemaProperty>;
  required?: string[];
  items?: MCPJsonSchemaProperty;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | MCPJsonSchemaProperty;
}

/**
 * JSON Schema property
 */
export interface MCPJsonSchemaProperty {
  type: string | string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: MCPJsonSchemaProperty;
  properties?: Record<string, MCPJsonSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  /** Tool name (unique identifier) */
  name: string;
  /** Tool description */
  description?: string;
  /** Input schema (JSON Schema) */
  inputSchema: MCPJsonSchema;
}

/**
 * Tool list response
 */
export interface MCPToolListResult {
  /** Available tools */
  tools: MCPTool[];
  /** Pagination cursor for next page */
  nextCursor?: string;
}

/**
 * Tool call parameters
 */
export interface MCPToolCallParams {
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments?: Record<string, unknown>;
}

/**
 * Content types for tool results
 */
export enum MCPContentType {
  TEXT = 'text',
  IMAGE = 'image',
  RESOURCE = 'resource',
}

/**
 * Text content
 */
export interface MCPTextContent {
  type: MCPContentType.TEXT;
  text: string;
}

/**
 * Image content
 */
export interface MCPImageContent {
  type: MCPContentType.IMAGE;
  data: string;
  mimeType: string;
}

/**
 * Embedded resource content
 */
export interface MCPResourceContent {
  type: MCPContentType.RESOURCE;
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };
}

/**
 * Content union type
 */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

/**
 * Tool call result
 */
export interface MCPToolCallResult {
  /** Result content */
  content: MCPContent[];
  /** Whether the tool execution resulted in an error */
  isError?: boolean;
}

// ============================================================================
// Resource Types
// ============================================================================

/**
 * MCP Resource definition
 */
export interface MCPResource {
  /** Resource URI */
  uri: string;
  /** Resource name */
  name: string;
  /** Resource description */
  description?: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * Resource list response
 */
export interface MCPResourceListResult {
  /** Available resources */
  resources: MCPResource[];
  /** Pagination cursor for next page */
  nextCursor?: string;
}

/**
 * Resource template (for dynamic resources)
 */
export interface MCPResourceTemplate {
  /** URI template (RFC 6570) */
  uriTemplate: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** MIME type */
  mimeType?: string;
}

/**
 * Resource templates list response
 */
export interface MCPResourceTemplatesResult {
  /** Available resource templates */
  resourceTemplates: MCPResourceTemplate[];
}

/**
 * Resource read parameters
 */
export interface MCPResourceReadParams {
  /** Resource URI */
  uri: string;
}

/**
 * Resource read result
 */
export interface MCPResourceReadResult {
  /** Resource contents */
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * Prompt argument definition
 */
export interface MCPPromptArgument {
  /** Argument name */
  name: string;
  /** Argument description */
  description?: string;
  /** Whether the argument is required */
  required?: boolean;
}

/**
 * MCP Prompt definition
 */
export interface MCPPrompt {
  /** Prompt name (unique identifier) */
  name: string;
  /** Prompt description */
  description?: string;
  /** Prompt arguments */
  arguments?: MCPPromptArgument[];
}

/**
 * Prompt list response
 */
export interface MCPPromptListResult {
  /** Available prompts */
  prompts: MCPPrompt[];
  /** Pagination cursor for next page */
  nextCursor?: string;
}

/**
 * Prompt message role
 */
export enum MCPPromptRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

/**
 * Prompt message
 */
export interface MCPPromptMessage {
  /** Message role */
  role: MCPPromptRole;
  /** Message content */
  content: MCPTextContent | MCPImageContent | MCPResourceContent;
}

/**
 * Prompt get parameters
 */
export interface MCPPromptGetParams {
  /** Prompt name */
  name: string;
  /** Prompt arguments */
  arguments?: Record<string, string>;
}

/**
 * Prompt get result
 */
export interface MCPPromptGetResult {
  /** Prompt description */
  description?: string;
  /** Prompt messages */
  messages: MCPPromptMessage[];
}

// ============================================================================
// Logging Types
// ============================================================================

/**
 * Log level
 */
export enum MCPLogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  NOTICE = 'notice',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
  ALERT = 'alert',
  EMERGENCY = 'emergency',
}

/**
 * Log message notification
 */
export interface MCPLogMessage {
  /** Log level */
  level: MCPLogLevel;
  /** Logger name */
  logger?: string;
  /** Log message */
  data: unknown;
}

// ============================================================================
// Client Interface
// ============================================================================

/**
 * MCP Client configuration
 */
export interface MCPClientConfig {
  /** Server ID (unique identifier) */
  serverId: string;
  /** Server name (human-readable) */
  serverName: string;
  /** Transport configuration */
  transport: MCPTransportConfigUnion;
  /** Client info to send during initialization */
  clientInfo?: MCPClientInfo;
  /** Client capabilities to advertise */
  capabilities?: MCPCapabilities;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Request timeout in milliseconds */
  requestTimeoutMs?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * MCP Client connection state
 */
export enum MCPConnectionState {
  /** Not connected */
  DISCONNECTED = 'disconnected',
  /** Connecting in progress */
  CONNECTING = 'connecting',
  /** Connected and ready */
  CONNECTED = 'connected',
  /** Initializing protocol */
  INITIALIZING = 'initializing',
  /** Ready for use */
  READY = 'ready',
  /** Reconnecting after disconnect */
  RECONNECTING = 'reconnecting',
  /** Error state */
  ERROR = 'error',
}

/**
 * MCP operation result
 */
export interface MCPOperationResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data (if successful) */
  data?: T;
  /** Error message (if failed) */
  error?: string;
  /** Error code (if failed) */
  errorCode?: number;
  /** Operation duration in milliseconds */
  durationMs?: number;
}

/**
 * MCP Client statistics
 */
export interface MCPClientStatistics {
  /** Server ID */
  serverId: string;
  /** Total requests sent */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average response time in milliseconds */
  averageResponseTimeMs: number;
  /** Total tool calls */
  totalToolCalls: number;
  /** Total resource reads */
  totalResourceReads: number;
  /** Total prompt gets */
  totalPromptGets: number;
  /** Connection uptime in milliseconds */
  uptimeMs: number;
  /** Number of reconnections */
  reconnectionCount: number;
  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * MCP event types
 */
export enum MCPEventType {
  /** Connection state changed */
  CONNECTION_STATE_CHANGED = 'connection_state_changed',
  /** Server notification received */
  NOTIFICATION = 'notification',
  /** Tools list changed */
  TOOLS_CHANGED = 'tools_changed',
  /** Resources list changed */
  RESOURCES_CHANGED = 'resources_changed',
  /** Prompts list changed */
  PROMPTS_CHANGED = 'prompts_changed',
  /** Log message received */
  LOG_MESSAGE = 'log_message',
  /** Error occurred */
  ERROR = 'error',
}

/**
 * MCP event callback
 */
export type MCPEventCallback<T = unknown> = (event: {
  type: MCPEventType;
  serverId: string;
  data: T;
  timestamp: Date;
}) => void;

/**
 * MCP subscription
 */
export interface MCPSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * MCP Client interface
 */
export interface IMCPClient {
  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Connect to the MCP server
   */
  connect(): Promise<MCPOperationResult>;

  /**
   * Disconnect from the MCP server
   */
  disconnect(): Promise<MCPOperationResult>;

  /**
   * Get current connection state
   */
  getConnectionState(): MCPConnectionState;

  /**
   * Check if client is ready for operations
   */
  isReady(): boolean;

  /**
   * Get server info (available after initialization)
   */
  getServerInfo(): MCPServerInfo | undefined;

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------

  /**
   * List available tools
   */
  listTools(cursor?: string): Promise<MCPOperationResult<MCPToolListResult>>;

  /**
   * Call a tool
   */
  callTool(params: MCPToolCallParams): Promise<MCPOperationResult<MCPToolCallResult>>;

  /**
   * Get a specific tool definition
   */
  getTool(name: string): Promise<MCPOperationResult<MCPTool | undefined>>;

  // -------------------------------------------------------------------------
  // Resources
  // -------------------------------------------------------------------------

  /**
   * List available resources
   */
  listResources(cursor?: string): Promise<MCPOperationResult<MCPResourceListResult>>;

  /**
   * List resource templates
   */
  listResourceTemplates(): Promise<MCPOperationResult<MCPResourceTemplatesResult>>;

  /**
   * Read a resource
   */
  readResource(params: MCPResourceReadParams): Promise<MCPOperationResult<MCPResourceReadResult>>;

  /**
   * Subscribe to resource updates
   */
  subscribeResource(uri: string): Promise<MCPOperationResult>;

  /**
   * Unsubscribe from resource updates
   */
  unsubscribeResource(uri: string): Promise<MCPOperationResult>;

  // -------------------------------------------------------------------------
  // Prompts
  // -------------------------------------------------------------------------

  /**
   * List available prompts
   */
  listPrompts(cursor?: string): Promise<MCPOperationResult<MCPPromptListResult>>;

  /**
   * Get a prompt
   */
  getPrompt(params: MCPPromptGetParams): Promise<MCPOperationResult<MCPPromptGetResult>>;

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  /**
   * Ping the server
   */
  ping(): Promise<MCPOperationResult<{ latencyMs: number }>>;

  /**
   * Set logging level
   */
  setLoggingLevel(level: MCPLogLevel): Promise<MCPOperationResult>;

  /**
   * Get client statistics
   */
  getStatistics(): MCPClientStatistics;

  /**
   * Reset statistics
   */
  resetStatistics(): void;

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------

  /**
   * Subscribe to events
   */
  subscribe(event: MCPEventType, callback: MCPEventCallback): MCPSubscription;

  /**
   * Unsubscribe from all events
   */
  unsubscribeAll(): void;
}

/**
 * MCP Transport interface
 */
export interface IMCPTransport {
  /**
   * Connect to the server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the server
   */
  disconnect(): Promise<void>;

  /**
   * Send a request and wait for response
   */
  sendRequest<T>(request: JsonRpcRequest): Promise<JsonRpcResponse<T>>;

  /**
   * Send a notification (no response expected)
   */
  sendNotification(notification: JsonRpcNotification): void;

  /**
   * Set message handler for incoming messages
   */
  onMessage(handler: (message: JsonRpcNotification | JsonRpcResponse) => void): void;

  /**
   * Set error handler
   */
  onError(handler: (error: Error) => void): void;

  /**
   * Set close handler
   */
  onClose(handler: (code?: number, reason?: string) => void): void;

  /**
   * Check if transport is connected
   */
  isConnected(): boolean;
}

// ============================================================================
// Manager Interface
// ============================================================================

/**
 * MCP Manager configuration
 */
export interface MCPManagerConfig {
  /** Default request timeout in milliseconds */
  defaultRequestTimeoutMs?: number;
  /** Default auto-reconnect setting */
  defaultAutoReconnect?: boolean;
  /** Maximum concurrent connections */
  maxConcurrentConnections?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * MCP Manager interface for managing multiple clients
 */
export interface IMCPManager {
  /**
   * Register a server configuration
   */
  registerServer(config: MCPClientConfig): void;

  /**
   * Unregister a server
   */
  unregisterServer(serverId: string): void;

  /**
   * Get a client by server ID
   */
  getClient(serverId: string): IMCPClient | undefined;

  /**
   * Get all registered clients
   */
  getAllClients(): Map<string, IMCPClient>;

  /**
   * Connect to a specific server
   */
  connect(serverId: string): Promise<MCPOperationResult>;

  /**
   * Connect to all registered servers
   */
  connectAll(): Promise<Map<string, MCPOperationResult>>;

  /**
   * Disconnect from a specific server
   */
  disconnect(serverId: string): Promise<MCPOperationResult>;

  /**
   * Disconnect from all servers
   */
  disconnectAll(): Promise<Map<string, MCPOperationResult>>;

  /**
   * List all available tools across all connected servers
   */
  listAllTools(): Promise<Map<string, MCPTool[]>>;

  /**
   * Call a tool on a specific server
   */
  callTool(
    serverId: string,
    params: MCPToolCallParams
  ): Promise<MCPOperationResult<MCPToolCallResult>>;

  /**
   * Find servers that provide a specific tool
   */
  findServersWithTool(toolName: string): string[];

  /**
   * Get manager statistics
   */
  getStatistics(): {
    totalServers: number;
    connectedServers: number;
    totalToolCalls: number;
    totalResourceReads: number;
  };

  /**
   * Dispose the manager and all clients
   */
  dispose(): Promise<void>;
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default MCP client configuration
 */
export const DEFAULT_MCP_CLIENT_CONFIG: Partial<MCPClientConfig> = {
  requestTimeoutMs: 30000,
  autoReconnect: true,
  debug: false,
  clientInfo: {
    name: 'autonomous-coding-agents',
    version: '0.1.0',
  },
  capabilities: {
    tools: { listChanged: true },
    resources: { subscribe: true, listChanged: true },
    prompts: { listChanged: true },
    logging: {},
  },
};

/**
 * Default MCP manager configuration
 */
export const DEFAULT_MCP_MANAGER_CONFIG: MCPManagerConfig = {
  defaultRequestTimeoutMs: 30000,
  defaultAutoReconnect: true,
  maxConcurrentConnections: 10,
  debug: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a response is an error response
 */
export function isJsonRpcError(response: JsonRpcResponse): response is JsonRpcErrorResponse {
  return 'error' in response;
}

/**
 * Check if a response is a success response
 */
export function isJsonRpcSuccess<T>(response: JsonRpcResponse<T>): response is JsonRpcSuccessResponse<T> {
  return 'result' in response;
}

/**
 * Create a JSON-RPC request
 */
export function createJsonRpcRequest(
  method: string,
  params?: Record<string, unknown>,
  id?: string | number
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: id ?? Math.random().toString(36).substring(2),
    method,
    params,
  };
}

/**
 * Create a JSON-RPC notification
 */
export function createJsonRpcNotification(
  method: string,
  params?: Record<string, unknown>
): JsonRpcNotification {
  return {
    jsonrpc: '2.0',
    method,
    params,
  };
}

/**
 * Create a text content object
 */
export function createTextContent(text: string): MCPTextContent {
  return {
    type: MCPContentType.TEXT,
    text,
  };
}

/**
 * Create an image content object
 */
export function createImageContent(data: string, mimeType: string): MCPImageContent {
  return {
    type: MCPContentType.IMAGE,
    data,
    mimeType,
  };
}

/**
 * Get transport type from config
 */
export function getTransportType(config: MCPTransportConfigUnion): MCPTransportType {
  return config.type;
}

/**
 * Validate MCP client configuration
 */
export function validateMCPClientConfig(config: MCPClientConfig): string[] {
  const errors: string[] = [];

  if (!config.serverId) {
    errors.push('serverId is required');
  }

  if (!config.serverName) {
    errors.push('serverName is required');
  }

  if (!config.transport) {
    errors.push('transport configuration is required');
  } else {
    switch (config.transport.type) {
      case MCPTransportType.STDIO:
        if (!(config.transport as MCPStdioTransportConfig).command) {
          errors.push('command is required for STDIO transport');
        }
        break;
      case MCPTransportType.HTTP_SSE:
        if (!(config.transport as MCPHttpTransportConfig).url) {
          errors.push('url is required for HTTP/SSE transport');
        }
        break;
      case MCPTransportType.WEBSOCKET:
        if (!(config.transport as MCPWebSocketTransportConfig).url) {
          errors.push('url is required for WebSocket transport');
        }
        break;
      default:
        errors.push(`Unknown transport type: ${(config.transport as MCPTransportConfig).type}`);
    }
  }

  return errors;
}
