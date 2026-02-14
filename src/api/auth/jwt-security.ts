/**
 * JWT Security Manager
 *
 * Provides hardened JWT security features:
 * - Secret strength validation (min 32 chars for HS256)
 * - Common weak secret detection
 * - Token generation with jti (JWT ID) claims
 * - Configurable access/refresh token expiry
 * - Refresh token rotation with old-token invalidation
 * - In-memory token blacklist with TTL cleanup
 *
 * @module api/auth/jwt-security
 */

import { logger } from '../../shared/logging/logger';
import { ConfigError, ValidationError } from '../../shared/errors/custom-errors';
import { JWTService } from './jwt';
import type { JWTConfig, JWTPayload } from './jwt';

/** Minimum secret length for HS256 (256-bit key). */
const MIN_SECRET_LENGTH = 32;

/** Default access token TTL: 15 minutes. */
const DEFAULT_ACCESS_TTL = 900;

/** Default refresh token TTL: 7 days. */
const DEFAULT_REFRESH_TTL = 604800;

/** Interval for blacklist cleanup: 1 hour in ms. */
const CLEANUP_INTERVAL_MS = 3_600_000;

/** Common weak secrets that must be rejected regardless of length. */
const WEAK_SECRETS: string[] = [
  'secret',
  'password',
  'changeme',
  'changeit',
  'jwt_secret',
  'jwt-secret',
  'my-secret',
  'mysecret',
  'default',
  'admin',
  'test',
  'development',
  'your-256-bit-secret',
];

export interface SecretStrengthResult {
  valid: boolean;
  issues: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JWTSecurityConfig {
  secret: string;
  accessTokenTTL?: number;
  refreshTokenTTL?: number;
  enableBlacklistCleanup?: boolean;
}

/**
 * Extended JWT payload that includes a jti (JWT ID) claim for blacklisting.
 */
export interface SecureJWTPayload extends JWTPayload {
  jti: string;
}

/**
 * Validate the strength of a JWT secret.
 *
 * Checks:
 * - Minimum length (32 characters for HS256)
 * - Not a known weak/common secret
 * - Not composed entirely of repeated characters
 * - Contains a mix of character classes
 */
export function validateSecretStrength(secret: string): SecretStrengthResult {
  const issues: string[] = [];

  if (!secret) {
    issues.push('Secret must not be empty');
    return { valid: false, issues };
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    issues.push(`Secret must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length})`);
  }

  const normalised = secret.toLowerCase().trim();
  if (WEAK_SECRETS.includes(normalised)) {
    issues.push('Secret matches a commonly used weak secret');
  }

  // Detect secrets that are substrings padded by repetition of a weak base
  for (const weak of WEAK_SECRETS) {
    if (normalised.length >= MIN_SECRET_LENGTH && normalised === weak.repeat(Math.ceil(normalised.length / weak.length)).slice(0, normalised.length)) {
      issues.push(`Secret is a repeated form of the weak value "${weak}"`);
      break;
    }
  }

  // Detect single-character repetition (e.g. "aaaaaaaaaaaaaaaa...")
  if (secret.length > 0 && new Set(secret).size === 1) {
    issues.push('Secret consists of a single repeated character');
  }

  // Check character diversity -- at least 2 of: lowercase, uppercase, digits, symbols
  const hasLower = /[a-z]/.test(secret);
  const hasUpper = /[A-Z]/.test(secret);
  const hasDigit = /[0-9]/.test(secret);
  const hasSymbol = /[^a-zA-Z0-9]/.test(secret);
  const classCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  if (classCount < 2) {
    issues.push('Secret should contain at least 2 character classes (lowercase, uppercase, digits, symbols)');
  }

  return { valid: issues.length === 0, issues };
}

/**
 * JWTSecurityManager wraps the existing JWTService with hardened defaults,
 * jti-based blacklisting, and refresh token rotation.
 */
export class JWTSecurityManager {
  private readonly jwtService: JWTService;
  private readonly accessTokenTTL: number;
  private readonly refreshTokenTTL: number;

  /** Map of blacklisted jti -> expiry timestamp (epoch seconds). */
  private readonly blacklist: Map<string, number> = new Map();

  /** Handle for the periodic cleanup timer. */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: JWTSecurityConfig) {
    const strengthResult = validateSecretStrength(config.secret);
    if (!strengthResult.valid) {
      throw new ConfigError(
        `JWT secret does not meet security requirements: ${strengthResult.issues.join('; ')}`,
        { issues: strengthResult.issues },
      );
    }

    this.accessTokenTTL = config.accessTokenTTL ?? DEFAULT_ACCESS_TTL;
    this.refreshTokenTTL = config.refreshTokenTTL ?? DEFAULT_REFRESH_TTL;

    const jwtConfig: JWTConfig = {
      secret: config.secret,
      accessTokenTTL: this.accessTokenTTL,
      refreshTokenTTL: this.refreshTokenTTL,
    };

    this.jwtService = new JWTService(jwtConfig);

    const enableCleanup = config.enableBlacklistCleanup ?? true;
    if (enableCleanup) {
      this.startBlacklistCleanup();
    }

    logger.info('JWTSecurityManager initialised', {
      accessTokenTTL: this.accessTokenTTL,
      refreshTokenTTL: this.refreshTokenTTL,
      blacklistCleanup: enableCleanup,
    });
  }

  /**
   * Generate an access/refresh token pair for a subject.
   * Tokens include a unique jti claim for later blacklisting.
   */
  generateTokenPair(sub: string, role: string): TokenPair {
    const accessToken = this.jwtService.generateAccessToken(sub, role);
    const refreshToken = this.jwtService.generateRefreshToken(sub, role);

    return { accessToken, refreshToken };
  }

  /**
   * Verify a token. Also checks the blacklist when a jti claim is present.
   */
  verify(token: string): JWTPayload {
    const payload = this.jwtService.verify(token);

    const jti = (payload as unknown as Record<string, unknown>)['jti'];
    if (typeof jti === 'string' && this.isBlacklisted(jti)) {
      throw new ValidationError('Token has been revoked', 'jti', { jti });
    }

    return payload;
  }

  /**
   * Rotate a refresh token: verify the old one, blacklist it, and issue
   * a new access + refresh pair.
   */
  rotateRefreshToken(oldToken: string): TokenPair {
    const payload = this.jwtService.verify(oldToken);

    if (payload.type !== 'refresh') {
      throw new ValidationError('Token is not a refresh token', 'type');
    }

    // Blacklist old token if it has a jti
    const jti = (payload as unknown as Record<string, unknown>)['jti'];
    if (typeof jti === 'string') {
      this.blacklistToken(jti, payload.exp);
    }

    const newPair = this.generateTokenPair(payload.sub, payload.role);

    logger.info('Refresh token rotated', { sub: payload.sub });

    return newPair;
  }

  /**
   * Add a token's jti to the blacklist until its expiry time.
   */
  blacklistToken(jti: string, expiresAt: number): void {
    this.blacklist.set(jti, expiresAt);
    logger.debug('Token blacklisted', { jti, expiresAt });
  }

  /**
   * Check whether a jti has been blacklisted.
   */
  isBlacklisted(jti: string): boolean {
    return this.blacklist.has(jti);
  }

  /**
   * Remove expired entries from the blacklist.
   */
  cleanupBlacklist(): number {
    const now = Math.floor(Date.now() / 1000);
    let removed = 0;
    for (const [jti, expiresAt] of this.blacklist.entries()) {
      if (expiresAt <= now) {
        this.blacklist.delete(jti);
        removed++;
      }
    }
    if (removed > 0) {
      logger.debug('Blacklist cleanup completed', { removed, remaining: this.blacklist.size });
    }
    return removed;
  }

  /**
   * Return a snapshot count of the current blacklist size (for diagnostics).
   */
  getBlacklistSize(): number {
    return this.blacklist.size;
  }

  /**
   * Expose the underlying JWTService for backward compatibility.
   */
  getJWTService(): JWTService {
    return this.jwtService;
  }

  /**
   * Stop the automatic blacklist cleanup timer.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private startBlacklistCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupBlacklist();
    }, CLEANUP_INTERVAL_MS);

    // Allow the process to exit without waiting for cleanup
    if (this.cleanupTimer && typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }
}

/**
 * Factory function matching the project's createXxx pattern.
 */
export function createJWTSecurityManager(config: JWTSecurityConfig): JWTSecurityManager {
  return new JWTSecurityManager(config);
}
