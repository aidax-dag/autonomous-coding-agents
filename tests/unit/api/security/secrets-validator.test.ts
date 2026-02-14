/**
 * Secrets Validator Tests
 *
 * Covers:
 * - Rule validation: required present/missing, min length, pattern matching
 * - Masking: verify values are properly masked in output
 * - Audit logging: correct secrets logged as present/missing
 * - Environment-specific rules: production vs development
 * - Edge cases: empty env, all secrets valid, all missing
 * - Factory function
 */

import {
  SecretsValidator,
  createSecretsValidator,
} from '../../../../src/api/security/secrets-validator';
import type { SecretRule, ValidationResult } from '../../../../src/api/security/secrets-validator';
import {
  DEFAULT_SECRET_RULES,
  getSecretRulesForEnv,
} from '../../../../src/api/security/secrets-config';

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

// Re-import the mocked logger so we can assert on calls
import { logger } from '../../../../src/shared/logging/logger';

const mockedLogger = logger as jest.Mocked<typeof logger>;

describe('SecretsValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // validate() – required secrets
  // -----------------------------------------------------------------------
  describe('validate - required secrets', () => {
    it('should report missing required secrets', () => {
      const rules: SecretRule[] = [
        { name: 'MY_SECRET', required: true, description: 'Test secret' },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({});

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('MY_SECRET');
      expect(result.warnings.some((w) => w.includes('MY_SECRET'))).toBe(true);
    });

    it('should pass when all required secrets are present', () => {
      const rules: SecretRule[] = [
        { name: 'MY_SECRET', required: true },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ MY_SECRET: 'some-value' });

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should treat empty string as missing for required secrets', () => {
      const rules: SecretRule[] = [
        { name: 'MY_SECRET', required: true },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ MY_SECRET: '' });

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('MY_SECRET');
    });

    it('should not report optional missing secrets as errors', () => {
      const rules: SecretRule[] = [
        { name: 'OPTIONAL_KEY', required: false },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({});

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // validate() – minimum length
  // -----------------------------------------------------------------------
  describe('validate - minimum length', () => {
    it('should flag secrets shorter than minLength', () => {
      const rules: SecretRule[] = [
        { name: 'SHORT_KEY', required: true, minLength: 16 },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ SHORT_KEY: 'abc' });

      expect(result.valid).toBe(false);
      expect(result.weak).toContain('SHORT_KEY');
      expect(result.warnings.some((w) => w.includes('too short'))).toBe(true);
    });

    it('should accept secrets that meet minLength exactly', () => {
      const rules: SecretRule[] = [
        { name: 'EXACT_KEY', required: true, minLength: 8 },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ EXACT_KEY: '12345678' });

      expect(result.valid).toBe(true);
      expect(result.weak).toHaveLength(0);
    });

    it('should accept secrets longer than minLength', () => {
      const rules: SecretRule[] = [
        { name: 'LONG_KEY', required: true, minLength: 8 },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ LONG_KEY: 'abcdefghijklmnop' });

      expect(result.valid).toBe(true);
      expect(result.weak).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // validate() – pattern matching
  // -----------------------------------------------------------------------
  describe('validate - pattern matching', () => {
    it('should flag secrets that do not match the pattern', () => {
      const rules: SecretRule[] = [
        { name: 'DB_URL', required: true, pattern: /^postgres/ },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ DB_URL: 'http://not-a-db' });

      expect(result.valid).toBe(false);
      expect(result.weak).toContain('DB_URL');
      expect(result.warnings.some((w) => w.includes('does not match'))).toBe(true);
    });

    it('should accept secrets that match the pattern', () => {
      const rules: SecretRule[] = [
        { name: 'DB_URL', required: true, pattern: /^postgres/ },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ DB_URL: 'postgres://localhost/mydb' });

      expect(result.valid).toBe(true);
      expect(result.weak).toHaveLength(0);
    });

    it('should skip pattern check when secret is not set and optional', () => {
      const rules: SecretRule[] = [
        { name: 'OPTIONAL_PAT', required: false, pattern: /^prefix-/ },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({});

      expect(result.valid).toBe(true);
      expect(result.weak).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // validate() – combined rules
  // -----------------------------------------------------------------------
  describe('validate - combined rules', () => {
    it('should flag both length and pattern failures on the same secret', () => {
      const rules: SecretRule[] = [
        { name: 'COMBO', required: true, minLength: 20, pattern: /^sk_/ },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({ COMBO: 'bad' });

      expect(result.valid).toBe(false);
      expect(result.weak).toContain('COMBO');
      // Should have warnings for both too-short and pattern mismatch
      expect(result.warnings.filter((w) => w.includes('COMBO'))).toHaveLength(2);
    });

    it('should report multiple missing secrets independently', () => {
      const rules: SecretRule[] = [
        { name: 'A', required: true },
        { name: 'B', required: true },
        { name: 'C', required: false },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({});

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['A', 'B']);
      expect(result.missing).not.toContain('C');
    });
  });

  // -----------------------------------------------------------------------
  // maskValue()
  // -----------------------------------------------------------------------
  describe('maskValue', () => {
    it('should show first 4 chars and mask the rest', () => {
      const validator = createSecretsValidator([]);
      expect(validator.maskValue('mysecretvalue')).toBe('myse****');
    });

    it('should fully mask values of 4 characters or fewer', () => {
      const validator = createSecretsValidator([]);
      expect(validator.maskValue('abc')).toBe('****');
      expect(validator.maskValue('abcd')).toBe('****');
    });

    it('should mask single-character values', () => {
      const validator = createSecretsValidator([]);
      expect(validator.maskValue('x')).toBe('****');
    });

    it('should mask exactly 5-character values showing first 4', () => {
      const validator = createSecretsValidator([]);
      expect(validator.maskValue('hello')).toBe('hell****');
    });
  });

  // -----------------------------------------------------------------------
  // audit()
  // -----------------------------------------------------------------------
  describe('audit', () => {
    it('should log present secrets as SET with masked value', () => {
      const rules: SecretRule[] = [
        { name: 'PRESENT_KEY', required: true, description: 'A present key' },
      ];
      const validator = createSecretsValidator(rules);
      validator.audit({ PRESENT_KEY: 'supersecretvalue' });

      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Secret PRESENT_KEY: SET',
        expect.objectContaining({
          masked: 'supe****',
          length: 16,
        }),
      );
    });

    it('should log missing required secrets with warn level', () => {
      const rules: SecretRule[] = [
        { name: 'MISSING_REQ', required: true, description: 'Required key' },
      ];
      const validator = createSecretsValidator(rules);
      validator.audit({});

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Secret MISSING_REQ: NOT SET',
        expect.objectContaining({ required: true }),
      );
    });

    it('should log missing optional secrets with info level', () => {
      const rules: SecretRule[] = [
        { name: 'MISSING_OPT', required: false, description: 'Optional key' },
      ];
      const validator = createSecretsValidator(rules);
      validator.audit({});

      expect(mockedLogger.info).toHaveBeenCalledWith(
        'Secret MISSING_OPT: NOT SET',
        expect.objectContaining({ required: false }),
      );
    });

    it('should log audit passed when all valid', () => {
      const rules: SecretRule[] = [
        { name: 'GOOD', required: true },
      ];
      const validator = createSecretsValidator(rules);
      validator.audit({ GOOD: 'a-valid-value' });

      expect(mockedLogger.info).toHaveBeenCalledWith('Secrets audit passed');
    });

    it('should log audit issues when validation fails', () => {
      const rules: SecretRule[] = [
        { name: 'BAD', required: true },
      ];
      const validator = createSecretsValidator(rules);
      validator.audit({});

      expect(mockedLogger.warn).toHaveBeenCalledWith(
        'Secrets audit found issues',
        expect.objectContaining({
          missing: ['BAD'],
          weak: [],
          warningCount: 1,
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getRequiredSecrets()
  // -----------------------------------------------------------------------
  describe('getRequiredSecrets', () => {
    it('should return only names of required rules', () => {
      const rules: SecretRule[] = [
        { name: 'REQ_A', required: true },
        { name: 'OPT_B', required: false },
        { name: 'REQ_C', required: true },
      ];
      const validator = createSecretsValidator(rules);

      expect(validator.getRequiredSecrets()).toEqual(['REQ_A', 'REQ_C']);
    });

    it('should return empty array when no rules are required', () => {
      const rules: SecretRule[] = [
        { name: 'OPT_A', required: false },
        { name: 'OPT_B' },
      ];
      const validator = createSecretsValidator(rules);

      expect(validator.getRequiredSecrets()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('should handle empty env with no rules', () => {
      const validator = createSecretsValidator([]);
      const result = validator.validate({});

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.weak).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle all secrets valid', () => {
      const rules: SecretRule[] = [
        { name: 'A', required: true, minLength: 4 },
        { name: 'B', required: true, pattern: /^ok-/ },
        { name: 'C', required: false, minLength: 2 },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({
        A: 'abcdefgh',
        B: 'ok-value',
        C: 'fine',
      });

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
      expect(result.weak).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle all required secrets missing', () => {
      const rules: SecretRule[] = [
        { name: 'X', required: true },
        { name: 'Y', required: true },
        { name: 'Z', required: true },
      ];
      const validator = createSecretsValidator(rules);
      const result = validator.validate({});

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['X', 'Y', 'Z']);
      expect(result.warnings).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // Factory function
  // -----------------------------------------------------------------------
  describe('createSecretsValidator', () => {
    it('should create a validator with custom rules', () => {
      const rules: SecretRule[] = [
        { name: 'CUSTOM', required: true },
      ];
      const validator = createSecretsValidator(rules);
      expect(validator).toBeInstanceOf(SecretsValidator);
      expect(validator.getRequiredSecrets()).toEqual(['CUSTOM']);
    });

    it('should use default rules when none provided', () => {
      const validator = createSecretsValidator();
      const required = validator.getRequiredSecrets();

      // Default rules include JWT_SECRET and DATABASE_URL as required
      expect(required).toContain('JWT_SECRET');
      expect(required).toContain('DATABASE_URL');
    });
  });

  // -----------------------------------------------------------------------
  // Default rules (DEFAULT_SECRET_RULES)
  // -----------------------------------------------------------------------
  describe('DEFAULT_SECRET_RULES', () => {
    it('should include JWT_SECRET with minLength 32', () => {
      const jwtRule = DEFAULT_SECRET_RULES.find((r) => r.name === 'JWT_SECRET');
      expect(jwtRule).toBeDefined();
      expect(jwtRule!.required).toBe(true);
      expect(jwtRule!.minLength).toBe(32);
    });

    it('should include DATABASE_URL as required with pattern', () => {
      const dbRule = DEFAULT_SECRET_RULES.find((r) => r.name === 'DATABASE_URL');
      expect(dbRule).toBeDefined();
      expect(dbRule!.required).toBe(true);
      expect(dbRule!.pattern).toBeDefined();
    });

    it('should include API_KEY with pattern and minLength', () => {
      const apiRule = DEFAULT_SECRET_RULES.find((r) => r.name === 'API_KEY');
      expect(apiRule).toBeDefined();
      expect(apiRule!.minLength).toBe(16);
      expect(apiRule!.pattern).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // getSecretRulesForEnv
  // -----------------------------------------------------------------------
  describe('getSecretRulesForEnv', () => {
    it('should make all secrets required in production', () => {
      const prodRules = getSecretRulesForEnv('production');

      for (const rule of prodRules) {
        expect(rule.required).toBe(true);
      }
    });

    it('should enforce minimum 24-char length in production', () => {
      const prodRules = getSecretRulesForEnv('production');

      for (const rule of prodRules) {
        expect(rule.minLength).toBeGreaterThanOrEqual(24);
      }
    });

    it('should preserve original minLength when already >= 24 in production', () => {
      const prodRules = getSecretRulesForEnv('production');
      const jwtRule = prodRules.find((r) => r.name === 'JWT_SECRET');

      expect(jwtRule!.minLength).toBe(32);
    });

    it('should return default rules for development', () => {
      const devRules = getSecretRulesForEnv('development');

      expect(devRules).toEqual(DEFAULT_SECRET_RULES);
    });

    it('should return default rules for unknown environments', () => {
      const testRules = getSecretRulesForEnv('test');

      expect(testRules).toEqual(DEFAULT_SECRET_RULES);
    });

    it('should not mutate the original DEFAULT_SECRET_RULES', () => {
      const originalRequired = DEFAULT_SECRET_RULES.map((r) => r.required);
      getSecretRulesForEnv('production');

      const afterRequired = DEFAULT_SECRET_RULES.map((r) => r.required);
      expect(afterRequired).toEqual(originalRequired);
    });
  });
});
