/**
 * MCP Client Tests
 *
 * Tests for the MCP client implementation.
 *
 * @module tests/unit/core/tools/mcp/mcp-client.test
 */

import {
  MCPClient,
  MCPTransportType,
  MCPConnectionState,
  MCPEventType,
  MCPClientConfig,
  IMCPTransport,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  MCPLogLevel,
} from '../../../../../src/core/tools/mcp/index.js';

// Create a mock transport class
class MockTransport implements IMCPTransport {
  private connected = false;
  private messageHandler: ((message: JsonRpcNotification | JsonRpcResponse) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: ((code?: number, reason?: string) => void) | null = null;
  private pendingResponses: Map<string | number, JsonRpcResponse> = new Map();

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async sendRequest<T>(request: JsonRpcRequest): Promise<JsonRpcResponse<T>> {
    const response = this.pendingResponses.get(request.id);
    if (response) {
      this.pendingResponses.delete(request.id);
      return response as JsonRpcResponse<T>;
    }

    // Default success response for initialize
    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: {
            name: 'test-server',
            version: '1.0.0',
          },
        },
      } as JsonRpcResponse<T>;
    }

    // Default success response for ping
    if (request.method === 'ping') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {},
      } as JsonRpcResponse<T>;
    }

    // Default empty list responses
    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: [] },
      } as JsonRpcResponse<T>;
    }

    if (request.method === 'resources/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { resources: [] },
      } as JsonRpcResponse<T>;
    }

    if (request.method === 'prompts/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { prompts: [] },
      } as JsonRpcResponse<T>;
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {} as T,
    };
  }

  sendNotification(_notification: JsonRpcNotification): void {
    // No-op for mock
  }

  onMessage(handler: (message: JsonRpcNotification | JsonRpcResponse) => void): void {
    this.messageHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: (code?: number, reason?: string) => void): void {
    this.closeHandler = handler;
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Test helpers
  simulateNotification(notification: JsonRpcNotification): void {
    if (this.messageHandler) {
      this.messageHandler(notification);
    }
  }

  simulateError(error: Error): void {
    if (this.errorHandler) {
      this.errorHandler(error);
    }
  }

  simulateClose(code?: number, reason?: string): void {
    this.connected = false;
    if (this.closeHandler) {
      this.closeHandler(code, reason);
    }
  }

  setResponse(id: string | number, response: JsonRpcResponse): void {
    this.pendingResponses.set(id, response);
  }
}

// Mock the transport creation
jest.mock('../../../../../src/core/tools/mcp/stdio-transport.js', () => ({
  StdioTransport: jest.fn().mockImplementation(() => new MockTransport()),
}));

describe('MCPClient', () => {
  let client: MCPClient;
  let config: MCPClientConfig;

  beforeEach(() => {
    config = {
      serverId: 'test-server',
      serverName: 'Test Server',
      transport: {
        type: MCPTransportType.STDIO,
        command: 'node',
        args: ['server.js'],
      },
      autoReconnect: false,
    };

    client = new MCPClient(config);
  });

  afterEach(async () => {
    await client.disconnect();
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect and initialize successfully', async () => {
      const result = await client.connect();

      expect(result.success).toBe(true);
      expect(client.isReady()).toBe(true);
      expect(client.getConnectionState()).toBe(MCPConnectionState.READY);
    });

    it('should return success if already connected', async () => {
      await client.connect();
      const result = await client.connect();

      expect(result.success).toBe(true);
    });

    it('should set server info after initialization', async () => {
      await client.connect();

      const serverInfo = client.getServerInfo();
      expect(serverInfo).toBeDefined();
      expect(serverInfo?.name).toBe('test-server');
      expect(serverInfo?.version).toBe('1.0.0');
    });

    it('should emit connection state change events', async () => {
      const stateChanges: MCPConnectionState[] = [];

      client.subscribe(MCPEventType.CONNECTION_STATE_CHANGED, (event) => {
        stateChanges.push((event.data as { currentState: MCPConnectionState }).currentState);
      });

      await client.connect();

      expect(stateChanges).toContain(MCPConnectionState.CONNECTING);
      expect(stateChanges).toContain(MCPConnectionState.CONNECTED);
      expect(stateChanges).toContain(MCPConnectionState.INITIALIZING);
      expect(stateChanges).toContain(MCPConnectionState.READY);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from ready state', async () => {
      await client.connect();
      const result = await client.disconnect();

      expect(result.success).toBe(true);
      expect(client.isReady()).toBe(false);
      expect(client.getConnectionState()).toBe(MCPConnectionState.DISCONNECTED);
    });

    it('should return success if not connected', async () => {
      const result = await client.disconnect();
      expect(result.success).toBe(true);
    });

    it('should clear server info on disconnect', async () => {
      await client.connect();
      expect(client.getServerInfo()).toBeDefined();

      await client.disconnect();
      expect(client.getServerInfo()).toBeUndefined();
    });
  });

  describe('tools', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should list tools', async () => {
      const result = await client.listTools();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.tools).toEqual([]);
    });

    it('should call a tool', async () => {
      const result = await client.callTool({
        name: 'test-tool',
        arguments: { param: 'value' },
      });

      expect(result.success).toBe(true);
      expect(result.durationMs).toBeDefined();
    });

    it('should get a specific tool', async () => {
      const result = await client.getTool('test-tool');

      expect(result.success).toBe(true);
    });

    it('should increment tool call statistics', async () => {
      const initialStats = client.getStatistics();
      expect(initialStats.totalToolCalls).toBe(0);

      await client.callTool({ name: 'test-tool' });

      const updatedStats = client.getStatistics();
      expect(updatedStats.totalToolCalls).toBe(1);
    });
  });

  describe('resources', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should list resources', async () => {
      const result = await client.listResources();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.resources).toEqual([]);
    });

    it('should list resource templates', async () => {
      const result = await client.listResourceTemplates();

      expect(result.success).toBe(true);
    });

    it('should read a resource', async () => {
      const result = await client.readResource({ uri: 'file:///test.txt' });

      expect(result.success).toBe(true);
    });

    it('should subscribe to resource updates', async () => {
      const result = await client.subscribeResource('file:///test.txt');

      expect(result.success).toBe(true);
    });

    it('should unsubscribe from resource updates', async () => {
      const result = await client.unsubscribeResource('file:///test.txt');

      expect(result.success).toBe(true);
    });

    it('should increment resource read statistics', async () => {
      const initialStats = client.getStatistics();
      expect(initialStats.totalResourceReads).toBe(0);

      await client.readResource({ uri: 'file:///test.txt' });

      const updatedStats = client.getStatistics();
      expect(updatedStats.totalResourceReads).toBe(1);
    });
  });

  describe('prompts', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should list prompts', async () => {
      const result = await client.listPrompts();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.prompts).toEqual([]);
    });

    it('should get a prompt', async () => {
      const result = await client.getPrompt({
        name: 'test-prompt',
        arguments: { arg: 'value' },
      });

      expect(result.success).toBe(true);
    });

    it('should increment prompt get statistics', async () => {
      const initialStats = client.getStatistics();
      expect(initialStats.totalPromptGets).toBe(0);

      await client.getPrompt({ name: 'test-prompt' });

      const updatedStats = client.getStatistics();
      expect(updatedStats.totalPromptGets).toBe(1);
    });
  });

  describe('utilities', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should ping the server', async () => {
      const result = await client.ping();

      expect(result.success).toBe(true);
      expect(result.data?.latencyMs).toBeDefined();
      expect(typeof result.data?.latencyMs).toBe('number');
    });

    it('should set logging level', async () => {
      const result = await client.setLoggingLevel(MCPLogLevel.DEBUG);

      expect(result.success).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should initialize with zero statistics', () => {
      const stats = client.getStatistics();

      expect(stats.serverId).toBe('test-server');
      expect(stats.totalRequests).toBe(0);
      expect(stats.successfulRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.totalToolCalls).toBe(0);
      expect(stats.totalResourceReads).toBe(0);
      expect(stats.totalPromptGets).toBe(0);
      expect(stats.reconnectionCount).toBe(0);
    });

    it('should track uptime', async () => {
      await client.connect();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const stats = client.getStatistics();
      expect(stats.uptimeMs).toBeGreaterThan(0);
    });

    it('should reset statistics', async () => {
      await client.connect();
      await client.callTool({ name: 'test' });

      const statsBefore = client.getStatistics();
      expect(statsBefore.totalToolCalls).toBe(1);

      client.resetStatistics();

      const statsAfter = client.getStatistics();
      expect(statsAfter.totalToolCalls).toBe(0);
    });
  });

  describe('events', () => {
    it('should subscribe to events', () => {
      const callback = jest.fn();
      const subscription = client.subscribe(MCPEventType.ERROR, callback);

      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should unsubscribe from events', () => {
      const callback = jest.fn();
      const subscription = client.subscribe(MCPEventType.NOTIFICATION, callback);

      subscription.unsubscribe();

      // Emit event - callback should not be called
      client.emit(MCPEventType.NOTIFICATION, { type: MCPEventType.NOTIFICATION, serverId: 'test', data: {}, timestamp: new Date() });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove all listeners', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      client.subscribe(MCPEventType.NOTIFICATION, callback1);
      client.subscribe(MCPEventType.TOOLS_CHANGED, callback2);

      client.unsubscribeAll();

      client.emit(MCPEventType.NOTIFICATION, {});
      client.emit(MCPEventType.TOOLS_CHANGED, {});

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('getConnectionState', () => {
    it('should return DISCONNECTED initially', () => {
      expect(client.getConnectionState()).toBe(MCPConnectionState.DISCONNECTED);
    });

    it('should return READY after connect', async () => {
      await client.connect();
      expect(client.getConnectionState()).toBe(MCPConnectionState.READY);
    });
  });

  describe('isReady', () => {
    it('should return false initially', () => {
      expect(client.isReady()).toBe(false);
    });

    it('should return true after connect', async () => {
      await client.connect();
      expect(client.isReady()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      await client.connect();
      await client.disconnect();
      expect(client.isReady()).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return error for operations when not connected', async () => {
      const result = await client.listTools();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not connected');
    });
  });
});
