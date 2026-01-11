/**
 * Error Handling Middleware
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/middleware/error
 */

import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import type { ApiResponse, ApiError, ApiErrorDetail } from '../interfaces/api.interface.js';
import { API_ERROR_CODES, ApiStatusCode } from '../interfaces/api.interface.js';

/**
 * Custom API Error class
 */
export class ApiException extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(
    message: string,
    statusCode: number = ApiStatusCode.INTERNAL_ERROR,
    code: string = API_ERROR_CODES.INTERNAL_ERROR,
    details?: ApiErrorDetail[]
  ) {
    super(message);
    this.name = 'ApiException';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Not Found Error
 */
export class NotFoundException extends ApiException {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(message, ApiStatusCode.NOT_FOUND, API_ERROR_CODES.NOT_FOUND);
  }
}

/**
 * Validation Error
 */
export class ValidationException extends ApiException {
  constructor(details: ApiErrorDetail[]) {
    super('Validation failed', ApiStatusCode.VALIDATION_ERROR, API_ERROR_CODES.VALIDATION_FAILED, details);
  }
}

/**
 * Conflict Error
 */
export class ConflictException extends ApiException {
  constructor(message: string) {
    super(message, ApiStatusCode.CONFLICT, API_ERROR_CODES.CONFLICT);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedException extends ApiException {
  constructor(message: string = 'Authentication required') {
    super(message, ApiStatusCode.UNAUTHORIZED, API_ERROR_CODES.UNAUTHORIZED);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenException extends ApiException {
  constructor(message: string = 'Access denied') {
    super(message, ApiStatusCode.FORBIDDEN, API_ERROR_CODES.FORBIDDEN);
  }
}

/**
 * Map error to API response
 */
export function mapErrorToResponse(
  error: Error | FastifyError,
  requestId: string,
  includeStack = false
): { statusCode: number; response: ApiResponse } {
  let statusCode = ApiStatusCode.INTERNAL_ERROR;
  let apiError: ApiError;

  if (error instanceof ApiException) {
    statusCode = error.statusCode;
    apiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      stack: includeStack ? error.stack : undefined,
    };
  } else if ('statusCode' in error && typeof error.statusCode === 'number') {
    // Fastify error
    statusCode = error.statusCode;

    // Determine error code - use VALIDATION_FAILED for validation errors
    const fastifyErrorCode = (error as Error & { code?: string }).code;
    const isValidationError = ('validation' in error && error.validation) ||
      fastifyErrorCode === 'FST_ERR_VALIDATION';
    const errorCode = isValidationError
      ? API_ERROR_CODES.VALIDATION_FAILED
      : fastifyErrorCode || API_ERROR_CODES.INTERNAL_ERROR;

    apiError = {
      code: errorCode,
      message: error.message,
      details:
        ('validation' in error && error.validation)
          ? (error.validation as Array<{ params?: { missingProperty?: string }; instancePath?: string; message?: string; keyword?: string }>).map(
              (v) => ({
                field: v.params?.missingProperty || v.instancePath || 'unknown',
                message: v.message || 'Validation failed',
                code: v.keyword,
              })
            )
          : undefined,
      stack: includeStack ? error.stack : undefined,
    };
  } else {
    apiError = {
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: error.message || 'An unexpected error occurred',
      stack: includeStack ? error.stack : undefined,
    };
  }

  return {
    statusCode,
    response: {
      success: false,
      error: apiError,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    },
  };
}

/**
 * Global error handler
 */
export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiResponse> {
  const includeStack = process.env.NODE_ENV !== 'production';
  const { statusCode, response } = mapErrorToResponse(error, request.id as string, includeStack);

  return reply.status(statusCode).send(response);
}

/**
 * Not found handler
 */
export async function notFoundHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      code: API_ERROR_CODES.NOT_FOUND,
      message: `Route ${request.method} ${request.url} not found`,
    },
    meta: {
      requestId: request.id as string,
      timestamp: new Date().toISOString(),
    },
  };

  return reply.status(ApiStatusCode.NOT_FOUND).send(response);
}
