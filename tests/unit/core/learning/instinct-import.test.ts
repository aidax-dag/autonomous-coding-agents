/**
 * Tests for Instinct Importer
 */

import {
  InstinctImporter,
  createInstinctImporter,
} from '@/core/learning/instinct-import';
import type { InstinctRecord } from '@/core/learning/instinct-export';
import type {
  IInstinctStore,
  ImportResult,
} from '@/core/learning/interfaces/learning.interface';

function makeMockStore(): IInstinctStore {
  return {
    create: jest.fn().mockResolvedValue({ id: 'created' }),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMatching: jest.fn(),
    list: jest.fn(),
    reinforce: jest.fn(),
    correct: jest.fn(),
    recordUsage: jest.fn(),
    evolve: jest.fn(),
    export: jest.fn().mockResolvedValue([]),
    import: jest.fn().mockResolvedValue({
      imported: 0,
      skipped: 0,
      merged: 0,
      errors: [],
    } as ImportResult),
    getStats: jest.fn(),
    getConfidenceDistribution: jest.fn(),
  };
}

function makeRecord(overrides: Partial<InstinctRecord> = {}): InstinctRecord {
  return {
    id: 'inst-1',
    trigger: 'When writing tests',
    action: 'Use describe/it blocks',
    confidence: 0.8,
    domain: 'testing',
    source: 'user-correction',
    evidence: ['Observed in PR'],
    usageCount: 3,
    successCount: 2,
    failureCount: 1,
    createdAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('InstinctImporter', () => {
  describe('fromJSON', () => {
    it('should parse valid JSON array', () => {
      const importer = new InstinctImporter();
      const json = JSON.stringify([makeRecord()]);

      const result = importer.fromJSON(json);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inst-1');
    });

    it('should throw on non-array JSON', () => {
      const importer = new InstinctImporter();

      expect(() => {
        importer.fromJSON('{"not": "array"}');
      }).toThrow('Expected an array of instinct records');
    });

    it('should throw on invalid JSON', () => {
      const importer = new InstinctImporter();

      expect(() => {
        importer.fromJSON('not json');
      }).toThrow();
    });
  });

  describe('validate', () => {
    it('should accept valid records', () => {
      const importer = new InstinctImporter();
      const records = [makeRecord(), makeRecord({ id: 'inst-2' })];

      const result = importer.validate(records);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });

    it('should reject records with invalid fields', () => {
      const importer = new InstinctImporter();
      const invalidRecord = makeRecord({
        id: '',
        domain: 'nonexistent-domain' as never,
        confidence: 2.0,
      });

      const result = importer.validate([invalidRecord]);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0]).toContain('missing or invalid id');
    });

    it('should separate valid and invalid records', () => {
      const importer = new InstinctImporter();
      const records = [
        makeRecord({ id: 'valid-1' }),
        makeRecord({ id: '', trigger: '' }),
      ];

      const result = importer.validate(records);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].id).toBe('valid-1');
      expect(result.invalid).toHaveLength(1);
    });
  });

  describe('importToStore', () => {
    it('should import records into the store', async () => {
      const importer = new InstinctImporter();
      const store = makeMockStore();
      const records = [makeRecord(), makeRecord({ id: 'inst-2' })];

      const count = await importer.importToStore(store, records);

      expect(count).toBe(2);
      expect(store.create).toHaveBeenCalledTimes(2);
    });

    it('should use initialConfidence when provided', async () => {
      const importer = new InstinctImporter();
      const store = makeMockStore();
      const records = [makeRecord({ confidence: 0.9 })];

      await importer.importToStore(store, records, 0.5);

      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({ confidence: 0.5 }),
      );
    });

    it('should use record confidence when initialConfidence not provided', async () => {
      const importer = new InstinctImporter();
      const store = makeMockStore();
      const records = [makeRecord({ confidence: 0.75 })];

      await importer.importToStore(store, records);

      expect(store.create).toHaveBeenCalledWith(
        expect.objectContaining({ confidence: 0.75 }),
      );
    });
  });

  describe('createInstinctImporter factory', () => {
    it('should create an InstinctImporter instance', () => {
      const importer = createInstinctImporter();
      expect(importer).toBeInstanceOf(InstinctImporter);
    });
  });
});
