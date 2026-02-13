/**
 * JWT Token Service
 *
 * Generates and verifies JWT tokens using HMAC-SHA256 (HS256)
 * with Node.js built-in crypto module.
 *
 * @module api/auth/jwt
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { logger } from '../../shared/logging/logger';

export interface JWTPayload {
  sub: string;
  role: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface JWTConfig {
  secret: string;
  accessTokenTTL?: number;
  refreshTokenTTL?: number;
}

/**
 * Base64url encode a string.
 */
function base64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

/**
 * Base64url decode to a UTF-8 string.
 */
function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/**
 * Compute HMAC-SHA256 signature and return as base64url.
 */
function sign(data: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  return hmac.digest('base64url');
}

const JWT_HEADER = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

export class JWTService {
  private readonly secret: string;
  private readonly accessTokenTTL: number;
  private readonly refreshTokenTTL: number;

  constructor(config: JWTConfig) {
    if (!config.secret || config.secret.length < 16) {
      throw new Error('JWT secret must be at least 16 characters');
    }
    this.secret = config.secret;
    this.accessTokenTTL = config.accessTokenTTL ?? 3600;
    this.refreshTokenTTL = config.refreshTokenTTL ?? 604800;
  }

  /**
   * Generate an access token for a subject with a given role.
   */
  generateAccessToken(sub: string, role: string): string {
    return this.generateToken(sub, role, 'access', this.accessTokenTTL);
  }

  /**
   * Generate a refresh token for a subject with a given role.
   */
  generateRefreshToken(sub: string, role: string): string {
    return this.generateToken(sub, role, 'refresh', this.refreshTokenTTL);
  }

  /**
   * Verify a token's signature and expiration. Throws on failure.
   */
  verify(token: string): JWTPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;

    // Timing-safe signature comparison
    const expectedSig = sign(data, this.secret);
    const sigBuf = Buffer.from(signature, 'base64url');
    const expectedBuf = Buffer.from(expectedSig, 'base64url');

    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      logger.warn('JWT verification failed: invalid signature');
      throw new Error('Invalid token signature');
    }

    const decoded = this.decode(token);

    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp <= now) {
      logger.warn('JWT verification failed: token expired', { sub: decoded.sub, exp: decoded.exp });
      throw new Error('Token expired');
    }

    return decoded;
  }

  /**
   * Decode a token's payload without verifying the signature.
   */
  decode(token: string): JWTPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    try {
      const payload = JSON.parse(base64urlDecode(parts[1])) as JWTPayload;
      return payload;
    } catch {
      throw new Error('Invalid token payload');
    }
  }

  private generateToken(sub: string, role: string, type: 'access' | 'refresh', ttl: number): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      sub,
      role,
      iat: now,
      exp: now + ttl,
      type,
    };

    const encodedPayload = base64urlEncode(JSON.stringify(payload));
    const data = `${JWT_HEADER}.${encodedPayload}`;
    const signature = sign(data, this.secret);

    return `${data}.${signature}`;
  }
}

export function createJWTService(config: JWTConfig): JWTService {
  return new JWTService(config);
}
