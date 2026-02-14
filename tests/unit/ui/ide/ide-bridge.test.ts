/**
 * IDE Bridge Tests
 *
 * Comprehensive tests for the IDEBridge server-side communication layer.
 *
 * Feature: E-3 IDE Integration
 */

import {
  IDEBridge,
  createIDEBridge,
  RPC_ERRORS,
  type IDEClient,
  type RPCRequest,
  type RPCNotification,
} from '@/ui/ide/ide-bridge';

function makeClient(overrides: Partial<IDEClient> = {}): IDEClient {
  return {
    id: `client-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: 'vscode',
    connectedAt: new Date().toISOString(),
    capabilities: ['commands', 'diagnostics'],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<RPCRequest> = {}): RPCRequest {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'getStatus',
    ...overrides,
  };
}

describe('IDEBridge', () => {
  let bridge: IDEBridge;

  beforeEach(() => {
    bridge = new IDEBridge();
  });

  afterEach(() => {
    bridge.dispose();
  });

  // ── Client Connection ──────────────────────────────────────────

  describe('connectClient', () => {
    it('should connect a client successfully', () => {
      const client = makeClient({ id: 'c1' });
      bridge.connectClient(client);

      expect(bridge.getConnectedClients()).toHaveLength(1);
      expect(bridge.getClient('c1')).toEqual(client);
    });

    it('should emit client:connected event', () => {
      const handler = jest.fn();
      bridge.on('client:connected', handler);

      const client = makeClient({ id: 'c1' });
      bridge.connectClient(client);

      expect(handler).toHaveBeenCalledWith(client);
    });

    it('should support multiple IDE client types', () => {
      bridge.connectClient(makeClient({ id: 'vs', type: 'vscode' }));
      bridge.connectClient(makeClient({ id: 'jb', type: 'jetbrains' }));
      bridge.connectClient(makeClient({ id: 'ot', type: 'other' }));

      expect(bridge.getConnectedClients()).toHaveLength(3);
    });

    it('should reject when max clients reached', () => {
      const limitedBridge = new IDEBridge({ maxClients: 2 });

      limitedBridge.connectClient(makeClient({ id: 'c1' }));
      limitedBridge.connectClient(makeClient({ id: 'c2' }));

      expect(() => {
        limitedBridge.connectClient(makeClient({ id: 'c3' }));
      }).toThrow('Maximum client limit reached (2)');

      limitedBridge.dispose();
    });
  });

  // ── Client Disconnection ───────────────────────────────────────

  describe('disconnectClient', () => {
    it('should disconnect an existing client and return true', () => {
      bridge.connectClient(makeClient({ id: 'c1' }));
      const result = bridge.disconnectClient('c1');

      expect(result).toBe(true);
      expect(bridge.getConnectedClients()).toHaveLength(0);
    });

    it('should return false for unknown client', () => {
      expect(bridge.disconnectClient('nonexistent')).toBe(false);
    });

    it('should emit client:disconnected event', () => {
      const handler = jest.fn();
      bridge.on('client:disconnected', handler);

      const client = makeClient({ id: 'c1' });
      bridge.connectClient(client);
      bridge.disconnectClient('c1');

      expect(handler).toHaveBeenCalledWith(client);
    });
  });

  // ── Client Queries ─────────────────────────────────────────────

  describe('getConnectedClients', () => {
    it('should return empty array when no clients', () => {
      expect(bridge.getConnectedClients()).toEqual([]);
    });

    it('should return all connected clients', () => {
      bridge.connectClient(makeClient({ id: 'c1' }));
      bridge.connectClient(makeClient({ id: 'c2' }));

      const clients = bridge.getConnectedClients();
      expect(clients).toHaveLength(2);
      expect(clients.map((c) => c.id)).toEqual(['c1', 'c2']);
    });
  });

  describe('getClient', () => {
    it('should return null for unknown client', () => {
      expect(bridge.getClient('nonexistent')).toBeNull();
    });

    it('should return the client when found', () => {
      const client = makeClient({ id: 'c1', type: 'jetbrains' });
      bridge.connectClient(client);

      expect(bridge.getClient('c1')).toEqual(client);
    });
  });

  // ── RPC Message Handling ───────────────────────────────────────

  describe('handleMessage', () => {
    beforeEach(() => {
      bridge.connectClient(makeClient({ id: 'c1' }));
    });

    it('should handle a valid RPC request for built-in command', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'getStatus',
        id: 42,
      }));

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(42);
      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect((response.result as Record<string, unknown>).connectedClients).toBe(1);
    });

    it('should return INVALID_REQUEST for disconnected client', async () => {
      const response = await bridge.handleMessage('unknown', makeRequest());

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.INVALID_REQUEST);
      expect(response.error!.message).toBe('Client not connected');
    });

    it('should return INVALID_REQUEST for missing jsonrpc version', async () => {
      const badRequest = { id: 1, method: 'getStatus' } as unknown as RPCRequest;
      const response = await bridge.handleMessage('c1', badRequest);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.INVALID_REQUEST);
    });

    it('should return INVALID_REQUEST for missing id', async () => {
      const badRequest = { jsonrpc: '2.0', method: 'getStatus' } as unknown as RPCRequest;
      const response = await bridge.handleMessage('c1', badRequest);

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.INVALID_REQUEST);
    });

    it('should return INVALID_REQUEST for empty method', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({ method: '' }));

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.INVALID_REQUEST);
    });

    it('should return METHOD_NOT_FOUND for unknown method', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'unknownMethod',
      }));

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.METHOD_NOT_FOUND);
      expect(response.error!.message).toContain('unknownMethod');
    });

    it('should return INTERNAL_ERROR when command handler throws', async () => {
      bridge.registerCommand('failingCommand', async () => {
        throw new Error('Handler exploded');
      });

      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'failingCommand',
      }));

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.INTERNAL_ERROR);
      expect(response.error!.message).toBe('Handler exploded');
    });

    it('should handle command timeout', async () => {
      const timeoutBridge = new IDEBridge({ commandTimeout: 50 });
      timeoutBridge.connectClient(makeClient({ id: 'tc1' }));

      timeoutBridge.registerCommand('slowCommand', async () => {
        return new Promise((resolve) => setTimeout(resolve, 200));
      });

      const response = await timeoutBridge.handleMessage('tc1', makeRequest({
        method: 'slowCommand',
      }));

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.INTERNAL_ERROR);
      expect(response.error!.message).toBe('Command execution timed out');

      timeoutBridge.dispose();
    });

    it('should emit command:executed event on success', async () => {
      const handler = jest.fn();
      bridge.on('command:executed', handler);

      await bridge.handleMessage('c1', makeRequest({ method: 'getStatus' }));

      expect(handler).toHaveBeenCalledWith({
        method: 'getStatus',
        clientId: 'c1',
      });
    });

    it('should not emit command:executed event on failure', async () => {
      bridge.registerCommand('failCommand', async () => {
        throw new Error('fail');
      });

      const handler = jest.fn();
      bridge.on('command:executed', handler);

      await bridge.handleMessage('c1', makeRequest({ method: 'failCommand' }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass params to the command handler', async () => {
      const handlerFn = jest.fn().mockResolvedValue({ ok: true });
      bridge.registerCommand('custom', handlerFn);

      await bridge.handleMessage('c1', makeRequest({
        method: 'custom',
        params: { key: 'value', count: 42 },
      }));

      expect(handlerFn).toHaveBeenCalledWith({ key: 'value', count: 42 });
    });

    it('should pass empty object when params omitted', async () => {
      const handlerFn = jest.fn().mockResolvedValue({ ok: true });
      bridge.registerCommand('noParams', handlerFn);

      await bridge.handleMessage('c1', makeRequest({
        method: 'noParams',
      }));

      expect(handlerFn).toHaveBeenCalledWith({});
    });
  });

  // ── Custom Commands ────────────────────────────────────────────

  describe('registerCommand', () => {
    it('should register and execute a custom command', async () => {
      bridge.connectClient(makeClient({ id: 'c1' }));
      bridge.registerCommand('myCommand', async (params) => {
        return { echo: params.input };
      });

      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'myCommand',
        params: { input: 'hello' },
      }));

      expect(response.result).toEqual({ echo: 'hello' });
    });

    it('should overwrite existing command with same name', async () => {
      bridge.connectClient(makeClient({ id: 'c1' }));

      bridge.registerCommand('cmd', async () => 'first');
      bridge.registerCommand('cmd', async () => 'second');

      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'cmd',
      }));

      expect(response.result).toBe('second');
    });
  });

  // ── Notifications ──────────────────────────────────────────────

  describe('sendNotification', () => {
    it('should emit notification:sent for connected client', () => {
      const handler = jest.fn();
      bridge.on('notification:sent', handler);
      bridge.connectClient(makeClient({ id: 'c1' }));

      const notification: RPCNotification = {
        jsonrpc: '2.0',
        method: 'agent:statusChanged',
        params: { agentId: 'a1', status: 'busy' },
      };

      bridge.sendNotification('c1', notification);

      expect(handler).toHaveBeenCalledWith({
        clientId: 'c1',
        notification,
      });
    });

    it('should not emit for unknown client', () => {
      const handler = jest.fn();
      bridge.on('notification:sent', handler);

      bridge.sendNotification('nonexistent', {
        jsonrpc: '2.0',
        method: 'test',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('broadcastNotification', () => {
    it('should send notification to all connected clients', () => {
      const handler = jest.fn();
      bridge.on('notification:sent', handler);

      bridge.connectClient(makeClient({ id: 'c1' }));
      bridge.connectClient(makeClient({ id: 'c2' }));
      bridge.connectClient(makeClient({ id: 'c3' }));

      const notification: RPCNotification = {
        jsonrpc: '2.0',
        method: 'task:completed',
        params: { taskId: 't1' },
      };

      bridge.broadcastNotification(notification);

      expect(handler).toHaveBeenCalledTimes(3);
      const clientIds = handler.mock.calls.map(
        (call: [{ clientId: string }]) => call[0].clientId,
      );
      expect(clientIds).toEqual(['c1', 'c2', 'c3']);
    });

    it('should do nothing when no clients are connected', () => {
      const handler = jest.fn();
      bridge.on('notification:sent', handler);

      bridge.broadcastNotification({
        jsonrpc: '2.0',
        method: 'test',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── Built-In Commands ──────────────────────────────────────────

  describe('built-in commands', () => {
    beforeEach(() => {
      bridge.connectClient(makeClient({ id: 'c1' }));
    });

    it('getStatus should return connection info', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'getStatus',
      }));

      const result = response.result as Record<string, unknown>;
      expect(result.connectedClients).toBe(1);
      expect(result.maxClients).toBe(5);
      expect(typeof result.uptime).toBe('number');
    });

    it('listAgents should return agents array', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'listAgents',
      }));

      const result = response.result as Record<string, unknown>;
      expect(result.agents).toEqual([]);
    });

    it('submitTask should accept a task with name', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'submitTask',
        params: { name: 'Build feature X' },
      }));

      const result = response.result as Record<string, unknown>;
      expect(result.status).toBe('accepted');
      expect(result.taskId).toBeDefined();
    });

    it('submitTask should fail without name', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'submitTask',
        params: {},
      }));

      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(RPC_ERRORS.INTERNAL_ERROR);
      expect(response.error!.message).toBe('Task name is required');
    });

    it('getTaskResult should return pending status', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'getTaskResult',
        params: { taskId: 'task-123' },
      }));

      const result = response.result as Record<string, unknown>;
      expect(result.taskId).toBe('task-123');
      expect(result.status).toBe('pending');
    });

    it('getTaskResult should fail without taskId', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'getTaskResult',
        params: {},
      }));

      expect(response.error).toBeDefined();
      expect(response.error!.message).toBe('Task ID is required');
    });

    it('listSkills should return skills array', async () => {
      const response = await bridge.handleMessage('c1', makeRequest({
        method: 'listSkills',
      }));

      const result = response.result as Record<string, unknown>;
      expect(result.skills).toEqual([]);
    });
  });

  // ── Dispose ────────────────────────────────────────────────────

  describe('dispose', () => {
    it('should clear all clients', () => {
      bridge.connectClient(makeClient({ id: 'c1' }));
      bridge.connectClient(makeClient({ id: 'c2' }));

      bridge.dispose();

      expect(bridge.getConnectedClients()).toHaveLength(0);
    });

    it('should remove all event listeners', () => {
      bridge.on('client:connected', jest.fn());
      bridge.on('command:executed', jest.fn());

      bridge.dispose();

      expect(bridge.listenerCount('client:connected')).toBe(0);
      expect(bridge.listenerCount('command:executed')).toBe(0);
    });
  });

  // ── Factory Function ───────────────────────────────────────────

  describe('createIDEBridge', () => {
    it('should create an IDEBridge instance with default config', () => {
      const instance = createIDEBridge();
      expect(instance).toBeInstanceOf(IDEBridge);
      instance.dispose();
    });

    it('should create an IDEBridge instance with custom config', () => {
      const instance = createIDEBridge({ maxClients: 10, commandTimeout: 5000 });
      expect(instance).toBeInstanceOf(IDEBridge);

      // Verify maxClients by connecting 6 clients (default max is 5)
      for (let i = 0; i < 6; i++) {
        instance.connectClient(makeClient({ id: `c${i}` }));
      }
      expect(instance.getConnectedClients()).toHaveLength(6);

      instance.dispose();
    });
  });
});
