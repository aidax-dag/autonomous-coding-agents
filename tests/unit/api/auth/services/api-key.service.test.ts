/**
 * API Key Service Unit Tests
 *
 * Feature: F4.4 - API Authentication
 *
 * @module tests/unit/api/auth/services/api-key.service
 */

import { ApiKeyService, createApiKeyService } from '../../../../../src/api/auth/services/api-key.service';
import {
  ApiKeyStatus,
  ApiKeyConfig,
} from '../../../../../src/api/auth/interfaces/auth.interface';

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  const testConfig: Partial<ApiKeyConfig> = {
    prefix: 'test_',
    length: 32,
    hashAlgorithm: 'sha256',
    maxKeysPerUser: 5,
    rateLimitPerMinute: 100,
  };

  beforeEach(() => {
    apiKeyService = new ApiKeyService(testConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create service with default config', () => {
      const service = new ApiKeyService();
      expect(service).toBeInstanceOf(ApiKeyService);
    });

    it('should create service with custom config', () => {
      const customConfig: Partial<ApiKeyConfig> = {
        prefix: 'custom_',
        length: 64,
      };
      const service = new ApiKeyService(customConfig);
      expect(service).toBeInstanceOf(ApiKeyService);
    });
  });

  describe('createApiKey', () => {
    it('should create API key with required fields', async () => {
      const userId = 'user-123';
      const result = await apiKeyService.createApiKey(userId, {
        name: 'Test Key',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Key');
      expect(result.key).toMatch(/^test_/);
      expect(result.prefix).toMatch(/^test_.*\.\.\./);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should create API key with permissions', async () => {
      const userId = 'user-123';
      const result = await apiKeyService.createApiKey(userId, {
        name: 'Permissioned Key',
        permissions: ['read', 'write'],
      });

      expect(result.permissions).toEqual(['read', 'write']);
    });

    it('should create API key with scopes', async () => {
      const userId = 'user-123';
      const result = await apiKeyService.createApiKey(userId, {
        name: 'Scoped Key',
        scopes: ['agents', 'workflows'],
      });

      expect(result.scopes).toEqual(['agents', 'workflows']);
    });

    it('should create API key with expiration', async () => {
      const userId = 'user-123';
      const result = await apiKeyService.createApiKey(userId, {
        name: 'Expiring Key',
        expiresInDays: 30,
      });

      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should create unique keys', async () => {
      const userId = 'user-123';

      const result1 = await apiKeyService.createApiKey(userId, { name: 'Key 1' });
      const result2 = await apiKeyService.createApiKey(userId, { name: 'Key 2' });

      expect(result1.key).not.toBe(result2.key);
      expect(result1.id).not.toBe(result2.id);
    });

    it('should enforce max keys per user', async () => {
      const userId = 'user-123';

      // Create max number of keys
      for (let i = 0; i < 5; i++) {
        await apiKeyService.createApiKey(userId, { name: `Key ${i}` });
      }

      // Should throw when trying to create one more
      await expect(
        apiKeyService.createApiKey(userId, { name: 'Extra Key' })
      ).rejects.toThrow('Maximum API keys per user');
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key', async () => {
      const userId = 'user-123';
      const { key } = await apiKeyService.createApiKey(userId, {
        name: 'Valid Key',
        permissions: ['read'],
      });

      const result = await apiKeyService.validateApiKey(key);

      expect(result.valid).toBe(true);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey?.userId).toBe(userId);
      expect(result.apiKey?.permissions).toEqual(['read']);
    });

    it('should reject invalid key format', async () => {
      const result = await apiKeyService.validateApiKey('invalid-key');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('KEY_INVALID');
    });

    it('should reject non-existent key', async () => {
      const result = await apiKeyService.validateApiKey('test_nonexistentkey12345678');

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('KEY_NOT_FOUND');
    });

    it('should reject revoked key', async () => {
      const { id, key } = await apiKeyService.createApiKey('user-123', {
        name: 'Revoked Key',
      });

      await apiKeyService.revokeApiKey(id);

      const result = await apiKeyService.validateApiKey(key);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('KEY_REVOKED');
    });

    it('should reject inactive key', async () => {
      const { id, key } = await apiKeyService.createApiKey('user-123', {
        name: 'Inactive Key',
      });

      await apiKeyService.updateApiKeyStatus(id, ApiKeyStatus.INACTIVE);

      const result = await apiKeyService.validateApiKey(key);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('KEY_INACTIVE');
    });

    it('should reject expired key', async () => {
      // Create service with expired key support
      const service = new ApiKeyService({
        ...testConfig,
        defaultExpirationDays: 0, // No default expiration
      });

      const { id, key } = await service.createApiKey('user-123', {
        name: 'Expiring Key',
        expiresInDays: 0, // Will be undefined (no expiration by request)
      });

      // Manually set expired date
      const apiKey = await service.getApiKey(id);
      if (apiKey) {
        apiKey.expiresAt = new Date(Date.now() - 1000); // Expired 1 second ago
      }

      const result = await service.validateApiKey(key);

      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('KEY_EXPIRED');
    });

    it('should check IP whitelist', async () => {
      const { key } = await apiKeyService.createApiKey('user-123', {
        name: 'IP Restricted Key',
        allowedIps: ['192.168.1.1', '10.0.0.0/8'],
      });

      // Should pass with allowed IP
      const validResult = await apiKeyService.validateApiKey(key, '192.168.1.1');
      expect(validResult.valid).toBe(true);

      // Should pass with IP in CIDR range
      const cidrResult = await apiKeyService.validateApiKey(key, '10.0.0.5');
      expect(cidrResult.valid).toBe(true);

      // Should fail with non-allowed IP
      const invalidResult = await apiKeyService.validateApiKey(key, '192.168.1.2');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error?.code).toBe('IP_NOT_ALLOWED');
    });
  });

  describe('getApiKey', () => {
    it('should get API key by ID', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'Test Key',
      });

      const apiKey = await apiKeyService.getApiKey(id);

      expect(apiKey).toBeDefined();
      expect(apiKey?.id).toBe(id);
      expect(apiKey?.name).toBe('Test Key');
    });

    it('should return null for non-existent ID', async () => {
      const apiKey = await apiKeyService.getApiKey('non-existent-id');
      expect(apiKey).toBeNull();
    });
  });

  describe('listApiKeys', () => {
    it('should list all keys for a user', async () => {
      const userId = 'user-123';

      await apiKeyService.createApiKey(userId, { name: 'Key 1' });
      await apiKeyService.createApiKey(userId, { name: 'Key 2' });
      await apiKeyService.createApiKey('other-user', { name: 'Other Key' });

      const keys = await apiKeyService.listApiKeys(userId);

      expect(keys).toHaveLength(2);
      expect(keys.every((k) => k.userId === userId)).toBe(true);
    });

    it('should return empty array for user with no keys', async () => {
      const keys = await apiKeyService.listApiKeys('no-keys-user');
      expect(keys).toEqual([]);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'To Revoke',
      });

      await apiKeyService.revokeApiKey(id);

      const apiKey = await apiKeyService.getApiKey(id);
      expect(apiKey?.status).toBe(ApiKeyStatus.REVOKED);
    });

    it('should throw for non-existent key', async () => {
      await expect(apiKeyService.revokeApiKey('non-existent')).rejects.toThrow(
        'API key not found'
      );
    });
  });

  describe('updateApiKeyPermissions', () => {
    it('should update permissions', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'Test Key',
        permissions: ['read'],
      });

      const updated = await apiKeyService.updateApiKeyPermissions(id, ['read', 'write', 'delete']);

      expect(updated.permissions).toEqual(['read', 'write', 'delete']);
    });

    it('should throw for non-existent key', async () => {
      await expect(
        apiKeyService.updateApiKeyPermissions('non-existent', ['read'])
      ).rejects.toThrow('API key not found');
    });
  });

  describe('updateApiKeyStatus', () => {
    it('should update status', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'Test Key',
      });

      const updated = await apiKeyService.updateApiKeyStatus(id, ApiKeyStatus.INACTIVE);

      expect(updated.status).toBe(ApiKeyStatus.INACTIVE);
    });

    it('should throw for non-existent key', async () => {
      await expect(
        apiKeyService.updateApiKeyStatus('non-existent', ApiKeyStatus.INACTIVE)
      ).rejects.toThrow('API key not found');
    });
  });

  describe('recordUsage', () => {
    it('should update lastUsedAt', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'Test Key',
      });

      const beforeUsage = await apiKeyService.getApiKey(id);
      expect(beforeUsage?.lastUsedAt).toBeUndefined();

      await apiKeyService.recordUsage(id);

      const afterUsage = await apiKeyService.getApiKey(id);
      expect(afterUsage?.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should not throw for non-existent key', async () => {
      await expect(apiKeyService.recordUsage('non-existent')).resolves.not.toThrow();
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'Test Key',
        rateLimit: 10,
      });

      // Should allow first request
      const allowed = await apiKeyService.checkRateLimit(id);
      expect(allowed).toBe(true);
    });

    it('should deny requests exceeding rate limit', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'Rate Limited Key',
        rateLimit: 5,
      });

      // Simulate hitting rate limit
      for (let i = 0; i < 5; i++) {
        await apiKeyService.recordUsage(id);
      }

      const allowed = await apiKeyService.checkRateLimit(id);
      expect(allowed).toBe(false);
    });

    it('should return false for non-existent key', async () => {
      const allowed = await apiKeyService.checkRateLimit('non-existent');
      expect(allowed).toBe(false);
    });
  });

  describe('cleanupExpiredKeys', () => {
    it('should delete expired keys', async () => {
      const service = new ApiKeyService(testConfig);

      const { id } = await service.createApiKey('user-123', {
        name: 'Expiring Key',
        expiresInDays: 1, // Will expire
      });

      // Manually expire the key
      const apiKey = await service.getApiKey(id);
      if (apiKey) {
        apiKey.expiresAt = new Date(Date.now() - 1000);
      }

      const deleted = await service.cleanupExpiredKeys();

      expect(deleted).toBe(1);
      expect(await service.getApiKey(id)).toBeNull();
    });

    it('should not delete non-expired keys', async () => {
      const { id } = await apiKeyService.createApiKey('user-123', {
        name: 'Valid Key',
        expiresInDays: 30,
      });

      const deleted = await apiKeyService.cleanupExpiredKeys();

      expect(deleted).toBe(0);
      expect(await apiKeyService.getApiKey(id)).toBeDefined();
    });
  });

  describe('createApiKeyService factory', () => {
    it('should create ApiKeyService instance', () => {
      const service = createApiKeyService(testConfig);
      expect(service).toBeDefined();
    });

    it('should create service with default config', () => {
      const service = createApiKeyService();
      expect(service).toBeDefined();
    });
  });
});
