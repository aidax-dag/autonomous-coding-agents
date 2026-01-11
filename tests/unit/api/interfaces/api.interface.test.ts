/**
 * API Interface Tests
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module tests/unit/api/interfaces
 */

import {
  ApiStatusCode,
  ApiResourceType,
  ApiOperation,
  SortOrder,
  DEFAULT_API_CONFIG,
  API_ERROR_CODES,
} from '../../../../src/api/interfaces/api.interface';

describe('API Interfaces', () => {
  describe('ApiStatusCode', () => {
    it('should have correct success codes', () => {
      expect(ApiStatusCode.SUCCESS).toBe(200);
      expect(ApiStatusCode.CREATED).toBe(201);
      expect(ApiStatusCode.ACCEPTED).toBe(202);
      expect(ApiStatusCode.NO_CONTENT).toBe(204);
    });

    it('should have correct client error codes', () => {
      expect(ApiStatusCode.BAD_REQUEST).toBe(400);
      expect(ApiStatusCode.UNAUTHORIZED).toBe(401);
      expect(ApiStatusCode.FORBIDDEN).toBe(403);
      expect(ApiStatusCode.NOT_FOUND).toBe(404);
      expect(ApiStatusCode.CONFLICT).toBe(409);
      expect(ApiStatusCode.VALIDATION_ERROR).toBe(422);
      expect(ApiStatusCode.RATE_LIMITED).toBe(429);
    });

    it('should have correct server error codes', () => {
      expect(ApiStatusCode.INTERNAL_ERROR).toBe(500);
      expect(ApiStatusCode.SERVICE_UNAVAILABLE).toBe(503);
    });
  });

  describe('ApiResourceType', () => {
    it('should have all resource types', () => {
      expect(ApiResourceType.AGENT).toBe('agent');
      expect(ApiResourceType.WORKFLOW).toBe('workflow');
      expect(ApiResourceType.TOOL).toBe('tool');
      expect(ApiResourceType.HOOK).toBe('hook');
      expect(ApiResourceType.TASK).toBe('task');
      expect(ApiResourceType.EVENT).toBe('event');
      expect(ApiResourceType.METRICS).toBe('metrics');
      expect(ApiResourceType.HEALTH).toBe('health');
    });
  });

  describe('ApiOperation', () => {
    it('should have CRUD operations', () => {
      expect(ApiOperation.CREATE).toBe('create');
      expect(ApiOperation.READ).toBe('read');
      expect(ApiOperation.UPDATE).toBe('update');
      expect(ApiOperation.DELETE).toBe('delete');
      expect(ApiOperation.LIST).toBe('list');
    });

    it('should have action operations', () => {
      expect(ApiOperation.EXECUTE).toBe('execute');
      expect(ApiOperation.START).toBe('start');
      expect(ApiOperation.STOP).toBe('stop');
      expect(ApiOperation.PAUSE).toBe('pause');
      expect(ApiOperation.RESUME).toBe('resume');
    });
  });

  describe('SortOrder', () => {
    it('should have sort order values', () => {
      expect(SortOrder.ASC).toBe('asc');
      expect(SortOrder.DESC).toBe('desc');
    });
  });

  describe('DEFAULT_API_CONFIG', () => {
    it('should have default host and port', () => {
      expect(DEFAULT_API_CONFIG.host).toBe('0.0.0.0');
      expect(DEFAULT_API_CONFIG.port).toBe(3000);
      expect(DEFAULT_API_CONFIG.prefix).toBe('/api/v1');
    });

    it('should have CORS configuration', () => {
      expect(DEFAULT_API_CONFIG.cors.enabled).toBe(true);
      expect(DEFAULT_API_CONFIG.cors.origin).toBe(true);
      expect(DEFAULT_API_CONFIG.cors.methods).toContain('GET');
      expect(DEFAULT_API_CONFIG.cors.methods).toContain('POST');
      expect(DEFAULT_API_CONFIG.cors.credentials).toBe(true);
    });

    it('should have helmet configuration', () => {
      expect(DEFAULT_API_CONFIG.helmet.enabled).toBe(true);
      expect(DEFAULT_API_CONFIG.helmet.hidePoweredBy).toBe(true);
      expect(DEFAULT_API_CONFIG.helmet.noSniff).toBe(true);
    });

    it('should have rate limit configuration', () => {
      expect(DEFAULT_API_CONFIG.rateLimit.max).toBe(100);
      expect(DEFAULT_API_CONFIG.rateLimit.timeWindow).toBe('1 minute');
    });

    it('should have logging configuration', () => {
      expect(DEFAULT_API_CONFIG.logging.enabled).toBe(true);
      expect(DEFAULT_API_CONFIG.logging.level).toBe('info');
      expect(DEFAULT_API_CONFIG.logging.redactHeaders).toContain('authorization');
    });

    it('should have graceful shutdown configuration', () => {
      expect(DEFAULT_API_CONFIG.gracefulShutdown.enabled).toBe(true);
      expect(DEFAULT_API_CONFIG.gracefulShutdown.timeout).toBe(10000);
      expect(DEFAULT_API_CONFIG.gracefulShutdown.signals).toContain('SIGTERM');
    });
  });

  describe('API_ERROR_CODES', () => {
    it('should have client error codes', () => {
      expect(API_ERROR_CODES.INVALID_REQUEST).toBe('INVALID_REQUEST');
      expect(API_ERROR_CODES.VALIDATION_FAILED).toBe('VALIDATION_FAILED');
      expect(API_ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(API_ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(API_ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(API_ERROR_CODES.CONFLICT).toBe('CONFLICT');
      expect(API_ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED');
    });

    it('should have server error codes', () => {
      expect(API_ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(API_ERROR_CODES.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
      expect(API_ERROR_CODES.TIMEOUT).toBe('TIMEOUT');
    });

    it('should have domain-specific error codes', () => {
      expect(API_ERROR_CODES.AGENT_NOT_FOUND).toBe('AGENT_NOT_FOUND');
      expect(API_ERROR_CODES.AGENT_ALREADY_EXISTS).toBe('AGENT_ALREADY_EXISTS');
      expect(API_ERROR_CODES.WORKFLOW_NOT_FOUND).toBe('WORKFLOW_NOT_FOUND');
      expect(API_ERROR_CODES.TOOL_NOT_FOUND).toBe('TOOL_NOT_FOUND');
      expect(API_ERROR_CODES.HOOK_NOT_FOUND).toBe('HOOK_NOT_FOUND');
      expect(API_ERROR_CODES.TASK_NOT_FOUND).toBe('TASK_NOT_FOUND');
    });
  });
});
