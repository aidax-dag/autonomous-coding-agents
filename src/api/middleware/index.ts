/**
 * API Middleware Module
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/middleware
 */

// Error middleware
export {
  ApiException,
  NotFoundException,
  ValidationException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  mapErrorToResponse,
  errorHandler,
  notFoundHandler,
} from './error.middleware.js';

// Validation middleware
export {
  validators,
  createValidationMiddleware,
  validateUuidParam,
  type ValidationRule,
  type ValidationSchema,
} from './validation.middleware.js';

// Logging middleware
export {
  createRequestLogger,
  createResponseLogger,
  createPerformanceTracker,
  getElapsedTime,
  type RequestLoggerConfig,
} from './logging.middleware.js';
