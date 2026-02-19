/**
 * SQLite-Based Ticket/Feature Repository
 *
 * Persists tickets and features in a SQLite database via the
 * project's IDBClient abstraction. Tables are auto-created on
 * first use. Complex nested objects (artifacts, issues, reviews,
 * options, etc.) are stored as JSON text columns.
 *
 * @module core/ticketing/repositories/sqlite-repository
 */

import type { IDBClient } from '@/core/persistence/db-client';
import type {
  ITicketFeatureRepository,
  TicketFeatureStore,
} from '../interfaces/ticket-feature-repository.interface';
import type { TicketRecord, FeatureRecord } from '../ticket-feature-service';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_STORE: TicketFeatureStore = {
  version: 1,
  counters: { ticket: 0, feature: 0, management: 0 },
  tickets: [],
  features: [],
};

// ============================================================================
// SQL Definitions
// ============================================================================

const CREATE_METADATA_TABLE = `
CREATE TABLE IF NOT EXISTS ticket_feature_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;

const CREATE_TICKETS_TABLE = `
CREATE TABLE IF NOT EXISTS tickets (
  ticket_id TEXT PRIMARY KEY,
  management_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

const CREATE_FEATURES_TABLE = `
CREATE TABLE IF NOT EXISTS features (
  feature_id TEXT PRIMARY KEY,
  management_number TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  version TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`;

// ============================================================================
// Options
// ============================================================================

export interface SqliteTicketFeatureRepositoryOptions {
  /** An already-connected IDBClient backed by SQLite */
  client: IDBClient;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Repository backed by SQLite tables.
 *
 * Stores each ticket and feature as a row with indexed scalar
 * columns and a `data` column containing the full JSON payload.
 * A metadata table persists the version and counters.
 */
export class SqliteTicketFeatureRepository implements ITicketFeatureRepository {
  private readonly client: IDBClient;
  private initialized = false;

  constructor(options: SqliteTicketFeatureRepositoryOptions) {
    this.client = options.client;
  }

  async load(): Promise<TicketFeatureStore> {
    await this.ensureSchema();

    const counters = await this.loadCounters();
    const tickets = await this.loadAllTickets();
    const features = await this.loadAllFeatures();

    return {
      version: counters.version,
      counters: {
        ticket: counters.ticket,
        feature: counters.feature,
        management: counters.management,
      },
      tickets,
      features,
    };
  }

  async save(store: TicketFeatureStore): Promise<void> {
    await this.ensureSchema();

    await this.client.transaction(async (tx) => {
      // Clear existing data by primary key for broad DB client compatibility
      await this.clearTable(tx, 'tickets', 'ticket_id');
      await this.clearTable(tx, 'features', 'feature_id');
      await this.clearTable(tx, 'ticket_feature_metadata', 'key');

      // Save counters and version
      await tx.execute(
        'INSERT INTO ticket_feature_metadata (key, value) VALUES (?, ?)',
        ['version', String(store.version)],
      );
      await tx.execute(
        'INSERT INTO ticket_feature_metadata (key, value) VALUES (?, ?)',
        ['counter_ticket', String(store.counters.ticket)],
      );
      await tx.execute(
        'INSERT INTO ticket_feature_metadata (key, value) VALUES (?, ?)',
        ['counter_feature', String(store.counters.feature)],
      );
      await tx.execute(
        'INSERT INTO ticket_feature_metadata (key, value) VALUES (?, ?)',
        ['counter_management', String(store.counters.management)],
      );

      // Insert tickets
      for (const ticket of store.tickets) {
        await tx.execute(
          `INSERT INTO tickets (ticket_id, management_number, title, status, data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            ticket.ticketId,
            ticket.managementNumber,
            ticket.title,
            ticket.status,
            JSON.stringify(ticket),
            ticket.createdAt,
            ticket.updatedAt,
          ],
        );
      }

      // Insert features
      for (const feature of store.features) {
        await tx.execute(
          `INSERT INTO features (feature_id, management_number, title, status, version, data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            feature.featureId,
            feature.managementNumber,
            feature.title,
            feature.status,
            feature.version,
            JSON.stringify(feature),
            feature.createdAt,
            feature.updatedAt,
          ],
        );
      }
    });
  }

  async getTicket(id: string): Promise<TicketRecord | null> {
    await this.ensureSchema();

    const result = await this.client.query(
      'SELECT data FROM tickets WHERE ticket_id = ?',
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return JSON.parse(result.rows[0].data as string) as TicketRecord;
  }

  async getFeature(id: string): Promise<FeatureRecord | null> {
    await this.ensureSchema();

    const result = await this.client.query(
      'SELECT data FROM features WHERE feature_id = ?',
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return JSON.parse(result.rows[0].data as string) as FeatureRecord;
  }

  // --------------------------------------------------------------------------
  // Internal: Schema
  // --------------------------------------------------------------------------

  private async ensureSchema(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.client.execute(CREATE_METADATA_TABLE);
    await this.client.execute(CREATE_TICKETS_TABLE);
    await this.client.execute(CREATE_FEATURES_TABLE);
    this.initialized = true;
  }

  // --------------------------------------------------------------------------
  // Internal: Clear helpers
  // --------------------------------------------------------------------------

  private async clearTable(
    tx: IDBClient,
    table: string,
    _primaryKey: string,
  ): Promise<void> {
    await tx.execute(`DELETE FROM ${table}`);
  }

  // --------------------------------------------------------------------------
  // Internal: Loaders
  // --------------------------------------------------------------------------

  private async loadCounters(): Promise<{
    version: number;
    ticket: number;
    feature: number;
    management: number;
  }> {
    const result = await this.client.query(
      'SELECT key, value FROM ticket_feature_metadata',
    );

    const meta = new Map<string, string>();
    for (const row of result.rows) {
      meta.set(row.key as string, row.value as string);
    }

    return {
      version: parseInt(meta.get('version') ?? String(DEFAULT_STORE.version), 10),
      ticket: parseInt(meta.get('counter_ticket') ?? String(DEFAULT_STORE.counters.ticket), 10),
      feature: parseInt(meta.get('counter_feature') ?? String(DEFAULT_STORE.counters.feature), 10),
      management: parseInt(meta.get('counter_management') ?? String(DEFAULT_STORE.counters.management), 10),
    };
  }

  private async loadAllTickets(): Promise<TicketRecord[]> {
    const result = await this.client.query(
      'SELECT data FROM tickets',
    );

    return result.rows.map(
      (row) => JSON.parse(row.data as string) as TicketRecord,
    );
  }

  private async loadAllFeatures(): Promise<FeatureRecord[]> {
    const result = await this.client.query(
      'SELECT data FROM features',
    );

    return result.rows.map(
      (row) => JSON.parse(row.data as string) as FeatureRecord,
    );
  }

}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a SQLite-backed ticket/feature repository.
 *
 * The provided client must already be connected.
 */
export function createSqliteTicketFeatureRepository(
  options: SqliteTicketFeatureRepositoryOptions,
): SqliteTicketFeatureRepository {
  return new SqliteTicketFeatureRepository(options);
}
