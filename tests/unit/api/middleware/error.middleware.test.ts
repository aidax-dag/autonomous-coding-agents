/**
 * Error Middleware Tests
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module tests/unit/api/middleware/error
 */

import {
  ApiException,
  NotFoundException,
  ValidationException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  mapErrorToResponse,
} from '../../../../src/api/middleware/error.middleware';
import { API_ERROR_CODES, ApiStatusCode } from '../../../../src/api/interfaces/api.interface';

describe('Error Middleware', () => {
  describe('ApiException', () => {
    it('should create exception with defaults', () => {
      const error = new ApiException('Test error');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(ApiStatusCode.INTERNAL_ERROR);
      expect(error.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
      expect(error.details).toBeUndefined();
      expect(error.name).toBe('ApiException');
    });

    it('should create exception with custom values', () => {
      const details = [{ field: 'name', message: 'Required' }];
      const error = new ApiException(
        'Custom error',
        ApiStatusCode.BAD_REQUEST,
        API_ERROR_CODES.INVALID_REQUEST,
        details
      );

      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(ApiStatusCode.BAD_REQUEST);
      expect(error.code).toBe(API_ERROR_CODES.INVALID_REQUEST);
      expect(error.details).toEqual(details);
    });
  });

  describe('NotFoundException', () => {
    it('should create with resource name only', () => {
      const error = new NotFoundException('Agent');

      expect(error.message).toBe('Agent not found');
      expect(error.statusCode).toBe(ApiStatusCode.NOT_FOUND);
      expect(error.code).toBe(API_ERROR_CODES.NOT_FOUND);
    });

    it('should create with resource name and ID', () => {
      const error = new NotFoundException('Agent', 'abc-123');

      expect(error.message).toBe("Agent with ID 'abc-123' not found");
      expect(error.statusCode).toBe(ApiStatusCode.NOT_FOUND);
    });
  });

  describe('ValidationException', () => {
    it('should create with validation details', () => {
      const details = [
        { field: 'name', message: 'Name is required', code: 'REQUIRED' },
        { field: 'email', message: 'Invalid email format', code: 'INVALID_FORMAT' },
      ];
      const error = new ValidationException(details);

      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(ApiStatusCode.VALIDATION_ERROR);
      expect(error.code).toBe(API_ERROR_CODES.VALIDATION_FAILED);
      expect(error.details).toEqual(details);
    });
  });

  describe('ConflictException', () => {
    it('should create with message', () => {
      const error = new ConflictException('Agent already exists');

      expect(error.message).toBe('Agent already exists');
      expect(error.statusCode).toBe(ApiStatusCode.CONFLICT);
      expect(error.code).toBe(API_ERROR_CODES.CONFLICT);
    });
  });

  describe('UnauthorizedException', () => {
    it('should create with default message', () => {
      const error = new UnauthorizedException();

      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(ApiStatusCode.UNAUTHORIZED);
      expect(error.code).toBe(API_ERROR_CODES.UNAUTHORIZED);
    });

    it('should create with custom message', () => {
      const error = new UnauthorizedException('Invalid token');

      expect(error.message).toBe('Invalid token');
    });
  });

  describe('ForbiddenException', () => {
    it('should create with default message', () => {
      const error = new ForbiddenException();

      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(ApiStatusCode.FORBIDDEN);
      expect(error.code).toBe(API_ERROR_CODES.FORBIDDEN);
    });

    it('should create with custom message', () => {
      const error = new ForbiddenException('Insufficient permissions');

      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('mapErrorToResponse', () => {
    it('should map ApiException to response', () => {
      const error = new ApiException('Test error', 400, 'TEST_ERROR');
      const { statusCode, response } = mapErrorToResponse(error, 'req-123');

      expect(statusCode).toBe(400);
      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('TEST_ERROR');
      expect(response.error?.message).toBe('Test error');
      expect(response.meta?.requestId).toBe('req-123');
    });

    it('should map ValidationException with details', () => {
      const details = [{ field: 'name', message: 'Required' }];
      const error = new ValidationException(details);
      const { statusCode, response } = mapErrorToResponse(error, 'req-123');

      expect(statusCode).toBe(ApiStatusCode.VALIDATION_ERROR);
      expect(response.error?.details).toEqual(details);
    });

    it('should map generic Error to response', () => {
      const error = new Error('Generic error');
      const { statusCode, response } = mapErrorToResponse(error, 'req-123');

      expect(statusCode).toBe(ApiStatusCode.INTERNAL_ERROR);
      expect(response.error?.code).toBe(API_ERROR_CODES.INTERNAL_ERROR);
      expect(response.error?.message).toBe('Generic error');
    });

    it('should include stack trace when specified', () => {
      const error = new Error('Test');
      const { response } = mapErrorToResponse(error, 'req-123', true);

      expect(response.error?.stack).toBeDefined();
    });

    it('should exclude stack trace when not specified', () => {
      const error = new Error('Test');
      const { response } = mapErrorToResponse(error, 'req-123', false);

      expect(response.error?.stack).toBeUndefined();
    });

    it('should handle Fastify-style errors', () => {
      const error = {
        statusCode: 400,
        message: 'Bad request',
        code: 'CUSTOM_CODE',
        validation: [
          { instancePath: '/name', message: 'should be string', keyword: 'type' },
        ],
      } as Error & { statusCode: number; code: string; validation: Array<{ instancePath: string; message: string; keyword: string }> };

      const { statusCode, response } = mapErrorToResponse(error, 'req-123');

      expect(statusCode).toBe(400);
      expect(response.error?.code).toBe('CUSTOM_CODE');
      expect(response.error?.details).toBeDefined();
      expect(response.error?.details?.length).toBe(1);
    });

    it('should include timestamp in response', () => {
      const error = new Error('Test');
      const { response } = mapErrorToResponse(error, 'req-123');

      expect(response.meta?.timestamp).toBeDefined();
      expect(new Date(response.meta!.timestamp).getTime()).not.toBeNaN();
    });
  });
});
