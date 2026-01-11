/**
 * In-Memory Rate Limit Store
 *
 * Feature: F4.5 - Rate Limiting
 *
 * Provides an in-memory storage backend for rate limiting data.
 * Suitable for single-instance deployments.
 *
 * @module api/ratelimit/stores/memory
 */

import {
  IRateLimitStore,
  RateLimitEntry,
} from '../interfaces/ratelimit.interface.js';

/**
 * Memory store configuration
 */
export interface MemoryStoreConfig {
  /** Maximum entries to store (LRU eviction) */
  maxEntries?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval?: number;
  /** Enable automatic cleanup of expired entries */
  autoCleanup?: boolean;
}

/**
 * Default memory store configuration
 */
const DEFAULT_MEMORY_STORE_CONFIG: Required<MemoryStoreConfig> = {
  maxEntries: 10000,
  cleanupInterval: 60000, // 1 minute
  autoCleanup: true,
};

/**
 * In-memory rate limit store implementation
 */
export class MemoryRateLimitStore implements IRateLimitStore {
  private readonly entries: Map<string, RateLimitEntry>;
  private readonly accessOrder: Map<string, number>; // For LRU eviction
  private readonly config: Required<MemoryStoreConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private accessCounter = 0;

  constructor(config?: MemoryStoreConfig) {
    this.config = { ...DEFAULT_MEMORY_STORE_CONFIG, ...config };
    this.entries = new Map();
    this.accessOrder = new Map();

    if (this.config.autoCleanup) {
      this.startCleanup();
    }
  }

  /**
   * Get entry by key
   */
  async get(key: string): Promise<RateLimitEntry | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);

    // Check if entry has expired
    if (this.isExpired(entry)) {
      await this.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Set entry with optional TTL
   */
  async set(key: string, entry: RateLimitEntry, _ttl?: number): Promise<void> {
    // Check if we need to evict entries
    if (this.entries.size >= this.config.maxEntries && !this.entries.has(key)) {
      this.evictLRU();
    }

    this.entries.set(key, entry);
    this.updateAccessOrder(key);
  }

  /**
   * Delete entry
   */
  async delete(key: string): Promise<boolean> {
    this.accessOrder.delete(key);
    return this.entries.delete(key);
  }

  /**
   * Increment counter atomically
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    const entry = this.entries.get(key);
    if (!entry) {
      return amount;
    }

    entry.count += amount;
    entry.lastRequest = Date.now();
    this.entries.set(key, entry);
    this.updateAccessOrder(key);

    return entry.count;
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const entry = this.entries.get(key);
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.entries.keys());

    if (!pattern) {
      return allKeys;
    }

    // Simple glob pattern matching (*, ?)
    const regex = this.patternToRegex(pattern);
    return allKeys.filter((key) => regex.test(key));
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    this.entries.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  /**
   * Get store size
   */
  async size(): Promise<number> {
    return this.entries.size;
  }

  /**
   * Get all entries (for debugging/stats)
   */
  getAll(): Map<string, RateLimitEntry> {
    return new Map(this.entries);
  }

  /**
   * Destroy the store and cleanup
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.entries.clear();
    this.accessOrder.clear();
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    this.accessCounter++;
    this.accessOrder.set(key, this.accessCounter);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, access] of this.accessOrder.entries()) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: RateLimitEntry): boolean {
    const now = Date.now();

    // Check window expiry
    if (entry.windowEnd && entry.windowEnd < now) {
      return true;
    }

    // Check block expiry
    if (entry.blocked && entry.blockExpiry && entry.blockExpiry < now) {
      return true;
    }

    return false;
  }

  /**
   * Start automatic cleanup
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);

    // Don't keep process alive just for cleanup
    this.cleanupTimer.unref();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.entries.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.entries.delete(key);
      this.accessOrder.delete(key);
    }
  }

  /**
   * Convert glob pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
}

/**
 * Factory function to create memory store
 */
export function createMemoryStore(config?: MemoryStoreConfig): IRateLimitStore {
  return new MemoryRateLimitStore(config);
}
