/**
 * JWT Service Unit Tests
 *
 * Feature: F4.4 - API Authentication
 *
 * @module tests/unit/api/auth/services/jwt.service
 */

import { JwtService, createJwtService } from '../../../../../src/api/auth/services/jwt.service';
import {
  TokenType,
  JwtConfig,
} from '../../../../../src/api/auth/interfaces/auth.interface';

describe('JwtService', () => {
  let jwtService: JwtService;
  const testConfig: Partial<JwtConfig> = {
    secret: 'test-secret-key-for-testing-purposes-only',
    issuer: 'test-issuer',
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
  };

  beforeEach(() => {
    jwtService = new JwtService(testConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const service = new JwtService();
      expect(service).toBeInstanceOf(JwtService);
    });

    it('should create service with custom config', () => {
      const customConfig: Partial<JwtConfig> = {
        secret: 'custom-secret',
        issuer: 'custom-issuer',
        accessTokenExpiry: '30m',
      };
      const service = new JwtService(customConfig);
      expect(service).toBeInstanceOf(JwtService);
    });
  });

  describe('generateTokens', () => {
    it('should generate valid token pair', async () => {
      const userId = 'user-123';
      const result = await jwtService.generateTokens(userId);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(15 * 60); // 15 minutes in seconds
    });

    it('should generate tokens with custom claims', async () => {
      const userId = 'user-123';
      const claims = {
        permissions: ['read', 'write'],
        roles: ['admin'],
      };

      const result = await jwtService.generateTokens(userId, claims);

      expect(result.accessToken).toBeDefined();

      // Verify claims are included
      const decoded = jwtService.decodeToken(result.accessToken);
      expect(decoded).toBeDefined();
      expect(decoded?.permissions).toEqual(['read', 'write']);
      expect(decoded?.roles).toEqual(['admin']);
    });

    it('should generate unique tokens on each call', async () => {
      const userId = 'user-123';

      const result1 = await jwtService.generateTokens(userId);
      const result2 = await jwtService.generateTokens(userId);

      expect(result1.accessToken).not.toBe(result2.accessToken);
      expect(result1.refreshToken).not.toBe(result2.refreshToken);
    });

    it('should generate tokens with correct type', async () => {
      const userId = 'user-123';
      const result = await jwtService.generateTokens(userId);

      const accessDecoded = jwtService.decodeToken(result.accessToken);
      const refreshDecoded = jwtService.decodeToken(result.refreshToken);

      expect(accessDecoded?.type).toBe(TokenType.ACCESS);
      expect(refreshDecoded?.type).toBe(TokenType.REFRESH);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const userId = 'user-123';
      const { accessToken } = await jwtService.generateTokens(userId);

      const result = await jwtService.verifyAccessToken(accessToken);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.sub).toBe(userId);
      expect(result.payload?.type).toBe(TokenType.ACCESS);
    });

    it('should reject invalid token', async () => {
      const result = await jwtService.verifyAccessToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('TOKEN_MALFORMED');
    });

    it('should reject refresh token as access token', async () => {
      const userId = 'user-123';
      const { refreshToken } = await jwtService.generateTokens(userId);

      const result = await jwtService.verifyAccessToken(refreshToken);

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Expected access token');
    });

    it('should reject expired token', async () => {
      // Create service with very short expiry and no clock tolerance
      const shortExpiryService = new JwtService({
        ...testConfig,
        accessTokenExpiry: '1s',
        clockTolerance: 0,
      });

      const { accessToken } = await shortExpiryService.generateTokens('user-123');

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const result = await shortExpiryService.verifyAccessToken(accessToken);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject token with wrong signature', async () => {
      const otherService = new JwtService({
        secret: 'different-secret',
        issuer: 'test-issuer',
      });

      const { accessToken } = await otherService.generateTokens('user-123');
      const result = await jwtService.verifyAccessToken(accessToken);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('SIGNATURE_INVALID');
    });

    it('should reject token with wrong issuer', async () => {
      const otherService = new JwtService({
        secret: testConfig.secret,
        issuer: 'wrong-issuer',
      });

      const { accessToken } = await otherService.generateTokens('user-123');
      const result = await jwtService.verifyAccessToken(accessToken);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('ISSUER_INVALID');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', async () => {
      const userId = 'user-123';
      const { refreshToken } = await jwtService.generateTokens(userId);

      const result = await jwtService.verifyRefreshToken(refreshToken);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.sub).toBe(userId);
      expect(result.payload?.type).toBe(TokenType.REFRESH);
    });

    it('should reject access token as refresh token', async () => {
      const userId = 'user-123';
      const { accessToken } = await jwtService.generateTokens(userId);

      const result = await jwtService.verifyRefreshToken(accessToken);

      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Expected refresh token');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const userId = 'user-123';
      const claims = { permissions: ['read'] };
      const { refreshToken } = await jwtService.generateTokens(userId, claims);

      const newTokens = await jwtService.refreshTokens(refreshToken);

      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();

      // Verify new tokens are valid
      const verifyResult = await jwtService.verifyAccessToken(newTokens.accessToken);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.payload?.sub).toBe(userId);
      expect(verifyResult.payload?.permissions).toEqual(['read']);
    });

    it('should revoke old refresh token after refresh', async () => {
      const { refreshToken } = await jwtService.generateTokens('user-123');

      await jwtService.refreshTokens(refreshToken);

      // Old refresh token should be invalid now
      const verifyResult = await jwtService.verifyRefreshToken(refreshToken);
      expect(verifyResult.valid).toBe(false);
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(jwtService.refreshTokens('invalid-token')).rejects.toThrow();
    });

    it('should throw error for access token', async () => {
      const { accessToken } = await jwtService.generateTokens('user-123');

      await expect(jwtService.refreshTokens(accessToken)).rejects.toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode valid token without verification', async () => {
      const userId = 'user-123';
      const { accessToken } = await jwtService.generateTokens(userId);

      const decoded = jwtService.decodeToken(accessToken);

      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe(userId);
      expect(decoded?.iss).toBe('test-issuer');
      expect(decoded?.type).toBe(TokenType.ACCESS);
    });

    it('should decode token even with wrong secret', async () => {
      const otherService = new JwtService({
        secret: 'different-secret',
        issuer: 'test-issuer',
      });

      const { accessToken } = await otherService.generateTokens('user-123');

      // Should still decode (without verification)
      const decoded = jwtService.decodeToken(accessToken);
      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe('user-123');
    });

    it('should return null for invalid token', () => {
      const decoded = jwtService.decodeToken('invalid-token');
      expect(decoded).toBeNull();
    });
  });

  describe('revokeToken', () => {
    it('should revoke token by jti', async () => {
      const { accessToken } = await jwtService.generateTokens('user-123');
      const decoded = jwtService.decodeToken(accessToken);

      await jwtService.revokeToken(decoded!.jti);

      const verifyResult = await jwtService.verifyAccessToken(accessToken);
      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.error?.message).toContain('revoked');
    });

    it('should track revoked tokens', async () => {
      const jti = 'test-jti-123';

      await jwtService.revokeToken(jti);

      expect(await jwtService.isTokenRevoked(jti)).toBe(true);
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for a user', async () => {
      const userId = 'user-123';
      const { accessToken } = await jwtService.generateTokens(userId);

      await jwtService.revokeAllUserTokens(userId);

      const verifyResult = await jwtService.verifyAccessToken(accessToken);
      expect(verifyResult.valid).toBe(false);
    });

    it('should not affect tokens from other users', async () => {
      const { accessToken: token1 } = await jwtService.generateTokens('user-1');
      const { accessToken: token2 } = await jwtService.generateTokens('user-2');

      await jwtService.revokeAllUserTokens('user-1');

      const result1 = await jwtService.verifyAccessToken(token1);
      const result2 = await jwtService.verifyAccessToken(token2);

      expect(result1.valid).toBe(false);
      expect(result2.valid).toBe(true);
    });
  });

  describe('isTokenRevoked', () => {
    it('should return false for non-revoked token', async () => {
      const result = await jwtService.isTokenRevoked('non-existent-jti');
      expect(result).toBe(false);
    });

    it('should return true for revoked token', async () => {
      const jti = 'revoked-jti';
      await jwtService.revokeToken(jti);

      const result = await jwtService.isTokenRevoked(jti);
      expect(result).toBe(true);
    });
  });

  describe('createJwtService factory', () => {
    it('should create JwtService instance', () => {
      const service = createJwtService(testConfig);
      expect(service).toBeDefined();
    });

    it('should create service with default config', () => {
      const service = createJwtService();
      expect(service).toBeDefined();
    });
  });
});
