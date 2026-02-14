/**
 * Tests for Instinct Exporter and Bundle Exporter (D-1)
 */

import {
  InstinctExporter,
  createInstinctExporter,
  InstinctBundleExporter,
  createInstinctBundleExporter,
} from '@/core/learning/instinct-export';
import type {
  InstinctRecord,
  ExportedInstinctBundle,
  BundleExportStore,
} from '@/core/learning/instinct-export';
import type {
  IInstinctStore,
  Instinct,
  ImportResult,
} from '@/core/learning/interfaces/learning.interface';

function makeMockStore(instincts: Instinct[] = []): IInstinctStore {
  return {
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMatching: jest.fn(),
    list: jest.fn(),
    reinforce: jest.fn(),
    correct: jest.fn(),
    recordUsage: jest.fn(),
    evolve: jest.fn(),
    export: jest.fn().mockImplementation(async (filter?: { minConfidence?: number }) => {
      if (filter?.minConfidence !== undefined) {
        return instincts.filter((i) => i.confidence >= filter.minConfidence!);
      }
      return instincts;
    }),
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

function makeInstinct(overrides: Partial<Instinct> = {}): Instinct {
  return {
    id: 'inst-1',
    trigger: 'When declaring variables',
    action: 'Use const for immutable bindings',
    confidence: 0.8,
    domain: 'code-style',
    source: 'user-correction',
    evidence: ['Observed in review'],
    usageCount: 5,
    successCount: 4,
    failureCount: 1,
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('InstinctExporter', () => {
  describe('exportAll', () => {
    it('should export all instincts as records', async () => {
      const store = makeMockStore([makeInstinct(), makeInstinct({ id: 'inst-2' })]);
      const exporter = new InstinctExporter();

      const records = await exporter.exportAll(store);

      expect(records).toHaveLength(2);
      expect(records[0].id).toBe('inst-1');
      expect(records[1].id).toBe('inst-2');
      expect(typeof records[0].createdAt).toBe('string');
    });
  });

  describe('exportFiltered', () => {
    it('should only export instincts above minConfidence', async () => {
      const instincts = [
        makeInstinct({ id: 'low', confidence: 0.3 }),
        makeInstinct({ id: 'high', confidence: 0.9 }),
      ];
      const store = makeMockStore(instincts);
      const exporter = new InstinctExporter();

      const records = await exporter.exportFiltered(store, 0.5);

      expect(records).toHaveLength(1);
      expect(records[0].id).toBe('high');
    });
  });

  describe('toJSON', () => {
    it('should produce valid JSON string', () => {
      const exporter = new InstinctExporter();
      const records: InstinctRecord[] = [
        {
          id: 'inst-1',
          trigger: 'test trigger',
          action: 'test action',
          confidence: 0.8,
          domain: 'code-style',
          source: 'user-correction',
          evidence: ['ev1'],
          usageCount: 1,
          successCount: 1,
          failureCount: 0,
          createdAt: '2025-12-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const json = exporter.toJSON(records);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('inst-1');
    });
  });

  describe('toYAML', () => {
    it('should produce YAML-like output with correct structure', () => {
      const exporter = new InstinctExporter();
      const records: InstinctRecord[] = [
        {
          id: 'inst-yaml',
          trigger: 'yaml trigger',
          action: 'yaml action',
          confidence: 0.7,
          domain: 'testing',
          source: 'session-observation',
          evidence: ['ev1', 'ev2'],
          usageCount: 3,
          successCount: 2,
          failureCount: 1,
          createdAt: '2025-12-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ];

      const yaml = exporter.toYAML(records);

      expect(yaml).toContain('- id: inst-yaml');
      expect(yaml).toContain('  trigger: "yaml trigger"');
      expect(yaml).toContain('  confidence: 0.7');
      expect(yaml).toContain('  evidence:');
      expect(yaml).toContain('    - "ev1"');
      expect(yaml).toContain('    - "ev2"');
    });
  });

  describe('createInstinctExporter factory', () => {
    it('should create an InstinctExporter instance', () => {
      const exporter = createInstinctExporter();
      expect(exporter).toBeInstanceOf(InstinctExporter);
    });
  });
});

// ============================================================================
// D-1 Bundle Exporter Tests
// ============================================================================

function makeBundleStore(instincts: Instinct[] = []): BundleExportStore {
  return {
    getAll: () => instincts,
  };
}

describe('InstinctBundleExporter', () => {
  describe('export with default options', () => {
    it('should export instincts above default confidence threshold', () => {
      const store = makeBundleStore([
        makeInstinct({ id: 'i1', confidence: 0.8 }),
        makeInstinct({ id: 'i2', confidence: 0.3 }),
        makeInstinct({ id: 'i3', confidence: 0.6 }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export();

      // Default minConfidence is 0.5, so 0.3 is excluded
      expect(bundle.instincts).toHaveLength(2);
      expect(bundle.count).toBe(2);
      expect(bundle.version).toBe('1.0');
      expect(bundle.source).toBe('aca');
    });
  });

  describe('export filter by minimum confidence', () => {
    it('should respect custom minConfidence threshold', () => {
      const store = makeBundleStore([
        makeInstinct({ id: 'i1', confidence: 0.9 }),
        makeInstinct({ id: 'i2', confidence: 0.7 }),
        makeInstinct({ id: 'i3', confidence: 0.4 }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export({ minConfidence: 0.8 });

      expect(bundle.instincts).toHaveLength(1);
      expect(bundle.instincts[0].confidence).toBe(0.9);
    });
  });

  describe('export filter by categories', () => {
    it('should only include instincts from specified categories', () => {
      const store = makeBundleStore([
        makeInstinct({ id: 'i1', domain: 'code-style', confidence: 0.8 }),
        makeInstinct({ id: 'i2', domain: 'testing', confidence: 0.8 }),
        makeInstinct({ id: 'i3', domain: 'security', confidence: 0.8 }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export({ categories: ['code-style', 'security'] });

      expect(bundle.instincts).toHaveLength(2);
      const categories = bundle.instincts.map((i) => i.category);
      expect(categories).toContain('code-style');
      expect(categories).toContain('security');
      expect(categories).not.toContain('testing');
    });
  });

  describe('export without metadata', () => {
    it('should omit metadata when includeMetadata is false', () => {
      const store = makeBundleStore([
        makeInstinct({ id: 'i1', confidence: 0.8 }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export({ includeMetadata: false });

      expect(bundle.instincts).toHaveLength(1);
      expect(bundle.instincts[0].metadata).toBeUndefined();
    });

    it('should include metadata by default', () => {
      const store = makeBundleStore([
        makeInstinct({ id: 'i1', confidence: 0.8, source: 'user-correction' }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export();

      expect(bundle.instincts[0].metadata).toBeDefined();
      expect(bundle.instincts[0].metadata!.source).toBe('user-correction');
    });
  });

  describe('exportToJson', () => {
    it('should produce valid pretty-printed JSON', () => {
      const store = makeBundleStore([
        makeInstinct({ id: 'i1', confidence: 0.8 }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const json = exporter.exportToJson();
      const parsed = JSON.parse(json) as ExportedInstinctBundle;

      expect(parsed.version).toBe('1.0');
      expect(parsed.instincts).toHaveLength(1);
      expect(json).toContain('\n'); // Pretty-printed
    });
  });

  describe('empty store', () => {
    it('should return empty bundle from empty store', () => {
      const store = makeBundleStore([]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export();

      expect(bundle.instincts).toHaveLength(0);
      expect(bundle.count).toBe(0);
    });
  });

  describe('bundle structure', () => {
    it('should include version and exportedAt timestamp', () => {
      const store = makeBundleStore([
        makeInstinct({ confidence: 0.8 }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export();

      expect(bundle.version).toBe('1.0');
      expect(bundle.exportedAt).toBeDefined();
      // Verify it is a valid ISO timestamp
      const date = new Date(bundle.exportedAt);
      expect(date.getTime()).not.toBeNaN();
    });

    it('should map trigger to pattern and domain to category', () => {
      const store = makeBundleStore([
        makeInstinct({
          confidence: 0.8,
          domain: 'testing',
        }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export();

      expect(bundle.instincts[0].pattern).toBe('When declaring variables');
      expect(bundle.instincts[0].category).toBe('testing');
    });

    it('should extract tags from metadata', () => {
      const store = makeBundleStore([
        makeInstinct({
          confidence: 0.8,
          metadata: { tags: ['typescript', 'best-practice'] },
        }),
      ]);
      const exporter = new InstinctBundleExporter(store);

      const bundle = exporter.export();

      expect(bundle.instincts[0].tags).toEqual(['typescript', 'best-practice']);
    });
  });

  describe('createInstinctBundleExporter factory', () => {
    it('should create via factory function', () => {
      const store = makeBundleStore([]);
      const exporter = createInstinctBundleExporter(store);
      expect(exporter).toBeInstanceOf(InstinctBundleExporter);
    });
  });
});
