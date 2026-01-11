/**
 * WebSocket Server Implementation
 *
 * Feature: F4.2 - WebSocket API
 *
 * @module api/server/ws
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { createServer, Server as HttpServer, IncomingMessage } from 'http';
import { randomUUID } from 'crypto';

import type {
  IWsServer,
  IWsConnection,
  WsServerConfig,
  WsServerHealth,
  WsMessage,
  WsMessageHandler,
  WsConnectionHandler,
  WsDisconnectionHandler,
  WsErrorHandler,
  WsConnectionInfo,
  WsConnectionMetrics,
  WsEventMessage,
  WsResponse,
  WsSubscriptionPayload,
  WsSubscriptionResult,
  WsAuthPayload,
  WsAuthResult,
} from '../interfaces/ws.interface.js';
import {
  WsConnectionState,
  WsMessageType,
  WsCloseCode,
  WS_ERROR_CODES,
  DEFAULT_WS_CONFIG,
} from '../interfaces/ws.interface.js';
import { ILogger } from '../../core/services/logger.interface.js';
import { createLogger } from '../../core/services/logger.js';

// ==================== Connection Implementation ====================

/**
 * WebSocket Connection
 */
class WsConnection implements IWsConnection {
  readonly id: string;
  private _state: WsConnectionState = WsConnectionState.CONNECTING;
  private readonly _info: WsConnectionInfo;
  private readonly _metrics: WsConnectionMetrics;
  private readonly _subscriptions: Map<string, Set<string>> = new Map();
  private readonly _subscriptionFilters: Map<string, Record<string, unknown>> = new Map();

  constructor(
    private readonly ws: WebSocket,
    request: IncomingMessage,
    _logger: ILogger
  ) {
    // _logger reserved for future debug logging
    void _logger;
    this.id = randomUUID();
    this._info = {
      id: this.id,
      state: this._state,
      remoteAddress: request.socket?.remoteAddress,
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
      lastActivity: new Date(),
      subscriptions: new Set(),
      metadata: {},
    };
    this._metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      errors: 0,
      latency: 0,
    };
  }

  get state(): WsConnectionState {
    return this._state;
  }

  set state(value: WsConnectionState) {
    this._state = value;
    this._info.state = value;
  }

  get info(): WsConnectionInfo {
    return { ...this._info, subscriptions: new Set(this._info.subscriptions) };
  }

  get metrics(): WsConnectionMetrics {
    return { ...this._metrics };
  }

  async send<T>(message: WsMessage<T>): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Connection is not open');
    }

    const data = JSON.stringify(message);
    await new Promise<void>((resolve, reject) => {
      this.ws.send(data, (error) => {
        if (error) {
          this._metrics.errors++;
          reject(error);
        } else {
          this._metrics.messagesSent++;
          this._metrics.bytesSent += data.length;
          this._info.lastActivity = new Date();
          resolve();
        }
      });
    });
  }

  async sendEvent<T>(event: string, payload: T): Promise<void> {
    const message: WsEventMessage<T> = {
      type: WsMessageType.EVENT,
      event,
      payload,
      timestamp: new Date().toISOString(),
    };
    await this.send(message);
  }

  close(code: WsCloseCode = WsCloseCode.NORMAL, reason?: string): void {
    this.state = WsConnectionState.DISCONNECTING;
    this.ws.close(code, reason);
  }

  subscribe(events: string[], filters?: Record<string, unknown>): string {
    const subscriptionId = randomUUID();
    this._subscriptions.set(subscriptionId, new Set(events));
    if (filters) {
      this._subscriptionFilters.set(subscriptionId, filters);
    }
    events.forEach((e) => this._info.subscriptions.add(e));
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): boolean {
    const events = this._subscriptions.get(subscriptionId);
    if (!events) return false;

    events.forEach((e) => {
      // Only remove from info if no other subscription has this event
      let hasOtherSubscription = false;
      for (const [id, evts] of this._subscriptions) {
        if (id !== subscriptionId && evts.has(e)) {
          hasOtherSubscription = true;
          break;
        }
      }
      if (!hasOtherSubscription) {
        this._info.subscriptions.delete(e);
      }
    });

    this._subscriptions.delete(subscriptionId);
    this._subscriptionFilters.delete(subscriptionId);
    return true;
  }

  isSubscribed(event: string): boolean {
    for (const events of this._subscriptions.values()) {
      if (events.has(event) || events.has('*')) {
        return true;
      }
    }
    return false;
  }

  matchesFilters(event: string, payload: unknown): boolean {
    for (const [subId, events] of this._subscriptions) {
      if (!events.has(event) && !events.has('*')) continue;

      const filters = this._subscriptionFilters.get(subId);
      if (!filters) return true;

      // Check if payload matches filters
      if (typeof payload === 'object' && payload !== null) {
        const p = payload as Record<string, unknown>;
        for (const [key, value] of Object.entries(filters)) {
          if (p[key] !== value) return false;
        }
      }
      return true;
    }
    return false;
  }

  setMetadata(key: string, value: unknown): void {
    this._info.metadata[key] = value;
  }

  getMetadata<T>(key: string): T | undefined {
    return this._info.metadata[key] as T | undefined;
  }

  recordReceived(bytes: number): void {
    this._metrics.messagesReceived++;
    this._metrics.bytesReceived += bytes;
    this._info.lastActivity = new Date();
  }

  recordError(): void {
    this._metrics.errors++;
  }

  updateLatency(latency: number): void {
    this._metrics.latency = latency;
  }

  get rawSocket(): WebSocket {
    return this.ws;
  }
}

// ==================== Server Implementation ====================

/**
 * WebSocket Server
 */
export class WsServer implements IWsServer {
  private readonly config: Required<WsServerConfig>;
  private readonly logger: ILogger;
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private running = false;
  private startTime: Date | null = null;

  private readonly connections: Map<string, WsConnection> = new Map();
  private readonly ipConnections: Map<string, Set<string>> = new Map();

  private messageHandlers: WsMessageHandler[] = [];
  private connectionHandlers: WsConnectionHandler[] = [];
  private disconnectionHandlers: WsDisconnectionHandler[] = [];
  private errorHandlers: WsErrorHandler[] = [];

  private pingIntervalId: NodeJS.Timeout | null = null;
  private messageRates: Map<string, number[]> = new Map();

  constructor(config?: Partial<WsServerConfig>) {
    this.config = this.mergeConfig(config || {});
    this.logger = createLogger('WsServer');
  }

  private mergeConfig(config: Partial<WsServerConfig>): Required<WsServerConfig> {
    return {
      ...DEFAULT_WS_CONFIG,
      ...config,
      ssl: { ...DEFAULT_WS_CONFIG.ssl, ...config.ssl },
      cors: { ...DEFAULT_WS_CONFIG.cors, ...config.cors },
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('WebSocket server is already running');
    }

    // Create HTTP server
    this.httpServer = createServer((req, res) => {
      // Handle CORS preflight
      if (this.config.cors.enabled && req.method === 'OPTIONS') {
        this.handleCors(res);
        res.end();
        return;
      }

      // Health check endpoint
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getHealth()));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: this.config.path,
      maxPayload: this.config.maxMessageSize,
      verifyClient: this.verifyClient.bind(this),
    });

    // Set up event handlers
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));

    // Start HTTP server
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.config.port, this.config.host, () => {
        this.running = true;
        this.startTime = new Date();
        this.startPingInterval();
        this.logger.info('WebSocket server started', {
          host: this.config.host,
          port: this.config.port,
          path: this.config.path,
        });
        resolve();
      }).on('error', reject);
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.stopPingInterval();

    // Close all connections
    this.closeAllConnections(WsCloseCode.SERVER_RESTART, 'Server shutting down');

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
      this.wss = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    this.running = false;
    this.startTime = null;
    this.logger.info('WebSocket server stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getAddress(): string | null {
    if (!this.running || !this.httpServer) return null;
    const addr = this.httpServer.address();
    if (!addr || typeof addr === 'string') return addr;
    return `ws://${addr.address === '::' ? 'localhost' : addr.address}:${addr.port}${this.config.path}`;
  }

  getHealth(): WsServerHealth {
    const connections = this.connections.size;
    const uptime = this.startTime
      ? Math.floor((Date.now() - this.startTime.getTime()) / 1000)
      : 0;

    let totalMessages = 0;
    let totalLatency = 0;
    let connectionCount = 0;

    for (const conn of this.connections.values()) {
      totalMessages += conn.metrics.messagesSent + conn.metrics.messagesReceived;
      totalLatency += conn.metrics.latency;
      connectionCount++;
    }

    const avgLatency = connectionCount > 0 ? totalLatency / connectionCount : 0;
    const messagesPerSecond = uptime > 0 ? totalMessages / uptime : 0;

    return {
      status:
        connections >= this.config.maxConnections
          ? 'unhealthy'
          : connections >= this.config.maxConnections * 0.8
            ? 'degraded'
            : 'healthy',
      connections,
      maxConnections: this.config.maxConnections,
      uptime,
      messagesPerSecond,
      details: {
        memoryUsage: process.memoryUsage().heapUsed,
        averageLatency: avgLatency,
      },
    };
  }

  getConnections(): Map<string, IWsConnection> {
    return new Map(this.connections);
  }

  getConnection(connectionId: string): IWsConnection | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  async broadcast<T>(
    message: WsMessage<T>,
    filter?: (conn: IWsConnection) => boolean
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const conn of this.connections.values()) {
      if (conn.state !== WsConnectionState.CONNECTED &&
          conn.state !== WsConnectionState.AUTHENTICATED) {
        continue;
      }
      if (filter && !filter(conn)) continue;

      promises.push(
        conn.send(message).catch((error) => {
          this.logger.warn('Failed to send broadcast message', {
            connectionId: conn.id,
            error: error.message,
          });
        })
      );
    }

    await Promise.all(promises);
  }

  async broadcastEvent<T>(event: string, payload: T): Promise<void> {
    const message: WsEventMessage<T> = {
      type: WsMessageType.EVENT,
      event,
      payload,
      timestamp: new Date().toISOString(),
    };

    await this.broadcast(message, (conn) =>
      (conn as WsConnection).matchesFilters(event, payload)
    );
  }

  closeConnection(
    connectionId: string,
    code: WsCloseCode = WsCloseCode.NORMAL,
    reason?: string
  ): void {
    const conn = this.connections.get(connectionId);
    if (conn) {
      conn.close(code, reason);
    }
  }

  closeAllConnections(
    code: WsCloseCode = WsCloseCode.NORMAL,
    reason?: string
  ): void {
    for (const conn of this.connections.values()) {
      conn.close(code, reason);
    }
  }

  onMessage(handler: WsMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onConnection(handler: WsConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  onDisconnection(handler: WsDisconnectionHandler): void {
    this.disconnectionHandlers.push(handler);
  }

  onError(handler: WsErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  // ==================== Private Methods ====================

  private handleCors(res: import('http').ServerResponse): void {
    const origin = this.config.cors.origin;
    res.setHeader(
      'Access-Control-Allow-Origin',
      origin === true ? '*' : Array.isArray(origin) ? origin.join(',') : String(origin)
    );
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  private verifyClient(
    info: { origin: string; secure: boolean; req: IncomingMessage },
    callback: (result: boolean, code?: number, message?: string) => void
  ): void {
    const { req } = info;

    // Check max connections
    if (this.connections.size >= this.config.maxConnections) {
      callback(false, 503, 'Server at maximum capacity');
      return;
    }

    // Check connections per IP
    const ip = req.socket?.remoteAddress;
    if (ip) {
      const ipConns = this.ipConnections.get(ip);
      if (ipConns && ipConns.size >= this.config.maxConnectionsPerIp) {
        callback(false, 429, 'Too many connections from this IP');
        return;
      }
    }

    callback(true);
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const connection = new WsConnection(ws, request, this.logger);
    connection.state = WsConnectionState.CONNECTED;

    // Track connection
    this.connections.set(connection.id, connection);
    const ip = request.socket?.remoteAddress;
    if (ip) {
      if (!this.ipConnections.has(ip)) {
        this.ipConnections.set(ip, new Set());
      }
      this.ipConnections.get(ip)!.add(connection.id);
    }

    this.logger.debug('New WebSocket connection', {
      connectionId: connection.id,
      remoteAddress: ip,
    });

    // Set up connection handlers
    ws.on('message', (data) => this.handleMessage(connection, data));
    ws.on('close', (code, reason) =>
      this.handleClose(connection, code, reason.toString())
    );
    ws.on('error', (error) => this.handleError(connection, error));
    ws.on('pong', () => this.handlePong(connection));

    // Send connected message
    connection.send({
      type: WsMessageType.CONNECTED,
      timestamp: new Date().toISOString(),
      payload: {
        connectionId: connection.id,
        serverTime: new Date().toISOString(),
      },
    }).catch((error) => {
      this.logger.error('Failed to send connected message', { error: error.message });
    });

    // Notify handlers
    for (const handler of this.connectionHandlers) {
      try {
        handler(connection, request);
      } catch (error) {
        this.logger.error('Connection handler error', {
          error: (error as Error).message,
        });
      }
    }

    // Set auth timeout if required
    if (this.config.requireAuth) {
      setTimeout(() => {
        if (connection.state === WsConnectionState.CONNECTED) {
          connection.close(WsCloseCode.UNAUTHORIZED, 'Authentication timeout');
        }
      }, this.config.authTimeout);
    }
  }

  private async handleMessage(connection: WsConnection, data: RawData): Promise<void> {
    const rawData = data.toString();
    connection.recordReceived(rawData.length);

    // Rate limiting
    if (!this.checkRateLimit(connection.id)) {
      await connection.send({
        type: WsMessageType.ERROR,
        timestamp: new Date().toISOString(),
        payload: {
          code: WS_ERROR_CODES.RATE_LIMITED,
          message: 'Rate limit exceeded',
        },
      });
      return;
    }

    let message: WsMessage;
    try {
      message = JSON.parse(rawData);
    } catch {
      connection.recordError();
      await connection.send({
        type: WsMessageType.ERROR,
        timestamp: new Date().toISOString(),
        payload: {
          code: WS_ERROR_CODES.INVALID_MESSAGE,
          message: 'Invalid JSON',
        },
      });
      return;
    }

    // Handle built-in message types
    switch (message.type) {
      case WsMessageType.PING:
        await connection.send({
          type: WsMessageType.PONG,
          timestamp: new Date().toISOString(),
          id: message.id,
        });
        return;

      case WsMessageType.AUTHENTICATE:
        await this.handleAuthenticate(connection, message as WsMessage<WsAuthPayload>);
        return;

      case WsMessageType.SUBSCRIBE:
        await this.handleSubscribe(connection, message as WsMessage<WsSubscriptionPayload>);
        return;

      case WsMessageType.UNSUBSCRIBE:
        await this.handleUnsubscribe(connection, message as WsMessage<{ subscriptionId: string }>);
        return;

      case WsMessageType.DISCONNECT:
        connection.close(WsCloseCode.NORMAL, 'Client requested disconnect');
        return;
    }

    // Notify custom message handlers
    for (const handler of this.messageHandlers) {
      try {
        await handler(connection, message);
      } catch (error) {
        this.logger.error('Message handler error', {
          connectionId: connection.id,
          error: (error as Error).message,
        });
      }
    }
  }

  private async handleAuthenticate(
    connection: WsConnection,
    message: WsMessage<WsAuthPayload>
  ): Promise<void> {
    // For now, accept any authentication
    // In production, this would validate tokens/API keys
    const payload = message.payload || {};

    connection.state = WsConnectionState.AUTHENTICATED;
    if (payload.clientId) {
      connection.setMetadata('clientId', payload.clientId);
    }

    const response: WsResponse<WsAuthResult> = {
      type: WsMessageType.RESPONSE,
      id: message.id || randomUUID(),
      timestamp: new Date().toISOString(),
      success: true,
      payload: {
        authenticated: true,
        permissions: ['read', 'write', 'subscribe'],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };

    await connection.send(response);
    this.logger.debug('Connection authenticated', { connectionId: connection.id });
  }

  private async handleSubscribe(
    connection: WsConnection,
    message: WsMessage<WsSubscriptionPayload>
  ): Promise<void> {
    const payload = message.payload;
    if (!payload?.events || !Array.isArray(payload.events)) {
      await connection.send({
        type: WsMessageType.ERROR,
        timestamp: new Date().toISOString(),
        id: message.id,
        payload: {
          code: WS_ERROR_CODES.INVALID_MESSAGE,
          message: 'Invalid subscription payload',
        },
      });
      return;
    }

    // Accept all events - validation can be done at subscriber's discretion
    // Custom events are allowed for extensibility
    const validEvents = payload.events;

    const subscriptionId = connection.subscribe(validEvents, payload.filters);

    const response: WsMessage<WsSubscriptionResult> = {
      type: WsMessageType.SUBSCRIBED,
      id: message.id || randomUUID(),
      timestamp: new Date().toISOString(),
      payload: {
        subscriptionId,
        events: validEvents,
        filters: payload.filters,
      },
    };

    await connection.send(response);
    this.logger.debug('Subscription created', {
      connectionId: connection.id,
      subscriptionId,
      events: validEvents,
    });
  }

  private async handleUnsubscribe(
    connection: WsConnection,
    message: WsMessage<{ subscriptionId: string }>
  ): Promise<void> {
    const subscriptionId = message.payload?.subscriptionId;
    if (!subscriptionId) {
      await connection.send({
        type: WsMessageType.ERROR,
        timestamp: new Date().toISOString(),
        id: message.id,
        payload: {
          code: WS_ERROR_CODES.INVALID_MESSAGE,
          message: 'Missing subscriptionId',
        },
      });
      return;
    }

    const removed = connection.unsubscribe(subscriptionId);

    const unsubResponse: WsMessage<{ subscriptionId: string; removed: boolean }> = {
      type: WsMessageType.UNSUBSCRIBED,
      id: message.id || randomUUID(),
      timestamp: new Date().toISOString(),
      payload: { subscriptionId, removed },
    };
    await connection.send(unsubResponse);
  }

  private handleClose(
    connection: WsConnection,
    code: number,
    reason: string
  ): void {
    connection.state = WsConnectionState.DISCONNECTED;

    // Remove from tracking
    this.connections.delete(connection.id);
    const ip = connection.info.remoteAddress;
    if (ip) {
      const ipConns = this.ipConnections.get(ip);
      if (ipConns) {
        ipConns.delete(connection.id);
        if (ipConns.size === 0) {
          this.ipConnections.delete(ip);
        }
      }
    }
    this.messageRates.delete(connection.id);

    this.logger.debug('WebSocket connection closed', {
      connectionId: connection.id,
      code,
      reason,
    });

    // Notify handlers
    for (const handler of this.disconnectionHandlers) {
      try {
        handler(connection, code, reason);
      } catch (error) {
        this.logger.error('Disconnection handler error', {
          error: (error as Error).message,
        });
      }
    }
  }

  private handleError(connection: WsConnection, error: Error): void {
    connection.recordError();
    this.logger.error('WebSocket connection error', {
      connectionId: connection.id,
      error: error.message,
    });

    for (const handler of this.errorHandlers) {
      try {
        handler(connection, error);
      } catch (err) {
        this.logger.error('Error handler error', {
          error: (err as Error).message,
        });
      }
    }
  }

  private handleServerError(error: Error): void {
    this.logger.error('WebSocket server error', { error: error.message });
    for (const handler of this.errorHandlers) {
      try {
        handler(null, error);
      } catch (err) {
        this.logger.error('Error handler error', {
          error: (err as Error).message,
        });
      }
    }
  }

  private handlePong(connection: WsConnection): void {
    const pingTime = connection.getMetadata<number>('lastPing');
    if (pingTime) {
      connection.updateLatency(Date.now() - pingTime);
    }
  }

  private checkRateLimit(connectionId: string): boolean {
    const now = Date.now();
    const windowMs = 1000; // 1 second window

    if (!this.messageRates.has(connectionId)) {
      this.messageRates.set(connectionId, []);
    }

    const timestamps = this.messageRates.get(connectionId)!;
    const windowStart = now - windowMs;

    // Remove old timestamps
    while (timestamps.length > 0 && timestamps[0] < windowStart) {
      timestamps.shift();
    }

    // Check limit
    if (timestamps.length >= this.config.maxMessagesPerSecond) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  private startPingInterval(): void {
    this.pingIntervalId = setInterval(() => {
      const now = Date.now();

      for (const connection of this.connections.values()) {
        const lastPing = connection.getMetadata<number>('lastPing');
        if (lastPing && now - lastPing > this.config.pingTimeout) {
          // No pong received, close connection
          connection.close(WsCloseCode.GOING_AWAY, 'Ping timeout');
          continue;
        }

        // Send ping
        connection.setMetadata('lastPing', now);
        connection.rawSocket.ping();
      }
    }, this.config.pingInterval);
  }

  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }
}

/**
 * Create WebSocket server factory
 */
export function createWsServer(config?: Partial<WsServerConfig>): IWsServer {
  return new WsServer(config);
}
