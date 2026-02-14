/**
 * PostgreSQL Database Client
 *
 * Implements IDBClient for PostgreSQL via dynamic import of pg (node-postgres).
 * Compiles without the dependency installed; connects at runtime.
 *
 * @module core/persistence/postgres-client
 */

import type { IDBClient, DBConfig, QueryResult } from './db-client';
import { DatabaseError } from './sqlite-client';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('postgres-client');

// ============================================================================
// PostgresClient
// ============================================================================

/**
 * PostgreSQL client backed by node-postgres (pg) connection pool.
 *
 * Features:
 * - Connection pooling with configurable max connections
 * - Automatic `?` → `$N` placeholder conversion
 * - Transaction support with nested savepoints
 */
export class PostgresClient implements IDBClient {
  private pool: any = null;
  private connected = false;
  private readonly config: DBConfig;

  constructor(config: DBConfig) {
    this.config = { ...config, maxConnections: config.maxConnections ?? 5 };
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    try {
      const { Pool } = await import('pg');
      this.pool = new Pool({
        connectionString: this.config.connectionString,
        max: this.config.maxConnections,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      // Verify connectivity
      const client = await this.pool.connect();
      client.release();
      this.connected = true;
      logger.info('PostgreSQL connected');
    } catch (error) {
      throw new DatabaseError(
        'Failed to connect to PostgreSQL',
        'CONNECT_ERROR',
        error as Error,
      );
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.pool) return;
    try {
      await this.pool.end();
    } finally {
      this.pool = null;
      this.connected = false;
      logger.info('PostgreSQL disconnected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.assertConnected();
    try {
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.pool.query(pgSql, params);
      return { rows: result.rows, rowCount: result.rows.length };
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
      const pgSql = this.convertPlaceholders(sql);
      const result = await this.pool.query(pgSql, params);
      return {
        rows: [],
        rowCount: result.rowCount ?? 0,
        ...(result.rows?.[0]?.id != null
          ? { lastInsertId: result.rows[0].id }
          : {}),
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
    const pgClient = await this.pool.connect();
    try {
      await pgClient.query('BEGIN');

      const txClient: IDBClient = {
        connect: async () => {},
        disconnect: async () => {},
        isConnected: () => true,
        query: async (sql: string, params?: unknown[]) => {
          const pgSql = this.convertPlaceholders(sql);
          const result = await pgClient.query(pgSql, params);
          return { rows: result.rows, rowCount: result.rows.length };
        },
        execute: async (sql: string, params?: unknown[]) => {
          const pgSql = this.convertPlaceholders(sql);
          const result = await pgClient.query(pgSql, params);
          return { rows: [], rowCount: result.rowCount ?? 0 };
        },
        transaction: async <U>(innerFn: (c: IDBClient) => Promise<U>) => {
          await pgClient.query('SAVEPOINT nested');
          try {
            const r = await innerFn(txClient);
            await pgClient.query('RELEASE SAVEPOINT nested');
            return r;
          } catch (e) {
            await pgClient.query('ROLLBACK TO SAVEPOINT nested');
            throw e;
          }
        },
      };

      const result = await fn(txClient);
      await pgClient.query('COMMIT');
      return result;
    } catch (error) {
      await pgClient.query('ROLLBACK');
      throw error;
    } finally {
      pgClient.release();
    }
  }

  /**
   * Asynchronous connectivity check.
   */
  async healthCheck(): Promise<boolean> {
    if (!this.connected || !this.pool) return false;
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert `?` placeholders to PostgreSQL `$1, $2, ...` syntax.
   */
  private convertPlaceholders(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  private assertConnected(): void {
    if (!this.connected || !this.pool) {
      throw new DatabaseError(
        'PostgreSQL client is not connected',
        'NOT_CONNECTED',
      );
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a PostgreSQL database client.
 */
export function createPostgresClient(config: DBConfig): PostgresClient {
  return new PostgresClient(config);
}
