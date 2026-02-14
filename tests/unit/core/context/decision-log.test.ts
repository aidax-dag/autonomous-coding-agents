/**
 * DecisionLog Tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DecisionLog, type ArchitecturalDecision } from '../../../../src/core/context/decision-log';

describe('DecisionLog', () => {
  let log: DecisionLog;

  beforeEach(() => {
    log = new DecisionLog();
  });

  function makeDecision(overrides: Partial<ArchitecturalDecision> = {}): ArchitecturalDecision {
    return {
      id: 'adr-001',
      title: 'Use PostgreSQL for primary data store',
      description: 'PostgreSQL chosen over MongoDB for relational data requirements.',
      rationale: 'Strong ACID compliance and relational query support.',
      alternatives: ['MongoDB', 'MySQL', 'SQLite'],
      category: 'database',
      timestamp: '2026-01-15T10:00:00.000Z',
      status: 'accepted',
      ...overrides,
    };
  }

  describe('record', () => {
    it('should record a decision', () => {
      log.record(makeDecision());

      expect(log.getAll()).toHaveLength(1);
      expect(log.getAll()[0].id).toBe('adr-001');
    });

    it('should record multiple decisions', () => {
      log.record(makeDecision({ id: 'adr-001' }));
      log.record(makeDecision({ id: 'adr-002', title: 'Use JWT for authentication' }));

      expect(log.getAll()).toHaveLength(2);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no decisions recorded', () => {
      expect(log.getAll()).toEqual([]);
    });

    it('should return a copy to prevent external mutation', () => {
      log.record(makeDecision());

      const all = log.getAll();
      all.pop();

      expect(log.getAll()).toHaveLength(1);
    });
  });

  describe('getByCategory', () => {
    beforeEach(() => {
      log.record(makeDecision({ id: 'adr-001', category: 'database' }));
      log.record(makeDecision({ id: 'adr-002', category: 'security' }));
      log.record(makeDecision({ id: 'adr-003', category: 'Database' }));
    });

    it('should return decisions matching the category', () => {
      const results = log.getByCategory('database');

      expect(results).toHaveLength(2);
      expect(results.map((d) => d.id)).toContain('adr-001');
      expect(results.map((d) => d.id)).toContain('adr-003');
    });

    it('should be case-insensitive', () => {
      const results = log.getByCategory('SECURITY');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('adr-002');
    });

    it('should return empty array for unknown category', () => {
      expect(log.getByCategory('networking')).toEqual([]);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      log.record(makeDecision({
        id: 'adr-001',
        title: 'Use PostgreSQL',
        description: 'Relational database for core data.',
        rationale: 'ACID compliance needed.',
      }));
      log.record(makeDecision({
        id: 'adr-002',
        title: 'Use Redis for caching',
        description: 'In-memory store for fast lookups.',
        rationale: 'Reduce database load.',
      }));
    });

    it('should find decisions by title match', () => {
      const results = log.search('PostgreSQL');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('adr-001');
    });

    it('should find decisions by description match', () => {
      const results = log.search('in-memory');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('adr-002');
    });

    it('should find decisions by rationale match', () => {
      const results = log.search('ACID');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('adr-001');
    });

    it('should match across multiple decisions', () => {
      const results = log.search('database');
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', () => {
      expect(log.search('kubernetes')).toEqual([]);
    });
  });

  describe('persistence', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'decision-log-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('should save and load decisions', async () => {
      const filePath = path.join(tmpDir, 'decisions.json');

      log.record(makeDecision({ id: 'adr-001' }));
      log.record(makeDecision({ id: 'adr-002', category: 'security' }));
      await log.save(filePath);

      const loaded = new DecisionLog();
      await loaded.load(filePath);

      expect(loaded.getAll()).toHaveLength(2);
      expect(loaded.getAll()[0].id).toBe('adr-001');
      expect(loaded.getAll()[1].category).toBe('security');
    });

    it('should handle loading from non-existent file gracefully', async () => {
      const filePath = path.join(tmpDir, 'missing.json');
      const freshLog = new DecisionLog();

      await freshLog.load(filePath);

      expect(freshLog.getAll()).toEqual([]);
    });
  });
});
