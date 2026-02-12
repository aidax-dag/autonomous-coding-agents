/**
 * MCP Protocol Module
 *
 * External MCP server connectivity and ACA-as-server exposure.
 *
 * @module core/mcp
 */

export type {
  JsonRpcMessage,
  MCPToolDefinition,
  MCPResourceDefinition,
  MCPToolResult,
  MCPServerConfig,
  IMCPTransport,
  IMCPClient,
  IMCPServer,
  MCPToolHandler,
  IMCPToolRegistry,
} from './interfaces/mcp.interface';

export { StdioTransport, createStdioTransport } from './mcp-transport/stdio-transport';
export { SSETransport, createSSETransport } from './mcp-transport/sse-transport';

export { MCPClient, createMCPClient } from './mcp-client';
export { MCPServer, createMCPServer } from './mcp-server';
export {
  MCPToolRegistry,
  MCPToolSkill,
  createMCPToolRegistry,
} from './mcp-tool-registry';
