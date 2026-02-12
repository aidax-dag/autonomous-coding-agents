/**
 * MCP Tool Registry
 *
 * Discovers MCP tools and bridges them to ACA SkillRegistry as MCPToolSkill.
 *
 * @module core/mcp/mcp-tool-registry
 */

import type {
  IMCPToolRegistry,
  IMCPClient,
  MCPToolDefinition,
  MCPToolResult,
} from './interfaces/mcp.interface';
import type {
  ISkill,
  SkillContext,
  SkillResult,
} from '../skills/interfaces/skill.interface';

/**
 * MCPToolSkill — Adapts an MCP tool as an ISkill
 */
export class MCPToolSkill implements ISkill<Record<string, unknown>, MCPToolResult> {
  readonly name: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly version = '1.0.0';
  private client: IMCPClient;
  private toolName: string;

  constructor(definition: MCPToolDefinition, client: IMCPClient) {
    this.name = `mcp:${definition.name}`;
    this.description = definition.description;
    this.tags = ['mcp', 'external'];
    this.client = client;
    this.toolName = definition.name;
  }

  async execute(
    input: Record<string, unknown>,
    _context: SkillContext,
  ): Promise<SkillResult<MCPToolResult>> {
    const start = Date.now();
    try {
      const result = await this.client.callTool(this.toolName, input);
      return {
        success: !result.isError,
        output: result,
        duration: Date.now() - start,
        metadata: { source: 'mcp', tool: this.toolName },
      };
    } catch (error) {
      return {
        success: false,
        output: {
          content: [{ type: 'text', text: (error as Error).message }],
          isError: true,
        },
        error: (error as Error).message,
        duration: Date.now() - start,
      };
    }
  }

  validate(input: Record<string, unknown>): boolean {
    return typeof input === 'object' && input !== null;
  }

  canHandle(_input: Record<string, unknown>, _context: SkillContext): boolean {
    return this.client.isConnected();
  }
}

/**
 * MCP Tool Registry
 *
 * Discovers tools from MCP servers and registers them as skills.
 */
export class MCPToolRegistry implements IMCPToolRegistry {
  private registeredTools: MCPToolDefinition[] = [];
  private skills: MCPToolSkill[] = [];

  async discover(client: IMCPClient): Promise<MCPToolDefinition[]> {
    const tools = await client.listTools();
    return tools;
  }

  registerAsSkills(tools: MCPToolDefinition[], client: IMCPClient): void {
    for (const tool of tools) {
      const skill = new MCPToolSkill(tool, client);
      this.skills.push(skill);
      this.registeredTools.push(tool);
    }
  }

  getRegisteredTools(): MCPToolDefinition[] {
    return [...this.registeredTools];
  }

  getSkills(): MCPToolSkill[] {
    return [...this.skills];
  }

  clear(): void {
    this.registeredTools = [];
    this.skills = [];
  }
}

/**
 * Create an MCP tool registry
 */
export function createMCPToolRegistry(): MCPToolRegistry {
  return new MCPToolRegistry();
}
