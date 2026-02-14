/**
 * Database Integration Tests
 *
 * Validates SQLite and PostgreSQL drivers against real database instances.
 * SQLite tests run when better-sqlite3 is available.
 * PostgreSQL tests run when DB_INTEGRATION_ENABLED=true and DB_CONNECTION_STRING is set.
 *
 * @module tests/integration/persistence/db-integration
 */

import type { IDBClient, DBConfig } from '../../../src/core/persistence/db-client';
import { createDBClient } from '../../../src/core/persistence/db-factory';
import { MigrationEngine } from '../../../src/core/persistence/migration-engine';
import * as initialSchema from '../../../migrations/001_initial_schema';

// ============================================================================
// Helpers
// ============================================================================

function sqliteConfig(): DBConfig {
  return { engine: 'sqlite', filePath: ':memory:', enableWAL: false };
}

function postgresConfig(): DBConfig {
  return {
    engine: 'postgres',
    connectionString:
      process.env.DB_CONNECTION_STRING ??
      'postgresql://aca:aca_dev@localhost:5432/aca',
    maxConnections: 2,
  };
}

async function runCoreFlow(client: IDBClient): Promise<void> {
  // Migration up
  const engine = new MigrationEngine(client);
  engine.addMigration({
    version: initialSchema.id,
    name: initialSchema.name,
    up: initialSchema.up,
    down: initialSchema.down,
  });
  const afterUp = await engine.migrate();
  expect(afterUp.currentVersion).toBe(1);
  expect(afterUp.pendingMigrations).toBe(0);

  // INSERT
  await client.execute(
    'INSERT INTO tasks (id, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    ['t1', 'Test task', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
  );

  // SELECT
  const rows = await client.query('SELECT * FROM tasks WHERE id = ?', ['t1']);
  expect(rows.rowCount).toBe(1);
  expect(rows.rows[0].description).toBe('Test task');

  // UPDATE
  await client.execute('UPDATE tasks SET status = ? WHERE id = ?', ['completed', 't1']);
  const updated = await client.query('SELECT status FROM tasks WHERE id = ?', ['t1']);
  expect(updated.rows[0].status).toBe('completed');

  // DELETE
  await client.execute('DELETE FROM tasks WHERE id = ?', ['t1']);
  const deleted = await client.query('SELECT * FROM tasks WHERE id = ?', ['t1']);
  expect(deleted.rowCount).toBe(0);
}

async function runTransactionFlow(client: IDBClient): Promise<void> {
  // Setup: ensure tasks table exists
  const engine = new MigrationEngine(client);
  engine.addMigration({
    version: initialSchema.id,
    name: initialSchema.name,
    up: initialSchema.up,
    down: initialSchema.down,
  });
  await engine.migrate();

  // Successful transaction
  await client.transaction(async (tx) => {
    await tx.execute(
      'INSERT INTO tasks (id, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      ['tx1', 'TX task', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
    );
  });
  const committed = await client.query('SELECT * FROM tasks WHERE id = ?', ['tx1']);
  expect(committed.rowCount).toBe(1);

  // Failed transaction should rollback
  try {
    await client.transaction(async (tx) => {
      await tx.execute(
        'INSERT INTO tasks (id, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['tx2', 'Rollback task', 'pending', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'],
      );
      throw new Error('Deliberate failure');
    });
  } catch {
    // Expected
  }
  const rolledBack = await client.query('SELECT * FROM tasks WHERE id = ?', ['tx2']);
  expect(rolledBack.rowCount).toBe(0);

  // Cleanup
  await client.execute('DELETE FROM tasks WHERE id = ?', ['tx1']);
}

async function runMigrationRollback(client: IDBClient): Promise<void> {
  const engine = new MigrationEngine(client);
  engine.addMigration({
    version: initialSchema.id,
    name: initialSchema.name,
    up: initialSchema.up,
    down: initialSchema.down,
  });

  // Apply
  await engine.migrate();
  let status = await engine.getStatus();
  expect(status.currentVersion).toBe(1);

  // Rollback
  await engine.rollback(0);
  status = await engine.getStatus();
  expect(status.currentVersion).toBe(0);

  // Re-apply should succeed
  await engine.migrate();
  status = await engine.getStatus();
  expect(status.currentVersion).toBe(1);
}

// ============================================================================
// SQLite Tests
// ============================================================================

describe('SQLite Integration', () => {
  let client: IDBClient;
  let sqliteAvailable = true;

  beforeAll(async () => {
    try {
      client = createDBClient(sqliteConfig());
      await client.connect();
    } catch {
      sqliteAvailable = false;
    }
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  });

  it('should connect and report healthy', () => {
    if (!sqliteAvailable) return;
    expect(client.isConnected()).toBe(true);
  });

  it('should run core CRUD flow via migration', async () => {
    if (!sqliteAvailable) return;
    await runCoreFlow(client);
  });

  it('should handle transactions with commit and rollback', async () => {
    if (!sqliteAvailable) return;
    await runTransactionFlow(client);
  });

  it('should support migration rollback and re-apply', async () => {
    if (!sqliteAvailable) return;
    // Use fresh client for clean rollback test
    const freshClient = createDBClient(sqliteConfig());
    await freshClient.connect();
    try {
      await runMigrationRollback(freshClient);
    } finally {
      await freshClient.disconnect();
    }
  });
});

// ============================================================================
// PostgreSQL Tests
// ============================================================================

const pgEnabled = process.env.DB_INTEGRATION_ENABLED === 'true';

(pgEnabled ? describe : describe.skip)('PostgreSQL Integration', () => {
  let client: IDBClient;

  beforeAll(async () => {
    client = createDBClient(postgresConfig());
    await client.connect();
    // Clean slate: drop tables if they exist from previous runs
    try {
      await client.execute('DROP TABLE IF EXISTS agent_logs');
      await client.execute('DROP TABLE IF EXISTS sessions');
      await client.execute('DROP TABLE IF EXISTS tasks');
      await client.execute('DROP TABLE IF EXISTS _migrations');
    } catch {
      // ignore
    }
  });

  afterAll(async () => {
    if (client?.isConnected()) {
      // Cleanup
      try {
        await client.execute('DROP TABLE IF EXISTS agent_logs');
        await client.execute('DROP TABLE IF EXISTS sessions');
        await client.execute('DROP TABLE IF EXISTS tasks');
        await client.execute('DROP TABLE IF EXISTS _migrations');
      } catch {
        // ignore
      }
      await client.disconnect();
    }
  });

  it('should connect and report healthy', () => {
    expect(client.isConnected()).toBe(true);
  });

  it('should run core CRUD flow via migration', async () => {
    await runCoreFlow(client);
  });

  it('should handle transactions with commit and rollback', async () => {
    await runTransactionFlow(client);
  });

  it('should support migration rollback and re-apply', async () => {
    // Clean slate for rollback test
    try {
      await client.execute('DROP TABLE IF EXISTS agent_logs');
      await client.execute('DROP TABLE IF EXISTS sessions');
      await client.execute('DROP TABLE IF EXISTS tasks');
      await client.execute('DROP TABLE IF EXISTS _migrations');
    } catch {
      // ignore
    }
    await runMigrationRollback(client);
  });
});

// ============================================================================
// Factory Tests
// ============================================================================

describe('DB Factory Integration', () => {
  it('should create SQLite client via factory', () => {
    const client = createDBClient({ engine: 'sqlite', filePath: ':memory:' });
    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(false);
  });

  it('should create PostgreSQL client via factory', () => {
    const client = createDBClient({
      engine: 'postgres',
      connectionString: 'postgresql://localhost:5432/test',
    });
    expect(client).toBeDefined();
    expect(client.isConnected()).toBe(false);
  });

  it('should create InMemory client for memory engine', () => {
    const client = createDBClient({ engine: 'memory' as any });
    expect(client).toBeDefined();
  });
});

// ============================================================================
// Error Scenario Tests
// ============================================================================

describe('Error Scenarios', () => {
  it('should throw CONNECT_ERROR for invalid PostgreSQL connection', async () => {
    const client = createDBClient({
      engine: 'postgres',
      connectionString: 'postgresql://invalid:invalid@localhost:1/nonexistent',
      maxConnections: 1,
    });
    await expect(client.connect()).rejects.toThrow();
  });
});
