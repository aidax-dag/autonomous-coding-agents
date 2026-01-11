/**
 * Secret Manager Implementation
 *
 * Feature: F5.5 - Secret Management
 * Secure secret storage with encryption and access control
 *
 * @module core/security/secret
 */

import { randomUUID, createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync, createHash } from 'node:crypto';
import { createLogger } from '../../services/logger.js';
import type {
  ISecretManager,
  Secret,
  SecretMetadata,
  SecretVersion,
  SecretType,
  SecretScope,
  SecretFilter,
  SecretStatistics,
  SecretCreateOptions,
  SecretRotationConfig,
  SecretAccessLog,
  SecretExportOptions,
  SecretExportData,
  SecretImportOptions,
  SecretImportResult,
  SecretEvent,
  EncryptionConfig,
} from './secret.interface.js';
import { generateSecureString } from './secret.interface.js';

const logger = createLogger('SecretManager');

/**
 * Internal secret storage format
 */
interface StoredSecret {
  metadata: SecretMetadata;
  encryptedValue: string;
  versions: SecretVersion[];
  accessLog: SecretAccessLog[];
}

/**
 * Default encryption configuration
 */
const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  kdf: 'pbkdf2',
  iterations: 100000,
  saltLength: 32,
  ivLength: 16,
};

/**
 * Secret Manager implementation
 */
export class SecretManager implements ISecretManager {
  private secrets: Map<string, StoredSecret> = new Map();
  private nameIndex: Map<string, string> = new Map(); // name:scope:scopeId -> id
  private encryptionKey: Buffer;
  private encryptionConfig: EncryptionConfig;
  private eventHandlers: Set<(event: SecretEvent) => void> = new Set();
  private disposed = false;

  constructor(masterKey?: string, config?: Partial<EncryptionConfig>) {
    this.encryptionConfig = { ...DEFAULT_ENCRYPTION_CONFIG, ...config };

    // Derive encryption key from master key
    const key = masterKey || process.env.SECRET_MASTER_KEY || generateSecureString(32, 'alphanumeric');
    const salt = createHash('sha256').update('secret-manager-salt').digest();

    this.encryptionKey = pbkdf2Sync(
      key,
      salt,
      this.encryptionConfig.iterations!,
      32,
      'sha512'
    );

    logger.info('SecretManager initialized', {
      algorithm: this.encryptionConfig.algorithm,
      kdf: this.encryptionConfig.kdf,
    });
  }

  // ==================== Encryption Helpers ====================

  /**
   * Encrypt a value
   */
  private encrypt(value: string): string {
    const iv = randomBytes(this.encryptionConfig.ivLength!);
    const cipher = createCipheriv(this.encryptionConfig.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // For GCM, get auth tag
    const authTag = this.encryptionConfig.algorithm.includes('gcm')
      ? (cipher as unknown as { getAuthTag(): Buffer }).getAuthTag().toString('hex')
      : '';

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt a value
   */
  private decrypt(encryptedValue: string): string {
    const parts = encryptedValue.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = parts[1] ? Buffer.from(parts[1], 'hex') : null;
    const encrypted = parts[2];

    const decipher = createDecipheriv(this.encryptionConfig.algorithm, this.encryptionKey, iv);

    if (authTag && this.encryptionConfig.algorithm.includes('gcm')) {
      (decipher as unknown as { setAuthTag(tag: Buffer): void }).setAuthTag(authTag);
    }

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate name index key
   */
  private getNameKey(name: string, scope: SecretScope = 'global', scopeId?: string): string {
    return `${name}:${scope}:${scopeId || ''}`;
  }

  /**
   * Log access to secret
   */
  private logSecretAccess(
    secretId: string,
    accessType: SecretAccessLog['accessType'],
    actorId: string,
    actorType: string,
    success: boolean,
    error?: string
  ): void {
    const stored = this.secrets.get(secretId);
    if (!stored) return;

    const logEntry: SecretAccessLog = {
      id: randomUUID(),
      secretId,
      accessType,
      actorId,
      actorType,
      timestamp: new Date(),
      success,
      error,
    };

    stored.accessLog.push(logEntry);

    // Keep only last 1000 access logs per secret
    if (stored.accessLog.length > 1000) {
      stored.accessLog = stored.accessLog.slice(-1000);
    }
  }

  /**
   * Emit secret event
   */
  private emitEvent(event: SecretEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        logger.error('Error in secret event handler', { error });
      }
    }
  }

  // ==================== Secret CRUD ====================

  async create(name: string, value: string, options: SecretCreateOptions = {}): Promise<SecretMetadata> {
    const {
      type = 'generic',
      scope = 'global',
      scopeId,
      description,
      expiresAt,
      rotation,
      tags,
      metadata,
      createdBy,
    } = options;

    // Check if secret with same name exists in scope
    const nameKey = this.getNameKey(name, scope, scopeId);
    if (this.nameIndex.has(nameKey)) {
      throw new Error(`Secret "${name}" already exists in scope ${scope}${scopeId ? `:${scopeId}` : ''}`);
    }

    const now = new Date();
    const id = randomUUID();

    const secretMetadata: SecretMetadata = {
      id,
      name,
      type,
      scope,
      scopeId,
      description,
      createdAt: now,
      updatedAt: now,
      createdBy,
      version: 1,
      encrypted: true,
      expiresAt,
      rotation,
      tags,
      metadata,
    };

    const encryptedValue = this.encrypt(value);

    const stored: StoredSecret = {
      metadata: secretMetadata,
      encryptedValue,
      versions: [
        {
          version: 1,
          createdAt: now,
          createdBy,
          isCurrent: true,
          encrypted: true,
          encryptedValue,
        },
      ],
      accessLog: [],
    };

    this.secrets.set(id, stored);
    this.nameIndex.set(nameKey, id);

    this.emitEvent({
      type: 'created',
      secretId: id,
      secretName: name,
      timestamp: now,
      actorId: createdBy,
    });

    logger.info('Secret created', { secretId: id, name, type, scope });
    return secretMetadata;
  }

  async get(secretId: string): Promise<Secret | undefined> {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return undefined;
    }

    // Check expiration
    if (stored.metadata.expiresAt && new Date() > stored.metadata.expiresAt) {
      stored.metadata.expired = true;
    }

    try {
      const value = this.decrypt(stored.encryptedValue);

      // Log access for audit trail
      this.logSecretAccess(secretId, 'read', 'system', 'service', true);

      this.emitEvent({
        type: 'accessed',
        secretId,
        secretName: stored.metadata.name,
        timestamp: new Date(),
      });

      return {
        ...stored.metadata,
        value,
      };
    } catch (error) {
      logger.error('Failed to decrypt secret', { secretId, error });
      return undefined;
    }
  }

  async getByName(name: string, scope: SecretScope = 'global', scopeId?: string): Promise<Secret | undefined> {
    const nameKey = this.getNameKey(name, scope, scopeId);
    const secretId = this.nameIndex.get(nameKey);
    if (!secretId) {
      return undefined;
    }
    return this.get(secretId);
  }

  async update(secretId: string, value: string, updatedBy?: string): Promise<SecretMetadata | undefined> {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return undefined;
    }

    const now = new Date();
    const newVersion = stored.metadata.version + 1;

    // Mark previous version as not current
    for (const version of stored.versions) {
      version.isCurrent = false;
    }

    // Encrypt new value
    const encryptedValue = this.encrypt(value);

    // Add new version
    stored.versions.push({
      version: newVersion,
      createdAt: now,
      createdBy: updatedBy,
      isCurrent: true,
      encrypted: true,
      encryptedValue,
    });

    // Keep only last 10 versions
    if (stored.versions.length > 10) {
      stored.versions = stored.versions.slice(-10);
    }

    // Update metadata
    stored.metadata.version = newVersion;
    stored.metadata.updatedAt = now;
    stored.metadata.updatedBy = updatedBy;
    stored.encryptedValue = encryptedValue;

    this.emitEvent({
      type: 'updated',
      secretId,
      secretName: stored.metadata.name,
      timestamp: now,
      actorId: updatedBy,
      details: { version: newVersion },
    });

    logger.info('Secret updated', { secretId, version: newVersion });
    return stored.metadata;
  }

  async updateMetadata(
    secretId: string,
    metadata: Partial<Pick<SecretMetadata, 'description' | 'tags' | 'expiresAt' | 'rotation' | 'metadata'>>
  ): Promise<SecretMetadata | undefined> {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return undefined;
    }

    Object.assign(stored.metadata, metadata);
    stored.metadata.updatedAt = new Date();

    logger.info('Secret metadata updated', { secretId });
    return stored.metadata;
  }

  async delete(secretId: string): Promise<boolean> {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return false;
    }

    // Remove from name index
    const nameKey = this.getNameKey(stored.metadata.name, stored.metadata.scope, stored.metadata.scopeId);
    this.nameIndex.delete(nameKey);

    // Remove secret
    this.secrets.delete(secretId);

    this.emitEvent({
      type: 'deleted',
      secretId,
      secretName: stored.metadata.name,
      timestamp: new Date(),
    });

    logger.info('Secret deleted', { secretId, name: stored.metadata.name });
    return true;
  }

  async list(filter?: SecretFilter): Promise<SecretMetadata[]> {
    let secrets = Array.from(this.secrets.values()).map((s) => s.metadata);

    if (filter) {
      // Type filter
      if (filter.type) {
        const types = Array.isArray(filter.type) ? filter.type : [filter.type];
        secrets = secrets.filter((s) => types.includes(s.type));
      }

      // Scope filter
      if (filter.scope) {
        secrets = secrets.filter((s) => s.scope === filter.scope);
      }

      // Scope ID filter
      if (filter.scopeId) {
        secrets = secrets.filter((s) => s.scopeId === filter.scopeId);
      }

      // Tags filter
      if (filter.tags && filter.tags.length > 0) {
        secrets = secrets.filter((s) => s.tags && filter.tags!.some((t) => s.tags!.includes(t)));
      }

      // Name pattern filter
      if (filter.namePattern) {
        const pattern = new RegExp(filter.namePattern, 'i');
        secrets = secrets.filter((s) => pattern.test(s.name));
      }

      // Expired filter
      if (!filter.includeExpired) {
        secrets = secrets.filter((s) => !s.expired && (!s.expiresAt || new Date() <= s.expiresAt));
      }

      // Date range filters
      if (filter.createdAfter) {
        secrets = secrets.filter((s) => s.createdAt >= filter.createdAfter!);
      }
      if (filter.createdBefore) {
        secrets = secrets.filter((s) => s.createdAt <= filter.createdBefore!);
      }
    }

    return secrets;
  }

  exists(name: string, scope: SecretScope = 'global', scopeId?: string): boolean {
    const nameKey = this.getNameKey(name, scope, scopeId);
    return this.nameIndex.has(nameKey);
  }

  // ==================== Secret Versioning ====================

  getVersions(secretId: string): SecretVersion[] {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return [];
    }

    // Return versions without encrypted values for security
    return stored.versions.map((v) => ({
      ...v,
      encryptedValue: undefined,
    }));
  }

  async getVersion(secretId: string, version: number): Promise<string | undefined> {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return undefined;
    }

    const versionEntry = stored.versions.find((v) => v.version === version);
    if (!versionEntry || !versionEntry.encryptedValue) {
      return undefined;
    }

    try {
      return this.decrypt(versionEntry.encryptedValue);
    } catch (error) {
      logger.error('Failed to decrypt version', { secretId, version, error });
      return undefined;
    }
  }

  async rollback(secretId: string, version: number): Promise<SecretMetadata | undefined> {
    const value = await this.getVersion(secretId, version);
    if (!value) {
      return undefined;
    }

    return this.update(secretId, value, 'system:rollback');
  }

  // ==================== Secret Rotation ====================

  async configureRotation(secretId: string, config: SecretRotationConfig): Promise<void> {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      throw new Error(`Secret not found: ${secretId}`);
    }

    stored.metadata.rotation = config;

    // Calculate next rotation
    if (config.enabled && config.intervalDays) {
      const lastRotated = config.lastRotated || stored.metadata.createdAt;
      stored.metadata.rotation.nextRotation = new Date(
        lastRotated.getTime() + config.intervalDays * 24 * 60 * 60 * 1000
      );
    }

    stored.metadata.updatedAt = new Date();
    logger.info('Secret rotation configured', { secretId, config });
  }

  async rotate(secretId: string, newValue?: string): Promise<SecretMetadata> {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      throw new Error(`Secret not found: ${secretId}`);
    }

    // Generate new value if not provided
    const value = newValue || generateSecureString(32, 'symbols');

    // Update secret
    await this.update(secretId, value, 'system:rotation');

    // Update rotation info
    if (stored.metadata.rotation) {
      stored.metadata.rotation.lastRotated = new Date();
      if (stored.metadata.rotation.intervalDays) {
        stored.metadata.rotation.nextRotation = new Date(
          Date.now() + stored.metadata.rotation.intervalDays * 24 * 60 * 60 * 1000
        );
      }
    }

    this.emitEvent({
      type: 'rotated',
      secretId,
      secretName: stored.metadata.name,
      timestamp: new Date(),
    });

    logger.info('Secret rotated', { secretId });
    return stored.metadata;
  }

  getSecretsNeedingRotation(): SecretMetadata[] {
    const now = new Date();
    const secrets: SecretMetadata[] = [];

    for (const stored of this.secrets.values()) {
      const rotation = stored.metadata.rotation;
      if (rotation?.enabled && rotation.nextRotation && rotation.nextRotation <= now) {
        secrets.push(stored.metadata);
      }
    }

    return secrets;
  }

  async runRotationCheck(): Promise<{ rotated: number; errors: string[] }> {
    const needsRotation = this.getSecretsNeedingRotation();
    let rotated = 0;
    const errors: string[] = [];

    for (const secret of needsRotation) {
      if (secret.rotation?.autoRotate) {
        try {
          await this.rotate(secret.id);
          rotated++;
        } catch (error) {
          errors.push(`Failed to rotate ${secret.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    logger.info('Rotation check completed', { rotated, errors: errors.length, needsRotation: needsRotation.length });
    return { rotated, errors };
  }

  // ==================== Environment Integration ====================

  async loadToEnv(filter?: SecretFilter, prefix = ''): Promise<number> {
    const secrets = await this.list(filter);
    let loaded = 0;

    for (const metadata of secrets) {
      try {
        const secret = await this.get(metadata.id);
        if (secret) {
          const envName = `${prefix}${secret.name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`;
          process.env[envName] = secret.value;
          loaded++;
        }
      } catch (error) {
        logger.error('Failed to load secret to env', { secretId: metadata.id, error });
      }
    }

    logger.info('Secrets loaded to environment', { count: loaded });
    return loaded;
  }

  async createFromEnv(
    envVar: string,
    secretName?: string,
    options?: SecretCreateOptions
  ): Promise<SecretMetadata | undefined> {
    const value = process.env[envVar];
    if (!value) {
      logger.warn('Environment variable not found', { envVar });
      return undefined;
    }

    const name = secretName || envVar.toLowerCase().replace(/_/g, '-');
    return this.create(name, value, options);
  }

  async syncWithEnv(
    filter?: SecretFilter,
    direction: 'to_env' | 'from_env' = 'to_env'
  ): Promise<{ synced: number; errors: string[] }> {
    let synced = 0;
    const errors: string[] = [];

    if (direction === 'to_env') {
      synced = await this.loadToEnv(filter);
    } else {
      // Import from environment - look for common secret env vars
      const envVars = Object.keys(process.env).filter(
        (key) =>
          key.includes('SECRET') ||
          key.includes('API_KEY') ||
          key.includes('TOKEN') ||
          key.includes('PASSWORD') ||
          key.includes('CREDENTIAL')
      );

      for (const envVar of envVars) {
        try {
          const name = envVar.toLowerCase().replace(/_/g, '-');
          if (!this.exists(name)) {
            await this.createFromEnv(envVar, name, { type: 'generic' });
            synced++;
          }
        } catch (error) {
          errors.push(`Failed to sync ${envVar}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return { synced, errors };
  }

  // ==================== Access Control ====================

  getAccessLog(secretId: string, limit = 100): SecretAccessLog[] {
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return [];
    }

    return stored.accessLog.slice(-limit);
  }

  canAccess(secretId: string, _actorId: string, _accessType: SecretAccessLog['accessType']): boolean {
    // Default implementation - always allow
    // In a real implementation, this would check access policies based on actorId and accessType
    const stored = this.secrets.get(secretId);
    if (!stored) {
      return false;
    }

    // Check if secret is expired
    if (stored.metadata.expired) {
      return false;
    }

    return true;
  }

  // ==================== Statistics & Export ====================

  getStatistics(): SecretStatistics {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const byType: Record<SecretType, number> = {
      api_key: 0,
      password: 0,
      token: 0,
      certificate: 0,
      private_key: 0,
      connection_string: 0,
      credential: 0,
      generic: 0,
    };

    const byScope: Record<SecretScope, number> = {
      global: 0,
      project: 0,
      workspace: 0,
      user: 0,
      agent: 0,
    };

    let expiredCount = 0;
    let expiringSoonCount = 0;
    let needsRotationCount = 0;

    for (const stored of this.secrets.values()) {
      const metadata = stored.metadata;

      byType[metadata.type]++;
      byScope[metadata.scope]++;

      // Check expiration
      if (metadata.expiresAt) {
        if (metadata.expiresAt <= now) {
          expiredCount++;
        } else if (metadata.expiresAt <= sevenDaysFromNow) {
          expiringSoonCount++;
        }
      }

      // Check rotation
      if (metadata.rotation?.enabled && metadata.rotation.nextRotation && metadata.rotation.nextRotation <= now) {
        needsRotationCount++;
      }
    }

    return {
      totalSecrets: this.secrets.size,
      byType,
      byScope,
      expiredCount,
      expiringSoonCount,
      needsRotationCount,
      lastUpdated: new Date(),
    };
  }

  async export(options: SecretExportOptions = {}): Promise<SecretExportData> {
    const { filter, includeValues = false, exportKey, format = 'json' } = options;

    const secretsList = await this.list(filter);
    const secrets: Array<SecretMetadata | Secret> = [];

    for (const metadata of secretsList) {
      if (includeValues) {
        const secret = await this.get(metadata.id);
        if (secret) {
          if (exportKey) {
            // Re-encrypt with export key
            const tempManager = new SecretManager(exportKey);
            const encrypted = tempManager.encrypt(secret.value);
            secrets.push({ ...metadata, value: encrypted } as Secret);
          } else {
            secrets.push(secret);
          }
        }
      } else {
        secrets.push(metadata);
      }
    }

    const exportData: SecretExportData = {
      version: '1.0.0',
      exportedAt: new Date(),
      format,
      includesValues: includeValues,
      valuesEncrypted: !!exportKey,
      secrets,
    };

    logger.info('Secrets exported', { count: secrets.length, includeValues, encrypted: !!exportKey });
    return exportData;
  }

  async import(data: SecretExportData, options: SecretImportOptions = {}): Promise<SecretImportResult> {
    const { merge = true, override = false, importKey } = options;

    const result: SecretImportResult = {
      success: true,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      timestamp: new Date(),
    };

    for (const secretData of data.secrets) {
      try {
        const existingId = this.nameIndex.get(
          this.getNameKey(secretData.name, secretData.scope, secretData.scopeId)
        );

        if (existingId) {
          if (override && data.includesValues) {
            let value = (secretData as Secret).value;
            if (data.valuesEncrypted && importKey) {
              // Decrypt with import key
              const tempManager = new SecretManager(importKey);
              value = tempManager.decrypt(value);
            }
            await this.update(existingId, value, 'system:import');
            result.updated++;
          } else if (!merge) {
            result.errors.push(`Secret "${secretData.name}" already exists`);
          } else {
            result.skipped++;
          }
        } else if (data.includesValues) {
          let value = (secretData as Secret).value;
          if (data.valuesEncrypted && importKey) {
            const tempManager = new SecretManager(importKey);
            value = tempManager.decrypt(value);
          }
          await this.create(secretData.name, value, {
            type: secretData.type,
            scope: secretData.scope,
            scopeId: secretData.scopeId,
            description: secretData.description,
            expiresAt: secretData.expiresAt,
            rotation: secretData.rotation,
            tags: secretData.tags,
            metadata: secretData.metadata,
            createdBy: 'system:import',
          });
          result.imported++;
        } else {
          result.errors.push(`Cannot import "${secretData.name}" without value`);
        }
      } catch (error) {
        result.errors.push(
          `Failed to import "${secretData.name}": ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    result.success = result.errors.length === 0;
    logger.info('Secrets imported', {
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  }

  // ==================== Events ====================

  onEvent(handler: (event: SecretEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  // ==================== Encryption ====================

  getEncryptionConfig(): EncryptionConfig {
    return { ...this.encryptionConfig };
  }

  async reencryptAll(newKey: string): Promise<{ reencrypted: number; errors: string[] }> {
    let reencrypted = 0;
    const errors: string[] = [];

    // Create new key
    const salt = createHash('sha256').update('secret-manager-salt').digest();
    const newEncryptionKey = pbkdf2Sync(
      newKey,
      salt,
      this.encryptionConfig.iterations!,
      32,
      'sha512'
    );

    for (const [secretId, stored] of this.secrets) {
      try {
        // Decrypt with old key
        const value = this.decrypt(stored.encryptedValue);

        // Encrypt with new key
        const oldKey = this.encryptionKey;
        this.encryptionKey = newEncryptionKey;
        const newEncryptedValue = this.encrypt(value);
        this.encryptionKey = oldKey;

        // Update stored value
        stored.encryptedValue = newEncryptedValue;

        // Update current version
        const currentVersion = stored.versions.find((v) => v.isCurrent);
        if (currentVersion) {
          currentVersion.encryptedValue = newEncryptedValue;
        }

        reencrypted++;
      } catch (error) {
        errors.push(`Failed to re-encrypt ${secretId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Switch to new key
    this.encryptionKey = newEncryptionKey;

    logger.info('Secrets re-encrypted', { reencrypted, errors: errors.length });
    return { reencrypted, errors };
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    // Securely clear encryption key
    this.encryptionKey.fill(0);

    this.secrets.clear();
    this.nameIndex.clear();
    this.eventHandlers.clear();

    logger.info('SecretManager disposed');
  }
}
