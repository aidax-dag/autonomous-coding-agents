/**
 * Migration 001: Initial Schema
 *
 * Creates the foundational tables for the autonomous coding agents system:
 * - tasks: tracks development tasks and their lifecycle
 * - sessions: records agent working sessions
 * - agent_logs: captures detailed agent activity for observability
 *
 * @module migrations/001_initial_schema
 */

import type { IDBClient } from '../src/core/persistence/db-client';

export const id = 1;
export const name = 'initial_schema';

export async function up(client: IDBClient): Promise<void> {
  // Tasks table: tracks work items assigned to agents
  await client.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      team TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Sessions table: records agent working sessions with metadata
  await client.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_root TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      metadata TEXT
    )
  `);

  // Agent logs table: detailed activity log for observability
  await client.execute(`
    CREATE TABLE IF NOT EXISTS agent_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      agent_type TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    )
  `);
}

export async function down(client: IDBClient): Promise<void> {
  await client.execute('DROP TABLE IF EXISTS agent_logs');
  await client.execute('DROP TABLE IF EXISTS sessions');
  await client.execute('DROP TABLE IF EXISTS tasks');
}
