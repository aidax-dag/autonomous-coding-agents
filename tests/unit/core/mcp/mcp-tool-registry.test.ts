/**
 * MCP Tool Registry Tests
 */

import { MCPToolSkill, MCPToolRegistry, createMCPToolRegistry } from '@/core/mcp/mcp-tool-registry';
import type { IMCPClient, MCPToolDefinition, MCPToolResult } from '@/core/mcp/interfaces/mcp.interface';
import type { SkillContext } from '@/core/skills/interfaces/skill.interface';

function makeMockClient(overrides: Partial<IMCPClient> = {}): IMCPClient {
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    listTools: jest.fn().mockResolvedValue([]),
    callTool: jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
    listResources: jest.fn().mockResolvedValue([]),
    isConnected: jest.fn().mockReturnValue(true),
    ...overrides,
  };
}

const TOOL_DEF: MCPToolDefinition = {
  name: 'read-file',
  description: 'Read a file',
  inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
};

const CTX: SkillContext = { workspaceDir: '/tmp' };

describe('MCPToolSkill', () => {
  it('should adapt tool definition to ISkill', () => {
    const client = makeMockClient();
    const skill = new MCPToolSkill(TOOL_DEF, client);
    expect(skill.name).toBe('mcp:read-file');
    expect(skill.description).toBe('Read a file');
    expect(skill.tags).toContain('mcp');
    expect(skill.tags).toContain('external');
    expect(skill.version).toBe('1.0.0');
  });

  it('should execute by calling client.callTool', async () => {
    const result: MCPToolResult = { content: [{ type: 'text', text: 'file contents' }] };
    const client = makeMockClient({ callTool: jest.fn().mockResolvedValue(result) });
    const skill = new MCPToolSkill(TOOL_DEF, client);

    const out = await skill.execute({ path: '/tmp/test.ts' }, CTX);
    expect(out.success).toBe(true);
    expect(out.output).toEqual(result);
    expect(client.callTool).toHaveBeenCalledWith('read-file', { path: '/tmp/test.ts' });
  });

  it('should return error result on callTool failure', async () => {
    const client = makeMockClient({
      callTool: jest.fn().mockRejectedValue(new Error('connection lost')),
    });
    const skill = new MCPToolSkill(TOOL_DEF, client);

    const out = await skill.execute({ path: '/x' }, CTX);
    expect(out.success).toBe(false);
    expect(out.error).toBe('connection lost');
    expect(out.output?.isError).toBe(true);
  });

  it('should mark success false when result has isError', async () => {
    const result: MCPToolResult = {
      content: [{ type: 'text', text: 'fail' }],
      isError: true,
    };
    const client = makeMockClient({ callTool: jest.fn().mockResolvedValue(result) });
    const skill = new MCPToolSkill(TOOL_DEF, client);

    const out = await skill.execute({}, CTX);
    expect(out.success).toBe(false);
  });

  it('should validate input is object', () => {
    const client = makeMockClient();
    const skill = new MCPToolSkill(TOOL_DEF, client);
    expect(skill.validate({ path: '/a' })).toBe(true);
    expect(skill.validate(null as unknown as Record<string, unknown>)).toBe(false);
  });

  it('should report canHandle based on client connection', () => {
    const client = makeMockClient({ isConnected: jest.fn().mockReturnValue(false) });
    const skill = new MCPToolSkill(TOOL_DEF, client);
    expect(skill.canHandle({}, CTX)).toBe(false);

    (client.isConnected as jest.Mock).mockReturnValue(true);
    expect(skill.canHandle({}, CTX)).toBe(true);
  });
});

describe('MCPToolRegistry', () => {
  it('should discover tools from client', async () => {
    const tools: MCPToolDefinition[] = [
      { name: 'tool-a', description: 'A', inputSchema: { type: 'object' } },
      { name: 'tool-b', description: 'B', inputSchema: { type: 'object' } },
    ];
    const client = makeMockClient({ listTools: jest.fn().mockResolvedValue(tools) });
    const registry = new MCPToolRegistry();

    const discovered = await registry.discover(client);
    expect(discovered).toEqual(tools);
  });

  it('should register tools as skills', () => {
    const tools: MCPToolDefinition[] = [
      { name: 'tool-a', description: 'A', inputSchema: { type: 'object' } },
    ];
    const client = makeMockClient();
    const registry = new MCPToolRegistry();

    registry.registerAsSkills(tools, client);
    expect(registry.getRegisteredTools()).toHaveLength(1);
    expect(registry.getSkills()).toHaveLength(1);
    expect(registry.getSkills()[0].name).toBe('mcp:tool-a');
  });

  it('should return copies from getters', () => {
    const registry = new MCPToolRegistry();
    const tools: MCPToolDefinition[] = [
      { name: 'x', description: 'X', inputSchema: {} },
    ];
    registry.registerAsSkills(tools, makeMockClient());

    const t1 = registry.getRegisteredTools();
    const t2 = registry.getRegisteredTools();
    expect(t1).not.toBe(t2);
    expect(t1).toEqual(t2);
  });

  it('should clear all tools and skills', () => {
    const registry = new MCPToolRegistry();
    registry.registerAsSkills(
      [{ name: 'y', description: 'Y', inputSchema: {} }],
      makeMockClient(),
    );
    expect(registry.getSkills()).toHaveLength(1);

    registry.clear();
    expect(registry.getRegisteredTools()).toHaveLength(0);
    expect(registry.getSkills()).toHaveLength(0);
  });

  it('should create via factory', () => {
    const r = createMCPToolRegistry();
    expect(r).toBeInstanceOf(MCPToolRegistry);
  });
});
