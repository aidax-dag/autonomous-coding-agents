/**
 * MCP Server Presets
 *
 * Common MCP server configurations for popular servers.
 * These presets provide sensible defaults and can be used
 * directly in the MCPConnectionManager configuration.
 *
 * @module core/mcp/presets
 */

import type { MCPServerEntry } from '../mcp-connection-manager';

/**
 * Built-in MCP server presets
 */
export const MCP_PRESETS: Record<string, MCPServerEntry> = {
  /**
   * Filesystem server — provides read/write access to a workspace directory.
   * Requires: @modelcontextprotocol/server-filesystem
   */
  filesystem: {
    name: 'filesystem',
    transport: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
  },

  /**
   * GitHub server — provides GitHub API access for repository operations.
   * Requires: @modelcontextprotocol/server-github
   * Requires: GITHUB_PERSONAL_ACCESS_TOKEN environment variable
   */
  github: {
    name: 'github',
    transport: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' },
  },

  /**
   * Fetch server — provides HTTP fetch capabilities for web content retrieval.
   * Requires: @modelcontextprotocol/server-fetch
   */
  fetch: {
    name: 'fetch',
    transport: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  },

  /**
   * Memory server — provides persistent key-value storage.
   * Requires: @modelcontextprotocol/server-memory
   */
  memory: {
    name: 'memory',
    transport: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },

  /**
   * Brave Search server — provides web search via Brave Search API.
   * Requires: @modelcontextprotocol/server-brave-search
   * Requires: BRAVE_API_KEY environment variable
   */
  'brave-search': {
    name: 'brave-search',
    transport: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '' },
  },
};

/**
 * Get a preset MCP server configuration by name.
 * Returns a deep copy to prevent mutation of the original preset.
 */
export function getMCPPreset(name: string): MCPServerEntry | undefined {
  const preset = MCP_PRESETS[name];
  if (!preset) return undefined;
  return { ...preset, args: preset.args ? [...preset.args] : undefined, env: preset.env ? { ...preset.env } : undefined };
}

/**
 * List all available preset names.
 */
export function listPresets(): string[] {
  return Object.keys(MCP_PRESETS);
}
