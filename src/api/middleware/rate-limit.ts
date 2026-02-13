/**
 * Rate Limiter Middleware
 *
 * In-memory IP-based rate limiting with sliding window.
 * Wraps WebServer.handleRequest to enforce request limits.
 *
 * @module api/middleware/rate-limit
 */

import type { WebServer } from '../../ui/web/web-server';
import type { WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';
import { logger } from '../../shared/logging/logger';

export interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  excludePaths?: string[];
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 100;
const CLEANUP_INTERVAL_MS = 60_000;

/**
 * Extract client IP from request headers.
 * Uses x-forwarded-for if available, otherwise 'unknown'.
 */
function getClientIP(req: WebRequest): string {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'] || '';
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; take the first
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

/**
 * Install rate limiting middleware on a WebServer instance.
 */
export function installRateLimiter(server: WebServer, config?: RateLimitConfig): void {
  const windowMs = config?.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = config?.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const excludePaths = config?.excludePaths ?? [];

  const entries = new Map<string, RateLimitEntry>();

  // Periodic cleanup of expired entries
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the timer to not prevent Node.js from exiting
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }

  const originalHandleRequest = server.handleRequest.bind(server);

  server.handleRequest = async (req: WebRequest): Promise<WebResponse> => {
    // Skip excluded paths
    if (excludePaths.includes(req.path)) {
      return originalHandleRequest(req);
    }

    const clientIP = getClientIP(req);
    const now = Date.now();

    let entry = entries.get(clientIP);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(clientIP, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

      logger.warn('Rate limit exceeded', {
        ip: clientIP,
        path: req.path,
        count: entry.count,
        maxRequests,
      });

      return {
        status: 429,
        body: {
          error: 'Too many requests',
          code: 'RATE_LIMITED',
          status: 429,
        },
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
        },
      };
    }

    const remaining = maxRequests - entry.count;

    const res = await originalHandleRequest(req);

    res.headers = {
      ...res.headers,
      'X-RateLimit-Limit': String(maxRequests),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
    };

    return res;
  };
}
