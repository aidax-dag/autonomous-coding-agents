/**
 * Rate Limiting Interfaces
 *
 * Feature: F4.5 - Rate Limiting
 *
 * Provides comprehensive rate limiting with multiple algorithms,
 * storage backends, and flexible configuration.
 *
 * SOLID Principles:
 * - S: Each interface has a single responsibility
 * - O: Extensible via strategy pattern for algorithms
 * - I: Segregated interfaces for different concerns
 * - D: High-level modules depend on abstractions
 *
 * @module api/ratelimit/interfaces
 */

// ==================== Enums ====================

/**
 * Rate limiting algorithm types
 */
export enum RateLimitAlgorithm {
  /** Fixed window counter - simple, but can allow 2x burst at window boundaries */
  FIXED_WINDOW = 'fixed_window',
  /** Sliding window log - accurate, but memory intensive */
  SLIDING_WINDOW_LOG = 'sliding_window_log',
  /** Sliding window counter - good balance of accuracy and efficiency */
  SLIDING_WINDOW_COUNTER = 'sliding_window_counter',
  /** Token bucket - allows controlled bursts */
  TOKEN_BUCKET = 'token_bucket',
  /** Leaky bucket - smooth output rate */
  LEAKY_BUCKET = 'leaky_bucket',
}

/**
 * Rate limit key types for identification
 */
export enum RateLimitKeyType {
  /** Limit by IP address */
  IP = 'ip',
  /** Limit by user ID */
  USER = 'user',
  /** Limit by API key */
  API_KEY = 'api_key',
  /** Limit by custom key */
  CUSTOM = 'custom',
  /** Global limit (all requests) */
  GLOBAL = 'global',
}

/**
 * Rate limit scope
 */
export enum RateLimitScope {
  /** Per route rate limit */
  ROUTE = 'route',
  /** Per endpoint group (e.g., all agent endpoints) */
  ENDPOINT_GROUP = 'endpoint_group',
  /** Global across all endpoints */
  GLOBAL = 'global',
}

/**
 * Rate limit status
 */
export enum RateLimitStatus {
  ALLOWED = 'allowed',
  LIMITED = 'limited',
  BLOCKED = 'blocked',
}

// ==================== Configuration ====================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  max: number;
  /** Time window in milliseconds or string (e.g., '1m', '1h') */
  window: number | string;
  /** Algorithm to use */
  algorithm?: RateLimitAlgorithm;
  /** Key type for identifying clients */
  keyType?: RateLimitKeyType;
  /** Custom key generator function */
  keyGenerator?: RateLimitKeyGenerator;
  /** Skip rate limiting for certain requests */
  skip?: RateLimitSkipFunction;
  /** Custom error handler */
  errorHandler?: RateLimitErrorHandler;
  /** Enable rate limit headers in response */
  headers?: boolean;
  /** Block duration when limit exceeded (for progressive blocking) */
  blockDuration?: number;
  /** Whitelist of IPs/keys that bypass rate limiting */
  whitelist?: string[];
  /** Blacklist of IPs/keys that are always blocked */
  blacklist?: string[];
  /** Points cost per request (for weighted limiting) */
  pointsCost?: number;
  /** Store configuration */
  store?: RateLimitStoreConfig;
}

/**
 * Store configuration for rate limit data
 */
export interface RateLimitStoreConfig {
  /** Store type */
  type: 'memory' | 'redis' | 'custom';
  /** Store-specific options */
  options?: Record<string, unknown>;
  /** Custom store instance */
  instance?: IRateLimitStore;
}

/**
 * Route-specific rate limit override
 */
export interface RouteRateLimitConfig extends RateLimitConfig {
  /** Route pattern (e.g., '/api/v1/agents/*') */
  route?: string;
  /** HTTP methods this config applies to */
  methods?: string[];
  /** Priority (higher = applied first) */
  priority?: number;
}

/**
 * Token bucket specific configuration
 */
export interface TokenBucketConfig extends RateLimitConfig {
  /** Bucket capacity (max tokens) */
  capacity: number;
  /** Refill rate (tokens per second) */
  refillRate: number;
  /** Initial tokens in bucket */
  initialTokens?: number;
}

/**
 * Leaky bucket specific configuration
 */
export interface LeakyBucketConfig extends RateLimitConfig {
  /** Bucket capacity */
  capacity: number;
  /** Leak rate (requests processed per second) */
  leakRate: number;
}

// ==================== Runtime Types ====================

/**
 * Rate limit key generator function
 */
export type RateLimitKeyGenerator = (request: RateLimitRequest) => string;

/**
 * Rate limit skip function
 */
export type RateLimitSkipFunction = (request: RateLimitRequest) => boolean | Promise<boolean>;

/**
 * Rate limit error handler
 */
export type RateLimitErrorHandler = (
  request: RateLimitRequest,
  result: RateLimitResult
) => void | Promise<void>;

/**
 * Simplified request type for rate limiting
 */
export interface RateLimitRequest {
  ip: string;
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  userId?: string;
  apiKey?: string;
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current request count in window */
  current: number;
  /** Maximum requests allowed */
  limit: number;
  /** Remaining requests in window */
  remaining: number;
  /** Milliseconds until limit resets */
  resetIn: number;
  /** Unix timestamp when limit resets */
  resetAt: number;
  /** Time to wait if blocked (in ms) */
  retryAfter?: number;
  /** Status of the rate limit check */
  status: RateLimitStatus;
  /** Key used for this check */
  key: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Rate limit headers
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

/**
 * Rate limit entry (stored in memory/cache)
 */
export interface RateLimitEntry {
  /** Key identifier */
  key: string;
  /** Number of requests */
  count: number;
  /** Window start timestamp */
  windowStart: number;
  /** Window end timestamp */
  windowEnd: number;
  /** Last request timestamp */
  lastRequest: number;
  /** Is currently blocked */
  blocked?: boolean;
  /** Block expiry timestamp */
  blockExpiry?: number;
  /** For token bucket: current tokens */
  tokens?: number;
  /** For token bucket: last refill time */
  lastRefill?: number;
  /** For sliding window log: request timestamps */
  timestamps?: number[];
  /** For leaky bucket: queue size */
  queueSize?: number;
  /** For leaky bucket: last leak time */
  lastLeak?: number;
}

/**
 * Rate limit statistics
 */
export interface RateLimitStats {
  /** Total requests checked */
  totalRequests: number;
  /** Requests allowed */
  allowedRequests: number;
  /** Requests limited */
  limitedRequests: number;
  /** Requests blocked */
  blockedRequests: number;
  /** Unique keys tracked */
  uniqueKeys: number;
  /** Average requests per key */
  averageRequestsPerKey: number;
  /** Top limited keys */
  topLimitedKeys: Array<{ key: string; count: number }>;
}

// ==================== Service Interfaces ====================

/**
 * Rate limiter service interface
 */
export interface IRateLimiter {
  /**
   * Check if a request is allowed
   */
  check(request: RateLimitRequest): Promise<RateLimitResult>;

  /**
   * Increment request count for a key
   */
  increment(key: string, cost?: number): Promise<RateLimitResult>;

  /**
   * Reset rate limit for a key
   */
  reset(key: string): Promise<void>;

  /**
   * Block a key for specified duration
   */
  block(key: string, duration: number): Promise<void>;

  /**
   * Unblock a key
   */
  unblock(key: string): Promise<void>;

  /**
   * Check if a key is blocked
   */
  isBlocked(key: string): Promise<boolean>;

  /**
   * Get current state for a key
   */
  getState(key: string): Promise<RateLimitEntry | null>;

  /**
   * Get rate limit statistics
   */
  getStats(): Promise<RateLimitStats>;

  /**
   * Clear all rate limit data
   */
  clear(): Promise<void>;

  /**
   * Get rate limit headers for response
   */
  getHeaders(result: RateLimitResult): RateLimitHeaders;
}

/**
 * Rate limit store interface (for different backends)
 */
export interface IRateLimitStore {
  /**
   * Get entry by key
   */
  get(key: string): Promise<RateLimitEntry | null>;

  /**
   * Set entry
   */
  set(key: string, entry: RateLimitEntry, ttl?: number): Promise<void>;

  /**
   * Delete entry
   */
  delete(key: string): Promise<boolean>;

  /**
   * Increment counter atomically
   */
  increment(key: string, amount?: number): Promise<number>;

  /**
   * Check if key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get all keys matching pattern
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * Clear all entries
   */
  clear(): Promise<void>;

  /**
   * Get store size
   */
  size(): Promise<number>;
}

/**
 * Rate limit middleware options
 */
export interface RateLimitMiddlewareOptions {
  /** Rate limiter service instance */
  rateLimiter: IRateLimiter;
  /** Global configuration */
  config?: Partial<RateLimitConfig>;
  /** Route-specific configurations */
  routes?: RouteRateLimitConfig[];
  /** Error response format */
  errorResponse?: (result: RateLimitResult) => unknown;
  /** Logger instance */
  logger?: IRateLimitLogger;
}

/**
 * Logger interface for rate limiting
 */
export interface IRateLimitLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

// ==================== Events ====================

/**
 * Rate limit event types
 */
export enum RateLimitEventType {
  REQUEST_ALLOWED = 'request_allowed',
  REQUEST_LIMITED = 'request_limited',
  REQUEST_BLOCKED = 'request_blocked',
  KEY_BLOCKED = 'key_blocked',
  KEY_UNBLOCKED = 'key_unblocked',
  KEY_RESET = 'key_reset',
  THRESHOLD_WARNING = 'threshold_warning',
}

/**
 * Rate limit event
 */
export interface RateLimitEvent {
  type: RateLimitEventType;
  key: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

/**
 * Rate limit event handler
 */
export type RateLimitEventHandler = (event: RateLimitEvent) => void | Promise<void>;

// ==================== Defaults ====================

/**
 * Default rate limit configuration
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  max: 100,
  window: 60000, // 1 minute
  algorithm: RateLimitAlgorithm.SLIDING_WINDOW_COUNTER,
  keyType: RateLimitKeyType.IP,
  headers: true,
  whitelist: [],
  blacklist: [],
  pointsCost: 1,
};

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMIT_PRESETS = {
  /** Strict: 10 requests per minute */
  strict: {
    max: 10,
    window: 60000,
  },
  /** Standard: 100 requests per minute */
  standard: {
    max: 100,
    window: 60000,
  },
  /** Relaxed: 1000 requests per minute */
  relaxed: {
    max: 1000,
    window: 60000,
  },
  /** Burst: 50 requests per second with token bucket */
  burst: {
    max: 50,
    window: 1000,
    algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
  },
  /** API: 1000 requests per hour */
  api: {
    max: 1000,
    window: 3600000,
  },
} as const;

// ==================== Utility Functions ====================

/**
 * Parse time window string to milliseconds
 */
export function parseTimeWindow(window: number | string): number {
  if (typeof window === 'number') {
    return window;
  }

  const match = window.match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)$/i);
  if (!match) {
    throw new Error(`Invalid time window format: ${window}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      return value * 1000;
    case 'm':
    case 'min':
    case 'minute':
    case 'minutes':
      return value * 60 * 1000;
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'd':
    case 'day':
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}
