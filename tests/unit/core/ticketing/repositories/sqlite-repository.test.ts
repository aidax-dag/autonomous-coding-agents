/**
 * SqliteTicketFeatureRepository Unit Tests
 *
 * Uses InMemoryDBClient to test repository logic without requiring
 * the optional better-sqlite3 dependency.
 */

jest.mock('../../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { InMemoryDBClient } from '../../../../../src/core/persistence/db-client';
import { SqliteTicketFeatureRepository } from '../../../../../src/core/ticketing/repositories/sqlite-repository';
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

describe('SqliteTicketFeatureRepository', () => {
  let client: InMemoryDBClient;
  let repo: SqliteTicketFeatureRepository;

  beforeEach(async () => {
    client = new InMemoryDBClient();
    await client.connect();
    repo = new SqliteTicketFeatureRepository({ client });
  });

  afterEach(async () => {
    await client.disconnect();
  });

  // ==========================================================================
  // load()
  // ==========================================================================

  describe('load', () => {
    it('should return default store when tables are empty', async () => {
      const store = await repo.load();
      expect(store.version).toBe(1);
      expect(store.counters).toEqual({ ticket: 0, feature: 0, management: 0 });
      expect(store.tickets).toEqual([]);
      expect(store.features).toEqual([]);
    });

    it('should load previously saved store', async () => {
      const ticket = makeTicketRecord();
      const saved = makeStore({
        counters: { ticket: 1, feature: 0, management: 1 },
        tickets: [ticket],
      });

      await repo.save(saved);
      const loaded = await repo.load();

      expect(loaded.tickets).toHaveLength(1);
      expect(loaded.tickets[0].ticketId).toBe('ticket-2026-000001');
      expect(loaded.counters.ticket).toBe(1);
    });

    it('should create tables on first load', async () => {
      // load() triggers schema creation; second load should not fail
      await repo.load();
      const store = await repo.load();
      expect(store.version).toBe(1);
    });
  });

  // ==========================================================================
  // save()
  // ==========================================================================

  describe('save', () => {
    it('should persist tickets to the database', async () => {
      const ticket = makeTicketRecord({ ticketId: 'ticket-2026-000099' });
      const store = makeStore({
        counters: { ticket: 99, feature: 0, management: 99 },
        tickets: [ticket],
      });

      await repo.save(store);

      const result = await client.query(
        'SELECT ticket_id, title, status FROM tickets',
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].ticket_id).toBe('ticket-2026-000099');
      expect(result.rows[0].title).toBe('Test ticket');
      expect(result.rows[0].status).toBe('created');
    });

    it('should persist features to the database', async () => {
      const feature = makeFeatureRecord({ featureId: 'feature-2026-000005' });
      const store = makeStore({
        counters: { ticket: 0, feature: 5, management: 0 },
        features: [feature],
      });

      await repo.save(store);

      const result = await client.query(
        'SELECT feature_id, title, status, version FROM features',
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].feature_id).toBe('feature-2026-000005');
      expect(result.rows[0].version).toBe('1.0.0');
    });

    it('should persist counters to metadata table', async () => {
      const store = makeStore({
        version: 2,
        counters: { ticket: 10, feature: 5, management: 15 },
      });

      await repo.save(store);

      const result = await client.query(
        'SELECT key, value FROM ticket_feature_metadata',
      );
      const meta = new Map(
        result.rows.map((r) => [r.key as string, r.value as string]),
      );
      expect(meta.get('version')).toBe('2');
      expect(meta.get('counter_ticket')).toBe('10');
      expect(meta.get('counter_feature')).toBe('5');
      expect(meta.get('counter_management')).toBe('15');
    });

    it('should replace all data on subsequent save', async () => {
      const ticket1 = makeTicketRecord({ ticketId: 'ticket-2026-000001' });
      await repo.save(makeStore({ tickets: [ticket1] }));

      const ticket2 = makeTicketRecord({ ticketId: 'ticket-2026-000002' });
      await repo.save(makeStore({ tickets: [ticket2] }));

      const result = await client.query('SELECT ticket_id FROM tickets');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].ticket_id).toBe('ticket-2026-000002');
    });

    it('should handle empty store', async () => {
      await repo.save(makeStore());

      const tickets = await client.query('SELECT ticket_id FROM tickets');
      const features = await client.query('SELECT feature_id FROM features');
      expect(tickets.rows).toHaveLength(0);
      expect(features.rows).toHaveLength(0);
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
      expect(found!.status).toBe('created');
    });

    it('should return null when ticket does not exist', async () => {
      await repo.save(makeStore());
      const found = await repo.getTicket('nonexistent');
      expect(found).toBeNull();
    });

    it('should return null from empty database', async () => {
      const found = await repo.getTicket('ticket-2026-000001');
      expect(found).toBeNull();
    });

    it('should preserve nested ticket data through JSON serialization', async () => {
      const ticket = makeTicketRecord({
        ticketId: 'ticket-2026-000010',
        artifacts: [{ name: 'pr', url: 'https://github.com/pr/1', kind: 'code' }],
        issues: [{ message: 'blocker', createdAt: '2026-02-01T00:00:00.000Z' }],
      });
      await repo.save(makeStore({ tickets: [ticket] }));

      const found = await repo.getTicket('ticket-2026-000010');
      expect(found!.artifacts).toHaveLength(1);
      expect(found!.artifacts[0].name).toBe('pr');
      expect(found!.issues).toHaveLength(1);
      expect(found!.issues[0].message).toBe('blocker');
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

    it('should return null from empty database', async () => {
      const found = await repo.getFeature('feature-2026-000001');
      expect(found).toBeNull();
    });

    it('should preserve nested feature data through JSON serialization', async () => {
      const feature = makeFeatureRecord({
        featureId: 'feature-2026-000020',
        labels: ['backend', 'security'],
        options: {
          languages: ['typescript', 'python'],
          applicableDomains: ['auth'],
          constraints: ['no-external-deps'],
        },
      });
      await repo.save(makeStore({ features: [feature] }));

      const found = await repo.getFeature('feature-2026-000020');
      expect(found!.labels).toEqual(['backend', 'security']);
      expect(found!.options.languages).toEqual(['typescript', 'python']);
      expect(found!.options.constraints).toEqual(['no-external-deps']);
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
        version: 3,
        counters: { ticket: 10, feature: 5, management: 15 },
        tickets: [ticket],
        features: [feature],
      });

      await repo.save(original);
      const loaded = await repo.load();

      expect(loaded.version).toBe(3);
      expect(loaded.counters).toEqual({ ticket: 10, feature: 5, management: 15 });
      expect(loaded.tickets).toHaveLength(1);
      expect(loaded.features).toHaveLength(1);
      expect(loaded.tickets[0].ticketId).toBe(ticket.ticketId);
      expect(loaded.features[0].featureId).toBe(feature.featureId);
    });

    it('should handle multiple tickets and features', async () => {
      const tickets = [
        makeTicketRecord({ ticketId: 'ticket-2026-000001', title: 'First' }),
        makeTicketRecord({ ticketId: 'ticket-2026-000002', title: 'Second' }),
        makeTicketRecord({ ticketId: 'ticket-2026-000003', title: 'Third' }),
      ];
      const features = [
        makeFeatureRecord({ featureId: 'feature-2026-000001', title: 'FeatureA' }),
        makeFeatureRecord({ featureId: 'feature-2026-000002', title: 'FeatureB' }),
      ];
      const store = makeStore({
        counters: { ticket: 3, feature: 2, management: 5 },
        tickets,
        features,
      });

      await repo.save(store);
      const loaded = await repo.load();

      expect(loaded.tickets).toHaveLength(3);
      expect(loaded.features).toHaveLength(2);
    });
  });

  // ==========================================================================
  // Schema idempotency
  // ==========================================================================

  describe('schema creation', () => {
    it('should be idempotent on repeated calls', async () => {
      // Multiple operations should not fail due to schema re-creation
      await repo.save(makeStore());
      await repo.load();
      await repo.save(makeStore());
      await repo.getTicket('nonexistent');
      await repo.getFeature('nonexistent');
      // If we reach here without errors, schema creation is idempotent
      expect(true).toBe(true);
    });
  });
});
