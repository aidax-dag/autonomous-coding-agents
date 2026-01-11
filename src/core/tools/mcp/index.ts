/**
 * MCP (Model Context Protocol) Module
 *
 * Provides MCP client, transport, and manager implementations
 * for communicating with MCP servers.
 *
 * @module core/tools/mcp
 */

// Interfaces and types
export {
  // Transport types
  MCPTransportType,
  MCPTransportConfig,
  MCPStdioTransportConfig,
  MCPHttpTransportConfig,
  MCPWebSocketTransportConfig,
  MCPTransportConfigUnion,

  // JSON-RPC types
  JsonRpcRequest,
  JsonRpcNotification,
  JsonRpcSuccessResponse,
  JsonRpcError,
  JsonRpcErrorResponse,
  JsonRpcResponse,
  JsonRpcErrorCode,

  // MCP protocol types
  MCP_PROTOCOL_VERSION,
  MCPCapabilities,
  MCPClientInfo,
  MCPServerInfo,
  MCPInitializeParams,
  MCPInitializeResult,

  // Tool types
  MCPJsonSchema,
  MCPJsonSchemaProperty,
  MCPTool,
  MCPToolListResult,
  MCPToolCallParams,
  MCPContentType,
  MCPTextContent,
  MCPImageContent,
  MCPResourceContent,
  MCPContent,
  MCPToolCallResult,

  // Resource types
  MCPResource,
  MCPResourceListResult,
  MCPResourceTemplate,
  MCPResourceTemplatesResult,
  MCPResourceReadParams,
  MCPResourceReadResult,

  // Prompt types
  MCPPromptArgument,
  MCPPrompt,
  MCPPromptListResult,
  MCPPromptRole,
  MCPPromptMessage,
  MCPPromptGetParams,
  MCPPromptGetResult,

  // Logging types
  MCPLogLevel,
  MCPLogMessage,

  // Client types
  MCPClientConfig,
  MCPConnectionState,
  MCPOperationResult,
  MCPClientStatistics,
  MCPEventType,
  MCPEventCallback,
  MCPSubscription,

  // Interfaces
  IMCPClient,
  IMCPTransport,
  IMCPManager,

  // Manager types
  MCPManagerConfig,

  // Default configs
  DEFAULT_MCP_CLIENT_CONFIG,
  DEFAULT_MCP_MANAGER_CONFIG,

  // Helper functions
  isJsonRpcError,
  isJsonRpcSuccess,
  createJsonRpcRequest,
  createJsonRpcNotification,
  createTextContent,
  createImageContent,
  getTransportType,
  validateMCPClientConfig,
} from './mcp.interface.js';

// Transport implementations
export { StdioTransport } from './stdio-transport.js';

// Client implementation
export { MCPClient } from './mcp-client.js';

// Manager implementation
export { MCPManager, getMCPManager, resetMCPManager } from './mcp-manager.js';
