/**
 * Tests for Instinct Importer and Bundle Importer (D-1)
 */

import {
  InstinctImporter,
  createInstinctImporter,
  InstinctBundleImporter,
  createInstinctBundleImporter,
} from '@/core/learning/instinct-import';
import type {
  BundleImportStore,
} from '@/core/learning/instinct-import';
import type { InstinctRecord, ExportedInstinctBundle } from '@/core/learning/instinct-export';
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

// ============================================================================
// D-1 Bundle Importer Tests
// ============================================================================

function makeBundleImportStore(
  existingTriggers: string[] = [],
): BundleImportStore & { added: Record<string, unknown>[] } {
  const added: Record<string, unknown>[] = [];
  return {
    added,
    getAll: () => existingTriggers.map((t) => ({ trigger: t })),
    add: (instinct: Record<string, unknown>) => {
      added.push(instinct);
    },
  };
}

function makeBundle(
  overrides: Partial<ExportedInstinctBundle> = {},
): ExportedInstinctBundle {
  return {
    version: '1.0',
    exportedAt: '2026-01-15T12:00:00.000Z',
    source: 'other-project',
    count: 1,
    instincts: [
      {
        pattern: 'When writing functions',
        action: 'Use pure functions',
        confidence: 0.8,
        category: 'code-style',
        tags: ['fp', 'clean-code'],
      },
    ],
    ...overrides,
  };
}

describe('InstinctBundleImporter', () => {
  describe('validate', () => {
    it('should accept a valid bundle', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);

      const result = importer.validate(makeBundle());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object input', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);

      const result = importer.validate(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Bundle must be an object');
    });

    it('should reject unsupported version', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);

      const result = importer.validate({ version: '2.0', instincts: [] });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported version');
    });

    it('should reject missing instincts array', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);

      const result = importer.validate({ version: '1.0' });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing instincts array');
    });

    it('should reject instincts with missing pattern', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = {
        version: '1.0',
        instincts: [{ action: 'do something', confidence: 0.5 }],
      };

      const result = importer.validate(bundle);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing pattern');
    });

    it('should reject instincts with missing action', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = {
        version: '1.0',
        instincts: [{ pattern: 'when X', confidence: 0.5 }],
      };

      const result = importer.validate(bundle);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('missing action');
    });

    it('should reject instincts with invalid confidence', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = {
        version: '1.0',
        instincts: [{ pattern: 'when X', action: 'do Y', confidence: 1.5 }],
      };

      const result = importer.validate(bundle);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('invalid confidence');
    });
  });

  describe('import with default options', () => {
    it('should import instincts and cap confidence to 0.7', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle();

      const result = importer.import(bundle);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(result.total).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.dryRun).toBe(false);
      // Confidence should be capped at 0.7 (default maxConfidence)
      expect(store.added[0].confidence).toBe(0.7);
    });
  });

  describe('import confidence capping', () => {
    it('should cap confidence at provided maxConfidence', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle({
        instincts: [
          { pattern: 'p1', action: 'a1', confidence: 0.9, category: 'testing', tags: [] },
        ],
      });

      importer.import(bundle, { maxConfidence: 0.5 });

      expect(store.added[0].confidence).toBe(0.5);
    });

    it('should not increase confidence when below cap', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle({
        instincts: [
          { pattern: 'p1', action: 'a1', confidence: 0.3, category: 'testing', tags: [] },
        ],
      });

      importer.import(bundle, { maxConfidence: 0.7 });

      expect(store.added[0].confidence).toBe(0.3);
    });
  });

  describe('import skip existing patterns', () => {
    it('should skip instincts with already-existing patterns', () => {
      const store = makeBundleImportStore(['When writing functions']);
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle();

      const result = importer.import(bundle);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(store.added).toHaveLength(0);
    });
  });

  describe('import with overwrite', () => {
    it('should overwrite existing patterns when overwriteExisting is true', () => {
      const store = makeBundleImportStore(['When writing functions']);
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle();

      const result = importer.import(bundle, { overwriteExisting: true });

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(store.added).toHaveLength(1);
    });
  });

  describe('dry run mode', () => {
    it('should not persist when dryRun is true', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle();

      const result = importer.import(bundle, { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.imported).toBe(1);
      expect(store.added).toHaveLength(0); // Nothing persisted
    });
  });

  describe('import with source override', () => {
    it('should use custom source label', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle();

      importer.import(bundle, { source: 'team-alpha' });

      expect(store.added[0].source).toBe('team-alpha');
    });

    it('should fall back to bundle source when no override', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle({ source: 'other-project' });

      importer.import(bundle);

      expect(store.added[0].source).toBe('other-project');
    });
  });

  describe('import empty bundle', () => {
    it('should handle empty instincts array', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle({ instincts: [], count: 0 });

      const result = importer.import(bundle);

      expect(result.total).toBe(0);
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
    });
  });

  describe('import with store errors', () => {
    it('should collect errors from failing store.add calls', () => {
      const store: BundleImportStore = {
        getAll: () => [],
        add: () => {
          throw new Error('Write failed');
        },
      };
      const importer = new InstinctBundleImporter(store);
      const bundle = makeBundle();

      const result = importer.import(bundle);

      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Write failed');
    });
  });

  describe('import with invalid bundle', () => {
    it('should return validation errors without importing', () => {
      const store = makeBundleImportStore();
      const importer = new InstinctBundleImporter(store);
      const invalidBundle = { version: '99.0' } as unknown as ExportedInstinctBundle;

      const result = importer.import(invalidBundle);

      expect(result.imported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('createInstinctBundleImporter factory', () => {
    it('should create via factory function', () => {
      const store = makeBundleImportStore();
      const importer = createInstinctBundleImporter(store);
      expect(importer).toBeInstanceOf(InstinctBundleImporter);
    });
  });
});
