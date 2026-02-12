/**
 * Tests for Instinct Clusterer
 */

import {
  InstinctClusterer,
  createInstinctClusterer,
} from '@/core/learning/instinct-clustering';
import type { InstinctRecord } from '@/core/learning/instinct-export';

function makeRecord(overrides: Partial<InstinctRecord> = {}): InstinctRecord {
  return {
    id: 'inst-1',
    trigger: 'When writing tests',
    action: 'Use describe and it blocks',
    confidence: 0.8,
    domain: 'testing',
    source: 'user-correction',
    evidence: ['Observed'],
    usageCount: 3,
    successCount: 2,
    failureCount: 1,
    createdAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('InstinctClusterer', () => {
  describe('cluster', () => {
    it('should cluster similar instincts together', () => {
      const clusterer = new InstinctClusterer();
      const instincts = [
        makeRecord({ id: 'a', trigger: 'When writing unit tests', action: 'Use jest describe blocks' }),
        makeRecord({ id: 'b', trigger: 'When writing integration tests', action: 'Use jest describe blocks' }),
        makeRecord({ id: 'c', trigger: 'When deploying to production', action: 'Run full test suite first' }),
      ];

      const clusters = clusterer.cluster(instincts, 0.2);

      // The two test-related instincts should cluster together
      expect(clusters.length).toBeGreaterThanOrEqual(1);
      expect(clusters.length).toBeLessThanOrEqual(3);

      // Find the cluster containing 'a'
      const testCluster = clusters.find((c) =>
        c.instincts.some((i) => i.id === 'a'),
      );
      expect(testCluster).toBeDefined();
      expect(testCluster!.instincts.some((i) => i.id === 'b')).toBe(true);
    });

    it('should return empty array for empty input', () => {
      const clusterer = new InstinctClusterer();
      const clusters = clusterer.cluster([]);
      expect(clusters).toEqual([]);
    });

    it('should put each instinct in its own cluster with high threshold', () => {
      const clusterer = new InstinctClusterer();
      const instincts = [
        makeRecord({ id: 'x', trigger: 'foo bar', action: 'baz qux' }),
        makeRecord({ id: 'y', trigger: 'alpha beta', action: 'gamma delta' }),
      ];

      // Very high threshold - nothing should cluster
      const clusters = clusterer.cluster(instincts, 0.99);
      expect(clusters).toHaveLength(2);
    });
  });

  describe('suggestSkillName', () => {
    it('should generate a name from common words', () => {
      const clusterer = new InstinctClusterer();
      const cluster = {
        instincts: [
          makeRecord({ trigger: 'When writing tests', action: 'Use describe blocks' }),
          makeRecord({ trigger: 'When writing unit tests', action: 'Use describe it blocks' }),
        ],
        averageConfidence: 0.8,
        commonWords: ['writing', 'tests', 'describe'],
      };

      const name = clusterer.suggestSkillName(cluster);
      expect(name).toBe('writing-tests-describe-skill');
    });

    it('should fall back to domain when no common words', () => {
      const clusterer = new InstinctClusterer();
      const cluster = {
        instincts: [makeRecord({ domain: 'security' })],
        averageConfidence: 0.7,
        commonWords: [],
      };

      const name = clusterer.suggestSkillName(cluster);
      expect(name).toBe('security-skill');
    });
  });

  describe('toSkillDefinition', () => {
    it('should produce a valid skill definition', () => {
      const clusterer = new InstinctClusterer();
      const cluster = {
        instincts: [
          makeRecord({
            id: 'a',
            trigger: 'When writing tests',
            action: 'Use jest',
            domain: 'testing',
          }),
          makeRecord({
            id: 'b',
            trigger: 'When writing integration tests',
            action: 'Use supertest',
            domain: 'testing',
          }),
        ],
        averageConfidence: 0.85,
        commonWords: ['writing', 'tests'],
      };

      const def = clusterer.toSkillDefinition(cluster);

      expect(def.name).toContain('skill');
      expect(def.description).toContain('2 instincts');
      expect(def.tags).toContain('testing');
      expect(def.patterns).toHaveLength(2);
      expect(def.patterns).toContain('When writing tests');
    });
  });

  describe('threshold behavior', () => {
    it('should group more aggressively with lower threshold', () => {
      const clusterer = new InstinctClusterer();
      const instincts = [
        makeRecord({ id: '1', trigger: 'write code tests', action: 'use jest' }),
        makeRecord({ id: '2', trigger: 'write integration tests', action: 'use jest runner' }),
        makeRecord({ id: '3', trigger: 'deploy app server', action: 'use docker compose' }),
      ];

      const lowThreshold = clusterer.cluster(instincts, 0.1);
      const highThreshold = clusterer.cluster(instincts, 0.9);

      // Lower threshold should produce fewer (more merged) clusters
      expect(lowThreshold.length).toBeLessThanOrEqual(highThreshold.length);
    });
  });

  describe('createInstinctClusterer factory', () => {
    it('should create an InstinctClusterer instance', () => {
      const clusterer = createInstinctClusterer();
      expect(clusterer).toBeInstanceOf(InstinctClusterer);
    });
  });
});
