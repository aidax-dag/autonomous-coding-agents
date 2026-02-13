/**
 * MCP Protocol Interfaces
 *
 * Defines contracts for MCP client/server, transports, and tool registry.
 *
 * @module core/mcp/interfaces/mcp
 */

/**
 * JSON-RPC 2.0 message
 */
export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * MCP tool definition
 */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCP resource definition
 */
export interface MCPResourceDefinition {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
}

/**
 * MCP tool call result
 */
export interface MCPToolResult {
  content: Array<{ type: string; text?: string; data?: unknown }>;
  isError?: boolean;
}

/**
 * MCP server config
 */
export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  /** Extra headers for HTTP/SSE transports */
  headers?: Record<string, string>;
}

/**
 * Transport interface
 */
export interface IMCPTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: JsonRpcMessage): Promise<void>;
  onMessage(handler: (message: JsonRpcMessage) => void): void;
  isConnected(): boolean;
}

/**
 * MCP Client interface
 */
export interface IMCPClient {
  connect(config: MCPServerConfig): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<MCPToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult>;
  listResources(): Promise<MCPResourceDefinition[]>;
  isConnected(): boolean;
}

/**
 * MCP Server interface (ACA as server)
 */
export interface IMCPServer {
  start(port?: number): Promise<void>;
  stop(): Promise<void>;
  registerTool(definition: MCPToolDefinition, handler: MCPToolHandler): void;
  unregisterTool(name: string): boolean;
  isRunning(): boolean;
}

/**
 * Tool handler function type
 */
export type MCPToolHandler = (
  args: Record<string, unknown>,
) => Promise<MCPToolResult>;

/**
 * MCP Tool Registry interface
 */
export interface IMCPToolRegistry {
  discover(client: IMCPClient): Promise<MCPToolDefinition[]>;
  registerAsSkills(tools: MCPToolDefinition[], client: IMCPClient): void;
  getRegisteredTools(): MCPToolDefinition[];
  clear(): void;
}
