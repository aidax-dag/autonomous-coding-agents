/**
 * Tests for Team Learning Hub
 */

import {
  TeamLearningHub,
  createTeamLearningHub,
} from '@/core/learning/team-learning-hub';
import type { InstinctRecord } from '@/core/learning/instinct-export';

function makeRecord(overrides: Partial<InstinctRecord> = {}): InstinctRecord {
  return {
    id: 'inst-1',
    trigger: 'When writing tests',
    action: 'Use describe blocks',
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

describe('TeamLearningHub', () => {
  describe('register and getTeamInstincts', () => {
    it('should register and retrieve team instincts', () => {
      const hub = new TeamLearningHub();
      const instincts = [
        makeRecord({ id: 'a' }),
        makeRecord({ id: 'b' }),
      ];

      hub.register('team-alpha', instincts);

      const result = hub.getTeamInstincts('team-alpha');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('a');
    });

    it('should return empty array for unregistered team', () => {
      const hub = new TeamLearningHub();
      const result = hub.getTeamInstincts('nonexistent');
      expect(result).toEqual([]);
    });

    it('should replace instincts on re-register', () => {
      const hub = new TeamLearningHub();

      hub.register('team-alpha', [makeRecord({ id: 'old' })]);
      hub.register('team-alpha', [makeRecord({ id: 'new' })]);

      const result = hub.getTeamInstincts('team-alpha');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('new');
    });
  });

  describe('mergeTeams', () => {
    it('should merge instincts from multiple teams with deduplication', () => {
      const hub = new TeamLearningHub();

      hub.register('team-a', [
        makeRecord({ id: 'a1', trigger: 'When writing tests', action: 'Use jest', confidence: 0.7 }),
        makeRecord({ id: 'a2', trigger: 'When deploying', action: 'Use docker', confidence: 0.6 }),
      ]);

      hub.register('team-b', [
        makeRecord({ id: 'b1', trigger: 'When writing tests', action: 'Use jest', confidence: 0.9 }),
        makeRecord({ id: 'b2', trigger: 'When reviewing', action: 'Check types', confidence: 0.8 }),
      ]);

      const merged = hub.mergeTeams(['team-a', 'team-b']);

      // Should have 3 unique trigger+action combos
      expect(merged).toHaveLength(3);

      // The shared "writing tests / use jest" should pick the higher confidence (0.9)
      const testInstinct = merged.find(
        (i) => i.trigger === 'When writing tests' && i.action === 'Use jest',
      );
      expect(testInstinct?.confidence).toBe(0.9);
    });

    it('should return empty array for empty team list', () => {
      const hub = new TeamLearningHub();
      const merged = hub.mergeTeams([]);
      expect(merged).toEqual([]);
    });
  });

  describe('getSharedPatterns', () => {
    it('should find patterns shared across teams', () => {
      const hub = new TeamLearningHub();

      const sharedTrigger = 'When writing tests';
      const sharedAction = 'Use describe blocks';

      hub.register('team-1', [
        makeRecord({ id: '1a', trigger: sharedTrigger, action: sharedAction, confidence: 0.8 }),
        makeRecord({ id: '1b', trigger: 'Only in team 1', action: 'Unique action', confidence: 0.5 }),
      ]);

      hub.register('team-2', [
        makeRecord({ id: '2a', trigger: sharedTrigger, action: sharedAction, confidence: 0.9 }),
      ]);

      hub.register('team-3', [
        makeRecord({ id: '3a', trigger: sharedTrigger, action: sharedAction, confidence: 0.7 }),
      ]);

      const patterns = hub.getSharedPatterns(2);

      expect(patterns).toHaveLength(1);
      expect(patterns[0].trigger).toBe(sharedTrigger);
      expect(patterns[0].action).toBe(sharedAction);
      expect(patterns[0].teamCount).toBe(3);
      expect(patterns[0].teamIds).toContain('team-1');
      expect(patterns[0].teamIds).toContain('team-2');
      expect(patterns[0].teamIds).toContain('team-3');
      expect(patterns[0].averageConfidence).toBeCloseTo(0.8, 1);
    });

    it('should return empty when no patterns meet minTeams threshold', () => {
      const hub = new TeamLearningHub();

      hub.register('team-1', [makeRecord({ id: '1', trigger: 'unique1', action: 'act1' })]);
      hub.register('team-2', [makeRecord({ id: '2', trigger: 'unique2', action: 'act2' })]);

      const patterns = hub.getSharedPatterns(2);
      expect(patterns).toEqual([]);
    });

    it('should default minTeams to 2', () => {
      const hub = new TeamLearningHub();

      hub.register('team-a', [makeRecord({ trigger: 'same', action: 'same' })]);
      hub.register('team-b', [makeRecord({ trigger: 'same', action: 'same' })]);

      const patterns = hub.getSharedPatterns();
      expect(patterns).toHaveLength(1);
    });
  });

  describe('createTeamLearningHub factory', () => {
    it('should create a TeamLearningHub instance', () => {
      const hub = createTeamLearningHub();
      expect(hub).toBeInstanceOf(TeamLearningHub);
    });
  });
});
