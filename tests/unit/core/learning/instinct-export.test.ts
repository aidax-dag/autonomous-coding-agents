/**
 * Tests for Instinct Exporter
 */

import {
  InstinctExporter,
  createInstinctExporter,
} from '@/core/learning/instinct-export';
import type { InstinctRecord } from '@/core/learning/instinct-export';
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
