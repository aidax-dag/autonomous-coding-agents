/**
 * REST API Core Interfaces
 *
 * Feature: F4.1 - REST API Interface
 *
 * SOLID Principles:
 * - S: Each interface has a single responsibility
 * - I: Interfaces are segregated by domain (agents, workflows, tools, hooks)
 * - D: High-level modules depend on abstractions
 *
 * @module api/interfaces
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ==================== Enums ====================

/**
 * API response status codes
 */
export enum ApiStatusCode {
  SUCCESS = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  VALIDATION_ERROR = 422,
  RATE_LIMITED = 429,
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * API resource types
 */
export enum ApiResourceType {
  AGENT = 'agent',
  WORKFLOW = 'workflow',
  TOOL = 'tool',
  HOOK = 'hook',
  TASK = 'task',
  EVENT = 'event',
  METRICS = 'metrics',
  HEALTH = 'health',
}

/**
 * API operation types
 */
export enum ApiOperation {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  EXECUTE = 'execute',
  START = 'start',
  STOP = 'stop',
  PAUSE = 'pause',
  RESUME = 'resume',
}

/**
 * Sort order for list operations
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

// ==================== Base Types ====================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}

/**
 * Filter parameters (generic)
 */
export interface FilterParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * List query parameters
 */
export interface ListQueryParams extends PaginationParams, SortParams {
  filter?: FilterParams;
  search?: string;
  fields?: string[];
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ==================== Response Types ====================

/**
 * Base API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiResponseMeta;
}

/**
 * API response metadata
 */
export interface ApiResponseMeta {
  requestId: string;
  timestamp: string;
  duration?: number;
  pagination?: PaginationMeta;
  version?: string;
}

/**
 * List response with pagination
 */
export interface ListResponse<T> extends ApiResponse<T[]> {
  meta: ApiResponseMeta & {
    pagination: PaginationMeta;
  };
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  stack?: string;
  cause?: string;
}

/**
 * API error detail (for validation errors)
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
  value?: unknown;
}

// ==================== Request Types ====================

/**
 * Base request context
 */
export interface RequestContext {
  requestId: string;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
  auth?: AuthContext;
}

/**
 * Authentication context
 */
export interface AuthContext {
  authenticated: boolean;
  apiKey?: string;
  userId?: string;
  permissions?: string[];
  expiresAt?: Date;
}

/**
 * Typed Fastify request
 */
export interface TypedRequest<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
> extends FastifyRequest {
  body: TBody;
  params: TParams;
  query: TQuery;
  context?: RequestContext;
}

// ==================== Route Handler Types ====================

/**
 * Route handler function type
 */
export type RouteHandler<
  TBody = unknown,
  TParams = unknown,
  TQuery = unknown,
  TResponse = unknown,
> = (
  request: TypedRequest<TBody, TParams, TQuery>,
  reply: FastifyReply
) => Promise<ApiResponse<TResponse>>;

/**
 * Generic route handler for route definitions (accepts any typed handler)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericRouteHandler = (request: any, reply: any) => Promise<any>;

/**
 * Route definition
 */
export interface RouteDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  handler: GenericRouteHandler;
  schema?: RouteSchema;
  middleware?: RouteMiddleware[];
  rateLimit?: RateLimitConfig;
  auth?: AuthConfig;
}

/**
 * Route schema for validation
 */
export interface RouteSchema {
  body?: Record<string, unknown>;
  params?: Record<string, unknown>;
  querystring?: Record<string, unknown>;
  response?: Record<number, Record<string, unknown>>;
  tags?: string[];
  summary?: string;
  description?: string;
}

/**
 * Route middleware
 */
export type RouteMiddleware = (
  request: FastifyRequest,
  reply: FastifyReply
) => Promise<void>;

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  max: number;
  timeWindow: string | number;
  keyGenerator?: (request: FastifyRequest) => string;
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  required: boolean;
  permissions?: string[];
  allowApiKey?: boolean;
  allowBearer?: boolean;
}

// ==================== Server Configuration ====================

/**
 * API server configuration
 */
export interface ApiServerConfig {
  host: string;
  port: number;
  prefix?: string;
  cors?: CorsConfig;
  helmet?: HelmetConfig;
  rateLimit?: RateLimitConfig;
  logging?: LoggingConfig;
  swagger?: SwaggerConfig;
  auth?: ApiAuthConfig;
  gracefulShutdown?: GracefulShutdownConfig;
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  enabled: boolean;
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Helmet security configuration
 */
export interface HelmetConfig {
  enabled: boolean;
  contentSecurityPolicy?: boolean | Record<string, unknown>;
  dnsPrefetchControl?: boolean;
  frameguard?: boolean | { action: string };
  hidePoweredBy?: boolean;
  hsts?: boolean | { maxAge: number; includeSubDomains: boolean };
  ieNoOpen?: boolean;
  noSniff?: boolean;
  referrerPolicy?: boolean | { policy: string };
  xssFilter?: boolean;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  enabled: boolean;
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  prettyPrint?: boolean;
  redactHeaders?: string[];
  redactPaths?: string[];
}

/**
 * Swagger/OpenAPI configuration
 */
export interface SwaggerConfig {
  enabled: boolean;
  title?: string;
  description?: string;
  version?: string;
  basePath?: string;
  tags?: SwaggerTag[];
}

/**
 * Swagger tag
 */
export interface SwaggerTag {
  name: string;
  description?: string;
}

/**
 * API authentication configuration
 */
export interface ApiAuthConfig {
  enabled: boolean;
  apiKeyHeader?: string;
  bearerPrefix?: string;
  validators?: AuthValidator[];
}

/**
 * Authentication validator
 */
export type AuthValidator = (token: string) => Promise<AuthContext | null>;

/**
 * Graceful shutdown configuration
 */
export interface GracefulShutdownConfig {
  enabled: boolean;
  timeout: number;
  signals?: NodeJS.Signals[];
}

// ==================== Server Interface ====================

/**
 * API Server Interface
 */
export interface IApiServer {
  /**
   * Get Fastify instance
   */
  getInstance(): FastifyInstance;

  /**
   * Start the server
   */
  start(): Promise<void>;

  /**
   * Stop the server
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
   * Register routes
   */
  registerRoutes(routes: RouteDefinition[]): void;

  /**
   * Register plugin
   */
  registerPlugin(plugin: FastifyPluginAsync, options?: Record<string, unknown>): Promise<void>;

  /**
   * Get server health
   */
  getHealth(): ApiServerHealth;
}

/**
 * Fastify plugin async type
 */
export type FastifyPluginAsync = (
  instance: FastifyInstance,
  options: Record<string, unknown>
) => Promise<void>;

/**
 * API server health status
 */
export interface ApiServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  startedAt: Date;
  requestsServed: number;
  activeConnections: number;
  details?: Record<string, unknown>;
}

// ==================== Router Interface ====================

/**
 * Router interface for domain-specific routes
 */
export interface IRouter {
  /**
   * Router prefix (e.g., '/agents', '/workflows')
   */
  readonly prefix: string;

  /**
   * Get all route definitions
   */
  getRoutes(): RouteDefinition[];

  /**
   * Register router on Fastify instance
   */
  register(instance: FastifyInstance): Promise<void>;
}

// ==================== Controller Interface ====================

/**
 * Base controller interface
 */
export interface IController<T = unknown> {
  /**
   * Create a new resource
   */
  create?(data: Partial<T>): Promise<T>;

  /**
   * Get a resource by ID
   */
  getById?(id: string): Promise<T | null>;

  /**
   * List resources with pagination
   */
  list?(params: ListQueryParams): Promise<{ items: T[]; total: number }>;

  /**
   * Update a resource
   */
  update?(id: string, data: Partial<T>): Promise<T | null>;

  /**
   * Delete a resource
   */
  delete?(id: string): Promise<boolean>;
}

// ==================== Constants ====================

/**
 * Default API configuration
 */
export const DEFAULT_API_CONFIG: Required<
  Omit<ApiServerConfig, 'swagger' | 'auth'>
> = {
  host: '0.0.0.0',
  port: 3000,
  prefix: '/api/v1',
  cors: {
    enabled: true,
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-API-Key'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    credentials: true,
    maxAge: 86400,
  },
  helmet: {
    enabled: true,
    contentSecurityPolicy: false,
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  },
  rateLimit: {
    max: 100,
    timeWindow: '1 minute',
  },
  logging: {
    enabled: true,
    level: 'info',
    prettyPrint: process.env.NODE_ENV !== 'production',
    redactHeaders: ['authorization', 'x-api-key'],
    redactPaths: ['body.password', 'body.apiKey'],
  },
  gracefulShutdown: {
    enabled: true,
    timeout: 10000,
    signals: ['SIGTERM', 'SIGINT'],
  },
};

/**
 * API error codes
 */
export const API_ERROR_CODES = {
  // Client errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',

  // Domain errors
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  AGENT_ALREADY_EXISTS: 'AGENT_ALREADY_EXISTS',
  AGENT_NOT_RUNNING: 'AGENT_NOT_RUNNING',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  WORKFLOW_ALREADY_RUNNING: 'WORKFLOW_ALREADY_RUNNING',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED: 'TOOL_EXECUTION_FAILED',
  HOOK_NOT_FOUND: 'HOOK_NOT_FOUND',
  HOOK_DISABLED: 'HOOK_DISABLED',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_ALREADY_COMPLETED: 'TASK_ALREADY_COMPLETED',
} as const;

/**
 * API error code type
 */
export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
