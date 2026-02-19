/**
 * SQLite Database Client
 *
 * Implements IDBClient for SQLite via dynamic import of better-sqlite3.
 * Compiles without the dependency installed; connects at runtime.
 *
 * @module core/persistence/sqlite-client
 */

import type { IDBClient, DBConfig, QueryResult } from './db-client';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('sqlite-client');

// ============================================================================
// Errors
// ============================================================================

/**
 * Structured database error with error code classification.
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// ============================================================================
// SQLiteClient
// ============================================================================

/**
 * SQLite client backed by better-sqlite3.
 *
 * The driver is loaded dynamically at connect() time, so the module
 * compiles even when better-sqlite3 is not installed.
 */
export class SQLiteClient implements IDBClient {
  private db: any = null;
  private connected = false;
  private readonly config: DBConfig;

  constructor(config: DBConfig) {
    this.config = { ...config, enableWAL: config.enableWAL ?? true };
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    try {
      const Database = (await import('better-sqlite3')).default;
      this.db = new Database(this.config.filePath ?? ':memory:');
      if (this.config.enableWAL) {
        this.db.pragma('journal_mode = WAL');
      }
      this.db.pragma('foreign_keys = ON');
      this.connected = true;
      logger.info(`SQLite connected: ${this.config.filePath ?? ':memory:'}`);
    } catch (error) {
      throw new DatabaseError(
        'Failed to connect to SQLite',
        'CONNECT_ERROR',
        error as Error,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.db) return;
    try {
      this.db.close();
    } finally {
      this.db = null;
      this.connected = false;
      logger.info('SQLite disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.assertConnected();
    try {
      const stmt = this.db.prepare(sql);
      const rows = params ? stmt.all(...params) : stmt.all();
      return { rows, rowCount: rows.length };
    } catch (error) {
      throw new DatabaseError(
        `Query failed: ${(error as Error).message}`,
        'QUERY_ERROR',
        error as Error,
      );
    }
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.assertConnected();
    try {
      const stmt = this.db.prepare(sql);
      const info = params ? stmt.run(...params) : stmt.run();
      return {
        rows: [],
        rowCount: info.changes,
        lastInsertId: Number(info.lastInsertRowid),
      };
    } catch (error) {
      throw new DatabaseError(
        `Execute failed: ${(error as Error).message}`,
        'EXECUTE_ERROR',
        error as Error,
      );
    }
  }

  async transaction<T>(fn: (client: IDBClient) => Promise<T>): Promise<T> {
    this.assertConnected();
    // Use manual BEGIN/COMMIT for async compatibility
    this.db.prepare('BEGIN').run();
    try {
      const result = await fn(this);
      this.db.prepare('COMMIT').run();
      return result;
    } catch (error) {
      this.db.prepare('ROLLBACK').run();
      throw error;
    }
  }

  /**
   * Quick connectivity check.
   */
  healthCheck(): boolean {
    if (!this.connected || !this.db) return false;
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch {
      return false;
    }
  }

  private assertConnected(): void {
    if (!this.connected || !this.db) {
      throw new DatabaseError('SQLite client is not connected', 'NOT_CONNECTED');
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a SQLite database client.
 */
export function createSQLiteClient(config: DBConfig): SQLiteClient {
  return new SQLiteClient(config);
}
