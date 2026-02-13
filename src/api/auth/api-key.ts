/**
 * API Key Validation Service
 *
 * Validates API keys for CI/CD and programmatic access
 * using timing-safe comparison to prevent timing attacks.
 *
 * @module api/auth/api-key
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '../../shared/logging/logger';

export interface APIKeyConfig {
  keys: string[];
  headerName?: string;
}

export class APIKeyService {
  private readonly keys: string[];
  private readonly headerName: string;

  constructor(config: APIKeyConfig) {
    this.keys = config.keys.filter(k => k.length > 0);
    this.headerName = config.headerName ?? 'x-api-key';

    if (this.keys.length === 0) {
      logger.warn('APIKeyService initialized with no valid keys');
    }
  }

  /**
   * Validate an API key using timing-safe comparison.
   * Returns true if the key matches any configured key.
   */
  validate(key: string): boolean {
    if (!key || key.length === 0) {
      return false;
    }

    const keyBuf = Buffer.from(key, 'utf8');

    for (const validKey of this.keys) {
      const validBuf = Buffer.from(validKey, 'utf8');

      if (keyBuf.length === validBuf.length && timingSafeEqual(keyBuf, validBuf)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the configured header name for API key lookup.
   */
  getHeaderName(): string {
    return this.headerName;
  }
}

export function createAPIKeyService(config: APIKeyConfig): APIKeyService {
  return new APIKeyService(config);
}
