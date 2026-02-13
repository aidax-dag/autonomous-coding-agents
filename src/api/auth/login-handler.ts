/**
 * Login Handler
 *
 * Provides a POST /api/login endpoint that validates credentials
 * and returns JWT access + refresh tokens.
 *
 * Credentials are sourced from environment variables:
 *   ACA_ADMIN_EMAIL, ACA_ADMIN_PASSWORD
 *
 * @module api/auth/login-handler
 */

import { timingSafeEqual } from 'node:crypto';
import type { IWebServer, WebRequest, WebResponse } from '../../ui/web/interfaces/web.interface';
import type { JWTService } from './jwt';
import { logger } from '../../shared/logging/logger';

export interface LoginConfig {
  jwtService: JWTService;
  adminEmail?: string;
  adminPassword?: string;
}

interface LoginBody {
  email?: string;
  password?: string;
}

/**
 * Timing-safe string comparison to prevent timing attacks on credentials.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Install the login route on a WebServer instance.
 * Registers POST /api/login which returns JWT tokens on valid credentials.
 */
export function installLoginHandler(server: IWebServer, config: LoginConfig): void {
  const { jwtService } = config;
  const adminEmail = config.adminEmail ?? process.env.ACA_ADMIN_EMAIL ?? 'admin@aca.local';
  const adminPassword = config.adminPassword ?? process.env.ACA_ADMIN_PASSWORD ?? '';

  server.addRoute('POST', '/api/login', async (req: WebRequest): Promise<WebResponse> => {
    const body = req.body as LoginBody | undefined;

    if (!body?.email || !body?.password) {
      return {
        status: 400,
        body: { error: 'Email and password are required' },
      };
    }

    if (!adminPassword) {
      logger.warn('Login attempted but ACA_ADMIN_PASSWORD is not configured');
      return {
        status: 503,
        body: { error: 'Authentication not configured' },
      };
    }

    const emailMatch = safeCompare(body.email, adminEmail);
    const passwordMatch = safeCompare(body.password, adminPassword);

    if (!emailMatch || !passwordMatch) {
      logger.warn('Failed login attempt', { email: body.email });
      return {
        status: 401,
        body: { error: 'Invalid credentials' },
      };
    }

    const accessToken = jwtService.generateAccessToken(body.email, 'admin');
    const refreshToken = jwtService.generateRefreshToken(body.email, 'admin');

    logger.info('Successful login', { email: body.email });

    return {
      status: 200,
      body: {
        accessToken,
        refreshToken,
        expiresIn: 3600,
      },
    };
  });

  server.addRoute('POST', '/api/auth/refresh', async (req: WebRequest): Promise<WebResponse> => {
    const body = req.body as { refreshToken?: string } | undefined;

    if (!body?.refreshToken) {
      return {
        status: 400,
        body: { error: 'Refresh token is required' },
      };
    }

    try {
      const payload = jwtService.verify(body.refreshToken);

      if (payload.type !== 'refresh') {
        return {
          status: 401,
          body: { error: 'Invalid token type' },
        };
      }

      const accessToken = jwtService.generateAccessToken(payload.sub, payload.role);

      return {
        status: 200,
        body: {
          accessToken,
          expiresIn: 3600,
        },
      };
    } catch {
      return {
        status: 401,
        body: { error: 'Invalid or expired refresh token' },
      };
    }
  });
}
