/**
 * F005-InstinctStore Unit Tests
 *
 * Tests for confidence-based pattern learning system
 * TDD RED phase: Tests written before implementation
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  InstinctStore,
  createInstinctStore,
  INSTINCT_STORAGE_CONFIG,
  INITIAL_CONFIDENCE_BY_SOURCE,
  EVOLUTION_THRESHOLDS,
} from '@/core/learning/instinct-store.js';
import {
  type Instinct,
  CONFIDENCE_ADJUSTMENTS,
} from '@/core/learning/interfaces/learning.interface.js';

describe('InstinctStore', () => {
  let store: InstinctStore;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `instinct-test-${randomUUID()}`);
    await fs.mkdir(testDir, { recursive: true });
    store = new InstinctStore({ storagePath: testDir });
    await store.initialize();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  // ============================================================================
  // CRUD Operations Tests
  // ============================================================================

  describe('create', () => {
    it('should create instinct with generated id and timestamps', async () => {
      const instinct = await store.create({
        trigger: 'when writing new functions',
        action: 'use functional patterns',
        confidence: 0.5,
        domain: 'code-style',
        source: 'session-observation',
        evidence: ['observed in auth.ts'],
      });

      expect(instinct.id).toBeDefined();
      expect(instinct.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(instinct.createdAt).toBeInstanceOf(Date);
      expect(instinct.updatedAt).toBeInstanceOf(Date);
      expect(instinct.usageCount).toBe(0);
      expect(instinct.successCount).toBe(0);
      expect(instinct.failureCount).toBe(0);
    });

    it('should use initial confidence based on source when not provided', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test action',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      expect(instinct.confidence).toBe(INITIAL_CONFIDENCE_BY_SOURCE['session-observation']);
    });

    it('should respect explicit confidence value', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test action',
        confidence: 0.7,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      expect(instinct.confidence).toBe(0.7);
    });

    it('should clamp confidence to valid range', async () => {
      const instinctTooLow = await store.create({
        trigger: 'test low',
        action: 'test',
        confidence: 0.05,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      const instinctTooHigh = await store.create({
        trigger: 'test high',
        action: 'test',
        confidence: 0.99,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      expect(instinctTooLow.confidence).toBe(CONFIDENCE_ADJUSTMENTS.MIN_CONFIDENCE);
      expect(instinctTooHigh.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe('get', () => {
    it('should retrieve instinct by id', async () => {
      const created = await store.create({
        trigger: 'test trigger',
        action: 'test action',
        domain: 'code-style',
        source: 'user-correction',
        evidence: ['test evidence'],
      });

      const retrieved = await store.get(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.trigger).toBe('test trigger');
      expect(retrieved!.action).toBe('test action');
    });

    it('should return null for non-existent id', async () => {
      const result = await store.get('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update instinct fields', async () => {
      const instinct = await store.create({
        trigger: 'original trigger',
        action: 'original action',
        confidence: 0.5,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      const updated = await store.update(instinct.id, {
        trigger: 'updated trigger',
        confidence: 0.7,
      });

      expect(updated).not.toBeNull();
      expect(updated!.trigger).toBe('updated trigger');
      expect(updated!.confidence).toBe(0.7);
      expect(updated!.action).toBe('original action'); // unchanged
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(instinct.updatedAt.getTime());
    });

    it('should return null for non-existent id', async () => {
      const result = await store.update('non-existent', { trigger: 'new' });
      expect(result).toBeNull();
    });

    it('should clamp updated confidence to valid range', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.5,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      const updated = await store.update(instinct.id, { confidence: 1.5 });

      expect(updated!.confidence).toBeLessThanOrEqual(0.95);
    });
  });

  describe('delete', () => {
    it('should delete existing instinct', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      const deleted = await store.delete(instinct.id);
      const retrieved = await store.get(instinct.id);

      expect(deleted).toBe(true);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent id', async () => {
      const result = await store.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // Search and Matching Tests
  // ============================================================================

  describe('findMatching', () => {
    it('should find instincts matching context', async () => {
      await store.create({
        trigger: 'when writing new functions',
        action: 'use functional patterns',
        confidence: 0.7,
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      await store.create({
        trigger: 'when handling errors',
        action: 'use try-catch blocks',
        confidence: 0.6,
        domain: 'code-style',
        source: 'session-observation',
        evidence: [],
      });

      const matches = await store.findMatching('I am writing a new function');

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].trigger).toContain('function');
    });

    it('should filter by domain when provided', async () => {
      await store.create({
        trigger: 'writing tests',
        action: 'use descriptive names',
        confidence: 0.7,
        domain: 'testing',
        source: 'user-correction',
        evidence: [],
      });

      await store.create({
        trigger: 'writing functions',
        action: 'use functional patterns',
        confidence: 0.7,
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      const matches = await store.findMatching('writing something new', 'testing');

      expect(matches.every((m: Instinct) => m.domain === 'testing')).toBe(true);
    });

    it('should sort by confidence (highest first)', async () => {
      await store.create({
        trigger: 'coding patterns',
        action: 'action 1',
        confidence: 0.5,
        domain: 'code-style',
        source: 'session-observation',
        evidence: [],
      });

      await store.create({
        trigger: 'coding patterns',
        action: 'action 2',
        confidence: 0.8,
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      const matches = await store.findMatching('coding patterns');

      expect(matches.length).toBe(2);
      expect(matches[0].confidence).toBeGreaterThanOrEqual(matches[1].confidence);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      // Create test data
      await store.create({
        trigger: 'test 1',
        action: 'action 1',
        confidence: 0.3,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      await store.create({
        trigger: 'test 2',
        action: 'action 2',
        confidence: 0.6,
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      await store.create({
        trigger: 'test 3',
        action: 'action 3',
        confidence: 0.8,
        domain: 'code-style',
        source: 'explicit-teaching',
        evidence: [],
      });
    });

    it('should list all instincts without filter', async () => {
      const all = await store.list();
      expect(all.length).toBe(3);
    });

    it('should filter by domain', async () => {
      const filtered = await store.list({ domain: 'code-style' });
      expect(filtered.length).toBe(2);
      expect(filtered.every((i: Instinct) => i.domain === 'code-style')).toBe(true);
    });

    it('should filter by source', async () => {
      const filtered = await store.list({ source: 'user-correction' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].source).toBe('user-correction');
    });

    it('should filter by minConfidence', async () => {
      const filtered = await store.list({ minConfidence: 0.5 });
      expect(filtered.length).toBe(2);
      expect(filtered.every((i: Instinct) => i.confidence >= 0.5)).toBe(true);
    });

    it('should filter by maxConfidence', async () => {
      const filtered = await store.list({ maxConfidence: 0.5 });
      expect(filtered.length).toBe(1);
      expect(filtered.every((i: Instinct) => i.confidence <= 0.5)).toBe(true);
    });

    it('should filter by searchText', async () => {
      const filtered = await store.list({ searchText: 'action 1' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].action).toBe('action 1');
    });

    it('should filter by multiple domains', async () => {
      const filtered = await store.list({ domain: ['testing', 'code-style'] });
      expect(filtered.length).toBe(3);
    });
  });

  // ============================================================================
  // Confidence Adjustment Tests
  // ============================================================================

  describe('reinforce', () => {
    it('should increase confidence by 0.05', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.5,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      const reinforced = await store.reinforce(instinct.id);

      expect(reinforced).not.toBeNull();
      expect(reinforced!.confidence).toBeCloseTo(0.55, 2);
    });

    it('should not exceed max confidence', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.93,
        domain: 'testing',
        source: 'explicit-teaching',
        evidence: [],
      });

      const reinforced = await store.reinforce(instinct.id);

      expect(reinforced!.confidence).toBeLessThanOrEqual(0.95);
    });

    it('should return null for non-existent id', async () => {
      const result = await store.reinforce('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('correct', () => {
    it('should decrease confidence by 0.10', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.5,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      const corrected = await store.correct(instinct.id);

      expect(corrected).not.toBeNull();
      expect(corrected!.confidence).toBeCloseTo(0.4, 2);
    });

    it('should not go below min confidence', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        confidence: 0.25,
        domain: 'testing',
        source: 'pattern-inference',
        evidence: [],
      });

      const corrected = await store.correct(instinct.id);

      expect(corrected!.confidence).toBeGreaterThanOrEqual(CONFIDENCE_ADJUSTMENTS.MIN_CONFIDENCE);
    });

    it('should return null for non-existent id', async () => {
      const result = await store.correct('non-existent');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // Usage Recording Tests
  // ============================================================================

  describe('recordUsage', () => {
    it('should increment usageCount', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      await store.recordUsage(instinct.id, true);
      await store.recordUsage(instinct.id, true);

      const updated = await store.get(instinct.id);

      expect(updated!.usageCount).toBe(2);
    });

    it('should increment successCount on success', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      await store.recordUsage(instinct.id, true);

      const updated = await store.get(instinct.id);

      expect(updated!.successCount).toBe(1);
      expect(updated!.failureCount).toBe(0);
    });

    it('should increment failureCount on failure', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      await store.recordUsage(instinct.id, false);

      const updated = await store.get(instinct.id);

      expect(updated!.successCount).toBe(0);
      expect(updated!.failureCount).toBe(1);
    });

    it('should update lastUsedAt', async () => {
      const instinct = await store.create({
        trigger: 'test',
        action: 'test',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      await store.recordUsage(instinct.id, true);

      const updated = await store.get(instinct.id);

      expect(updated!.lastUsedAt).toBeInstanceOf(Date);
    });

    it('should silently ignore non-existent id', async () => {
      await expect(store.recordUsage('non-existent', true)).resolves.toBeUndefined();
    });
  });

  // ============================================================================
  // Evolution Tests
  // ============================================================================

  describe('evolve', () => {
    it('should identify evolution candidates with high confidence and usage', async () => {
      // Create multiple high-confidence instincts in same domain
      for (let i = 0; i < 5; i++) {
        const instinct = await store.create({
          trigger: `functional pattern ${i}`,
          action: 'use pure functions',
          confidence: 0.85,
          domain: 'code-style',
          source: 'user-correction',
          evidence: [],
        });

        // Simulate usage
        for (let j = 0; j < 15; j++) {
          await store.recordUsage(instinct.id, true);
        }
      }

      const evolutions = await store.evolve();

      expect(evolutions.length).toBeGreaterThan(0);
      expect(evolutions[0].type).toMatch(/^(skill|command|agent)$/);
      expect(evolutions[0].sourceInstincts.length).toBeGreaterThan(0);
    });

    it('should not evolve low-confidence instincts', async () => {
      await store.create({
        trigger: 'low confidence',
        action: 'some action',
        confidence: 0.3,
        domain: 'code-style',
        source: 'session-observation',
        evidence: [],
      });

      const evolutions = await store.evolve();

      expect(evolutions.length).toBe(0);
    });

    it('should respect custom threshold', async () => {
      // Need at least MIN_CLUSTER_SIZE (3) instincts for evolution
      for (let i = 0; i < 3; i++) {
        const instinct = await store.create({
          trigger: `medium confidence ${i}`,
          action: 'some action',
          confidence: 0.6,
          domain: 'code-style',
          source: 'user-correction',
          evidence: [],
        });

        // Simulate sufficient usage
        for (let j = 0; j < 15; j++) {
          await store.recordUsage(instinct.id, true);
        }
      }

      const evolutions = await store.evolve(0.5);

      expect(evolutions.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Export/Import Tests
  // ============================================================================

  describe('export', () => {
    it('should export all instincts without filter', async () => {
      await store.create({
        trigger: 'test 1',
        action: 'action 1',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      await store.create({
        trigger: 'test 2',
        action: 'action 2',
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      const exported = await store.export();

      expect(exported.length).toBe(2);
    });

    it('should export filtered instincts', async () => {
      await store.create({
        trigger: 'test 1',
        action: 'action 1',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      await store.create({
        trigger: 'test 2',
        action: 'action 2',
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      const exported = await store.export({ domain: 'testing' });

      expect(exported.length).toBe(1);
      expect(exported[0].domain).toBe('testing');
    });
  });

  describe('import', () => {
    it('should import new instincts', async () => {
      const toImport: Instinct[] = [
        {
          id: randomUUID(),
          trigger: 'imported trigger',
          action: 'imported action',
          confidence: 0.6,
          domain: 'testing',
          source: 'imported',
          evidence: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 5,
          successCount: 4,
          failureCount: 1,
        },
      ];

      const result = await store.import(toImport);

      expect(result.imported).toBe(1);
      expect(result.merged).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);

      const retrieved = await store.get(toImport[0].id);
      expect(retrieved).not.toBeNull();
    });

    it('should merge existing instincts', async () => {
      const existing = await store.create({
        trigger: 'existing trigger',
        action: 'existing action',
        confidence: 0.5,
        domain: 'testing',
        source: 'session-observation',
        evidence: ['original evidence'],
      });

      // Simulate some usage
      await store.recordUsage(existing.id, true);

      const toImport: Instinct[] = [
        {
          ...existing,
          confidence: 0.7, // Higher confidence
          evidence: ['new evidence'],
          usageCount: 10,
          successCount: 8,
          failureCount: 2,
        },
      ];

      const result = await store.import(toImport);

      expect(result.merged).toBe(1);

      const merged = await store.get(existing.id);
      expect(merged!.confidence).toBe(0.7); // Higher confidence kept
      expect(merged!.usageCount).toBeGreaterThan(10); // Counts merged
      expect(merged!.evidence).toContain('original evidence');
      expect(merged!.evidence).toContain('new evidence');
    });
  });

  // ============================================================================
  // Statistics Tests
  // ============================================================================

  describe('getStats', () => {
    beforeEach(async () => {
      await store.create({
        trigger: 'test 1',
        action: 'action 1',
        confidence: 0.3,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      const instinct2 = await store.create({
        trigger: 'test 2',
        action: 'action 2',
        confidence: 0.7,
        domain: 'code-style',
        source: 'user-correction',
        evidence: [],
      });

      await store.recordUsage(instinct2.id, true);
      await store.recordUsage(instinct2.id, true);
      await store.recordUsage(instinct2.id, false);

      const instinct3 = await store.create({
        trigger: 'test 3',
        action: 'action 3',
        confidence: 0.85,
        domain: 'code-style',
        source: 'explicit-teaching',
        evidence: [],
      });

      // Make it evolution candidate
      for (let i = 0; i < 15; i++) {
        await store.recordUsage(instinct3.id, true);
      }
    });

    it('should return correct total count', async () => {
      const stats = await store.getStats();
      expect(stats.total).toBe(3);
    });

    it('should return counts by domain', async () => {
      const stats = await store.getStats();
      expect(stats.byDomain['testing']).toBe(1);
      expect(stats.byDomain['code-style']).toBe(2);
    });

    it('should return counts by source', async () => {
      const stats = await store.getStats();
      expect(stats.bySource['session-observation']).toBe(1);
      expect(stats.bySource['user-correction']).toBe(1);
      expect(stats.bySource['explicit-teaching']).toBe(1);
    });

    it('should calculate average confidence', async () => {
      const stats = await store.getStats();
      const expected = (0.3 + 0.7 + 0.85) / 3;
      expect(stats.averageConfidence).toBeCloseTo(expected, 2);
    });

    it('should calculate total usage count', async () => {
      const stats = await store.getStats();
      expect(stats.totalUsageCount).toBe(18); // 3 + 15
    });

    it('should calculate success rate', async () => {
      const stats = await store.getStats();
      // 2 success + 15 success = 17 success
      // 1 failure
      // total = 18
      expect(stats.successRate).toBeCloseTo(17 / 18, 2);
    });

    it('should identify evolution candidates', async () => {
      const stats = await store.getStats();
      expect(stats.evolutionCandidates).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getConfidenceDistribution', () => {
    beforeEach(async () => {
      // TENTATIVE (0.3)
      await store.create({
        trigger: 'test 1',
        action: 'action',
        confidence: 0.35,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      // MODERATE (0.5)
      await store.create({
        trigger: 'test 2',
        action: 'action',
        confidence: 0.55,
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      // STRONG (0.7)
      await store.create({
        trigger: 'test 3',
        action: 'action',
        confidence: 0.75,
        domain: 'testing',
        source: 'user-correction',
        evidence: [],
      });

      await store.create({
        trigger: 'test 4',
        action: 'action',
        confidence: 0.8,
        domain: 'testing',
        source: 'user-correction',
        evidence: [],
      });

      // NEAR_CERTAIN (0.9)
      await store.create({
        trigger: 'test 5',
        action: 'action',
        confidence: 0.9,
        domain: 'testing',
        source: 'explicit-teaching',
        evidence: [],
      });
    });

    it('should return distribution map', async () => {
      const distribution = await store.getConfidenceDistribution();

      expect(distribution).toBeInstanceOf(Map);
      expect(distribution.get('TENTATIVE')).toBe(1);
      expect(distribution.get('MODERATE')).toBe(1);
      expect(distribution.get('STRONG')).toBe(2);
      expect(distribution.get('NEAR_CERTAIN')).toBe(1);
    });
  });

  // ============================================================================
  // Persistence Tests
  // ============================================================================

  describe('persistence', () => {
    it('should persist instincts to storage', async () => {
      await store.create({
        trigger: 'persistent test',
        action: 'test action',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      // Create new store instance with same path
      const store2 = new InstinctStore({ storagePath: testDir });
      await store2.initialize();

      const all = await store2.list();

      expect(all.length).toBe(1);
      expect(all[0].trigger).toBe('persistent test');
    });

    it('should restore Date objects from storage', async () => {
      const instinct = await store.create({
        trigger: 'date test',
        action: 'test action',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      // Create new store instance
      const store2 = new InstinctStore({ storagePath: testDir });
      await store2.initialize();

      const restored = await store2.get(instinct.id);

      expect(restored!.createdAt).toBeInstanceOf(Date);
      expect(restored!.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ============================================================================
  // Factory Function Tests
  // ============================================================================

  describe('createInstinctStore', () => {
    it('should create and initialize store', async () => {
      const factoryStore = await createInstinctStore({ storagePath: testDir });

      const instinct = await factoryStore.create({
        trigger: 'factory test',
        action: 'test action',
        domain: 'testing',
        source: 'session-observation',
        evidence: [],
      });

      expect(instinct.id).toBeDefined();
    });
  });

  // ============================================================================
  // Constants Export Tests
  // ============================================================================

  describe('constants', () => {
    it('should export INSTINCT_STORAGE_CONFIG', () => {
      expect(INSTINCT_STORAGE_CONFIG).toBeDefined();
      expect(INSTINCT_STORAGE_CONFIG.FILE_EXTENSION).toBe('.json');
    });

    it('should export INITIAL_CONFIDENCE_BY_SOURCE', () => {
      expect(INITIAL_CONFIDENCE_BY_SOURCE).toBeDefined();
      expect(INITIAL_CONFIDENCE_BY_SOURCE['session-observation']).toBe(0.3);
      expect(INITIAL_CONFIDENCE_BY_SOURCE['user-correction']).toBe(0.6);
      expect(INITIAL_CONFIDENCE_BY_SOURCE['explicit-teaching']).toBe(0.7);
    });

    it('should export EVOLUTION_THRESHOLDS', () => {
      expect(EVOLUTION_THRESHOLDS).toBeDefined();
      expect(EVOLUTION_THRESHOLDS.MIN_CONFIDENCE).toBe(0.8);
      expect(EVOLUTION_THRESHOLDS.MIN_USAGE_COUNT).toBe(10);
    });
  });
});
