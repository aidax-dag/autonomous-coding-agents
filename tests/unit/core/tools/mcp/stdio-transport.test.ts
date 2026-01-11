/**
 * STDIO Transport Tests
 *
 * Tests for the STDIO transport implementation.
 *
 * @module tests/unit/core/tools/mcp/stdio-transport.test
 */

import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import { ChildProcess } from 'child_process';
import {
  StdioTransport,
  MCPTransportType,
  MCPStdioTransportConfig,
  createJsonRpcRequest,
  createJsonRpcNotification,
} from '../../../../../src/core/tools/mcp/index.js';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import { spawn } from 'child_process';

describe('StdioTransport', () => {
  let transport: StdioTransport;
  let mockProcess: MockChildProcess;
  let config: MCPStdioTransportConfig;

  class MockChildProcess extends EventEmitter {
    stdin: Writable;
    stdout: Readable;
    stderr: Readable;
    killed = false;
    pid = 12345;

    constructor() {
      super();
      this.stdin = new Writable({
        write: (_chunk, _encoding, callback) => {
          callback();
        },
      });
      this.stdout = new Readable({
        read() {},
      });
      this.stderr = new Readable({
        read() {},
      });
    }

    kill(signal?: string): boolean {
      this.killed = true;
      setTimeout(() => {
        this.emit('exit', signal === 'SIGKILL' ? 137 : 0, signal);
      }, 10);
      return true;
    }
  }

  beforeEach(() => {
    config = {
      type: MCPTransportType.STDIO,
      command: 'node',
      args: ['server.js'],
      connectionTimeoutMs: 5000,
      requestTimeoutMs: 3000,
    };

    mockProcess = new MockChildProcess();

    (spawn as jest.Mock).mockImplementation(() => {
      // Emit spawn event asynchronously
      setTimeout(() => mockProcess.emit('spawn'), 10);
      return mockProcess as unknown as ChildProcess;
    });

    transport = new StdioTransport(config);
  });

  afterEach(async () => {
    if (transport.isConnected()) {
      await transport.disconnect();
    }
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should spawn process and connect successfully', async () => {
      const connectPromise = transport.connect();
      await connectPromise;

      expect(spawn).toHaveBeenCalledWith('node', ['server.js'], expect.any(Object));
      expect(transport.isConnected()).toBe(true);
    });

    it('should throw error if already connected', async () => {
      await transport.connect();

      await expect(transport.connect()).rejects.toThrow('Transport is already connected');
    });

    it('should handle spawn error', async () => {
      (spawn as jest.Mock).mockImplementation(() => {
        const proc = new MockChildProcess();
        setTimeout(() => proc.emit('error', new Error('Spawn failed')), 10);
        return proc as unknown as ChildProcess;
      });

      transport = new StdioTransport(config);
      await expect(transport.connect()).rejects.toThrow('Spawn failed');
    });

    it('should timeout on connection', async () => {
      const timeoutConfig = { ...config, connectionTimeoutMs: 50 };
      transport = new StdioTransport(timeoutConfig);

      (spawn as jest.Mock).mockImplementation(() => {
        // Don't emit spawn event to trigger timeout
        return new MockChildProcess() as unknown as ChildProcess;
      });

      await expect(transport.connect()).rejects.toThrow('Connection timeout');
    });

    it('should set up process with correct options', async () => {
      const fullConfig: MCPStdioTransportConfig = {
        ...config,
        cwd: '/test/dir',
        env: { TEST_VAR: 'value' },
      };
      transport = new StdioTransport(fullConfig);

      await transport.connect();

      expect(spawn).toHaveBeenCalledWith(
        'node',
        ['server.js'],
        expect.objectContaining({
          cwd: '/test/dir',
          env: expect.objectContaining({ TEST_VAR: 'value' }),
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      );
    });
  });

  describe('disconnect', () => {
    it('should disconnect from connected state', async () => {
      await transport.connect();
      expect(transport.isConnected()).toBe(true);

      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      await expect(transport.disconnect()).resolves.toBeUndefined();
    });

    it('should reject pending requests on disconnect', async () => {
      await transport.connect();

      // Start a request but don't respond
      const request = createJsonRpcRequest('test/method');
      const requestPromise = transport.sendRequest(request);

      // Set up rejection expectation before disconnect to avoid unhandled rejection
      const rejectionPromise = expect(requestPromise).rejects.toThrow('Transport disconnected');

      // Disconnect while request is pending
      await transport.disconnect();

      await rejectionPromise;
    });
  });

  describe('sendRequest', () => {
    it('should throw error when not connected', async () => {
      const request = createJsonRpcRequest('test/method');
      await expect(transport.sendRequest(request)).rejects.toThrow('Transport is not connected');
    });

    it('should send request and receive response', async () => {
      await transport.connect();

      const request = createJsonRpcRequest('test/method', { param: 'value' }, 1);

      // Simulate response
      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { success: true },
        });
        mockProcess.stdout.push(response + '\n');
      }, 20);

      const response = await transport.sendRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: { success: true },
      });
    });

    it('should handle error response', async () => {
      await transport.connect();

      const request = createJsonRpcRequest('test/method', undefined, 2);

      // Simulate error response
      setTimeout(() => {
        const response = JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          error: {
            code: -32601,
            message: 'Method not found',
          },
        });
        mockProcess.stdout.push(response + '\n');
      }, 20);

      const response = await transport.sendRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32601,
          message: 'Method not found',
        },
      });
    });

    it('should timeout on no response', async () => {
      const shortTimeoutConfig = { ...config, requestTimeoutMs: 50 };
      transport = new StdioTransport(shortTimeoutConfig);
      await transport.connect();

      const request = createJsonRpcRequest('test/method', undefined, 3);

      await expect(transport.sendRequest(request)).rejects.toThrow(
        'Request timeout for test/method'
      );
    });
  });

  describe('sendNotification', () => {
    it('should throw error when not connected', () => {
      const notification = createJsonRpcNotification('test/notify');
      expect(() => transport.sendNotification(notification)).toThrow(
        'Transport is not connected'
      );
    });

    it('should send notification without waiting for response', async () => {
      await transport.connect();

      const writeSpy = jest.spyOn(mockProcess.stdin, 'write');
      const notification = createJsonRpcNotification('test/notify', { data: 'test' });

      transport.sendNotification(notification);

      expect(writeSpy).toHaveBeenCalledWith(
        expect.stringContaining('"method":"test/notify"')
      );
    });
  });

  describe('event handlers', () => {
    it('should call message handler for incoming notifications', async () => {
      await transport.connect();

      const messageHandler = jest.fn();
      transport.onMessage(messageHandler);

      // Simulate incoming notification
      const notification = JSON.stringify({
        jsonrpc: '2.0',
        method: 'server/notify',
        params: { data: 'incoming' },
      });
      mockProcess.stdout.push(notification + '\n');

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'server/notify',
          params: { data: 'incoming' },
        })
      );
    });

    it('should call error handler for parse errors', async () => {
      await transport.connect();

      const errorHandler = jest.fn();
      transport.onError(errorHandler);

      // Simulate invalid JSON
      mockProcess.stdout.push('invalid json\n');

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call close handler when process exits', async () => {
      await transport.connect();

      const closeHandler = jest.fn();
      transport.onClose(closeHandler);

      // Simulate process exit
      mockProcess.emit('exit', 0, null);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(closeHandler).toHaveBeenCalledWith(0, undefined);
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(transport.isConnected()).toBe(false);
    });

    it('should return true after connect', async () => {
      await transport.connect();
      expect(transport.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      await transport.connect();
      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });
  });
});
