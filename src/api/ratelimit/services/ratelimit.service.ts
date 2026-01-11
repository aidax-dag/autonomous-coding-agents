/**
 * Rate Limiter Service
 *
 * Feature: F4.5 - Rate Limiting
 *
 * Implements multiple rate limiting algorithms with configurable backends.
 *
 * Algorithms:
 * - Fixed Window: Simple counter per time window
 * - Sliding Window Log: Precise, stores all timestamps
 * - Sliding Window Counter: Hybrid approach, memory efficient
 * - Token Bucket: Allows controlled bursts
 * - Leaky Bucket: Smooth output rate
 *
 * @module api/ratelimit/services
 */

import { ILogger, createLogger } from '../../../core/services/logger.js';
import {
  IRateLimiter,
  IRateLimitStore,
  RateLimitConfig,
  RateLimitRequest,
  RateLimitResult,
  RateLimitEntry,
  RateLimitHeaders,
  RateLimitStats,
  RateLimitStatus,
  RateLimitAlgorithm,
  RateLimitKeyType,
  RateLimitEvent,
  RateLimitEventType,
  RateLimitEventHandler,
  DEFAULT_RATE_LIMIT_CONFIG,
  parseTimeWindow,
} from '../interfaces/ratelimit.interface.js';
import { MemoryRateLimitStore } from '../stores/memory.store.js';

/**
 * Rate limiter implementation
 */
export class RateLimiter implements IRateLimiter {
  private readonly logger: ILogger;
  private readonly config: Required<RateLimitConfig>;
  private readonly store: IRateLimitStore;
  private readonly eventHandlers: Map<RateLimitEventType, RateLimitEventHandler[]>;
  private readonly stats: {
    totalRequests: number;
    allowedRequests: number;
    limitedRequests: number;
    blockedRequests: number;
  };

  constructor(config?: Partial<RateLimitConfig>, store?: IRateLimitStore) {
    this.logger = createLogger('RateLimiter');
    this.config = {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...config,
      keyGenerator: config?.keyGenerator || this.defaultKeyGenerator.bind(this),
      skip: config?.skip,
      errorHandler: config?.errorHandler,
      store: config?.store,
    } as Required<RateLimitConfig>;

    // Initialize store
    this.store = store || this.config.store?.instance || new MemoryRateLimitStore();
    this.eventHandlers = new Map();
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      limitedRequests: 0,
      blockedRequests: 0,
    };

    this.logger.debug('Rate limiter initialized', {
      algorithm: this.config.algorithm,
      max: this.config.max,
      window: this.config.window,
      keyType: this.config.keyType,
    });
  }

  /**
   * Check if a request is allowed
   */
  async check(request: RateLimitRequest): Promise<RateLimitResult> {
    this.stats.totalRequests++;

    // Check skip function
    if (this.config.skip) {
      const shouldSkip = await this.config.skip(request);
      if (shouldSkip) {
        return this.createAllowedResult('skipped');
      }
    }

    // Generate key
    const key = this.config.keyGenerator(request);

    // Check blacklist
    if (this.config.blacklist?.includes(key)) {
      this.stats.blockedRequests++;
      return this.createBlockedResult(key, 'Blacklisted');
    }

    // Check whitelist
    if (this.config.whitelist?.includes(key)) {
      this.stats.allowedRequests++;
      return this.createAllowedResult(key);
    }

    // Check if blocked
    if (await this.isBlocked(key)) {
      this.stats.blockedRequests++;
      const entry = await this.store.get(key);
      return this.createBlockedResult(key, 'Temporarily blocked', entry?.blockExpiry);
    }

    // Apply rate limiting based on algorithm
    const result = await this.applyAlgorithm(key);

    // Update stats
    if (result.allowed) {
      this.stats.allowedRequests++;
    } else {
      this.stats.limitedRequests++;
    }

    // Emit event
    await this.emitEvent({
      type: result.allowed ? RateLimitEventType.REQUEST_ALLOWED : RateLimitEventType.REQUEST_LIMITED,
      key,
      timestamp: new Date(),
      data: { current: result.current, limit: result.limit },
    });

    // Call error handler if limited
    if (!result.allowed && this.config.errorHandler) {
      await this.config.errorHandler(request, result);
    }

    return result;
  }

  /**
   * Increment request count for a key
   */
  async increment(key: string, cost: number = 1): Promise<RateLimitResult> {
    const windowMs = parseTimeWindow(this.config.window);
    const now = Date.now();

    let entry = await this.store.get(key);

    if (!entry || entry.windowEnd < now) {
      // Start new window
      entry = {
        key,
        count: cost,
        windowStart: now,
        windowEnd: now + windowMs,
        lastRequest: now,
      };
    } else {
      // Increment existing window
      entry.count += cost;
      entry.lastRequest = now;
    }

    await this.store.set(key, entry, windowMs);

    const remaining = Math.max(0, this.config.max - entry.count);
    const allowed = entry.count <= this.config.max;

    return {
      allowed,
      current: entry.count,
      limit: this.config.max,
      remaining,
      resetIn: entry.windowEnd - now,
      resetAt: entry.windowEnd,
      status: allowed ? RateLimitStatus.ALLOWED : RateLimitStatus.LIMITED,
      key,
    };
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    await this.store.delete(key);
    this.logger.debug('Rate limit reset', { key });

    await this.emitEvent({
      type: RateLimitEventType.KEY_RESET,
      key,
      timestamp: new Date(),
    });
  }

  /**
   * Block a key for specified duration
   */
  async block(key: string, duration: number): Promise<void> {
    const now = Date.now();
    const entry: RateLimitEntry = {
      key,
      count: 0,
      windowStart: now,
      windowEnd: now + duration,
      lastRequest: now,
      blocked: true,
      blockExpiry: now + duration,
    };

    await this.store.set(key, entry, duration);
    this.logger.info('Key blocked', { key, duration });

    await this.emitEvent({
      type: RateLimitEventType.KEY_BLOCKED,
      key,
      timestamp: new Date(),
      data: { duration, expiresAt: now + duration },
    });
  }

  /**
   * Unblock a key
   */
  async unblock(key: string): Promise<void> {
    const entry = await this.store.get(key);
    if (entry) {
      entry.blocked = false;
      entry.blockExpiry = undefined;
      await this.store.set(key, entry);
    }

    this.logger.info('Key unblocked', { key });

    await this.emitEvent({
      type: RateLimitEventType.KEY_UNBLOCKED,
      key,
      timestamp: new Date(),
    });
  }

  /**
   * Check if a key is blocked
   */
  async isBlocked(key: string): Promise<boolean> {
    const entry = await this.store.get(key);
    if (!entry || !entry.blocked) {
      return false;
    }

    // Check if block has expired
    if (entry.blockExpiry && entry.blockExpiry < Date.now()) {
      await this.unblock(key);
      return false;
    }

    return true;
  }

  /**
   * Get current state for a key
   */
  async getState(key: string): Promise<RateLimitEntry | null> {
    return this.store.get(key);
  }

  /**
   * Get rate limit statistics
   */
  async getStats(): Promise<RateLimitStats> {
    const keys = await this.store.keys();
    const uniqueKeys = keys.length;

    // Get top limited keys (simple approximation)
    const topLimitedKeys: Array<{ key: string; count: number }> = [];
    for (const key of keys.slice(0, 100)) {
      const entry = await this.store.get(key);
      if (entry && entry.count > this.config.max * 0.8) {
        topLimitedKeys.push({ key, count: entry.count });
      }
    }
    topLimitedKeys.sort((a, b) => b.count - a.count);

    return {
      totalRequests: this.stats.totalRequests,
      allowedRequests: this.stats.allowedRequests,
      limitedRequests: this.stats.limitedRequests,
      blockedRequests: this.stats.blockedRequests,
      uniqueKeys,
      averageRequestsPerKey: uniqueKeys > 0 ? this.stats.totalRequests / uniqueKeys : 0,
      topLimitedKeys: topLimitedKeys.slice(0, 10),
    };
  }

  /**
   * Clear all rate limit data
   */
  async clear(): Promise<void> {
    await this.store.clear();
    this.stats.totalRequests = 0;
    this.stats.allowedRequests = 0;
    this.stats.limitedRequests = 0;
    this.stats.blockedRequests = 0;
    this.logger.info('Rate limit data cleared');
  }

  /**
   * Get rate limit headers for response
   */
  getHeaders(result: RateLimitResult): RateLimitHeaders {
    const headers: RateLimitHeaders = {
      'X-RateLimit-Limit': String(result.limit),
      'X-RateLimit-Remaining': String(result.remaining),
      'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    };

    if (!result.allowed && result.retryAfter) {
      headers['Retry-After'] = String(Math.ceil(result.retryAfter / 1000));
    }

    return headers;
  }

  /**
   * Register event handler
   */
  on(eventType: RateLimitEventType, handler: RateLimitEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * Remove event handler
   */
  off(eventType: RateLimitEventType, handler: RateLimitEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Apply rate limiting algorithm
   */
  private async applyAlgorithm(key: string): Promise<RateLimitResult> {
    switch (this.config.algorithm) {
      case RateLimitAlgorithm.FIXED_WINDOW:
        return this.fixedWindow(key);
      case RateLimitAlgorithm.SLIDING_WINDOW_LOG:
        return this.slidingWindowLog(key);
      case RateLimitAlgorithm.SLIDING_WINDOW_COUNTER:
        return this.slidingWindowCounter(key);
      case RateLimitAlgorithm.TOKEN_BUCKET:
        return this.tokenBucket(key);
      case RateLimitAlgorithm.LEAKY_BUCKET:
        return this.leakyBucket(key);
      default:
        return this.slidingWindowCounter(key);
    }
  }

  /**
   * Fixed Window algorithm
   */
  private async fixedWindow(key: string): Promise<RateLimitResult> {
    const windowMs = parseTimeWindow(this.config.window);
    const now = Date.now();

    let entry = await this.store.get(key);

    if (!entry || entry.windowEnd < now) {
      // Start new window
      entry = {
        key,
        count: 1,
        windowStart: now,
        windowEnd: now + windowMs,
        lastRequest: now,
      };
      await this.store.set(key, entry, windowMs);
      return this.createResult(entry, true);
    }

    // Increment in current window
    entry.count++;
    entry.lastRequest = now;
    await this.store.set(key, entry, entry.windowEnd - now);

    const allowed = entry.count <= this.config.max;
    return this.createResult(entry, allowed);
  }

  /**
   * Sliding Window Log algorithm
   */
  private async slidingWindowLog(key: string): Promise<RateLimitResult> {
    const windowMs = parseTimeWindow(this.config.window);
    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = await this.store.get(key);

    if (!entry) {
      entry = {
        key,
        count: 1,
        windowStart: now,
        windowEnd: now + windowMs,
        lastRequest: now,
        timestamps: [now],
      };
      await this.store.set(key, entry, windowMs);
      return this.createResult(entry, true);
    }

    // Filter timestamps within window
    const timestamps = (entry.timestamps || []).filter((ts) => ts > windowStart);
    timestamps.push(now);

    entry.timestamps = timestamps;
    entry.count = timestamps.length;
    entry.lastRequest = now;
    entry.windowStart = windowStart;
    entry.windowEnd = now + windowMs;

    await this.store.set(key, entry, windowMs);

    const allowed = entry.count <= this.config.max;
    return this.createResult(entry, allowed);
  }

  /**
   * Sliding Window Counter algorithm
   */
  private async slidingWindowCounter(key: string): Promise<RateLimitResult> {
    const windowMs = parseTimeWindow(this.config.window);
    const now = Date.now();

    let entry = await this.store.get(key);
    const currentWindowKey = `${key}:${Math.floor(now / windowMs)}`;
    const previousWindowKey = `${key}:${Math.floor(now / windowMs) - 1}`;

    // Get current and previous window counts
    const currentEntry = await this.store.get(currentWindowKey);
    const previousEntry = await this.store.get(previousWindowKey);

    const currentCount = currentEntry?.count || 0;
    const previousCount = previousEntry?.count || 0;

    // Calculate weighted count
    const windowPosition = (now % windowMs) / windowMs;
    const weightedCount = previousCount * (1 - windowPosition) + currentCount;

    // Check if would exceed limit
    const newCount = weightedCount + 1;
    const allowed = newCount <= this.config.max;

    if (allowed) {
      // Increment current window
      if (!currentEntry) {
        await this.store.set(currentWindowKey, {
          key: currentWindowKey,
          count: 1,
          windowStart: Math.floor(now / windowMs) * windowMs,
          windowEnd: (Math.floor(now / windowMs) + 1) * windowMs,
          lastRequest: now,
        }, windowMs * 2);
      } else {
        currentEntry.count++;
        currentEntry.lastRequest = now;
        await this.store.set(currentWindowKey, currentEntry, windowMs * 2);
      }
    }

    // Create result entry for response
    entry = {
      key,
      count: Math.ceil(newCount),
      windowStart: now - windowMs,
      windowEnd: now,
      lastRequest: now,
    };

    return this.createResult(entry, allowed);
  }

  /**
   * Token Bucket algorithm
   */
  private async tokenBucket(key: string): Promise<RateLimitResult> {
    const windowMs = parseTimeWindow(this.config.window);
    const now = Date.now();
    const capacity = this.config.max;
    const refillRate = capacity / (windowMs / 1000); // tokens per second

    let entry = await this.store.get(key);

    if (!entry) {
      // New bucket with capacity - 1 tokens (consuming one for this request)
      entry = {
        key,
        count: 1,
        windowStart: now,
        windowEnd: now + windowMs,
        lastRequest: now,
        tokens: capacity - 1,
        lastRefill: now,
      };
      await this.store.set(key, entry, windowMs);
      return this.createResult(entry, true);
    }

    // Calculate tokens to add based on time elapsed
    const elapsed = (now - (entry.lastRefill || now)) / 1000;
    const tokensToAdd = elapsed * refillRate;
    entry.tokens = Math.min(capacity, (entry.tokens || 0) + tokensToAdd);
    entry.lastRefill = now;

    // Try to consume a token
    const cost = this.config.pointsCost || 1;
    if (entry.tokens >= cost) {
      entry.tokens -= cost;
      entry.count++;
      entry.lastRequest = now;
      await this.store.set(key, entry, windowMs);
      return this.createResult(entry, true);
    }

    // Not enough tokens
    entry.count++;
    entry.lastRequest = now;
    await this.store.set(key, entry, windowMs);

    const result = this.createResult(entry, false);
    // Calculate retry after based on when enough tokens will be available
    result.retryAfter = Math.ceil((cost - entry.tokens) / refillRate * 1000);
    return result;
  }

  /**
   * Leaky Bucket algorithm
   */
  private async leakyBucket(key: string): Promise<RateLimitResult> {
    const windowMs = parseTimeWindow(this.config.window);
    const now = Date.now();
    const capacity = this.config.max;
    const leakRate = capacity / (windowMs / 1000); // requests per second

    let entry = await this.store.get(key);

    if (!entry) {
      entry = {
        key,
        count: 1,
        windowStart: now,
        windowEnd: now + windowMs,
        lastRequest: now,
        queueSize: 1,
        lastLeak: now,
      };
      await this.store.set(key, entry, windowMs);
      return this.createResult(entry, true);
    }

    // Calculate how many requests have "leaked" (processed)
    const elapsed = (now - (entry.lastLeak || now)) / 1000;
    const leaked = elapsed * leakRate;
    entry.queueSize = Math.max(0, (entry.queueSize || 0) - leaked);
    entry.lastLeak = now;

    // Try to add to queue
    if (entry.queueSize < capacity) {
      entry.queueSize++;
      entry.count++;
      entry.lastRequest = now;
      await this.store.set(key, entry, windowMs);
      return this.createResult(entry, true);
    }

    // Queue is full
    entry.count++;
    entry.lastRequest = now;
    await this.store.set(key, entry, windowMs);

    const result = this.createResult(entry, false);
    result.retryAfter = Math.ceil(1 / leakRate * 1000); // Time for one slot to free up
    return result;
  }

  /**
   * Create result from entry
   */
  private createResult(entry: RateLimitEntry, allowed: boolean): RateLimitResult {
    const now = Date.now();
    return {
      allowed,
      current: entry.count,
      limit: this.config.max,
      remaining: Math.max(0, this.config.max - entry.count),
      resetIn: Math.max(0, entry.windowEnd - now),
      resetAt: entry.windowEnd,
      status: allowed ? RateLimitStatus.ALLOWED : RateLimitStatus.LIMITED,
      key: entry.key,
    };
  }

  /**
   * Create allowed result (for skipped/whitelisted)
   */
  private createAllowedResult(key: string): RateLimitResult {
    const windowMs = parseTimeWindow(this.config.window);
    const now = Date.now();
    return {
      allowed: true,
      current: 0,
      limit: this.config.max,
      remaining: this.config.max,
      resetIn: windowMs,
      resetAt: now + windowMs,
      status: RateLimitStatus.ALLOWED,
      key,
    };
  }

  /**
   * Create blocked result
   */
  private createBlockedResult(key: string, reason: string, blockExpiry?: number): RateLimitResult {
    const now = Date.now();
    const retryAfter = blockExpiry ? Math.max(0, blockExpiry - now) : this.config.blockDuration || 60000;
    return {
      allowed: false,
      current: this.config.max + 1,
      limit: this.config.max,
      remaining: 0,
      resetIn: retryAfter,
      resetAt: now + retryAfter,
      retryAfter,
      status: RateLimitStatus.BLOCKED,
      key,
      metadata: { reason },
    };
  }

  /**
   * Default key generator
   */
  private defaultKeyGenerator(request: RateLimitRequest): string {
    switch (this.config.keyType) {
      case RateLimitKeyType.IP:
        return `ip:${request.ip}`;
      case RateLimitKeyType.USER:
        return `user:${request.userId || 'anonymous'}`;
      case RateLimitKeyType.API_KEY:
        return `apikey:${request.apiKey || 'none'}`;
      case RateLimitKeyType.GLOBAL:
        return 'global';
      case RateLimitKeyType.CUSTOM:
        return `custom:${request.ip}:${request.userId || ''}`;
      default:
        return `ip:${request.ip}`;
    }
  }

  /**
   * Emit event to handlers
   */
  private async emitEvent(event: RateLimitEvent): Promise<void> {
    const handlers = this.eventHandlers.get(event.type) || [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Event handler error', { eventType: event.type, error });
      }
    }
  }
}

/**
 * Factory function to create rate limiter
 */
export function createRateLimiter(
  config?: Partial<RateLimitConfig>,
  store?: IRateLimitStore
): IRateLimiter {
  return new RateLimiter(config, store);
}
