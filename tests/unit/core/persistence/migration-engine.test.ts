/**
 * MigrationEngine Unit Tests
 */

import {
  InMemoryDBClient,
  createInMemoryDBClient,
} from '../../../../src/core/persistence/db-client';
import {
  MigrationEngine,
  createMigrationEngine,
} from '../../../../src/core/persistence/migration-engine';
import type { Migration } from '../../../../src/core/persistence/migration-engine';
import type { IDBClient } from '../../../../src/core/persistence/db-client';

function createTestMigration(
  version: number,
  name: string,
  tableName: string = `table_v${version}`,
): Migration {
  return {
    version,
    name,
    up: async (client: IDBClient) => {
      await client.execute(
        `CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT, data TEXT)`,
      );
    },
    down: async (client: IDBClient) => {
      // InMemoryDBClient doesn't support DROP TABLE, so we create a marker
      // to verify rollback was called. In real usage the down() would drop.
      await client.execute(
        `CREATE TABLE IF NOT EXISTS ${tableName}_dropped (id TEXT)`,
      );
    },
  };
}

describe('MigrationEngine', () => {
  let client: InMemoryDBClient;
  let engine: MigrationEngine;

  beforeEach(async () => {
    client = createInMemoryDBClient();
    await client.connect();
    engine = createMigrationEngine(client);
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  // ==========================================================================
  // migrate()
  // ==========================================================================

  describe('migrate()', () => {
    it('should run pending migrations in version order', async () => {
      engine.addMigration(createTestMigration(2, 'create_posts'));
      engine.addMigration(createTestMigration(1, 'create_users'));

      const status = await engine.migrate();

      expect(status.currentVersion).toBe(2);
      expect(status.pendingMigrations).toBe(0);
      expect(status.appliedMigrations).toHaveLength(2);
      expect(status.appliedMigrations[0].version).toBe(1);
      expect(status.appliedMigrations[1].version).toBe(2);
    });

    it('should skip already-applied migrations', async () => {
      engine.addMigration(createTestMigration(1, 'create_users'));
      await engine.migrate();

      // Add a second migration and re-run
      engine.addMigration(createTestMigration(2, 'create_posts'));
      const status = await engine.migrate();

      expect(status.currentVersion).toBe(2);
      expect(status.appliedMigrations).toHaveLength(2);
    });

    it('should create _migrations table automatically', async () => {
      engine.addMigration(createTestMigration(1, 'create_users'));
      await engine.migrate();

      // Verify _migrations table exists by querying it
      const result = await client.query('SELECT * FROM _migrations');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].version).toBe(1);
      expect(result.rows[0].name).toBe('create_users');
      expect(result.rows[0].applied_at).toBeDefined();
    });

    it('should handle empty migrations list', async () => {
      const status = await engine.migrate();

      expect(status.currentVersion).toBe(0);
      expect(status.pendingMigrations).toBe(0);
      expect(status.appliedMigrations).toEqual([]);
    });

    it('should propagate migration failures', async () => {
      const failingMigration: Migration = {
        version: 1,
        name: 'will_fail',
        up: async () => {
          throw new Error('Schema error');
        },
        down: async () => {},
      };

      engine.addMigration(failingMigration);

      await expect(engine.migrate()).rejects.toThrow('Schema error');
    });

    it('should not record failed migrations', async () => {
      engine.addMigration(createTestMigration(1, 'ok_migration'));

      const failingMigration: Migration = {
        version: 2,
        name: 'will_fail',
        up: async () => {
          throw new Error('Schema error');
        },
        down: async () => {},
      };
      engine.addMigration(failingMigration);

      // The first migration should succeed, the second should fail
      await expect(engine.migrate()).rejects.toThrow('Schema error');

      const status = await engine.getStatus();
      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
    });

    it('should record applied_at timestamp', async () => {
      const before = new Date().toISOString();
      engine.addMigration(createTestMigration(1, 'create_users'));
      await engine.migrate();
      const after = new Date().toISOString();

      const status = await engine.getStatus();
      const appliedAt = status.appliedMigrations[0].appliedAt;
      expect(appliedAt >= before).toBe(true);
      expect(appliedAt <= after).toBe(true);
    });
  });

  // ==========================================================================
  // rollback()
  // ==========================================================================

  describe('rollback()', () => {
    it('should rollback the latest migration by default', async () => {
      engine.addMigration(createTestMigration(1, 'create_users'));
      engine.addMigration(createTestMigration(2, 'create_posts'));
      await engine.migrate();

      const status = await engine.rollback();

      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
      expect(status.appliedMigrations[0].version).toBe(1);
    });

    it('should rollback to a specific version', async () => {
      engine.addMigration(createTestMigration(1, 'create_users'));
      engine.addMigration(createTestMigration(2, 'create_posts'));
      engine.addMigration(createTestMigration(3, 'create_comments'));
      await engine.migrate();

      const status = await engine.rollback(1);

      expect(status.currentVersion).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
    });

    it('should rollback all migrations when target is 0', async () => {
      engine.addMigration(createTestMigration(1, 'create_users'));
      engine.addMigration(createTestMigration(2, 'create_posts'));
      await engine.migrate();

      const status = await engine.rollback(0);

      expect(status.currentVersion).toBe(0);
      expect(status.appliedMigrations).toHaveLength(0);
    });

    it('should be no-op when no migrations are applied', async () => {
      const status = await engine.rollback();

      expect(status.currentVersion).toBe(0);
      expect(status.pendingMigrations).toBe(0);
    });

    it('should call down() on rolled-back migrations', async () => {
      const downCalled: number[] = [];
      const migration: Migration = {
        version: 1,
        name: 'tracked',
        up: async (c) => {
          await c.execute(
            'CREATE TABLE IF NOT EXISTS tracked_table (id TEXT)',
          );
        },
        down: async () => {
          downCalled.push(1);
        },
      };

      engine.addMigration(migration);
      await engine.migrate();
      await engine.rollback(0);

      expect(downCalled).toEqual([1]);
    });

    it('should rollback in reverse order', async () => {
      const rollbackOrder: number[] = [];

      for (const v of [1, 2, 3]) {
        engine.addMigration({
          version: v,
          name: `migration_${v}`,
          up: async (c) => {
            await c.execute(
              `CREATE TABLE IF NOT EXISTS t${v} (id TEXT)`,
            );
          },
          down: async () => {
            rollbackOrder.push(v);
          },
        });
      }

      await engine.migrate();
      await engine.rollback(0);

      expect(rollbackOrder).toEqual([3, 2, 1]);
    });
  });

  // ==========================================================================
  // getStatus()
  // ==========================================================================

  describe('getStatus()', () => {
    it('should return correct state with no migrations', async () => {
      const status = await engine.getStatus();

      expect(status.currentVersion).toBe(0);
      expect(status.pendingMigrations).toBe(0);
      expect(status.appliedMigrations).toEqual([]);
    });

    it('should report pending migrations', async () => {
      engine.addMigration(createTestMigration(1, 'create_users'));
      engine.addMigration(createTestMigration(2, 'create_posts'));

      const status = await engine.getStatus();

      expect(status.currentVersion).toBe(0);
      expect(status.pendingMigrations).toBe(2);
    });

    it('should report mixed applied and pending', async () => {
      engine.addMigration(createTestMigration(1, 'create_users'));
      await engine.migrate();

      engine.addMigration(createTestMigration(2, 'create_posts'));
      const status = await engine.getStatus();

      expect(status.currentVersion).toBe(1);
      expect(status.pendingMigrations).toBe(1);
      expect(status.appliedMigrations).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createMigrationEngine', () => {
    it('should create a MigrationEngine instance', () => {
      const eng = createMigrationEngine(client);
      expect(eng).toBeInstanceOf(MigrationEngine);
    });
  });
});
