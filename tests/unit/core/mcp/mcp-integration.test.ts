/**
 * MCP Integration Tests
 *
 * End-to-end tests for MCP client ↔ server communication.
 */

import { MCPServer, createMCPServer } from '@/core/mcp/mcp-server';
import { createMCPToolRegistry } from '@/core/mcp/mcp-tool-registry';
import type { MCPToolDefinition, MCPToolResult, IMCPClient } from '@/core/mcp/interfaces/mcp.interface';

describe('MCP Integration', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = createMCPServer();
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  it('should register tool on server and list via getRegisteredTools', () => {
    const tool: MCPToolDefinition = {
      name: 'echo',
      description: 'Echo tool',
      inputSchema: { type: 'object' },
    };
    server.registerTool(tool, async (args) => ({
      content: [{ type: 'text', text: JSON.stringify(args) }],
    }));

    const tools = server.getRegisteredTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('echo');
  });

  it('should start server on random port and stop cleanly', async () => {
    await server.start(0);
    expect(server.isRunning()).toBe(true);
    await server.stop();
    expect(server.isRunning()).toBe(false);
  });

  it('should bridge MCP tools to skills via registry', () => {
    const registry = createMCPToolRegistry();
    const tools: MCPToolDefinition[] = [
      { name: 'tool-1', description: 'First', inputSchema: {} },
      { name: 'tool-2', description: 'Second', inputSchema: {} },
    ];

    const mockClient: IMCPClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      listTools: jest.fn().mockResolvedValue(tools),
      callTool: jest.fn(),
      listResources: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    };

    registry.registerAsSkills(tools, mockClient);
    const skills = registry.getSkills();

    expect(skills).toHaveLength(2);
    expect(skills[0].name).toBe('mcp:tool-1');
    expect(skills[1].name).toBe('mcp:tool-2');
    expect(skills[0].tags).toContain('mcp');
  });

  it('should discover then register flow', async () => {
    const tools: MCPToolDefinition[] = [
      { name: 'read', description: 'Read file', inputSchema: {} },
    ];

    const mockClient: IMCPClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      listTools: jest.fn().mockResolvedValue(tools),
      callTool: jest.fn(),
      listResources: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    };

    const registry = createMCPToolRegistry();
    const discovered = await registry.discover(mockClient);
    registry.registerAsSkills(discovered, mockClient);

    expect(registry.getRegisteredTools()).toHaveLength(1);
    expect(registry.getSkills()[0].name).toBe('mcp:read');
  });

  it('should execute skill that delegates to mock client', async () => {
    const result: MCPToolResult = {
      content: [{ type: 'text', text: 'hello world' }],
    };
    const mockClient: IMCPClient = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      listTools: jest.fn(),
      callTool: jest.fn().mockResolvedValue(result),
      listResources: jest.fn(),
      isConnected: jest.fn().mockReturnValue(true),
    };

    const registry = createMCPToolRegistry();
    registry.registerAsSkills(
      [{ name: 'greet', description: 'Greet', inputSchema: {} }],
      mockClient,
    );

    const skill = registry.getSkills()[0];
    const out = await skill.execute({ name: 'world' }, { workspaceDir: '/tmp' });

    expect(out.success).toBe(true);
    expect(out.output).toEqual(result);
    expect(mockClient.callTool).toHaveBeenCalledWith('greet', { name: 'world' });
  });
});
