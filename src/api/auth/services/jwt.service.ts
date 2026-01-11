/**
 * JWT Service
 *
 * Feature: F4.4 - API Authentication
 *
 * Handles JWT token generation, verification, and refresh.
 *
 * SOLID Principles:
 * - S: Single responsibility - JWT operations only
 * - O: Extensible via configuration
 * - D: Depends on IJwtService abstraction
 *
 * @module api/auth/services/jwt
 */

import jwt, { SignOptions, VerifyOptions, JwtPayload as JwtLibPayload } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { ILogger, createLogger } from '../../../core/services/logger.js';
import {
  IJwtService,
  JwtConfig,
  JwtPayload,
  TokenPair,
  TokenType,
  JwtVerificationResult,
  JwtErrorCode,
  DEFAULT_JWT_CONFIG,
} from '../interfaces/auth.interface.js';

/**
 * Parse duration string to seconds
 * Supports: s (seconds), m (minutes), h (hours), d (days)
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

/**
 * JWT Service implementation
 */
export class JwtService implements IJwtService {
  private readonly logger: ILogger;
  private readonly config: JwtConfig;
  private readonly revokedTokens: Map<string, number>; // jti -> expiration timestamp
  private readonly userRevokedAt: Map<string, number>; // userId -> revocation timestamp
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<JwtConfig>) {
    this.logger = createLogger('JwtService');
    this.config = { ...DEFAULT_JWT_CONFIG, ...config };
    this.revokedTokens = new Map();
    this.userRevokedAt = new Map();

    // Periodically clean up expired revoked tokens
    this.startCleanupInterval();

    this.logger.debug('JWT service initialized', {
      issuer: this.config.issuer,
      algorithm: this.config.algorithm,
      accessTokenExpiry: this.config.accessTokenExpiry,
      refreshTokenExpiry: this.config.refreshTokenExpiry,
    });
  }

  /**
   * Generate a token pair for a user
   */
  async generateTokens(userId: string, claims?: Partial<JwtPayload>): Promise<TokenPair> {
    const now = Math.floor(Date.now() / 1000);
    const accessExpiry = parseDuration(this.config.accessTokenExpiry);
    const refreshExpiry = parseDuration(this.config.refreshTokenExpiry);

    const basePayload = {
      sub: userId,
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: now,
      permissions: claims?.permissions || [],
      roles: claims?.roles || [],
      ...claims,
    };

    // Generate access token
    const accessTokenId = randomUUID();
    const accessPayload: JwtPayload = {
      ...basePayload,
      jti: accessTokenId,
      type: TokenType.ACCESS,
      exp: now + accessExpiry,
    };

    // Generate refresh token
    const refreshTokenId = randomUUID();
    const refreshPayload: JwtPayload = {
      ...basePayload,
      jti: refreshTokenId,
      type: TokenType.REFRESH,
      exp: now + refreshExpiry,
    };

    const signOptions: SignOptions = {
      algorithm: this.config.algorithm,
    };

    const accessToken = jwt.sign(accessPayload, this.config.secret, signOptions);
    const refreshToken = jwt.sign(refreshPayload, this.config.secret, signOptions);

    this.logger.debug('Generated token pair', {
      userId,
      accessTokenId,
      refreshTokenId,
      accessExpiry,
      refreshExpiry,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiry,
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify an access token
   */
  async verifyAccessToken(token: string): Promise<JwtVerificationResult> {
    return this.verifyToken(token, TokenType.ACCESS);
  }

  /**
   * Verify a refresh token
   */
  async verifyRefreshToken(token: string): Promise<JwtVerificationResult> {
    return this.verifyToken(token, TokenType.REFRESH);
  }

  /**
   * Internal token verification
   */
  private async verifyToken(token: string, expectedType: TokenType): Promise<JwtVerificationResult> {
    try {
      const verifyOptions: VerifyOptions = {
        algorithms: [this.config.algorithm],
        issuer: this.config.issuer,
        audience: Array.isArray(this.config.audience)
          ? (this.config.audience as [string, ...string[]])
          : this.config.audience,
        clockTolerance: this.config.clockTolerance,
      };

      const decoded = jwt.verify(token, this.config.secret, verifyOptions) as JwtLibPayload & JwtPayload;

      // Check token type
      if (decoded.type !== expectedType) {
        return {
          valid: false,
          error: {
            code: 'TOKEN_INVALID',
            message: `Expected ${expectedType} token, got ${decoded.type}`,
          },
        };
      }

      // Check if token is revoked
      if (await this.isTokenRevoked(decoded.jti)) {
        return {
          valid: false,
          error: {
            code: 'TOKEN_INVALID',
            message: 'Token has been revoked',
          },
        };
      }

      // Check if all user tokens were revoked after this token was issued
      const userRevokedTime = this.userRevokedAt.get(decoded.sub);
      if (userRevokedTime && decoded.iat && decoded.iat <= userRevokedTime) {
        return {
          valid: false,
          error: {
            code: 'TOKEN_INVALID',
            message: 'Token has been revoked',
          },
        };
      }

      const payload: JwtPayload = {
        sub: decoded.sub as string,
        iss: decoded.iss as string,
        aud: decoded.aud,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
        nbf: decoded.nbf,
        jti: decoded.jti,
        type: decoded.type,
        permissions: decoded.permissions,
        roles: decoded.roles,
      };

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return this.handleJwtError(error);
    }
  }

  /**
   * Refresh tokens using a valid refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const result = await this.verifyRefreshToken(refreshToken);

    if (!result.valid || !result.payload) {
      throw new Error(result.error?.message || 'Invalid refresh token');
    }

    // Revoke the old refresh token
    await this.revokeToken(result.payload.jti);

    // Generate new token pair with same claims
    return this.generateTokens(result.payload.sub, {
      permissions: result.payload.permissions,
      roles: result.payload.roles,
    });
  }

  /**
   * Decode a token without verification (for inspection)
   */
  decodeToken(token: string): JwtPayload | null {
    try {
      const decoded = jwt.decode(token) as JwtLibPayload & JwtPayload;
      if (!decoded) return null;

      return {
        sub: decoded.sub as string,
        iss: decoded.iss as string,
        aud: decoded.aud,
        iat: decoded.iat as number,
        exp: decoded.exp as number,
        nbf: decoded.nbf,
        jti: decoded.jti,
        type: decoded.type,
        permissions: decoded.permissions,
        roles: decoded.roles,
      };
    } catch {
      return null;
    }
  }

  /**
   * Revoke a specific token
   */
  async revokeToken(jti: string): Promise<void> {
    // Store with expiration time for cleanup
    const decoded = this.findTokenExpiration(jti);
    const expiration = decoded || Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // Default 7 days

    this.revokedTokens.set(jti, expiration);
    this.logger.debug('Token revoked', { jti });
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    this.userRevokedAt.set(userId, Math.floor(Date.now() / 1000));
    this.logger.info('All tokens revoked for user', { userId });
  }

  /**
   * Check if a token is revoked
   */
  async isTokenRevoked(jti: string): Promise<boolean> {
    return this.revokedTokens.has(jti);
  }

  /**
   * Handle JWT errors and convert to our error format
   */
  private handleJwtError(error: unknown): JwtVerificationResult {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: {
          code: 'TOKEN_EXPIRED' as JwtErrorCode,
          message: 'Token has expired',
        },
      };
    }

    if (error instanceof jwt.NotBeforeError) {
      return {
        valid: false,
        error: {
          code: 'TOKEN_NOT_BEFORE' as JwtErrorCode,
          message: 'Token not yet valid',
        },
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      let code: JwtErrorCode = 'TOKEN_INVALID';
      const message = error.message;

      if (message.includes('malformed')) {
        code = 'TOKEN_MALFORMED';
      } else if (message.includes('signature')) {
        code = 'SIGNATURE_INVALID';
      } else if (message.includes('issuer')) {
        code = 'ISSUER_INVALID';
      } else if (message.includes('audience')) {
        code = 'AUDIENCE_INVALID';
      } else if (message.includes('algorithm')) {
        code = 'ALGORITHM_INVALID';
      }

      return {
        valid: false,
        error: {
          code,
          message,
        },
      };
    }

    return {
      valid: false,
      error: {
        code: 'TOKEN_INVALID' as JwtErrorCode,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }

  /**
   * Find token expiration (placeholder for token storage lookup)
   */
  private findTokenExpiration(_jti: string): number | null {
    // In a real implementation, this would look up the token in a database
    // For now, we just return null and use the default expiration
    return null;
  }

  /**
   * Start cleanup interval for expired revoked tokens
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      let cleaned = 0;

      for (const [jti, expiration] of this.revokedTokens.entries()) {
        if (expiration < now) {
          this.revokedTokens.delete(jti);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.logger.debug('Cleaned up expired revoked tokens', { count: cleaned });
      }
    }, 60 * 60 * 1000); // Every hour

    // Don't keep process alive just for cleanup
    this.cleanupInterval.unref();
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

/**
 * Factory function to create JWT service
 */
export function createJwtService(config?: Partial<JwtConfig>): IJwtService {
  return new JwtService(config);
}
