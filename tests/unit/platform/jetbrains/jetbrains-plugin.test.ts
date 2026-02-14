/**
 * Tests for JetBrains Plugin Module
 *
 * Comprehensive tests covering JSON-RPC 2.0 protocol implementation,
 * ACAJetBrainsClient connection management, request/response lifecycle,
 * notification subscriptions, and high-level API methods.
 *
 * @module platform/jetbrains
 */

import { EventEmitter } from 'events';
import {
  createRequest,
  createNotification,
  serializeMessage,
  parseMessages,
  isResponse,
  isNotification,
  isRequest,
  resetIdCounter,
  JSON_RPC_ERRORS,
  type JsonRpcResponse,
  type JsonRpcNotification,
  type JsonRpcMessage,
} from '@/platform/jetbrains/src/json-rpc';
import { ACAJetBrainsClient, createACAJetBrainsClient } from '@/platform/jetbrains/src/aca-jetbrains-client';
import { DEFAULT_RPC_PORT, DEFAULT_CONNECT_TIMEOUT, DEFAULT_REQUEST_TIMEOUT } from '@/platform/jetbrains/src/types';

// ── Mock net.Socket ────────────────────────────────────────────────

class MockSocket extends EventEmitter {
  destroyed = false;
  written: Buffer[] = [];

  connect(_port: number, _host: string, callback?: () => void): this {
    // Simulate async connection
    process.nextTick(() => {
      if (!this.destroyed) {
        this.emit('connect');
        callback?.();
      }
    });
    return this;
  }

  write(data: Buffer | string): boolean {
    this.written.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    return true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  removeAllListeners(): this {
    super.removeAllListeners();
    return this;
  }
}

// Mock the net module to inject MockSocket
jest.mock('net', () => ({
  Socket: jest.fn().mockImplementation(() => new MockSocket()),
}));

// ── Helpers ────────────────────────────────────────────────────────

function createMockResponse(id: number, result: unknown): Buffer {
  const response: JsonRpcResponse = { jsonrpc: '2.0', id, result };
  return serializeMessage(response);
}

function createMockErrorResponse(id: number, code: number, message: string): Buffer {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    id,
    error: { code, message },
  };
  return serializeMessage(response);
}

function createMockNotification(method: string, params: unknown): Buffer {
  const notification: JsonRpcNotification = { jsonrpc: '2.0', method, params };
  return serializeMessage(notification);
}

// ── JSON-RPC Protocol Tests ────────────────────────────────────────

describe('JSON-RPC Protocol', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe('createRequest', () => {
    it('should generate a valid JSON-RPC 2.0 request structure', () => {
      const req = createRequest('test.method', { key: 'value' });

      expect(req.jsonrpc).toBe('2.0');
      expect(req.method).toBe('test.method');
      expect(req.params).toEqual({ key: 'value' });
      expect(typeof req.id).toBe('number');
    });

    it('should auto-increment ids across calls', () => {
      const req1 = createRequest('method1');
      const req2 = createRequest('method2');
      const req3 = createRequest('method3');

      expect(req1.id).toBe(1);
      expect(req2.id).toBe(2);
      expect(req3.id).toBe(3);
    });

    it('should handle requests without params', () => {
      const req = createRequest('no.params');
      expect(req.params).toBeUndefined();
    });
  });

  describe('createNotification', () => {
    it('should generate a notification without an id field', () => {
      const notif = createNotification('event.happened', { data: 42 });

      expect(notif.jsonrpc).toBe('2.0');
      expect(notif.method).toBe('event.happened');
      expect(notif.params).toEqual({ data: 42 });
      expect('id' in notif).toBe(false);
    });

    it('should handle notifications without params', () => {
      const notif = createNotification('ping');
      expect(notif.params).toBeUndefined();
    });
  });

  describe('serializeMessage', () => {
    it('should include Content-Length header with correct byte count', () => {
      const req = createRequest('test', { a: 1 });
      const serialized = serializeMessage(req);
      const str = serialized.toString('utf8');

      expect(str).toContain('Content-Length:');
      expect(str).toContain('\r\n\r\n');

      const [header, body] = str.split('\r\n\r\n');
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/);
      expect(lengthMatch).not.toBeNull();

      const declaredLength = parseInt(lengthMatch![1], 10);
      expect(declaredLength).toBe(Buffer.byteLength(body, 'utf8'));
    });

    it('should produce valid JSON body after the header', () => {
      const req = createRequest('parse.check', { value: 'hello' });
      const serialized = serializeMessage(req);
      const str = serialized.toString('utf8');
      const body = str.split('\r\n\r\n')[1];

      const parsed = JSON.parse(body);
      expect(parsed.jsonrpc).toBe('2.0');
      expect(parsed.method).toBe('parse.check');
      expect(parsed.params).toEqual({ value: 'hello' });
    });
  });

  describe('parseMessages', () => {
    it('should parse a complete message from buffer', () => {
      const req = createRequest('test.complete');
      const buf = serializeMessage(req);

      const { messages, remainder } = parseMessages(buf);
      expect(messages).toHaveLength(1);
      expect((messages[0] as { method: string }).method).toBe('test.complete');
      expect(remainder.length).toBe(0);
    });

    it('should handle partial messages by returning remainder', () => {
      const req = createRequest('test.partial');
      const full = serializeMessage(req);
      // Only send first half of the buffer
      const partial = full.slice(0, Math.floor(full.length / 2));

      const { messages, remainder } = parseMessages(partial);
      expect(messages).toHaveLength(0);
      expect(remainder.length).toBeGreaterThan(0);
    });

    it('should parse multiple messages from a single buffer', () => {
      const req1 = createRequest('method.one');
      const req2 = createRequest('method.two');
      const combined = Buffer.concat([serializeMessage(req1), serializeMessage(req2)]);

      const { messages, remainder } = parseMessages(combined);
      expect(messages).toHaveLength(2);
      expect((messages[0] as { method: string }).method).toBe('method.one');
      expect((messages[1] as { method: string }).method).toBe('method.two');
      expect(remainder.length).toBe(0);
    });

    it('should handle messages with partial trailing data', () => {
      const req1 = createRequest('complete.msg');
      const req2 = createRequest('incomplete.msg');
      const fullSecond = serializeMessage(req2);
      const partialSecond = fullSecond.slice(0, Math.floor(fullSecond.length / 2));
      const combined = Buffer.concat([serializeMessage(req1), partialSecond]);

      const { messages, remainder } = parseMessages(combined);
      expect(messages).toHaveLength(1);
      expect((messages[0] as { method: string }).method).toBe('complete.msg');
      expect(remainder.length).toBeGreaterThan(0);
    });
  });

  describe('type guards', () => {
    it('isResponse should identify response messages', () => {
      const response: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: 'ok' };
      const request: JsonRpcMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
      const notification: JsonRpcMessage = { jsonrpc: '2.0', method: 'event' };

      expect(isResponse(response)).toBe(true);
      expect(isResponse(request)).toBe(false);
      expect(isResponse(notification)).toBe(false);
    });

    it('isNotification should identify notification messages', () => {
      const notification: JsonRpcMessage = { jsonrpc: '2.0', method: 'event' };
      const request: JsonRpcMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
      const response: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: 'ok' };

      expect(isNotification(notification)).toBe(true);
      expect(isNotification(request)).toBe(false);
      expect(isNotification(response)).toBe(false);
    });

    it('isRequest should identify request messages', () => {
      const request: JsonRpcMessage = { jsonrpc: '2.0', id: 1, method: 'test' };
      const response: JsonRpcMessage = { jsonrpc: '2.0', id: 1, result: 'ok' };
      const notification: JsonRpcMessage = { jsonrpc: '2.0', method: 'event' };

      expect(isRequest(request)).toBe(true);
      expect(isRequest(response)).toBe(false);
      expect(isRequest(notification)).toBe(false);
    });
  });

  describe('error codes', () => {
    it('should have correct standard JSON-RPC error code values', () => {
      expect(JSON_RPC_ERRORS.PARSE_ERROR).toBe(-32700);
      expect(JSON_RPC_ERRORS.INVALID_REQUEST).toBe(-32600);
      expect(JSON_RPC_ERRORS.METHOD_NOT_FOUND).toBe(-32601);
      expect(JSON_RPC_ERRORS.INVALID_PARAMS).toBe(-32602);
      expect(JSON_RPC_ERRORS.INTERNAL_ERROR).toBe(-32603);
    });
  });
});

// ── ACAJetBrainsClient Tests ───────────────────────────────────────

describe('ACAJetBrainsClient', () => {
  let client: ACAJetBrainsClient;

  beforeEach(() => {
    resetIdCounter();
    client = new ACAJetBrainsClient({
      serverUrl: 'http://localhost',
      rpcPort: 6789,
      requestTimeout: 500, // Short timeout for tests
    });
  });

  afterEach(() => {
    client.dispose();
  });

  describe('constructor', () => {
    it('should set default values for optional config fields', () => {
      const minimal = new ACAJetBrainsClient({ serverUrl: 'localhost' });

      // Verify defaults through behavior — port and timeouts
      // cannot inspect private fields, so we verify the object is created
      expect(minimal.isConnected()).toBe(false);
      minimal.dispose();
    });

    it('should accept custom config values', () => {
      const custom = new ACAJetBrainsClient({
        serverUrl: 'http://remote-host',
        rpcPort: 9999,
        authToken: 'secret-token',
        connectTimeout: 5000,
        requestTimeout: 15000,
      });
      expect(custom.isConnected()).toBe(false);
      custom.dispose();
    });
  });

  describe('connect', () => {
    it('should create a TCP socket and connect to the server', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should emit connected event on successful connection', async () => {
      const spy = jest.fn();
      client.on('connected', spy);
      await client.connect();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should resolve immediately if already connected', async () => {
      await client.connect();
      await expect(client.connect()).resolves.toBeUndefined();
    });

    it('should reject if client is disposed', async () => {
      client.dispose();
      await expect(client.connect()).rejects.toThrow('Client is disposed');
    });
  });

  describe('disconnect', () => {
    it('should close the socket and set connected to false', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should emit disconnected event', async () => {
      await client.connect();
      const spy = jest.fn();
      client.on('disconnected', spy);

      client.disconnect();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('should not throw when called without being connected', () => {
      expect(() => client.disconnect()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false before connection', () => {
      expect(client.isConnected()).toBe(false);
    });

    it('should return true after connection', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      await client.connect();
      client.disconnect();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('sendRequest', () => {
    it('should reject if not connected', async () => {
      await expect(client.sendRequest('test')).rejects.toThrow('Not connected');
    });

    it('should serialize and write request to socket', async () => {
      await client.connect();

      // Get the mock socket through the net module
      const net = require('net');
      const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

      // Start request (will timeout, but we can check what was written)
      const promise = client.sendRequest('test.method', { key: 'value' });

      // Verify something was written
      // The auth notification may also be written, so check the last write
      expect(mockSocket.written.length).toBeGreaterThan(0);
      const lastWritten = mockSocket.written[mockSocket.written.length - 1].toString('utf8');
      expect(lastWritten).toContain('test.method');

      // Simulate response to resolve the promise
      const { messages } = parseMessages(mockSocket.written[mockSocket.written.length - 1]);
      const requestId = (messages[0] as { id: number }).id;
      mockSocket.emit('data', createMockResponse(requestId, { status: 'ok' }));

      const result = await promise;
      expect(result).toEqual({ status: 'ok' });
    });

    it('should resolve when matching response arrives', async () => {
      await client.connect();
      const net = require('net');
      const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

      const promise = client.sendRequest('echo');

      // Parse the written request to get its ID
      const lastWritten = mockSocket.written[mockSocket.written.length - 1];
      const { messages } = parseMessages(lastWritten);
      const requestId = (messages[0] as { id: number }).id;

      // Send matching response
      mockSocket.emit('data', createMockResponse(requestId, 'echoed'));

      const result = await promise;
      expect(result).toBe('echoed');
    });

    it('should reject on error response', async () => {
      await client.connect();
      const net = require('net');
      const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

      const promise = client.sendRequest('fail.method');

      const lastWritten = mockSocket.written[mockSocket.written.length - 1];
      const { messages } = parseMessages(lastWritten);
      const requestId = (messages[0] as { id: number }).id;

      mockSocket.emit(
        'data',
        createMockErrorResponse(requestId, JSON_RPC_ERRORS.INTERNAL_ERROR, 'Something went wrong'),
      );

      await expect(promise).rejects.toThrow('Something went wrong');
    });

    it('should reject on timeout', async () => {
      await client.connect();

      // The client has 500ms timeout set in beforeEach
      await expect(client.sendRequest('slow.method')).rejects.toThrow(
        /Request timeout.*500ms/,
      );
    });
  });

  describe('onNotification', () => {
    it('should invoke callback when matching notification arrives', async () => {
      await client.connect();
      const net = require('net');
      const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

      const handler = jest.fn();
      client.onNotification('progress.update', handler);

      mockSocket.emit('data', createMockNotification('progress.update', { percent: 50 }));

      expect(handler).toHaveBeenCalledWith({ percent: 50 });
    });

    it('should return an unsubscribe function', async () => {
      await client.connect();
      const net = require('net');
      const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

      const handler = jest.fn();
      const unsub = client.onNotification('events', handler);

      // First notification — should be received
      mockSocket.emit('data', createMockNotification('events', { n: 1 }));
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsub();

      // Second notification — should not be received
      mockSocket.emit('data', createMockNotification('events', { n: 2 }));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});

// ── High-Level API Tests ───────────────────────────────────────────

describe('High-Level API', () => {
  let client: ACAJetBrainsClient;

  beforeEach(() => {
    resetIdCounter();
    client = new ACAJetBrainsClient({
      serverUrl: 'http://localhost',
      rpcPort: 6789,
      requestTimeout: 500,
    });
  });

  afterEach(() => {
    client.dispose();
  });

  it('submitTask should send task.submit RPC with correct params', async () => {
    await client.connect();
    const net = require('net');
    const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

    const taskResult = { id: 'task-1', goal: 'Build feature', status: 'pending' };
    const promise = client.submitTask('Build feature', { priority: 'high' });

    const lastWritten = mockSocket.written[mockSocket.written.length - 1];
    const { messages } = parseMessages(lastWritten);
    const request = messages[0] as { id: number; method: string; params: unknown };

    expect(request.method).toBe('task.submit');
    expect(request.params).toEqual({ goal: 'Build feature', priority: 'high' });

    mockSocket.emit('data', createMockResponse(request.id, taskResult));
    const result = await promise;
    expect(result).toEqual(taskResult);
  });

  it('getStatus should send status.get RPC', async () => {
    await client.connect();
    const net = require('net');
    const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

    const statusResult = { id: 'task-1', goal: 'test', status: 'running', progress: 50 };
    const promise = client.getStatus('task-1');

    const lastWritten = mockSocket.written[mockSocket.written.length - 1];
    const { messages } = parseMessages(lastWritten);
    const request = messages[0] as { id: number; method: string; params: unknown };

    expect(request.method).toBe('status.get');
    expect(request.params).toEqual({ taskId: 'task-1' });

    mockSocket.emit('data', createMockResponse(request.id, statusResult));
    const result = await promise;
    expect(result).toEqual(statusResult);
  });

  it('cancelTask should send task.cancel RPC', async () => {
    await client.connect();
    const net = require('net');
    const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

    const promise = client.cancelTask('task-42');

    const lastWritten = mockSocket.written[mockSocket.written.length - 1];
    const { messages } = parseMessages(lastWritten);
    const request = messages[0] as { id: number; method: string; params: unknown };

    expect(request.method).toBe('task.cancel');
    expect(request.params).toEqual({ taskId: 'task-42' });

    mockSocket.emit('data', createMockResponse(request.id, { success: true }));
    const result = await promise;
    expect(result).toEqual({ success: true });
  });

  it('onTaskUpdate should subscribe to task.update notifications', async () => {
    await client.connect();
    const net = require('net');
    const mockSocket = net.Socket.mock.results[net.Socket.mock.results.length - 1].value as MockSocket;

    const updates: unknown[] = [];
    client.onTaskUpdate((event) => updates.push(event));

    const updateEvent = { taskId: 'task-1', status: 'completed', progress: 100, message: 'Done' };
    mockSocket.emit('data', createMockNotification('task.update', updateEvent));

    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual(updateEvent);
  });
});

// ── Factory & Defaults Tests ───────────────────────────────────────

describe('Factory and Defaults', () => {
  it('createACAJetBrainsClient should create a client instance', () => {
    const client = createACAJetBrainsClient({ serverUrl: 'localhost' });
    expect(client).toBeInstanceOf(ACAJetBrainsClient);
    expect(client.isConnected()).toBe(false);
    client.dispose();
  });

  it('should export correct default constants', () => {
    expect(DEFAULT_RPC_PORT).toBe(6789);
    expect(DEFAULT_CONNECT_TIMEOUT).toBe(10000);
    expect(DEFAULT_REQUEST_TIMEOUT).toBe(30000);
  });

  it('dispose should reject pending requests and clean up', async () => {
    const client = createACAJetBrainsClient({
      serverUrl: 'localhost',
      requestTimeout: 5000,
    });
    await client.connect();

    const promise = client.sendRequest('long.running');
    client.dispose();

    await expect(promise).rejects.toThrow('Client disposed');
  });
});
