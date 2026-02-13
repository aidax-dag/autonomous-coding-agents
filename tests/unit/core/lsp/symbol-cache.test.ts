/**
 * Symbol Cache Tests
 */

import { SymbolCache, createSymbolCache } from '../../../../src/core/lsp/symbol-cache';

describe('SymbolCache', () => {
  let cache: SymbolCache;

  beforeEach(() => {
    cache = new SymbolCache({ ttlMs: 1000, maxEntries: 5 });
  });

  // ==========================================================================
  // get / set
  // ==========================================================================

  describe('get/set', () => {
    it('stores and retrieves data', () => {
      cache.set('key1', { name: 'test' });
      expect(cache.get('key1')).toEqual({ name: 'test' });
    });

    it('returns null for missing keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('stores different types', () => {
      cache.set('string', 'hello');
      cache.set('number', 42);
      cache.set('array', [1, 2, 3]);

      expect(cache.get<string>('string')).toBe('hello');
      expect(cache.get<number>('number')).toBe(42);
      expect(cache.get<number[]>('array')).toEqual([1, 2, 3]);
    });

    it('overwrites existing entries', () => {
      cache.set('key1', 'first');
      cache.set('key1', 'second');

      expect(cache.get('key1')).toBe('second');
    });
  });

  // ==========================================================================
  // TTL expiry
  // ==========================================================================

  describe('TTL expiry', () => {
    it('returns null after TTL expires', () => {
      const shortCache = new SymbolCache({ ttlMs: 50 });

      shortCache.set('key1', 'value');
      expect(shortCache.get('key1')).toBe('value');

      // Manipulate timestamp to simulate expiry
      jest.useFakeTimers();
      shortCache.set('key2', 'value2');

      jest.advanceTimersByTime(100);

      expect(shortCache.get('key2')).toBeNull();

      jest.useRealTimers();
    });

    it('returns data before TTL expires', () => {
      jest.useFakeTimers();

      const ttlCache = new SymbolCache({ ttlMs: 500 });
      ttlCache.set('key1', 'value');

      jest.advanceTimersByTime(200);
      expect(ttlCache.get('key1')).toBe('value');

      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // invalidate (URI prefix)
  // ==========================================================================

  describe('invalidate', () => {
    it('removes all entries matching URI prefix', () => {
      cache.set('file:///src/a.ts:symbols', 'a');
      cache.set('file:///src/a.ts:references', 'b');
      cache.set('file:///src/b.ts:symbols', 'c');

      cache.invalidate('file:///src/a.ts');

      expect(cache.get('file:///src/a.ts:symbols')).toBeNull();
      expect(cache.get('file:///src/a.ts:references')).toBeNull();
      expect(cache.get('file:///src/b.ts:symbols')).toBe('c');
    });

    it('handles no matching entries gracefully', () => {
      cache.set('key1', 'value');
      cache.invalidate('nonexistent');

      expect(cache.get('key1')).toBe('value');
    });
  });

  // ==========================================================================
  // invalidateAll
  // ==========================================================================

  describe('invalidateAll', () => {
    it('clears entire cache', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.invalidateAll();

      expect(cache.size()).toBe(0);
      expect(cache.get('a')).toBeNull();
    });
  });

  // ==========================================================================
  // maxEntries / LRU eviction
  // ==========================================================================

  describe('maxEntries', () => {
    it('evicts oldest entries when exceeding capacity', () => {
      // maxEntries = 5
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);
      cache.set('e', 5);

      // This should evict 'a' (oldest)
      cache.set('f', 6);

      expect(cache.size()).toBe(5);
      expect(cache.get('a')).toBeNull(); // evicted
      expect(cache.get('f')).toBe(6);
    });

    it('refreshes existing keys on re-set (LRU)', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4);
      cache.set('e', 5);

      // Re-set 'a' moves it to newest position
      cache.set('a', 10);

      // Add new entry — should evict 'b' (now oldest)
      cache.set('f', 6);

      expect(cache.get('a')).toBe(10); // refreshed, not evicted
      expect(cache.get('b')).toBeNull(); // evicted
      expect(cache.get('f')).toBe(6);
    });
  });

  // ==========================================================================
  // stats
  // ==========================================================================

  describe('stats', () => {
    it('tracks hits and misses', () => {
      cache.set('key1', 'value');

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('missing'); // miss

      const stats = cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('starts with zero stats', () => {
      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  // ==========================================================================
  // size
  // ==========================================================================

  describe('size', () => {
    it('returns 0 for empty cache', () => {
      expect(cache.size()).toBe(0);
    });

    it('returns correct count', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.size()).toBe(2);
    });
  });

  // ==========================================================================
  // Factory function
  // ==========================================================================

  describe('createSymbolCache', () => {
    it('creates with default config', () => {
      const defaultCache = createSymbolCache();
      expect(defaultCache).toBeInstanceOf(SymbolCache);
    });

    it('creates with custom config', () => {
      const customCache = createSymbolCache({ ttlMs: 5000, maxEntries: 500 });
      expect(customCache).toBeInstanceOf(SymbolCache);
    });
  });
});
