/**
 * JWT Service Tests
 */

import { createJWTService, JWTService } from '../../../../src/api/auth/jwt';
import type { JWTPayload } from '../../../../src/api/auth/jwt';

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const TEST_SECRET = 'test-secret-key-that-is-long-enough';

describe('JWTService', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    jwtService = createJWTService({ secret: TEST_SECRET });
  });

  describe('constructor', () => {
    it('should throw if secret is too short', () => {
      expect(() => createJWTService({ secret: 'short' })).toThrow(
        'JWT secret must be at least 16 characters',
      );
    });

    it('should use default TTL values when not provided', () => {
      const service = createJWTService({ secret: TEST_SECRET });
      const token = service.generateAccessToken('user1', 'admin');
      const payload = service.decode(token);
      expect(payload.exp - payload.iat).toBe(3600);
    });

    it('should accept custom TTL values', () => {
      const service = createJWTService({
        secret: TEST_SECRET,
        accessTokenTTL: 1800,
        refreshTokenTTL: 86400,
      });

      const accessToken = service.generateAccessToken('user1', 'admin');
      const accessPayload = service.decode(accessToken);
      expect(accessPayload.exp - accessPayload.iat).toBe(1800);

      const refreshToken = service.generateRefreshToken('user1', 'admin');
      const refreshPayload = service.decode(refreshToken);
      expect(refreshPayload.exp - refreshPayload.iat).toBe(86400);
    });
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT string with three parts', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should include correct payload fields', () => {
      const token = jwtService.generateAccessToken('user42', 'editor');
      const payload = jwtService.decode(token);

      expect(payload.sub).toBe('user42');
      expect(payload.role).toBe('editor');
      expect(payload.type).toBe('access');
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('should encode HS256 algorithm in header', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const headerStr = Buffer.from(token.split('.')[0], 'base64url').toString('utf8');
      const header = JSON.parse(headerStr);
      expect(header).toEqual({ alg: 'HS256', typ: 'JWT' });
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token with longer TTL', () => {
      const token = jwtService.generateRefreshToken('user1', 'admin');
      const payload = jwtService.decode(token);

      expect(payload.type).toBe('refresh');
      expect(payload.exp - payload.iat).toBe(604800);
    });
  });

  describe('verify', () => {
    it('should verify a valid access token', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const payload = jwtService.verify(token);

      expect(payload.sub).toBe('user1');
      expect(payload.role).toBe('admin');
      expect(payload.type).toBe('access');
    });

    it('should verify a valid refresh token', () => {
      const token = jwtService.generateRefreshToken('user2', 'viewer');
      const payload = jwtService.verify(token);

      expect(payload.sub).toBe('user2');
      expect(payload.role).toBe('viewer');
      expect(payload.type).toBe('refresh');
    });

    it('should reject a tampered payload', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const parts = token.split('.');

      // Tamper with payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.role = 'superadmin';
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');

      const tamperedToken = parts.join('.');
      expect(() => jwtService.verify(tamperedToken)).toThrow('Invalid token signature');
    });

    it('should reject an expired token', () => {
      const service = createJWTService({
        secret: TEST_SECRET,
        accessTokenTTL: -10, // already expired
      });

      const token = service.generateAccessToken('user1', 'admin');
      expect(() => jwtService.verify(token)).toThrow('Token expired');
    });

    it('should reject a token with invalid format (no dots)', () => {
      expect(() => jwtService.verify('not-a-valid-token')).toThrow('Invalid token format');
    });

    it('should reject a token with only two parts', () => {
      expect(() => jwtService.verify('part1.part2')).toThrow('Invalid token format');
    });

    it('should reject a token signed with a different secret', () => {
      const otherService = createJWTService({ secret: 'another-secret-that-is-long-enough' });
      const token = otherService.generateAccessToken('user1', 'admin');

      expect(() => jwtService.verify(token)).toThrow('Invalid token signature');
    });
  });

  describe('decode', () => {
    it('should decode payload without verification', () => {
      const otherService = createJWTService({ secret: 'another-secret-that-is-long-enough' });
      const token = otherService.generateAccessToken('user1', 'admin');

      // Should not throw even though signed with different secret
      const payload: JWTPayload = jwtService.decode(token);
      expect(payload.sub).toBe('user1');
      expect(payload.role).toBe('admin');
    });

    it('should throw on invalid token format', () => {
      expect(() => jwtService.decode('invalid')).toThrow('Invalid token format');
    });

    it('should throw on invalid base64 payload', () => {
      expect(() => jwtService.decode('header.!!!invalid!!!.sig')).toThrow('Invalid token payload');
    });
  });
});
