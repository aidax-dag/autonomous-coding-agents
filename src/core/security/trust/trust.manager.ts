/**
 * Trust Manager Implementation
 *
 * Feature: F5.2 - Trust System
 * Implements trust level management, whitelisting, and trust source verification
 *
 * @module core/security/trust
 */

import * as crypto from 'crypto';
import { createLogger, ILogger } from '../../services/logger.js';
import type {
  ITrustManager,
  TrustSource,
  TrustSourceType,
  WhitelistEntry,
  BlacklistEntry,
  TrustEvaluation,
  TrustEvaluationDetails,
  TrustFactor,
  TrustHistoryEntry,
  TrustStatistics,
  TrustChangeHandler,
  TrustChangeEvent,
  WhitelistOptions,
  BlacklistOptions,
  WhitelistFilter,
  BlacklistFilter,
  TrustEvaluationOptions,
  SyncResult,
  ExportOptions,
  ImportOptions,
  TrustExportData,
  ImportResult,
  EntityType,
} from './trust.interface.js';
import { TrustLevel } from './trust.interface.js';

/**
 * Trust Manager Configuration
 */
export interface TrustManagerConfig {
  /** Default trust level for unknown entities */
  defaultTrustLevel?: TrustLevel;
  /** Enable automatic expiration cleanup */
  enableAutoCleanup?: boolean;
  /** Cleanup interval in ms */
  cleanupInterval?: number;
  /** Enable trust caching */
  enableCaching?: boolean;
  /** Cache TTL in ms */
  cacheTTL?: number;
  /** Enable history tracking */
  enableHistory?: boolean;
  /** Max history entries per entity */
  maxHistoryEntries?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<TrustManagerConfig> = {
  defaultTrustLevel: TrustLevel.UNTRUSTED,
  enableAutoCleanup: true,
  cleanupInterval: 60000, // 1 minute
  enableCaching: true,
  cacheTTL: 300000, // 5 minutes
  enableHistory: true,
  maxHistoryEntries: 100,
};

/**
 * Trust Manager
 * Manages trust levels, whitelisting, and blacklisting
 */
export class TrustManager implements ITrustManager {
  private readonly logger: ILogger;
  private readonly config: Required<TrustManagerConfig>;

  // Storage
  private readonly whitelist: Map<string, WhitelistEntry> = new Map();
  private readonly blacklist: Map<string, BlacklistEntry> = new Map();
  private readonly trustLevels: Map<string, TrustLevel> = new Map();
  private readonly trustSources: Map<string, TrustSource> = new Map();
  private readonly history: Map<string, TrustHistoryEntry[]> = new Map();

  // Event handlers
  private readonly changeHandlers: Set<TrustChangeHandler> = new Set();

  // Cache
  private readonly evaluationCache: Map<string, { evaluation: TrustEvaluation; expiresAt: number }> =
    new Map();

  // Cleanup timer
  private cleanupTimer?: NodeJS.Timeout;
  private disposed = false;

  constructor(config: TrustManagerConfig = {}) {
    this.logger = createLogger('TrustManager');
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Start cleanup timer
    if (this.config.enableAutoCleanup) {
      this.startCleanupTimer();
    }

    // Add default trust sources
    this.initializeDefaultSources();
  }

  // ==================== Whitelist Management ====================

  async addToWhitelist(
    entityId: string,
    entityType: EntityType,
    source: TrustSourceType,
    options: WhitelistOptions = {}
  ): Promise<WhitelistEntry> {
    const key = this.makeKey(entityId, entityType);

    // Check if already blacklisted
    if (this.isBlacklisted(entityId, entityType)) {
      throw new Error(`Entity is blacklisted: ${entityId}`);
    }

    const entry: WhitelistEntry = {
      id: crypto.randomUUID(),
      entityId,
      entityType,
      source,
      trustLevel: options.trustLevel ?? this.getTrustLevelFromSource(source),
      addedAt: new Date(),
      expiresAt: options.expiresAt,
      checksum: options.checksum,
      signature: options.signature,
      reason: options.reason,
      addedBy: options.addedBy,
      metadata: options.metadata,
    };

    this.whitelist.set(key, entry);

    // Update trust level
    const previousLevel = this.trustLevels.get(key);
    this.trustLevels.set(key, entry.trustLevel);

    // Record history
    if (this.config.enableHistory) {
      this.addHistoryEntry(key, previousLevel ?? this.config.defaultTrustLevel, entry.trustLevel, 'Added to whitelist', options.addedBy);
    }

    // Clear cache
    this.evaluationCache.delete(key);

    // Emit event
    this.emitChange({
      type: 'whitelist_add',
      entityId,
      entityType,
      previousLevel,
      newLevel: entry.trustLevel,
      timestamp: new Date(),
      source,
    });

    this.logger.info('Entity added to whitelist', {
      entityId,
      entityType,
      source,
      trustLevel: entry.trustLevel,
    });

    return entry;
  }

  async removeFromWhitelist(entityId: string, entityType?: EntityType): Promise<boolean> {
    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return false;

    const entry = this.whitelist.get(key);
    if (!entry) return false;

    this.whitelist.delete(key);

    // Reset trust level
    const previousLevel = this.trustLevels.get(key);
    this.trustLevels.set(key, this.config.defaultTrustLevel);

    // Record history
    if (this.config.enableHistory) {
      this.addHistoryEntry(key, previousLevel ?? this.config.defaultTrustLevel, this.config.defaultTrustLevel, 'Removed from whitelist');
    }

    // Clear cache
    this.evaluationCache.delete(key);

    // Emit event
    this.emitChange({
      type: 'whitelist_remove',
      entityId,
      entityType: entry.entityType,
      previousLevel,
      newLevel: this.config.defaultTrustLevel,
      timestamp: new Date(),
      source: 'system',
    });

    this.logger.info('Entity removed from whitelist', { entityId, entityType: entry.entityType });

    return true;
  }

  isWhitelisted(entityId: string, entityType?: EntityType): boolean {
    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return false;

    const entry = this.whitelist.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  getWhitelistEntry(entityId: string, entityType?: EntityType): WhitelistEntry | undefined {
    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return undefined;
    return this.whitelist.get(key);
  }

  getWhitelist(filter?: WhitelistFilter): WhitelistEntry[] {
    let entries = Array.from(this.whitelist.values());

    if (filter) {
      if (filter.entityType) {
        entries = entries.filter((e) => e.entityType === filter.entityType);
      }
      if (filter.source) {
        entries = entries.filter((e) => e.source === filter.source);
      }
      if (filter.trustLevel !== undefined) {
        entries = entries.filter((e) => e.trustLevel === filter.trustLevel);
      }
      if (!filter.includeExpired) {
        const now = new Date();
        entries = entries.filter((e) => !e.expiresAt || e.expiresAt > now);
      }
    }

    return entries;
  }

  // ==================== Blacklist Management ====================

  async addToBlacklist(
    entityId: string,
    entityType: EntityType,
    reason: string,
    options: BlacklistOptions = {}
  ): Promise<BlacklistEntry> {
    const key = this.makeKey(entityId, entityType);

    // Remove from whitelist if present
    if (this.isWhitelisted(entityId, entityType)) {
      await this.removeFromWhitelist(entityId, entityType);
    }

    const entry: BlacklistEntry = {
      id: crypto.randomUUID(),
      entityId,
      entityType,
      reason,
      severity: options.severity ?? 'medium',
      addedAt: new Date(),
      expiresAt: options.expiresAt,
      addedBy: options.addedBy,
      metadata: options.metadata,
    };

    this.blacklist.set(key, entry);

    // Set trust level to BLOCKED
    const previousLevel = this.trustLevels.get(key);
    this.trustLevels.set(key, TrustLevel.BLOCKED);

    // Record history
    if (this.config.enableHistory) {
      this.addHistoryEntry(key, previousLevel ?? this.config.defaultTrustLevel, TrustLevel.BLOCKED, `Blacklisted: ${reason}`, options.addedBy);
    }

    // Clear cache
    this.evaluationCache.delete(key);

    // Emit event
    this.emitChange({
      type: 'blacklist_add',
      entityId,
      entityType,
      previousLevel,
      newLevel: TrustLevel.BLOCKED,
      timestamp: new Date(),
      source: 'system',
    });

    this.logger.warn('Entity added to blacklist', {
      entityId,
      entityType,
      reason,
      severity: entry.severity,
    });

    return entry;
  }

  async removeFromBlacklist(entityId: string, entityType?: EntityType): Promise<boolean> {
    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return false;

    const entry = this.blacklist.get(key);
    if (!entry) return false;

    this.blacklist.delete(key);

    // Reset trust level
    const previousLevel = this.trustLevels.get(key);
    this.trustLevels.set(key, this.config.defaultTrustLevel);

    // Record history
    if (this.config.enableHistory) {
      this.addHistoryEntry(key, previousLevel ?? TrustLevel.BLOCKED, this.config.defaultTrustLevel, 'Removed from blacklist');
    }

    // Clear cache
    this.evaluationCache.delete(key);

    // Emit event
    this.emitChange({
      type: 'blacklist_remove',
      entityId,
      entityType: entry.entityType,
      previousLevel: TrustLevel.BLOCKED,
      newLevel: this.config.defaultTrustLevel,
      timestamp: new Date(),
      source: 'system',
    });

    this.logger.info('Entity removed from blacklist', { entityId, entityType: entry.entityType });

    return true;
  }

  isBlacklisted(entityId: string, entityType?: EntityType): boolean {
    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return false;

    const entry = this.blacklist.get(key);
    if (!entry) return false;

    // Check expiration
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  getBlacklistEntry(entityId: string, entityType?: EntityType): BlacklistEntry | undefined {
    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return undefined;
    return this.blacklist.get(key);
  }

  getBlacklist(filter?: BlacklistFilter): BlacklistEntry[] {
    let entries = Array.from(this.blacklist.values());

    if (filter) {
      if (filter.entityType) {
        entries = entries.filter((e) => e.entityType === filter.entityType);
      }
      if (filter.severity) {
        entries = entries.filter((e) => e.severity === filter.severity);
      }
      if (!filter.includeExpired) {
        const now = new Date();
        entries = entries.filter((e) => !e.expiresAt || e.expiresAt > now);
      }
    }

    return entries;
  }

  // ==================== Trust Level Management ====================

  getTrustLevel(entityId: string, entityType?: EntityType): TrustLevel {
    // Check blacklist first
    if (this.isBlacklisted(entityId, entityType)) {
      return TrustLevel.BLOCKED;
    }

    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return this.config.defaultTrustLevel;

    return this.trustLevels.get(key) ?? this.config.defaultTrustLevel;
  }

  async setTrustLevel(
    entityId: string,
    entityType: EntityType,
    level: TrustLevel,
    reason?: string
  ): Promise<void> {
    const key = this.makeKey(entityId, entityType);
    const previousLevel = this.trustLevels.get(key) ?? this.config.defaultTrustLevel;

    // Cannot set level other than BLOCKED for blacklisted entities
    if (this.isBlacklisted(entityId, entityType) && level !== TrustLevel.BLOCKED) {
      throw new Error('Cannot change trust level of blacklisted entity');
    }

    this.trustLevels.set(key, level);

    // Record history
    if (this.config.enableHistory) {
      this.addHistoryEntry(key, previousLevel, level, reason ?? 'Trust level changed manually');
    }

    // Clear cache
    this.evaluationCache.delete(key);

    // Emit event
    this.emitChange({
      type: 'trust_change',
      entityId,
      entityType,
      previousLevel,
      newLevel: level,
      timestamp: new Date(),
      source: 'manual',
    });

    this.logger.info('Trust level changed', {
      entityId,
      entityType,
      previousLevel,
      newLevel: level,
      reason,
    });
  }

  async evaluateTrust(
    entityId: string,
    entityType: EntityType,
    options: TrustEvaluationOptions = {}
  ): Promise<TrustEvaluation> {
    const key = this.makeKey(entityId, entityType);

    // Check cache
    if (this.config.enableCaching && !options.force) {
      const cached = this.evaluationCache.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.evaluation;
      }
    }

    const positiveFactors: TrustFactor[] = [];
    const negativeFactors: TrustFactor[] = [];
    const sources: string[] = [];

    // Check blacklist
    if (this.isBlacklisted(entityId, entityType)) {
      const blacklistEntry = this.getBlacklistEntry(entityId, entityType);
      negativeFactors.push({
        name: 'Blacklisted',
        description: blacklistEntry?.reason || 'Entity is blacklisted',
        score: -100,
        source: 'system',
      });
    }

    // Check whitelist
    if (this.isWhitelisted(entityId, entityType)) {
      const whitelistEntry = this.getWhitelistEntry(entityId, entityType);
      positiveFactors.push({
        name: 'Whitelisted',
        description: `Whitelisted by ${whitelistEntry?.source}`,
        score: 50,
        source: whitelistEntry?.source || 'system',
      });
      sources.push(whitelistEntry?.source || 'system');
    }

    // Check trust sources
    for (const [sourceId, source] of this.trustSources) {
      if (source.enabled) {
        sources.push(sourceId);
        // In a real implementation, this would check external trust sources
        if (source.type === 'official') {
          positiveFactors.push({
            name: 'Official source available',
            description: 'Trust source from official channel',
            score: 10,
            source: sourceId,
          });
        }
      }
    }

    // Calculate score
    const totalPositive = positiveFactors.reduce((sum, f) => sum + f.score, 0);
    const totalNegative = Math.abs(negativeFactors.reduce((sum, f) => sum + f.score, 0));
    const score = totalPositive - totalNegative;
    const maxScore = 100;

    // Determine trust level from score
    let trustLevel: TrustLevel;
    if (score < -50) {
      trustLevel = TrustLevel.BLOCKED;
    } else if (score < 0) {
      trustLevel = TrustLevel.UNTRUSTED;
    } else if (score < 30) {
      trustLevel = TrustLevel.VERIFIED;
    } else if (score < 70) {
      trustLevel = TrustLevel.TRUSTED;
    } else {
      trustLevel = TrustLevel.BUILTIN;
    }

    // Use stored trust level if higher
    const storedLevel = this.trustLevels.get(key);
    if (storedLevel !== undefined && storedLevel > trustLevel) {
      trustLevel = storedLevel;
    }

    const details: TrustEvaluationDetails | undefined = options.includeDetails
      ? {
          positiveFctors: positiveFactors,
          negativeFactors,
          score,
          maxScore,
          history: options.includeHistory ? this.history.get(key) : undefined,
        }
      : undefined;

    const evaluation: TrustEvaluation = {
      entityId,
      entityType,
      trustLevel,
      isWhitelisted: this.isWhitelisted(entityId, entityType),
      isBlacklisted: this.isBlacklisted(entityId, entityType),
      sources,
      evaluatedAt: new Date(),
      details,
    };

    // Cache result
    if (this.config.enableCaching) {
      this.evaluationCache.set(key, {
        evaluation,
        expiresAt: Date.now() + this.config.cacheTTL,
      });
    }

    return evaluation;
  }

  // ==================== Trust Source Management ====================

  addTrustSource(source: TrustSource): void {
    this.trustSources.set(source.id, source);
    this.logger.info('Trust source added', { sourceId: source.id, type: source.type });
  }

  removeTrustSource(sourceId: string): void {
    this.trustSources.delete(sourceId);
    this.logger.info('Trust source removed', { sourceId });
  }

  getTrustSource(sourceId: string): TrustSource | undefined {
    return this.trustSources.get(sourceId);
  }

  getTrustSources(): TrustSource[] {
    return Array.from(this.trustSources.values());
  }

  async syncTrustSource(sourceId: string): Promise<SyncResult> {
    const source = this.trustSources.get(sourceId);
    if (!source) {
      return {
        sourceId,
        success: false,
        added: 0,
        updated: 0,
        removed: 0,
        timestamp: new Date(),
        error: 'Trust source not found',
      };
    }

    // In a real implementation, this would fetch from the source URL
    // For now, just update the last sync timestamp
    source.lastSync = new Date();

    this.logger.info('Trust source synced', { sourceId });

    return {
      sourceId,
      success: true,
      added: 0,
      updated: 0,
      removed: 0,
      timestamp: new Date(),
    };
  }

  async syncAllSources(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();

    for (const sourceId of this.trustSources.keys()) {
      const result = await this.syncTrustSource(sourceId);
      results.set(sourceId, result);
    }

    return results;
  }

  // ==================== Events & Statistics ====================

  onTrustChange(handler: TrustChangeHandler): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  getStatistics(): TrustStatistics {
    const byTrustLevel: Record<TrustLevel, number> = {
      [TrustLevel.BLOCKED]: 0,
      [TrustLevel.UNTRUSTED]: 0,
      [TrustLevel.VERIFIED]: 0,
      [TrustLevel.TRUSTED]: 0,
      [TrustLevel.BUILTIN]: 0,
    };

    const byEntityType: Record<EntityType, number> = {
      plugin: 0,
      agent: 0,
      tool: 0,
      hook: 0,
      workflow: 0,
      'mcp-server': 0,
      user: 0,
    };

    const bySource: Record<TrustSourceType, number> = {
      official: 0,
      verified: 0,
      community: 0,
      user: 0,
      local: 0,
    };

    // Count whitelist entries
    for (const entry of this.whitelist.values()) {
      byTrustLevel[entry.trustLevel]++;
      byEntityType[entry.entityType]++;
      bySource[entry.source]++;
    }

    // Count blacklist entries
    for (const entry of this.blacklist.values()) {
      byTrustLevel[TrustLevel.BLOCKED]++;
      byEntityType[entry.entityType]++;
    }

    return {
      whitelistCount: this.whitelist.size,
      blacklistCount: this.blacklist.size,
      byTrustLevel,
      byEntityType,
      bySource,
      lastUpdated: new Date(),
    };
  }

  getHistory(entityId: string, entityType?: EntityType): TrustHistoryEntry[] {
    const key = entityType ? this.makeKey(entityId, entityType) : this.findKey(entityId);
    if (!key) return [];
    return this.history.get(key) || [];
  }

  // ==================== Import/Export ====================

  async exportTrustData(options: ExportOptions = {}): Promise<TrustExportData> {
    const data: TrustExportData = {
      version: '1.0.0',
      exportedAt: new Date(),
    };

    if (options.includeWhitelist !== false) {
      let whitelist = Array.from(this.whitelist.values());
      if (options.entityTypes) {
        whitelist = whitelist.filter((e) => options.entityTypes!.includes(e.entityType));
      }
      data.whitelist = whitelist;
    }

    if (options.includeBlacklist !== false) {
      let blacklist = Array.from(this.blacklist.values());
      if (options.entityTypes) {
        blacklist = blacklist.filter((e) => options.entityTypes!.includes(e.entityType));
      }
      data.blacklist = blacklist;
    }

    if (options.includeSources) {
      data.sources = Array.from(this.trustSources.values());
    }

    if (options.includeHistory) {
      data.history = new Map(this.history);
    }

    return data;
  }

  async importTrustData(data: TrustExportData, options: ImportOptions = {}): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      whitelistImported: 0,
      blacklistImported: 0,
      sourcesImported: 0,
      errors: [],
      timestamp: new Date(),
    };

    try {
      // Import whitelist
      if (options.importWhitelist !== false && data.whitelist) {
        for (const entry of data.whitelist) {
          const key = this.makeKey(entry.entityId, entry.entityType);
          if (!options.merge || !this.whitelist.has(key) || options.override) {
            this.whitelist.set(key, entry);
            this.trustLevels.set(key, entry.trustLevel);
            result.whitelistImported++;
          }
        }
      }

      // Import blacklist
      if (options.importBlacklist !== false && data.blacklist) {
        for (const entry of data.blacklist) {
          const key = this.makeKey(entry.entityId, entry.entityType);
          if (!options.merge || !this.blacklist.has(key) || options.override) {
            this.blacklist.set(key, entry);
            this.trustLevels.set(key, TrustLevel.BLOCKED);
            result.blacklistImported++;
          }
        }
      }

      // Import sources
      if (options.importSources && data.sources) {
        for (const source of data.sources) {
          if (!options.merge || !this.trustSources.has(source.id) || options.override) {
            this.trustSources.set(source.id, source);
            result.sourcesImported++;
          }
        }
      }

      this.logger.info('Trust data imported', {
        whitelistImported: result.whitelistImported,
        blacklistImported: result.blacklistImported,
        sourcesImported: result.sourcesImported,
      });
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
    }

    return result;
  }

  // ==================== Lifecycle ====================

  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.disposed = true;

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.whitelist.clear();
    this.blacklist.clear();
    this.trustLevels.clear();
    this.trustSources.clear();
    this.history.clear();
    this.changeHandlers.clear();
    this.evaluationCache.clear();

    this.logger.info('Trust Manager disposed');
  }

  // ==================== Private Methods ====================

  private makeKey(entityId: string, entityType: EntityType): string {
    return `${entityType}:${entityId}`;
  }

  private findKey(entityId: string): string | undefined {
    // Search through all maps to find the entity
    for (const key of this.whitelist.keys()) {
      if (key.endsWith(`:${entityId}`)) return key;
    }
    for (const key of this.blacklist.keys()) {
      if (key.endsWith(`:${entityId}`)) return key;
    }
    for (const key of this.trustLevels.keys()) {
      if (key.endsWith(`:${entityId}`)) return key;
    }
    return undefined;
  }

  private getTrustLevelFromSource(source: TrustSourceType): TrustLevel {
    const sourceLevels: Record<TrustSourceType, TrustLevel> = {
      official: TrustLevel.TRUSTED,
      verified: TrustLevel.VERIFIED,
      community: TrustLevel.VERIFIED,
      user: TrustLevel.VERIFIED,
      local: TrustLevel.UNTRUSTED,
    };
    return sourceLevels[source];
  }

  private addHistoryEntry(
    key: string,
    previousLevel: TrustLevel,
    newLevel: TrustLevel,
    reason: string,
    changedBy?: string
  ): void {
    let entries = this.history.get(key);
    if (!entries) {
      entries = [];
      this.history.set(key, entries);
    }

    entries.push({
      previousLevel,
      newLevel,
      timestamp: new Date(),
      reason,
      changedBy,
    });

    // Trim history if needed
    if (entries.length > this.config.maxHistoryEntries) {
      entries.splice(0, entries.length - this.config.maxHistoryEntries);
    }
  }

  private emitChange(event: TrustChangeEvent): void {
    for (const handler of this.changeHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error('Trust change handler error', { error });
      }
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, this.config.cleanupInterval);
  }

  private cleanupExpired(): void {
    const now = new Date();
    let cleaned = 0;

    // Clean expired whitelist entries
    for (const [key, entry] of this.whitelist) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.whitelist.delete(key);
        this.trustLevels.set(key, this.config.defaultTrustLevel);
        cleaned++;
      }
    }

    // Clean expired blacklist entries
    for (const [key, entry] of this.blacklist) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.blacklist.delete(key);
        this.trustLevels.set(key, this.config.defaultTrustLevel);
        cleaned++;
      }
    }

    // Clean expired cache entries
    for (const [key, cached] of this.evaluationCache) {
      if (cached.expiresAt < Date.now()) {
        this.evaluationCache.delete(key);
      }
    }

    if (cleaned > 0) {
      this.logger.debug('Expired entries cleaned', { count: cleaned });
    }
  }

  private initializeDefaultSources(): void {
    // Add built-in trust source
    this.addTrustSource({
      id: 'builtin',
      name: 'Built-in',
      type: 'official',
      trustLevel: TrustLevel.BUILTIN,
      enabled: true,
      priority: 100,
    });

    // Add user trust source
    this.addTrustSource({
      id: 'user',
      name: 'User Trust',
      type: 'user',
      trustLevel: TrustLevel.VERIFIED,
      enabled: true,
      priority: 50,
    });
  }
}

/**
 * Create Trust Manager instance
 */
export function createTrustManager(config?: TrustManagerConfig): ITrustManager {
  return new TrustManager(config);
}
