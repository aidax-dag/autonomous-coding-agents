/**
 * LSP Stdio Transport
 *
 * Content-Length framed JSON-RPC 2.0 transport over child process stdio.
 * LSP uses `Content-Length: N\r\n\r\n{json}` framing (unlike MCP's newline-delimited).
 *
 * @module core/lsp
 */

import { spawn, type ChildProcess } from 'child_process';
import type { ILSPTransport, LspJsonRpcMessage } from './interfaces/lsp.interface';

// ============================================================================
// Implementation
// ============================================================================

export class LspStdioTransport implements ILSPTransport {
  private process: ChildProcess | null = null;
  private buffer = Buffer.alloc(0);
  private messageHandler: ((message: LspJsonRpcMessage) => void) | null = null;
  private notificationHandler: ((method: string, params: unknown) => void) | null = null;

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
  ) {}

  async connect(): Promise<void> {
    this.process = spawn(this.command, this.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, data]);
      this.parseFrames();
    });

    this.process.on('error', (error) => {
      throw new Error(`LSP stdio transport error: ${error.message}`);
    });

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
    this.buffer = Buffer.alloc(0);
  }

  async send(message: LspJsonRpcMessage): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Transport not connected');
    }
    const body = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
    this.process.stdin.write(header + body);
  }

  onMessage(handler: (message: LspJsonRpcMessage) => void): void {
    this.messageHandler = handler;
  }

  onNotification(handler: (method: string, params: unknown) => void): void {
    this.notificationHandler = handler;
  }

  isConnected(): boolean {
    return this.process !== null && !this.process.killed;
  }

  // ============================================================================
  // Content-Length Framing Parser
  // ============================================================================

  private parseFrames(): void {
    while (true) {
      // Look for header terminator
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      // Parse Content-Length from header
      const headerStr = this.buffer.subarray(0, headerEnd).toString();
      const match = headerStr.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Malformed header — skip past it
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;

      // Wait for full body
      if (this.buffer.length < bodyStart + contentLength) return;

      // Extract and parse body
      const bodyBuf = this.buffer.subarray(bodyStart, bodyStart + contentLength);
      this.buffer = this.buffer.subarray(bodyStart + contentLength);

      try {
        const message = JSON.parse(bodyBuf.toString()) as LspJsonRpcMessage;
        this.dispatchMessage(message);
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  private dispatchMessage(message: LspJsonRpcMessage): void {
    // Responses have an id; notifications have method but no id
    if (message.id !== undefined) {
      this.messageHandler?.(message);
    } else if (message.method) {
      this.notificationHandler?.(message.method, message.params);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLspStdioTransport(command: string, args?: string[]): LspStdioTransport {
  return new LspStdioTransport(command, args);
}
