/**
 * MCP Manager Tests
 *
 * Tests for the MCP manager implementation.
 *
 * @module tests/unit/core/tools/mcp/mcp-manager.test
 */

import {
  MCPManager,
  getMCPManager,
  resetMCPManager,
  MCPTransportType,
  MCPConnectionState,
  MCPClientConfig,
  MCPManagerConfig,
  IMCPClient,
  MCPOperationResult,
  MCPClientStatistics,
  MCPServerInfo,
  MCPToolListResult,
  MCPToolCallParams,
  MCPToolCallResult,
  MCPResourceListResult,
  MCPResourceTemplatesResult,
  MCPResourceReadParams,
  MCPResourceReadResult,
  MCPPromptListResult,
  MCPPromptGetParams,
  MCPPromptGetResult,
  MCPEventType,
  MCPEventCallback,
  MCPSubscription,
  MCPLogLevel,
} from '../../../../../src/core/tools/mcp/index.js';

// Create a mock client
class MockMCPClient implements IMCPClient {
  private _connectionState = MCPConnectionState.DISCONNECTED;
  private _serverInfo: MCPServerInfo | undefined;
  private _tools = [
    { name: 'tool1', description: 'Test tool 1', inputSchema: { type: 'object' as const } },
    { name: 'tool2', description: 'Test tool 2', inputSchema: { type: 'object' as const } },
  ];
  public serverId: string;

  constructor(config: MCPClientConfig) {
    this.serverId = config.serverId;
  }

  async connect(): Promise<MCPOperationResult> {
    this._connectionState = MCPConnectionState.READY;
    this._serverInfo = {
      name: 'mock-server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
      capabilities: {},
    };
    return { success: true };
  }

  async disconnect(): Promise<MCPOperationResult> {
    this._connectionState = MCPConnectionState.DISCONNECTED;
    this._serverInfo = undefined;
    return { success: true };
  }

  getConnectionState(): MCPConnectionState {
    return this._connectionState;
  }

  isReady(): boolean {
    return this._connectionState === MCPConnectionState.READY;
  }

  getServerInfo(): MCPServerInfo | undefined {
    return this._serverInfo;
  }

  async listTools(): Promise<MCPOperationResult<MCPToolListResult>> {
    return { success: true, data: { tools: this._tools } };
  }

  async callTool(_params: MCPToolCallParams): Promise<MCPOperationResult<MCPToolCallResult>> {
    return {
      success: true,
      data: {
        content: [{ type: 'text', text: 'result' }],
      },
    } as MCPOperationResult<MCPToolCallResult>;
  }

  async getTool(name: string): Promise<MCPOperationResult<{ name: string; description?: string; inputSchema: { type: 'object' } } | undefined>> {
    const tool = this._tools.find((t) => t.name === name);
    return { success: true, data: tool };
  }

  async listResources(): Promise<MCPOperationResult<MCPResourceListResult>> {
    return { success: true, data: { resources: [] } };
  }

  async listResourceTemplates(): Promise<MCPOperationResult<MCPResourceTemplatesResult>> {
    return { success: true, data: { resourceTemplates: [] } };
  }

  async readResource(_params: MCPResourceReadParams): Promise<MCPOperationResult<MCPResourceReadResult>> {
    return { success: true, data: { contents: [] } };
  }

  async subscribeResource(_uri: string): Promise<MCPOperationResult> {
    return { success: true };
  }

  async unsubscribeResource(_uri: string): Promise<MCPOperationResult> {
    return { success: true };
  }

  async listPrompts(): Promise<MCPOperationResult<MCPPromptListResult>> {
    return { success: true, data: { prompts: [] } };
  }

  async getPrompt(_params: MCPPromptGetParams): Promise<MCPOperationResult<MCPPromptGetResult>> {
    return { success: true, data: { messages: [] } };
  }

  async ping(): Promise<MCPOperationResult<{ latencyMs: number }>> {
    return { success: true, data: { latencyMs: 10 } };
  }

  async setLoggingLevel(_level: MCPLogLevel): Promise<MCPOperationResult> {
    return { success: true };
  }

  getStatistics(): MCPClientStatistics {
    return {
      serverId: this.serverId,
      totalRequests: 10,
      successfulRequests: 9,
      failedRequests: 1,
      averageResponseTimeMs: 50,
      totalToolCalls: 5,
      totalResourceReads: 3,
      totalPromptGets: 2,
      uptimeMs: 10000,
      reconnectionCount: 0,
      lastActivityAt: new Date(),
    };
  }

  resetStatistics(): void {
    // No-op for mock
  }

  subscribe(_event: MCPEventType, _callback: MCPEventCallback): MCPSubscription {
    return {
      id: 'mock-sub',
      unsubscribe: () => {},
    };
  }

  unsubscribeAll(): void {
    // No-op for mock
  }
}

// Mock MCPClient constructor
jest.mock('../../../../../src/core/tools/mcp/mcp-client.js', () => ({
  MCPClient: jest.fn().mockImplementation((config: MCPClientConfig) => new MockMCPClient(config)),
}));

describe('MCPManager', () => {
  let manager: MCPManager;
  let config: MCPManagerConfig;

  beforeEach(async () => {
    await resetMCPManager();
    config = {
      defaultRequestTimeoutMs: 30000,
      defaultAutoReconnect: true,
      maxConcurrentConnections: 5,
      debug: false,
    };
    manager = new MCPManager(config);
  });

  afterEach(async () => {
    await manager.dispose();
  });

  describe('registerServer', () => {
    it('should register a valid server configuration', () => {
      const serverConfig: MCPClientConfig = {
        serverId: 'server1',
        serverName: 'Server 1',
        transport: {
          type: MCPTransportType.STDIO,
          command: 'node',
          args: ['server.js'],
        },
      };

      expect(() => manager.registerServer(serverConfig)).not.toThrow();
    });

    it('should throw for invalid configuration', () => {
      const invalidConfig = {
        serverId: '',
        serverName: 'Test',
        transport: {
          type: MCPTransportType.STDIO,
          command: 'node',
        },
      } as MCPClientConfig;

      expect(() => manager.registerServer(invalidConfig)).toThrow('Invalid server configuration');
    });

    it('should throw for duplicate server ID', () => {
      const serverConfig: MCPClientConfig = {
        serverId: 'server1',
        serverName: 'Server 1',
        transport: {
          type: MCPTransportType.STDIO,
          command: 'node',
        },
      };

      manager.registerServer(serverConfig);
      expect(() => manager.registerServer(serverConfig)).toThrow('already registered');
    });

    it('should throw when max connections reached', () => {
      const smallManager = new MCPManager({ maxConcurrentConnections: 2 });

      for (let i = 0; i < 2; i++) {
        smallManager.registerServer({
          serverId: `server${i}`,
          serverName: `Server ${i}`,
          transport: { type: MCPTransportType.STDIO, command: 'node' },
        });
      }

      expect(() =>
        smallManager.registerServer({
          serverId: 'server3',
          serverName: 'Server 3',
          transport: { type: MCPTransportType.STDIO, command: 'node' },
        })
      ).toThrow('Maximum concurrent connections');
    });
  });

  describe('unregisterServer', () => {
    it('should unregister a server', async () => {
      const serverConfig: MCPClientConfig = {
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      };

      manager.registerServer(serverConfig);
      await manager.connect('server1');

      manager.unregisterServer('server1');

      expect(manager.getClient('server1')).toBeUndefined();
    });

    it('should not throw for non-existent server', () => {
      expect(() => manager.unregisterServer('non-existent')).not.toThrow();
    });
  });

  describe('connect', () => {
    it('should connect to a registered server', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      const result = await manager.connect('server1');

      expect(result.success).toBe(true);
      expect(manager.getClient('server1')?.isReady()).toBe(true);
    });

    it('should return error for unregistered server', async () => {
      const result = await manager.connect('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not registered');
    });

    it('should return success if already connected', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connect('server1');
      const result = await manager.connect('server1');

      expect(result.success).toBe(true);
    });
  });

  describe('connectAll', () => {
    it('should connect to all registered servers', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });
      manager.registerServer({
        serverId: 'server2',
        serverName: 'Server 2',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      const results = await manager.connectAll();

      expect(results.size).toBe(2);
      expect(results.get('server1')?.success).toBe(true);
      expect(results.get('server2')?.success).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from a connected server', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connect('server1');
      const result = await manager.disconnect('server1');

      expect(result.success).toBe(true);
      expect(manager.getClient('server1')).toBeUndefined();
    });

    it('should return success for non-connected server', async () => {
      const result = await manager.disconnect('non-existent');
      expect(result.success).toBe(true);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect from all connected servers', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });
      manager.registerServer({
        serverId: 'server2',
        serverName: 'Server 2',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connectAll();
      const results = await manager.disconnectAll();

      expect(results.size).toBe(2);
      expect(results.get('server1')?.success).toBe(true);
      expect(results.get('server2')?.success).toBe(true);
    });
  });

  describe('getClient', () => {
    it('should return client for connected server', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connect('server1');
      const client = manager.getClient('server1');

      expect(client).toBeDefined();
      expect(client?.isReady()).toBe(true);
    });

    it('should return undefined for non-existent server', () => {
      expect(manager.getClient('non-existent')).toBeUndefined();
    });
  });

  describe('getAllClients', () => {
    it('should return all connected clients', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });
      manager.registerServer({
        serverId: 'server2',
        serverName: 'Server 2',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connectAll();
      const clients = manager.getAllClients();

      expect(clients.size).toBe(2);
      expect(clients.has('server1')).toBe(true);
      expect(clients.has('server2')).toBe(true);
    });

    it('should return empty map when no clients connected', () => {
      const clients = manager.getAllClients();
      expect(clients.size).toBe(0);
    });
  });

  describe('listAllTools', () => {
    it('should list tools from all connected servers', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });
      manager.registerServer({
        serverId: 'server2',
        serverName: 'Server 2',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connectAll();
      const toolsByServer = await manager.listAllTools();

      expect(toolsByServer.size).toBe(2);
      expect(toolsByServer.get('server1')?.length).toBeGreaterThan(0);
      expect(toolsByServer.get('server2')?.length).toBeGreaterThan(0);
    });
  });

  describe('callTool', () => {
    it('should call tool on specific server', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connect('server1');
      const result = await manager.callTool('server1', {
        name: 'tool1',
        arguments: { param: 'value' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should return error for non-connected server', async () => {
      const result = await manager.callTool('non-existent', { name: 'tool1' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not connected');
    });
  });

  describe('findServersWithTool', () => {
    it('should return empty array when no servers registered', () => {
      const servers = manager.findServersWithTool('tool1');
      expect(servers).toEqual([]);
    });

    it('should find servers with specific tool after connection', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connect('server1');
      const servers = manager.findServersWithTool('tool1');

      expect(servers).toContain('server1');
    });
  });

  describe('getStatistics', () => {
    it('should return manager statistics', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connect('server1');
      const stats = manager.getStatistics();

      expect(stats.totalServers).toBe(1);
      expect(stats.connectedServers).toBe(1);
      expect(stats.totalToolCalls).toBeGreaterThanOrEqual(0);
      expect(stats.totalResourceReads).toBeGreaterThanOrEqual(0);
    });

    it('should aggregate statistics from all clients', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });
      manager.registerServer({
        serverId: 'server2',
        serverName: 'Server 2',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connectAll();
      const stats = manager.getStatistics();

      expect(stats.totalServers).toBe(2);
      expect(stats.connectedServers).toBe(2);
    });
  });

  describe('dispose', () => {
    it('should dispose all resources', async () => {
      manager.registerServer({
        serverId: 'server1',
        serverName: 'Server 1',
        transport: { type: MCPTransportType.STDIO, command: 'node' },
      });

      await manager.connect('server1');
      await manager.dispose();

      expect(manager.getAllClients().size).toBe(0);
    });

    it('should prevent operations after dispose', async () => {
      await manager.dispose();

      expect(() =>
        manager.registerServer({
          serverId: 'server1',
          serverName: 'Server 1',
          transport: { type: MCPTransportType.STDIO, command: 'node' },
        })
      ).toThrow('disposed');
    });
  });
});

describe('getMCPManager', () => {
  beforeEach(async () => {
    await resetMCPManager();
  });

  afterEach(async () => {
    await resetMCPManager();
  });

  it('should return a singleton manager', () => {
    const manager1 = getMCPManager();
    const manager2 = getMCPManager();

    expect(manager1).toBe(manager2);
  });

  it('should create manager with config on first call', () => {
    const config: MCPManagerConfig = {
      maxConcurrentConnections: 20,
    };

    const manager = getMCPManager(config);

    expect(manager).toBeDefined();
  });
});

describe('resetMCPManager', () => {
  it('should reset the global manager', async () => {
    const manager1 = getMCPManager();
    await resetMCPManager();
    const manager2 = getMCPManager();

    expect(manager1).not.toBe(manager2);
  });
});
