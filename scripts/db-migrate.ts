#!/usr/bin/env tsx
/**
 * Database Migration CLI
 *
 * Wrapper script for MigrationRunner. Reads DATABASE_URL from the
 * environment and dispatches to migrate / rollback / status commands.
 *
 * Usage:
 *   tsx scripts/db-migrate.ts              # run pending migrations
 *   tsx scripts/db-migrate.ts rollback      # rollback last migration
 *   tsx scripts/db-migrate.ts rollback 3    # rollback last 3 migrations
 *   tsx scripts/db-migrate.ts status        # show migration status
 *
 * @module scripts/db-migrate
 */

/* eslint-disable no-console */

import * as dotenv from 'dotenv';
import { createInMemoryDBClient } from '../src/core/persistence/db-client';
import { createMigrationRunner } from '../src/core/persistence/migration-runner';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'migrate';

  // Use InMemoryDBClient as the default until a real driver is wired in.
  // When a real pg/sqlite driver is available, replace this with a
  // connection created from DATABASE_URL.
  if (DATABASE_URL) {
    console.log(`DATABASE_URL configured: ${DATABASE_URL.replace(/\/\/.*@/, '//*****@')}`);
  } else {
    console.log('No DATABASE_URL set — using in-memory database');
  }

  const client = createInMemoryDBClient();
  await client.connect();

  const runner = createMigrationRunner(client);

  try {
    switch (command) {
      case 'migrate': {
        console.log('Running pending migrations...');
        const status = await runner.migrate();
        console.log(`Current version: ${status.currentVersion}`);
        console.log(`Applied: ${status.appliedMigrations.length}`);
        console.log(`Pending: ${status.pendingMigrations}`);
        break;
      }

      case 'rollback': {
        const count = parseInt(process.argv[3] ?? '1', 10);
        console.log(`Rolling back ${count} migration(s)...`);
        const status = await runner.rollback(count);
        console.log(`Current version: ${status.currentVersion}`);
        console.log(`Applied: ${status.appliedMigrations.length}`);
        break;
      }

      case 'status': {
        const status = await runner.status();
        console.log(`Current version: ${status.currentVersion}`);
        console.log(`Applied migrations: ${status.appliedMigrations.length}`);
        for (const m of status.appliedMigrations) {
          console.log(`  [applied] v${m.version} — ${m.name} (${m.appliedAt})`);
        }
        console.log(`Pending migrations: ${status.pendingMigrations}`);
        for (const p of status.pendingDetails) {
          console.log(`  [pending] v${p.version} — ${p.name}`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.error('Usage: db-migrate.ts [migrate|rollback|status]');
        process.exit(1);
    }
  } finally {
    await client.disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
