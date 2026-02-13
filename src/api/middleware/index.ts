/**
 * API Middleware Module
 *
 * @module api/middleware
 */

export { RequestLogger, createRequestLogger } from './request-logger';
export { installErrorHandler, type APIErrorResponse } from './error-handler';
export { installAuthMiddleware, type AuthMiddlewareConfig } from './auth';
export { installRateLimiter, type RateLimitConfig } from './rate-limit';
export { installCORS, type CORSConfig } from './cors';
export { createValidatedRoute } from './validate';
