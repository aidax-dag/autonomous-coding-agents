/**
 * Stdio Transport
 *
 * JSON-RPC 2.0 over stdin/stdout for MCP communication.
 *
 * @module core/mcp/mcp-transport/stdio-transport
 */

import { spawn, type ChildProcess } from 'child_process';
import type { IMCPTransport, JsonRpcMessage } from '../interfaces/mcp.interface';

/**
 * Stdio Transport
 *
 * Communicates with MCP servers via child process stdin/stdout.
 */
export class StdioTransport implements IMCPTransport {
  private command: string;
  private args: string[];
  private process: ChildProcess | null = null;
  private messageHandler: ((msg: JsonRpcMessage) => void) | null = null;
  private buffer = '';

  constructor(command: string, args: string[] = []) {
    this.command = command;
    this.args = args;
  }

  async connect(): Promise<void> {
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.on('error', (error) => {
      throw new Error(`MCP stdio transport error: ${error.message}`);
    });

    // Wait for process to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      if (this.process?.pid) {
        clearTimeout(timeout);
        resolve();
      } else {
        this.process?.on('spawn', () => {
          clearTimeout(timeout);
          resolve();
        });
        this.process?.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.buffer = '';
  }

  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Transport not connected');
    }
    const data = JSON.stringify(message) + '\n';
    this.process.stdin.write(data);
  }

  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const msg = JSON.parse(line) as JsonRpcMessage;
          this.messageHandler?.(msg);
        } catch {
          // Invalid JSON, skip
        }
      }
    }
  }
}

/**
 * Create a stdio transport
 */
export function createStdioTransport(command: string, args?: string[]): StdioTransport {
  return new StdioTransport(command, args);
}
