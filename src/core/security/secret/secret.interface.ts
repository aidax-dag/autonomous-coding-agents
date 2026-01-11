/**
 * Secret Management Interfaces
 *
 * Feature: F5.5 - Secret Management
 * Provides secure secret storage, encryption, and access control
 *
 * @module core/security/secret
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';

/**
 * Secret type
 */
export type SecretType =
  | 'api_key'
  | 'password'
  | 'token'
  | 'certificate'
  | 'private_key'
  | 'connection_string'
  | 'credential'
  | 'generic';

/**
 * Secret scope
 */
export type SecretScope = 'global' | 'project' | 'workspace' | 'user' | 'agent';

/**
 * Secret metadata
 */
export interface SecretMetadata {
  /** Secret identifier */
  id: string;
  /** Secret name */
  name: string;
  /** Secret type */
  type: SecretType;
  /** Secret scope */
  scope: SecretScope;
  /** Scope identifier (project ID, user ID, etc.) */
  scopeId?: string;
  /** Secret description */
  description?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last updated timestamp */
  updatedAt: Date;
  /** Created by */
  createdBy?: string;
  /** Updated by */
  updatedBy?: string;
  /** Current version */
  version: number;
  /** Whether secret is encrypted at rest */
  encrypted: boolean;
  /** Expiration timestamp */
  expiresAt?: Date;
  /** Whether secret has expired */
  expired?: boolean;
  /** Rotation configuration */
  rotation?: SecretRotationConfig;
  /** Tags for organization */
  tags?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Secret with value
 */
export interface Secret extends SecretMetadata {
  /** Secret value (decrypted) */
  value: string;
}

/**
 * Secret version
 */
export interface SecretVersion {
  /** Version number */
  version: number;
  /** Created timestamp */
  createdAt: Date;
  /** Created by */
  createdBy?: string;
  /** Whether this version is current */
  isCurrent: boolean;
  /** Whether this version is encrypted */
  encrypted: boolean;
  /** Encrypted value (for storage) */
  encryptedValue?: string;
}

/**
 * Secret rotation configuration
 */
export interface SecretRotationConfig {
  /** Whether rotation is enabled */
  enabled: boolean;
  /** Rotation interval in days */
  intervalDays: number;
  /** Last rotation timestamp */
  lastRotated?: Date;
  /** Next rotation timestamp */
  nextRotation?: Date;
  /** Auto-rotate on expiration */
  autoRotate?: boolean;
  /** Notify before expiration (days) */
  notifyBeforeDays?: number;
}

/**
 * Secret access log entry
 */
export interface SecretAccessLog {
  /** Log entry ID */
  id: string;
  /** Secret ID */
  secretId: string;
  /** Access type */
  accessType: 'read' | 'write' | 'delete' | 'rotate';
  /** Actor who accessed */
  actorId: string;
  /** Actor type */
  actorType: string;
  /** Access timestamp */
  timestamp: Date;
  /** Access context */
  context?: Record<string, unknown>;
  /** Whether access was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Encryption algorithm
 */
export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Algorithm to use */
  algorithm: EncryptionAlgorithm;
  /** Key derivation function */
  kdf: 'pbkdf2' | 'scrypt' | 'argon2';
  /** KDF iterations */
  iterations?: number;
  /** Salt length in bytes */
  saltLength?: number;
  /** IV length in bytes */
  ivLength?: number;
}

/**
 * Secret filter
 */
export interface SecretFilter {
  /** Filter by type */
  type?: SecretType | SecretType[];
  /** Filter by scope */
  scope?: SecretScope;
  /** Filter by scope ID */
  scopeId?: string;
  /** Filter by tags */
  tags?: string[];
  /** Filter by name pattern */
  namePattern?: string;
  /** Include expired secrets */
  includeExpired?: boolean;
  /** Filter by creation date range */
  createdAfter?: Date;
  createdBefore?: Date;
}

/**
 * Secret statistics
 */
export interface SecretStatistics {
  /** Total secrets */
  totalSecrets: number;
  /** Secrets by type */
  byType: Record<SecretType, number>;
  /** Secrets by scope */
  byScope: Record<SecretScope, number>;
  /** Expired secrets count */
  expiredCount: number;
  /** Expiring soon count (next 7 days) */
  expiringSoonCount: number;
  /** Secrets needing rotation */
  needsRotationCount: number;
  /** Last updated */
  lastUpdated: Date;
}

/**
 * Secret export options
 */
export interface SecretExportOptions {
  /** Filter to apply */
  filter?: SecretFilter;
  /** Include values (requires encryption) */
  includeValues?: boolean;
  /** Export encryption key */
  exportKey?: string;
  /** Format */
  format?: 'json' | 'env' | 'yaml';
}

/**
 * Secret export data
 */
export interface SecretExportData {
  /** Export version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Format */
  format: string;
  /** Whether values are included */
  includesValues: boolean;
  /** Whether values are encrypted */
  valuesEncrypted: boolean;
  /** Secrets (metadata only if values not included) */
  secrets: Array<SecretMetadata | Secret>;
  /** Export signature for verification */
  signature?: string;
}

/**
 * Secret import options
 */
export interface SecretImportOptions {
  /** Merge with existing secrets */
  merge?: boolean;
  /** Override existing secrets */
  override?: boolean;
  /** Import encryption key (if values are encrypted) */
  importKey?: string;
  /** Validate before import */
  validateFirst?: boolean;
}

/**
 * Secret import result
 */
export interface SecretImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Secrets imported */
  imported: number;
  /** Secrets updated */
  updated: number;
  /** Secrets skipped */
  skipped: number;
  /** Errors encountered */
  errors: string[];
  /** Import timestamp */
  timestamp: Date;
}

/**
 * Secret event
 */
export interface SecretEvent {
  /** Event type */
  type: 'created' | 'updated' | 'deleted' | 'rotated' | 'expired' | 'accessed';
  /** Secret ID */
  secretId: string;
  /** Secret name */
  secretName: string;
  /** Event timestamp */
  timestamp: Date;
  /** Actor who triggered the event */
  actorId?: string;
  /** Event details */
  details?: Record<string, unknown>;
}

/**
 * Secret Manager interface
 */
export interface ISecretManager extends IDisposable {
  // ==================== Secret CRUD ====================

  /**
   * Create a new secret
   * @param name Secret name
   * @param value Secret value
   * @param options Creation options
   */
  create(name: string, value: string, options?: SecretCreateOptions): Promise<SecretMetadata>;

  /**
   * Get a secret by ID
   * @param secretId Secret identifier
   */
  get(secretId: string): Promise<Secret | undefined>;

  /**
   * Get a secret by name
   * @param name Secret name
   * @param scope Optional scope
   * @param scopeId Optional scope ID
   */
  getByName(name: string, scope?: SecretScope, scopeId?: string): Promise<Secret | undefined>;

  /**
   * Update a secret value
   * @param secretId Secret identifier
   * @param value New value
   * @param updatedBy Who is updating
   */
  update(secretId: string, value: string, updatedBy?: string): Promise<SecretMetadata | undefined>;

  /**
   * Update secret metadata
   * @param secretId Secret identifier
   * @param metadata Metadata updates
   */
  updateMetadata(
    secretId: string,
    metadata: Partial<Pick<SecretMetadata, 'description' | 'tags' | 'expiresAt' | 'rotation' | 'metadata'>>
  ): Promise<SecretMetadata | undefined>;

  /**
   * Delete a secret
   * @param secretId Secret identifier
   */
  delete(secretId: string): Promise<boolean>;

  /**
   * List secrets
   * @param filter Optional filter
   */
  list(filter?: SecretFilter): Promise<SecretMetadata[]>;

  /**
   * Check if secret exists
   * @param name Secret name
   * @param scope Optional scope
   * @param scopeId Optional scope ID
   */
  exists(name: string, scope?: SecretScope, scopeId?: string): boolean;

  // ==================== Secret Versioning ====================

  /**
   * Get secret versions
   * @param secretId Secret identifier
   */
  getVersions(secretId: string): SecretVersion[];

  /**
   * Get specific version value
   * @param secretId Secret identifier
   * @param version Version number
   */
  getVersion(secretId: string, version: number): Promise<string | undefined>;

  /**
   * Rollback to previous version
   * @param secretId Secret identifier
   * @param version Version to rollback to
   */
  rollback(secretId: string, version: number): Promise<SecretMetadata | undefined>;

  // ==================== Secret Rotation ====================

  /**
   * Configure secret rotation
   * @param secretId Secret identifier
   * @param config Rotation configuration
   */
  configureRotation(secretId: string, config: SecretRotationConfig): Promise<void>;

  /**
   * Rotate a secret manually
   * @param secretId Secret identifier
   * @param newValue New value (optional, auto-generated if not provided)
   */
  rotate(secretId: string, newValue?: string): Promise<SecretMetadata>;

  /**
   * Get secrets needing rotation
   */
  getSecretsNeedingRotation(): SecretMetadata[];

  /**
   * Run scheduled rotation check
   */
  runRotationCheck(): Promise<{ rotated: number; errors: string[] }>;

  // ==================== Environment Integration ====================

  /**
   * Load secrets into environment variables
   * @param filter Optional filter
   * @param prefix Optional prefix for env var names
   */
  loadToEnv(filter?: SecretFilter, prefix?: string): Promise<number>;

  /**
   * Create secret from environment variable
   * @param envVar Environment variable name
   * @param secretName Secret name (defaults to env var name)
   * @param options Creation options
   */
  createFromEnv(envVar: string, secretName?: string, options?: SecretCreateOptions): Promise<SecretMetadata | undefined>;

  /**
   * Sync secrets with environment
   * @param filter Optional filter
   * @param direction Sync direction
   */
  syncWithEnv(filter?: SecretFilter, direction?: 'to_env' | 'from_env'): Promise<{ synced: number; errors: string[] }>;

  // ==================== Access Control ====================

  /**
   * Get access log for a secret
   * @param secretId Secret identifier
   * @param limit Maximum entries to return
   */
  getAccessLog(secretId: string, limit?: number): SecretAccessLog[];

  /**
   * Check if actor can access secret
   * @param secretId Secret identifier
   * @param actorId Actor identifier
   * @param accessType Type of access
   */
  canAccess(secretId: string, actorId: string, accessType: SecretAccessLog['accessType']): boolean;

  // ==================== Statistics & Export ====================

  /**
   * Get secret statistics
   */
  getStatistics(): SecretStatistics;

  /**
   * Export secrets
   * @param options Export options
   */
  export(options?: SecretExportOptions): Promise<SecretExportData>;

  /**
   * Import secrets
   * @param data Import data
   * @param options Import options
   */
  import(data: SecretExportData, options?: SecretImportOptions): Promise<SecretImportResult>;

  // ==================== Events ====================

  /**
   * Subscribe to secret events
   * @param handler Event handler
   */
  onEvent(handler: (event: SecretEvent) => void): () => void;

  // ==================== Encryption ====================

  /**
   * Get encryption configuration
   */
  getEncryptionConfig(): EncryptionConfig;

  /**
   * Re-encrypt all secrets with new key
   * @param newKey New encryption key
   */
  reencryptAll(newKey: string): Promise<{ reencrypted: number; errors: string[] }>;
}

/**
 * Secret creation options
 */
export interface SecretCreateOptions {
  /** Secret type */
  type?: SecretType;
  /** Secret scope */
  scope?: SecretScope;
  /** Scope identifier */
  scopeId?: string;
  /** Description */
  description?: string;
  /** Expiration */
  expiresAt?: Date;
  /** Rotation configuration */
  rotation?: SecretRotationConfig;
  /** Tags */
  tags?: string[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Created by */
  createdBy?: string;
}

/**
 * Generate a secure random string
 * @param length String length
 * @param charset Character set to use
 */
export function generateSecureString(
  length: number,
  charset: 'alphanumeric' | 'hex' | 'base64' | 'symbols' = 'alphanumeric'
): string {
  const crypto = require('node:crypto');

  const charsets: Record<string, string> = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    hex: '0123456789abcdef',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    symbols: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?',
  };

  const chars = charsets[charset];
  const bytes = crypto.randomBytes(length);
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return result;
}
