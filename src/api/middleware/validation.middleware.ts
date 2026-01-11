/**
 * Validation Middleware
 *
 * Feature: F4.1 - REST API Interface
 *
 * @module api/middleware/validation
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ValidationException } from './error.middleware.js';
import type { ApiErrorDetail } from '../interfaces/api.interface.js';

/**
 * Validation rule type
 */
export interface ValidationRule<T = unknown> {
  field: string;
  validate: (value: T) => boolean;
  message: string;
  optional?: boolean;
}

/**
 * Validation schema
 */
export interface ValidationSchema {
  body?: ValidationRule[];
  params?: ValidationRule[];
  query?: ValidationRule[];
}

/**
 * Common validators
 */
export const validators = {
  required: (field: string, message?: string): ValidationRule => ({
    field,
    validate: (value) => value !== undefined && value !== null && value !== '',
    message: message || `${field} is required`,
  }),

  string: (field: string, message?: string): ValidationRule => ({
    field,
    validate: (value) => typeof value === 'string',
    message: message || `${field} must be a string`,
    optional: true,
  }),

  number: (field: string, message?: string): ValidationRule => ({
    field,
    validate: (value) => typeof value === 'number' && !isNaN(value),
    message: message || `${field} must be a number`,
    optional: true,
  }),

  boolean: (field: string, message?: string): ValidationRule => ({
    field,
    validate: (value) => typeof value === 'boolean',
    message: message || `${field} must be a boolean`,
    optional: true,
  }),

  array: (field: string, message?: string): ValidationRule => ({
    field,
    validate: (value) => Array.isArray(value),
    message: message || `${field} must be an array`,
    optional: true,
  }),

  object: (field: string, message?: string): ValidationRule => ({
    field,
    validate: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    message: message || `${field} must be an object`,
    optional: true,
  }),

  minLength: (field: string, min: number, message?: string): ValidationRule<string> => ({
    field,
    validate: (value) => typeof value === 'string' && value.length >= min,
    message: message || `${field} must be at least ${min} characters`,
    optional: true,
  }),

  maxLength: (field: string, max: number, message?: string): ValidationRule<string> => ({
    field,
    validate: (value) => typeof value === 'string' && value.length <= max,
    message: message || `${field} must be at most ${max} characters`,
    optional: true,
  }),

  min: (field: string, min: number, message?: string): ValidationRule<number> => ({
    field,
    validate: (value) => typeof value === 'number' && value >= min,
    message: message || `${field} must be at least ${min}`,
    optional: true,
  }),

  max: (field: string, max: number, message?: string): ValidationRule<number> => ({
    field,
    validate: (value) => typeof value === 'number' && value <= max,
    message: message || `${field} must be at most ${max}`,
    optional: true,
  }),

  enum: <T>(field: string, values: T[], message?: string): ValidationRule<T> => ({
    field,
    validate: (value) => values.includes(value),
    message: message || `${field} must be one of: ${values.join(', ')}`,
    optional: true,
  }),

  pattern: (field: string, regex: RegExp, message?: string): ValidationRule<string> => ({
    field,
    validate: (value) => typeof value === 'string' && regex.test(value),
    message: message || `${field} has invalid format`,
    optional: true,
  }),

  uuid: (field: string, message?: string): ValidationRule<string> => ({
    field,
    validate: (value) =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
    message: message || `${field} must be a valid UUID`,
    optional: true,
  }),

  email: (field: string, message?: string): ValidationRule<string> => ({
    field,
    validate: (value) =>
      typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message: message || `${field} must be a valid email address`,
    optional: true,
  }),

  url: (field: string, message?: string): ValidationRule<string> => ({
    field,
    validate: (value) => {
      if (typeof value !== 'string') return false;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message: message || `${field} must be a valid URL`,
    optional: true,
  }),

  date: (field: string, message?: string): ValidationRule<string> => ({
    field,
    validate: (value) => {
      if (typeof value !== 'string') return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    },
    message: message || `${field} must be a valid date`,
    optional: true,
  }),
};

/**
 * Get nested value from object
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Validate data against rules
 */
function validateData(
  data: Record<string, unknown>,
  rules: ValidationRule[],
  prefix: string
): ApiErrorDetail[] {
  const errors: ApiErrorDetail[] = [];

  for (const rule of rules) {
    const value = getNestedValue(data, rule.field);
    const isEmpty = value === undefined || value === null || value === '';

    // Skip optional fields if empty
    if (rule.optional && isEmpty) continue;

    // Required fields must have value
    if (!rule.optional && isEmpty) {
      errors.push({
        field: prefix ? `${prefix}.${rule.field}` : rule.field,
        message: rule.message,
        code: 'REQUIRED',
      });
      continue;
    }

    // Validate non-empty values
    if (!isEmpty && !rule.validate(value as never)) {
      errors.push({
        field: prefix ? `${prefix}.${rule.field}` : rule.field,
        message: rule.message,
        code: 'INVALID',
        value,
      });
    }
  }

  return errors;
}

/**
 * Create validation middleware
 */
export function createValidationMiddleware(schema: ValidationSchema) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const errors: ApiErrorDetail[] = [];

    if (schema.body && request.body) {
      errors.push(...validateData(request.body as Record<string, unknown>, schema.body, 'body'));
    }

    if (schema.params && request.params) {
      errors.push(
        ...validateData(request.params as Record<string, unknown>, schema.params, 'params')
      );
    }

    if (schema.query && request.query) {
      errors.push(
        ...validateData(request.query as Record<string, unknown>, schema.query, 'query')
      );
    }

    if (errors.length > 0) {
      throw new ValidationException(errors);
    }
  };
}

/**
 * UUID parameter validation middleware
 */
export async function validateUuidParam(
  paramName: string
): Promise<(request: FastifyRequest, reply: FastifyReply) => Promise<void>> {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const params = request.params as Record<string, string>;
    const value = params[paramName];

    if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new ValidationException([
        {
          field: `params.${paramName}`,
          message: `${paramName} must be a valid UUID`,
          code: 'INVALID_UUID',
          value,
        },
      ]);
    }
  };
}
