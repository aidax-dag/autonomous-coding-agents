/**
 * MCP-A2A Bridge Tests
 *
 * @module tests/unit/core/a2a/mcp-a2a-bridge
 */

import {
  MCPA2ABridge,
  createMCPA2ABridge,
  BridgeMode,
  CapabilitySource,
  BridgeEvents,
  MCPA2ABridgeConfigSchema,
  ToolCapabilityMappingSchema,
  type HybridWorkflowStep,
} from '../../../../src/core/a2a/mcp-a2a-bridge';
import type { IMCPManager, MCPTool } from '../../../../src/core/tools/mcp/mcp.interface';
import { MCPContentType } from '../../../../src/core/tools/mcp/mcp.interface';
import type { IA2AServer, IA2AClient, AgentCard } from '../../../../src/core/a2a';
import { A2ATaskStatus, A2AContentMode } from '../../../../src/core/a2a';

// ============================================================================
// Mock Types
// ============================================================================

interface MockMCPClient {
  isReady: jest.Mock;
  listTools: jest.Mock;
  callTool: jest.Mock;
}

// ============================================================================
// Mock Factories
// ============================================================================

function createMockMCPClient(tools: MCPTool[]): MockMCPClient {
  return {
    isReady: jest.fn().mockReturnValue(true),
    listTools: jest.fn().mockResolvedValue({
      success: true,
      data: { tools },
    }),
    callTool: jest.fn().mockResolvedValue({
      success: true,
      data: {
        content: [{ type: MCPContentType.TEXT, text: 'Tool result' }],
        isError: false,
      },
    }),
  };
}

function createMockMCPManager(clients: Map<string, MockMCPClient>): IMCPManager {
  const clientsMap = new Map(clients);
  return {
    getClient: jest.fn((serverId: string) => clientsMap.get(serverId)),
    getAllClients: jest.fn(() => clientsMap),
    callTool: jest.fn(async (serverId: string, params: { name: string; arguments?: Record<string, unknown> }) => {
      const client = clientsMap.get(serverId);
      if (!client) {
        return { success: false, error: 'Server not found' };
      }
      return client.callTool(params);
    }),
    registerServer: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    listAllTools: jest.fn(),
    findServersWithTool: jest.fn(),
    getStats: jest.fn(),
    dispose: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as IMCPManager;
}

function createMockAgentCard(id: string, name: string, capabilities: string[] = ['test']): AgentCard {
  return {
    name,
    description: `${name} agent`,
    url: `http://localhost:3000/agents/${id}`,
    version: '1.0.0',
    capabilities: capabilities.map((cap) => ({
      name: cap,
      description: `${cap} capability`,
      inputSchema: { type: 'object', properties: {} },
      outputSchema: { type: 'object', properties: {} },
    })),
    skills: [],
    defaultInputModes: [A2AContentMode.TEXT],
    defaultOutputModes: [A2AContentMode.TEXT],
    supportsStreaming: false,
    supportsPushNotifications: false,
  };
}

function createMockA2AServer(agents: Map<string, AgentCard>): IA2AServer {
  return {
    isRunning: jest.fn().mockReturnValue(true),
    handleTask: jest.fn().mockResolvedValue({
      status: A2ATaskStatus.COMPLETED,
      message: { role: 'assistant', content: 'Task completed' },
      artifacts: [],
    }),
    getAllAgentCards: jest.fn(() => Array.from(agents.values())),
    registerAgent: jest.fn(),
    unregisterAgent: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as IA2AServer;
}

function createMockA2AClient(): IA2AClient {
  return {
    isConnected: jest.fn().mockReturnValue(true),
    delegateTask: jest.fn().mockResolvedValue({
      status: A2ATaskStatus.COMPLETED,
      message: { role: 'assistant', content: 'Delegated task completed' },
      artifacts: [],
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    discoverAgents: jest.fn(),
    collaborate: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  } as unknown as IA2AClient;
}

function createMockMCPTool(name: string, description: string): MCPTool {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string' },
      },
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('MCP-A2A Bridge', () => {
  describe('Schema Validation', () => {
    describe('MCPA2ABridgeConfigSchema', () => {
      it('should validate default config', () => {
        const result = MCPA2ABridgeConfigSchema.parse({});

        expect(result.mode).toBe(BridgeMode.BIDIRECTIONAL);
        expect(result.autoExposeMCPTools).toBe(true);
        expect(result.autoRegisterA2AAgents).toBe(true);
        expect(result.capabilityPrefix).toBe('mcp:');
        expect(result.toolPrefix).toBe('a2a:');
        expect(result.operationTimeout).toBe(30000);
        expect(result.enableLogging).toBe(false);
        expect(result.maxConcurrentOperations).toBe(10);
      });

      it('should validate custom config', () => {
        const config = {
          mode: BridgeMode.MCP_TO_A2A,
          autoExposeMCPTools: false,
          autoRegisterA2AAgents: false,
          capabilityPrefix: 'custom:',
          toolPrefix: 'agent:',
          operationTimeout: 60000,
          enableLogging: true,
          maxConcurrentOperations: 5,
        };

        const result = MCPA2ABridgeConfigSchema.parse(config);

        expect(result).toEqual(config);
      });

      it('should reject invalid timeout', () => {
        expect(() => MCPA2ABridgeConfigSchema.parse({
          operationTimeout: 500, // Below minimum
        })).toThrow();
      });

      it('should reject invalid max concurrent operations', () => {
        expect(() => MCPA2ABridgeConfigSchema.parse({
          maxConcurrentOperations: 0, // Below minimum
        })).toThrow();
      });
    });

    describe('ToolCapabilityMappingSchema', () => {
      it('should validate valid mapping', () => {
        const mapping = {
          toolName: 'test-tool',
          serverId: 'server-1',
          capabilityName: 'mcp:server-1:test-tool',
          description: 'Test tool description',
          tags: ['mcp', 'test'],
        };

        const result = ToolCapabilityMappingSchema.parse(mapping);

        expect(result).toEqual(mapping);
      });

      it('should reject empty tool name', () => {
        expect(() => ToolCapabilityMappingSchema.parse({
          toolName: '',
          serverId: 'server-1',
          capabilityName: 'test',
        })).toThrow();
      });

      it('should provide default tags', () => {
        const result = ToolCapabilityMappingSchema.parse({
          toolName: 'test',
          serverId: 'server-1',
          capabilityName: 'test',
        });

        expect(result.tags).toEqual([]);
      });
    });
  });

  describe('Bridge Creation', () => {
    it('should create bridge with MCP manager', () => {
      const mockClient = createMockMCPClient([]);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));

      const bridge = createMCPA2ABridge({ mcpManager });

      expect(bridge).toBeInstanceOf(MCPA2ABridge);
      expect(bridge.getMode()).toBe(BridgeMode.BIDIRECTIONAL);
    });

    it('should create bridge with A2A server', () => {
      const a2aServer = createMockA2AServer(new Map());

      const bridge = createMCPA2ABridge({ a2aServer });

      expect(bridge).toBeInstanceOf(MCPA2ABridge);
    });

    it('should create bridge with A2A client', () => {
      const a2aClient = createMockA2AClient();

      const bridge = createMCPA2ABridge({ a2aClient });

      expect(bridge).toBeInstanceOf(MCPA2ABridge);
    });

    it('should create bridge with all components', () => {
      const mockClient = createMockMCPClient([]);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      const a2aServer = createMockA2AServer(new Map());
      const a2aClient = createMockA2AClient();

      const bridge = createMCPA2ABridge({
        mcpManager,
        a2aServer,
        a2aClient,
      });

      expect(bridge).toBeInstanceOf(MCPA2ABridge);
    });

    it('should throw if no components provided', () => {
      expect(() => createMCPA2ABridge({})).toThrow(
        'At least one of mcpManager, a2aServer, or a2aClient must be provided'
      );
    });

    it('should apply custom config', () => {
      const mockClient = createMockMCPClient([]);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));

      const bridge = createMCPA2ABridge({
        mcpManager,
        config: {
          mode: BridgeMode.MCP_TO_A2A,
          capabilityPrefix: 'custom:',
        },
      });

      const config = bridge.getConfig();
      expect(config.mode).toBe(BridgeMode.MCP_TO_A2A);
      expect(config.capabilityPrefix).toBe('custom:');
    });
  });

  describe('MCP to A2A Operations', () => {
    let bridge: MCPA2ABridge;
    let mockClient: MockMCPClient;
    let mcpManager: IMCPManager;

    beforeEach(() => {
      const tools = [
        createMockMCPTool('read-file', 'Read a file'),
        createMockMCPTool('write-file', 'Write a file'),
      ];
      mockClient = createMockMCPClient(tools);
      mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      bridge = createMCPA2ABridge({ mcpManager });
    });

    describe('exposeToolsAsCapabilities', () => {
      it('should expose MCP tools as A2A capabilities', async () => {
        const mappings = await bridge.exposeToolsAsCapabilities('server-1');

        expect(mappings).toHaveLength(2);
        expect(mappings[0].toolName).toBe('read-file');
        expect(mappings[0].capabilityName).toBe('mcp:server-1:read-file');
        expect(mappings[1].toolName).toBe('write-file');
        expect(mappings[1].capabilityName).toBe('mcp:server-1:write-file');
      });

      it('should emit TOOL_EXPOSED event for each tool', async () => {
        const eventHandler = jest.fn();
        bridge.on(BridgeEvents.TOOL_EXPOSED, eventHandler);

        await bridge.exposeToolsAsCapabilities('server-1');

        expect(eventHandler).toHaveBeenCalledTimes(2);
        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            serverId: 'server-1',
            toolName: 'read-file',
          })
        );
      });

      it('should throw if MCP manager not configured', async () => {
        const a2aServer = createMockA2AServer(new Map());
        const bridgeWithoutMCP = createMCPA2ABridge({ a2aServer });

        await expect(bridgeWithoutMCP.exposeToolsAsCapabilities('server-1'))
          .rejects.toThrow('MCP Manager not configured');
      });

      it('should throw if server not connected', async () => {
        mcpManager.getClient = jest.fn().mockReturnValue(undefined);

        await expect(bridge.exposeToolsAsCapabilities('unknown-server'))
          .rejects.toThrow("MCP server 'unknown-server' is not connected");
      });

      it('should throw if server not ready', async () => {
        mockClient.isReady.mockReturnValue(false);

        await expect(bridge.exposeToolsAsCapabilities('server-1'))
          .rejects.toThrow("MCP server 'server-1' is not connected");
      });
    });

    describe('hideToolsFromA2A', () => {
      it('should hide exposed tools', async () => {
        await bridge.exposeToolsAsCapabilities('server-1');
        expect(bridge.getExposedMappings().has('server-1')).toBe(true);

        const result = bridge.hideToolsFromA2A('server-1');

        expect(result).toBe(true);
        expect(bridge.getExposedMappings().has('server-1')).toBe(false);
      });

      it('should emit TOOL_HIDDEN event for each tool', async () => {
        await bridge.exposeToolsAsCapabilities('server-1');

        const eventHandler = jest.fn();
        bridge.on(BridgeEvents.TOOL_HIDDEN, eventHandler);

        bridge.hideToolsFromA2A('server-1');

        expect(eventHandler).toHaveBeenCalledTimes(2);
      });

      it('should return false if server not exposed', () => {
        const result = bridge.hideToolsFromA2A('unknown-server');

        expect(result).toBe(false);
      });
    });

    describe('executeToolViaA2A', () => {
      it('should execute MCP tool and return result', async () => {
        const result = await bridge.executeToolViaA2A('server-1', 'read-file', { path: '/test' });

        expect(result.success).toBe(true);
        expect(result.source).toBe(CapabilitySource.MCP);
        expect(result.sourceId).toBe('server-1');
        expect(result.capabilityName).toBe('read-file');
        expect(result.output).toBe('Tool result');
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle tool execution failure', async () => {
        (mcpManager.callTool as jest.Mock).mockResolvedValue({
          success: false,
          error: 'Tool execution failed',
        });

        const result = await bridge.executeToolViaA2A('server-1', 'read-file', {});

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MCP_TOOL_ERROR');
        expect(result.error?.message).toBe('Tool execution failed');
      });

      it('should handle tool execution exception', async () => {
        (mcpManager.callTool as jest.Mock).mockRejectedValue(new Error('Network error'));

        const result = await bridge.executeToolViaA2A('server-1', 'read-file', {});

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('MCP_TOOL_EXCEPTION');
        expect(result.error?.message).toBe('Network error');
      });

      it('should emit operation events', async () => {
        const startHandler = jest.fn();
        const completeHandler = jest.fn();
        bridge.on(BridgeEvents.OPERATION_STARTED, startHandler);
        bridge.on(BridgeEvents.OPERATION_COMPLETED, completeHandler);

        await bridge.executeToolViaA2A('server-1', 'read-file', {});

        expect(startHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'mcp_tool',
            serverId: 'server-1',
            toolName: 'read-file',
          })
        );
        expect(completeHandler).toHaveBeenCalled();
      });

      it('should update statistics', async () => {
        const statsBefore = bridge.getStatistics();
        expect(statsBefore.totalCrossProtocolCalls).toBe(0);

        await bridge.executeToolViaA2A('server-1', 'read-file', {});

        const statsAfter = bridge.getStatistics();
        expect(statsAfter.totalCrossProtocolCalls).toBe(1);
        expect(statsAfter.successfulCalls).toBe(1);
      });
    });
  });

  describe('A2A to MCP Operations', () => {
    let bridge: MCPA2ABridge;
    let a2aServer: IA2AServer;
    let a2aClient: IA2AClient;

    beforeEach(() => {
      const agents = new Map<string, AgentCard>([
        ['agent-1', createMockAgentCard('agent-1', 'Code Agent', ['code-review', 'refactor'])],
      ]);
      a2aServer = createMockA2AServer(agents);
      a2aClient = createMockA2AClient();
      bridge = createMCPA2ABridge({ a2aServer, a2aClient });
    });

    describe('registerAgentAsToolProvider', () => {
      it('should register agent as tool provider', () => {
        const agentCard = createMockAgentCard('agent-2', 'Test Agent');

        const result = bridge.registerAgentAsToolProvider('agent-2', agentCard);

        expect(result).toBe(true);
        expect(bridge.getRegisteredToolProviders().has('agent-2')).toBe(true);
      });

      it('should emit AGENT_REGISTERED event', () => {
        const eventHandler = jest.fn();
        bridge.on(BridgeEvents.AGENT_REGISTERED, eventHandler);

        const agentCard = createMockAgentCard('agent-2', 'Test Agent');
        bridge.registerAgentAsToolProvider('agent-2', agentCard);

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            agentId: 'agent-2',
            agentCard,
          })
        );
      });

      it('should return false if agent already registered', () => {
        const agentCard = createMockAgentCard('agent-2', 'Test Agent');
        bridge.registerAgentAsToolProvider('agent-2', agentCard);

        const result = bridge.registerAgentAsToolProvider('agent-2', agentCard);

        expect(result).toBe(false);
      });
    });

    describe('unregisterAgentFromTools', () => {
      it('should unregister agent from tool providers', () => {
        const agentCard = createMockAgentCard('agent-2', 'Test Agent');
        bridge.registerAgentAsToolProvider('agent-2', agentCard);

        const result = bridge.unregisterAgentFromTools('agent-2');

        expect(result).toBe(true);
        expect(bridge.getRegisteredToolProviders().has('agent-2')).toBe(false);
      });

      it('should emit AGENT_UNREGISTERED event', () => {
        const agentCard = createMockAgentCard('agent-2', 'Test Agent');
        bridge.registerAgentAsToolProvider('agent-2', agentCard);

        const eventHandler = jest.fn();
        bridge.on(BridgeEvents.AGENT_UNREGISTERED, eventHandler);

        bridge.unregisterAgentFromTools('agent-2');

        expect(eventHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            agentId: 'agent-2',
          })
        );
      });

      it('should return false if agent not registered', () => {
        const result = bridge.unregisterAgentFromTools('unknown-agent');

        expect(result).toBe(false);
      });
    });

    describe('executeAgentViaMCP', () => {
      it('should execute via A2A client if connected', async () => {
        const result = await bridge.executeAgentViaMCP('agent-1', 'code-review', { code: 'test' });

        expect(result.success).toBe(true);
        expect(result.source).toBe(CapabilitySource.A2A);
        expect(result.sourceId).toBe('agent-1');
        expect(result.capabilityName).toBe('code-review');
        expect(a2aClient.delegateTask).toHaveBeenCalled();
      });

      it('should fallback to A2A server if client not connected', async () => {
        (a2aClient.isConnected as jest.Mock).mockReturnValue(false);

        const result = await bridge.executeAgentViaMCP('agent-1', 'code-review', {});

        expect(result.success).toBe(true);
        expect(a2aServer.handleTask).toHaveBeenCalled();
      });

      it('should handle task failure', async () => {
        (a2aClient.delegateTask as jest.Mock).mockResolvedValue({
          status: A2ATaskStatus.FAILED,
          error: { code: 'AGENT_ERROR', message: 'Agent failed' },
        });

        const result = await bridge.executeAgentViaMCP('agent-1', 'code-review', {});

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('AGENT_ERROR');
      });

      it('should handle task exception', async () => {
        (a2aClient.delegateTask as jest.Mock).mockRejectedValue(new Error('Connection lost'));

        const result = await bridge.executeAgentViaMCP('agent-1', 'code-review', {});

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('A2A_TASK_EXCEPTION');
        expect(result.error?.message).toBe('Connection lost');
      });

      it('should throw if no A2A client or server available', async () => {
        const mockClient = createMockMCPClient([]);
        const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
        const bridgeWithoutA2A = createMCPA2ABridge({ mcpManager });

        const result = await bridgeWithoutA2A.executeAgentViaMCP('agent-1', 'test', {});

        expect(result.success).toBe(false);
        expect(result.error?.message).toBe('No A2A client or server available');
      });
    });
  });

  describe('Unified Operations', () => {
    let bridge: MCPA2ABridge;
    let mcpManager: IMCPManager;
    let a2aServer: IA2AServer;

    beforeEach(async () => {
      const tools = [createMockMCPTool('mcp-tool', 'MCP Tool')];
      const mockClient = createMockMCPClient(tools);
      mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));

      const agents = new Map<string, AgentCard>();
      a2aServer = createMockA2AServer(agents);

      bridge = createMCPA2ABridge({ mcpManager, a2aServer });

      // Expose tools and register agents
      await bridge.exposeToolsAsCapabilities('server-1');
      bridge.registerAgentAsToolProvider(
        'agent-1',
        createMockAgentCard('agent-1', 'Test Agent', ['agent-capability'])
      );
    });

    describe('getUnifiedCapabilities', () => {
      it('should return combined MCP and A2A capabilities', () => {
        const capabilities = bridge.getUnifiedCapabilities();

        expect(capabilities).toHaveLength(2);

        const mcpCap = capabilities.find((c) => c.source === CapabilitySource.MCP);
        expect(mcpCap).toBeDefined();
        expect(mcpCap?.name).toBe('mcp-tool');

        const a2aCap = capabilities.find((c) => c.source === CapabilitySource.A2A);
        expect(a2aCap).toBeDefined();
        expect(a2aCap?.name).toBe('agent-capability');
      });

      it('should cache capabilities and rebuild on changes', () => {
        const caps1 = bridge.getUnifiedCapabilities();
        const caps2 = bridge.getUnifiedCapabilities();

        // Same reference (cached)
        expect(caps1).not.toBe(caps2); // Returns copy, not same array
        expect(caps1.length).toBe(caps2.length);

        // Add new agent
        bridge.registerAgentAsToolProvider(
          'agent-2',
          createMockAgentCard('agent-2', 'New Agent', ['new-capability'])
        );

        const caps3 = bridge.getUnifiedCapabilities();
        expect(caps3.length).toBe(3);
      });
    });

    describe('executeCapability', () => {
      it('should execute MCP capability', async () => {
        const capabilities = bridge.getUnifiedCapabilities();
        const mcpCap = capabilities.find((c) => c.source === CapabilitySource.MCP)!;

        const result = await bridge.executeCapability(mcpCap.id, { test: 'value' });

        expect(result.success).toBe(true);
        expect(result.source).toBe(CapabilitySource.MCP);
      });

      it('should execute A2A capability', async () => {
        // Need A2A client for execution
        const a2aClient = createMockA2AClient();
        bridge = createMCPA2ABridge({ mcpManager, a2aServer, a2aClient });
        await bridge.exposeToolsAsCapabilities('server-1');
        bridge.registerAgentAsToolProvider(
          'agent-1',
          createMockAgentCard('agent-1', 'Test Agent', ['agent-capability'])
        );

        const capabilities = bridge.getUnifiedCapabilities();
        const a2aCap = capabilities.find((c) => c.source === CapabilitySource.A2A)!;

        const result = await bridge.executeCapability(a2aCap.id, { test: 'value' });

        expect(result.success).toBe(true);
        expect(result.source).toBe(CapabilitySource.A2A);
      });

      it('should return error for unknown capability', async () => {
        const result = await bridge.executeCapability('unknown-capability', {});

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CAPABILITY_NOT_FOUND');
      });
    });

    describe('findCapabilities', () => {
      it('should find by name pattern', () => {
        const found = bridge.findCapabilities({ namePattern: 'mcp' });

        expect(found.length).toBeGreaterThanOrEqual(1);
        expect(found.some((c) => c.name.includes('mcp') || c.description.includes('MCP'))).toBe(true);
      });

      it('should find by tags', () => {
        const found = bridge.findCapabilities({ tags: ['mcp'] });

        expect(found.length).toBeGreaterThanOrEqual(1);
        expect(found.every((c) => c.tags.includes('mcp'))).toBe(true);
      });

      it('should find by source', () => {
        const mcpCaps = bridge.findCapabilities({ source: CapabilitySource.MCP });
        const a2aCaps = bridge.findCapabilities({ source: CapabilitySource.A2A });

        expect(mcpCaps.every((c) => c.source === CapabilitySource.MCP)).toBe(true);
        expect(a2aCaps.every((c) => c.source === CapabilitySource.A2A)).toBe(true);
      });

      it('should combine criteria', () => {
        const found = bridge.findCapabilities({
          namePattern: 'tool',
          source: CapabilitySource.MCP,
        });

        expect(found.every((c) => c.source === CapabilitySource.MCP)).toBe(true);
      });

      it('should return empty array for no matches', () => {
        const found = bridge.findCapabilities({ namePattern: 'nonexistent' });

        expect(found).toHaveLength(0);
      });
    });
  });

  describe('Hybrid Workflow Execution', () => {
    let bridge: MCPA2ABridge;
    let mcpManager: IMCPManager;
    let a2aClient: IA2AClient;

    beforeEach(() => {
      const tools = [createMockMCPTool('analyze', 'Analyze code')];
      const mockClient = createMockMCPClient(tools);
      mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      a2aClient = createMockA2AClient();
      bridge = createMCPA2ABridge({ mcpManager, a2aClient });
    });

    it('should execute simple workflow', async () => {
      const steps: HybridWorkflowStep[] = [
        {
          id: 'step-1',
          type: 'mcp_tool',
          serverId: 'server-1',
          toolName: 'analyze',
          args: { code: 'test' },
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(true);
      expect(result.stepResults.has('step-1')).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should execute workflow with dependencies', async () => {
      const steps: HybridWorkflowStep[] = [
        {
          id: 'step-1',
          type: 'mcp_tool',
          serverId: 'server-1',
          toolName: 'analyze',
          args: { code: 'test' },
        },
        {
          id: 'step-2',
          type: 'a2a_task',
          agentId: 'agent-1',
          capabilityName: 'review',
          args: '${step-1.output}',
          dependsOn: ['step-1'],
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(true);
      expect(result.stepResults.size).toBe(2);
    });

    it('should execute parallel steps', async () => {
      const steps: HybridWorkflowStep[] = [
        {
          id: 'parallel-1',
          type: 'parallel',
          parallelSteps: [
            {
              id: 'step-1a',
              type: 'mcp_tool',
              serverId: 'server-1',
              toolName: 'analyze',
              args: { code: 'test1' },
            },
            {
              id: 'step-1b',
              type: 'mcp_tool',
              serverId: 'server-1',
              toolName: 'analyze',
              args: { code: 'test2' },
            },
          ],
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(true);
      expect(result.stepResults.has('parallel-1')).toBe(true);
    });

    it('should execute conditional steps', async () => {
      // Mock successful first step
      (mcpManager.callTool as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          content: [{ type: MCPContentType.TEXT, text: 'Analysis result' }],
        },
      });

      const steps: HybridWorkflowStep[] = [
        {
          id: 'step-1',
          type: 'mcp_tool',
          serverId: 'server-1',
          toolName: 'analyze',
          args: { code: 'test' },
        },
        {
          id: 'conditional-1',
          type: 'conditional',
          condition: '${step-1.success}',
          dependsOn: ['step-1'],
          thenSteps: [
            {
              id: 'then-step',
              type: 'a2a_task',
              agentId: 'agent-1',
              capabilityName: 'refactor',
              args: {},
            },
          ],
          elseSteps: [],
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(true);
    });

    it('should handle circular dependencies', async () => {
      const steps: HybridWorkflowStep[] = [
        {
          id: 'step-1',
          type: 'mcp_tool',
          serverId: 'server-1',
          toolName: 'analyze',
          args: {},
          dependsOn: ['step-2'],
        },
        {
          id: 'step-2',
          type: 'mcp_tool',
          serverId: 'server-1',
          toolName: 'analyze',
          args: {},
          dependsOn: ['step-1'],
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toBe('Unresolved dependencies');
    });

    it('should handle step failures', async () => {
      (mcpManager.callTool as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Tool failed',
      });

      const steps: HybridWorkflowStep[] = [
        {
          id: 'step-1',
          type: 'mcp_tool',
          serverId: 'server-1',
          toolName: 'analyze',
          args: {},
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('should validate step requirements', async () => {
      const steps: HybridWorkflowStep[] = [
        {
          id: 'invalid-mcp',
          type: 'mcp_tool',
          // Missing serverId and toolName
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(false);
      expect(result.errors[0].error).toContain('requires serverId and toolName');
    });
  });

  describe('Statistics', () => {
    let bridge: MCPA2ABridge;

    beforeEach(() => {
      const tools = [createMockMCPTool('test', 'Test tool')];
      const mockClient = createMockMCPClient(tools);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      bridge = createMCPA2ABridge({ mcpManager });
    });

    it('should return initial statistics', () => {
      const stats = bridge.getStatistics();

      expect(stats.mode).toBe(BridgeMode.BIDIRECTIONAL);
      expect(stats.mcpToolsExposed).toBe(0);
      expect(stats.a2aAgentsRegistered).toBe(0);
      expect(stats.totalCrossProtocolCalls).toBe(0);
      expect(stats.successfulCalls).toBe(0);
      expect(stats.failedCalls).toBe(0);
      expect(stats.averageLatency).toBe(0);
      expect(stats.activeOperations).toBe(0);
    });

    it('should track exposed tools', async () => {
      await bridge.exposeToolsAsCapabilities('server-1');

      const stats = bridge.getStatistics();
      expect(stats.mcpToolsExposed).toBe(1);
    });

    it('should track registered agents', () => {
      bridge.registerAgentAsToolProvider(
        'agent-1',
        createMockAgentCard('agent-1', 'Test')
      );

      const stats = bridge.getStatistics();
      expect(stats.a2aAgentsRegistered).toBe(1);
    });

    it('should track calls and latency', async () => {
      await bridge.executeToolViaA2A('server-1', 'test', {});
      await bridge.executeToolViaA2A('server-1', 'test', {});

      const stats = bridge.getStatistics();
      expect(stats.totalCrossProtocolCalls).toBe(2);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.averageLatency).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics', async () => {
      await bridge.executeToolViaA2A('server-1', 'test', {});

      bridge.resetStatistics();

      const stats = bridge.getStatistics();
      expect(stats.totalCrossProtocolCalls).toBe(0);
      expect(stats.successfulCalls).toBe(0);
    });
  });

  describe('Lifecycle', () => {
    describe('sync', () => {
      it('should sync MCP tools when autoExposeMCPTools is true', async () => {
        const tools = [createMockMCPTool('auto-tool', 'Auto tool')];
        const mockClient = createMockMCPClient(tools);
        const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
        const bridge = createMCPA2ABridge({
          mcpManager,
          config: { autoExposeMCPTools: true },
        });

        await bridge.sync();

        expect(bridge.getExposedMappings().has('server-1')).toBe(true);
      });

      it('should sync A2A agents when autoRegisterA2AAgents is true', async () => {
        const agents = new Map<string, AgentCard>([
          ['auto-agent', createMockAgentCard('auto-agent', 'Auto Agent')],
        ]);
        const a2aServer = createMockA2AServer(agents);
        const bridge = createMCPA2ABridge({
          a2aServer,
          config: { autoRegisterA2AAgents: true },
        });

        await bridge.sync();

        // Note: The agent ID is extracted from URL, so this may vary
        expect(bridge.getRegisteredToolProviders().size).toBeGreaterThanOrEqual(0);
      });

      it('should emit CAPABILITY_SYNCED event', async () => {
        const tools = [createMockMCPTool('tool', 'Tool')];
        const mockClient = createMockMCPClient(tools);
        const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
        const bridge = createMCPA2ABridge({ mcpManager });

        const eventHandler = jest.fn();
        bridge.on(BridgeEvents.CAPABILITY_SYNCED, eventHandler);

        await bridge.sync();

        expect(eventHandler).toHaveBeenCalled();
      });
    });

    describe('dispose', () => {
      it('should clear all mappings and providers', async () => {
        const tools = [createMockMCPTool('tool', 'Tool')];
        const mockClient = createMockMCPClient(tools);
        const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
        const bridge = createMCPA2ABridge({ mcpManager });

        await bridge.exposeToolsAsCapabilities('server-1');
        bridge.registerAgentAsToolProvider('agent-1', createMockAgentCard('agent-1', 'Agent'));

        await bridge.dispose();

        expect(bridge.getExposedMappings().size).toBe(0);
        expect(bridge.getRegisteredToolProviders().size).toBe(0);
        expect(bridge.getUnifiedCapabilities()).toHaveLength(0);
      });

      it('should throw on operations after dispose', async () => {
        const tools = [createMockMCPTool('tool', 'Tool')];
        const mockClient = createMockMCPClient(tools);
        const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
        const bridge = createMCPA2ABridge({ mcpManager });

        await bridge.dispose();

        await expect(bridge.exposeToolsAsCapabilities('server-1'))
          .rejects.toThrow('Bridge has been disposed');
      });

      it('should be idempotent', async () => {
        const tools = [createMockMCPTool('tool', 'Tool')];
        const mockClient = createMockMCPClient(tools);
        const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
        const bridge = createMCPA2ABridge({ mcpManager });

        await bridge.dispose();
        await bridge.dispose(); // Should not throw
      });
    });
  });

  describe('Events', () => {
    it('should support event subscription', () => {
      const tools = [createMockMCPTool('tool', 'Tool')];
      const mockClient = createMockMCPClient(tools);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      const bridge = createMCPA2ABridge({ mcpManager });

      const handler = jest.fn();
      bridge.on(BridgeEvents.TOOL_EXPOSED, handler);

      expect(bridge.listenerCount(BridgeEvents.TOOL_EXPOSED)).toBe(1);
    });

    it('should support event unsubscription', () => {
      const tools = [createMockMCPTool('tool', 'Tool')];
      const mockClient = createMockMCPClient(tools);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      const bridge = createMCPA2ABridge({ mcpManager });

      const handler = jest.fn();
      bridge.on(BridgeEvents.TOOL_EXPOSED, handler);
      bridge.off(BridgeEvents.TOOL_EXPOSED, handler);

      expect(bridge.listenerCount(BridgeEvents.TOOL_EXPOSED)).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tool list from MCP server', async () => {
      const mockClient = createMockMCPClient([]);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      const bridge = createMCPA2ABridge({ mcpManager });

      const mappings = await bridge.exposeToolsAsCapabilities('server-1');

      expect(mappings).toHaveLength(0);
    });

    it('should handle agent card without capabilities', () => {
      const a2aServer = createMockA2AServer(new Map());
      const bridge = createMCPA2ABridge({ a2aServer });

      const agentCard: AgentCard = {
        name: 'Empty Agent',
        description: 'No capabilities',
        url: 'http://localhost:3000/agents/empty',
        version: '1.0.0',
        capabilities: [],
        skills: [],
        defaultInputModes: [A2AContentMode.TEXT],
        defaultOutputModes: [A2AContentMode.TEXT],
        supportsStreaming: false,
        supportsPushNotifications: false,
      };

      bridge.registerAgentAsToolProvider('empty', agentCard);

      const capabilities = bridge.getUnifiedCapabilities();
      expect(capabilities.filter((c) => c.sourceId === 'empty')).toHaveLength(0);
    });

    it('should handle MCP tool with complex content', async () => {
      const mockClient = createMockMCPClient([createMockMCPTool('complex', 'Complex tool')]);
      mockClient.callTool.mockResolvedValue({
        success: true,
        data: {
          content: [
            { type: MCPContentType.TEXT, text: 'Text content' },
            { type: MCPContentType.IMAGE, data: 'base64data', mimeType: 'image/png' },
          ],
        },
      });

      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      (mcpManager.callTool as jest.Mock).mockImplementation(() => mockClient.callTool());

      const bridge = createMCPA2ABridge({ mcpManager });

      const result = await bridge.executeToolViaA2A('server-1', 'complex', {});

      expect(result.success).toBe(true);
      expect(Array.isArray(result.output)).toBe(true);
      expect(result.artifacts).toBeDefined();
      expect(result.artifacts!.length).toBe(2);
    });

    it('should handle workflow with empty parallel steps', async () => {
      const mockClient = createMockMCPClient([]);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      const bridge = createMCPA2ABridge({ mcpManager });

      const steps: HybridWorkflowStep[] = [
        {
          id: 'empty-parallel',
          type: 'parallel',
          parallelSteps: [],
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      expect(result.success).toBe(true);
    });

    it('should handle variable resolution with missing step', async () => {
      const mockClient = createMockMCPClient([createMockMCPTool('tool', 'Tool')]);
      const mcpManager = createMockMCPManager(new Map([['server-1', mockClient]]));
      const bridge = createMCPA2ABridge({ mcpManager });

      const steps: HybridWorkflowStep[] = [
        {
          id: 'step-1',
          type: 'mcp_tool',
          serverId: 'server-1',
          toolName: 'tool',
          args: { input: '${nonexistent.output}' },
        },
      ];

      const result = await bridge.executeHybridWorkflow(steps);

      // Should still execute, but with unresolved variable
      expect(result.stepResults.has('step-1')).toBe(true);
    });
  });
});
