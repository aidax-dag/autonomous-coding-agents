/**
 * In-Memory Rate Limit Store
 *
 * Feature: F4.5 - Rate Limiting
 *
 * Provides an in-memory storage backend for rate limiting data.
 * Suitable for single-instance deployments.
 *
 * Uses an O(1) LRU eviction strategy with a doubly-linked list.
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
 * Node in the LRU doubly-linked list
 * Used for O(1) LRU eviction
 */
interface LRUNode {
  key: string;
  prev: LRUNode | null;
  next: LRUNode | null;
}

/**
 * In-memory rate limit store implementation
 * Uses O(1) LRU eviction with doubly-linked list
 */
export class MemoryRateLimitStore implements IRateLimitStore {
  private readonly entries: Map<string, RateLimitEntry>;
  private readonly nodeMap: Map<string, LRUNode>; // O(1) access to LRU nodes
  private readonly config: Required<MemoryStoreConfig>;
  private cleanupTimer: NodeJS.Timeout | null = null;

  // LRU doubly-linked list head and tail
  private lruHead: LRUNode | null = null;
  private lruTail: LRUNode | null = null;

  constructor(config?: MemoryStoreConfig) {
    this.config = { ...DEFAULT_MEMORY_STORE_CONFIG, ...config };
    this.entries = new Map();
    this.nodeMap = new Map();

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
    this.removeFromLRU(key);
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
    this.nodeMap.clear();
    this.lruHead = null;
    this.lruTail = null;
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
    this.nodeMap.clear();
    this.lruHead = null;
    this.lruTail = null;
  }

  /**
   * Update access order for LRU tracking - O(1) operation
   * Moves the key to the most recently used position (tail)
   */
  private updateAccessOrder(key: string): void {
    let node = this.nodeMap.get(key);

    if (node) {
      // Node exists, move it to tail (most recently used)
      this.moveToTail(node);
    } else {
      // Create new node and add to tail
      node = { key, prev: null, next: null };
      this.nodeMap.set(key, node);
      this.addToTail(node);
    }
  }

  /**
   * Remove a key from the LRU list - O(1) operation
   */
  private removeFromLRU(key: string): void {
    const node = this.nodeMap.get(key);
    if (!node) return;

    // Update neighbors
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Node was head
      this.lruHead = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // Node was tail
      this.lruTail = node.prev;
    }

    this.nodeMap.delete(key);
  }

  /**
   * Add a node to the tail (most recently used) - O(1) operation
   */
  private addToTail(node: LRUNode): void {
    node.prev = this.lruTail;
    node.next = null;

    if (this.lruTail) {
      this.lruTail.next = node;
    } else {
      // List was empty
      this.lruHead = node;
    }

    this.lruTail = node;
  }

  /**
   * Move a node to the tail (most recently used) - O(1) operation
   */
  private moveToTail(node: LRUNode): void {
    if (node === this.lruTail) {
      // Already at tail
      return;
    }

    // Remove from current position
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Node was head
      this.lruHead = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    }

    // Add to tail
    node.prev = this.lruTail;
    node.next = null;

    if (this.lruTail) {
      this.lruTail.next = node;
    }

    this.lruTail = node;
  }

  /**
   * Evict least recently used entry - O(1) operation
   */
  private evictLRU(): void {
    if (!this.lruHead) {
      return;
    }

    const keyToEvict = this.lruHead.key;
    this.removeFromLRU(keyToEvict);
    this.entries.delete(keyToEvict);
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
      this.removeFromLRU(key);
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
