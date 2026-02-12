/**
 * MCP Server Tests
 */

import { MCPServer } from '@/core/mcp/mcp-server';
import type { MCPToolDefinition } from '@/core/mcp/interfaces/mcp.interface';

describe('MCPServer', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  it('should start and stop', async () => {
    await server.start(0); // random port
    expect(server.isRunning()).toBe(true);
    await server.stop();
    expect(server.isRunning()).toBe(false);
  });

  it('should register and unregister tools', () => {
    const tool: MCPToolDefinition = {
      name: 'test-tool',
      description: 'Test tool',
      inputSchema: { type: 'object' },
    };
    server.registerTool(tool, async () => ({
      content: [{ type: 'text', text: 'ok' }],
    }));
    expect(server.getRegisteredTools()).toHaveLength(1);

    expect(server.unregisterTool('test-tool')).toBe(true);
    expect(server.getRegisteredTools()).toHaveLength(0);
  });

  it('should return false when unregistering nonexistent tool', () => {
    expect(server.unregisterTool('nonexistent')).toBe(false);
  });

  it('should not start twice', async () => {
    await server.start(0);
    await server.start(0); // idempotent
    expect(server.isRunning()).toBe(true);
  });

  it('should handle stop when not running', async () => {
    await expect(server.stop()).resolves.not.toThrow();
  });

  it('should create via factory', async () => {
    const { createMCPServer } = await import('@/core/mcp/mcp-server');
    const s = createMCPServer();
    expect(s).toBeInstanceOf(MCPServer);
  });
});
