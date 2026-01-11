/**
 * Validation Middleware Tests
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module tests/unit/api/middleware/validation
 */

import {
  validators,
  createValidationMiddleware,
  ValidationRule,
} from '../../../../src/api/middleware/validation.middleware';
import { ValidationException } from '../../../../src/api/middleware/error.middleware';

describe('Validation Middleware', () => {
  describe('validators', () => {
    describe('required', () => {
      it('should pass for non-empty values', () => {
        const rule = validators.required('name');
        expect(rule.validate('test')).toBe(true);
        expect(rule.validate(0)).toBe(true);
        expect(rule.validate(false)).toBe(true);
      });

      it('should fail for empty values', () => {
        const rule = validators.required('name');
        expect(rule.validate(undefined)).toBe(false);
        expect(rule.validate(null)).toBe(false);
        expect(rule.validate('')).toBe(false);
      });

      it('should have correct field and message', () => {
        const rule = validators.required('email', 'Email is required');
        expect(rule.field).toBe('email');
        expect(rule.message).toBe('Email is required');
      });
    });

    describe('string', () => {
      it('should pass for strings', () => {
        const rule = validators.string('name');
        expect(rule.validate('test')).toBe(true);
        expect(rule.validate('')).toBe(true);
      });

      it('should fail for non-strings', () => {
        const rule = validators.string('name');
        expect(rule.validate(123)).toBe(false);
        expect(rule.validate(true)).toBe(false);
        expect(rule.validate({})).toBe(false);
      });
    });

    describe('number', () => {
      it('should pass for numbers', () => {
        const rule = validators.number('age');
        expect(rule.validate(25)).toBe(true);
        expect(rule.validate(0)).toBe(true);
        expect(rule.validate(-5)).toBe(true);
        expect(rule.validate(3.14)).toBe(true);
      });

      it('should fail for non-numbers', () => {
        const rule = validators.number('age');
        expect(rule.validate('25')).toBe(false);
        expect(rule.validate(NaN)).toBe(false);
      });
    });

    describe('boolean', () => {
      it('should pass for booleans', () => {
        const rule = validators.boolean('active');
        expect(rule.validate(true)).toBe(true);
        expect(rule.validate(false)).toBe(true);
      });

      it('should fail for non-booleans', () => {
        const rule = validators.boolean('active');
        expect(rule.validate('true')).toBe(false);
        expect(rule.validate(1)).toBe(false);
      });
    });

    describe('array', () => {
      it('should pass for arrays', () => {
        const rule = validators.array('items');
        expect(rule.validate([])).toBe(true);
        expect(rule.validate([1, 2, 3])).toBe(true);
      });

      it('should fail for non-arrays', () => {
        const rule = validators.array('items');
        expect(rule.validate({})).toBe(false);
        expect(rule.validate('[]')).toBe(false);
      });
    });

    describe('object', () => {
      it('should pass for objects', () => {
        const rule = validators.object('data');
        expect(rule.validate({})).toBe(true);
        expect(rule.validate({ key: 'value' })).toBe(true);
      });

      it('should fail for non-objects', () => {
        const rule = validators.object('data');
        expect(rule.validate(null)).toBe(false);
        expect(rule.validate([])).toBe(false);
        expect(rule.validate('object')).toBe(false);
      });
    });

    describe('minLength', () => {
      it('should pass for strings meeting minimum', () => {
        const rule = validators.minLength('name', 3);
        expect(rule.validate('abc')).toBe(true);
        expect(rule.validate('abcdef')).toBe(true);
      });

      it('should fail for strings below minimum', () => {
        const rule = validators.minLength('name', 3);
        expect(rule.validate('ab')).toBe(false);
        expect(rule.validate('')).toBe(false);
      });
    });

    describe('maxLength', () => {
      it('should pass for strings within maximum', () => {
        const rule = validators.maxLength('name', 5);
        expect(rule.validate('abc')).toBe(true);
        expect(rule.validate('abcde')).toBe(true);
      });

      it('should fail for strings exceeding maximum', () => {
        const rule = validators.maxLength('name', 5);
        expect(rule.validate('abcdef')).toBe(false);
      });
    });

    describe('min', () => {
      it('should pass for numbers at or above minimum', () => {
        const rule = validators.min('age', 18);
        expect(rule.validate(18)).toBe(true);
        expect(rule.validate(25)).toBe(true);
      });

      it('should fail for numbers below minimum', () => {
        const rule = validators.min('age', 18);
        expect(rule.validate(17)).toBe(false);
      });
    });

    describe('max', () => {
      it('should pass for numbers at or below maximum', () => {
        const rule = validators.max('age', 100);
        expect(rule.validate(100)).toBe(true);
        expect(rule.validate(50)).toBe(true);
      });

      it('should fail for numbers above maximum', () => {
        const rule = validators.max('age', 100);
        expect(rule.validate(101)).toBe(false);
      });
    });

    describe('enum', () => {
      it('should pass for valid enum values', () => {
        const rule = validators.enum('status', ['active', 'inactive', 'pending']);
        expect(rule.validate('active')).toBe(true);
        expect(rule.validate('inactive')).toBe(true);
      });

      it('should fail for invalid enum values', () => {
        const rule = validators.enum('status', ['active', 'inactive']);
        expect(rule.validate('pending')).toBe(false);
        expect(rule.validate('unknown')).toBe(false);
      });
    });

    describe('pattern', () => {
      it('should pass for matching patterns', () => {
        const rule = validators.pattern('code', /^[A-Z]{3}-\d{3}$/);
        expect(rule.validate('ABC-123')).toBe(true);
      });

      it('should fail for non-matching patterns', () => {
        const rule = validators.pattern('code', /^[A-Z]{3}-\d{3}$/);
        expect(rule.validate('abc-123')).toBe(false);
        expect(rule.validate('ABC123')).toBe(false);
      });
    });

    describe('uuid', () => {
      it('should pass for valid UUIDs', () => {
        const rule = validators.uuid('id');
        expect(rule.validate('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
        expect(rule.validate('A550E840-0E29-B41D-4A71-6446655440FF')).toBe(true);
      });

      it('should fail for invalid UUIDs', () => {
        const rule = validators.uuid('id');
        expect(rule.validate('not-a-uuid')).toBe(false);
        expect(rule.validate('550e8400-e29b-41d4-a716')).toBe(false);
      });
    });

    describe('email', () => {
      it('should pass for valid emails', () => {
        const rule = validators.email('email');
        expect(rule.validate('test@example.com')).toBe(true);
        expect(rule.validate('user.name+tag@domain.co.uk')).toBe(true);
      });

      it('should fail for invalid emails', () => {
        const rule = validators.email('email');
        expect(rule.validate('not-an-email')).toBe(false);
        expect(rule.validate('@domain.com')).toBe(false);
        expect(rule.validate('user@')).toBe(false);
      });
    });

    describe('url', () => {
      it('should pass for valid URLs', () => {
        const rule = validators.url('website');
        expect(rule.validate('https://example.com')).toBe(true);
        expect(rule.validate('http://localhost:3000/path')).toBe(true);
      });

      it('should fail for invalid URLs', () => {
        const rule = validators.url('website');
        expect(rule.validate('not-a-url')).toBe(false);
        expect(rule.validate('example.com')).toBe(false);
      });
    });

    describe('date', () => {
      it('should pass for valid dates', () => {
        const rule = validators.date('createdAt');
        expect(rule.validate('2024-01-15')).toBe(true);
        expect(rule.validate('2024-01-15T10:30:00Z')).toBe(true);
      });

      it('should fail for invalid dates', () => {
        const rule = validators.date('createdAt');
        expect(rule.validate('not-a-date')).toBe(false);
        expect(rule.validate('2024-13-45')).toBe(false);
      });
    });
  });

  describe('createValidationMiddleware', () => {
    it('should pass valid body data', async () => {
      const middleware = createValidationMiddleware({
        body: [
          validators.required('name'),
          validators.string('name'),
        ],
      });

      const request = { body: { name: 'Test' }, params: {}, query: {} };
      const reply = {};

      await expect(middleware(request as any, reply as any)).resolves.toBeUndefined();
    });

    it('should throw for missing required fields', async () => {
      const middleware = createValidationMiddleware({
        body: [validators.required('name')],
      });

      const request = { body: {}, params: {}, query: {} };
      const reply = {};

      await expect(middleware(request as any, reply as any)).rejects.toThrow(ValidationException);
    });

    it('should throw for invalid field types', async () => {
      const middleware = createValidationMiddleware({
        body: [
          validators.required('age'),
          validators.number('age'),
        ],
      });

      const request = { body: { age: 'not-a-number' }, params: {}, query: {} };
      const reply = {};

      await expect(middleware(request as any, reply as any)).rejects.toThrow(ValidationException);
    });

    it('should validate params', async () => {
      const middleware = createValidationMiddleware({
        params: [validators.uuid('id') as ValidationRule],
      });

      const request = { body: {}, params: { id: 'invalid' }, query: {} };
      const reply = {};

      await expect(middleware(request as any, reply as any)).rejects.toThrow(ValidationException);
    });

    it('should validate query', async () => {
      const middleware = createValidationMiddleware({
        query: [validators.number('page')],
      });

      const request = { body: {}, params: {}, query: { page: 'not-a-number' } };
      const reply = {};

      await expect(middleware(request as any, reply as any)).rejects.toThrow(ValidationException);
    });

    it('should skip optional fields when empty', async () => {
      const middleware = createValidationMiddleware({
        body: [validators.string('description')],
      });

      const request = { body: { name: 'Test' }, params: {}, query: {} };
      const reply = {};

      await expect(middleware(request as any, reply as any)).resolves.toBeUndefined();
    });

    it('should collect all validation errors', async () => {
      const middleware = createValidationMiddleware({
        body: [
          validators.required('name'),
          validators.required('email'),
        ],
      });

      const request = { body: {}, params: {}, query: {} };
      const reply = {};

      try {
        await middleware(request as any, reply as any);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationException);
        expect((error as ValidationException).details).toHaveLength(2);
      }
    });
  });
});
