/**
 * Rate Limiting Middleware for Fastify
 *
 * Feature: F4.5 - Rate Limiting
 *
 * Provides rate limiting middleware for Fastify with support for
 * route-specific configurations and multiple key strategies.
 *
 * @module api/ratelimit/middlewares
 */

import { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { createLogger } from '../../../core/services/logger.js';
import {
  IRateLimiter,
  RateLimitConfig,
  RateLimitRequest,
  RateLimitResult,
  RateLimitMiddlewareOptions,
  RouteRateLimitConfig,
  RateLimitStatus,
  DEFAULT_RATE_LIMIT_CONFIG,
} from '../interfaces/ratelimit.interface.js';
import { RateLimiter } from '../services/ratelimit.service.js';

/**
 * Rate limit error response
 */
export interface RateLimitErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    retryAfter?: number;
    details?: {
      limit: number;
      current: number;
      resetAt: number;
    };
  };
}

/**
 * Extended Fastify request with rate limit info
 */
declare module 'fastify' {
  interface FastifyRequest {
    rateLimit?: RateLimitResult;
  }
}

/**
 * Create rate limit middleware for Fastify
 */
export function createRateLimitMiddleware(
  options?: Partial<RateLimitMiddlewareOptions>
): preHandlerHookHandler {
  const logger = createLogger('RateLimitMiddleware');
  const rateLimiter = options?.rateLimiter || new RateLimiter(options?.config);
  const config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...options?.config };

  const errorResponse = options?.errorResponse || defaultErrorResponse;

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Extract request info
    const rateLimitRequest = extractRequest(request);

    // Check rate limit
    const result = await rateLimiter.check(rateLimitRequest);

    // Store result on request for downstream use
    request.rateLimit = result;

    // Set headers if enabled
    if (config.headers !== false) {
      const headers = rateLimiter.getHeaders(result);
      for (const [key, value] of Object.entries(headers)) {
        reply.header(key, value);
      }
    }

    // If not allowed, send error response
    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        key: result.key,
        current: result.current,
        limit: result.limit,
        ip: rateLimitRequest.ip,
        path: request.url,
      });

      const response = errorResponse(result);
      reply.status(429).send(response);
      return;
    }
  };
}

/**
 * Create rate limit guard for specific routes
 */
export function createRateLimitGuard(
  config: Partial<RateLimitConfig>
): preHandlerHookHandler {
  const rateLimiter = new RateLimiter(config);

  return async function rateLimitGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const rateLimitRequest = extractRequest(request);
    const result = await rateLimiter.check(rateLimitRequest);

    request.rateLimit = result;

    if (config.headers !== false) {
      const headers = rateLimiter.getHeaders(result);
      for (const [key, value] of Object.entries(headers)) {
        reply.header(key, value);
      }
    }

    if (!result.allowed) {
      const response = defaultErrorResponse(result);
      reply.status(429).send(response);
      return;
    }
  };
}

/**
 * Rate limiting plugin for Fastify
 */
async function rateLimitPlugin(
  fastify: FastifyInstance,
  options: RateLimitPluginOptions
): Promise<void> {
  const logger = createLogger('RateLimitPlugin');
  const globalConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...options.global };
  const rateLimiter = options.rateLimiter || new RateLimiter(globalConfig);
  const routeConfigs = options.routes || [];

  // Sort route configs by priority (higher first)
  routeConfigs.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  logger.info('Rate limit plugin registered', {
    globalMax: globalConfig.max,
    globalWindow: globalConfig.window,
    routeConfigs: routeConfigs.length,
  });

  // Add global rate limiting hook
  fastify.addHook('preHandler', async (request, reply) => {
    // Check for route-specific config first
    const routeConfig = findRouteConfig(request, routeConfigs);
    const effectiveLimiter = routeConfig
      ? new RateLimiter({ ...globalConfig, ...routeConfig })
      : rateLimiter;

    const rateLimitRequest = extractRequest(request);
    const result = await effectiveLimiter.check(rateLimitRequest);

    request.rateLimit = result;

    // Set headers
    if (globalConfig.headers !== false) {
      const headers = effectiveLimiter.getHeaders(result);
      for (const [key, value] of Object.entries(headers)) {
        reply.header(key, value);
      }
    }

    if (!result.allowed) {
      logger.warn('Rate limit exceeded', {
        key: result.key,
        current: result.current,
        limit: result.limit,
        path: request.url,
        method: request.method,
      });

      const response = options.errorResponse?.(result) || defaultErrorResponse(result);
      reply.status(429).send(response);
      return;
    }
  });

  // Decorate fastify with rate limiter
  fastify.decorate('rateLimiter', rateLimiter);
}

/**
 * Rate limit plugin options
 */
export interface RateLimitPluginOptions {
  /** Global rate limit configuration */
  global?: Partial<RateLimitConfig>;
  /** Route-specific configurations */
  routes?: RouteRateLimitConfig[];
  /** Custom rate limiter instance */
  rateLimiter?: IRateLimiter;
  /** Custom error response generator */
  errorResponse?: (result: RateLimitResult) => unknown;
}

/**
 * Create Fastify rate limit plugin
 */
export const fastifyRateLimit = fp(rateLimitPlugin, {
  name: 'rate-limit',
  fastify: '4.x',
});

/**
 * Extract rate limit request from Fastify request
 */
function extractRequest(request: FastifyRequest): RateLimitRequest {
  // Extract IP address (considering proxies)
  let ip = request.ip;

  // Check for forwarded headers
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }

  const realIp = request.headers['x-real-ip'];
  if (realIp && !forwarded) {
    ip = Array.isArray(realIp) ? realIp[0] : realIp;
  }

  // Extract user ID and API key from request context
  const auth = (request as unknown as Record<string, unknown>).auth as
    | { userId?: string; apiKey?: string }
    | undefined;

  return {
    ip,
    method: request.method,
    url: request.url,
    headers: request.headers as Record<string, string | string[] | undefined>,
    userId: auth?.userId,
    apiKey: auth?.apiKey || (request.headers['x-api-key'] as string),
  };
}

/**
 * Find matching route config
 */
function findRouteConfig(
  request: FastifyRequest,
  configs: RouteRateLimitConfig[]
): RouteRateLimitConfig | null {
  for (const config of configs) {
    // Check method
    if (config.methods && !config.methods.includes(request.method)) {
      continue;
    }

    // Check route pattern
    if (config.route && !matchRoute(request.url, config.route)) {
      continue;
    }

    return config;
  }

  return null;
}

/**
 * Match URL against route pattern
 */
function matchRoute(url: string, pattern: string): boolean {
  // Remove query string
  const path = url.split('?')[0];

  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\*/g, '.*')
    .replace(/\//g, '\\/')
    .replace(/:\w+/g, '[^/]+');

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
}

/**
 * Default error response generator
 */
function defaultErrorResponse(result: RateLimitResult): RateLimitErrorResponse {
  const message =
    result.status === RateLimitStatus.BLOCKED
      ? 'Access temporarily blocked due to excessive requests'
      : 'Too many requests, please try again later';

  return {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message,
      retryAfter: result.retryAfter ? Math.ceil(result.retryAfter / 1000) : undefined,
      details: {
        limit: result.limit,
        current: result.current,
        resetAt: result.resetAt,
      },
    },
  };
}

/**
 * Helper function to apply rate limit to specific routes
 */
export function rateLimit(config: Partial<RateLimitConfig>): preHandlerHookHandler {
  return createRateLimitGuard(config);
}

/**
 * Predefined rate limit helpers
 */
export const rateLimitPresets = {
  /** Strict: 10 requests per minute */
  strict: () => rateLimit({ max: 10, window: '1m' }),

  /** Standard: 100 requests per minute */
  standard: () => rateLimit({ max: 100, window: '1m' }),

  /** Relaxed: 1000 requests per minute */
  relaxed: () => rateLimit({ max: 1000, window: '1m' }),

  /** Per second: 10 requests per second */
  perSecond: (max: number = 10) => rateLimit({ max, window: '1s' }),

  /** Per hour: Specified requests per hour */
  perHour: (max: number = 1000) => rateLimit({ max, window: '1h' }),

  /** Per day: Specified requests per day */
  perDay: (max: number = 10000) => rateLimit({ max, window: '1d' }),
};
