/**
 * Memory Rate Limit Store Unit Tests
 *
 * Feature: F4.5 - Rate Limiting
 *
 * @module tests/unit/api/ratelimit/stores/memory.store
 */

import {
  MemoryRateLimitStore,
  createMemoryStore,
} from '../../../../../src/api/ratelimit/stores/memory.store';
import { RateLimitEntry } from '../../../../../src/api/ratelimit/interfaces/ratelimit.interface';

describe('MemoryRateLimitStore', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore({ autoCleanup: false });
  });

  afterEach(() => {
    store.destroy();
  });

  describe('constructor', () => {
    it('should create store with default config', () => {
      const defaultStore = new MemoryRateLimitStore();
      expect(defaultStore).toBeInstanceOf(MemoryRateLimitStore);
      defaultStore.destroy();
    });

    it('should create store with custom config', () => {
      const customStore = new MemoryRateLimitStore({
        maxEntries: 100,
        cleanupInterval: 30000,
        autoCleanup: false,
      });
      expect(customStore).toBeInstanceOf(MemoryRateLimitStore);
      customStore.destroy();
    });
  });

  describe('set and get', () => {
    it('should store and retrieve an entry', async () => {
      const entry: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now(),
        windowEnd: Date.now() + 60000,
        lastRequest: Date.now(),
      };

      await store.set('test-key', entry);
      const retrieved = await store.get('test-key');

      expect(retrieved).toEqual(entry);
    });

    it('should return null for non-existent key', async () => {
      const result = await store.get('non-existent');
      expect(result).toBeNull();
    });

    it('should update existing entry', async () => {
      const entry1: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now(),
        windowEnd: Date.now() + 60000,
        lastRequest: Date.now(),
      };

      const entry2: RateLimitEntry = {
        ...entry1,
        count: 10,
      };

      await store.set('test-key', entry1);
      await store.set('test-key', entry2);
      const retrieved = await store.get('test-key');

      expect(retrieved?.count).toBe(10);
    });

    it('should return null for expired entries', async () => {
      const entry: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now() - 120000,
        windowEnd: Date.now() - 60000, // Already expired
        lastRequest: Date.now() - 60000,
      };

      await store.set('test-key', entry);
      const retrieved = await store.get('test-key');

      expect(retrieved).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete an existing entry', async () => {
      const entry: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now(),
        windowEnd: Date.now() + 60000,
        lastRequest: Date.now(),
      };

      await store.set('test-key', entry);
      const deleted = await store.delete('test-key');

      expect(deleted).toBe(true);
      expect(await store.get('test-key')).toBeNull();
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('increment', () => {
    it('should increment count for existing entry', async () => {
      const entry: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now(),
        windowEnd: Date.now() + 60000,
        lastRequest: Date.now(),
      };

      await store.set('test-key', entry);
      const newCount = await store.increment('test-key', 3);

      expect(newCount).toBe(8);
    });

    it('should return amount when key does not exist', async () => {
      const newCount = await store.increment('non-existent', 5);
      expect(newCount).toBe(5);
    });

    it('should default to increment by 1', async () => {
      const entry: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now(),
        windowEnd: Date.now() + 60000,
        lastRequest: Date.now(),
      };

      await store.set('test-key', entry);
      const newCount = await store.increment('test-key');

      expect(newCount).toBe(6);
    });
  });

  describe('exists', () => {
    it('should return true for existing key', async () => {
      const entry: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now(),
        windowEnd: Date.now() + 60000,
        lastRequest: Date.now(),
      };

      await store.set('test-key', entry);
      expect(await store.exists('test-key')).toBe(true);
    });

    it('should return false for non-existent key', async () => {
      expect(await store.exists('non-existent')).toBe(false);
    });

    it('should return false for expired key', async () => {
      const entry: RateLimitEntry = {
        key: 'test-key',
        count: 5,
        windowStart: Date.now() - 120000,
        windowEnd: Date.now() - 60000,
        lastRequest: Date.now() - 60000,
      };

      await store.set('test-key', entry);
      expect(await store.exists('test-key')).toBe(false);
    });
  });

  describe('keys', () => {
    it('should return all keys', async () => {
      await store.set('key1', createEntry('key1'));
      await store.set('key2', createEntry('key2'));
      await store.set('key3', createEntry('key3'));

      const keys = await store.keys();
      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    it('should filter keys by pattern', async () => {
      await store.set('ip:192.168.1.1', createEntry('ip:192.168.1.1'));
      await store.set('ip:192.168.1.2', createEntry('ip:192.168.1.2'));
      await store.set('user:123', createEntry('user:123'));

      const ipKeys = await store.keys('ip:*');
      expect(ipKeys).toHaveLength(2);
      expect(ipKeys).toContain('ip:192.168.1.1');
      expect(ipKeys).toContain('ip:192.168.1.2');
    });

    it('should return empty array when no keys match', async () => {
      await store.set('key1', createEntry('key1'));
      const keys = await store.keys('nomatch*');
      expect(keys).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await store.set('key1', createEntry('key1'));
      await store.set('key2', createEntry('key2'));
      await store.set('key3', createEntry('key3'));

      await store.clear();

      expect(await store.size()).toBe(0);
      expect(await store.get('key1')).toBeNull();
    });
  });

  describe('size', () => {
    it('should return correct size', async () => {
      expect(await store.size()).toBe(0);

      await store.set('key1', createEntry('key1'));
      expect(await store.size()).toBe(1);

      await store.set('key2', createEntry('key2'));
      expect(await store.size()).toBe(2);

      await store.delete('key1');
      expect(await store.size()).toBe(1);
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when max exceeded', async () => {
      const smallStore = new MemoryRateLimitStore({
        maxEntries: 3,
        autoCleanup: false,
      });

      await smallStore.set('key1', createEntry('key1'));
      await smallStore.set('key2', createEntry('key2'));
      await smallStore.set('key3', createEntry('key3'));

      // Access key1 and key2 to make them more recently used
      await smallStore.get('key1');
      await smallStore.get('key2');

      // Add key4, should evict key3 (least recently used)
      await smallStore.set('key4', createEntry('key4'));

      expect(await smallStore.size()).toBe(3);
      expect(await smallStore.get('key3')).toBeNull();
      expect(await smallStore.get('key1')).not.toBeNull();
      expect(await smallStore.get('key2')).not.toBeNull();
      expect(await smallStore.get('key4')).not.toBeNull();

      smallStore.destroy();
    });
  });

  describe('getAll', () => {
    it('should return all entries as a map', async () => {
      await store.set('key1', createEntry('key1'));
      await store.set('key2', createEntry('key2'));

      const all = store.getAll();
      expect(all.size).toBe(2);
      expect(all.has('key1')).toBe(true);
      expect(all.has('key2')).toBe(true);
    });
  });

  describe('createMemoryStore factory', () => {
    it('should create a memory store', () => {
      const createdStore = createMemoryStore();
      expect(createdStore).toBeDefined();
      (createdStore as MemoryRateLimitStore).destroy();
    });
  });
});

// Helper function to create test entries
function createEntry(key: string): RateLimitEntry {
  return {
    key,
    count: 1,
    windowStart: Date.now(),
    windowEnd: Date.now() + 60000,
    lastRequest: Date.now(),
  };
}
