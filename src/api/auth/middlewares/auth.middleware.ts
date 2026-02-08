/**
 * Authentication Middleware
 *
 * Feature: F4.4 - API Authentication
 *
 * Fastify middleware for JWT and API Key authentication.
 *
 * SOLID Principles:
 * - S: Single responsibility - authentication only
 * - O: Open for extension via auth methods
 * - D: Depends on service abstractions
 *
 * @module api/auth/middlewares/auth
 */

import type { FastifyRequest, FastifyReply, FastifyInstance, preHandlerHookHandler } from 'fastify';
import fp from 'fastify-plugin';
import { ILogger, createLogger } from '../../../core/services/logger.js';
import { UnauthorizedException, ForbiddenException } from '../../middleware/error.middleware.js';
import {
  AuthMethod,
  AuthResult,
  AuthMiddlewareOptions,
  IJwtService,
  IApiKeyService,
  AUTH_ERROR_STATUS,
} from '../interfaces/auth.interface.js';

// Extend FastifyRequest to include auth result
declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthResult;
  }
}

/**
 * Authentication middleware configuration
 */
export interface AuthMiddlewareConfig {
  jwtService?: IJwtService;
  apiKeyService?: IApiKeyService;
  apiKeyHeader?: string;
  bearerPrefix?: string;
}

/**
 * Create authentication middleware
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig): preHandlerHookHandler {
  const logger = createLogger('AuthMiddleware');
  const { jwtService, apiKeyService, apiKeyHeader = 'x-api-key', bearerPrefix = 'Bearer' } = config;

  return async function authMiddleware(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    const authResult = await authenticate(request, {
      jwtService,
      apiKeyService,
      apiKeyHeader,
      bearerPrefix,
      logger,
    });

    // Attach auth result to request
    request.auth = authResult;
  };
}

/**
 * Create route-level authentication guard
 */
export function createAuthGuard(
  options: AuthMiddlewareOptions,
  config: AuthMiddlewareConfig
): preHandlerHookHandler {
  const logger = createLogger('AuthGuard');
  const { jwtService, apiKeyService, apiKeyHeader = 'x-api-key', bearerPrefix = 'Bearer' } = config;

  const allowedMethods = options.methods || [AuthMethod.JWT, AuthMethod.API_KEY];

  return async function authGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
    // First, authenticate if not already done
    if (!request.auth) {
      request.auth = await authenticate(request, {
        jwtService,
        apiKeyService,
        apiKeyHeader,
        bearerPrefix,
        logger,
      });
    }

    const auth = request.auth;

    // Check if authentication is required
    if (options.required && !auth.authenticated) {
      logger.debug('Authentication required but not authenticated', {
        path: request.url,
        method: request.method,
        error: auth.error?.code,
      });
      throw new UnauthorizedException(auth.error?.message || 'Authentication required');
    }

    // Check if the auth method is allowed
    if (auth.authenticated && !allowedMethods.includes(auth.method)) {
      logger.debug('Auth method not allowed', {
        path: request.url,
        method: request.method,
        authMethod: auth.method,
        allowedMethods,
      });
      throw new UnauthorizedException(`Authentication method '${auth.method}' not allowed`);
    }

    // Check required permissions (all must match)
    if (options.requiredPermissions && options.requiredPermissions.length > 0) {
      const userPermissions = auth.permissions || [];
      const missingPermissions = options.requiredPermissions.filter(
        (p) => !userPermissions.includes(p) && !userPermissions.includes('*')
      );

      if (missingPermissions.length > 0) {
        logger.debug('Missing required permissions', {
          path: request.url,
          method: request.method,
          required: options.requiredPermissions,
          missing: missingPermissions,
        });
        throw new ForbiddenException(
          `Missing required permissions: ${missingPermissions.join(', ')}`
        );
      }
    }

    // Check optional permissions (any match)
    if (options.permissions && options.permissions.length > 0) {
      const userPermissions = auth.permissions || [];
      const hasPermission =
        userPermissions.includes('*') ||
        options.permissions.some((p) => userPermissions.includes(p));

      if (!hasPermission) {
        logger.debug('No matching permissions', {
          path: request.url,
          method: request.method,
          required: options.permissions,
          userPermissions,
        });
        throw new ForbiddenException('Permission denied');
      }
    }

    // Check roles
    if (options.roles && options.roles.length > 0) {
      const userRoles = auth.roles || [];
      const hasRole = options.roles.some((r) => userRoles.includes(r));

      if (!hasRole) {
        logger.debug('No matching roles', {
          path: request.url,
          method: request.method,
          required: options.roles,
          userRoles,
        });
        throw new ForbiddenException('Role not authorized');
      }
    }
  };
}

/**
 * Internal authentication function
 */
async function authenticate(
  request: FastifyRequest,
  config: {
    jwtService?: IJwtService;
    apiKeyService?: IApiKeyService;
    apiKeyHeader: string;
    bearerPrefix: string;
    logger: ILogger;
  }
): Promise<AuthResult> {
  const { jwtService, apiKeyService, apiKeyHeader, bearerPrefix, logger } = config;

  // Check for Authorization header (Bearer token)
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith(`${bearerPrefix} `)) {
    const token = authHeader.substring(bearerPrefix.length + 1);

    if (!jwtService) {
      logger.warn('JWT service not configured but Bearer token provided');
      return {
        authenticated: false,
        method: AuthMethod.JWT,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'JWT authentication not configured',
          statusCode: AUTH_ERROR_STATUS.AUTH_REQUIRED,
        },
      };
    }

    const result = await jwtService.verifyAccessToken(token);

    if (result.valid && result.payload) {
      logger.debug('JWT authentication successful', {
        userId: result.payload.sub,
        tokenId: result.payload.jti,
      });

      return {
        authenticated: true,
        method: AuthMethod.JWT,
        userId: result.payload.sub,
        permissions: result.payload.permissions,
        roles: result.payload.roles,
        tokenId: result.payload.jti,
        expiresAt: new Date(result.payload.exp * 1000),
      };
    }

    logger.debug('JWT authentication failed', { error: result.error?.code });

    return {
      authenticated: false,
      method: AuthMethod.JWT,
      error: {
        code: result.error?.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: result.error?.message || 'Invalid token',
        statusCode: AUTH_ERROR_STATUS.INVALID_TOKEN,
      },
    };
  }

  // Check for API Key header
  const apiKey = request.headers[apiKeyHeader.toLowerCase()] as string;
  if (apiKey) {
    if (!apiKeyService) {
      logger.warn('API Key service not configured but API key provided');
      return {
        authenticated: false,
        method: AuthMethod.API_KEY,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'API Key authentication not configured',
          statusCode: AUTH_ERROR_STATUS.AUTH_REQUIRED,
        },
      };
    }

    // Get client IP for validation
    const clientIp = getClientIp(request);
    const result = await apiKeyService.validateApiKey(apiKey, clientIp);

    if (result.valid && result.apiKey) {
      // Record usage
      await apiKeyService.recordUsage(result.apiKey.id);

      logger.debug('API Key authentication successful', {
        apiKeyId: result.apiKey.id,
        userId: result.apiKey.userId,
      });

      return {
        authenticated: true,
        method: AuthMethod.API_KEY,
        userId: result.apiKey.userId,
        permissions: result.apiKey.permissions,
        apiKeyId: result.apiKey.id,
        expiresAt: result.apiKey.expiresAt,
      };
    }

    logger.debug('API Key authentication failed', { error: result.error?.code });

    return {
      authenticated: false,
      method: AuthMethod.API_KEY,
      error: {
        code: result.error?.code === 'KEY_EXPIRED' ? 'API_KEY_EXPIRED' : 'INVALID_API_KEY',
        message: result.error?.message || 'Invalid API key',
        statusCode:
          result.error?.code === 'RATE_LIMIT_EXCEEDED'
            ? AUTH_ERROR_STATUS.RATE_LIMIT_EXCEEDED
            : AUTH_ERROR_STATUS.INVALID_API_KEY,
      },
    };
  }

  // No authentication provided
  return {
    authenticated: false,
    method: AuthMethod.NONE,
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(request: FastifyRequest): string {
  // Check for forwarded headers (behind proxy)
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips.trim();
  }

  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return request.ip;
}

/**
 * Fastify plugin for authentication
 */
export const authPlugin = fp(
  async function (fastify: FastifyInstance, options: AuthMiddlewareConfig): Promise<void> {
    // Create and register the global auth middleware
    const authMiddleware = createAuthMiddleware(options);

    // Register as a preHandler hook for all routes
    fastify.addHook('preHandler', authMiddleware);

    // Decorate fastify with auth guard factory
    fastify.decorate('createAuthGuard', (guardOptions: AuthMiddlewareOptions) => {
      return createAuthGuard(guardOptions, options);
    });
  },
  {
    name: 'auth-middleware',
    fastify: '5.x',
  }
);

/**
 * Helper function to require authentication on a route
 */
export function requireAuth(
  options: Omit<AuthMiddlewareOptions, 'required'> = {}
): AuthMiddlewareOptions {
  return {
    ...options,
    required: true,
  };
}

/**
 * Helper function to require specific permissions
 */
export function requirePermissions(
  permissions: string[],
  options: Omit<AuthMiddlewareOptions, 'required' | 'requiredPermissions'> = {}
): AuthMiddlewareOptions {
  return {
    ...options,
    required: true,
    requiredPermissions: permissions,
  };
}

/**
 * Helper function to require specific roles
 */
export function requireRoles(
  roles: string[],
  options: Omit<AuthMiddlewareOptions, 'required' | 'roles'> = {}
): AuthMiddlewareOptions {
  return {
    ...options,
    required: true,
    roles,
  };
}
