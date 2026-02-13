/**
 * MCP Client
 *
 * Connects to external MCP servers, discovers tools, and invokes them.
 *
 * @module core/mcp/mcp-client
 */

import type {
  IMCPClient,
  IMCPTransport,
  MCPServerConfig,
  MCPToolDefinition,
  MCPToolResult,
  MCPResourceDefinition,
  JsonRpcMessage,
} from './interfaces/mcp.interface';
import { StdioTransport } from './mcp-transport/stdio-transport';
import { SSETransport } from './mcp-transport/sse-transport';
import { HttpTransport } from './mcp-transport/http-transport';

/**
 * MCP Client
 *
 * JSON-RPC 2.0 client for MCP protocol communication.
 */
export class MCPClient implements IMCPClient {
  private transport: IMCPTransport | null = null;
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private requestId = 0;

  async connect(config: MCPServerConfig): Promise<void> {
    if (config.transport === 'stdio') {
      if (!config.command) throw new Error('stdio transport requires command');
      this.transport = new StdioTransport(config.command, config.args);
    } else if (config.transport === 'http') {
      if (!config.url) throw new Error('http transport requires url');
      this.transport = new HttpTransport({ url: config.url, headers: config.headers });
    } else {
      if (!config.url) throw new Error('sse transport requires url');
      this.transport = new SSETransport(config.url);
    }

    this.transport.onMessage((msg) => this.handleMessage(msg));
    await this.transport.connect();

    // Initialize handshake
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'aca-mcp-client', version: '1.0.0' },
    });
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.disconnect();
      this.transport = null;
    }
    this.pendingRequests.clear();
  }

  async listTools(): Promise<MCPToolDefinition[]> {
    const result = await this.sendRequest('tools/list', {});
    const response = result as { tools?: MCPToolDefinition[] };
    return response.tools ?? [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const result = await this.sendRequest('tools/call', { name, arguments: args });
    return result as MCPToolResult;
  }

  async listResources(): Promise<MCPResourceDefinition[]> {
    const result = await this.sendRequest('resources/list', {});
    const response = result as { resources?: MCPResourceDefinition[] };
    return response.resources ?? [];
  }

  isConnected(): boolean {
    return this.transport?.isConnected() ?? false;
  }

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.transport) throw new Error('Not connected');

    const id = ++this.requestId;
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.transport!.send(message).catch(reject);
    });
  }

  private handleMessage(msg: JsonRpcMessage): void {
    if (msg.id !== undefined) {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error.message));
        } else {
          pending.resolve(msg.result);
        }
      }
    }
  }
}

/**
 * Create an MCP client
 */
export function createMCPClient(): MCPClient {
  return new MCPClient();
}
