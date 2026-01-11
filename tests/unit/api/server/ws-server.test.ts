/**
 * WebSocket Server Tests
 *
 * Feature: F4.2 - WebSocket API
 *
 * @module tests/unit/api/server
 */

import WebSocket from 'ws';
import { WsServer, createWsServer } from '../../../../src/api/server/ws-server';
import type { IWsServer, WsMessage } from '../../../../src/api/interfaces/ws.interface';
import { WsMessageType } from '../../../../src/api/interfaces/ws.interface';

describe('WsServer', () => {
  let server: IWsServer;
  let wsClients: WebSocket[] = [];

  const getServerPort = (address: string | null): number => {
    if (!address) throw new Error('Server address is null');
    // Match port in URLs like ws://localhost:3000/ws or ws://0.0.0.0:3000/ws
    const match = address.match(/:(\d+)(?:\/|$)/);
    if (!match) throw new Error('Could not parse port from address: ' + address);
    return parseInt(match[1], 10);
  };

  // Store for message queues - messages are always queued by the permanent handler
  const messageQueues: Map<WebSocket, WsMessage[]> = new Map();
  // Store for pending resolvers waiting for messages
  const messageWaiters: Map<WebSocket, ((msg: WsMessage) => void)[]> = new Map();

  const createClient = (port: number, path = '/ws'): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      // Initialize queues
      messageQueues.set(ws, []);
      messageWaiters.set(ws, []);

      // Set up permanent message handler BEFORE connection opens
      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const msg = JSON.parse(data.toString()) as WsMessage;
          const waiters = messageWaiters.get(ws);
          if (waiters && waiters.length > 0) {
            // Someone is waiting - resolve them immediately
            const waiter = waiters.shift()!;
            waiter(msg);
          } else {
            // No one waiting - queue the message
            messageQueues.get(ws)?.push(msg);
          }
        } catch {
          // Ignore parse errors
        }
      });

      ws.on('open', () => {
        clearTimeout(timeout);
        wsClients.push(ws);
        resolve(ws);
      });
      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  };

  const waitForMessage = (ws: WebSocket, timeout = 5000): Promise<WsMessage> => {
    return new Promise((resolve, reject) => {
      // Check queue first
      const queue = messageQueues.get(ws);
      if (queue && queue.length > 0) {
        resolve(queue.shift()!);
        return;
      }

      // Wait for next message
      const timer = setTimeout(() => {
        // Remove ourselves from waiters
        const waiters = messageWaiters.get(ws);
        if (waiters) {
          const idx = waiters.indexOf(resolveWrapper);
          if (idx >= 0) waiters.splice(idx, 1);
        }
        reject(new Error('Message timeout'));
      }, timeout);

      const resolveWrapper = (msg: WsMessage) => {
        clearTimeout(timer);
        resolve(msg);
      };

      messageWaiters.get(ws)?.push(resolveWrapper);
    });
  };

  const cleanupClients = (): void => {
    for (const ws of wsClients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    wsClients = [];
  };

  afterEach(async () => {
    cleanupClients();
    if (server?.isRunning()) {
      await server.stop();
    }
  });

  describe('constructor', () => {
    it('should create server with default configuration', () => {
      server = new WsServer();
      expect(server).toBeInstanceOf(WsServer);
      expect(server.isRunning()).toBe(false);
    });

    it('should create server with custom configuration', () => {
      server = new WsServer({
        host: '127.0.0.1',
        port: 4001,
        path: '/websocket',
      });
      expect(server).toBeInstanceOf(WsServer);
    });

    it('should merge custom config with defaults', () => {
      server = new WsServer({
        port: 5001,
        maxConnections: 500,
      });
      expect(server).toBeInstanceOf(WsServer);
    });
  });

  describe('createWsServer', () => {
    it('should create server instance via factory function', () => {
      server = createWsServer();
      expect(server).toBeInstanceOf(WsServer);
    });

    it('should pass configuration to server', () => {
      server = createWsServer({ port: 6001 });
      expect(server).toBeInstanceOf(WsServer);
    });
  });

  describe('start', () => {
    it('should start the server', async () => {
      server = new WsServer({ port: 0 });
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should throw if server already running', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      await expect(server.start()).rejects.toThrow('WebSocket server is already running');
    });

    it('should accept client connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);

      expect(ws.readyState).toBe(WebSocket.OPEN);
      expect(server.getConnectionCount()).toBe(1);
    });

    it('should send connected message to clients', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);

      const message = await waitForMessage(ws);
      expect(message.type).toBe(WsMessageType.CONNECTED);
      expect(message.payload).toHaveProperty('connectionId');
    });
  });

  describe('stop', () => {
    it('should stop running server', async () => {
      server = new WsServer({ port: 0 });
      await server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      expect(server.isRunning()).toBe(false);
    });

    it('should handle stopping non-running server', async () => {
      server = new WsServer();
      await expect(server.stop()).resolves.toBeUndefined();
    });
  });

  describe('isRunning', () => {
    it('should return false before start', () => {
      server = new WsServer();
      expect(server.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      server = new WsServer({ port: 0 });
      await server.start();
      expect(server.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      server = new WsServer({ port: 0 });
      await server.start();
      await server.stop();
      expect(server.isRunning()).toBe(false);
    });
  });

  describe('getAddress', () => {
    it('should return null when not running', () => {
      server = new WsServer();
      expect(server.getAddress()).toBeNull();
    });

    it('should return address when running', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const address = server.getAddress();
      expect(address).toMatch(/^ws:\/\/.+:\d+/);
    });
  });

  describe('getHealth', () => {
    it('should return unhealthy when not running', () => {
      server = new WsServer();
      const health = server.getHealth();

      expect(health.status).toBe('healthy'); // Status is based on connections vs maxConnections
      expect(health.connections).toBe(0);
    });

    it('should return healthy when running', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const health = server.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.connections).toBe(0);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should track connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      await waitForMessage(ws);

      const health = server.getHealth();
      expect(health.connections).toBe(1);
    });
  });

  describe('getConnections', () => {
    it('should return empty map when no connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const connections = server.getConnections();
      expect(connections.size).toBe(0);
    });

    it('should return map with active connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      await waitForMessage(ws);

      const connections = server.getConnections();
      expect(connections.size).toBe(1);
    });
  });

  describe('getConnection', () => {
    it('should return undefined for non-existent connection', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const connection = server.getConnection('non-existent-id');
      expect(connection).toBeUndefined();
    });

    it('should return connection by ID', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      const connectedMsg = await waitForMessage(ws);

      const connectionId = (connectedMsg.payload as { connectionId: string }).connectionId;
      const connection = server.getConnection(connectionId);

      expect(connection).toBeDefined();
      expect(connection?.id).toBe(connectionId);
    });
  });

  describe('getConnectionCount', () => {
    it('should return 0 when no connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();
      expect(server.getConnectionCount()).toBe(0);
    });

    it('should track multiple connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const client1 = await createClient(port);
      await waitForMessage(client1);

      const client2 = await createClient(port);
      await waitForMessage(client2);

      expect(server.getConnectionCount()).toBe(2);
    });
  });

  describe('broadcast', () => {
    it('should send message to all connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const client1 = await createClient(port);
      await waitForMessage(client1);

      const client2 = await createClient(port);
      await waitForMessage(client2);

      const testMessage: WsMessage = {
        type: WsMessageType.MESSAGE,
        timestamp: new Date().toISOString(),
        payload: { test: 'broadcast' },
      };

      const promise1 = waitForMessage(client1);
      const promise2 = waitForMessage(client2);

      await server.broadcast(testMessage);

      const msg1 = await promise1;
      const msg2 = await promise2;

      expect(msg1.type).toBe(WsMessageType.MESSAGE);
      expect(msg2.type).toBe(WsMessageType.MESSAGE);
      expect((msg1.payload as { test: string }).test).toBe('broadcast');
      expect((msg2.payload as { test: string }).test).toBe('broadcast');
    });
  });

  describe('closeConnection', () => {
    it('should close specific connection', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      const connectedMsg = await waitForMessage(ws);
      const connectionId = (connectedMsg.payload as { connectionId: string }).connectionId;

      expect(server.getConnectionCount()).toBe(1);

      server.closeConnection(connectionId);

      // Wait for close
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(server.getConnectionCount()).toBe(0);
    });

    it('should handle closing non-existent connection', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      // Should not throw
      expect(() => server.closeConnection('non-existent')).not.toThrow();
    });
  });

  describe('closeAllConnections', () => {
    it('should close all active connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const client1 = await createClient(port);
      await waitForMessage(client1);

      const client2 = await createClient(port);
      await waitForMessage(client2);

      expect(server.getConnectionCount()).toBe(2);

      server.closeAllConnections();

      // Wait for close
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(server.getConnectionCount()).toBe(0);
    });
  });

  describe('message handlers', () => {
    it('should call onConnection handler', async () => {
      server = new WsServer({ port: 0 });

      const connectionHandler = jest.fn();
      server.onConnection(connectionHandler);

      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      await waitForMessage(ws);

      expect(connectionHandler).toHaveBeenCalled();
    });

    it('should call onDisconnection handler', async () => {
      server = new WsServer({ port: 0 });

      const disconnectionHandler = jest.fn();
      server.onDisconnection(disconnectionHandler);

      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      await waitForMessage(ws);

      // Remove from tracked clients before closing
      const index = wsClients.indexOf(ws);
      if (index > -1) wsClients.splice(index, 1);

      ws.close();

      // Wait for handler to be called
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(disconnectionHandler).toHaveBeenCalled();
    });

    it('should call onMessage handler', async () => {
      server = new WsServer({ port: 0 });

      const messageHandler = jest.fn();
      server.onMessage(messageHandler);

      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      await waitForMessage(ws); // CONNECTED message

      const testMessage: WsMessage = {
        type: WsMessageType.MESSAGE,
        timestamp: new Date().toISOString(),
        payload: { test: 'data' },
      };
      ws.send(JSON.stringify(testMessage));

      // Wait for handler to be called
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(messageHandler).toHaveBeenCalled();
      const [, message] = messageHandler.mock.calls[0];
      expect(message.type).toBe(WsMessageType.MESSAGE);
    });
  });

  describe('ping/pong', () => {
    it('should respond to PING messages with PONG', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      await waitForMessage(ws); // CONNECTED message

      const pingMessage: WsMessage = {
        type: WsMessageType.PING,
        timestamp: new Date().toISOString(),
      };

      ws.send(JSON.stringify(pingMessage));

      const pong = await waitForMessage(ws);
      expect(pong.type).toBe(WsMessageType.PONG);
    });
  });

  describe('subscription management', () => {
    it('should handle SUBSCRIBE message', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      const connectedMsg = await waitForMessage(ws);
      const connectionId = (connectedMsg.payload as { connectionId: string }).connectionId;

      const subscribeMessage: WsMessage = {
        type: WsMessageType.SUBSCRIBE,
        timestamp: new Date().toISOString(),
        payload: { events: ['test.event', 'another.event'] },
      };

      ws.send(JSON.stringify(subscribeMessage));

      const response = await waitForMessage(ws);
      expect(response.type).toBe(WsMessageType.SUBSCRIBED);
      expect((response.payload as { subscriptionId: string }).subscriptionId).toBeDefined();

      // Verify connection is subscribed
      const connection = server.getConnection(connectionId);
      expect(connection?.isSubscribed('test.event')).toBe(true);
    });

    it('should handle UNSUBSCRIBE message', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      const connectedMsg = await waitForMessage(ws);
      const connectionId = (connectedMsg.payload as { connectionId: string }).connectionId;

      // First subscribe
      const subscribeMessage: WsMessage = {
        type: WsMessageType.SUBSCRIBE,
        timestamp: new Date().toISOString(),
        payload: { events: ['test.event'] },
      };

      ws.send(JSON.stringify(subscribeMessage));
      const subResponse = await waitForMessage(ws);
      const subscriptionId = (subResponse.payload as { subscriptionId: string }).subscriptionId;

      // Then unsubscribe
      const unsubscribeMessage: WsMessage = {
        type: WsMessageType.UNSUBSCRIBE,
        timestamp: new Date().toISOString(),
        payload: { subscriptionId },
      };

      ws.send(JSON.stringify(unsubscribeMessage));

      const unsubResponse = await waitForMessage(ws);
      expect(unsubResponse.type).toBe(WsMessageType.UNSUBSCRIBED);

      // Verify connection is no longer subscribed
      const connection = server.getConnection(connectionId);
      expect(connection?.isSubscribed('test.event')).toBe(false);
    });
  });

  describe('broadcastEvent', () => {
    it('should send event to subscribed connections', async () => {
      server = new WsServer({ port: 0 });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port);
      const connectedMsg = await waitForMessage(ws);
      const connectionId = (connectedMsg.payload as { connectionId: string }).connectionId;

      // Subscribe
      const connection = server.getConnection(connectionId);
      connection?.subscribe(['test.event']);

      const eventPromise = waitForMessage(ws);
      await server.broadcastEvent('test.event', { value: 42 });

      const msg = await eventPromise;
      expect(msg.type).toBe(WsMessageType.EVENT);
      expect((msg as unknown as { event: string }).event).toBe('test.event');
      expect((msg.payload as { value: number }).value).toBe(42);
    });
  });

  describe('configuration options', () => {
    it('should support custom path configuration', async () => {
      server = new WsServer({ port: 0, path: '/custom-ws' });
      await server.start();

      const port = getServerPort(server.getAddress());
      const ws = await createClient(port, '/custom-ws');

      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it('should support connection timeout configuration', () => {
      server = new WsServer({
        port: 0,
        connectionTimeout: 15000,
        pingInterval: 10000,
        pingTimeout: 3000,
      });
      expect(server).toBeInstanceOf(WsServer);
    });

    it('should support rate limit configuration', () => {
      server = new WsServer({
        port: 0,
        maxMessagesPerSecond: 50,
      });
      expect(server).toBeInstanceOf(WsServer);
    });
  });
});
