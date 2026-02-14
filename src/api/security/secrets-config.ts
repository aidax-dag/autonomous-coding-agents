/**
 * Secrets Configuration
 *
 * Default secret rules for the ACA platform with environment-specific
 * requirements. Production environments enforce stricter validation
 * than development.
 *
 * @module api/security/secrets-config
 */

import type { SecretRule } from './secrets-validator';

/** Default secret rules covering common ACA platform secrets. */
export const DEFAULT_SECRET_RULES: SecretRule[] = [
  {
    name: 'JWT_SECRET',
    required: true,
    minLength: 32,
    description: 'JWT signing secret (min 32 chars for HS256)',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    pattern: /^(postgres|mysql|sqlite|mongodb)/,
    description: 'Database connection string',
  },
  {
    name: 'API_KEY',
    required: false,
    minLength: 16,
    pattern: /^[A-Za-z0-9_\-]{16,}$/,
    description: 'External API key',
  },
  {
    name: 'SESSION_SECRET',
    required: false,
    minLength: 24,
    description: 'Session encryption secret',
  },
  {
    name: 'ENCRYPTION_KEY',
    required: false,
    minLength: 32,
    description: 'Data encryption key (min 32 chars)',
  },
];

/**
 * Return the appropriate secret rules for a given environment.
 *
 * In production all optional secrets become required and minimum lengths
 * are enforced more strictly. Development uses the default rules as-is.
 */
export function getSecretRulesForEnv(env: string): SecretRule[] {
  if (env === 'production') {
    return DEFAULT_SECRET_RULES.map((rule) => ({
      ...rule,
      required: true,
      minLength: rule.minLength ? Math.max(rule.minLength, 24) : 24,
    }));
  }

  return [...DEFAULT_SECRET_RULES];
}
