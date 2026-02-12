/**
 * SSE Transport Tests
 */

import { SSETransport } from '@/core/mcp/mcp-transport/sse-transport';

describe('SSETransport', () => {
  it('should create transport with URL', () => {
    const transport = new SSETransport('http://localhost:3100');
    expect(transport).toBeDefined();
    expect(transport.isConnected()).toBe(false);
  });

  it('should connect and set connected state', async () => {
    const transport = new SSETransport('http://localhost:3100');
    await transport.connect();
    expect(transport.isConnected()).toBe(true);
  });

  it('should disconnect', async () => {
    const transport = new SSETransport('http://localhost:3100');
    await transport.connect();
    await transport.disconnect();
    expect(transport.isConnected()).toBe(false);
  });

  it('should register message handler', () => {
    const transport = new SSETransport('http://localhost:3100');
    const handler = jest.fn();
    transport.onMessage(handler);
    expect(transport).toBeDefined();
  });

  it('should throw on send when not connected', async () => {
    const transport = new SSETransport('http://localhost:3100');
    await expect(
      transport.send({ jsonrpc: '2.0', method: 'test' }),
    ).rejects.toThrow('not connected');
  });
});
