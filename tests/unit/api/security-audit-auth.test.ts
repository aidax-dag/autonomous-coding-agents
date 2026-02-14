/**
 * Security Audit: Authentication (JWT + API Key)
 *
 * Validates security properties of the JWT token service and API key
 * validation. Tests focus on token forgery prevention, expiration
 * enforcement, timing-safe comparison, and information leakage prevention.
 *
 * @module tests/unit/api/security-audit-auth
 */

import { createJWTService, JWTService } from '../../../src/api/auth/jwt';
import type { JWTPayload } from '../../../src/api/auth/jwt';
import { createAPIKeyService, APIKeyService } from '../../../src/api/auth/api-key';

jest.mock('../../../src/shared/logging/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  createAgentLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const TEST_SECRET = 'test-secret-key-that-is-long-enough';

describe('Security Audit: JWT Service', () => {
  let jwtService: JWTService;

  beforeEach(() => {
    jwtService = createJWTService({ secret: TEST_SECRET });
  });

  // ==========================================================================
  // Token Expiration Enforcement
  // ==========================================================================

  describe('token expiration enforcement', () => {
    it('should reject tokens that have expired', () => {
      const service = createJWTService({
        secret: TEST_SECRET,
        accessTokenTTL: -10, // Already expired
      });
      const token = service.generateAccessToken('user1', 'admin');
      expect(() => jwtService.verify(token)).toThrow('Token expired');
    });

    it('should reject tokens with exp exactly at current time', () => {
      // Generate a token and manually check the boundary condition
      const service = createJWTService({
        secret: TEST_SECRET,
        accessTokenTTL: 0, // Expires immediately (exp = iat)
      });
      const token = service.generateAccessToken('user1', 'admin');
      // exp <= now means expired
      expect(() => jwtService.verify(token)).toThrow('Token expired');
    });

    it('should accept tokens that have not yet expired', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const payload = jwtService.verify(token);
      expect(payload.sub).toBe('user1');
      expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should enforce different TTLs for access vs refresh tokens', () => {
      const accessToken = jwtService.generateAccessToken('user1', 'admin');
      const refreshToken = jwtService.generateRefreshToken('user1', 'admin');

      const accessPayload = jwtService.decode(accessToken);
      const refreshPayload = jwtService.decode(refreshToken);

      // Refresh token should have a longer TTL than access token
      const accessTTL = accessPayload.exp - accessPayload.iat;
      const refreshTTL = refreshPayload.exp - refreshPayload.iat;
      expect(refreshTTL).toBeGreaterThan(accessTTL);
    });
  });

  // ==========================================================================
  // Invalid Signature Rejection
  // ==========================================================================

  describe('invalid signature rejection', () => {
    it('should reject tokens signed with a different secret', () => {
      const otherService = createJWTService({
        secret: 'another-secret-that-is-definitely-long-enough',
      });
      const token = otherService.generateAccessToken('user1', 'admin');
      expect(() => jwtService.verify(token)).toThrow('Invalid token signature');
    });

    it('should reject tokens with an empty signature', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.`;
      expect(() => jwtService.verify(tamperedToken)).toThrow();
    });

    it('should reject tokens with a completely fabricated signature', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const parts = token.split('.');
      const tamperedToken = `${parts[0]}.${parts[1]}.fabricated_signature_abc123`;
      expect(() => jwtService.verify(tamperedToken)).toThrow('Invalid token signature');
    });
  });

  // ==========================================================================
  // Tampered Payload Detection
  // ==========================================================================

  describe('tampered payload detection', () => {
    it('should detect role escalation in payload', () => {
      const token = jwtService.generateAccessToken('user1', 'viewer');
      const parts = token.split('.');

      // Tamper: escalate role from viewer to admin
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.role = 'admin';
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');

      const tamperedToken = parts.join('.');
      expect(() => jwtService.verify(tamperedToken)).toThrow('Invalid token signature');
    });

    it('should detect subject (sub) modification in payload', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const parts = token.split('.');

      // Tamper: change subject to impersonate another user
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.sub = 'admin-user';
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');

      const tamperedToken = parts.join('.');
      expect(() => jwtService.verify(tamperedToken)).toThrow('Invalid token signature');
    });

    it('should detect expiration extension in payload', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const parts = token.split('.');

      // Tamper: extend expiration by a year
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.exp = payload.exp + 31536000; // +1 year
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');

      const tamperedToken = parts.join('.');
      expect(() => jwtService.verify(tamperedToken)).toThrow('Invalid token signature');
    });

    it('should detect token type change (access -> refresh)', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const parts = token.split('.');

      // Tamper: change type from access to refresh (longer lived)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      payload.type = 'refresh';
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64url');

      const tamperedToken = parts.join('.');
      expect(() => jwtService.verify(tamperedToken)).toThrow('Invalid token signature');
    });
  });

  // ==========================================================================
  // Missing Required Claims Rejection
  // ==========================================================================

  describe('token format validation', () => {
    it('should reject tokens with missing parts (no dots)', () => {
      expect(() => jwtService.verify('singlepart')).toThrow('Invalid token format');
    });

    it('should reject tokens with only two parts', () => {
      expect(() => jwtService.verify('part1.part2')).toThrow('Invalid token format');
    });

    it('should reject tokens with more than three parts', () => {
      expect(() => jwtService.verify('a.b.c.d')).toThrow();
    });

    it('should reject tokens with invalid base64 in payload', () => {
      expect(() => jwtService.decode('header.!!!invalid_base64!!!.signature')).toThrow(
        'Invalid token payload',
      );
    });
  });

  // ==========================================================================
  // Token Refresh Validation
  // ==========================================================================

  describe('token refresh validation', () => {
    it('should generate refresh tokens with type=refresh', () => {
      const token = jwtService.generateRefreshToken('user1', 'admin');
      const payload = jwtService.verify(token);
      expect(payload.type).toBe('refresh');
    });

    it('should generate access tokens with type=access', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const payload = jwtService.verify(token);
      expect(payload.type).toBe('access');
    });

    it('should include all required claims in generated tokens', () => {
      const token = jwtService.generateAccessToken('user1', 'admin');
      const payload = jwtService.verify(token);

      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('role');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('type');
    });

    it('should preserve user identity across access and refresh tokens', () => {
      const accessToken = jwtService.generateAccessToken('user42', 'editor');
      const refreshToken = jwtService.generateRefreshToken('user42', 'editor');

      const accessPayload = jwtService.verify(accessToken);
      const refreshPayload = jwtService.verify(refreshToken);

      expect(accessPayload.sub).toBe(refreshPayload.sub);
      expect(accessPayload.role).toBe(refreshPayload.role);
    });
  });

  // ==========================================================================
  // Secret Key Requirements
  // ==========================================================================

  describe('secret key security requirements', () => {
    it('should reject empty secret', () => {
      expect(() => createJWTService({ secret: '' })).toThrow(
        'JWT secret must be at least 16 characters',
      );
    });

    it('should reject secret shorter than 16 characters', () => {
      expect(() => createJWTService({ secret: '123456789012345' })).toThrow(
        'JWT secret must be at least 16 characters',
      );
    });

    it('should accept secret of exactly 16 characters', () => {
      expect(() => createJWTService({ secret: '1234567890123456' })).not.toThrow();
    });

    it('should produce different signatures with different secrets', () => {
      const service1 = createJWTService({ secret: 'secret-one-that-is-long' });
      const service2 = createJWTService({ secret: 'secret-two-that-is-long' });

      const token1 = service1.generateAccessToken('user1', 'admin');
      const token2 = service2.generateAccessToken('user1', 'admin');

      const sig1 = token1.split('.')[2];
      const sig2 = token2.split('.')[2];
      expect(sig1).not.toBe(sig2);
    });
  });

  // ==========================================================================
  // Decode Without Verify (Information Exposure)
  // ==========================================================================

  describe('decode without verify security implications', () => {
    it('should decode payload without signature verification', () => {
      const otherService = createJWTService({
        secret: 'completely-different-secret-key',
      });
      const token = otherService.generateAccessToken('user1', 'admin');

      // decode() should succeed even though the secret is different
      const payload = jwtService.decode(token);
      expect(payload.sub).toBe('user1');
    });

    it('should not be used as a substitute for verify() in security-critical paths', () => {
      // This test documents the security property: decode() != verify()
      const otherService = createJWTService({
        secret: 'attacker-controlled-secret-key-here',
      });
      const token = otherService.generateAccessToken('attacker', 'admin');

      // decode() works - no authentication guarantee
      const decoded = jwtService.decode(token);
      expect(decoded.sub).toBe('attacker');

      // verify() correctly rejects - proper authentication
      expect(() => jwtService.verify(token)).toThrow('Invalid token signature');
    });
  });
});

// =============================================================================
// API Key Service Security Audit
// =============================================================================

describe('Security Audit: API Key Service', () => {
  // ==========================================================================
  // Invalid Key Rejection
  // ==========================================================================

  describe('invalid key rejection', () => {
    it('should reject keys that do not match any configured key', () => {
      const service = createAPIKeyService({ keys: ['valid-key-abc-123'] });
      expect(service.validate('wrong-key-xyz-789')).toBe(false);
    });

    it('should reject empty string key', () => {
      const service = createAPIKeyService({ keys: ['valid-key-abc-123'] });
      expect(service.validate('')).toBe(false);
    });

    it('should reject keys with only whitespace difference from valid key', () => {
      const service = createAPIKeyService({ keys: ['valid-key-abc-123'] });
      expect(service.validate('valid-key-abc-123 ')).toBe(false);
      expect(service.validate(' valid-key-abc-123')).toBe(false);
    });

    it('should reject keys that are substrings of valid keys', () => {
      const service = createAPIKeyService({ keys: ['valid-key-abc-123'] });
      expect(service.validate('valid-key')).toBe(false);
      expect(service.validate('abc-123')).toBe(false);
    });

    it('should reject keys that are superstrings of valid keys', () => {
      const service = createAPIKeyService({ keys: ['valid-key'] });
      expect(service.validate('valid-key-extended')).toBe(false);
    });
  });

  // ==========================================================================
  // Key Format and Length Validation
  // ==========================================================================

  describe('key format validation', () => {
    it('should filter out empty keys from configuration', () => {
      const service = createAPIKeyService({ keys: ['', 'valid-key', ''] });
      // Empty keys should be filtered; only valid-key should work
      expect(service.validate('valid-key')).toBe(true);
      expect(service.validate('')).toBe(false);
    });

    it('should handle service initialized with no valid keys', () => {
      const service = createAPIKeyService({ keys: ['', ''] });
      expect(service.validate('any-key')).toBe(false);
    });

    it('should handle service initialized with empty keys array', () => {
      const service = createAPIKeyService({ keys: [] });
      expect(service.validate('any-key')).toBe(false);
    });
  });

  // ==========================================================================
  // Timing-Safe Comparison
  // ==========================================================================

  describe('timing-safe comparison properties', () => {
    it('should use timingSafeEqual for key comparison (verified by correct behavior)', () => {
      // While we cannot directly verify timing-safety in a unit test,
      // we verify that the comparison works correctly for equal and unequal keys
      // and that the implementation uses Buffer-based comparison
      const service = createAPIKeyService({ keys: ['correct-api-key-value'] });

      // Exact match should succeed
      expect(service.validate('correct-api-key-value')).toBe(true);

      // Near-miss keys should fail (timing-safe comparison should not short-circuit)
      expect(service.validate('correct-api-key-valuE')).toBe(false);
      expect(service.validate('Correct-api-key-value')).toBe(false);
      expect(service.validate('correct-api-key-valu')).toBe(false);
    });

    it('should reject keys of different lengths than configured keys', () => {
      const service = createAPIKeyService({ keys: ['key-12345'] });
      // Different length -> timingSafeEqual would throw, so length is checked first
      expect(service.validate('short')).toBe(false);
      expect(service.validate('key-12345-extra-long-value')).toBe(false);
    });
  });

  // ==========================================================================
  // Multiple Key Support
  // ==========================================================================

  describe('multiple key support', () => {
    it('should accept any of the configured valid keys', () => {
      const service = createAPIKeyService({
        keys: ['key-alpha', 'key-beta', 'key-gamma'],
      });
      expect(service.validate('key-alpha')).toBe(true);
      expect(service.validate('key-beta')).toBe(true);
      expect(service.validate('key-gamma')).toBe(true);
    });

    it('should reject keys not in the configured set', () => {
      const service = createAPIKeyService({
        keys: ['key-alpha', 'key-beta'],
      });
      expect(service.validate('key-delta')).toBe(false);
    });
  });

  // ==========================================================================
  // Key Revocation
  // ==========================================================================

  describe('key revocation behavior', () => {
    it('should not accept keys after service is recreated without them', () => {
      // Simulate key revocation by creating a new service without the old key
      const service1 = createAPIKeyService({ keys: ['old-key', 'current-key'] });
      expect(service1.validate('old-key')).toBe(true);

      // Revoke by not including old-key in new service
      const service2 = createAPIKeyService({ keys: ['current-key'] });
      expect(service2.validate('old-key')).toBe(false);
      expect(service2.validate('current-key')).toBe(true);
    });
  });

  // ==========================================================================
  // Header Name Configuration
  // ==========================================================================

  describe('header name configuration', () => {
    it('should use x-api-key as default header name', () => {
      const service = createAPIKeyService({ keys: ['key1'] });
      expect(service.getHeaderName()).toBe('x-api-key');
    });

    it('should use custom header name when specified', () => {
      const service = createAPIKeyService({
        keys: ['key1'],
        headerName: 'x-custom-auth',
      });
      expect(service.getHeaderName()).toBe('x-custom-auth');
    });
  });

  // ==========================================================================
  // Error Message Security (No Information Leakage)
  // ==========================================================================

  describe('no information leakage on validation failure', () => {
    it('should return boolean false without revealing which key was closest', () => {
      const service = createAPIKeyService({ keys: ['secret-key-one', 'secret-key-two'] });
      // The validate method should only return true/false, not error details
      const result = service.validate('wrong-key');
      expect(result).toBe(false);
      expect(typeof result).toBe('boolean');
    });

    it('should not throw exceptions that reveal key information on invalid input', () => {
      const service = createAPIKeyService({ keys: ['valid-key'] });
      // These should not throw, just return false
      expect(() => service.validate('any-invalid-input')).not.toThrow();
      expect(() => service.validate('')).not.toThrow();
    });
  });
});
