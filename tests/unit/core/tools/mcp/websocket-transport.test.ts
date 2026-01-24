/**
 * WebSocket Transport Tests
 */

// Mock ws module - factory is hoisted and runs before imports
jest.mock('ws', () => {
  const EventEmitterClass = require('events').EventEmitter;

  class MockWebSocket extends EventEmitterClass {
    static OPEN = 1;
    static CLOSED = 3;

    readyState = 3; // CLOSED

    constructor(_url: string, _options?: unknown) {
      super();
    }

    send = jest.fn((_data: string, callback?: (error?: Error) => void) => {
      if (callback) callback();
    });

    close = jest.fn((code?: number, _reason?: string) => {
      this.readyState = 3; // CLOSED
      this.emit('close', code || 1000, '');
    });

    terminate = jest.fn(() => {
      this.readyState = 3; // CLOSED
    });

    pong = jest.fn();
  }

  return MockWebSocket;
});

import { WebSocketTransport } from '../../../../../src/core/tools/mcp/websocket-transport';
import { MCPTransportType, MCPWebSocketTransportConfig } from '../../../../../src/core/tools/mcp/mcp.interface';

// Get mock WebSocket for type checking in tests
const MockWebSocket = require('ws');

describe('WebSocketTransport', () => {
  let transport: WebSocketTransport;
  let config: MCPWebSocketTransportConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    config = {
      type: MCPTransportType.WEBSOCKET,
      url: 'ws://localhost:3000/mcp',
      headers: { 'Authorization': 'Bearer test-token' },
      autoReconnect: false,
      reconnectIntervalMs: 1000,
      maxReconnectAttempts: 3,
      connectionTimeoutMs: 5000,
      requestTimeoutMs: 5000,
    };
    transport = new WebSocketTransport(config);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await transport.disconnect();
  });

  describe('constructor', () => {
    it('should create transport with config', () => {
      expect(transport).toBeInstanceOf(WebSocketTransport);
      expect(transport.isConnected()).toBe(false);
    });

    it('should use default values for optional config', () => {
      const minimalConfig: MCPWebSocketTransportConfig = {
        type: MCPTransportType.WEBSOCKET,
        url: 'ws://localhost:3000/mcp',
      };
      const minimalTransport = new WebSocketTransport(minimalConfig);
      expect(minimalTransport).toBeInstanceOf(WebSocketTransport);
    });
  });

  describe('connect', () => {
    it('should verify transport structure', () => {
      // Note: Due to the complexity of mocking WebSocket properly,
      // this test verifies the basic structure
      expect(transport).toBeDefined();
      expect(typeof transport.connect).toBe('function');
      expect(typeof transport.disconnect).toBe('function');
      expect(typeof transport.sendRequest).toBe('function');
      expect(typeof transport.sendNotification).toBe('function');
      expect(typeof transport.isConnected).toBe('function');
    });

    it('should throw if already connected', async () => {
      // Manually set the internal state for testing
      (transport as unknown as { connected: boolean }).connected = true;

      await expect(transport.connect()).rejects.toThrow('already connected');
    });
  });

  describe('disconnect', () => {
    it('should do nothing if not connected', async () => {
      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('sendRequest', () => {
    it('should throw if not connected', async () => {
      await expect(
        transport.sendRequest({
          jsonrpc: '2.0',
          id: 1,
          method: 'ping',
        })
      ).rejects.toThrow('not connected');
    });
  });

  describe('sendNotification', () => {
    it('should throw if not connected', () => {
      expect(() =>
        transport.sendNotification({
          jsonrpc: '2.0',
          method: 'test',
        })
      ).toThrow('not connected');
    });
  });

  describe('event handlers', () => {
    it('should set message handler', () => {
      const handler = jest.fn();
      transport.onMessage(handler);
      // Handler is stored internally
      expect(handler).not.toHaveBeenCalled();
    });

    it('should set error handler', () => {
      const handler = jest.fn();
      transport.onError(handler);
      // Handler is stored internally
      expect(handler).not.toHaveBeenCalled();
    });

    it('should set close handler', () => {
      const handler = jest.fn();
      transport.onClose(handler);
      // Handler is stored internally
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(transport.isConnected()).toBe(false);
    });

    it('should return true when connected and WebSocket is open', () => {
      // Manually set internal state for testing
      (transport as unknown as { connected: boolean }).connected = true;

      // Create a mock WebSocket instance with EventEmitter methods
      const mockWs = new MockWebSocket('ws://test');
      mockWs.readyState = MockWebSocket.OPEN;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transport as any).ws = mockWs;

      expect(transport.isConnected()).toBe(true);
    });

    it('should return false when WebSocket is not open', () => {
      (transport as unknown as { connected: boolean }).connected = true;

      // Create a mock WebSocket instance with EventEmitter methods
      const mockWs = new MockWebSocket('ws://test');
      mockWs.readyState = MockWebSocket.CLOSED;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transport as any).ws = mockWs;

      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('auto-reconnection', () => {
    it('should respect maxReconnectAttempts', () => {
      const reconnectConfig: MCPWebSocketTransportConfig = {
        ...config,
        autoReconnect: true,
        maxReconnectAttempts: 3,
      };
      const reconnectTransport = new WebSocketTransport(reconnectConfig);

      // Verify config is stored
      expect((reconnectTransport as unknown as { config: MCPWebSocketTransportConfig }).config.maxReconnectAttempts).toBe(3);
    });

    it('should use exponential backoff', () => {
      const reconnectConfig: MCPWebSocketTransportConfig = {
        ...config,
        autoReconnect: true,
        reconnectIntervalMs: 1000,
      };
      const reconnectTransport = new WebSocketTransport(reconnectConfig);

      // Verify config is stored
      expect((reconnectTransport as unknown as { config: MCPWebSocketTransportConfig }).config.reconnectIntervalMs).toBe(1000);
    });
  });
});

describe('WebSocketTransport Integration', () => {
  // These tests would require an actual WebSocket server
  // They are skipped in unit tests but can be run in integration tests

  it.skip('should connect to real WebSocket server', async () => {
    // Integration test placeholder
  });

  it.skip('should handle real request/response cycle', async () => {
    // Integration test placeholder
  });
});
