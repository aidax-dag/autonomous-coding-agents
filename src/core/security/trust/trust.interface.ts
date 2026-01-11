/**
 * Trust System Interfaces
 *
 * Feature: F5.2 - Trust System
 * Provides trust level management, whitelisting, and trust source verification
 *
 * @module core/security/trust
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';

/**
 * Trust level enumeration
 */
export enum TrustLevel {
  /** Blocked - cannot run */
  BLOCKED = -1,
  /** Untrusted - sandbox required */
  UNTRUSTED = 0,
  /** Verified - limited trust */
  VERIFIED = 1,
  /** Trusted - full access */
  TRUSTED = 2,
  /** Builtin - system level */
  BUILTIN = 3,
}

/**
 * Trust source type
 */
export type TrustSourceType = 'official' | 'verified' | 'community' | 'user' | 'local';

/**
 * Trust source configuration
 */
export interface TrustSource {
  /** Source identifier */
  id: string;
  /** Source name */
  name: string;
  /** Source type */
  type: TrustSourceType;
  /** Source URL for fetching trust data */
  url?: string;
  /** Public key for signature verification */
  publicKey?: string;
  /** Trust level assigned to entries from this source */
  trustLevel: TrustLevel;
  /** Whether source is enabled */
  enabled: boolean;
  /** Last sync timestamp */
  lastSync?: Date;
  /** Priority for conflict resolution */
  priority: number;
  /** Source metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Whitelist entry
 */
export interface WhitelistEntry {
  /** Entry identifier */
  id: string;
  /** Entity identifier (plugin id, agent id, etc.) */
  entityId: string;
  /** Entity type */
  entityType: EntityType;
  /** Trust source that added this entry */
  source: TrustSourceType;
  /** Assigned trust level */
  trustLevel: TrustLevel;
  /** When entry was added */
  addedAt: Date;
  /** When entry expires (optional) */
  expiresAt?: Date;
  /** Entry checksum for verification */
  checksum?: string;
  /** Entry signature */
  signature?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Reason for whitelisting */
  reason?: string;
  /** Who added this entry */
  addedBy?: string;
}

/**
 * Entity types that can be trusted
 */
export type EntityType = 'plugin' | 'agent' | 'tool' | 'hook' | 'workflow' | 'mcp-server' | 'user';

/**
 * Trust evaluation result
 */
export interface TrustEvaluation {
  /** Entity identifier */
  entityId: string;
  /** Entity type */
  entityType: EntityType;
  /** Evaluated trust level */
  trustLevel: TrustLevel;
  /** Whether entity is whitelisted */
  isWhitelisted: boolean;
  /** Whether entity is blacklisted */
  isBlacklisted: boolean;
  /** Trust sources that contributed to evaluation */
  sources: string[];
  /** Evaluation timestamp */
  evaluatedAt: Date;
  /** Evaluation details */
  details?: TrustEvaluationDetails;
}

/**
 * Trust evaluation details
 */
export interface TrustEvaluationDetails {
  /** Factors that increased trust */
  positiveFctors: TrustFactor[];
  /** Factors that decreased trust */
  negativeFactors: TrustFactor[];
  /** Final score */
  score: number;
  /** Maximum possible score */
  maxScore: number;
  /** History of trust changes */
  history?: TrustHistoryEntry[];
}

/**
 * Trust factor
 */
export interface TrustFactor {
  /** Factor name */
  name: string;
  /** Factor description */
  description: string;
  /** Score contribution */
  score: number;
  /** Factor source */
  source: string;
}

/**
 * Trust history entry
 */
export interface TrustHistoryEntry {
  /** Previous trust level */
  previousLevel: TrustLevel;
  /** New trust level */
  newLevel: TrustLevel;
  /** Change timestamp */
  timestamp: Date;
  /** Reason for change */
  reason: string;
  /** Who made the change */
  changedBy?: string;
}

/**
 * Blacklist entry
 */
export interface BlacklistEntry {
  /** Entry identifier */
  id: string;
  /** Entity identifier */
  entityId: string;
  /** Entity type */
  entityType: EntityType;
  /** When entry was added */
  addedAt: Date;
  /** Reason for blacklisting */
  reason: string;
  /** Severity of the issue */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Who added this entry */
  addedBy?: string;
  /** When entry expires (optional) */
  expiresAt?: Date;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Trust statistics
 */
export interface TrustStatistics {
  /** Total whitelisted entities */
  whitelistCount: number;
  /** Total blacklisted entities */
  blacklistCount: number;
  /** Count by trust level */
  byTrustLevel: Record<TrustLevel, number>;
  /** Count by entity type */
  byEntityType: Record<EntityType, number>;
  /** Count by source */
  bySource: Record<TrustSourceType, number>;
  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Trust Manager interface
 */
export interface ITrustManager extends IDisposable {
  // ==================== Whitelist Management ====================

  /**
   * Add entity to whitelist
   * @param entityId Entity identifier
   * @param entityType Entity type
   * @param source Trust source
   * @param options Additional options
   */
  addToWhitelist(
    entityId: string,
    entityType: EntityType,
    source: TrustSourceType,
    options?: WhitelistOptions
  ): Promise<WhitelistEntry>;

  /**
   * Remove entity from whitelist
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  removeFromWhitelist(entityId: string, entityType?: EntityType): Promise<boolean>;

  /**
   * Check if entity is whitelisted
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  isWhitelisted(entityId: string, entityType?: EntityType): boolean;

  /**
   * Get whitelist entry
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  getWhitelistEntry(entityId: string, entityType?: EntityType): WhitelistEntry | undefined;

  /**
   * Get all whitelist entries
   * @param filter Optional filter
   */
  getWhitelist(filter?: WhitelistFilter): WhitelistEntry[];

  // ==================== Blacklist Management ====================

  /**
   * Add entity to blacklist
   * @param entityId Entity identifier
   * @param entityType Entity type
   * @param reason Reason for blacklisting
   * @param options Additional options
   */
  addToBlacklist(
    entityId: string,
    entityType: EntityType,
    reason: string,
    options?: BlacklistOptions
  ): Promise<BlacklistEntry>;

  /**
   * Remove entity from blacklist
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  removeFromBlacklist(entityId: string, entityType?: EntityType): Promise<boolean>;

  /**
   * Check if entity is blacklisted
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  isBlacklisted(entityId: string, entityType?: EntityType): boolean;

  /**
   * Get blacklist entry
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  getBlacklistEntry(entityId: string, entityType?: EntityType): BlacklistEntry | undefined;

  /**
   * Get all blacklist entries
   * @param filter Optional filter
   */
  getBlacklist(filter?: BlacklistFilter): BlacklistEntry[];

  // ==================== Trust Level Management ====================

  /**
   * Get trust level for entity
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  getTrustLevel(entityId: string, entityType?: EntityType): TrustLevel;

  /**
   * Set trust level for entity
   * @param entityId Entity identifier
   * @param entityType Entity type
   * @param level Trust level
   * @param reason Reason for change
   */
  setTrustLevel(
    entityId: string,
    entityType: EntityType,
    level: TrustLevel,
    reason?: string
  ): Promise<void>;

  /**
   * Evaluate trust for entity
   * @param entityId Entity identifier
   * @param entityType Entity type
   * @param options Evaluation options
   */
  evaluateTrust(
    entityId: string,
    entityType: EntityType,
    options?: TrustEvaluationOptions
  ): Promise<TrustEvaluation>;

  // ==================== Trust Source Management ====================

  /**
   * Add trust source
   * @param source Trust source configuration
   */
  addTrustSource(source: TrustSource): void;

  /**
   * Remove trust source
   * @param sourceId Source identifier
   */
  removeTrustSource(sourceId: string): void;

  /**
   * Get trust source
   * @param sourceId Source identifier
   */
  getTrustSource(sourceId: string): TrustSource | undefined;

  /**
   * Get all trust sources
   */
  getTrustSources(): TrustSource[];

  /**
   * Sync trust data from source
   * @param sourceId Source identifier
   */
  syncTrustSource(sourceId: string): Promise<SyncResult>;

  /**
   * Sync all trust sources
   */
  syncAllSources(): Promise<Map<string, SyncResult>>;

  // ==================== Events & Statistics ====================

  /**
   * Subscribe to trust changes
   * @param handler Change handler
   */
  onTrustChange(handler: TrustChangeHandler): () => void;

  /**
   * Get trust statistics
   */
  getStatistics(): TrustStatistics;

  /**
   * Get trust history for entity
   * @param entityId Entity identifier
   * @param entityType Entity type
   */
  getHistory(entityId: string, entityType?: EntityType): TrustHistoryEntry[];

  // ==================== Import/Export ====================

  /**
   * Export trust data
   * @param options Export options
   */
  exportTrustData(options?: ExportOptions): Promise<TrustExportData>;

  /**
   * Import trust data
   * @param data Trust data to import
   * @param options Import options
   */
  importTrustData(data: TrustExportData, options?: ImportOptions): Promise<ImportResult>;
}

/**
 * Whitelist options
 */
export interface WhitelistOptions {
  /** Trust level to assign */
  trustLevel?: TrustLevel;
  /** Expiration time */
  expiresAt?: Date;
  /** Entry checksum */
  checksum?: string;
  /** Entry signature */
  signature?: string;
  /** Reason for whitelisting */
  reason?: string;
  /** Who is adding the entry */
  addedBy?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Blacklist options
 */
export interface BlacklistOptions {
  /** Severity level */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** Expiration time */
  expiresAt?: Date;
  /** Who is adding the entry */
  addedBy?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Whitelist filter
 */
export interface WhitelistFilter {
  /** Filter by entity type */
  entityType?: EntityType;
  /** Filter by source */
  source?: TrustSourceType;
  /** Filter by trust level */
  trustLevel?: TrustLevel;
  /** Include expired entries */
  includeExpired?: boolean;
}

/**
 * Blacklist filter
 */
export interface BlacklistFilter {
  /** Filter by entity type */
  entityType?: EntityType;
  /** Filter by severity */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** Include expired entries */
  includeExpired?: boolean;
}

/**
 * Trust evaluation options
 */
export interface TrustEvaluationOptions {
  /** Include detailed evaluation */
  includeDetails?: boolean;
  /** Include history */
  includeHistory?: boolean;
  /** Force re-evaluation */
  force?: boolean;
}

/**
 * Sync result
 */
export interface SyncResult {
  /** Source identifier */
  sourceId: string;
  /** Whether sync was successful */
  success: boolean;
  /** Number of entries added */
  added: number;
  /** Number of entries updated */
  updated: number;
  /** Number of entries removed */
  removed: number;
  /** Sync timestamp */
  timestamp: Date;
  /** Error message if failed */
  error?: string;
}

/**
 * Trust change handler
 */
export type TrustChangeHandler = (event: TrustChangeEvent) => void;

/**
 * Trust change event
 */
export interface TrustChangeEvent {
  /** Event type */
  type: 'whitelist_add' | 'whitelist_remove' | 'blacklist_add' | 'blacklist_remove' | 'trust_change';
  /** Entity identifier */
  entityId: string;
  /** Entity type */
  entityType: EntityType;
  /** Previous trust level */
  previousLevel?: TrustLevel;
  /** New trust level */
  newLevel?: TrustLevel;
  /** Event timestamp */
  timestamp: Date;
  /** Event source */
  source: string;
}

/**
 * Export options
 */
export interface ExportOptions {
  /** Include whitelist */
  includeWhitelist?: boolean;
  /** Include blacklist */
  includeBlacklist?: boolean;
  /** Include sources */
  includeSources?: boolean;
  /** Include history */
  includeHistory?: boolean;
  /** Filter by entity type */
  entityTypes?: EntityType[];
}

/**
 * Import options
 */
export interface ImportOptions {
  /** Merge with existing data */
  merge?: boolean;
  /** Override existing entries */
  override?: boolean;
  /** Validate signatures */
  validateSignatures?: boolean;
  /** Import whitelist */
  importWhitelist?: boolean;
  /** Import blacklist */
  importBlacklist?: boolean;
  /** Import sources */
  importSources?: boolean;
}

/**
 * Trust export data
 */
export interface TrustExportData {
  /** Export version */
  version: string;
  /** Export timestamp */
  exportedAt: Date;
  /** Whitelist entries */
  whitelist?: WhitelistEntry[];
  /** Blacklist entries */
  blacklist?: BlacklistEntry[];
  /** Trust sources */
  sources?: TrustSource[];
  /** Trust history */
  history?: Map<string, TrustHistoryEntry[]>;
  /** Export signature */
  signature?: string;
}

/**
 * Import result
 */
export interface ImportResult {
  /** Whether import was successful */
  success: boolean;
  /** Number of whitelist entries imported */
  whitelistImported: number;
  /** Number of blacklist entries imported */
  blacklistImported: number;
  /** Number of sources imported */
  sourcesImported: number;
  /** Errors encountered */
  errors: string[];
  /** Import timestamp */
  timestamp: Date;
}
