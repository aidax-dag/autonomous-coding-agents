/**
 * Tests for LSP Stdio Transport (Content-Length framing)
 */

import { LspStdioTransport, createLspStdioTransport } from '@/core/lsp';
import type { LspJsonRpcMessage } from '@/core/lsp';
import { EventEmitter } from 'events';

// ============================================================================
// Mock child_process
// ============================================================================

const mockStdin = {
  write: jest.fn(),
};

let mockStdout: EventEmitter;
let mockProcess: EventEmitter & {
  stdin: typeof mockStdin;
  stdout: EventEmitter;
  pid: number;
  killed: boolean;
  kill: jest.Mock;
};

jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    mockStdout = new EventEmitter();
    mockProcess = Object.assign(new EventEmitter(), {
      stdin: mockStdin,
      stdout: mockStdout,
      pid: 12345,
      killed: false,
      kill: jest.fn(() => { mockProcess.killed = true; }),
    });
    return mockProcess;
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

function encodeLspFrame(msg: LspJsonRpcMessage): Buffer {
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  return Buffer.from(header + body);
}

// ============================================================================
// Tests
// ============================================================================

describe('LspStdioTransport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('connect/disconnect lifecycle', () => {
    it('should connect and report isConnected', async () => {
      const transport = new LspStdioTransport('test-server', ['--stdio']);
      await transport.connect();

      expect(transport.isConnected()).toBe(true);
    });

    it('should disconnect and report not connected', async () => {
      const transport = new LspStdioTransport('test-server');
      await transport.connect();

      await transport.disconnect();

      expect(transport.isConnected()).toBe(false);
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });

  describe('send', () => {
    it('should write Content-Length framed message to stdin', async () => {
      const transport = new LspStdioTransport('test-server');
      await transport.connect();

      const msg: LspJsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { capabilities: {} },
      };

      await transport.send(msg);

      const written = mockStdin.write.mock.calls[0][0] as string;
      expect(written).toMatch(/^Content-Length: \d+\r\n\r\n/);

      // Extract body from written data
      const bodyStart = written.indexOf('\r\n\r\n') + 4;
      const body = written.slice(bodyStart);
      expect(JSON.parse(body)).toEqual(msg);
    });

    it('should throw when not connected', async () => {
      const transport = new LspStdioTransport('test-server');

      await expect(transport.send({
        jsonrpc: '2.0',
        id: 1,
        method: 'test',
      })).rejects.toThrow('Transport not connected');
    });
  });

  describe('receive - Content-Length framing', () => {
    it('should parse a complete frame and call message handler', async () => {
      const transport = new LspStdioTransport('test-server');
      const handler = jest.fn();
      transport.onMessage(handler);

      await transport.connect();

      const response: LspJsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: {} },
      };

      mockStdout.emit('data', encodeLspFrame(response));

      expect(handler).toHaveBeenCalledWith(response);
    });

    it('should parse a notification and call notification handler', async () => {
      const transport = new LspStdioTransport('test-server');
      const notifHandler = jest.fn();
      transport.onNotification(notifHandler);

      await transport.connect();

      const notification: LspJsonRpcMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/publishDiagnostics',
        params: { uri: 'file:///test.ts', diagnostics: [] },
      };

      mockStdout.emit('data', encodeLspFrame(notification));

      expect(notifHandler).toHaveBeenCalledWith(
        'textDocument/publishDiagnostics',
        { uri: 'file:///test.ts', diagnostics: [] },
      );
    });

    it('should buffer incomplete frames until complete', async () => {
      const transport = new LspStdioTransport('test-server');
      const handler = jest.fn();
      transport.onMessage(handler);

      await transport.connect();

      const response: LspJsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        result: { value: 'hello' },
      };

      const frame = encodeLspFrame(response);

      // Split into two chunks
      const mid = Math.floor(frame.length / 2);
      mockStdout.emit('data', frame.subarray(0, mid));
      expect(handler).not.toHaveBeenCalled();

      mockStdout.emit('data', frame.subarray(mid));
      expect(handler).toHaveBeenCalledWith(response);
    });

    it('should handle multiple messages in one data event', async () => {
      const transport = new LspStdioTransport('test-server');
      const handler = jest.fn();
      transport.onMessage(handler);

      await transport.connect();

      const msg1: LspJsonRpcMessage = { jsonrpc: '2.0', id: 1, result: 'a' };
      const msg2: LspJsonRpcMessage = { jsonrpc: '2.0', id: 2, result: 'b' };

      const combined = Buffer.concat([encodeLspFrame(msg1), encodeLspFrame(msg2)]);
      mockStdout.emit('data', combined);

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(msg1);
      expect(handler).toHaveBeenCalledWith(msg2);
    });

    it('should handle split across header boundary', async () => {
      const transport = new LspStdioTransport('test-server');
      const handler = jest.fn();
      transport.onMessage(handler);

      await transport.connect();

      const response: LspJsonRpcMessage = { jsonrpc: '2.0', id: 3, result: null };
      const frame = encodeLspFrame(response);

      // Split right after "Content-Length: "
      const splitAt = 16;
      mockStdout.emit('data', frame.subarray(0, splitAt));
      expect(handler).not.toHaveBeenCalled();

      mockStdout.emit('data', frame.subarray(splitAt));
      expect(handler).toHaveBeenCalledWith(response);
    });
  });

  describe('factory', () => {
    it('should create transport via factory function', () => {
      const transport = createLspStdioTransport('server', ['--arg']);
      expect(transport).toBeInstanceOf(LspStdioTransport);
    });
  });
});
