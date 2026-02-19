import { createIdGenerator } from '../../../../src/core/ticketing/id-generator';
import { createVersionManager } from '../../../../src/core/ticketing/version-manager';
import {
  createFeatureLifecycleService,
  FeatureLifecycleService,
} from '../../../../src/core/ticketing/feature-lifecycle-service';
import type {
  FeatureCreateInput,
  FeatureRecord,
} from '../../../../src/core/ticketing/ticket-feature-service';
import type { TicketFeatureStore } from '../../../../src/core/ticketing/interfaces/ticket-feature-repository.interface';

function makeStore(overrides: Partial<TicketFeatureStore> = {}): TicketFeatureStore {
  return {
    version: 1,
    counters: { ticket: 0, feature: 0, management: 0 },
    tickets: [],
    features: [],
    ...overrides,
  };
}

function makeFeatureInput(overrides: Partial<FeatureCreateInput> = {}): FeatureCreateInput {
  return {
    title: 'Feature',
    background: 'Background',
    problem: 'Problem',
    requirements: ['req1'],
    verificationChecklist: ['check1'],
    artifactLinks: [{ name: 'artifact', url: 'https://example.com/a', kind: 'source' }],
    usageGuideLinks: [{ name: 'guide', url: 'https://example.com/g' }],
    labels: ['core'],
    options: { languages: ['typescript'], applicableDomains: [], constraints: [] },
    version: '1.0.0',
    status: 'draft',
    reviews: [],
    sourceTickets: ['ticket-2026-000001'],
    ...overrides,
  };
}

function makeFeatureRecord(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    featureId: 'feature-2026-000001',
    managementNumber: 'FEAT-2026-00001',
    usageCount: 0,
    versionHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...makeFeatureInput(),
    ...overrides,
  };
}

describe('FeatureLifecycleService', () => {
  let service: FeatureLifecycleService;

  beforeEach(() => {
    service = createFeatureLifecycleService(createIdGenerator(), createVersionManager());
  });

  it('creates a feature and increments feature counter', () => {
    const store = makeStore();
    const feature = service.createFeature(store, makeFeatureInput());

    expect(feature.featureId).toMatch(/^feature-\d{4}-\d{6}$/);
    expect(feature.managementNumber).toMatch(/^FEAT-\d{4}-\d{5}$/);
    expect(feature.versionHistory).toHaveLength(1);
    expect(store.counters.feature).toBe(1);
    expect(store.features).toHaveLength(1);
  });

  it('updates a feature and appends version history', () => {
    const feature = makeFeatureRecord({ versionHistory: [] });
    const store = makeStore({ features: [feature] });
    const parseFeatureInput = (input: FeatureCreateInput): FeatureCreateInput => input;

    const updated = service.updateFeature(
      store,
      feature.featureId,
      { title: 'Feature v2' },
      parseFeatureInput,
      { updatedBy: 'agent-1', reason: 'enhancement' },
    );

    expect(updated.title).toBe('Feature v2');
    expect(updated.version).toBe('1.0.1');
    expect(updated.versionHistory).toHaveLength(1);
    expect(updated.versionHistory[0].updatedBy).toBe('agent-1');
  });

  it('rolls back to a prior version and appends rollback history', () => {
    const snapshot = makeFeatureInput({ version: '1.0.0', title: 'Feature baseline' });
    const feature = makeFeatureRecord({
      version: '1.2.0',
      versionHistory: [{
        version: '1.0.0',
        updatedAt: '2026-01-01T00:00:00.000Z',
        snapshot,
      }],
    });
    const store = makeStore({ features: [feature] });
    const parseFeatureInput = (input: FeatureCreateInput): FeatureCreateInput => input;

    const rolledBack = service.rollbackFeatureVersion(
      store,
      feature.featureId,
      { toVersion: '1.0.0' },
      parseFeatureInput,
    );

    expect(rolledBack.title).toBe('Feature baseline');
    expect(rolledBack.version).toBe('1.2.1');
    expect(rolledBack.versionHistory).toHaveLength(2);
    expect(rolledBack.versionHistory[1].reason).toContain('rollback from 1.2.0 to 1.0.0');
  });

  it('updates labels and keeps them deduplicated/sorted', () => {
    const feature = makeFeatureRecord({ labels: ['zeta', 'alpha'] });
    const store = makeStore({ features: [feature] });

    const updated = service.updateFeatureLabels(store, feature.featureId, {
      add: ['beta', 'alpha'],
      remove: ['zeta'],
    });

    expect(updated.labels).toEqual(['alpha', 'beta']);
  });

  it('builds feature management summary with top labels', () => {
    const store = makeStore({
      features: [
        makeFeatureRecord({ featureId: 'f-1', labels: ['a', 'b'], usageCount: 2, status: 'draft' }),
        makeFeatureRecord({ featureId: 'f-2', labels: ['a'], usageCount: 4, status: 'published' }),
      ],
    });

    const summary = service.getFeatureManagementSummary(store, 1);

    expect(summary.totalFeatures).toBe(2);
    expect(summary.totalUsageCount).toBe(6);
    expect(summary.byStatus.draft).toBe(1);
    expect(summary.byStatus.published).toBe(1);
    expect(summary.topLabels).toEqual([{ label: 'a', count: 2 }]);
  });
});
