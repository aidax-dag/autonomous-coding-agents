/**
 * MigrationRunner Unit Tests
 *
 * Tests the file-based migration runner that wraps MigrationEngine
 * with directory loading, rollback-by-count, status reporting,
 * and migration template generation.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InMemoryDBClient, createInMemoryDBClient } from '../../../../../src/core/persistence/db-client';
import {
  MigrationRunner,
  createMigrationRunner,
} from '../../../../../src/core/persistence/migration-runner';

// ============================================================================
// Helpers
// ============================================================================

let tmpDir: string;

function createTmpMigrationsDir(): string {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-runner-test-'));
  return tmpDir;
}

function writeMigrationFile(
  dir: string,
  id: number,
  name: string,
  options?: { failUp?: boolean; failDown?: boolean },
): void {
  const paddedId = String(id).padStart(3, '0');
  const fileName = `${paddedId}_${name}.ts`;
  const failUp = options?.failUp ?? false;
  const failDown = options?.failDown ?? false;

  const content = `
export const id = ${id};
export const name = '${name}';

export async function up(client) {
  ${failUp ? 'throw new Error("migration_up_error");' : `await client.execute("CREATE TABLE IF NOT EXISTS t_${name} (id TEXT, data TEXT)");`}
}

export async function down(client) {
  ${failDown ? 'throw new Error("migration_down_error");' : `await client.execute("CREATE TABLE IF NOT EXISTS t_${name}_dropped (id TEXT)");`}
}
`;

  fs.writeFileSync(path.join(dir, fileName), content, 'utf-8');
}

// ============================================================================
// Tests
// ============================================================================

describe('MigrationRunner', () => {
  let client: InMemoryDBClient;
  let migrationsDir: string;

  beforeEach(async () => {
    client = createInMemoryDBClient();
    await client.connect();
    migrationsDir = createTmpMigrationsDir();
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
    // Clean up temp directory
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ==========================================================================
  // migrate()
  // ==========================================================================

  describe('migrate()', () => {
    it('should run migrations from the configured directory in order', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');
      writeMigrationFile(migrationsDir, 2, 'create_posts');

      const runner = createMigrationRunner(client, { migrationsDir });
      const status = await runner.migrate();

      expect(status.currentVersion).toBe(2);
      expect(status.appliedMigrations).toHaveLength(2);
      expect(status.appliedMigrations[0].version).toBe(1);
      expect(status.appliedMigrations[1].version).toBe(2);
      expect(status.pendingMigrations).toBe(0);
    });

    it('should skip already-applied migrations on re-run', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');

      const runner = createMigrationRunner(client, { migrationsDir });
      await runner.migrate();

      // Add another migration file and re-run
      writeMigrationFile(migrationsDir, 2, 'create_posts');

      // Force reload by creating a new runner with same client
      const runner2 = createMigrationRunner(client, { migrationsDir });
      const status = await runner2.migrate();

      expect(status.currentVersion).toBe(2);
      expect(status.appliedMigrations).toHaveLength(2);
    });

    it('should handle empty migrations directory', async () => {
      const runner = createMigrationRunner(client, { migrationsDir });
      const status = await runner.migrate();

      expect(status.currentVersion).toBe(0);
      expect(status.pendingMigrations).toBe(0);
      expect(status.appliedMigrations).toEqual([]);
    });

    it('should handle missing migrations directory gracefully', async () => {
      const nonExistentDir = path.join(migrationsDir, 'does_not_exist');
      const runner = createMigrationRunner(client, { migrationsDir: nonExistentDir });
      const status = await runner.migrate();

      expect(status.currentVersion).toBe(0);
      expect(status.pendingMigrations).toBe(0);
    });

    it('should propagate migration failures', async () => {
      writeMigrationFile(migrationsDir, 1, 'will_fail', { failUp: true });

      const runner = createMigrationRunner(client, { migrationsDir });
      await expect(runner.migrate()).rejects.toThrow('migration_up_error');
    });
  });

  // ==========================================================================
  // rollback()
  // ==========================================================================

  describe('rollback()', () => {
    it('should rollback the last migration by default', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');
      writeMigrationFile(migrationsDir, 2, 'create_posts');

      const runner = createMigrationRunner(client, { migrationsDir });
      await runner.migrate();

      const status = await runner.rollback();

      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
    });

    it('should rollback multiple migrations when count is specified', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');
      writeMigrationFile(migrationsDir, 2, 'create_posts');
      writeMigrationFile(migrationsDir, 3, 'create_comments');

      const runner = createMigrationRunner(client, { migrationsDir });
      await runner.migrate();

      const status = await runner.rollback(2);

      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
    });

    it('should rollback all when count exceeds applied', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');
      writeMigrationFile(migrationsDir, 2, 'create_posts');

      const runner = createMigrationRunner(client, { migrationsDir });
      await runner.migrate();

      const status = await runner.rollback(10);

      expect(status.currentVersion).toBe(0);
      expect(status.appliedMigrations).toHaveLength(0);
    });

    it('should be a no-op when no migrations are applied', async () => {
      const runner = createMigrationRunner(client, { migrationsDir });
      const status = await runner.rollback();

      expect(status.currentVersion).toBe(0);
    });
  });

  // ==========================================================================
  // status()
  // ==========================================================================

  describe('status()', () => {
    it('should report pending migrations with details', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');
      writeMigrationFile(migrationsDir, 2, 'create_posts');

      const runner = createMigrationRunner(client, { migrationsDir });
      const status = await runner.status();

      expect(status.currentVersion).toBe(0);
      expect(status.pendingMigrations).toBe(2);
      expect(status.pendingDetails).toHaveLength(2);
      expect(status.pendingDetails[0]).toEqual({ version: 1, name: 'create_users' });
      expect(status.pendingDetails[1]).toEqual({ version: 2, name: 'create_posts' });
    });

    it('should report mixed applied and pending', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');

      const runner = createMigrationRunner(client, { migrationsDir });
      await runner.migrate();

      // Add another migration file
      writeMigrationFile(migrationsDir, 2, 'create_posts');

      const runner2 = createMigrationRunner(client, { migrationsDir });
      const status = await runner2.status();

      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
      expect(status.pendingDetails).toHaveLength(1);
      expect(status.pendingDetails[0]).toEqual({ version: 2, name: 'create_posts' });
    });
  });

  // ==========================================================================
  // Duplicate migration prevention
  // ==========================================================================

  describe('duplicate migration prevention', () => {
    it('should not apply the same migration version twice', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');

      const runner = createMigrationRunner(client, { migrationsDir });
      await runner.migrate();
      const status = await runner.migrate();

      expect(status.appliedMigrations).toHaveLength(1);
      expect(status.currentVersion).toBe(1);
    });
  });

  // ==========================================================================
  // createMigration()
  // ==========================================================================

  describe('createMigration()', () => {
    it('should generate a migration file template', async () => {
      const runner = createMigrationRunner(client, { migrationsDir });
      const filePath = await runner.createMigration('add_indexes');

      expect(fs.existsSync(filePath)).toBe(true);
      expect(path.basename(filePath)).toBe('001_add_indexes.ts');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("export const id = 1");
      expect(content).toContain("export const name = 'add_indexes'");
      expect(content).toContain('export async function up');
      expect(content).toContain('export async function down');
    });

    it('should auto-increment migration ID based on existing files', async () => {
      writeMigrationFile(migrationsDir, 1, 'create_users');
      writeMigrationFile(migrationsDir, 2, 'create_posts');

      const runner = createMigrationRunner(client, { migrationsDir });
      const filePath = await runner.createMigration('add_comments');

      expect(path.basename(filePath)).toBe('003_add_comments.ts');

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export const id = 3');
    });

    it('should create migrations directory if it does not exist', async () => {
      const newDir = path.join(migrationsDir, 'new_migrations');
      const runner = createMigrationRunner(client, { migrationsDir: newDir });
      const filePath = await runner.createMigration('first_migration');

      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createMigrationRunner()', () => {
    it('should create a MigrationRunner instance', () => {
      const runner = createMigrationRunner(client);
      expect(runner).toBeInstanceOf(MigrationRunner);
    });

    it('should accept custom options', () => {
      const runner = createMigrationRunner(client, { migrationsDir: '/custom/path' });
      expect(runner).toBeInstanceOf(MigrationRunner);
    });
  });
});
