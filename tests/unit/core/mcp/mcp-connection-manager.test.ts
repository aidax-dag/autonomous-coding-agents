/**
 * MCP Connection Manager Tests
 */

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  MCPConnectionManager,
  createMCPConnectionManager,
  type MCPConnectionManagerConfig,
  type MCPServerEntry,
} from '../../../../src/core/mcp/mcp-connection-manager';
import { createMCPClient } from '../../../../src/core/mcp/mcp-client';
import type { MCPToolDefinition } from '../../../../src/core/mcp/interfaces/mcp.interface';

// Mock createMCPClient
jest.mock('../../../../src/core/mcp/mcp-client', () => {
  const mockClients: Map<number, MockClient> = new Map();
  let clientIndex = 0;

  class MockClient {
    connected = false;
    tools: MCPToolDefinition[] = [];
    connectError: Error | null = null;
    listToolsError: Error | null = null;
    disconnected = false;

    async connect(_config: unknown): Promise<void> {
      if (this.connectError) throw this.connectError;
      this.connected = true;
    }

    async disconnect(): Promise<void> {
      this.connected = false;
      this.disconnected = true;
    }

    async listTools(): Promise<MCPToolDefinition[]> {
      if (this.listToolsError) throw this.listToolsError;
      return this.tools;
    }

    async callTool(name: string, _args: Record<string, unknown>) {
      return { content: [{ type: 'text', text: `Result from ${name}` }] };
    }

    isConnected(): boolean {
      return this.connected;
    }
  }

  return {
    MCPClient: MockClient,
    createMCPClient: jest.fn(() => {
      const client = new MockClient();
      mockClients.set(clientIndex++, client);
      return client;
    }),
    __mockClients: mockClients,
    __resetMocks: () => {
      mockClients.clear();
      clientIndex = 0;
    },
  };
});

// Access mock internals
const mockModule = jest.requireMock('../../../../src/core/mcp/mcp-client') as {
  __mockClients: Map<number, {
    connected: boolean;
    tools: MCPToolDefinition[];
    connectError: Error | null;
    listToolsError: Error | null;
    disconnected: boolean;
  }>;
  __resetMocks: () => void;
};

function getMockClient(index: number) {
  return mockModule.__mockClients.get(index);
}

function makeServerEntry(overrides: Partial<MCPServerEntry> = {}): MCPServerEntry {
  return {
    name: 'test-server',
    transport: 'stdio',
    command: 'test-cmd',
    args: ['--test'],
    ...overrides,
  };
}

function makeTools(count: number, prefix = 'tool'): MCPToolDefinition[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `${prefix}-${i}`,
    description: `Test tool ${prefix}-${i}`,
    inputSchema: { type: 'object' },
  }));
}

describe('MCPConnectionManager', () => {
  beforeEach(() => {
    mockModule.__resetMocks();
    (createMCPClient as jest.Mock).mockClear();
  });

  describe('createMCPConnectionManager', () => {
    it('should create an instance with the factory function', () => {
      const config: MCPConnectionManagerConfig = { servers: [] };
      const manager = createMCPConnectionManager(config);
      expect(manager).toBeInstanceOf(MCPConnectionManager);
    });
  });

  describe('connectAll', () => {
    it('should connect to all enabled servers', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'server-a' }),
        makeServerEntry({ name: 'server-b' }),
      ];

      // Reset mocks so we can override createMCPClient with custom tool assignment
      mockModule.__resetMocks();
      (createMCPClient as jest.Mock).mockClear();

      // Override createMCPClient to set tools on the mock
      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(2, `server-${callCount}`);
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager2 = createMCPConnectionManager({ servers });
      await manager2.connectAll();

      expect(createMCPClient).toHaveBeenCalledTimes(2);
      const status = manager2.getStatus();
      expect(status).toHaveLength(2);
      expect(status[0].connected).toBe(true);
      expect(status[1].connected).toBe(true);
    });

    it('should skip disabled servers', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'enabled-server', enabled: true }),
        makeServerEntry({ name: 'disabled-server', enabled: false }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = [];
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      // Only one client should be created (for the enabled server)
      expect(createMCPClient).toHaveBeenCalledTimes(1);

      const status = manager.getStatus();
      expect(status).toHaveLength(2);
      expect(status[0].connected).toBe(true);
      expect(status[1].connected).toBe(false);
    });

    it('should handle empty servers config as no-op', async () => {
      const manager = createMCPConnectionManager({ servers: [] });
      await manager.connectAll();

      expect(createMCPClient).not.toHaveBeenCalled();
      expect(manager.getStatus()).toHaveLength(0);
      expect(manager.getAllTools()).toHaveLength(0);
    });

    it('should isolate failures — one server failing does not block others', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'good-server' }),
        makeServerEntry({ name: 'bad-server' }),
        makeServerEntry({ name: 'another-good' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        if (callCount === 1) {
          // second server fails to connect
          client.connectError = new Error('Connection refused');
        } else {
          client.tools = makeTools(1, `s${callCount}`);
        }
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      // connectAll should not throw even when one server fails
      await manager.connectAll();

      expect(createMCPClient).toHaveBeenCalledTimes(3);

      const status = manager.getStatus();
      // good-server connected
      expect(status[0].connected).toBe(true);
      // bad-server has an error
      expect(status[1].connected).toBe(false);
      expect(status[1].error).toBeDefined();
      // another-good connected
      expect(status[2].connected).toBe(true);

      // Tools from good servers only
      expect(manager.getAllTools()).toHaveLength(2); // 1 from each good server
    });
  });

  describe('connectServer', () => {
    it('should connect a specific server by name', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'alpha' }),
        makeServerEntry({ name: 'beta' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(3, `srv${callCount}`);
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectServer('beta');

      expect(createMCPClient).toHaveBeenCalledTimes(1);

      const status = manager.getStatus();
      const betaStatus = status.find((s) => s.name === 'beta');
      expect(betaStatus?.connected).toBe(true);
      expect(betaStatus?.toolCount).toBe(3);
    });

    it('should throw for unknown server name', async () => {
      const manager = createMCPConnectionManager({
        servers: [makeServerEntry({ name: 'existing' })],
      });

      await expect(manager.connectServer('nonexistent')).rejects.toThrow(
        "MCP server 'nonexistent' not found in configuration",
      );
    });

    it('should throw for disabled server', async () => {
      const manager = createMCPConnectionManager({
        servers: [makeServerEntry({ name: 'disabled-srv', enabled: false })],
      });

      await expect(manager.connectServer('disabled-srv')).rejects.toThrow(
        "MCP server 'disabled-srv' is disabled",
      );
    });

    it('should reconnect if already connected', async () => {
      const servers: MCPServerEntry[] = [makeServerEntry({ name: 'reconnect-srv' })];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(callCount + 1, `v${callCount}`);
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectServer('reconnect-srv');
      expect(manager.getAllTools()).toHaveLength(1);

      // Reconnect — should replace the previous connection
      await manager.connectServer('reconnect-srv');
      expect(manager.getAllTools()).toHaveLength(2);
      expect(createMCPClient).toHaveBeenCalledTimes(2);
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all connected servers', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'srv-1' }),
        makeServerEntry({ name: 'srv-2' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = [];
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();
      await manager.disconnectAll();

      const status = manager.getStatus();
      // After disconnectAll, connections are cleared so status shows not connected
      expect(status.every((s) => !s.connected)).toBe(true);
    });

    it('should be idempotent — calling twice does not throw', async () => {
      const manager = createMCPConnectionManager({ servers: [] });
      await manager.disconnectAll();
      await manager.disconnectAll();
      // No error thrown
    });
  });

  describe('disconnectServer', () => {
    it('should disconnect a specific server', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'keep-alive' }),
        makeServerEntry({ name: 'to-disconnect' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(1, `s${callCount}`);
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      await manager.disconnectServer('to-disconnect');

      const status = manager.getStatus();
      const keepAlive = status.find((s) => s.name === 'keep-alive');
      const disconnected = status.find((s) => s.name === 'to-disconnect');
      expect(keepAlive?.connected).toBe(true);
      expect(disconnected?.connected).toBe(false);
    });

    it('should be no-op for unknown server name', async () => {
      const manager = createMCPConnectionManager({ servers: [] });
      // Should not throw
      await manager.disconnectServer('nonexistent');
    });
  });

  describe('getStatus', () => {
    it('should return status for all configured servers', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'connected-srv' }),
        makeServerEntry({ name: 'disabled-srv', enabled: false }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(2, `s${callCount}`);
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      const status = manager.getStatus();
      expect(status).toHaveLength(2);

      expect(status[0]).toEqual(
        expect.objectContaining({
          name: 'connected-srv',
          connected: true,
          toolCount: 2,
        }),
      );

      expect(status[1]).toEqual(
        expect.objectContaining({
          name: 'disabled-srv',
          connected: false,
          toolCount: 0,
        }),
      );
    });

    it('should return empty array when no servers configured', () => {
      const manager = createMCPConnectionManager({ servers: [] });
      expect(manager.getStatus()).toEqual([]);
    });
  });

  describe('getAllTools', () => {
    it('should aggregate tools from multiple servers', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'srv-a' }),
        makeServerEntry({ name: 'srv-b' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        // srv-a has 2 tools, srv-b has 3 tools
        client.tools = makeTools(callCount === 0 ? 2 : 3, `srv${callCount}`);
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      const allTools = manager.getAllTools();
      expect(allTools).toHaveLength(5); // 2 + 3
    });

    it('should return empty array when no servers connected', () => {
      const manager = createMCPConnectionManager({ servers: [] });
      expect(manager.getAllTools()).toEqual([]);
    });
  });

  describe('callTool', () => {
    it('should delegate to the correct server client', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'tool-server' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(1, 'my-tool');
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      const result = await manager.callTool('tool-server', 'my-tool-0', { input: 'test' });
      expect(result).toEqual(
        expect.objectContaining({
          content: [{ type: 'text', text: 'Result from my-tool-0' }],
        }),
      );
    });

    it('should throw for disconnected server', async () => {
      const manager = createMCPConnectionManager({
        servers: [makeServerEntry({ name: 'srv' })],
      });

      await expect(
        manager.callTool('srv', 'tool', {}),
      ).rejects.toThrow("MCP server 'srv' is not connected");
    });

    it('should throw for unknown server', async () => {
      const manager = createMCPConnectionManager({ servers: [] });

      await expect(
        manager.callTool('unknown', 'tool', {}),
      ).rejects.toThrow("MCP server 'unknown' is not connected");
    });
  });

  describe('healthCheck', () => {
    it('should detect disconnected servers', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'healthy-srv' }),
        makeServerEntry({ name: 'lost-srv' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = [];
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      // Simulate lost connection on second server
      const lostClient = getMockClient(1)!;
      lostClient.connected = false;

      await manager.healthCheck();

      const status = manager.getStatus();
      const healthy = status.find((s) => s.name === 'healthy-srv');
      const lost = status.find((s) => s.name === 'lost-srv');

      expect(healthy?.connected).toBe(true);
      expect(healthy?.lastHealthCheck).toBeDefined();
      expect(healthy?.error).toBeUndefined();

      expect(lost?.connected).toBe(false);
      expect(lost?.lastHealthCheck).toBeDefined();
      expect(lost?.error).toBe('Connection lost');
    });

    it('should update lastHealthCheck timestamp', async () => {
      const servers: MCPServerEntry[] = [makeServerEntry({ name: 'srv' })];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = [];
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      await manager.healthCheck();

      const status = manager.getStatus();
      expect(status[0].lastHealthCheck).toBeDefined();
      // Should be a valid ISO date string
      expect(() => new Date(status[0].lastHealthCheck!)).not.toThrow();
    });
  });

  describe('getClient', () => {
    it('should return the client for a connected server', async () => {
      const servers: MCPServerEntry[] = [makeServerEntry({ name: 'my-srv' })];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = [];
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      const client = manager.getClient('my-srv');
      expect(client).toBeDefined();
      expect(client?.isConnected()).toBe(true);
    });

    it('should return null for unknown server', () => {
      const manager = createMCPConnectionManager({ servers: [] });
      expect(manager.getClient('nonexistent')).toBeNull();
    });
  });

  describe('getServerTools', () => {
    it('should return tools for a specific server', async () => {
      const servers: MCPServerEntry[] = [makeServerEntry({ name: 'tool-srv' })];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(4, 'specific');
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      expect(manager.getServerTools('tool-srv')).toHaveLength(4);
    });

    it('should return empty array for unknown server', () => {
      const manager = createMCPConnectionManager({ servers: [] });
      expect(manager.getServerTools('nonexistent')).toEqual([]);
    });
  });

  describe('duplicate server names', () => {
    it('should handle duplicate names by replacing the previous connection', async () => {
      const servers: MCPServerEntry[] = [
        makeServerEntry({ name: 'dup' }),
        makeServerEntry({ name: 'dup' }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = makeTools(callCount + 1, `v${callCount}`);
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      // The second "dup" server should replace the first
      const status = manager.getStatus();
      const dupEntries = status.filter((s) => s.name === 'dup');
      // There are two in config but only one active connection (the last one wins)
      // Status reports per config entry, so there are 2 entries
      expect(dupEntries).toHaveLength(2);

      // The tools should be from the second connection (2 tools, not 1)
      expect(manager.getAllTools()).toHaveLength(2);
    });
  });

  describe('env variable handling', () => {
    it('should restore env variables after connection', async () => {
      const originalValue = process.env.TEST_MCP_VAR;

      const servers: MCPServerEntry[] = [
        makeServerEntry({
          name: 'env-srv',
          env: { TEST_MCP_VAR: 'custom-value' },
        }),
      ];

      let callCount = 0;
      (createMCPClient as jest.Mock).mockImplementation(() => {
        const mockModule2 = jest.requireMock('../../../../src/core/mcp/mcp-client');
        const client = new mockModule2.MCPClient();
        client.tools = [];
        mockModule.__mockClients.set(callCount, client);
        callCount++;
        return client;
      });

      const manager = createMCPConnectionManager({ servers });
      await manager.connectAll();

      // Env var should be restored to original value (likely undefined)
      expect(process.env.TEST_MCP_VAR).toBe(originalValue);
    });
  });
});
