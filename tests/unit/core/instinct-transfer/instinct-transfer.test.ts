/**
 * Tests for Instinct Transfer
 */

import {
  InstinctTransfer,
  createInstinctTransfer,
} from '@/core/instinct-transfer';
import type { InstinctBundle } from '@/core/instinct-transfer';
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
    export: jest.fn().mockResolvedValue(instincts),
    import: jest.fn().mockResolvedValue({ imported: instincts.length, skipped: 0, merged: 0, errors: [] } as ImportResult),
    getStats: jest.fn(),
    getConfidenceDistribution: jest.fn(),
  };
}

function makeInstinct(overrides: Partial<Instinct> = {}): Instinct {
  return {
    id: 'inst-1',
    domain: 'code-style',
    source: 'user-correction',
    trigger: 'When declaring variables',
    action: 'Always use const for immutable bindings',
    confidence: 0.85,
    evidence: ['Observed in code review'],
    metadata: {
      projectContext: 'test-project',
      languageContext: ['TypeScript'],
      frameworkContext: ['Node.js'],
    },
    usageCount: 5,
    successCount: 4,
    failureCount: 1,
    createdAt: new Date('2025-12-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('InstinctTransfer', () => {
  describe('exportBundle', () => {
    it('should export instincts as a bundle', async () => {
      const instincts = [makeInstinct({ id: 'i1' }), makeInstinct({ id: 'i2' })];
      const store = makeMockStore(instincts);
      const transfer = new InstinctTransfer({ store });

      const bundle = await transfer.exportBundle('my-project');

      expect(bundle.manifest.sourceProject).toBe('my-project');
      expect(bundle.manifest.count).toBe(2);
      expect(bundle.manifest.version).toBe('1.0.0');
      expect(bundle.instincts).toHaveLength(2);
      expect(store.export).toHaveBeenCalled();
    });

    it('should pass filter to store export', async () => {
      const store = makeMockStore([]);
      const transfer = new InstinctTransfer({ store });

      await transfer.exportBundle('proj', { domain: 'code-style' });

      expect(store.export).toHaveBeenCalledWith({ domain: 'code-style' });
    });
  });

  describe('importBundle', () => {
    it('should apply confidence discount', async () => {
      const instincts = [makeInstinct({ confidence: 1.0 })];
      const store = makeMockStore();
      const transfer = new InstinctTransfer({ store });

      const bundle: InstinctBundle = {
        manifest: { version: '1.0.0', sourceProject: 'other', exportedAt: '', count: 1 },
        instincts,
      };

      await transfer.importBundle(bundle, { confidenceDiscount: 0.5 });

      expect(store.import).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ confidence: 0.5 }),
        ]),
      );
    });

    it('should filter by minConfidence after discount', async () => {
      const instincts = [
        makeInstinct({ id: 'i1', confidence: 0.9 }),
        makeInstinct({ id: 'i2', confidence: 0.3 }),
      ];
      const store = makeMockStore();
      const transfer = new InstinctTransfer({ store });

      const bundle: InstinctBundle = {
        manifest: { version: '1.0.0', sourceProject: 'other', exportedAt: '', count: 2 },
        instincts,
      };

      await transfer.importBundle(bundle, {
        confidenceDiscount: 0.8,
        minConfidence: 0.5,
      });

      // i1: 0.9 * 0.8 = 0.72 (passes), i2: 0.3 * 0.8 = 0.24 (filtered)
      const importedArg = (store.import as jest.Mock).mock.calls[0][0];
      expect(importedArg).toHaveLength(1);
      expect(importedArg[0].id).toBe('i1');
    });

    it('should use default discount of 0.8', async () => {
      const instincts = [makeInstinct({ confidence: 1.0 })];
      const store = makeMockStore();
      const transfer = new InstinctTransfer({ store });

      const bundle: InstinctBundle = {
        manifest: { version: '1.0.0', sourceProject: 'other', exportedAt: '', count: 1 },
        instincts,
      };

      await transfer.importBundle(bundle);

      const importedArg = (store.import as jest.Mock).mock.calls[0][0];
      expect(importedArg[0].confidence).toBeCloseTo(0.8);
    });
  });

  describe('serialize/deserialize', () => {
    it('should round-trip a bundle', () => {
      const store = makeMockStore();
      const transfer = new InstinctTransfer({ store });

      const bundle: InstinctBundle = {
        manifest: { version: '1.0.0', sourceProject: 'proj', exportedAt: '2026-01-01', count: 1 },
        instincts: [makeInstinct()],
      };

      const json = transfer.serialize(bundle);
      const restored = transfer.deserialize(json);

      expect(restored.manifest.sourceProject).toBe('proj');
      expect(restored.instincts).toHaveLength(1);
    });

    it('should throw on invalid bundle format', () => {
      const store = makeMockStore();
      const transfer = new InstinctTransfer({ store });

      expect(() => transfer.deserialize('{}')).toThrow('Invalid instinct bundle format');
      expect(() => transfer.deserialize('{"manifest":{}}')).toThrow('Invalid instinct bundle format');
    });

    it('should produce readable JSON', () => {
      const store = makeMockStore();
      const transfer = new InstinctTransfer({ store });

      const bundle: InstinctBundle = {
        manifest: { version: '1.0.0', sourceProject: 'p', exportedAt: '', count: 0 },
        instincts: [],
      };

      const json = transfer.serialize(bundle);
      expect(json).toContain('\n'); // Pretty-printed
    });
  });

  describe('createInstinctTransfer', () => {
    it('should create via factory', () => {
      const store = makeMockStore();
      const transfer = createInstinctTransfer({ store });
      expect(transfer).toBeInstanceOf(InstinctTransfer);
    });
  });
});
