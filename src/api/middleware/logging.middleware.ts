/**
 * Logging Middleware
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/middleware/logging
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ILogger, createLogger } from '../../core/services/logger.js';

/**
 * Request logger configuration
 */
export interface RequestLoggerConfig {
  logger?: ILogger;
  logBody?: boolean;
  logQuery?: boolean;
  logHeaders?: boolean;
  excludePaths?: string[];
  redactFields?: string[];
}

/**
 * Redact sensitive fields from object
 */
function redactSensitiveFields(
  obj: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  const result = { ...obj };

  for (const field of fields) {
    if (field.includes('.')) {
      // Handle nested fields
      const parts = field.split('.');
      let current: Record<string, unknown> = result;

      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] && typeof current[parts[i]] === 'object') {
          current[parts[i]] = { ...(current[parts[i]] as Record<string, unknown>) };
          current = current[parts[i]] as Record<string, unknown>;
        } else {
          break;
        }
      }

      const lastPart = parts[parts.length - 1];
      if (current[lastPart] !== undefined) {
        current[lastPart] = '[REDACTED]';
      }
    } else if (result[field] !== undefined) {
      result[field] = '[REDACTED]';
    }
  }

  return result;
}

/**
 * Create request logging middleware
 */
export function createRequestLogger(config: RequestLoggerConfig = {}) {
  const logger = config.logger || createLogger('RequestLogger');
  const {
    logBody = false,
    logQuery = true,
    logHeaders = false,
    excludePaths = ['/health', '/metrics'],
    redactFields = ['password', 'apiKey', 'token', 'authorization', 'secret'],
  } = config;

  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Skip excluded paths
    if (excludePaths.some((path) => request.url.startsWith(path))) {
      return;
    }

    const logContext: Record<string, unknown> = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    if (logQuery && request.query && Object.keys(request.query).length > 0) {
      logContext.query = redactSensitiveFields(
        request.query as Record<string, unknown>,
        redactFields
      );
    }

    if (logBody && request.body && Object.keys(request.body).length > 0) {
      logContext.body = redactSensitiveFields(
        request.body as Record<string, unknown>,
        redactFields
      );
    }

    if (logHeaders) {
      const headers = { ...request.headers };
      for (const field of redactFields) {
        if (headers[field.toLowerCase()]) {
          headers[field.toLowerCase()] = '[REDACTED]';
        }
      }
      logContext.headers = headers;
    }

    logger.info('Incoming request', logContext);
  };
}

/**
 * Create response logging hook
 */
export function createResponseLogger(config: RequestLoggerConfig = {}) {
  const logger = config.logger || createLogger('ResponseLogger');
  const { excludePaths = ['/health', '/metrics'] } = config;

  return async (
    request: FastifyRequest,
    reply: FastifyReply,
    _payload: unknown
  ): Promise<void> => {
    // Skip excluded paths
    if (excludePaths.some((path) => request.url.startsWith(path))) {
      return;
    }

    const responseTime = reply.elapsedTime;

    logger.info('Response sent', {
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: `${responseTime.toFixed(2)}ms`,
    });
  };
}

/**
 * Performance tracking middleware
 */
export function createPerformanceTracker() {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    // Store start time for performance tracking
    (request as FastifyRequest & { startTime: bigint }).startTime = process.hrtime.bigint();
  };
}

/**
 * Get elapsed time from request start
 */
export function getElapsedTime(request: FastifyRequest): number {
  const startTime = (request as FastifyRequest & { startTime?: bigint }).startTime;
  if (!startTime) return 0;

  const elapsed = process.hrtime.bigint() - startTime;
  return Number(elapsed) / 1e6; // Convert to milliseconds
}
