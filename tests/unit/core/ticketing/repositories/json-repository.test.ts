/**
 * JsonTicketFeatureRepository Unit Tests
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { JsonTicketFeatureRepository } from '../../../../../src/core/ticketing/repositories/json-repository';
import type { TicketFeatureStore } from '../../../../../src/core/ticketing/interfaces/ticket-feature-repository.interface';
import type { TicketRecord, FeatureRecord } from '../../../../../src/core/ticketing/ticket-feature-service';

function makeTicketRecord(overrides: Partial<TicketRecord> = {}): TicketRecord {
  return {
    ticketId: 'ticket-2026-000001',
    managementNumber: 'ACA-2026-00001',
    title: 'Test ticket',
    background: 'Test background',
    problem: 'Test problem',
    workDescription: 'Test work',
    expectedArtifacts: [{ name: 'artifact', type: 'code', description: 'desc' }],
    verification: {
      method: 'automated',
      conditions: ['passes'],
      checklist: ['check'],
    },
    createdBy: { agentId: 'planner-1', role: 'planner' },
    assignees: [],
    status: 'created',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    artifacts: [],
    issues: [],
    reviews: [],
    ...overrides,
  } as TicketRecord;
}

function makeFeatureRecord(overrides: Partial<FeatureRecord> = {}): FeatureRecord {
  return {
    featureId: 'feature-2026-000001',
    managementNumber: 'FEAT-2026-00001',
    title: 'Test feature',
    background: 'Test background',
    problem: 'Test problem',
    requirements: ['req1'],
    verificationChecklist: ['check1'],
    artifactLinks: [{ name: 'link', url: 'https://example.com/artifact', kind: 'code' }],
    usageGuideLinks: [{ name: 'guide', url: 'https://example.com/guide' }],
    labels: ['test'],
    options: { languages: ['typescript'], applicableDomains: [], constraints: [] },
    version: '1.0.0',
    status: 'draft',
    reviews: [],
    sourceTickets: [],
    usageCount: 0,
    versionHistory: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as FeatureRecord;
}

function makeStore(overrides: Partial<TicketFeatureStore> = {}): TicketFeatureStore {
  return {
    version: 1,
    counters: { ticket: 0, feature: 0, management: 0 },
    tickets: [],
    features: [],
    ...overrides,
  };
}

describe('JsonTicketFeatureRepository', () => {
  let tmpDir: string;
  let filePath: string;
  let repo: JsonTicketFeatureRepository;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aca-json-repo-'));
    filePath = path.join(tmpDir, 'store.json');
    repo = new JsonTicketFeatureRepository({ filePath });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // load()
  // ==========================================================================

  describe('load', () => {
    it('should return default store when file does not exist', async () => {
      const store = await repo.load();
      expect(store.version).toBe(1);
      expect(store.counters).toEqual({ ticket: 0, feature: 0, management: 0 });
      expect(store.tickets).toEqual([]);
      expect(store.features).toEqual([]);
    });

    it('should load existing store from file', async () => {
      const ticket = makeTicketRecord();
      const existing = makeStore({
        counters: { ticket: 1, feature: 0, management: 1 },
        tickets: [ticket],
      });
      await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

      const store = await repo.load();
      expect(store.tickets).toHaveLength(1);
      expect(store.tickets[0].ticketId).toBe('ticket-2026-000001');
      expect(store.counters.ticket).toBe(1);
    });

    it('should return default store for invalid JSON', async () => {
      await fs.writeFile(filePath, 'not json', 'utf-8');
      const store = await repo.load();
      expect(store.version).toBe(1);
      expect(store.tickets).toEqual([]);
    });

    it('should handle partial store data gracefully', async () => {
      await fs.writeFile(filePath, JSON.stringify({ version: 2 }), 'utf-8');
      const store = await repo.load();
      expect(store.version).toBe(2);
      expect(store.counters).toEqual({ ticket: 0, feature: 0, management: 0 });
      expect(store.tickets).toEqual([]);
      expect(store.features).toEqual([]);
    });

    it('should create parent directory if it does not exist', async () => {
      const nestedPath = path.join(tmpDir, 'nested', 'dir', 'store.json');
      const nestedRepo = new JsonTicketFeatureRepository({ filePath: nestedPath });
      const store = await nestedRepo.load();
      expect(store.version).toBe(1);
    });
  });

  // ==========================================================================
  // save()
  // ==========================================================================

  describe('save', () => {
    it('should persist store to file', async () => {
      const ticket = makeTicketRecord();
      const store = makeStore({
        counters: { ticket: 1, feature: 0, management: 1 },
        tickets: [ticket],
      });

      await repo.save(store);

      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.tickets).toHaveLength(1);
      expect(parsed.tickets[0].ticketId).toBe('ticket-2026-000001');
      expect(parsed.counters.ticket).toBe(1);
    });

    it('should overwrite existing file', async () => {
      const store1 = makeStore({ counters: { ticket: 1, feature: 0, management: 1 } });
      await repo.save(store1);

      const store2 = makeStore({ counters: { ticket: 5, feature: 3, management: 8 } });
      await repo.save(store2);

      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.counters.ticket).toBe(5);
    });

    it('should create parent directory if it does not exist', async () => {
      const nestedPath = path.join(tmpDir, 'deep', 'nested', 'store.json');
      const nestedRepo = new JsonTicketFeatureRepository({ filePath: nestedPath });
      await nestedRepo.save(makeStore());

      const raw = await fs.readFile(nestedPath, 'utf-8');
      expect(JSON.parse(raw).version).toBe(1);
    });

    it('should produce pretty-printed JSON', async () => {
      await repo.save(makeStore());
      const raw = await fs.readFile(filePath, 'utf-8');
      expect(raw).toContain('\n');
      expect(raw).toContain('  ');
    });
  });

  // ==========================================================================
  // getTicket()
  // ==========================================================================

  describe('getTicket', () => {
    it('should return ticket by ID', async () => {
      const ticket = makeTicketRecord({ ticketId: 'ticket-2026-000042' });
      await repo.save(makeStore({ tickets: [ticket] }));

      const found = await repo.getTicket('ticket-2026-000042');
      expect(found).not.toBeNull();
      expect(found!.ticketId).toBe('ticket-2026-000042');
      expect(found!.title).toBe('Test ticket');
    });

    it('should return null when ticket does not exist', async () => {
      await repo.save(makeStore());
      const found = await repo.getTicket('nonexistent');
      expect(found).toBeNull();
    });

    it('should return null when store file does not exist', async () => {
      const found = await repo.getTicket('ticket-2026-000001');
      expect(found).toBeNull();
    });
  });

  // ==========================================================================
  // getFeature()
  // ==========================================================================

  describe('getFeature', () => {
    it('should return feature by ID', async () => {
      const feature = makeFeatureRecord({ featureId: 'feature-2026-000007' });
      await repo.save(makeStore({ features: [feature] }));

      const found = await repo.getFeature('feature-2026-000007');
      expect(found).not.toBeNull();
      expect(found!.featureId).toBe('feature-2026-000007');
      expect(found!.title).toBe('Test feature');
    });

    it('should return null when feature does not exist', async () => {
      await repo.save(makeStore());
      const found = await repo.getFeature('nonexistent');
      expect(found).toBeNull();
    });

    it('should return null when store file does not exist', async () => {
      const found = await repo.getFeature('feature-2026-000001');
      expect(found).toBeNull();
    });
  });

  // ==========================================================================
  // round-trip: save then load
  // ==========================================================================

  describe('round-trip', () => {
    it('should preserve full store through save/load cycle', async () => {
      const ticket = makeTicketRecord();
      const feature = makeFeatureRecord();
      const original = makeStore({
        version: 2,
        counters: { ticket: 10, feature: 5, management: 15 },
        tickets: [ticket],
        features: [feature],
      });

      await repo.save(original);
      const loaded = await repo.load();

      expect(loaded.version).toBe(2);
      expect(loaded.counters).toEqual({ ticket: 10, feature: 5, management: 15 });
      expect(loaded.tickets).toHaveLength(1);
      expect(loaded.features).toHaveLength(1);
      expect(loaded.tickets[0].ticketId).toBe(ticket.ticketId);
      expect(loaded.features[0].featureId).toBe(feature.featureId);
    });
  });
});
