/**
 * Rate Limiter Middleware
 *
 * Configurable per-endpoint rate limiting with sliding window algorithm.
 * Supports custom key generation, skip paths, and per-route overrides.
 *
 * @module api/middleware/rate-limiter
 */

import type { WebServer } from '../../ui/web/web-server';
import type { WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';
import { logger } from '../../shared/logging/logger';

// ── Types ──────────────────────────────────────────────────────────

export interface RateLimitOptions {
  /** Time window in milliseconds (default: 15 minutes) */
  windowMs?: number;
  /** Maximum requests per window (default: 100) */
  maxRequests?: number;
  /** Function to extract a client key from the request (default: IP-based) */
  keyGenerator?: (req: WebRequest) => string;
  /** Paths to exempt from rate limiting */
  skipPaths?: string[];
  /** Custom error message returned on 429 */
  message?: string;
  /** Per-endpoint overrides keyed by path prefix */
  endpointLimits?: Record<string, EndpointLimit>;
}

export interface EndpointLimit {
  windowMs: number;
  maxRequests: number;
}

interface SlidingWindowEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[];
}

// ── Defaults ───────────────────────────────────────────────────────

const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_MAX_REQUESTS = 100;
const DEFAULT_MESSAGE = 'Too many requests, please try again later';
const CLEANUP_INTERVAL_MS = 60_000;

const DEFAULT_ENDPOINT_LIMITS: Record<string, EndpointLimit> = {
  '/api/login': { windowMs: 60_000, maxRequests: 10 },
  '/api/tasks': { windowMs: 60_000, maxRequests: 30 },
};

const DEFAULT_SKIP_PATHS = ['/api/health', '/api/db/health'];

// ── Key extraction ─────────────────────────────────────────────────

function defaultKeyGenerator(req: WebRequest): string {
  const forwarded = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'] || '';
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

// ── RateLimiter class ──────────────────────────────────────────────

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly keyGenerator: (req: WebRequest) => string;
  private readonly skipPaths: string[];
  private readonly message: string;
  private readonly endpointLimits: Record<string, EndpointLimit>;

  /** Buckets keyed by `${clientKey}::${bucketId}` */
  private readonly entries = new Map<string, SlidingWindowEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options?: RateLimitOptions) {
    this.windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    this.maxRequests = options?.maxRequests ?? DEFAULT_MAX_REQUESTS;
    this.keyGenerator = options?.keyGenerator ?? defaultKeyGenerator;
    this.skipPaths = options?.skipPaths ?? DEFAULT_SKIP_PATHS;
    this.message = options?.message ?? DEFAULT_MESSAGE;
    this.endpointLimits = options?.endpointLimits ?? DEFAULT_ENDPOINT_LIMITS;
  }

  /**
   * Install rate limiting on a WebServer instance.
   * Wraps handleRequest to enforce limits before routing.
   */
  install(server: WebServer): void {
    this.startCleanup();
    const originalHandleRequest = server.handleRequest.bind(server);

    server.handleRequest = async (req: WebRequest): Promise<WebResponse> => {
      if (this.isSkipped(req.path)) {
        return originalHandleRequest(req);
      }

      const clientKey = this.keyGenerator(req);
      const { windowMs, maxRequests } = this.resolveLimit(req.path);
      const now = Date.now();
      const bucketKey = `${clientKey}::${this.bucketId(req.path)}`;

      let entry = this.entries.get(bucketKey);
      if (!entry) {
        entry = { timestamps: [] };
        this.entries.set(bucketKey, entry);
      }

      // Sliding window: remove timestamps outside the current window
      const windowStart = now - windowMs;
      entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

      if (entry.timestamps.length >= maxRequests) {
        const oldestInWindow = entry.timestamps[0];
        const retryAfterMs = oldestInWindow + windowMs - now;
        const retryAfterSec = Math.ceil(retryAfterMs / 1000);

        logger.warn('Rate limit exceeded', {
          ip: clientKey,
          path: req.path,
          count: entry.timestamps.length,
          maxRequests,
        });

        return {
          status: 429,
          body: {
            error: this.message,
            code: 'RATE_LIMITED',
            status: 429,
          },
          headers: {
            'Retry-After': String(retryAfterSec),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil((now + retryAfterMs) / 1000)),
          },
        };
      }

      // Record this request
      entry.timestamps.push(now);

      const remaining = maxRequests - entry.timestamps.length;
      const res = await originalHandleRequest(req);

      res.headers = {
        ...res.headers,
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(Math.ceil((now + windowMs) / 1000)),
      };

      return res;
    };
  }

  /** Stop the background cleanup timer (for tests / shutdown). */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
  }

  // ── private helpers ────────────────────────────────────────────

  private isSkipped(path: string): boolean {
    return this.skipPaths.includes(path);
  }

  /**
   * Resolve the effective limit for a path.
   * Matches endpoint limits by exact path or longest prefix.
   */
  private resolveLimit(path: string): { windowMs: number; maxRequests: number } {
    // Exact match first
    if (this.endpointLimits[path]) {
      return this.endpointLimits[path];
    }
    // Longest prefix match
    let bestMatch = '';
    for (const prefix of Object.keys(this.endpointLimits)) {
      if (path.startsWith(prefix) && prefix.length > bestMatch.length) {
        bestMatch = prefix;
      }
    }
    if (bestMatch) {
      return this.endpointLimits[bestMatch];
    }
    return { windowMs: this.windowMs, maxRequests: this.maxRequests };
  }

  /**
   * Derive a bucket identifier so that different endpoint-limit groups
   * are tracked independently for the same client.
   */
  private bucketId(path: string): string {
    if (this.endpointLimits[path]) {
      return path;
    }
    for (const prefix of Object.keys(this.endpointLimits)) {
      if (path.startsWith(prefix)) {
        return prefix;
      }
    }
    return '__default__';
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.entries) {
        // Remove entries where all timestamps have expired
        // Use the global window as a conservative upper bound
        entry.timestamps = entry.timestamps.filter(
          ts => ts > now - this.windowMs,
        );
        if (entry.timestamps.length === 0) {
          this.entries.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────

/**
 * Create and return a RateLimiter instance.
 * Call `limiter.install(server)` to wire it into a WebServer.
 */
export function createRateLimiter(options?: RateLimitOptions): RateLimiter {
  return new RateLimiter(options);
}
