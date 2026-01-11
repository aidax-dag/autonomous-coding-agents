/**
 * Auth Middleware Unit Tests
 *
 * Feature: F4.4 - API Authentication
 *
 * @module tests/unit/api/auth/middlewares/auth.middleware
 */

import {
  createAuthMiddleware,
  createAuthGuard,
  requireAuth,
  requirePermissions,
  requireRoles,
  AuthMiddlewareConfig,
} from '../../../../../src/api/auth/middlewares/auth.middleware';
import {
  AuthMethod,
  IJwtService,
  IApiKeyService,
  JwtVerificationResult,
  ApiKeyValidationResult,
  TokenType,
  ApiKey,
  ApiKeyStatus,
} from '../../../../../src/api/auth/interfaces/auth.interface';
import { UnauthorizedException, ForbiddenException } from '../../../../../src/api/middleware/error.middleware';

// Mock Fastify request and reply
function createMockRequest(overrides: Record<string, unknown> = {}): unknown {
  return {
    headers: {},
    url: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    params: {},
    query: {},
    ...overrides,
  };
}

function createMockReply(): unknown {
  return {};
}

// Mock JWT Service
function createMockJwtService(overrides: Partial<IJwtService> = {}): IJwtService {
  return {
    generateTokens: jest.fn(),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
    refreshTokens: jest.fn(),
    decodeToken: jest.fn(),
    revokeToken: jest.fn(),
    revokeAllUserTokens: jest.fn(),
    isTokenRevoked: jest.fn(),
    ...overrides,
  };
}

// Mock API Key Service
function createMockApiKeyService(overrides: Partial<IApiKeyService> = {}): IApiKeyService {
  return {
    createApiKey: jest.fn(),
    validateApiKey: jest.fn(),
    getApiKey: jest.fn(),
    listApiKeys: jest.fn(),
    revokeApiKey: jest.fn(),
    updateApiKeyPermissions: jest.fn(),
    updateApiKeyStatus: jest.fn(),
    recordUsage: jest.fn(),
    checkRateLimit: jest.fn(),
    cleanupExpiredKeys: jest.fn(),
    ...overrides,
  };
}

describe('AuthMiddleware', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to call middleware (handling Fastify's async hook signature)
  async function callMiddleware(
    middleware: ReturnType<typeof createAuthMiddleware>,
    request: unknown
  ): Promise<void> {
    return (middleware as (req: unknown, reply: unknown) => Promise<void>)(
      request,
      createMockReply()
    );
  }

  // Helper to create a complete mock ApiKey for validation results
  function createMockApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
    return {
      id: 'key-1',
      name: 'Test API Key',
      prefix: 'test_...',
      hashedKey: 'hashed-key',
      userId: 'user-1',
      status: ApiKeyStatus.ACTIVE,
      permissions: [],
      scopes: ['*'],
      createdAt: new Date(),
      ...overrides,
    };
  }

  describe('createAuthMiddleware', () => {
    it('should set auth to unauthenticated when no auth headers present', async () => {
      const middleware = createAuthMiddleware({});
      const request = createMockRequest() as Record<string, unknown>;

      await callMiddleware(middleware, request);

      expect(request.auth).toBeDefined();
      expect((request.auth as { authenticated: boolean }).authenticated).toBe(false);
      expect((request.auth as { method: AuthMethod }).method).toBe(AuthMethod.NONE);
    });

    it('should authenticate with valid JWT Bearer token', async () => {
      const mockJwtService = createMockJwtService({
        verifyAccessToken: jest.fn().mockResolvedValue({
          valid: true,
          payload: {
            sub: 'user-123',
            jti: 'token-id',
            permissions: ['read'],
            roles: ['user'],
            exp: Math.floor(Date.now() / 1000) + 3600,
            type: TokenType.ACCESS,
          },
        } as JwtVerificationResult),
      });

      const middleware = createAuthMiddleware({ jwtService: mockJwtService });
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      expect(request.auth).toBeDefined();
      const auth = request.auth as { authenticated: boolean; method: AuthMethod; userId: string };
      expect(auth.authenticated).toBe(true);
      expect(auth.method).toBe(AuthMethod.JWT);
      expect(auth.userId).toBe('user-123');
    });

    it('should handle invalid JWT token', async () => {
      const mockJwtService = createMockJwtService({
        verifyAccessToken: jest.fn().mockResolvedValue({
          valid: false,
          error: { code: 'TOKEN_INVALID', message: 'Invalid token' },
        } as JwtVerificationResult),
      });

      const middleware = createAuthMiddleware({ jwtService: mockJwtService });
      const request = createMockRequest({
        headers: { authorization: 'Bearer invalid-token' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      expect(request.auth).toBeDefined();
      const auth = request.auth as { authenticated: boolean; error: { code: string } };
      expect(auth.authenticated).toBe(false);
      expect(auth.error?.code).toBe('INVALID_TOKEN');
    });

    it('should handle expired JWT token', async () => {
      const mockJwtService = createMockJwtService({
        verifyAccessToken: jest.fn().mockResolvedValue({
          valid: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
        } as JwtVerificationResult),
      });

      const middleware = createAuthMiddleware({ jwtService: mockJwtService });
      const request = createMockRequest({
        headers: { authorization: 'Bearer expired-token' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      const auth = request.auth as { authenticated: boolean; error: { code: string } };
      expect(auth.authenticated).toBe(false);
      expect(auth.error?.code).toBe('TOKEN_EXPIRED');
    });

    it('should authenticate with valid API key', async () => {
      const mockApiKeyService = createMockApiKeyService({
        validateApiKey: jest.fn().mockResolvedValue({
          valid: true,
          apiKey: {
            id: 'key-123',
            userId: 'user-456',
            permissions: ['read', 'write'],
          },
        } as ApiKeyValidationResult),
        recordUsage: jest.fn().mockResolvedValue(undefined),
      });

      const middleware = createAuthMiddleware({ apiKeyService: mockApiKeyService });
      const request = createMockRequest({
        headers: { 'x-api-key': 'test_validkey123' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      expect(request.auth).toBeDefined();
      const auth = request.auth as { authenticated: boolean; method: AuthMethod; userId: string };
      expect(auth.authenticated).toBe(true);
      expect(auth.method).toBe(AuthMethod.API_KEY);
      expect(auth.userId).toBe('user-456');
      expect(mockApiKeyService.recordUsage).toHaveBeenCalledWith('key-123');
    });

    it('should handle invalid API key', async () => {
      const mockApiKeyService = createMockApiKeyService({
        validateApiKey: jest.fn().mockResolvedValue({
          valid: false,
          error: { code: 'KEY_NOT_FOUND', message: 'Key not found' },
        } as ApiKeyValidationResult),
      });

      const middleware = createAuthMiddleware({ apiKeyService: mockApiKeyService });
      const request = createMockRequest({
        headers: { 'x-api-key': 'invalid-key' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      const auth = request.auth as { authenticated: boolean; error: { code: string } };
      expect(auth.authenticated).toBe(false);
      expect(auth.error?.code).toBe('INVALID_API_KEY');
    });

    it('should return error when JWT service not configured but Bearer token provided', async () => {
      const middleware = createAuthMiddleware({});
      const request = createMockRequest({
        headers: { authorization: 'Bearer some-token' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      const auth = request.auth as { authenticated: boolean; error: { message: string } };
      expect(auth.authenticated).toBe(false);
      expect(auth.error?.message).toContain('not configured');
    });

    it('should return error when API Key service not configured but API key provided', async () => {
      const middleware = createAuthMiddleware({});
      const request = createMockRequest({
        headers: { 'x-api-key': 'some-key' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      const auth = request.auth as { authenticated: boolean; error: { message: string } };
      expect(auth.authenticated).toBe(false);
      expect(auth.error?.message).toContain('not configured');
    });

    it('should use custom API key header', async () => {
      const mockApiKeyService = createMockApiKeyService({
        validateApiKey: jest.fn().mockResolvedValue({
          valid: true,
          apiKey: createMockApiKey(),
        } as ApiKeyValidationResult),
        recordUsage: jest.fn().mockResolvedValue(undefined),
      });

      const middleware = createAuthMiddleware({
        apiKeyService: mockApiKeyService,
        apiKeyHeader: 'x-custom-key',
      });

      const request = createMockRequest({
        headers: { 'x-custom-key': 'my-api-key' },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('my-api-key', '127.0.0.1');
    });

    it('should extract client IP from x-forwarded-for header', async () => {
      const mockApiKeyService = createMockApiKeyService({
        validateApiKey: jest.fn().mockResolvedValue({
          valid: true,
          apiKey: createMockApiKey(),
        } as ApiKeyValidationResult),
        recordUsage: jest.fn().mockResolvedValue(undefined),
      });

      const middleware = createAuthMiddleware({ apiKeyService: mockApiKeyService });
      const request = createMockRequest({
        headers: {
          'x-api-key': 'test-key',
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
        },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('test-key', '203.0.113.1');
    });

    it('should extract client IP from x-real-ip header', async () => {
      const mockApiKeyService = createMockApiKeyService({
        validateApiKey: jest.fn().mockResolvedValue({
          valid: true,
          apiKey: createMockApiKey(),
        } as ApiKeyValidationResult),
        recordUsage: jest.fn().mockResolvedValue(undefined),
      });

      const middleware = createAuthMiddleware({ apiKeyService: mockApiKeyService });
      const request = createMockRequest({
        headers: {
          'x-api-key': 'test-key',
          'x-real-ip': '192.168.1.100',
        },
      }) as Record<string, unknown>;

      await callMiddleware(middleware, request);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith('test-key', '192.168.1.100');
    });
  });

  describe('createAuthGuard', () => {
    const mockConfig: AuthMiddlewareConfig = {
      jwtService: createMockJwtService({
        verifyAccessToken: jest.fn().mockResolvedValue({
          valid: true,
          payload: {
            sub: 'user-123',
            jti: 'token-id',
            permissions: ['read', 'write'],
            roles: ['user'],
            exp: Math.floor(Date.now() / 1000) + 3600,
            type: TokenType.ACCESS,
          },
        } as JwtVerificationResult),
      }),
    };

    // Helper to call guard (handling Fastify's async hook signature)
    async function callGuard(
      guard: ReturnType<typeof createAuthGuard>,
      request: unknown
    ): Promise<void> {
      return (guard as (req: unknown, reply: unknown) => Promise<void>)(
        request,
        createMockReply()
      );
    }

    it('should throw UnauthorizedException when auth required but not authenticated', async () => {
      const guard = createAuthGuard({ required: true }, {});
      const request = createMockRequest() as Record<string, unknown>;

      await expect(callGuard(guard, request)).rejects.toThrow(UnauthorizedException);
    });

    it('should pass when auth required and authenticated', async () => {
      const guard = createAuthGuard({ required: true }, mockConfig);
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).resolves.not.toThrow();
      expect((request.auth as { authenticated: boolean }).authenticated).toBe(true);
    });

    it('should throw when auth method not allowed', async () => {
      const guard = createAuthGuard(
        { required: true, methods: [AuthMethod.API_KEY] },
        mockConfig
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ForbiddenException when required permissions missing', async () => {
      const guard = createAuthGuard(
        { required: true, requiredPermissions: ['admin', 'delete'] },
        mockConfig
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).rejects.toThrow(ForbiddenException);
    });

    it('should pass when all required permissions present', async () => {
      const guard = createAuthGuard(
        { required: true, requiredPermissions: ['read', 'write'] },
        mockConfig
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).resolves.not.toThrow();
    });

    it('should pass when user has wildcard permission', async () => {
      const config: AuthMiddlewareConfig = {
        jwtService: createMockJwtService({
          verifyAccessToken: jest.fn().mockResolvedValue({
            valid: true,
            payload: {
              sub: 'admin-user',
              permissions: ['*'],
              roles: ['admin'],
              exp: Math.floor(Date.now() / 1000) + 3600,
            },
          } as JwtVerificationResult),
        }),
      };

      const guard = createAuthGuard(
        { required: true, requiredPermissions: ['super-secret-permission'] },
        config
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer admin-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when no matching permissions (any match)', async () => {
      const guard = createAuthGuard(
        { required: true, permissions: ['admin', 'superuser'] },
        mockConfig
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).rejects.toThrow(ForbiddenException);
    });

    it('should pass when any permission matches', async () => {
      const guard = createAuthGuard(
        { required: true, permissions: ['read', 'admin'] },
        mockConfig
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when role not matched', async () => {
      const guard = createAuthGuard(
        { required: true, roles: ['admin', 'superuser'] },
        mockConfig
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).rejects.toThrow(ForbiddenException);
    });

    it('should pass when role matches', async () => {
      const guard = createAuthGuard(
        { required: true, roles: ['user', 'admin'] },
        mockConfig
      );
      const request = createMockRequest({
        headers: { authorization: 'Bearer valid-token' },
      }) as Record<string, unknown>;

      await expect(callGuard(guard, request)).resolves.not.toThrow();
    });

    it('should use existing auth if already set on request', async () => {
      const guard = createAuthGuard({ required: true }, {});
      const request = createMockRequest() as Record<string, unknown>;
      request.auth = {
        authenticated: true,
        method: AuthMethod.JWT,
        userId: 'pre-authed-user',
        permissions: ['read'],
        roles: ['user'],
      };

      await expect(callGuard(guard, request)).resolves.not.toThrow();
    });
  });

  describe('helper functions', () => {
    describe('requireAuth', () => {
      it('should return options with required=true', () => {
        const result = requireAuth();
        expect(result.required).toBe(true);
      });

      it('should preserve additional options', () => {
        const result = requireAuth({ methods: [AuthMethod.JWT] });
        expect(result.required).toBe(true);
        expect(result.methods).toEqual([AuthMethod.JWT]);
      });
    });

    describe('requirePermissions', () => {
      it('should return options with required=true and permissions', () => {
        const result = requirePermissions(['read', 'write']);
        expect(result.required).toBe(true);
        expect(result.requiredPermissions).toEqual(['read', 'write']);
      });

      it('should preserve additional options', () => {
        const result = requirePermissions(['admin'], { methods: [AuthMethod.API_KEY] });
        expect(result.required).toBe(true);
        expect(result.requiredPermissions).toEqual(['admin']);
        expect(result.methods).toEqual([AuthMethod.API_KEY]);
      });
    });

    describe('requireRoles', () => {
      it('should return options with required=true and roles', () => {
        const result = requireRoles(['admin', 'superuser']);
        expect(result.required).toBe(true);
        expect(result.roles).toEqual(['admin', 'superuser']);
      });

      it('should preserve additional options', () => {
        const result = requireRoles(['admin'], { methods: [AuthMethod.JWT] });
        expect(result.required).toBe(true);
        expect(result.roles).toEqual(['admin']);
        expect(result.methods).toEqual([AuthMethod.JWT]);
      });
    });
  });
});
