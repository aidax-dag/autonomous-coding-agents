/**
 * Symbol Cache
 *
 * URI-based symbol cache with configurable TTL and LRU eviction.
 * Provides fast lookup for recently resolved symbols while
 * automatically expiring stale entries.
 *
 * @module core/lsp
 */

// ============================================================================
// Types
// ============================================================================

export interface SymbolCacheConfig {
  /** Time-to-live in milliseconds (default: 60000 = 1 minute) */
  ttlMs?: number;
  /** Maximum number of cache entries (default: 1000) */
  maxEntries?: number;
}

export interface CachedEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class SymbolCache {
  private readonly cache: Map<string, CachedEntry<unknown>> = new Map();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(config?: SymbolCacheConfig) {
    this.ttlMs = config?.ttlMs ?? 60_000;
    this.maxEntries = config?.maxEntries ?? 1000;
  }

  /**
   * Retrieve a cached value by key.
   * Returns null if the key is missing or the entry has expired.
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL expiry
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.data as T;
  }

  /**
   * Store a value in the cache.
   * Evicts the oldest entry if the cache exceeds maxEntries (LRU).
   */
  set<T>(key: string, data: T): void {
    // Remove existing entry to refresh insertion order for LRU
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Invalidate all cache entries whose key starts with the given URI prefix.
   */
  invalidate(uri: string): void {
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(uri)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Return the number of entries in the cache.
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Return cache hit/miss statistics.
   */
  stats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSymbolCache(config?: SymbolCacheConfig): SymbolCache {
  return new SymbolCache(config);
}
