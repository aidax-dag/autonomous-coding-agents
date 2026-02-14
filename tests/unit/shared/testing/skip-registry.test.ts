/**
 * Skip Registry Tests
 *
 * Covers:
 * - Registration and listing of skip entries
 * - Size tracking
 * - Expiry detection with targetDate
 * - Category filtering
 * - Reason-based search
 * - File-based filtering
 * - Ticket presence/absence filtering
 * - Clear functionality
 * - JSON serialization
 * - Factory function
 */

import {
  SkipRegistry,
  createSkipRegistry,
  SkipEntry,
  SkipCategory,
} from '../../../../src/shared/testing/skip-registry';

// ============================================================================
// Test Helpers
// ============================================================================

function makeEntry(overrides: Partial<SkipEntry> = {}): SkipEntry {
  return {
    testFile: 'tests/unit/example.test.ts',
    testName: 'should do something',
    reason: 'Not yet implemented',
    addedDate: '2025-01-15',
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SkipRegistry', () => {
  let registry: SkipRegistry;

  beforeEach(() => {
    registry = createSkipRegistry();
  });

  // --------------------------------------------------------------------------
  // Registration and Listing
  // --------------------------------------------------------------------------

  describe('register and list', () => {
    it('should start with an empty list', () => {
      expect(registry.list()).toEqual([]);
      expect(registry.size()).toBe(0);
    });

    it('should register a single entry and return it via list', () => {
      const entry = makeEntry();
      registry.register(entry);

      const items = registry.list();
      expect(items).toHaveLength(1);
      expect(items[0]).toEqual(entry);
    });

    it('should register multiple entries in insertion order', () => {
      const entry1 = makeEntry({ testName: 'first test' });
      const entry2 = makeEntry({ testName: 'second test' });
      const entry3 = makeEntry({ testName: 'third test' });

      registry.register(entry1);
      registry.register(entry2);
      registry.register(entry3);

      const items = registry.list();
      expect(items).toHaveLength(3);
      expect(items[0].testName).toBe('first test');
      expect(items[1].testName).toBe('second test');
      expect(items[2].testName).toBe('third test');
    });

    it('should return a defensive copy from list', () => {
      const entry = makeEntry();
      registry.register(entry);

      const items = registry.list();
      items.pop();
      expect(registry.list()).toHaveLength(1);
    });

    it('should track size correctly after multiple registrations', () => {
      expect(registry.size()).toBe(0);

      registry.register(makeEntry({ testName: 'a' }));
      expect(registry.size()).toBe(1);

      registry.register(makeEntry({ testName: 'b' }));
      registry.register(makeEntry({ testName: 'c' }));
      expect(registry.size()).toBe(3);
    });
  });

  // --------------------------------------------------------------------------
  // Expiry Detection
  // --------------------------------------------------------------------------

  describe('getExpired', () => {
    it('should return empty array when no entries have targetDate', () => {
      registry.register(makeEntry());
      registry.register(makeEntry({ testName: 'another' }));

      expect(registry.getExpired()).toEqual([]);
    });

    it('should return entries whose targetDate is in the past', () => {
      const pastEntry = makeEntry({
        testName: 'expired skip',
        targetDate: '2024-01-01',
      });
      const futureEntry = makeEntry({
        testName: 'future skip',
        targetDate: '2099-12-31',
      });
      const noDateEntry = makeEntry({ testName: 'no date' });

      registry.register(pastEntry);
      registry.register(futureEntry);
      registry.register(noDateEntry);

      const expired = registry.getExpired();
      expect(expired).toHaveLength(1);
      expect(expired[0].testName).toBe('expired skip');
    });

    it('should accept a custom reference date for expiry check', () => {
      const entry = makeEntry({
        testName: 'conditional expiry',
        targetDate: '2025-06-15',
      });
      registry.register(entry);

      const beforeTarget = new Date('2025-06-14');
      expect(registry.getExpired(beforeTarget)).toHaveLength(0);

      const afterTarget = new Date('2025-06-16');
      expect(registry.getExpired(afterTarget)).toHaveLength(1);
    });

    it('should not consider entries without targetDate as expired', () => {
      registry.register(makeEntry({ targetDate: undefined }));
      expect(registry.getExpired(new Date('2099-12-31'))).toEqual([]);
    });

    it('should return multiple expired entries when several are past due', () => {
      registry.register(makeEntry({ testName: 'old1', targetDate: '2023-01-01' }));
      registry.register(makeEntry({ testName: 'old2', targetDate: '2024-06-01' }));
      registry.register(makeEntry({ testName: 'future', targetDate: '2099-01-01' }));

      const expired = registry.getExpired(new Date('2025-01-01'));
      expect(expired).toHaveLength(2);
    });
  });

  // --------------------------------------------------------------------------
  // Category Filtering
  // --------------------------------------------------------------------------

  describe('getByCategory', () => {
    it('should return entries matching the given category', () => {
      registry.register(makeEntry({ testName: 'flaky1', category: 'flaky' }));
      registry.register(makeEntry({ testName: 'env1', category: 'environment' }));
      registry.register(makeEntry({ testName: 'flaky2', category: 'flaky' }));

      const flaky = registry.getByCategory('flaky');
      expect(flaky).toHaveLength(2);
      expect(flaky[0].testName).toBe('flaky1');
      expect(flaky[1].testName).toBe('flaky2');
    });

    it('should return empty array when no entries match the category', () => {
      registry.register(makeEntry({ category: 'flaky' }));
      expect(registry.getByCategory('blocked')).toEqual([]);
    });

    it('should handle entries without a category', () => {
      registry.register(makeEntry({ category: undefined }));
      registry.register(makeEntry({ testName: 'blocked', category: 'blocked' }));

      expect(registry.getByCategory('blocked')).toHaveLength(1);
    });

    it('should support all valid category values', () => {
      const categories: SkipCategory[] = [
        'not-implemented',
        'flaky',
        'environment',
        'blocked',
        'deprecated',
      ];

      for (const cat of categories) {
        registry.register(makeEntry({ testName: `test-${cat}`, category: cat }));
      }

      for (const cat of categories) {
        const results = registry.getByCategory(cat);
        expect(results).toHaveLength(1);
        expect(results[0].testName).toBe(`test-${cat}`);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Reason-Based Search
  // --------------------------------------------------------------------------

  describe('getByReason', () => {
    it('should find entries by reason substring (case-insensitive)', () => {
      registry.register(makeEntry({ reason: 'Flaky in CI environment' }));
      registry.register(makeEntry({ reason: 'Not yet implemented' }));
      registry.register(makeEntry({ reason: 'Blocked by upstream API' }));

      const results = registry.getByReason('flaky');
      expect(results).toHaveLength(1);
      expect(results[0].reason).toBe('Flaky in CI environment');
    });

    it('should return multiple matches for broad reason queries', () => {
      registry.register(makeEntry({ reason: 'API not ready' }));
      registry.register(makeEntry({ reason: 'Upstream API blocked' }));
      registry.register(makeEntry({ reason: 'Something else' }));

      const results = registry.getByReason('api');
      expect(results).toHaveLength(2);
    });

    it('should return empty array when no reasons match', () => {
      registry.register(makeEntry({ reason: 'Flaky test' }));
      expect(registry.getByReason('nonexistent')).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // File-Based Filtering
  // --------------------------------------------------------------------------

  describe('getByFile', () => {
    it('should return entries for a specific test file', () => {
      registry.register(makeEntry({ testFile: 'tests/a.test.ts', testName: 'a1' }));
      registry.register(makeEntry({ testFile: 'tests/b.test.ts', testName: 'b1' }));
      registry.register(makeEntry({ testFile: 'tests/a.test.ts', testName: 'a2' }));

      const results = registry.getByFile('tests/a.test.ts');
      expect(results).toHaveLength(2);
      expect(results[0].testName).toBe('a1');
      expect(results[1].testName).toBe('a2');
    });

    it('should return empty array for unknown file', () => {
      registry.register(makeEntry({ testFile: 'tests/a.test.ts' }));
      expect(registry.getByFile('tests/unknown.test.ts')).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // Ticket Filtering
  // --------------------------------------------------------------------------

  describe('getWithTickets and getWithoutTickets', () => {
    it('should separate entries with and without tickets', () => {
      registry.register(makeEntry({ testName: 'tracked', ticket: 'JIRA-123' }));
      registry.register(makeEntry({ testName: 'untracked', ticket: undefined }));
      registry.register(makeEntry({ testName: 'empty', ticket: '' }));
      registry.register(makeEntry({ testName: 'also tracked', ticket: 'GH-456' }));

      const withTickets = registry.getWithTickets();
      expect(withTickets).toHaveLength(2);
      expect(withTickets[0].testName).toBe('tracked');
      expect(withTickets[1].testName).toBe('also tracked');

      const withoutTickets = registry.getWithoutTickets();
      expect(withoutTickets).toHaveLength(2);
      expect(withoutTickets[0].testName).toBe('untracked');
      expect(withoutTickets[1].testName).toBe('empty');
    });
  });

  // --------------------------------------------------------------------------
  // Clear
  // --------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove all entries from the registry', () => {
      registry.register(makeEntry({ testName: 'a' }));
      registry.register(makeEntry({ testName: 'b' }));
      expect(registry.size()).toBe(2);

      registry.clear();
      expect(registry.size()).toBe(0);
      expect(registry.list()).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // JSON Serialization
  // --------------------------------------------------------------------------

  describe('toJSON', () => {
    it('should serialize empty registry', () => {
      const json = registry.toJSON();

      expect(json.entries).toEqual([]);
      expect(json.count).toBe(0);
      expect(json.timestamp).toBeDefined();
      expect(() => new Date(json.timestamp)).not.toThrow();
    });

    it('should serialize all registered entries', () => {
      const entry1 = makeEntry({ testName: 'serialized1' });
      const entry2 = makeEntry({ testName: 'serialized2', ticket: 'JIRA-789' });

      registry.register(entry1);
      registry.register(entry2);

      const json = registry.toJSON();
      expect(json.count).toBe(2);
      expect(json.entries).toHaveLength(2);
      expect(json.entries[0].testName).toBe('serialized1');
      expect(json.entries[1].ticket).toBe('JIRA-789');
    });

    it('should include a valid ISO timestamp', () => {
      const before = new Date().toISOString();
      const json = registry.toJSON();
      const after = new Date().toISOString();

      expect(json.timestamp >= before).toBe(true);
      expect(json.timestamp <= after).toBe(true);
    });

    it('should return a defensive copy of entries', () => {
      registry.register(makeEntry({ testName: 'original' }));

      const json = registry.toJSON();
      json.entries.pop();

      expect(registry.list()).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // Factory Function
  // --------------------------------------------------------------------------

  describe('createSkipRegistry', () => {
    it('should return a SkipRegistry instance', () => {
      const instance = createSkipRegistry();
      expect(instance).toBeInstanceOf(SkipRegistry);
    });

    it('should return independent instances', () => {
      const reg1 = createSkipRegistry();
      const reg2 = createSkipRegistry();

      reg1.register(makeEntry({ testName: 'only in reg1' }));

      expect(reg1.size()).toBe(1);
      expect(reg2.size()).toBe(0);
    });
  });
});
