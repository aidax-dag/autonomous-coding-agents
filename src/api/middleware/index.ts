/**
 * API Middleware Module
 *
 * @module api/middleware
 */

export { RequestLogger, createRequestLogger } from './request-logger';
export { installErrorHandler, type APIErrorResponse } from './error-handler';
export { installAuthMiddleware, type AuthMiddlewareConfig } from './auth';
export { installRateLimiter, type RateLimitConfig } from './rate-limit';
export { CORSMiddleware, createCORSMiddleware, type CORSOptions } from './cors';
export { createValidatedRoute } from './validate';
export { RateLimiter, createRateLimiter, type RateLimitOptions, type EndpointLimit } from './rate-limiter';
