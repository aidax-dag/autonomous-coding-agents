/**
 * Configuration Validator Implementation
 *
 * Validates configuration against Zod schemas
 * with detailed error reporting.
 */

import { z } from 'zod';
import type {
  IConfigValidator,
  ConfigValidationResult,
  ConfigValidationError,
} from './interfaces';

/**
 * Convert Zod error to ConfigValidationError
 */
function zodErrorToConfigError(zodError: z.ZodError): ConfigValidationError[] {
  return zodError.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
    received: 'received' in err ? err.received : undefined,
    expected: 'expected' in err ? String(err.expected) : undefined,
  }));
}

/**
 * Configuration validator implementation
 */
export class ConfigValidator implements IConfigValidator {
  /**
   * Validate configuration against schema
   */
  validate<T>(config: unknown, schema: z.ZodSchema<T>): ConfigValidationResult {
    const result = schema.safeParse(config);

    if (result.success) {
      return { valid: true, errors: [] };
    }

    return {
      valid: false,
      errors: zodErrorToConfigError(result.error),
    };
  }

  /**
   * Parse and validate configuration (throws on error)
   */
  parse<T>(config: unknown, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = zodErrorToConfigError(error);
        const errorMessage = errors
          .map((e) => `  ${e.path}: ${e.message}`)
          .join('\n');
        throw new Error(`Configuration validation failed:\n${errorMessage}`);
      }
      throw error;
    }
  }

  /**
   * Safe parse without throwing
   */
  safeParse<T>(
    config: unknown,
    schema: z.ZodSchema<T>
  ): { success: true; data: T } | { success: false; errors: ConfigValidationError[] } {
    const result = schema.safeParse(config);

    if (result.success) {
      return { success: true, data: result.data };
    }

    return {
      success: false,
      errors: zodErrorToConfigError(result.error),
    };
  }
}

/**
 * Create a configuration validator instance
 */
export function createConfigValidator(): IConfigValidator {
  return new ConfigValidator();
}

/**
 * Common configuration schemas
 */
export const CommonSchemas = {
  /**
   * Environment schema
   */
  environment: z.enum(['development', 'staging', 'production', 'test']),

  /**
   * Log level schema
   */
  logLevel: z.enum(['error', 'warn', 'info', 'debug', 'trace']),

  /**
   * Database configuration schema
   */
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().positive().default(5432),
    name: z.string().min(1),
    user: z.string().min(1),
    password: z.string().optional(),
    ssl: z.boolean().default(false),
    pool: z
      .object({
        min: z.number().int().nonnegative().default(2),
        max: z.number().int().positive().default(10),
      })
      .optional(),
  }),

  /**
   * Server configuration schema
   */
  server: z.object({
    host: z.string().default('0.0.0.0'),
    port: z.number().int().positive().default(3000),
    cors: z
      .object({
        origins: z.array(z.string()).default(['*']),
        credentials: z.boolean().default(false),
      })
      .optional(),
  }),

  /**
   * Logging configuration schema
   */
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    format: z.enum(['json', 'pretty']).default('json'),
    directory: z.string().optional(),
    maxFiles: z.number().int().positive().optional(),
    maxSize: z.string().optional(),
  }),

  /**
   * LLM provider schema
   */
  llmProvider: z.enum(['claude', 'openai', 'gemini', 'mock']),

  /**
   * URL schema (string that must be valid URL)
   */
  url: z.string().url(),

  /**
   * Email schema
   */
  email: z.string().email(),

  /**
   * Positive integer schema
   */
  positiveInt: z.number().int().positive(),

  /**
   * Non-negative integer schema
   */
  nonNegativeInt: z.number().int().nonnegative(),

  /**
   * Duration in milliseconds
   */
  durationMs: z.number().int().nonnegative(),

  /**
   * Percentage (0-100)
   */
  percentage: z.number().min(0).max(100),
};
