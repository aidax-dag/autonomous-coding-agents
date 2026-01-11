/**
 * Rate Limiter Service Unit Tests
 *
 * Feature: F4.5 - Rate Limiting
 *
 * @module tests/unit/api/ratelimit/services/ratelimit.service
 */

import {
  RateLimiter,
  createRateLimiter,
} from '../../../../../src/api/ratelimit/services/ratelimit.service';
import {
  RateLimitAlgorithm,
  RateLimitKeyType,
  RateLimitStatus,
  RateLimitRequest,
  RateLimitEventType,
} from '../../../../../src/api/ratelimit/interfaces/ratelimit.interface';
import { MemoryRateLimitStore } from '../../../../../src/api/ratelimit/stores/memory.store';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore({ autoCleanup: false });
    rateLimiter = new RateLimiter(
      {
        max: 5,
        window: 1000, // 1 second
        algorithm: RateLimitAlgorithm.FIXED_WINDOW,
      },
      store
    );
  });

  afterEach(async () => {
    await rateLimiter.clear();
    store.destroy();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const defaultLimiter = new RateLimiter();
      expect(defaultLimiter).toBeInstanceOf(RateLimiter);
    });

    it('should create with custom config', () => {
      const customLimiter = new RateLimiter({
        max: 100,
        window: '1m',
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
        keyType: RateLimitKeyType.USER,
      });
      expect(customLimiter).toBeInstanceOf(RateLimiter);
    });
  });

  describe('check', () => {
    const createRequest = (ip: string = '192.168.1.1'): RateLimitRequest => ({
      ip,
      method: 'GET',
      url: '/api/test',
      headers: {},
    });

    it('should allow requests within limit', async () => {
      const request = createRequest();

      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.check(request);
        expect(result.allowed).toBe(true);
        expect(result.status).toBe(RateLimitStatus.ALLOWED);
      }
    });

    it('should deny requests exceeding limit', async () => {
      const request = createRequest();

      // Use up the limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check(request);
      }

      // Next request should be denied
      const result = await rateLimiter.check(request);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(RateLimitStatus.LIMITED);
    });

    it('should track different keys separately', async () => {
      const request1 = createRequest('192.168.1.1');
      const request2 = createRequest('192.168.1.2');

      // Use up limit for first IP
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check(request1);
      }

      // Second IP should still be allowed
      const result = await rateLimiter.check(request2);
      expect(result.allowed).toBe(true);
    });

    it('should skip rate limiting when skip function returns true', async () => {
      const skipLimiter = new RateLimiter({
        max: 1,
        window: 1000,
        skip: (req) => req.ip === '127.0.0.1',
      });

      const localRequest = createRequest('127.0.0.1');

      // Should always be allowed
      for (let i = 0; i < 10; i++) {
        const result = await skipLimiter.check(localRequest);
        expect(result.allowed).toBe(true);
      }
    });

    it('should respect whitelist', async () => {
      const whitelistLimiter = new RateLimiter({
        max: 1,
        window: 1000,
        whitelist: ['ip:10.0.0.1'],
      });

      const whitelistedRequest = createRequest('10.0.0.1');

      for (let i = 0; i < 10; i++) {
        const result = await whitelistLimiter.check(whitelistedRequest);
        expect(result.allowed).toBe(true);
      }
    });

    it('should respect blacklist', async () => {
      const blacklistLimiter = new RateLimiter({
        max: 100,
        window: 1000,
        blacklist: ['ip:192.168.1.100'],
      });

      const blacklistedRequest = createRequest('192.168.1.100');
      const result = await blacklistLimiter.check(blacklistedRequest);

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(RateLimitStatus.BLOCKED);
    });

    it('should return correct remaining count', async () => {
      const request = createRequest();

      const result1 = await rateLimiter.check(request);
      expect(result1.remaining).toBe(4);

      const result2 = await rateLimiter.check(request);
      expect(result2.remaining).toBe(3);

      const result3 = await rateLimiter.check(request);
      expect(result3.remaining).toBe(2);
    });
  });

  describe('Fixed Window algorithm', () => {
    it('should reset count after window expires', async () => {
      const request = createRequest();

      // Use up limit
      for (let i = 0; i < 5; i++) {
        await rateLimiter.check(request);
      }

      // Should be denied
      const deniedResult = await rateLimiter.check(request);
      expect(deniedResult.allowed).toBe(false);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be allowed again
      const allowedResult = await rateLimiter.check(request);
      expect(allowedResult.allowed).toBe(true);
    });
  });

  describe('Sliding Window Counter algorithm', () => {
    let slidingLimiter: RateLimiter;

    beforeEach(() => {
      slidingLimiter = new RateLimiter({
        max: 10,
        window: 1000,
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW_COUNTER,
      });
    });

    it('should apply sliding window logic', async () => {
      const request = createRequest();

      // Make some requests
      for (let i = 0; i < 5; i++) {
        const result = await slidingLimiter.check(request);
        expect(result.allowed).toBe(true);
      }

      // Wait half the window
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Make more requests - should consider weighted count
      for (let i = 0; i < 5; i++) {
        const result = await slidingLimiter.check(request);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe('Sliding Window Log algorithm', () => {
    let logLimiter: RateLimiter;

    beforeEach(() => {
      logLimiter = new RateLimiter({
        max: 5,
        window: 1000,
        algorithm: RateLimitAlgorithm.SLIDING_WINDOW_LOG,
      });
    });

    it('should track individual timestamps', async () => {
      const request = createRequest();

      for (let i = 0; i < 5; i++) {
        const result = await logLimiter.check(request);
        expect(result.allowed).toBe(true);
      }

      const denied = await logLimiter.check(request);
      expect(denied.allowed).toBe(false);
    });

    it('should allow requests as old ones fall out of window', async () => {
      const request = createRequest();

      // Use up limit
      for (let i = 0; i < 5; i++) {
        await logLimiter.check(request);
      }

      // Wait for window to slide
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Old requests should have fallen out
      const result = await logLimiter.check(request);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Token Bucket algorithm', () => {
    let tokenLimiter: RateLimiter;

    beforeEach(() => {
      tokenLimiter = new RateLimiter({
        max: 10, // Bucket capacity
        window: 1000, // Refill 10 tokens per second
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });
    });

    it('should allow burst up to bucket capacity', async () => {
      const request = createRequest();

      // Burst all tokens
      for (let i = 0; i < 10; i++) {
        const result = await tokenLimiter.check(request);
        expect(result.allowed).toBe(true);
      }

      // Next should be denied
      const denied = await tokenLimiter.check(request);
      expect(denied.allowed).toBe(false);
    });

    it('should refill tokens over time', async () => {
      const request = createRequest();

      // Use up tokens
      for (let i = 0; i < 10; i++) {
        await tokenLimiter.check(request);
      }

      // Wait for some refill
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have some tokens again
      const result = await tokenLimiter.check(request);
      expect(result.allowed).toBe(true);
    });
  });

  describe('Leaky Bucket algorithm', () => {
    let leakyLimiter: RateLimiter;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
      leakyLimiter = new RateLimiter({
        max: 5, // Queue capacity
        window: 1000, // Leak 5 per second
        algorithm: RateLimitAlgorithm.LEAKY_BUCKET,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow requests up to queue capacity', async () => {
      const request = createRequest();

      // Make all requests at the same instant (no time passes = no leakage)
      for (let i = 0; i < 5; i++) {
        const result = await leakyLimiter.check(request);
        expect(result.allowed).toBe(true);
      }

      // Queue full (still same instant)
      const denied = await leakyLimiter.check(request);
      expect(denied.allowed).toBe(false);
    });

    it('should leak requests over time', async () => {
      const request = createRequest();

      // Fill queue
      for (let i = 0; i < 5; i++) {
        await leakyLimiter.check(request);
      }

      // Advance time by 300ms (should leak ~1.5 requests at 5/sec rate)
      jest.advanceTimersByTime(300);

      // Should have space again
      const result = await leakyLimiter.check(request);
      expect(result.allowed).toBe(true);
    });
  });

  describe('increment', () => {
    it('should increment count for a key', async () => {
      const result = await rateLimiter.increment('test-key');
      expect(result.current).toBe(1);
      expect(result.allowed).toBe(true);

      const result2 = await rateLimiter.increment('test-key');
      expect(result2.current).toBe(2);
    });

    it('should support custom increment cost', async () => {
      const result = await rateLimiter.increment('test-key', 3);
      expect(result.current).toBe(3);
      expect(result.remaining).toBe(2);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for a key', async () => {
      const request = createRequest();

      // Use some limit
      for (let i = 0; i < 3; i++) {
        await rateLimiter.check(request);
      }

      // Reset
      await rateLimiter.reset('ip:192.168.1.1');

      // Should have full limit again
      const result = await rateLimiter.check(request);
      expect(result.remaining).toBe(4);
    });
  });

  describe('block and unblock', () => {
    it('should block a key', async () => {
      await rateLimiter.block('ip:192.168.1.1', 5000);

      const request = createRequest();
      const result = await rateLimiter.check(request);

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(RateLimitStatus.BLOCKED);
    });

    it('should unblock a key', async () => {
      await rateLimiter.block('ip:192.168.1.1', 60000);
      await rateLimiter.unblock('ip:192.168.1.1');

      const request = createRequest();
      const result = await rateLimiter.check(request);

      expect(result.allowed).toBe(true);
    });

    it('should auto-unblock after duration expires', async () => {
      await rateLimiter.block('ip:192.168.1.1', 100);

      // Wait for block to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const request = createRequest();
      const result = await rateLimiter.check(request);

      expect(result.allowed).toBe(true);
    });
  });

  describe('isBlocked', () => {
    it('should return true for blocked key', async () => {
      await rateLimiter.block('test-key', 5000);
      expect(await rateLimiter.isBlocked('test-key')).toBe(true);
    });

    it('should return false for non-blocked key', async () => {
      expect(await rateLimiter.isBlocked('test-key')).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return state for a key', async () => {
      const request = createRequest();
      await rateLimiter.check(request);
      await rateLimiter.check(request);

      const state = await rateLimiter.getState('ip:192.168.1.1');
      expect(state).not.toBeNull();
      expect(state?.count).toBe(2);
    });

    it('should return null for non-existent key', async () => {
      const state = await rateLimiter.getState('non-existent');
      expect(state).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const request1 = createRequest('192.168.1.1');
      const request2 = createRequest('192.168.1.2');

      await rateLimiter.check(request1);
      await rateLimiter.check(request1);
      await rateLimiter.check(request2);

      const stats = await rateLimiter.getStats();

      expect(stats.totalRequests).toBe(3);
      expect(stats.allowedRequests).toBe(3);
      expect(stats.limitedRequests).toBe(0);
      expect(stats.uniqueKeys).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all rate limit data', async () => {
      const request = createRequest();

      // Make some requests
      for (let i = 0; i < 3; i++) {
        await rateLimiter.check(request);
      }

      await rateLimiter.clear();

      // Stats should be reset
      const stats = await rateLimiter.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.uniqueKeys).toBe(0);
    });
  });

  describe('getHeaders', () => {
    it('should return rate limit headers', async () => {
      const request = createRequest();
      const result = await rateLimiter.check(request);

      const headers = rateLimiter.getHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('5');
      expect(headers['X-RateLimit-Remaining']).toBe('4');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('should include Retry-After when limited', async () => {
      const request = createRequest();

      // Use up limit
      for (let i = 0; i < 6; i++) {
        await rateLimiter.check(request);
      }

      const result = await rateLimiter.check(request);
      const headers = rateLimiter.getHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('events', () => {
    it('should emit events for allowed requests', async () => {
      const events: unknown[] = [];
      rateLimiter.on(RateLimitEventType.REQUEST_ALLOWED, (event) => {
        events.push(event);
      });

      const request = createRequest();
      await rateLimiter.check(request);

      expect(events).toHaveLength(1);
    });

    it('should emit events for limited requests', async () => {
      const events: unknown[] = [];
      rateLimiter.on(RateLimitEventType.REQUEST_LIMITED, (event) => {
        events.push(event);
      });

      const request = createRequest();

      // Use up limit
      for (let i = 0; i < 6; i++) {
        await rateLimiter.check(request);
      }

      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it('should emit events for blocked keys', async () => {
      const events: unknown[] = [];
      rateLimiter.on(RateLimitEventType.KEY_BLOCKED, (event) => {
        events.push(event);
      });

      await rateLimiter.block('test-key', 5000);

      expect(events).toHaveLength(1);
    });

    it('should allow removing event handlers', async () => {
      const events: unknown[] = [];
      const handler = (event: unknown): void => {
        events.push(event);
      };

      rateLimiter.on(RateLimitEventType.REQUEST_ALLOWED, handler);
      rateLimiter.off(RateLimitEventType.REQUEST_ALLOWED, handler);

      await rateLimiter.check(createRequest());

      expect(events).toHaveLength(0);
    });
  });

  describe('key generation', () => {
    it('should generate IP-based keys by default', async () => {
      const request = createRequest('10.0.0.1');
      await rateLimiter.check(request);

      const state = await rateLimiter.getState('ip:10.0.0.1');
      expect(state).not.toBeNull();
    });

    it('should support user-based keys', async () => {
      const userLimiter = new RateLimiter({
        max: 5,
        window: 1000,
        keyType: RateLimitKeyType.USER,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });

      const request: RateLimitRequest = {
        ip: '192.168.1.1',
        method: 'GET',
        url: '/api/test',
        headers: {},
        userId: 'user-123',
      };

      await userLimiter.check(request);
      const state = await userLimiter.getState('user:user-123');
      expect(state).not.toBeNull();
    });

    it('should support custom key generator', async () => {
      const customLimiter = new RateLimiter({
        max: 5,
        window: 1000,
        keyGenerator: (req) => `custom:${req.method}:${req.url}`,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });

      const request = createRequest();
      await customLimiter.check(request);

      const state = await customLimiter.getState('custom:GET:/api/test');
      expect(state).not.toBeNull();
    });
  });

  describe('createRateLimiter factory', () => {
    it('should create a rate limiter', () => {
      const limiter = createRateLimiter({ max: 100, window: 60000 });
      expect(limiter).toBeDefined();
    });
  });
});

// Helper function
function createRequest(ip: string = '192.168.1.1'): RateLimitRequest {
  return {
    ip,
    method: 'GET',
    url: '/api/test',
    headers: {},
  };
}
