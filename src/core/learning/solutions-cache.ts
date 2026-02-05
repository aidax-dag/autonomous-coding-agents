/**
 * F006-SolutionsCache: Fast Solution Lookup System
 *
 * Provides O(1) lookup for learned solutions with:
 * - LRU-based memory cache
 * - Exact and fuzzy signature matching
 * - JSONL persistence
 * - Event-based monitoring
 *
 * @module core/learning/solutions-cache
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ISolutionsCache,
  CachedSolution,
  CacheLookupResult,
  CacheStats,
  CacheConfig,
  CacheEvent,
  CacheEventHandler,
  CacheEventData,
  LearnedSolution,
} from './interfaces/learning.interface.js';
import { generateErrorSignature } from './index.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default cache configuration
 */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxSize: 1000,
  ttlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  persistPath: 'docs/memory/solutions_learned.jsonl',
  autoSaveInterval: 5 * 60 * 1000, // 5 minutes
  enableFuzzyMatching: true,
  fuzzyThreshold: 0.8,
};

/**
 * LRU cache configuration
 */
export const LRU_CONFIG = {
  maxSize: 500,
  updateAgeOnGet: true,
  dispose: 'lru',
} as const;

/**
 * Fuzzy matching configuration
 */
export const FUZZY_MATCHING_CONFIG = {
  algorithm: 'levenshtein',
  maxDistance: 0.3,
  weightBySuccessRate: true,
  maxAlternatives: 5,
} as const;

/**
 * Pruning configuration
 */
export const PRUNING_CONFIG = {
  minHits: 1,
  minSuccessRate: 0.3,
  maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
  keepTopN: 100,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Options for SolutionsCache constructor
 */
export interface SolutionsCacheOptions extends Partial<CacheConfig> {}

// ============================================================================
// Implementation
// ============================================================================

/**
 * SolutionsCache
 *
 * Fast lookup cache for learned solutions with fuzzy matching support.
 */
export class SolutionsCache implements ISolutionsCache {
  private cache: Map<string, CachedSolution> = new Map();
  private config: CacheConfig;
  private eventHandlers: Map<CacheEvent, Set<CacheEventHandler>> = new Map();

  // Statistics
  private totalHits: number = 0;
  private totalMisses: number = 0;

  // Auto-save timer
  private autoSaveTimer?: ReturnType<typeof setInterval>;

  constructor(options?: SolutionsCacheOptions) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...options };

    // Initialize event handlers
    const events: CacheEvent[] = ['hit', 'miss', 'evict', 'persist', 'load'];
    for (const event of events) {
      this.eventHandlers.set(event, new Set());
    }

    // Setup auto-save if enabled
    if (this.config.autoSaveInterval > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.persist().catch(console.error);
      }, this.config.autoSaveInterval);
    }
  }

  // ============================================================================
  // Lookup Operations
  // ============================================================================

  /**
   * Get solution by signature
   */
  async get(signature: string): Promise<CacheLookupResult> {
    // 1. Try exact match
    const exact = this.cache.get(signature);
    if (exact) {
      this.totalHits++;
      exact.hits++;
      exact.lastAccessedAt = new Date();
      this.emit('hit', { signature });

      return {
        found: true,
        solution: exact,
        similarity: 1.0,
      };
    }

    // 2. Try fuzzy matching if enabled
    if (this.config.enableFuzzyMatching) {
      const alternatives = await this.findSimilar(signature, FUZZY_MATCHING_CONFIG.maxAlternatives);

      if (alternatives.length > 0) {
        const best = alternatives[0];
        const similarity = this.calculateSimilarity(signature, best.signature);

        if (similarity >= this.config.fuzzyThreshold) {
          this.totalHits++;
          best.hits++;
          best.lastAccessedAt = new Date();
          this.emit('hit', { signature, details: { fuzzy: true, similarity } });

          return {
            found: true,
            solution: best,
            similarity,
            alternatives: alternatives.slice(1),
          };
        }

        // Return alternatives even if below threshold
        this.totalMisses++;
        this.emit('miss', { signature });

        return {
          found: false,
          alternatives,
        };
      }
    }

    // 3. Cache miss
    this.totalMisses++;
    this.emit('miss', { signature });

    return {
      found: false,
    };
  }

  /**
   * Get solution by Error object
   */
  async getByError(error: Error): Promise<CacheLookupResult> {
    const signature = generateErrorSignature(error);
    return this.get(signature);
  }

  /**
   * Find similar solutions
   */
  async findSimilar(signature: string, limit: number = 5): Promise<CachedSolution[]> {
    const allSolutions = Array.from(this.cache.values());

    // Calculate similarity scores
    const scored = allSolutions.map((solution) => ({
      solution,
      similarity: this.calculateSimilarity(signature, solution.signature),
    }));

    // Sort by similarity (descending) and apply limit
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter((s) => s.similarity > 0.3) // Minimum similarity threshold
      .map((s) => s.solution);
  }

  // ============================================================================
  // Storage Operations
  // ============================================================================

  /**
   * Store a solution in cache
   */
  async set(solution: CachedSolution): Promise<void> {
    // Enforce max size (simple LRU by removing oldest accessed)
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(solution.signature, {
      ...solution,
      lastAccessedAt: new Date(),
    });
  }

  /**
   * Store a solution from LearnedSolution
   */
  async setFromLearned(learned: LearnedSolution): Promise<void> {
    const cached: CachedSolution = {
      signature: learned.errorSignature,
      solution: learned.solution,
      rootCause: learned.rootCause,
      prevention: learned.prevention,
      errorType: learned.errorType,
      errorMessagePattern: this.normalizeErrorMessage(learned.errorMessage),
      hits: 0,
      successCount: learned.successCount,
      failureCount: learned.failureCount,
      createdAt: learned.createdAt,
      lastAccessedAt: new Date(),
      metadata: {
        source: 'learned',
        confidence: this.calculateConfidence(learned.successCount, learned.failureCount),
      },
    };

    await this.set(cached);
  }

  // ============================================================================
  // Feedback Operations
  // ============================================================================

  /**
   * Record successful solution application
   */
  async recordSuccess(signature: string): Promise<void> {
    const solution = this.cache.get(signature);
    if (solution) {
      solution.successCount++;
      solution.lastAccessedAt = new Date();
    }
  }

  /**
   * Record failed solution application
   */
  async recordFailure(signature: string): Promise<void> {
    const solution = this.cache.get(signature);
    if (solution) {
      solution.failureCount++;
      solution.lastAccessedAt = new Date();
    }
  }

  // ============================================================================
  // Management Operations
  // ============================================================================

  /**
   * Delete a solution from cache
   */
  async delete(signature: string): Promise<boolean> {
    return this.cache.delete(signature);
  }

  /**
   * Clear all entries from cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
  }

  /**
   * Prune old or low-performing entries
   */
  async prune(): Promise<number> {
    const now = Date.now();
    const toRemove: string[] = [];

    // Get top solutions to protect
    const topSolutions = await this.getTopSolutions(PRUNING_CONFIG.keepTopN);
    const protectedSignatures = new Set(topSolutions.map((s) => s.signature));

    for (const [signature, solution] of this.cache.entries()) {
      // Skip protected solutions
      if (protectedSignatures.has(signature)) continue;

      // Check age
      const age = now - solution.createdAt.getTime();
      if (age > PRUNING_CONFIG.maxAge) {
        toRemove.push(signature);
        continue;
      }

      // Check success rate
      const total = solution.successCount + solution.failureCount;
      if (total > 0) {
        const successRate = solution.successCount / total;
        if (successRate < PRUNING_CONFIG.minSuccessRate && solution.hits < PRUNING_CONFIG.minHits) {
          toRemove.push(signature);
        }
      }
    }

    // Remove marked entries
    for (const signature of toRemove) {
      this.cache.delete(signature);
      this.emit('evict', { signature });
    }

    return toRemove.length;
  }

  // ============================================================================
  // Persistence Operations
  // ============================================================================

  /**
   * Persist cache to storage
   */
  async persist(): Promise<void> {
    const dir = path.dirname(this.config.persistPath);
    await fs.mkdir(dir, { recursive: true });

    const solutions = Array.from(this.cache.values());
    const lines = solutions.map((s) =>
      JSON.stringify({
        ...s,
        createdAt: s.createdAt.toISOString(),
        lastAccessedAt: s.lastAccessedAt.toISOString(),
      })
    );

    await fs.writeFile(this.config.persistPath, lines.join('\n'), 'utf-8');
    this.emit('persist', { details: { count: solutions.length } });
  }

  /**
   * Load cache from storage
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.config.persistPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const parsed = JSON.parse(line);
        const solution: CachedSolution = {
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          lastAccessedAt: new Date(parsed.lastAccessedAt),
        };
        this.cache.set(solution.signature, solution);
      }

      this.emit('load', { details: { count: lines.length } });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist - start with empty cache
        return;
      }
      throw error;
    }
  }

  // ============================================================================
  // Statistics Operations
  // ============================================================================

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const entries = Array.from(this.cache.values());
    const total = this.totalHits + this.totalMisses;

    let totalSuccess = 0;
    let totalFailure = 0;
    let oldestEntry: Date | null = null;
    let newestEntry: Date | null = null;

    for (const entry of entries) {
      totalSuccess += entry.successCount;
      totalFailure += entry.failureCount;

      if (!oldestEntry || entry.createdAt < oldestEntry) {
        oldestEntry = entry.createdAt;
      }
      if (!newestEntry || entry.createdAt > newestEntry) {
        newestEntry = entry.createdAt;
      }
    }

    return {
      totalEntries: entries.length,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: total > 0 ? this.totalHits / total : 0,
      avgSuccessRate: totalSuccess + totalFailure > 0 ? totalSuccess / (totalSuccess + totalFailure) : 0,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Get top performing solutions
   */
  async getTopSolutions(limit: number = 10): Promise<CachedSolution[]> {
    const entries = Array.from(this.cache.values());

    // Score = hits * success_rate
    const scored = entries.map((entry) => {
      const total = entry.successCount + entry.failureCount;
      const successRate = total > 0 ? entry.successCount / total : 0.5;
      return {
        entry,
        score: entry.hits * successRate,
      };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  // ============================================================================
  // Event Operations
  // ============================================================================

  /**
   * Register event handler
   */
  on(event: CacheEvent, handler: CacheEventHandler): void {
    this.eventHandlers.get(event)?.add(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: CacheEvent, handler: CacheEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Dispose resources
   */
  async dispose(): Promise<void> {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
    }

    await this.persist();
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  /**
   * Emit event to handlers
   */
  private emit(event: CacheEvent, data?: Partial<CacheEventData>): void {
    const eventData: CacheEventData = {
      event,
      timestamp: new Date(),
      ...data,
    };

    for (const handler of this.eventHandlers.get(event) ?? []) {
      try {
        handler(eventData);
      } catch (error) {
        console.error(`Cache event handler error for ${event}:`, error);
      }
    }
  }

  /**
   * Evict oldest accessed entry
   */
  private evictOldest(): void {
    let oldest: { signature: string; time: number } | null = null;

    for (const [signature, solution] of this.cache.entries()) {
      const time = solution.lastAccessedAt.getTime();
      if (!oldest || time < oldest.time) {
        oldest = { signature, time };
      }
    }

    if (oldest) {
      const solution = this.cache.get(oldest.signature);
      this.cache.delete(oldest.signature);
      this.emit('evict', {
        signature: oldest.signature,
        details: { hits: solution?.hits },
      });
    }
  }

  /**
   * Calculate Levenshtein similarity between two strings
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (a.length === 0 || b.length === 0) return 0.0;

    // Levenshtein distance
    const matrix: number[][] = [];

    for (let i = 0; i <= a.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    const distance = matrix[a.length][b.length];
    const maxLength = Math.max(a.length, b.length);

    return 1 - distance / maxLength;
  }

  /**
   * Normalize error message for pattern matching
   */
  private normalizeErrorMessage(message: string): string {
    return message
      .replace(/\d+/g, 'N') // Numbers → N
      .replace(/['"][^'"]+['"]/g, 'STR') // Strings → STR
      .replace(/\/[^\s]+/g, 'PATH') // Paths → PATH
      .replace(/0x[0-9a-f]+/gi, 'HEX') // Hex → HEX
      .slice(0, 200);
  }

  /**
   * Calculate confidence from success/failure counts
   */
  private calculateConfidence(successCount: number, failureCount: number): number {
    const total = successCount + failureCount;
    if (total === 0) return 0.5;
    return successCount / total;
  }

  /**
   * Estimate memory usage in bytes
   */
  private estimateMemoryUsage(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += JSON.stringify(entry).length * 2; // UTF-16
    }
    return size;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create and initialize a SolutionsCache instance
 *
 * @example
 * ```typescript
 * const cache = await createSolutionsCache();
 *
 * // Look up solution
 * const result = await cache.getByError(error);
 * if (result.found) {
 *   console.log('Solution:', result.solution.solution);
 * }
 * ```
 */
export async function createSolutionsCache(options?: SolutionsCacheOptions): Promise<SolutionsCache> {
  const cache = new SolutionsCache(options);
  await cache.load();
  return cache;
}

// ============================================================================
// Default Export
// ============================================================================

export default SolutionsCache;
