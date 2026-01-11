/**
 * API Key Service
 *
 * Feature: F4.4 - API Authentication
 *
 * Handles API key generation, validation, and management.
 *
 * SOLID Principles:
 * - S: Single responsibility - API key operations only
 * - O: Extensible via configuration
 * - D: Depends on IApiKeyService abstraction
 *
 * @module api/auth/services/api-key
 */

import crypto from 'crypto';
import { ILogger, createLogger } from '../../../core/services/logger.js';
import {
  IApiKeyService,
  ApiKeyConfig,
  ApiKey,
  ApiKeyStatus,
  CreateApiKeyRequest,
  CreateApiKeyResult,
  ApiKeyValidationResult,
  DEFAULT_API_KEY_CONFIG,
} from '../interfaces/auth.interface.js';

/**
 * In-memory rate limiter for API keys
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * API Key Service implementation
 *
 * Note: This uses in-memory storage. In production, use a database.
 */
export class ApiKeyService implements IApiKeyService {
  private readonly logger: ILogger;
  private readonly config: ApiKeyConfig;
  private readonly apiKeys: Map<string, ApiKey>; // id -> ApiKey
  private readonly keyIndex: Map<string, string>; // prefix -> id (for lookup optimization)
  private readonly rateLimits: Map<string, RateLimitEntry>; // id -> rate limit entry

  constructor(config?: Partial<ApiKeyConfig>) {
    this.logger = createLogger('ApiKeyService');
    this.config = { ...DEFAULT_API_KEY_CONFIG, ...config };
    this.apiKeys = new Map();
    this.keyIndex = new Map();
    this.rateLimits = new Map();

    this.logger.debug('API Key service initialized', {
      prefix: this.config.prefix,
      keyLength: this.config.length,
      hashAlgorithm: this.config.hashAlgorithm,
    });
  }

  /**
   * Create a new API key
   */
  async createApiKey(userId: string, request: CreateApiKeyRequest): Promise<CreateApiKeyResult> {
    // Check max keys per user
    const userKeys = await this.listApiKeys(userId);
    if (userKeys.length >= this.config.maxKeysPerUser) {
      throw new Error(`Maximum API keys per user (${this.config.maxKeysPerUser}) exceeded`);
    }

    // Generate unique key
    const rawKey = this.generateKey();
    const fullKey = `${this.config.prefix}${rawKey}`;
    const hashedKey = this.hashKey(rawKey);
    const keyPrefix = `${this.config.prefix}${rawKey.substring(0, 8)}...`;

    // Calculate expiration
    let expiresAt: Date | undefined;
    if (request.expiresInDays && request.expiresInDays > 0) {
      expiresAt = new Date(Date.now() + request.expiresInDays * 24 * 60 * 60 * 1000);
    } else if (this.config.defaultExpirationDays > 0) {
      expiresAt = new Date(Date.now() + this.config.defaultExpirationDays * 24 * 60 * 60 * 1000);
    }

    const id = crypto.randomUUID();
    const now = new Date();

    const apiKey: ApiKey = {
      id,
      name: request.name,
      prefix: keyPrefix,
      hashedKey,
      userId,
      status: ApiKeyStatus.ACTIVE,
      permissions: request.permissions || [],
      scopes: request.scopes || ['*'],
      rateLimit: request.rateLimit || this.config.rateLimitPerMinute,
      allowedIps: request.allowedIps,
      createdAt: now,
      expiresAt,
      metadata: request.metadata,
    };

    // Store the key
    this.apiKeys.set(id, apiKey);
    this.keyIndex.set(hashedKey, id);

    this.logger.info('API key created', {
      id,
      name: request.name,
      userId,
      prefix: keyPrefix,
      expiresAt: expiresAt?.toISOString(),
    });

    return {
      id,
      name: request.name,
      key: fullKey, // Only returned once at creation
      prefix: keyPrefix,
      permissions: apiKey.permissions,
      scopes: apiKey.scopes,
      expiresAt,
      createdAt: now,
    };
  }

  /**
   * Validate an API key
   */
  async validateApiKey(key: string, ip?: string): Promise<ApiKeyValidationResult> {
    // Check key format
    if (!key.startsWith(this.config.prefix)) {
      return {
        valid: false,
        error: {
          code: 'KEY_INVALID',
          message: 'Invalid API key format',
        },
      };
    }

    // Extract and hash the key
    const rawKey = key.substring(this.config.prefix.length);
    const hashedKey = this.hashKey(rawKey);

    // Look up the key
    const id = this.keyIndex.get(hashedKey);
    if (!id) {
      return {
        valid: false,
        error: {
          code: 'KEY_NOT_FOUND',
          message: 'API key not found',
        },
      };
    }

    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      return {
        valid: false,
        error: {
          code: 'KEY_NOT_FOUND',
          message: 'API key not found',
        },
      };
    }

    // Check status
    if (apiKey.status === ApiKeyStatus.REVOKED) {
      return {
        valid: false,
        error: {
          code: 'KEY_REVOKED',
          message: 'API key has been revoked',
        },
      };
    }

    if (apiKey.status === ApiKeyStatus.INACTIVE) {
      return {
        valid: false,
        error: {
          code: 'KEY_INACTIVE',
          message: 'API key is inactive',
        },
      };
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      // Update status to expired
      apiKey.status = ApiKeyStatus.EXPIRED;
      this.apiKeys.set(id, apiKey);

      return {
        valid: false,
        error: {
          code: 'KEY_EXPIRED',
          message: 'API key has expired',
        },
      };
    }

    // Check IP whitelist
    if (ip && apiKey.allowedIps && apiKey.allowedIps.length > 0) {
      if (!this.isIpAllowed(ip, apiKey.allowedIps)) {
        return {
          valid: false,
          error: {
            code: 'IP_NOT_ALLOWED',
            message: 'IP address not allowed for this API key',
          },
        };
      }
    }

    // Check rate limit
    if (!(await this.checkRateLimit(id))) {
      return {
        valid: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded for this API key',
        },
      };
    }

    return {
      valid: true,
      apiKey,
    };
  }

  /**
   * Get API key by ID
   */
  async getApiKey(id: string): Promise<ApiKey | null> {
    return this.apiKeys.get(id) || null;
  }

  /**
   * List API keys for a user
   */
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const keys: ApiKey[] = [];
    for (const apiKey of this.apiKeys.values()) {
      if (apiKey.userId === userId) {
        keys.push(apiKey);
      }
    }
    return keys;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(id: string): Promise<void> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    apiKey.status = ApiKeyStatus.REVOKED;
    this.apiKeys.set(id, apiKey);

    this.logger.info('API key revoked', { id, name: apiKey.name });
  }

  /**
   * Update API key permissions
   */
  async updateApiKeyPermissions(id: string, permissions: string[]): Promise<ApiKey> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    apiKey.permissions = permissions;
    this.apiKeys.set(id, apiKey);

    this.logger.info('API key permissions updated', { id, permissions });
    return apiKey;
  }

  /**
   * Update API key status
   */
  async updateApiKeyStatus(id: string, status: ApiKeyStatus): Promise<ApiKey> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      throw new Error('API key not found');
    }

    apiKey.status = status;
    this.apiKeys.set(id, apiKey);

    this.logger.info('API key status updated', { id, status });
    return apiKey;
  }

  /**
   * Record API key usage
   */
  async recordUsage(id: string): Promise<void> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      return;
    }

    apiKey.lastUsedAt = new Date();
    this.apiKeys.set(id, apiKey);

    // Update rate limit counter
    const entry = this.rateLimits.get(id);
    if (entry && entry.resetAt > Date.now()) {
      entry.count++;
    } else {
      this.rateLimits.set(id, {
        count: 1,
        resetAt: Date.now() + 60 * 1000, // 1 minute window
      });
    }
  }

  /**
   * Check rate limit for API key
   */
  async checkRateLimit(id: string): Promise<boolean> {
    const apiKey = this.apiKeys.get(id);
    if (!apiKey) {
      return false;
    }

    const limit = apiKey.rateLimit || this.config.rateLimitPerMinute;
    const entry = this.rateLimits.get(id);

    if (!entry || entry.resetAt <= Date.now()) {
      // No entry or expired - allow
      return true;
    }

    return entry.count < limit;
  }

  /**
   * Delete expired API keys
   */
  async cleanupExpiredKeys(): Promise<number> {
    const now = new Date();
    let deleted = 0;

    for (const [id, apiKey] of this.apiKeys.entries()) {
      if (apiKey.expiresAt && apiKey.expiresAt < now) {
        this.keyIndex.delete(apiKey.hashedKey);
        this.apiKeys.delete(id);
        this.rateLimits.delete(id);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.logger.info('Cleaned up expired API keys', { count: deleted });
    }

    return deleted;
  }

  /**
   * Generate a random API key
   */
  private generateKey(): string {
    const bytes = crypto.randomBytes(this.config.length);
    return bytes.toString('base64url').substring(0, this.config.length);
  }

  /**
   * Hash an API key for storage
   */
  private hashKey(key: string): string {
    if (this.config.hashAlgorithm === 'argon2') {
      // For simplicity, fall back to SHA-256 in this implementation
      // In production, use argon2 library for better security
      this.logger.warn('Argon2 not implemented, falling back to SHA-256');
    }

    const hash = crypto.createHash(
      this.config.hashAlgorithm === 'argon2' ? 'sha256' : this.config.hashAlgorithm
    );
    hash.update(key);
    return hash.digest('hex');
  }

  /**
   * Check if IP is in allowed list
   */
  private isIpAllowed(ip: string, allowedIps: string[]): boolean {
    for (const allowed of allowedIps) {
      // Support CIDR notation (basic implementation)
      if (allowed.includes('/')) {
        if (this.isIpInCidr(ip, allowed)) {
          return true;
        }
      } else if (ip === allowed) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if IP is in CIDR range (simplified implementation)
   */
  private isIpInCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const mask = parseInt(bits, 10);

    // Convert IPs to integers
    const ipInt = this.ipToInt(ip);
    const rangeInt = this.ipToInt(range);

    // Calculate network mask
    const netmask = ~(Math.pow(2, 32 - mask) - 1);

    return (ipInt & netmask) === (rangeInt & netmask);
  }

  /**
   * Convert IP address to integer
   */
  private ipToInt(ip: string): number {
    const parts = ip.split('.');
    if (parts.length !== 4) {
      return 0;
    }
    return parts.reduce((acc, part) => (acc << 8) + parseInt(part, 10), 0) >>> 0;
  }
}

/**
 * Factory function to create API Key service
 */
export function createApiKeyService(config?: Partial<ApiKeyConfig>): IApiKeyService {
  return new ApiKeyService(config);
}
