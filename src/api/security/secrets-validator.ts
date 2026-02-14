/**
 * Secrets Validator
 *
 * Audits environment variables on startup to prevent accidental secret
 * exposure. Validates presence, strength, and format of secrets against
 * configurable rules.
 *
 * Features:
 * - Rule-based validation (required, minLength, pattern)
 * - Masked logging to prevent secret leakage
 * - Environment audit with structured output
 * - Factory function following the createXxx pattern
 *
 * @module api/security/secrets-validator
 */

import { logger } from '../../shared/logging/logger';
import { DEFAULT_SECRET_RULES } from './secrets-config';

/**
 * A rule that defines validation constraints for a single secret.
 */
export interface SecretRule {
  /** Environment variable name. */
  name: string;
  /** Regex the value must match when present. */
  pattern?: RegExp;
  /** Whether the secret must be set. */
  required?: boolean;
  /** Minimum acceptable length for the value. */
  minLength?: number;
  /** Human-readable description of the secret's purpose. */
  description?: string;
}

/**
 * Result returned by {@link SecretsValidator.validate}.
 */
export interface ValidationResult {
  /** True when all required secrets are present and all values pass checks. */
  valid: boolean;
  /** Names of required secrets that are not set. */
  missing: string[];
  /** Names of secrets whose values fail strength checks (length/pattern). */
  weak: string[];
  /** Human-readable warning messages for review. */
  warnings: string[];
}

/**
 * Validates environment secrets against a set of configurable rules.
 */
export class SecretsValidator {
  private readonly rules: SecretRule[];

  constructor(rules?: SecretRule[]) {
    this.rules = rules ?? DEFAULT_SECRET_RULES;
  }

  /**
   * Validate all rules against the provided environment map.
   *
   * @param env - Key/value map of environment variables (defaults to process.env).
   * @returns A {@link ValidationResult} summarising the outcome.
   */
  validate(env: Record<string, string | undefined> = process.env): ValidationResult {
    const missing: string[] = [];
    const weak: string[] = [];
    const warnings: string[] = [];

    for (const rule of this.rules) {
      const value = env[rule.name];

      // --- presence check ---
      if (value === undefined || value === '') {
        if (rule.required) {
          missing.push(rule.name);
          warnings.push(`Required secret ${rule.name} is not set`);
        }
        continue;
      }

      // --- minimum length check ---
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        weak.push(rule.name);
        warnings.push(
          `${rule.name} is too short (${value.length} chars, minimum ${rule.minLength})`,
        );
      }

      // --- pattern check ---
      if (rule.pattern && !rule.pattern.test(value)) {
        weak.push(rule.name);
        warnings.push(`${rule.name} does not match the expected pattern`);
      }
    }

    const valid = missing.length === 0 && weak.length === 0;

    return { valid, missing, weak, warnings };
  }

  /**
   * Log which secrets are set and which are missing.
   * Values are masked before being written to the log.
   *
   * @param env - Key/value map of environment variables (defaults to process.env).
   */
  audit(env: Record<string, string | undefined> = process.env): void {
    logger.info('Starting secrets audit', { ruleCount: this.rules.length });

    for (const rule of this.rules) {
      const value = env[rule.name];

      if (value === undefined || value === '') {
        const level = rule.required ? 'warn' : 'info';
        logger[level](`Secret ${rule.name}: NOT SET`, {
          required: rule.required ?? false,
          description: rule.description,
        });
      } else {
        logger.info(`Secret ${rule.name}: SET`, {
          masked: this.maskValue(value),
          length: value.length,
          description: rule.description,
        });
      }
    }

    const result = this.validate(env);
    if (result.valid) {
      logger.info('Secrets audit passed');
    } else {
      logger.warn('Secrets audit found issues', {
        missing: result.missing,
        weak: result.weak,
        warningCount: result.warnings.length,
      });
    }
  }

  /**
   * Mask a secret value for safe logging.
   * Shows the first 4 characters followed by `****`.
   * Values shorter than 4 characters are fully masked.
   *
   * @param value - The raw secret value.
   * @returns The masked representation.
   */
  maskValue(value: string): string {
    if (value.length <= 4) {
      return '****';
    }
    return `${value.slice(0, 4)}****`;
  }

  /**
   * Return the names of all secrets marked as required.
   */
  getRequiredSecrets(): string[] {
    return this.rules.filter((r) => r.required).map((r) => r.name);
  }
}

/**
 * Factory function matching the project's createXxx pattern.
 *
 * @param rules - Optional custom rules. Defaults to {@link DEFAULT_SECRET_RULES}.
 */
export function createSecretsValidator(rules?: SecretRule[]): SecretsValidator {
  return new SecretsValidator(rules);
}
