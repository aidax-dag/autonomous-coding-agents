/**
 * SolutionsCache Tests
 *
 * Tests for the F006-SolutionsCache implementation.
 * Uses TDD RED-GREEN pattern.
 */

import * as fs from 'fs/promises';
import {
  SolutionsCache,
  createSolutionsCache,
  DEFAULT_CACHE_CONFIG,
  LRU_CONFIG,
  FUZZY_MATCHING_CONFIG,
  PRUNING_CONFIG,
} from '../../../../src/core/learning/solutions-cache.js';
import type {
  CachedSolution,
  CacheEventData,
  LearnedSolution,
} from '../../../../src/core/learning/interfaces/learning.interface.js';

describe('SolutionsCache', () => {
  let cache: SolutionsCache;
  const testFilePath = '/tmp/test-solutions-cache.jsonl';

  beforeEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch {
      // File may not exist
    }

    cache = new SolutionsCache({
      persistPath: testFilePath,
      autoSaveInterval: 0, // Disable auto-save for tests
    });
  });

  afterEach(async () => {
    await cache.dispose();
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch {
      // File may not exist
    }
  });

  // Helper to create a test solution
  function createTestSolution(overrides: Partial<CachedSolution> = {}): CachedSolution {
    return {
      signature: 'TypeError:cannot_read_property_of_undefined',
      solution: 'Add null check before accessing property',
      rootCause: 'Object is undefined when trying to access property',
      prevention: ['Add null/undefined checks', 'Use optional chaining'],
      errorType: 'TypeError',
      errorMessagePattern: "cannot read property 'x' of undefined",
      hits: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      ...overrides,
    };
  }

  describe('get/set operations', () => {
    it('should store and retrieve solution by signature', async () => {
      const solution = createTestSolution();

      await cache.set(solution);
      const result = await cache.get(solution.signature);

      expect(result.found).toBe(true);
      expect(result.solution?.signature).toBe(solution.signature);
      expect(result.solution?.solution).toBe(solution.solution);
    });

    it('should return not found for unknown signature', async () => {
      const result = await cache.get('unknown_signature');

      expect(result.found).toBe(false);
      expect(result.solution).toBeUndefined();
    });

    it('should increment hits on successful lookup', async () => {
      const solution = createTestSolution({ hits: 0 });

      await cache.set(solution);
      await cache.get(solution.signature);
      await cache.get(solution.signature);

      const result = await cache.get(solution.signature);

      expect(result.solution?.hits).toBe(3);
    });

    it('should update lastAccessedAt on lookup', async () => {
      const oldDate = new Date('2020-01-01');
      const solution = createTestSolution({ lastAccessedAt: oldDate });

      await cache.set(solution);

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await cache.get(solution.signature);

      expect(result.solution?.lastAccessedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });
  });

  describe('getByError', () => {
    it('should lookup solution by Error object', async () => {
      const solution = createTestSolution({
        signature: 'TypeError:undefined_is_not_a_function',
      });

      await cache.set(solution);

      const error = new TypeError('undefined is not a function');
      const result = await cache.getByError(error);

      expect(result.found).toBe(true);
    });

    it('should normalize error message for lookup', async () => {
      const solution = createTestSolution({
        signature: 'Error:failed_to_load_resource_at_PATH',
      });

      await cache.set(solution);

      const error = new Error('failed to load resource at /some/path/file.js');
      const result = await cache.getByError(error);

      expect(result.found).toBe(true);
    });
  });

  describe('fuzzy matching', () => {
    it('should find similar solutions when exact match not found', async () => {
      const solution = createTestSolution({
        signature: 'TypeError:cannot_read_property_x_of_undefined',
      });

      await cache.set(solution);

      // Enable fuzzy matching
      cache = new SolutionsCache({
        persistPath: testFilePath,
        autoSaveInterval: 0,
        enableFuzzyMatching: true,
        fuzzyThreshold: 0.7,
      });
      await cache.set(solution);

      const result = await cache.get('TypeError:cannot_read_property_y_of_undefined');

      expect(result.found).toBe(true);
      expect(result.similarity).toBeGreaterThan(0.7);
    });

    it('should return alternatives when no exact match', async () => {
      const solution1 = createTestSolution({
        signature: 'TypeError:cannot_read_property_x_of_undefined',
      });
      const solution2 = createTestSolution({
        signature: 'TypeError:cannot_read_property_y_of_undefined',
      });

      await cache.set(solution1);
      await cache.set(solution2);

      const result = await cache.get('TypeError:cannot_read_property_z_of_undefined');

      // Either found via fuzzy or has alternatives
      expect(result.found || (result.alternatives && result.alternatives.length > 0)).toBe(true);
    });

    it('should respect fuzzy threshold', async () => {
      const solution = createTestSolution({
        signature: 'TypeError:completely_different_error',
      });

      cache = new SolutionsCache({
        persistPath: testFilePath,
        autoSaveInterval: 0,
        enableFuzzyMatching: true,
        fuzzyThreshold: 0.9, // High threshold
      });
      await cache.set(solution);

      const result = await cache.get('ReferenceError:totally_unrelated');

      expect(result.found).toBe(false);
    });
  });

  describe('findSimilar', () => {
    it('should find similar solutions', async () => {
      await cache.set(
        createTestSolution({
          signature: 'TypeError:cannot_read_property_a_of_undefined',
        })
      );
      await cache.set(
        createTestSolution({
          signature: 'TypeError:cannot_read_property_b_of_undefined',
        })
      );
      await cache.set(
        createTestSolution({
          signature: 'ReferenceError:x_is_not_defined',
        })
      );

      const similar = await cache.findSimilar('TypeError:cannot_read_property_c_of_undefined', 5);

      expect(similar.length).toBeGreaterThanOrEqual(2);
      expect(similar[0].signature).toContain('TypeError');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await cache.set(
          createTestSolution({
            signature: `TypeError:error_${i}`,
          })
        );
      }

      const similar = await cache.findSimilar('TypeError:error_x', 3);

      expect(similar.length).toBeLessThanOrEqual(3);
    });
  });

  describe('setFromLearned', () => {
    it('should convert LearnedSolution to CachedSolution', async () => {
      const learned: LearnedSolution = {
        id: 'test-id',
        errorType: 'TypeError',
        errorMessage: 'undefined is not a function',
        errorSignature: 'TypeError:undefined_is_not_a_function',
        rootCause: 'Function reference is undefined',
        solution: 'Check if function exists',
        prevention: ['Add null check'],
        createdAt: new Date(),
        successCount: 5,
        failureCount: 1,
      };

      await cache.setFromLearned(learned);

      const result = await cache.get(learned.errorSignature);

      expect(result.found).toBe(true);
      expect(result.solution?.solution).toBe(learned.solution);
      expect(result.solution?.rootCause).toBe(learned.rootCause);
      expect(result.solution?.successCount).toBe(learned.successCount);
      expect(result.solution?.metadata?.source).toBe('learned');
    });
  });

  describe('recording success/failure', () => {
    it('should increment successCount', async () => {
      const solution = createTestSolution({ successCount: 0 });

      await cache.set(solution);
      await cache.recordSuccess(solution.signature);
      await cache.recordSuccess(solution.signature);

      const result = await cache.get(solution.signature);

      expect(result.solution?.successCount).toBe(2);
    });

    it('should increment failureCount', async () => {
      const solution = createTestSolution({ failureCount: 0 });

      await cache.set(solution);
      await cache.recordFailure(solution.signature);

      const result = await cache.get(solution.signature);

      expect(result.solution?.failureCount).toBe(1);
    });

    it('should update lastAccessedAt on record', async () => {
      const oldDate = new Date('2020-01-01');
      const solution = createTestSolution({ lastAccessedAt: oldDate });

      await cache.set(solution);
      await cache.recordSuccess(solution.signature);

      const result = await cache.get(solution.signature);

      expect(result.solution?.lastAccessedAt.getTime()).toBeGreaterThan(oldDate.getTime());
    });

    it('should silently ignore unknown signature', async () => {
      // Should not throw
      await expect(cache.recordSuccess('unknown')).resolves.not.toThrow();
      await expect(cache.recordFailure('unknown')).resolves.not.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete existing solution', async () => {
      const solution = createTestSolution();

      await cache.set(solution);
      const deleted = await cache.delete(solution.signature);

      expect(deleted).toBe(true);

      const result = await cache.get(solution.signature);
      expect(result.found).toBe(false);
    });

    it('should return false for non-existent signature', async () => {
      const deleted = await cache.delete('non_existent');

      expect(deleted).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', async () => {
      await cache.set(createTestSolution({ signature: 'sig1' }));
      await cache.set(createTestSolution({ signature: 'sig2' }));
      await cache.set(createTestSolution({ signature: 'sig3' }));

      await cache.clear();

      const stats = await cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it('should reset statistics', async () => {
      await cache.set(createTestSolution());
      await cache.get('test'); // miss
      await cache.get('test'); // miss

      await cache.clear();

      const stats = await cache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });
  });

  describe('prune', () => {
    it('should remove old entries beyond TTL', async () => {
      // Add many good solutions first (to fill keepTopN)
      for (let i = 0; i < 101; i++) {
        await cache.set(
          createTestSolution({
            signature: `good_solution_${i}`,
            createdAt: new Date(),
            hits: 100,
            successCount: 90,
            failureCount: 10,
          })
        );
      }

      // Add old, low-performing solution
      const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const solution = createTestSolution({
        signature: 'old_solution',
        createdAt: oldDate,
        hits: 0,
        successCount: 0,
        failureCount: 1, // Low success rate
      });

      await cache.set(solution);

      const pruned = await cache.prune();

      // Old + low performing solutions should be pruned
      expect(pruned).toBeGreaterThanOrEqual(1);

      // Verify old solution is gone
      const result = await cache.get('old_solution');
      expect(result.found).toBe(false);
    });

    it('should keep top performing solutions', async () => {
      // Create high-performing solution
      const goodSolution = createTestSolution({
        signature: 'good_solution',
        hits: 100,
        successCount: 90,
        failureCount: 10,
      });

      // Create low-performing solution
      const badSolution = createTestSolution({
        signature: 'bad_solution',
        hits: 1,
        successCount: 0,
        failureCount: 5,
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      });

      await cache.set(goodSolution);
      await cache.set(badSolution);

      await cache.prune();

      const goodResult = await cache.get('good_solution');
      expect(goodResult.found).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should persist data to file', async () => {
      const solution = createTestSolution({ signature: 'persist_test' });

      await cache.set(solution);
      await cache.persist();

      // Check file exists
      const fileExists = await fs
        .access(testFilePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should load data from file', async () => {
      const solution = createTestSolution({
        signature: 'load_test',
        hits: 5,
        successCount: 3,
      });

      await cache.set(solution);
      await cache.persist();

      // Create new cache instance
      const newCache = new SolutionsCache({
        persistPath: testFilePath,
        autoSaveInterval: 0,
      });

      await newCache.load();

      const result = await newCache.get('load_test');

      expect(result.found).toBe(true);
      // hits is 6 because get() increments it (5 persisted + 1 from get call)
      expect(result.solution?.hits).toBe(6);
      expect(result.solution?.successCount).toBe(3);

      await newCache.dispose();
    });

    it('should restore Date objects from storage', async () => {
      const solution = createTestSolution({
        signature: 'date_test',
        createdAt: new Date('2024-01-15'),
        lastAccessedAt: new Date('2024-06-20'),
      });

      await cache.set(solution);
      await cache.persist();

      const newCache = new SolutionsCache({
        persistPath: testFilePath,
        autoSaveInterval: 0,
      });

      await newCache.load();

      const result = await newCache.get('date_test');

      expect(result.solution?.createdAt).toBeInstanceOf(Date);
      expect(result.solution?.lastAccessedAt).toBeInstanceOf(Date);

      await newCache.dispose();
    });

    it('should handle missing file gracefully', async () => {
      const newCache = new SolutionsCache({
        persistPath: '/tmp/non_existent_file.jsonl',
        autoSaveInterval: 0,
      });

      await expect(newCache.load()).resolves.not.toThrow();

      await newCache.dispose();
    });
  });

  describe('getStats', () => {
    it('should return correct total entries', async () => {
      await cache.set(createTestSolution({ signature: 'sig1' }));
      await cache.set(createTestSolution({ signature: 'sig2' }));

      const stats = await cache.getStats();

      expect(stats.totalEntries).toBe(2);
    });

    it('should track hits and misses', async () => {
      await cache.set(createTestSolution({ signature: 'known' }));

      await cache.get('known'); // hit
      await cache.get('known'); // hit
      await cache.get('unknown'); // miss

      const stats = await cache.getStats();

      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
    });

    it('should calculate hit rate correctly', async () => {
      await cache.set(createTestSolution({ signature: 'known' }));

      await cache.get('known'); // hit
      await cache.get('known'); // hit
      await cache.get('unknown'); // miss

      const stats = await cache.getStats();

      expect(stats.hitRate).toBeCloseTo(0.67, 1);
    });

    it('should calculate average success rate', async () => {
      await cache.set(
        createTestSolution({
          signature: 'sig1',
          successCount: 8,
          failureCount: 2,
        })
      );
      await cache.set(
        createTestSolution({
          signature: 'sig2',
          successCount: 6,
          failureCount: 4,
        })
      );

      const stats = await cache.getStats();

      // (8+6) / (8+2+6+4) = 14/20 = 0.7
      expect(stats.avgSuccessRate).toBeCloseTo(0.7, 1);
    });

    it('should track oldest and newest entries', async () => {
      const old = new Date('2020-01-01');
      const recent = new Date('2024-06-01');

      await cache.set(createTestSolution({ signature: 'old', createdAt: old }));
      await cache.set(createTestSolution({ signature: 'new', createdAt: recent }));

      const stats = await cache.getStats();

      expect(stats.oldestEntry?.getTime()).toBe(old.getTime());
      expect(stats.newestEntry?.getTime()).toBe(recent.getTime());
    });

    it('should estimate memory usage', async () => {
      await cache.set(createTestSolution());

      const stats = await cache.getStats();

      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('getTopSolutions', () => {
    it('should return top solutions by score', async () => {
      await cache.set(
        createTestSolution({
          signature: 'low',
          hits: 1,
          successCount: 0,
          failureCount: 1,
        })
      );
      await cache.set(
        createTestSolution({
          signature: 'high',
          hits: 100,
          successCount: 90,
          failureCount: 10,
        })
      );
      await cache.set(
        createTestSolution({
          signature: 'medium',
          hits: 50,
          successCount: 40,
          failureCount: 10,
        })
      );

      const top = await cache.getTopSolutions(3);

      expect(top[0].signature).toBe('high');
      expect(top.length).toBe(3);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await cache.set(
          createTestSolution({
            signature: `sig_${i}`,
            hits: i,
          })
        );
      }

      const top = await cache.getTopSolutions(5);

      expect(top.length).toBe(5);
    });
  });

  describe('events', () => {
    it('should emit hit event', async () => {
      const events: CacheEventData[] = [];
      cache.on('hit', (data: CacheEventData) => events.push(data));

      await cache.set(createTestSolution({ signature: 'test' }));
      await cache.get('test');

      expect(events.length).toBe(1);
      expect(events[0].event).toBe('hit');
      expect(events[0].signature).toBe('test');
    });

    it('should emit miss event', async () => {
      const events: CacheEventData[] = [];
      cache.on('miss', (data: CacheEventData) => events.push(data));

      await cache.get('non_existent');

      expect(events.length).toBe(1);
      expect(events[0].event).toBe('miss');
    });

    it('should emit persist event', async () => {
      const events: CacheEventData[] = [];
      cache.on('persist', (data: CacheEventData) => events.push(data));

      await cache.set(createTestSolution());
      await cache.persist();

      expect(events.length).toBe(1);
      expect(events[0].event).toBe('persist');
    });

    it('should emit load event', async () => {
      const events: CacheEventData[] = [];
      cache.on('load', (data: CacheEventData) => events.push(data));

      await cache.set(createTestSolution());
      await cache.persist();
      await cache.load();

      expect(events.length).toBe(1);
      expect(events[0].event).toBe('load');
    });

    it('should allow unregistering event handler', async () => {
      const events: CacheEventData[] = [];
      const handler = (data: CacheEventData) => events.push(data);

      cache.on('miss', handler);
      await cache.get('test1');

      cache.off('miss', handler);
      await cache.get('test2');

      expect(events.length).toBe(1);
    });
  });

  describe('dispose', () => {
    it('should persist before disposing', async () => {
      await cache.set(createTestSolution({ signature: 'dispose_test' }));

      await cache.dispose();

      // Create new cache and verify data persisted
      const newCache = new SolutionsCache({
        persistPath: testFilePath,
        autoSaveInterval: 0,
      });

      await newCache.load();

      const result = await newCache.get('dispose_test');
      expect(result.found).toBe(true);

      await newCache.dispose();
    });
  });

  describe('createSolutionsCache factory', () => {
    it('should create and return initialized cache', async () => {
      const factoryCache = await createSolutionsCache({
        persistPath: testFilePath,
        autoSaveInterval: 0,
      });

      expect(factoryCache).toBeInstanceOf(SolutionsCache);

      await factoryCache.dispose();
    });

    it('should load existing data', async () => {
      // Setup: create cache with data
      await cache.set(createTestSolution({ signature: 'factory_test' }));
      await cache.persist();

      // Create via factory
      const factoryCache = await createSolutionsCache({
        persistPath: testFilePath,
        autoSaveInterval: 0,
      });

      const result = await factoryCache.get('factory_test');
      expect(result.found).toBe(true);

      await factoryCache.dispose();
    });
  });

  describe('constants export', () => {
    it('should export DEFAULT_CACHE_CONFIG', () => {
      expect(DEFAULT_CACHE_CONFIG).toBeDefined();
      expect(DEFAULT_CACHE_CONFIG.maxSize).toBe(1000);
      expect(DEFAULT_CACHE_CONFIG.enableFuzzyMatching).toBe(true);
    });

    it('should export LRU_CONFIG', () => {
      expect(LRU_CONFIG).toBeDefined();
      expect(LRU_CONFIG.maxSize).toBe(500);
    });

    it('should export FUZZY_MATCHING_CONFIG', () => {
      expect(FUZZY_MATCHING_CONFIG).toBeDefined();
      expect(FUZZY_MATCHING_CONFIG.algorithm).toBe('levenshtein');
    });

    it('should export PRUNING_CONFIG', () => {
      expect(PRUNING_CONFIG).toBeDefined();
      expect(PRUNING_CONFIG.keepTopN).toBe(100);
    });
  });
});
