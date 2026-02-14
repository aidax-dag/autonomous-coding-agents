/**
 * Migration Runner
 *
 * Higher-level wrapper around MigrationEngine that provides file-based
 * migration loading, CLI-friendly status reporting, rollback-by-count,
 * and template generation for new migration files.
 *
 * @module core/persistence/migration-runner
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAgentLogger } from '../../shared/logging/logger';
import { MigrationEngine, type Migration, type MigrationStatus } from './migration-engine';
import type { IDBClient } from './db-client';

const logger = createAgentLogger('migration-runner');

// ============================================================================
// Configuration
// ============================================================================

/**
 * Options for MigrationRunner creation.
 */
export interface MigrationRunnerOptions {
  /** Directory containing migration files (default: 'migrations/') */
  migrationsDir?: string;
}

/**
 * Extended status with pending migration details.
 */
export interface MigrationRunnerStatus extends MigrationStatus {
  /** Details of pending (unapplied) migrations */
  pendingDetails: Array<{ version: number; name: string }>;
}

// ============================================================================
// MigrationRunner
// ============================================================================

/**
 * File-based migration runner.
 *
 * Loads migration modules from a directory, delegates execution to
 * MigrationEngine, and provides convenience methods for CLI usage.
 *
 * Each migration file must export a Migration-compatible object with
 * `id` (number), `name` (string), `up(client)`, and `down(client)`.
 */
export class MigrationRunner {
  private readonly engine: MigrationEngine;
  private readonly migrationsDir: string;
  private loaded = false;

  constructor(dbClient: IDBClient, options?: MigrationRunnerOptions) {
    this.engine = new MigrationEngine(dbClient);
    this.migrationsDir = options?.migrationsDir ?? path.join(process.cwd(), 'migrations');
  }

  /**
   * Load migration files from the configured directory.
   *
   * Files are sorted lexicographically so numeric prefixes
   * (001_, 002_, ...) determine execution order. Each file must
   * export `id`, `name`, `up`, and `down`.
   */
  async loadMigrations(): Promise<void> {
    if (this.loaded) return;

    if (!fs.existsSync(this.migrationsDir)) {
      logger.warn(`Migrations directory not found: ${this.migrationsDir}`);
      this.loaded = true;
      return;
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    for (const file of files) {
      const filePath = path.join(this.migrationsDir, file);
      try {
        const mod = await import(filePath);
        const migration: Migration = {
          version: mod.id ?? mod.default?.id,
          name: mod.name ?? mod.default?.name,
          up: mod.up ?? mod.default?.up,
          down: mod.down ?? mod.default?.down,
        };

        if (!migration.version || !migration.name || !migration.up || !migration.down) {
          logger.warn(`Skipping invalid migration file: ${file}`);
          continue;
        }

        this.engine.addMigration(migration);
        logger.debug(`Loaded migration: ${file}`);
      } catch (err) {
        logger.error(`Failed to load migration file: ${file}`, err as Error);
      }
    }

    this.loaded = true;
  }

  /**
   * Run all pending migrations in order.
   */
  async migrate(): Promise<MigrationRunnerStatus> {
    await this.loadMigrations();
    const status = await this.engine.migrate();
    return this.toRunnerStatus(status);
  }

  /**
   * Rollback the last N applied migrations.
   *
   * @param count Number of migrations to roll back (default: 1).
   */
  async rollback(count: number = 1): Promise<MigrationRunnerStatus> {
    await this.loadMigrations();

    const currentStatus = await this.engine.getStatus();
    const applied = currentStatus.appliedMigrations;

    if (applied.length === 0) {
      return this.toRunnerStatus(currentStatus);
    }

    const targetIndex = Math.max(0, applied.length - count);
    const targetVersion = targetIndex > 0 ? applied[targetIndex - 1].version : 0;

    const status = await this.engine.rollback(targetVersion);
    return this.toRunnerStatus(status);
  }

  /**
   * Return the current migration status with pending details.
   */
  async status(): Promise<MigrationRunnerStatus> {
    await this.loadMigrations();
    const status = await this.engine.getStatus();
    return this.toRunnerStatus(status);
  }

  /**
   * Generate a new migration file template in the migrations directory.
   *
   * @param name Human-readable migration name (e.g. 'add_users_table').
   * @returns Absolute path of the generated file.
   */
  async createMigration(name: string): Promise<string> {
    if (!fs.existsSync(this.migrationsDir)) {
      fs.mkdirSync(this.migrationsDir, { recursive: true });
    }

    const existing = fs.readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    const nextId = existing.length > 0
      ? this.extractId(existing[existing.length - 1]) + 1
      : 1;

    const paddedId = String(nextId).padStart(3, '0');
    const fileName = `${paddedId}_${name}.ts`;
    const filePath = path.join(this.migrationsDir, fileName);

    const template = `/**
 * Migration: ${name}
 */

import type { IDBClient } from '../src/core/persistence/db-client';

export const id = ${nextId};
export const name = '${name}';

export async function up(client: IDBClient): Promise<void> {
  // TODO: implement migration
}

export async function down(client: IDBClient): Promise<void> {
  // TODO: implement rollback
}
`;

    fs.writeFileSync(filePath, template, 'utf-8');
    logger.info(`Created migration: ${fileName}`);
    return filePath;
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private toRunnerStatus(status: MigrationStatus): MigrationRunnerStatus {
    const appliedVersions = new Set(status.appliedMigrations.map((m) => m.version));
    const pendingDetails = this.getPendingFromEngine(appliedVersions);

    return {
      ...status,
      pendingDetails,
    };
  }

  private getPendingFromEngine(appliedVersions: Set<number>): Array<{ version: number; name: string }> {
    // Access the engine's registered migrations through status comparison
    // We reconstruct from the engine's getStatus pending count and our loaded files
    const pending: Array<{ version: number; name: string }> = [];

    if (!fs.existsSync(this.migrationsDir)) return pending;

    const files = fs.readdirSync(this.migrationsDir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
      .sort();

    for (const file of files) {
      const fileId = this.extractId(file);
      if (fileId > 0 && !appliedVersions.has(fileId)) {
        const nameMatch = file.replace(/^\d+_/, '').replace(/\.(ts|js)$/, '');
        pending.push({ version: fileId, name: nameMatch });
      }
    }

    return pending;
  }

  private extractId(fileName: string): number {
    const match = fileName.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a MigrationRunner for the given database client.
 */
export function createMigrationRunner(
  dbClient: IDBClient,
  options?: MigrationRunnerOptions,
): MigrationRunner {
  return new MigrationRunner(dbClient, options);
}
