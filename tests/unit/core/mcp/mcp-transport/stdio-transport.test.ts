/**
 * Stdio Transport Tests
 */

import { StdioTransport } from '@/core/mcp/mcp-transport/stdio-transport';

describe('StdioTransport', () => {
  it('should create transport with command', () => {
    const transport = new StdioTransport('echo', ['hello']);
    expect(transport).toBeDefined();
    expect(transport.isConnected()).toBe(false);
  });

  it('should connect and disconnect', async () => {
    const transport = new StdioTransport('cat', []);
    await transport.connect();
    expect(transport.isConnected()).toBe(true);
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
  });

  it('should register message handler', () => {
    const transport = new StdioTransport('echo', []);
    const handler = jest.fn();
    transport.onMessage(handler);
    // Handler registered without error
    expect(transport).toBeDefined();
  });

  it('should throw on send when not connected', async () => {
    const transport = new StdioTransport('echo', []);
    await expect(
      transport.send({ jsonrpc: '2.0', method: 'test' }),
    ).rejects.toThrow('not connected');
  });

  it('should handle process spawn and kill', async () => {
    const transport = new StdioTransport('cat', []);
    await transport.connect();
    expect(transport.isConnected()).toBe(true);
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
  });
});
