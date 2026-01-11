/**
 * WebSocket API Interfaces
 *
 * Feature: F4.2 - WebSocket API
 *
 * SOLID Principles:
 * - S: Each interface has a single responsibility
 * - O: Open for extension via event handlers
 * - I: Segregated interfaces for server, client, connection
 * - D: Depends on abstractions (IEventBus)
 *
 * @module api/interfaces/ws
 */

import type { IncomingMessage } from 'http';
import type { SystemEventType } from '../../core/interfaces/event.interface.js';

// ==================== Enums ====================

/**
 * WebSocket connection states
 */
export enum WsConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  RECONNECTING = 'reconnecting',
}

/**
 * WebSocket message types
 */
export enum WsMessageType {
  // Client → Server
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  PING = 'ping',
  REQUEST = 'request',

  // Server → Client
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  AUTHENTICATED = 'authenticated',
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  PONG = 'pong',
  RESPONSE = 'response',
  EVENT = 'event',
  ERROR = 'error',

  // Bidirectional
  MESSAGE = 'message',
}

/**
 * WebSocket close codes
 */
export enum WsCloseCode {
  NORMAL = 1000,
  GOING_AWAY = 1001,
  PROTOCOL_ERROR = 1002,
  UNSUPPORTED_DATA = 1003,
  INVALID_PAYLOAD = 1007,
  POLICY_VIOLATION = 1008,
  MESSAGE_TOO_BIG = 1009,
  SERVER_ERROR = 1011,

  // Custom codes (4000-4999)
  UNAUTHORIZED = 4001,
  FORBIDDEN = 4003,
  NOT_FOUND = 4004,
  RATE_LIMITED = 4029,
  SESSION_EXPIRED = 4040,
  SERVER_RESTART = 4050,
}

/**
 * WebSocket error codes
 */
export const WS_ERROR_CODES = {
  // Connection errors
  CONNECTION_FAILED: 'WS_CONNECTION_FAILED',
  CONNECTION_TIMEOUT: 'WS_CONNECTION_TIMEOUT',
  CONNECTION_CLOSED: 'WS_CONNECTION_CLOSED',

  // Authentication errors
  AUTH_REQUIRED: 'WS_AUTH_REQUIRED',
  AUTH_FAILED: 'WS_AUTH_FAILED',
  AUTH_EXPIRED: 'WS_AUTH_EXPIRED',

  // Message errors
  INVALID_MESSAGE: 'WS_INVALID_MESSAGE',
  UNSUPPORTED_TYPE: 'WS_UNSUPPORTED_TYPE',
  PAYLOAD_TOO_LARGE: 'WS_PAYLOAD_TOO_LARGE',

  // Subscription errors
  SUBSCRIPTION_FAILED: 'WS_SUBSCRIPTION_FAILED',
  INVALID_SUBSCRIPTION: 'WS_INVALID_SUBSCRIPTION',

  // Rate limiting
  RATE_LIMITED: 'WS_RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'WS_INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'WS_SERVICE_UNAVAILABLE',
} as const;

// ==================== Message Types ====================

/**
 * Base WebSocket message
 */
export interface WsMessage<T = unknown> {
  type: WsMessageType;
  id?: string;
  timestamp: string;
  payload?: T;
}

/**
 * WebSocket request message (client → server)
 */
export interface WsRequest<T = unknown> extends WsMessage<T> {
  type: WsMessageType.REQUEST;
  id: string;
  action: string;
}

/**
 * WebSocket response message (server → client)
 */
export interface WsResponse<T = unknown> extends WsMessage<T> {
  type: WsMessageType.RESPONSE;
  id: string;
  success: boolean;
  error?: WsError;
}

/**
 * WebSocket event message (server → client)
 */
export interface WsEventMessage<T = unknown> extends WsMessage<T> {
  type: WsMessageType.EVENT;
  event: string;
  payload: T;
}

/**
 * WebSocket error payload
 */
export interface WsError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Authentication request payload
 */
export interface WsAuthPayload {
  token?: string;
  apiKey?: string;
  clientId?: string;
}

/**
 * Authentication response payload
 */
export interface WsAuthResult {
  authenticated: boolean;
  userId?: string;
  permissions?: string[];
  expiresAt?: string;
}

/**
 * Subscription request payload
 */
export interface WsSubscriptionPayload {
  events: string[];
  filters?: Record<string, unknown>;
}

/**
 * Subscription result payload
 */
export interface WsSubscriptionResult {
  subscriptionId: string;
  events: string[];
  filters?: Record<string, unknown>;
}

// ==================== Connection Types ====================

/**
 * WebSocket connection info
 */
export interface WsConnectionInfo {
  id: string;
  state: WsConnectionState;
  remoteAddress?: string;
  userAgent?: string;
  connectedAt: Date;
  lastActivity: Date;
  userId?: string;
  subscriptions: Set<string>;
  metadata: Record<string, unknown>;
}

/**
 * WebSocket connection metrics
 */
export interface WsConnectionMetrics {
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  errors: number;
  latency: number;
}

/**
 * WebSocket connection interface
 */
export interface IWsConnection {
  readonly id: string;
  readonly state: WsConnectionState;
  readonly info: WsConnectionInfo;
  readonly metrics: WsConnectionMetrics;

  send<T>(message: WsMessage<T>): Promise<void>;
  sendEvent<T>(event: string, payload: T): Promise<void>;
  close(code?: WsCloseCode, reason?: string): void;

  subscribe(events: string[], filters?: Record<string, unknown>): string;
  unsubscribe(subscriptionId: string): boolean;
  isSubscribed(event: string): boolean;

  setMetadata(key: string, value: unknown): void;
  getMetadata<T>(key: string): T | undefined;
}

// ==================== Server Types ====================

/**
 * WebSocket server configuration
 */
export interface WsServerConfig {
  port?: number;
  host?: string;
  path?: string;

  // Connection limits
  maxConnections?: number;
  maxConnectionsPerIp?: number;

  // Message limits
  maxMessageSize?: number;
  maxMessagesPerSecond?: number;

  // Timeouts
  connectionTimeout?: number;
  pingInterval?: number;
  pingTimeout?: number;

  // Authentication
  requireAuth?: boolean;
  authTimeout?: number;

  // SSL/TLS
  ssl?: {
    enabled: boolean;
    key?: string;
    cert?: string;
  };

  // CORS (for HTTP upgrade)
  cors?: {
    enabled: boolean;
    origin?: string | string[] | boolean;
  };
}

/**
 * WebSocket server health info
 */
export interface WsServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  connections: number;
  maxConnections: number;
  uptime: number;
  messagesPerSecond: number;
  details?: {
    memoryUsage: number;
    averageLatency: number;
  };
}

/**
 * WebSocket server interface
 */
export interface IWsServer {
  /**
   * Start the WebSocket server
   */
  start(): Promise<void>;

  /**
   * Stop the WebSocket server
   */
  stop(): Promise<void>;

  /**
   * Check if server is running
   */
  isRunning(): boolean;

  /**
   * Get server address
   */
  getAddress(): string | null;

  /**
   * Get server health
   */
  getHealth(): WsServerHealth;

  /**
   * Get all connections
   */
  getConnections(): Map<string, IWsConnection>;

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): IWsConnection | undefined;

  /**
   * Get connections count
   */
  getConnectionCount(): number;

  /**
   * Broadcast message to all connections
   */
  broadcast<T>(message: WsMessage<T>, filter?: (conn: IWsConnection) => boolean): Promise<void>;

  /**
   * Broadcast event to subscribers
   */
  broadcastEvent<T>(event: string, payload: T): Promise<void>;

  /**
   * Close a specific connection
   */
  closeConnection(connectionId: string, code?: WsCloseCode, reason?: string): void;

  /**
   * Close all connections
   */
  closeAllConnections(code?: WsCloseCode, reason?: string): void;

  /**
   * Register message handler
   */
  onMessage(handler: WsMessageHandler): void;

  /**
   * Register connection handler
   */
  onConnection(handler: WsConnectionHandler): void;

  /**
   * Register disconnection handler
   */
  onDisconnection(handler: WsDisconnectionHandler): void;

  /**
   * Register error handler
   */
  onError(handler: WsErrorHandler): void;
}

// ==================== Handler Types ====================

/**
 * Message handler function
 */
export type WsMessageHandler = (
  connection: IWsConnection,
  message: WsMessage
) => void | Promise<void>;

/**
 * Connection handler function
 */
export type WsConnectionHandler = (
  connection: IWsConnection,
  request: IncomingMessage
) => void | Promise<void>;

/**
 * Disconnection handler function
 */
export type WsDisconnectionHandler = (
  connection: IWsConnection,
  code: number,
  reason: string
) => void | Promise<void>;

/**
 * Error handler function
 */
export type WsErrorHandler = (
  connection: IWsConnection | null,
  error: Error
) => void | Promise<void>;

// ==================== Default Configuration ====================

/**
 * Default WebSocket server configuration
 */
export const DEFAULT_WS_CONFIG: Required<WsServerConfig> = {
  port: 3001,
  host: '0.0.0.0',
  path: '/ws',

  maxConnections: 1000,
  maxConnectionsPerIp: 10,

  maxMessageSize: 1024 * 1024, // 1MB
  maxMessagesPerSecond: 100,

  connectionTimeout: 30000, // 30 seconds
  pingInterval: 30000, // 30 seconds
  pingTimeout: 5000, // 5 seconds

  requireAuth: false,
  authTimeout: 10000, // 10 seconds

  ssl: {
    enabled: false,
    key: undefined,
    cert: undefined,
  },

  cors: {
    enabled: true,
    origin: true,
  },
};

// ==================== Event Types for Streaming ====================

/**
 * Streamable event types (subset of system events)
 */
export const STREAMABLE_EVENTS: SystemEventType[] = [
  'system.agent.started',
  'system.agent.stopped',
  'system.agent.error',
  'system.agent.paused',
  'system.agent.resumed',
  'system.task.queued',
  'system.task.started',
  'system.task.completed',
  'system.task.failed',
  'system.task.cancelled',
  'system.workflow.started',
  'system.workflow.step.started',
  'system.workflow.step.completed',
  'system.workflow.step.failed',
  'system.workflow.completed',
  'system.workflow.failed',
  'system.tool.executed',
  'system.tool.failed',
  'system.hook.executed',
  'system.hook.failed',
  'system.llm.stream.started',
  'system.llm.stream.chunk',
  'system.llm.stream.ended',
  'system.context.threshold',
  'system.session.started',
  'system.session.ended',
  'system.session.checkpoint',
] as SystemEventType[];

/**
 * Event subscription configuration
 */
export interface EventSubscriptionConfig {
  events: string[];
  includePayload?: boolean;
  filters?: {
    agentId?: string;
    taskId?: string;
    workflowId?: string;
    sessionId?: string;
    [key: string]: unknown;
  };
}

/**
 * Streaming event wrapper
 */
export interface StreamingEvent<T = unknown> {
  type: string;
  timestamp: string;
  source: string;
  payload: T;
  metadata?: Record<string, unknown>;
}
