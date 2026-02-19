/**
 * F005-InstinctStore: Confidence-Based Pattern Learning System
 *
 * Manages atomic learned behaviors with confidence scoring:
 * - Confidence range: 0.3 (tentative) to 0.9 (near-certain)
 * - Reinforcement: +0.05 per confirmation
 * - Correction: -0.10 per rejection
 * - Evolution: High-confidence patterns can evolve to skills/commands/agents
 *
 * Source: everything-claude-code (Instinct System)
 */

import * as path from 'path';
import { randomUUID } from 'crypto';
import type { IFileSystem } from '@/shared/fs/file-system';
import { nodeFileSystem } from '@/shared/fs/file-system';
import type {
  IInstinctStore,
  Instinct,
  InstinctCreateInput,
  InstinctDomain,
  InstinctFilter,
  InstinctEvolution,
  InstinctStats,
  ImportResult,
  ConfidenceLevel,
  InstinctSource,
} from './interfaces/learning.interface';
import {
  CONFIDENCE_LEVELS,
  CONFIDENCE_ADJUSTMENTS,
} from './interfaces/learning.interface';

// ============================================================================
// Constants: Storage Configuration
// ============================================================================

/**
 * Instinct storage configuration
 */
export const INSTINCT_STORAGE_CONFIG = {
  /** Default storage directory */
  BASE_DIR: '~/.claude/homunculus/instincts/',
  /** Use domain subdirectories */
  DOMAIN_SUBDIRS: true,
  /** File extension */
  FILE_EXTENSION: '.json',
  /** Index file name */
  INDEX_FILE: 'index.json',
  /** Backup directory */
  BACKUP_DIR: 'backups/',
  /** Maximum backups */
  MAX_BACKUPS: 5,
} as const;

/**
 * Initial confidence based on source
 */
export const INITIAL_CONFIDENCE_BY_SOURCE: Record<InstinctSource, number> = {
  'session-observation': 0.3,
  'repo-analysis': 0.4,
  'user-correction': 0.6,
  'explicit-teaching': 0.7,
  'pattern-inference': 0.35,
  'imported': 0.5,
};

/**
 * Evolution thresholds
 */
export const EVOLUTION_THRESHOLDS = {
  /** Minimum confidence for evolution */
  MIN_CONFIDENCE: 0.8,
  /** Minimum usage count */
  MIN_USAGE_COUNT: 10,
  /** Minimum success rate */
  MIN_SUCCESS_RATE: 0.8,
  /** Minimum cluster size */
  MIN_CLUSTER_SIZE: 3,
  /** Similarity threshold */
  SIMILARITY_THRESHOLD: 0.7,
} as const;

/**
 * Matching configuration
 */
export const MATCHING_CONFIG = {
  /** Maximum results */
  MAX_RESULTS: 10,
  /** Minimum relevance score */
  MIN_RELEVANCE: 0.3,
  /** Boost recent usage */
  BOOST_RECENT: true,
  /** Boost high confidence */
  BOOST_HIGH_CONFIDENCE: true,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for InstinctStore
 */
export interface InstinctStoreOptions {
  /** Custom storage path */
  storagePath?: string;
  /** Optional filesystem adapter for testing/mocking */
  fileSystem?: IFileSystem;
  /** Custom confidence config */
  confidenceConfig?: Partial<{
    reinforceAmount: number;
    correctAmount: number;
    minConfidence: number;
    maxConfidence: number;
  }>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * InstinctStore Implementation
 *
 * Confidence-based pattern learning system with persistence.
 */
export class InstinctStore implements IInstinctStore {
  private instincts: Map<string, Instinct> = new Map();
  private storagePath: string;
  private indexPath: string;
  private readonly fileSystem: IFileSystem;
  private initialized: boolean = false;
  private confidenceConfig: {
    reinforceAmount: number;
    correctAmount: number;
    minConfidence: number;
    maxConfidence: number;
  };

  constructor(options?: InstinctStoreOptions) {
    this.storagePath = options?.storagePath ?? path.join(process.cwd(), 'docs/memory/instincts');
    this.indexPath = path.join(this.storagePath, INSTINCT_STORAGE_CONFIG.INDEX_FILE);
    this.fileSystem = options?.fileSystem ?? nodeFileSystem;
    this.confidenceConfig = {
      reinforceAmount: options?.confidenceConfig?.reinforceAmount ?? CONFIDENCE_ADJUSTMENTS.REINFORCE_INCREMENT,
      correctAmount: options?.confidenceConfig?.correctAmount ?? CONFIDENCE_ADJUSTMENTS.CORRECT_DECREMENT,
      minConfidence: options?.confidenceConfig?.minConfidence ?? CONFIDENCE_ADJUSTMENTS.MIN_CONFIDENCE,
      maxConfidence: options?.confidenceConfig?.maxConfidence ?? 0.95,
    };
  }

  /**
   * Initialize - load existing instincts from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.fileSystem.mkdir(this.storagePath, { recursive: true });
      const content = await this.fileSystem.readFile(this.indexPath, 'utf-8');
      const data = JSON.parse(content) as Instinct[];

      for (const instinct of data) {
        // Convert date strings back to Date objects
        instinct.createdAt = new Date(instinct.createdAt);
        instinct.updatedAt = new Date(instinct.updatedAt);
        if (instinct.lastUsedAt) {
          instinct.lastUsedAt = new Date(instinct.lastUsedAt);
        }
        this.instincts.set(instinct.id, instinct);
      }

      this.initialized = true;
    } catch (error) {
      // File doesn't exist - start with empty state
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.initialized = true;
        return;
      }
      // Re-throw other errors
      throw error;
    }
  }

  // ============================================================================
  // CRUD Operations
  // ============================================================================

  /**
   * Create new instinct
   */
  async create(input: InstinctCreateInput): Promise<Instinct> {
    // Determine initial confidence
    const initialConfidence = input.confidence ?? INITIAL_CONFIDENCE_BY_SOURCE[input.source] ?? CONFIDENCE_LEVELS.TENTATIVE;

    const instinct: Instinct = {
      ...input,
      id: randomUUID(),
      confidence: this.clampConfidence(initialConfidence),
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.instincts.set(instinct.id, instinct);
    await this.saveToFile();

    return instinct;
  }

  /**
   * Get instinct by ID
   */
  async get(id: string): Promise<Instinct | null> {
    return this.instincts.get(id) ?? null;
  }

  /**
   * Update instinct
   */
  async update(
    id: string,
    updates: Partial<Omit<Instinct, 'id' | 'createdAt'>>
  ): Promise<Instinct | null> {
    const existing = this.instincts.get(id);
    if (!existing) {
      return null;
    }

    const updated: Instinct = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    // Clamp confidence if updated
    if (updates.confidence !== undefined) {
      updated.confidence = this.clampConfidence(updates.confidence);
    }

    this.instincts.set(id, updated);
    await this.saveToFile();

    return updated;
  }

  /**
   * Delete instinct
   */
  async delete(id: string): Promise<boolean> {
    const existed = this.instincts.has(id);
    if (existed) {
      this.instincts.delete(id);
      await this.saveToFile();
    }
    return existed;
  }

  // ============================================================================
  // Search and Matching
  // ============================================================================

  /**
   * Find instincts matching context
   */
  async findMatching(context: string, domain?: InstinctDomain): Promise<Instinct[]> {
    const contextLower = context.toLowerCase();
    const allInstincts = Array.from(this.instincts.values());

    // Filter by domain if provided
    const filtered = domain ? allInstincts.filter((i) => i.domain === domain) : allInstincts;

    // Score and filter by relevance
    const scored = filtered
      .map((instinct) => {
        const triggerLower = instinct.trigger.toLowerCase();

        // Calculate relevance score
        let score = 0;

        // Check for keyword matches
        const triggerWords = triggerLower.split(/\s+/);
        const contextWords = contextLower.split(/\s+/);

        for (const triggerWord of triggerWords) {
          if (contextWords.some((cw) => cw.includes(triggerWord) || triggerWord.includes(cw))) {
            score += 0.3;
          }
        }

        // Check for direct containment
        if (contextLower.includes(triggerLower) || triggerLower.includes(contextLower)) {
          score += 0.5;
        }

        // Boost by confidence
        if (MATCHING_CONFIG.BOOST_HIGH_CONFIDENCE) {
          score += instinct.confidence * 0.2;
        }

        return { instinct, score };
      })
      .filter(({ score }) => score >= MATCHING_CONFIG.MIN_RELEVANCE)
      .sort((a, b) => {
        // Sort by confidence first, then by score
        if (b.instinct.confidence !== a.instinct.confidence) {
          return b.instinct.confidence - a.instinct.confidence;
        }
        return b.score - a.score;
      })
      .slice(0, MATCHING_CONFIG.MAX_RESULTS)
      .map(({ instinct }) => instinct);

    return scored;
  }

  /**
   * List instincts by filter
   */
  async list(filter?: InstinctFilter): Promise<Instinct[]> {
    const allInstincts = Array.from(this.instincts.values());

    if (!filter) {
      return allInstincts;
    }

    return this.applyFilter(allInstincts, filter);
  }

  // ============================================================================
  // Confidence Adjustment
  // ============================================================================

  /**
   * Reinforce instinct (increase confidence)
   */
  async reinforce(id: string): Promise<Instinct | null> {
    const instinct = this.instincts.get(id);
    if (!instinct) {
      return null;
    }

    const newConfidence = this.clampConfidence(instinct.confidence + this.confidenceConfig.reinforceAmount);
    return this.update(id, { confidence: newConfidence });
  }

  /**
   * Correct instinct (decrease confidence)
   */
  async correct(id: string): Promise<Instinct | null> {
    const instinct = this.instincts.get(id);
    if (!instinct) {
      return null;
    }

    const newConfidence = this.clampConfidence(instinct.confidence - this.confidenceConfig.correctAmount);
    return this.update(id, { confidence: newConfidence });
  }

  // ============================================================================
  // Usage Recording
  // ============================================================================

  /**
   * Record usage of instinct
   */
  async recordUsage(id: string, success: boolean): Promise<void> {
    const instinct = this.instincts.get(id);
    if (!instinct) {
      return;
    }

    const updates: Partial<Instinct> = {
      usageCount: instinct.usageCount + 1,
      lastUsedAt: new Date(),
    };

    if (success) {
      updates.successCount = instinct.successCount + 1;
    } else {
      updates.failureCount = instinct.failureCount + 1;
    }

    await this.update(id, updates);
  }

  // ============================================================================
  // Evolution Mechanism
  // ============================================================================

  /**
   * Identify and evolve high-performing instincts
   */
  async evolve(threshold?: number): Promise<InstinctEvolution[]> {
    const minConfidence = threshold ?? EVOLUTION_THRESHOLDS.MIN_CONFIDENCE;
    const allInstincts = Array.from(this.instincts.values());

    // Find evolution candidates
    const candidates = allInstincts.filter((instinct) => {
      const successRate = this.calculateSuccessRate(instinct);
      return (
        instinct.confidence >= minConfidence &&
        instinct.usageCount >= EVOLUTION_THRESHOLDS.MIN_USAGE_COUNT &&
        successRate >= EVOLUTION_THRESHOLDS.MIN_SUCCESS_RATE
      );
    });

    if (candidates.length === 0) {
      return [];
    }

    // Group by domain and find clusters
    const byDomain = new Map<InstinctDomain, Instinct[]>();
    for (const candidate of candidates) {
      const domain = candidate.domain;
      if (!byDomain.has(domain)) {
        byDomain.set(domain, []);
      }
      byDomain.get(domain)!.push(candidate);
    }

    const evolutions: InstinctEvolution[] = [];

    for (const [domain, domainInstincts] of byDomain) {
      if (domainInstincts.length >= EVOLUTION_THRESHOLDS.MIN_CLUSTER_SIZE) {
        // Extract common pattern
        const commonPattern = this.extractCommonPattern(domainInstincts);
        const avgConfidence =
          domainInstincts.reduce((sum, i) => sum + i.confidence, 0) / domainInstincts.length;

        evolutions.push({
          type: this.determineEvolutionType(domainInstincts),
          sourceInstincts: domainInstincts.map((i) => i.id),
          suggestedName: `${domain}-pattern`,
          suggestedDescription: `Evolved pattern from ${domainInstincts.length} ${domain} instincts`,
          confidence: avgConfidence,
          pattern: commonPattern,
          createdAt: new Date(),
        });
      }
    }

    return evolutions;
  }

  // ============================================================================
  // Export/Import
  // ============================================================================

  /**
   * Export instincts
   */
  async export(filter?: InstinctFilter): Promise<Instinct[]> {
    const allInstincts = Array.from(this.instincts.values());
    return filter ? this.applyFilter(allInstincts, filter) : allInstincts;
  }

  /**
   * Import instincts
   */
  async import(instincts: Instinct[]): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      merged: 0,
      errors: [],
    };

    for (const instinct of instincts) {
      try {
        const existing = this.instincts.get(instinct.id);

        if (existing) {
          // Merge: keep higher confidence, sum counts, merge evidence
          const merged = this.mergeInstincts(existing, instinct);
          this.instincts.set(instinct.id, merged);
          result.merged++;
        } else {
          this.instincts.set(instinct.id, instinct);
          result.imported++;
        }
      } catch (error) {
        result.errors.push(`Failed to import ${instinct.id}: ${error}`);
        result.skipped++;
      }
    }

    await this.saveToFile();
    return result;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get instinct statistics
   */
  async getStats(): Promise<InstinctStats> {
    const allInstincts = Array.from(this.instincts.values());

    const stats: InstinctStats = {
      total: allInstincts.length,
      byDomain: {},
      bySource: {},
      byConfidenceLevel: {},
      averageConfidence: 0,
      totalUsageCount: 0,
      successRate: 0,
      evolutionCandidates: 0,
    };

    let totalSuccess = 0;
    let totalFailure = 0;

    for (const instinct of allInstincts) {
      // By domain
      stats.byDomain[instinct.domain] = (stats.byDomain[instinct.domain] ?? 0) + 1;

      // By source
      stats.bySource[instinct.source] = (stats.bySource[instinct.source] ?? 0) + 1;

      // By confidence level
      const level = this.getConfidenceLevel(instinct.confidence);
      stats.byConfidenceLevel[level] = (stats.byConfidenceLevel[level] ?? 0) + 1;

      // Totals
      stats.averageConfidence += instinct.confidence;
      stats.totalUsageCount += instinct.usageCount;
      totalSuccess += instinct.successCount;
      totalFailure += instinct.failureCount;

      // Evolution candidates
      if (
        instinct.confidence >= EVOLUTION_THRESHOLDS.MIN_CONFIDENCE &&
        instinct.usageCount >= EVOLUTION_THRESHOLDS.MIN_USAGE_COUNT
      ) {
        stats.evolutionCandidates++;
      }
    }

    // Calculate averages
    if (allInstincts.length > 0) {
      stats.averageConfidence /= allInstincts.length;
    }

    if (totalSuccess + totalFailure > 0) {
      stats.successRate = totalSuccess / (totalSuccess + totalFailure);
    }

    return stats;
  }

  /**
   * Get confidence distribution
   */
  async getConfidenceDistribution(): Promise<Map<ConfidenceLevel, number>> {
    const allInstincts = Array.from(this.instincts.values());
    const distribution = new Map<ConfidenceLevel, number>();

    // Initialize all levels
    for (const level of ['TENTATIVE', 'MODERATE', 'STRONG', 'NEAR_CERTAIN'] as ConfidenceLevel[]) {
      distribution.set(level, 0);
    }

    for (const instinct of allInstincts) {
      const level = this.getConfidenceLevel(instinct.confidence);
      distribution.set(level, (distribution.get(level) ?? 0) + 1);
    }

    return distribution;
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Clamp confidence to valid range
   */
  private clampConfidence(value: number): number {
    return Math.max(this.confidenceConfig.minConfidence, Math.min(this.confidenceConfig.maxConfidence, value));
  }

  /**
   * Calculate success rate
   */
  private calculateSuccessRate(instinct: Instinct): number {
    const total = instinct.successCount + instinct.failureCount;
    return total > 0 ? instinct.successCount / total : 0;
  }

  /**
   * Get confidence level from value
   */
  private getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= CONFIDENCE_LEVELS.NEAR_CERTAIN) return 'NEAR_CERTAIN';
    if (confidence >= CONFIDENCE_LEVELS.STRONG) return 'STRONG';
    if (confidence >= CONFIDENCE_LEVELS.MODERATE) return 'MODERATE';
    return 'TENTATIVE';
  }

  /**
   * Apply filter to instincts
   */
  private applyFilter(instincts: Instinct[], filter: InstinctFilter): Instinct[] {
    return instincts.filter((i) => {
      if (filter.domain) {
        const domains = Array.isArray(filter.domain) ? filter.domain : [filter.domain];
        if (!domains.includes(i.domain)) return false;
      }

      if (filter.source) {
        const sources = Array.isArray(filter.source) ? filter.source : [filter.source];
        if (!sources.includes(i.source)) return false;
      }

      if (filter.minConfidence !== undefined && i.confidence < filter.minConfidence) {
        return false;
      }

      if (filter.maxConfidence !== undefined && i.confidence > filter.maxConfidence) {
        return false;
      }

      if (filter.minUsageCount !== undefined && i.usageCount < filter.minUsageCount) {
        return false;
      }

      if (filter.createdAfter && i.createdAt < filter.createdAfter) {
        return false;
      }

      if (filter.createdBefore && i.createdAt > filter.createdBefore) {
        return false;
      }

      if (filter.searchText) {
        const text = filter.searchText.toLowerCase();
        const searchable = `${i.trigger} ${i.action}`.toLowerCase();
        if (!searchable.includes(text)) return false;
      }

      if (filter.tags && filter.tags.length > 0) {
        const instinctTags = i.metadata?.tags ?? [];
        if (!filter.tags.some((t) => instinctTags.includes(t))) return false;
      }

      return true;
    });
  }

  /**
   * Merge two instincts (for import)
   */
  private mergeInstincts(existing: Instinct, incoming: Instinct): Instinct {
    return {
      ...existing,
      confidence: Math.max(existing.confidence, incoming.confidence),
      usageCount: existing.usageCount + incoming.usageCount,
      successCount: existing.successCount + incoming.successCount,
      failureCount: existing.failureCount + incoming.failureCount,
      evidence: [...new Set([...existing.evidence, ...incoming.evidence])],
      updatedAt: new Date(),
      metadata: {
        ...existing.metadata,
        ...incoming.metadata,
        tags: [...new Set([...(existing.metadata?.tags ?? []), ...(incoming.metadata?.tags ?? [])])],
      },
    };
  }

  /**
   * Extract common pattern from instincts
   */
  private extractCommonPattern(instincts: Instinct[]): string {
    // Simple pattern extraction - find common words in triggers
    const wordCounts = new Map<string, number>();

    for (const instinct of instincts) {
      const words = instinct.trigger.toLowerCase().split(/\s+/);
      for (const word of words) {
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      }
    }

    // Find words that appear in majority
    const threshold = instincts.length / 2;
    const commonWords = Array.from(wordCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([word]) => word);

    return commonWords.join(' ') || instincts[0].trigger;
  }

  /**
   * Determine evolution type based on instinct characteristics
   */
  private determineEvolutionType(instincts: Instinct[]): 'skill' | 'command' | 'agent' {
    // Simple heuristic: more instincts = higher evolution
    if (instincts.length >= 10) return 'agent';
    if (instincts.length >= 5) return 'command';
    return 'skill';
  }

  /**
   * Save all instincts to file
   */
  private async saveToFile(): Promise<void> {
    await this.fileSystem.mkdir(this.storagePath, { recursive: true });
    const data = Array.from(this.instincts.values());
    await this.fileSystem.writeFile(this.indexPath, JSON.stringify(data, null, 2));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Factory function to create and initialize an InstinctStore instance
 *
 * @example
 * ```typescript
 * // Create with default options
 * const store = await createInstinctStore();
 *
 * // Create with custom storage path
 * const store = await createInstinctStore({
 *   storagePath: '/custom/path/instincts',
 * });
 *
 * // Create an instinct
 * const instinct = await store.create({
 *   trigger: 'when writing new functions',
 *   action: 'use functional patterns',
 *   domain: 'code-style',
 *   source: 'session-observation',
 *   evidence: ['observed in auth.ts'],
 * });
 * ```
 */
export async function createInstinctStore(options?: InstinctStoreOptions): Promise<InstinctStore> {
  const store = new InstinctStore(options);
  await store.initialize();
  return store;
}

// ============================================================================
// Barrel Export
// ============================================================================

export default InstinctStore;
