/**
 * HTTP Transport Tests
 */

import { HttpTransport } from '../../../../../src/core/tools/mcp/http-transport';
import { MCPTransportType, MCPHttpTransportConfig } from '../../../../../src/core/tools/mcp/mcp.interface';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock EventSource (not available in Node.js)
const mockEventSource = jest.fn().mockImplementation(() => ({
  onmessage: null,
  onerror: null,
  close: jest.fn(),
}));

// @ts-expect-error - EventSource is not available in Node.js
global.EventSource = mockEventSource;

describe('HttpTransport', () => {
  let transport: HttpTransport;
  let config: MCPHttpTransportConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    config = {
      type: MCPTransportType.HTTP_SSE,
      url: 'http://localhost:3000/mcp',
      headers: { 'Authorization': 'Bearer test-token' },
      secure: false,
      requestTimeoutMs: 5000,
    };
    transport = new HttpTransport(config);
  });

  afterEach(async () => {
    await transport.disconnect();
  });

  describe('constructor', () => {
    it('should create transport with config', () => {
      expect(transport).toBeInstanceOf(HttpTransport);
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {},
        }),
      });

      await transport.connect();
      expect(transport.isConnected()).toBe(true);
    });

    it('should throw if already connected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {},
        }),
      });

      await transport.connect();

      await expect(transport.connect()).rejects.toThrow('already connected');
    });

    it('should handle connection test failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32603, message: 'Server error' },
        }),
      });

      await expect(transport.connect()).rejects.toThrow('Connection test failed');
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(transport.connect()).rejects.toThrow('HTTP error');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {},
        }),
      });

      await transport.connect();
      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });

    it('should do nothing if not connected', async () => {
      await transport.disconnect();
      expect(transport.isConnected()).toBe(false);
    });
  });

  describe('sendRequest', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {},
        }),
      });
      await transport.connect();
    });

    it('should send request and return response', async () => {
      const expectedResult = { tools: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 2,
          result: expectedResult,
        }),
      });

      const response = await transport.sendRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 2,
        result: expectedResult,
      });
    });

    it('should throw if not connected', async () => {
      await transport.disconnect();

      await expect(
        transport.sendRequest({
          jsonrpc: '2.0',
          id: 3,
          method: 'ping',
        })
      ).rejects.toThrow('not connected');
    });
  });

  describe('sendNotification', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {},
        }),
      });
      await transport.connect();
    });

    it('should send notification without waiting for response', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      transport.sendNotification({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw if not connected', async () => {
      await transport.disconnect();

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

    it('should return true when connected', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          jsonrpc: '2.0',
          id: 1,
          result: {},
        }),
      });

      await transport.connect();
      expect(transport.isConnected()).toBe(true);
    });
  });
});
