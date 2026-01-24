/**
 * STDIO Transport for MCP
 *
 * Implements JSON-RPC communication over standard I/O with a child process.
 *
 * @module core/tools/mcp/stdio-transport
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as readline from 'readline';
import {
  IMCPTransport,
  MCPStdioTransportConfig,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
} from './mcp.interface.js';
import { createLogger, ILogger } from '../../services/logger.js';

/**
 * STDIO Transport implementation
 *
 * Manages communication with MCP server via stdin/stdout of a child process.
 */
export class StdioTransport extends EventEmitter implements IMCPTransport {
  private config: MCPStdioTransportConfig;
  private process: ChildProcess | null = null;
  private connected = false;
  private readonly logger: ILogger = createLogger('StdioTransport');
  private messageHandler: ((message: JsonRpcNotification | JsonRpcResponse) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: ((code?: number, reason?: string) => void) | null = null;
  private pendingRequests: Map<
    string | number,
    {
      resolve: (response: JsonRpcResponse) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  constructor(config: MCPStdioTransportConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the MCP server by spawning a child process
   */
  async connect(): Promise<void> {
    if (this.connected) {
      throw new Error('Transport is already connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        this.cleanup();
      }, this.config.connectionTimeoutMs ?? 30000);

      try {
        // Spawn the MCP server process
        this.process = spawn(this.config.command, this.config.args ?? [], {
          cwd: this.config.cwd,
          env: { ...process.env, ...this.config.env },
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Handle process errors
        this.process.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
          this.cleanup();
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          this.connected = false;
          if (this.closeHandler) {
            this.closeHandler(code ?? undefined, signal ?? undefined);
          }
          this.cleanup();
        });

        // Setup stderr handling for debugging
        if (this.process.stderr) {
          this.process.stderr.on('data', (data) => {
            const message = data.toString();
            // Log stderr for debugging but don't treat as error unless configured
            if (this.config.connectionTimeoutMs) {
              this.logger.debug('[MCP STDIO stderr]', { message });
            }
          });
        }

        // Setup stdout handling with readline for JSON-RPC messages
        if (this.process.stdout) {
          const rl = readline.createInterface({
            input: this.process.stdout,
            crlfDelay: Infinity,
          });

          rl.on('line', (line) => {
            this.handleLine(line);
          });
        }

        // Mark as connected once process is spawned successfully
        this.process.on('spawn', () => {
          clearTimeout(timeout);
          this.connected = true;
          resolve();
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected || !this.process) {
      return;
    }

    return new Promise((resolve) => {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Transport disconnected'));
        this.pendingRequests.delete(id);
      }

      // Kill the process
      if (this.process) {
        // Store the kill timeout so we can clear it when process exits
        const killTimeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);

        this.process.once('exit', () => {
          clearTimeout(killTimeout);
          this.cleanup();
          resolve();
        });

        // Send SIGTERM first, then SIGKILL after timeout
        this.process.kill('SIGTERM');
      } else {
        resolve();
      }
    });
  }

  /**
   * Send a request and wait for response
   */
  async sendRequest<T>(request: JsonRpcRequest): Promise<JsonRpcResponse<T>> {
    if (!this.connected || !this.process?.stdin) {
      throw new Error('Transport is not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout for ${request.method}`));
      }, this.config.requestTimeoutMs ?? 30000);

      this.pendingRequests.set(request.id, {
        resolve: resolve as (response: JsonRpcResponse) => void,
        reject,
        timeout,
      });

      const message = JSON.stringify(request) + '\n';
      this.process!.stdin!.write(message, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pendingRequests.delete(request.id);
          reject(error);
        }
      });
    });
  }

  /**
   * Send a notification (no response expected)
   */
  sendNotification(notification: JsonRpcNotification): void {
    if (!this.connected || !this.process?.stdin) {
      throw new Error('Transport is not connected');
    }

    const message = JSON.stringify(notification) + '\n';
    this.process.stdin.write(message);
  }

  /**
   * Set message handler for incoming messages
   */
  onMessage(handler: (message: JsonRpcNotification | JsonRpcResponse) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Set error handler
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  /**
   * Set close handler
   */
  onClose(handler: (code?: number, reason?: string) => void): void {
    this.closeHandler = handler;
  }

  /**
   * Check if transport is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Handle incoming line from stdout
   */
  private handleLine(line: string): void {
    if (!line.trim()) {
      return;
    }

    try {
      const message = JSON.parse(line);

      // Check if this is a response to a pending request
      if ('id' in message && message.id !== null) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingRequests.delete(message.id);
          pending.resolve(message as JsonRpcResponse);
          return;
        }
      }

      // Otherwise, it's a notification or unsolicited message
      if (this.messageHandler) {
        this.messageHandler(message as JsonRpcNotification | JsonRpcResponse);
      }
    } catch (error) {
      // Parse error - notify error handler
      if (this.errorHandler) {
        this.errorHandler(new Error(`Failed to parse JSON-RPC message: ${line}`));
      }
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.connected = false;
    this.process = null;
    this.pendingRequests.clear();
  }
}
