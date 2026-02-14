/**
 * Authentication Middleware
 *
 * Checks Bearer token (JWT) or API key on every request.
 * Wraps WebServer.handleRequest to intercept before routing.
 *
 * @module api/middleware/auth
 */

import type { WebServer } from '../../ui/web/web-server';
import type { WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';
import type { JWTService } from '../auth/jwt';
import type { APIKeyService } from '../auth/api-key';
import { logger } from '../../shared/logging/logger';

export interface AuthMiddlewareConfig {
  jwtService: JWTService;
  apiKeyService?: APIKeyService;
  excludePaths?: string[];
}

const DEFAULT_EXCLUDE_PATHS = ['/api/health', '/api/db/health', '/api/login', '/api/auth/refresh'];

/**
 * Install authentication middleware on a WebServer instance.
 *
 * For each request:
 * 1. Check if path is excluded from auth
 * 2. Check Authorization: Bearer <token> header
 * 3. Check x-api-key header (if APIKeyService configured)
 * 4. Return 401 if neither is valid
 * 5. Attach user info to request headers on valid JWT
 */
export function installAuthMiddleware(server: WebServer, config: AuthMiddlewareConfig): void {
  const { jwtService, apiKeyService } = config;
  const excludePaths = config.excludePaths ?? DEFAULT_EXCLUDE_PATHS;

  const originalHandleRequest = server.handleRequest.bind(server);

  server.handleRequest = async (req: WebRequest): Promise<WebResponse> => {
    // Check excluded paths
    if (excludePaths.includes(req.path)) {
      return originalHandleRequest(req);
    }

    // Try Bearer token authentication
    const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = jwtService.verify(token);
        // Attach user info to request headers
        const enrichedReq: WebRequest = {
          ...req,
          headers: {
            ...req.headers,
            'x-auth-sub': payload.sub,
            'x-auth-role': payload.role,
          },
        };
        return originalHandleRequest(enrichedReq);
      } catch (err) {
        logger.warn('JWT authentication failed', {
          path: req.path,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
        return {
          status: 401,
          body: {
            error: 'Invalid or expired token',
            code: 'UNAUTHORIZED',
            status: 401,
          },
        };
      }
    }

    // Try API key authentication
    if (apiKeyService) {
      const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'] || '';
      if (apiKey && apiKeyService.validate(apiKey)) {
        return originalHandleRequest(req);
      }
    }

    // No valid credentials
    logger.warn('Authentication required but no valid credentials provided', {
      path: req.path,
      method: req.method,
    });

    return {
      status: 401,
      body: {
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        status: 401,
      },
    };
  };
}
