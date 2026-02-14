/**
 * Database Migration Engine
 *
 * Tracks and executes schema migrations in version order.
 * Maintains a `_migrations` table to record applied migrations,
 * ensuring each migration runs exactly once.
 *
 * @module core/persistence/migration-engine
 */

import type { IDBClient } from './db-client';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('migration-engine');

// ============================================================================
// Interfaces
// ============================================================================

/**
 * A single schema migration with up/down operations.
 */
export interface Migration {
  /** Monotonically increasing version number */
  version: number;
  /** Human-readable migration name */
  name: string;
  /** Apply the migration */
  up: (client: IDBClient) => Promise<void>;
  /** Revert the migration */
  down: (client: IDBClient) => Promise<void>;
}

/**
 * Summary of the current migration state.
 */
export interface MigrationStatus {
  /** Highest applied migration version (0 if none) */
  currentVersion: number;
  /** Number of registered migrations not yet applied */
  pendingMigrations: number;
  /** Records of all applied migrations */
  appliedMigrations: MigrationRecord[];
}

/**
 * Record of a single applied migration.
 */
export interface MigrationRecord {
  /** Migration version number */
  version: number;
  /** Migration name */
  name: string;
  /** ISO timestamp when the migration was applied */
  appliedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const MIGRATIONS_TABLE = '_migrations';

// ============================================================================
// MigrationEngine
// ============================================================================

/**
 * Manages schema migrations for a database.
 *
 * Usage:
 * ```ts
 * const engine = createMigrationEngine(client);
 * engine.addMigration({ version: 1, name: 'create_users', up, down });
 * await engine.migrate();
 * ```
 */
export class MigrationEngine {
  private readonly client: IDBClient;
  private migrations: Migration[] = [];
  private initialized = false;

  constructor(client: IDBClient) {
    this.client = client;
  }

  /**
   * Register a migration. Migrations are sorted by version before execution.
   */
  addMigration(migration: Migration): void {
    this.migrations.push(migration);
    // Keep sorted by version for deterministic ordering
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Run all pending migrations in version order.
   *
   * Each migration executes inside a transaction so a failed migration
   * does not leave the schema in a partial state.
   */
  async migrate(): Promise<MigrationStatus> {
    await this.ensureTable();

    const applied = await this.getAppliedVersions();

    for (const migration of this.migrations) {
      if (applied.has(migration.version)) {
        continue;
      }

      logger.info(`Running migration v${migration.version}: ${migration.name}`);

      try {
        await this.client.transaction(async (txClient) => {
          await migration.up(txClient);
          await txClient.execute(
            `INSERT INTO ${MIGRATIONS_TABLE} (version, name, applied_at) VALUES (?, ?, ?)`,
            [migration.version, migration.name, new Date().toISOString()],
          );
        });
        logger.info(`Migration v${migration.version} applied successfully`);
      } catch (error) {
        logger.error(
          `Migration v${migration.version} failed`,
          error as Error,
        );
        throw error;
      }
    }

    return this.getStatus();
  }

  /**
   * Roll back applied migrations.
   *
   * @param toVersion Target version to roll back to (exclusive).
   *                  Omit to roll back only the most recent migration.
   */
  async rollback(toVersion?: number): Promise<MigrationStatus> {
    await this.ensureTable();

    const appliedRecords = await this.getAppliedRecords();
    if (appliedRecords.length === 0) {
      return this.getStatus();
    }

    // Default: roll back only the latest
    const target = toVersion ?? (appliedRecords.length > 1
      ? appliedRecords[appliedRecords.length - 2].version
      : 0);

    // Roll back from newest to oldest
    const toRollback = appliedRecords
      .filter((r) => r.version > target)
      .sort((a, b) => b.version - a.version);

    for (const record of toRollback) {
      const migration = this.migrations.find(
        (m) => m.version === record.version,
      );
      if (!migration) {
        logger.warn(
          `No migration definition found for v${record.version} — skipping rollback`,
        );
        continue;
      }

      logger.info(
        `Rolling back migration v${migration.version}: ${migration.name}`,
      );

      try {
        await this.client.transaction(async (txClient) => {
          await migration.down(txClient);
          await txClient.execute(
            `DELETE FROM ${MIGRATIONS_TABLE} WHERE version = ?`,
            [migration.version],
          );
        });
        logger.info(`Rollback v${migration.version} completed`);
      } catch (error) {
        logger.error(
          `Rollback v${migration.version} failed`,
          error as Error,
        );
        throw error;
      }
    }

    return this.getStatus();
  }

  /**
   * Get the current migration status.
   */
  async getStatus(): Promise<MigrationStatus> {
    await this.ensureTable();

    const records = await this.getAppliedRecords();
    const appliedVersions = new Set(records.map((r) => r.version));
    const pending = this.migrations.filter(
      (m) => !appliedVersions.has(m.version),
    );

    return {
      currentVersion:
        records.length > 0
          ? Math.max(...records.map((r) => r.version))
          : 0,
      pendingMigrations: pending.length,
      appliedMigrations: records,
    };
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private async ensureTable(): Promise<void> {
    if (this.initialized) return;

    await this.client.execute(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (version INTEGER, name TEXT, applied_at TEXT)`,
    );
    this.initialized = true;
  }

  private async getAppliedVersions(): Promise<Set<number>> {
    const result = await this.client.query(
      `SELECT version FROM ${MIGRATIONS_TABLE}`,
    );
    return new Set(result.rows.map((r) => r.version as number));
  }

  private async getAppliedRecords(): Promise<MigrationRecord[]> {
    const result = await this.client.query(
      `SELECT version, name, applied_at FROM ${MIGRATIONS_TABLE}`,
    );
    return result.rows
      .map((r) => ({
        version: r.version as number,
        name: r.name as string,
        appliedAt: r.applied_at as string,
      }))
      .sort((a, b) => a.version - b.version);
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a MigrationEngine for the given database client.
 */
export function createMigrationEngine(client: IDBClient): MigrationEngine {
  return new MigrationEngine(client);
}
