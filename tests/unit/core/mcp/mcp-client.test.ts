/**
 * MCP Client Tests
 */

import { MCPClient } from '@/core/mcp/mcp-client';

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = new MCPClient();
  });

  it('should start disconnected', () => {
    expect(client.isConnected()).toBe(false);
  });

  it('should throw on stdio connect without command', async () => {
    await expect(
      client.connect({ name: 'test', transport: 'stdio' }),
    ).rejects.toThrow('command');
  });

  it('should throw on sse connect without url', async () => {
    await expect(
      client.connect({ name: 'test', transport: 'sse' }),
    ).rejects.toThrow('url');
  });

  it('should throw on listTools when not connected', async () => {
    await expect(client.listTools()).rejects.toThrow('Not connected');
  });

  it('should throw on callTool when not connected', async () => {
    await expect(client.callTool('test', {})).rejects.toThrow('Not connected');
  });

  it('should throw on listResources when not connected', async () => {
    await expect(client.listResources()).rejects.toThrow('Not connected');
  });

  it('should disconnect safely when not connected', async () => {
    await expect(client.disconnect()).resolves.not.toThrow();
  });

  it('should create via factory', async () => {
    const { createMCPClient } = await import('@/core/mcp/mcp-client');
    const c = createMCPClient();
    expect(c).toBeInstanceOf(MCPClient);
  });
});
