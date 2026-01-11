/**
 * Rate Limiting Middleware Unit Tests
 *
 * Feature: F4.5 - Rate Limiting
 *
 * @module tests/unit/api/ratelimit/middlewares/ratelimit.middleware
 */

import {
  createRateLimitMiddleware,
  createRateLimitGuard,
  rateLimit,
  rateLimitPresets,
} from '../../../../../src/api/ratelimit/middlewares/ratelimit.middleware';
import { RateLimiter } from '../../../../../src/api/ratelimit/services/ratelimit.service';
import {
  RateLimitAlgorithm,
  RateLimitStatus,
} from '../../../../../src/api/ratelimit/interfaces/ratelimit.interface';

// Mock Fastify request and reply
function createMockRequest(overrides: Record<string, unknown> = {}): unknown {
  return {
    ip: '192.168.1.1',
    method: 'GET',
    url: '/api/test',
    headers: {},
    ...overrides,
  };
}

interface MockReply {
  status: jest.Mock;
  send: jest.Mock;
  header: jest.Mock;
  getHeaders: () => Record<string, string>;
}

function createMockReply(): MockReply {
  const headers: Record<string, string> = {};
  const reply: MockReply = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    header: jest.fn((name: string, value: string) => {
      headers[name] = value;
      return reply;
    }),
    getHeaders: () => headers,
  };
  return reply;
}

describe('RateLimitMiddleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRateLimitMiddleware', () => {
    it('should create middleware function', () => {
      const middleware = createRateLimitMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('should allow requests within limit', async () => {
      const middleware = createRateLimitMiddleware({
        config: { max: 5, window: 1000 },
      });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply() as unknown as Record<string, unknown>;

      await callMiddleware(middleware, request, reply);

      expect(reply.status).not.toHaveBeenCalled();
      expect(request.rateLimit).toBeDefined();
      expect((request.rateLimit as { allowed: boolean }).allowed).toBe(true);
    });

    it('should deny requests exceeding limit', async () => {
      const rateLimiter = new RateLimiter({ max: 2, window: 1000 });
      const middleware = createRateLimitMiddleware({ rateLimiter });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply() as unknown as Record<string, unknown>;

      // Make requests to exceed limit
      await callMiddleware(middleware, request, reply);
      await callMiddleware(middleware, request, reply);
      await callMiddleware(middleware, request, reply);

      expect(reply.status).toHaveBeenCalledWith(429);
      expect(reply.send).toHaveBeenCalled();
    });

    it('should set rate limit headers', async () => {
      const middleware = createRateLimitMiddleware({
        config: { max: 10, window: 1000, headers: true },
      });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply() as { header: jest.Mock; getHeaders: () => Record<string, string> };

      await callMiddleware(middleware, request, reply);

      const headers = reply.getHeaders();
      expect(headers['X-RateLimit-Limit']).toBe('10');
      expect(headers['X-RateLimit-Remaining']).toBe('9');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('should use custom rate limiter', async () => {
      const customLimiter = new RateLimiter({
        max: 3,
        window: 1000,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });

      const middleware = createRateLimitMiddleware({ rateLimiter: customLimiter });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(middleware, request, reply);

      expect((request.rateLimit as { limit: number }).limit).toBe(3);
    });

    it('should attach rate limit result to request', async () => {
      const middleware = createRateLimitMiddleware({
        config: { max: 5, window: 1000 },
      });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(middleware, request, reply);

      expect(request.rateLimit).toBeDefined();
      expect((request.rateLimit as { status: RateLimitStatus }).status).toBe(RateLimitStatus.ALLOWED);
      expect((request.rateLimit as { current: number }).current).toBe(1);
      expect((request.rateLimit as { limit: number }).limit).toBe(5);
      expect((request.rateLimit as { remaining: number }).remaining).toBe(4);
    });

    it('should use custom error response', async () => {
      const customErrorResponse = jest.fn().mockReturnValue({ error: 'Custom error' });
      const rateLimiter = new RateLimiter({ max: 1, window: 1000 });

      const middleware = createRateLimitMiddleware({
        rateLimiter,
        errorResponse: customErrorResponse,
      });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply() as unknown as Record<string, unknown>;

      await callMiddleware(middleware, request, reply);
      await callMiddleware(middleware, request, reply);

      expect(customErrorResponse).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith({ error: 'Custom error' });
    });

    it('should extract IP from x-forwarded-for header', async () => {
      const rateLimiter = new RateLimiter({
        max: 5,
        window: 1000,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });
      const middleware = createRateLimitMiddleware({ rateLimiter });

      const request = createMockRequest({
        ip: '127.0.0.1',
        headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.1' },
      }) as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(middleware, request, reply);

      const state = await rateLimiter.getState('ip:10.0.0.1');
      expect(state).not.toBeNull();
    });

    it('should extract IP from x-real-ip header', async () => {
      const rateLimiter = new RateLimiter({
        max: 5,
        window: 1000,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });
      const middleware = createRateLimitMiddleware({ rateLimiter });

      const request = createMockRequest({
        ip: '127.0.0.1',
        headers: { 'x-real-ip': '192.168.0.100' },
      }) as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(middleware, request, reply);

      const state = await rateLimiter.getState('ip:192.168.0.100');
      expect(state).not.toBeNull();
    });
  });

  describe('createRateLimitGuard', () => {
    it('should create guard function', () => {
      const guard = createRateLimitGuard({ max: 10, window: 1000 });
      expect(typeof guard).toBe('function');
    });

    it('should apply route-specific rate limit', async () => {
      const guard = createRateLimitGuard({ max: 2, window: 1000 });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply() as unknown as Record<string, unknown>;

      await callMiddleware(guard, request, reply);
      await callMiddleware(guard, request, reply);
      await callMiddleware(guard, request, reply);

      expect(reply.status).toHaveBeenCalledWith(429);
    });
  });

  describe('rateLimit helper', () => {
    it('should create rate limit guard', () => {
      const guard = rateLimit({ max: 5, window: 1000 });
      expect(typeof guard).toBe('function');
    });
  });

  describe('rateLimitPresets', () => {
    it('should provide strict preset (10 per minute)', async () => {
      const guard = rateLimitPresets.strict();
      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(guard, request, reply);

      expect((request.rateLimit as { limit: number }).limit).toBe(10);
    });

    it('should provide standard preset (100 per minute)', async () => {
      const guard = rateLimitPresets.standard();
      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(guard, request, reply);

      expect((request.rateLimit as { limit: number }).limit).toBe(100);
    });

    it('should provide relaxed preset (1000 per minute)', async () => {
      const guard = rateLimitPresets.relaxed();
      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(guard, request, reply);

      expect((request.rateLimit as { limit: number }).limit).toBe(1000);
    });

    it('should provide perSecond preset with custom max', async () => {
      const guard = rateLimitPresets.perSecond(20);
      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(guard, request, reply);

      expect((request.rateLimit as { limit: number }).limit).toBe(20);
    });

    it('should provide perHour preset', async () => {
      const guard = rateLimitPresets.perHour(500);
      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(guard, request, reply);

      expect((request.rateLimit as { limit: number }).limit).toBe(500);
    });

    it('should provide perDay preset', async () => {
      const guard = rateLimitPresets.perDay(5000);
      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(guard, request, reply);

      expect((request.rateLimit as { limit: number }).limit).toBe(5000);
    });
  });

  describe('error response format', () => {
    it('should return proper error response when limited', async () => {
      const rateLimiter = new RateLimiter({ max: 1, window: 1000 });
      const middleware = createRateLimitMiddleware({ rateLimiter });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply() as { send: jest.Mock; status: jest.Mock };

      await callMiddleware(middleware, request, reply);
      await callMiddleware(middleware, request, reply);

      expect(reply.status).toHaveBeenCalledWith(429);

      const errorResponse = reply.send.mock.calls[0][0];
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error.code).toBe('RATE_LIMITED');
      expect(errorResponse.error.message).toBeDefined();
      expect(errorResponse.error.details.limit).toBe(1);
    });
  });

  describe('integration with auth context', () => {
    it('should use userId from auth context', async () => {
      const rateLimiter = new RateLimiter({
        max: 5,
        window: 1000,
        keyGenerator: (req) => `user:${req.userId || 'anonymous'}`,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });
      const middleware = createRateLimitMiddleware({ rateLimiter });

      const request = createMockRequest({
        auth: { userId: 'user-456' },
      }) as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(middleware, request, reply);

      const state = await rateLimiter.getState('user:user-456');
      expect(state).not.toBeNull();
    });

    it('should use apiKey from headers', async () => {
      const rateLimiter = new RateLimiter({
        max: 5,
        window: 1000,
        keyGenerator: (req) => `apikey:${req.apiKey || 'none'}`,
        algorithm: RateLimitAlgorithm.TOKEN_BUCKET,
      });
      const middleware = createRateLimitMiddleware({ rateLimiter });

      const request = createMockRequest({
        headers: { 'x-api-key': 'my-api-key-123' },
      }) as Record<string, unknown>;
      const reply = createMockReply();

      await callMiddleware(middleware, request, reply);

      const state = await rateLimiter.getState('apikey:my-api-key-123');
      expect(state).not.toBeNull();
    });
  });

  describe('window reset', () => {
    it('should reset limit after window expires', async () => {
      const rateLimiter = new RateLimiter({ max: 2, window: 100 });
      const middleware = createRateLimitMiddleware({ rateLimiter });

      const request = createMockRequest() as Record<string, unknown>;
      const reply = createMockReply() as unknown as Record<string, unknown>;

      // Use up limit
      await callMiddleware(middleware, request, reply);
      await callMiddleware(middleware, request, reply);

      // Should be denied
      await callMiddleware(middleware, request, reply);
      expect(reply.status).toHaveBeenCalledWith(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Reset mocks
      (reply.status as jest.Mock).mockClear();
      (reply.send as jest.Mock).mockClear();

      // Should be allowed again
      await callMiddleware(middleware, request, reply);
      expect(reply.status).not.toHaveBeenCalled();
    });
  });
});

// Helper to call middleware with type casting
async function callMiddleware(
  middleware: ReturnType<typeof createRateLimitMiddleware>,
  request: unknown,
  reply: unknown
): Promise<void> {
  return (middleware as (req: unknown, reply: unknown) => Promise<void>)(request, reply);
}
