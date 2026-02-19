/**
 * MCP Server
 *
 * Exposes ACA capabilities as an MCP server for external clients.
 *
 * @module core/mcp/mcp-server
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import type {
  IMCPServer,
  MCPToolDefinition,
  MCPToolHandler,
  MCPToolResult,
  JsonRpcMessage,
} from './interfaces/mcp.interface';

/**
 * MCP Server
 *
 * HTTP-based MCP server that handles JSON-RPC requests.
 */
export class MCPServer implements IMCPServer {
  private tools: Map<string, { definition: MCPToolDefinition; handler: MCPToolHandler }> = new Map();
  private server: Server | null = null;
  private running = false;

  async start(port = 3100): Promise<void> {
    if (this.running) return;

    this.server = createServer((req, res) => this.handleRequest(req, res));
    await new Promise<void>((resolve) => {
      this.server!.listen(port, resolve);
    });
    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
      this.server!.close((err) => (err ? reject(err) : resolve()));
    });
    this.server = null;
    this.running = false;
  }

  registerTool(definition: MCPToolDefinition, handler: MCPToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
  }

  unregisterTool(name: string): boolean {
    return this.tools.delete(name);
  }

  isRunning(): boolean {
    return this.running;
  }

  getRegisteredTools(): MCPToolDefinition[] {
    return Array.from(this.tools.values()).map((toolEntry) => toolEntry.definition);
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      try {
        const message = JSON.parse(body) as JsonRpcMessage;
        const result = await this.processMessage(message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32600, message: err.message },
          }),
        );
      }
    });
  }

  private async processMessage(message: JsonRpcMessage): Promise<JsonRpcMessage> {
    const response: JsonRpcMessage = { jsonrpc: '2.0', id: message.id };

    switch (message.method) {
      case 'initialize':
        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'aca-mcp-server', version: '1.0.0' },
        };
        break;

      case 'tools/list':
        response.result = {
          tools: Array.from(this.tools.values()).map((toolEntry) => toolEntry.definition),
        };
        break;

      case 'tools/call': {
        const params = message.params as { name: string; arguments: Record<string, unknown> };
        const tool = this.tools.get(params.name);
        if (!tool) {
          response.error = { code: -32602, message: `Unknown tool: ${params.name}` };
        } else {
          try {
            response.result = await tool.handler(params.arguments);
          } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            response.result = {
              content: [{ type: 'text', text: error.message }],
              isError: true,
            } satisfies MCPToolResult;
          }
        }
        break;
      }

      default:
        response.error = { code: -32601, message: `Method not found: ${message.method}` };
    }

    return response;
  }
}

/**
 * Create an MCP server
 */
export function createMCPServer(): MCPServer {
  return new MCPServer();
}
