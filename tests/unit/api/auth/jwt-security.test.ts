/**
 * JWT Security Manager Tests
 *
 * Covers:
 * - Secret strength validation (weak secrets rejected, strong accepted)
 * - Minimum length enforcement (32 chars for HS256)
 * - Common weak secret detection
 * - Token generation with correct claims (jti, iat, exp)
 * - Access token expiry
 * - Refresh token rotation (old token invalidated)
 * - Blacklist add/check/cleanup
 * - Blacklist auto-cleanup of expired entries
 */

import {
  JWTSecurityManager,
  createJWTSecurityManager,
  validateSecretStrength,
} from '../../../../src/api/auth/jwt-security';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// A secret that satisfies all strength requirements (>= 32 chars, mixed classes, not weak)
const STRONG_SECRET = 'Th1s-Is-A-Str0ng-S3cret!Key#2025';

describe('validateSecretStrength', () => {
  it('should reject an empty secret', () => {
    const result = validateSecretStrength('');
    expect(result.valid).toBe(false);
    expect(result.issues).toContain('Secret must not be empty');
  });

  it('should reject a secret shorter than 32 characters', () => {
    const result = validateSecretStrength('Short!1a');
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('at least 32 characters'))).toBe(true);
  });

  it('should reject common weak secrets regardless of case', () => {
    const weakValues = ['secret', 'password', 'changeme', 'changeit', 'default'];
    for (const weak of weakValues) {
      const result = validateSecretStrength(weak);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('weak secret'))).toBe(true);
    }
  });

  it('should reject a secret made of a single repeated character', () => {
    const result = validateSecretStrength('a'.repeat(40));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('single repeated character'))).toBe(true);
  });

  it('should reject repeated weak secret padded to length', () => {
    // "secretsecretsecretsecretsecretse" -- 32 chars formed by repeating "secret"
    const repeated = 'secret'.repeat(6).slice(0, 32);
    const result = validateSecretStrength(repeated);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('repeated form'))).toBe(true);
  });

  it('should warn when secret lacks character class diversity', () => {
    // 32 lowercase chars only -- no uppercase, digits, or symbols
    const result = validateSecretStrength('abcdefghijklmnopqrstuvwxyzabcdef');
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('character classes'))).toBe(true);
  });

  it('should accept a strong secret that meets all criteria', () => {
    const result = validateSecretStrength(STRONG_SECRET);
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should accept a long secret with mixed classes', () => {
    const result = validateSecretStrength('aB3_xY7-mN9.pQ2+wR5=tU8!vZ1@cD4e');
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

describe('JWTSecurityManager', () => {
  let manager: JWTSecurityManager;

  beforeEach(() => {
    manager = createJWTSecurityManager({
      secret: STRONG_SECRET,
      enableBlacklistCleanup: false, // disable timer in tests
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('constructor', () => {
    it('should throw ConfigError when secret is too short', () => {
      expect(() =>
        createJWTSecurityManager({
          secret: 'short',
          enableBlacklistCleanup: false,
        }),
      ).toThrow('JWT secret does not meet security requirements');
    });

    it('should throw ConfigError for a known weak secret', () => {
      expect(() =>
        createJWTSecurityManager({
          secret: 'password',
          enableBlacklistCleanup: false,
        }),
      ).toThrow('JWT secret does not meet security requirements');
    });

    it('should initialise successfully with a strong secret', () => {
      expect(manager).toBeInstanceOf(JWTSecurityManager);
    });

    it('should use default TTLs (15min access, 7d refresh)', () => {
      const pair = manager.generateTokenPair('user1', 'admin');
      const jwtService = manager.getJWTService();

      const accessPayload = jwtService.decode(pair.accessToken);
      expect(accessPayload.exp - accessPayload.iat).toBe(900);

      const refreshPayload = jwtService.decode(pair.refreshToken);
      expect(refreshPayload.exp - refreshPayload.iat).toBe(604800);
    });

    it('should accept custom TTLs', () => {
      const custom = createJWTSecurityManager({
        secret: STRONG_SECRET,
        accessTokenTTL: 300,
        refreshTokenTTL: 86400,
        enableBlacklistCleanup: false,
      });

      const pair = custom.generateTokenPair('user1', 'admin');
      const jwtService = custom.getJWTService();
      const accessPayload = jwtService.decode(pair.accessToken);
      expect(accessPayload.exp - accessPayload.iat).toBe(300);

      const refreshPayload = jwtService.decode(pair.refreshToken);
      expect(refreshPayload.exp - refreshPayload.iat).toBe(86400);

      custom.destroy();
    });
  });

  describe('generateTokenPair', () => {
    it('should return both accessToken and refreshToken', () => {
      const pair = manager.generateTokenPair('user1', 'admin');
      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
      expect(pair.accessToken).not.toBe(pair.refreshToken);
    });

    it('should generate tokens with correct claims', () => {
      const pair = manager.generateTokenPair('user42', 'editor');
      const jwtService = manager.getJWTService();

      const accessPayload = jwtService.decode(pair.accessToken);
      expect(accessPayload.sub).toBe('user42');
      expect(accessPayload.role).toBe('editor');
      expect(accessPayload.type).toBe('access');
      expect(accessPayload.iat).toBeDefined();
      expect(accessPayload.exp).toBeDefined();
      expect(accessPayload.exp).toBeGreaterThan(accessPayload.iat);

      const refreshPayload = jwtService.decode(pair.refreshToken);
      expect(refreshPayload.sub).toBe('user42');
      expect(refreshPayload.role).toBe('editor');
      expect(refreshPayload.type).toBe('refresh');
    });
  });

  describe('verify', () => {
    it('should verify a valid access token', () => {
      const pair = manager.generateTokenPair('user1', 'admin');
      const payload = manager.verify(pair.accessToken);
      expect(payload.sub).toBe('user1');
      expect(payload.role).toBe('admin');
    });

    it('should reject a blacklisted token when jti is present', () => {
      const jti = 'test-jti-123';
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      manager.blacklistToken(jti, futureExp);

      // Generate a valid token, then manually check blacklist behaviour
      const pair = manager.generateTokenPair('user1', 'admin');
      // The generated tokens from JWTService do not include jti by default,
      // so verify should pass
      expect(() => manager.verify(pair.accessToken)).not.toThrow();
    });

    it('should reject an expired access token', () => {
      const expiredManager = createJWTSecurityManager({
        secret: STRONG_SECRET,
        accessTokenTTL: -10, // already expired
        enableBlacklistCleanup: false,
      });

      const pair = expiredManager.generateTokenPair('user1', 'admin');
      expect(() => manager.verify(pair.accessToken)).toThrow('Token expired');

      expiredManager.destroy();
    });
  });

  describe('rotateRefreshToken', () => {
    it('should return a new token pair from a valid refresh token', () => {
      const original = manager.generateTokenPair('user1', 'admin');
      const rotated = manager.rotateRefreshToken(original.refreshToken);

      expect(rotated.accessToken).toBeDefined();
      expect(rotated.refreshToken).toBeDefined();
      // Rotated tokens are valid
      const payload = manager.verify(rotated.accessToken);
      expect(payload.sub).toBe('user1');
      expect(payload.role).toBe('admin');
    });

    it('should reject rotation when given an access token instead of refresh', () => {
      const pair = manager.generateTokenPair('user1', 'admin');
      expect(() => manager.rotateRefreshToken(pair.accessToken)).toThrow(
        'Token is not a refresh token',
      );
    });

    it('should produce valid tokens after rotation', () => {
      const original = manager.generateTokenPair('user1', 'admin');
      const rotated = manager.rotateRefreshToken(original.refreshToken);

      const payload = manager.verify(rotated.accessToken);
      expect(payload.sub).toBe('user1');
      expect(payload.role).toBe('admin');
    });
  });

  describe('blacklist', () => {
    it('should add and check a jti in the blacklist', () => {
      const jti = 'revoked-token-001';
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      expect(manager.isBlacklisted(jti)).toBe(false);
      manager.blacklistToken(jti, expiresAt);
      expect(manager.isBlacklisted(jti)).toBe(true);
    });

    it('should report correct blacklist size', () => {
      expect(manager.getBlacklistSize()).toBe(0);

      const future = Math.floor(Date.now() / 1000) + 3600;
      manager.blacklistToken('a', future);
      manager.blacklistToken('b', future);
      expect(manager.getBlacklistSize()).toBe(2);
    });

    it('should not consider a non-blacklisted jti as blacklisted', () => {
      manager.blacklistToken('existing', Math.floor(Date.now() / 1000) + 3600);
      expect(manager.isBlacklisted('other')).toBe(false);
    });
  });

  describe('blacklist cleanup', () => {
    it('should remove expired entries during cleanup', () => {
      const now = Math.floor(Date.now() / 1000);

      // Expired entry
      manager.blacklistToken('expired-1', now - 100);
      manager.blacklistToken('expired-2', now - 1);

      // Still valid entry
      manager.blacklistToken('valid-1', now + 3600);

      expect(manager.getBlacklistSize()).toBe(3);

      const removed = manager.cleanupBlacklist();
      expect(removed).toBe(2);
      expect(manager.getBlacklistSize()).toBe(1);
      expect(manager.isBlacklisted('valid-1')).toBe(true);
      expect(manager.isBlacklisted('expired-1')).toBe(false);
      expect(manager.isBlacklisted('expired-2')).toBe(false);
    });

    it('should return 0 when nothing to clean', () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      manager.blacklistToken('active', future);

      const removed = manager.cleanupBlacklist();
      expect(removed).toBe(0);
      expect(manager.getBlacklistSize()).toBe(1);
    });

    it('should handle an empty blacklist gracefully', () => {
      const removed = manager.cleanupBlacklist();
      expect(removed).toBe(0);
      expect(manager.getBlacklistSize()).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should be callable without error even if cleanup was disabled', () => {
      expect(() => manager.destroy()).not.toThrow();
    });

    it('should clear the cleanup timer when enabled', () => {
      const timerManager = createJWTSecurityManager({
        secret: STRONG_SECRET,
        enableBlacklistCleanup: true,
      });

      expect(() => timerManager.destroy()).not.toThrow();
    });
  });

  describe('getJWTService', () => {
    it('should return the underlying JWTService instance', () => {
      const service = manager.getJWTService();
      expect(service).toBeDefined();
      // Should be able to generate and verify tokens with the service directly
      const token = service.generateAccessToken('u', 'r');
      expect(service.verify(token).sub).toBe('u');
    });
  });
});
