/**
 * Database Client Abstraction Layer
 *
 * Defines a driver-agnostic interface for database operations.
 * Actual drivers (better-sqlite3, pg) are injected at runtime;
 * this module ships an InMemoryDBClient for testing and as a
 * reference implementation.
 *
 * @module core/persistence/db-client
 */

import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('db-client');

// ============================================================================
// Configuration
// ============================================================================

/**
 * Database engine configuration.
 */
export interface DBConfig {
  /** Database engine to use */
  engine: 'sqlite' | 'postgres';
  /** Connection string for postgres */
  connectionString?: string;
  /** File path for sqlite database */
  filePath?: string;
  /** Maximum connection pool size (default: 5 for postgres) */
  maxConnections?: number;
  /** Enable WAL journal mode (default: true for sqlite) */
  enableWAL?: boolean;
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Result of a database query or execution.
 */
export interface QueryResult {
  /** Rows returned by the query */
  rows: Record<string, unknown>[];
  /** Number of rows affected or returned */
  rowCount: number;
  /** Last inserted row ID (for INSERT operations) */
  lastInsertId?: number;
}

/**
 * Database client interface.
 *
 * All persistence operations go through this interface, allowing
 * the actual driver to be swapped without changing consumer code.
 */
export interface IDBClient {
  /** Establish the database connection */
  connect(): Promise<void>;
  /** Close the database connection */
  disconnect(): Promise<void>;
  /** Execute a read query and return rows */
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  /** Execute a write statement (INSERT/UPDATE/DELETE) */
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  /** Run a set of operations inside a transaction */
  transaction<T>(fn: (client: IDBClient) => Promise<T>): Promise<T>;
  /** Check whether the client is currently connected */
  isConnected(): boolean;
}

// ============================================================================
// In-Memory Implementation
// ============================================================================

type Row = Record<string, unknown>;

/**
 * In-memory database client for testing and development.
 *
 * Provides a lightweight SQL-like interface backed by plain Maps.
 * Supports a subset of SQL sufficient for the persistence layer:
 * CREATE TABLE, INSERT, SELECT, UPDATE, DELETE, and COUNT.
 */
export class InMemoryDBClient implements IDBClient {
  private tables: Map<string, Row[]> = new Map();
  private connected = false;
  private nextInsertId = 1;

  async connect(): Promise<void> {
    this.connected = true;
    logger.debug('InMemoryDBClient connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.debug('InMemoryDBClient disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.assertConnected();
    return this.executeSql(sql, params);
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.assertConnected();
    return this.executeSql(sql, params);
  }

  async transaction<T>(fn: (client: IDBClient) => Promise<T>): Promise<T> {
    this.assertConnected();

    // Snapshot current state for rollback
    const snapshot = new Map<string, Row[]>();
    for (const [table, rows] of this.tables) {
      snapshot.set(table, rows.map((r) => ({ ...r })));
    }
    const snapshotInsertId = this.nextInsertId;

    try {
      const result = await fn(this);
      return result;
    } catch (error) {
      // Rollback to snapshot
      this.tables = snapshot;
      this.nextInsertId = snapshotInsertId;
      throw error;
    }
  }

  // --------------------------------------------------------------------------
  // SQL Dispatch
  // --------------------------------------------------------------------------

  private executeSql(sql: string, params?: unknown[]): QueryResult {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('CREATE TABLE')) {
      return this.handleCreateTable(trimmed);
    }
    if (upper.startsWith('INSERT INTO')) {
      return this.handleInsert(trimmed, params);
    }
    if (upper.startsWith('SELECT')) {
      return this.handleSelect(trimmed, params);
    }
    if (upper.startsWith('UPDATE')) {
      return this.handleUpdate(trimmed, params);
    }
    if (upper.startsWith('DELETE')) {
      return this.handleDelete(trimmed, params);
    }

    throw new Error(`Unsupported SQL statement: ${trimmed.slice(0, 60)}`);
  }

  // --------------------------------------------------------------------------
  // CREATE TABLE
  // --------------------------------------------------------------------------

  private handleCreateTable(sql: string): QueryResult {
    // CREATE TABLE IF NOT EXISTS <name> (...)
    const match = sql.match(
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(/i,
    );
    if (!match) throw new Error(`Invalid CREATE TABLE: ${sql}`);

    const tableName = match[1];
    if (!this.tables.has(tableName)) {
      this.tables.set(tableName, []);
    }
    return { rows: [], rowCount: 0 };
  }

  // --------------------------------------------------------------------------
  // INSERT
  // --------------------------------------------------------------------------

  private handleInsert(sql: string, params?: unknown[]): QueryResult {
    // INSERT INTO <table> (col1, col2, ...) VALUES (?, ?, ...)
    const match = sql.match(
      /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i,
    );
    if (!match) throw new Error(`Invalid INSERT: ${sql}`);

    const tableName = match[1];
    const columns = match[2].split(',').map((c) => c.trim());
    const table = this.getTable(tableName);

    const row: Row = {};
    const resolvedParams = params ?? [];
    let paramIdx = 0;

    const valuePlaceholders = match[3].split(',').map((v) => v.trim());
    for (let i = 0; i < columns.length; i++) {
      const placeholder = valuePlaceholders[i];
      if (placeholder === '?') {
        row[columns[i]] = resolvedParams[paramIdx++];
      } else {
        // Literal value — strip quotes
        row[columns[i]] = this.parseLiteral(placeholder);
      }
    }

    table.push(row);
    const insertId = this.nextInsertId++;
    return { rows: [], rowCount: 1, lastInsertId: insertId };
  }

  // --------------------------------------------------------------------------
  // SELECT
  // --------------------------------------------------------------------------

  private handleSelect(sql: string, params?: unknown[]): QueryResult {
    // SELECT COUNT(*) FROM <table> [WHERE ...]
    const countMatch = sql.match(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+(?:AS\s+\w+\s+)?FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i,
    );
    if (countMatch) {
      const tableName = countMatch[1];
      const table = this.getTable(tableName);
      const whereClause = countMatch[2];
      const filtered = whereClause
        ? this.applyWhere(table, whereClause, params)
        : table;
      return {
        rows: [{ 'COUNT(*)': filtered.length }],
        rowCount: 1,
      };
    }

    // SELECT <cols> FROM <table> [WHERE ...] [ORDER BY ...] [LIMIT ...]
    const selectMatch = sql.match(
      /SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i,
    );
    if (!selectMatch) throw new Error(`Invalid SELECT: ${sql}`);

    // selectMatch[1] = columns (unused — we return all fields)
    const tableName = selectMatch[2];
    const whereClause = selectMatch[3];
    // selectMatch[4] = ORDER BY clause (not implemented for in-memory)
    const limit = selectMatch[5] ? parseInt(selectMatch[5], 10) : undefined;

    const table = this.getTable(tableName);
    let rows = whereClause
      ? this.applyWhere(table, whereClause, params)
      : [...table];

    if (limit !== undefined) {
      rows = rows.slice(0, limit);
    }

    return { rows: rows.map((r) => ({ ...r })), rowCount: rows.length };
  }

  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------

  private handleUpdate(sql: string, params?: unknown[]): QueryResult {
    // UPDATE <table> SET col1=?, col2=? WHERE ...
    const match = sql.match(
      /UPDATE\s+(\w+)\s+SET\s+(.+?)\s+WHERE\s+(.+)/i,
    );
    if (!match) throw new Error(`Invalid UPDATE: ${sql}`);

    const tableName = match[1];
    const setPart = match[2];
    const whereClause = match[3];

    const table = this.getTable(tableName);
    const setClauses = setPart.split(',').map((s) => s.trim());

    // Count SET placeholders to determine where WHERE params start
    let setParamCount = 0;
    for (const clause of setClauses) {
      const eqParts = clause.match(/(\w+)\s*=\s*(.+)/);
      if (eqParts && eqParts[2].trim() === '?') {
        setParamCount++;
      }
    }

    const resolvedParams = params ?? [];
    const whereParams = resolvedParams.slice(setParamCount);
    const matching = this.applyWhere(table, whereClause, whereParams);

    let paramIdx = 0;
    for (const row of matching) {
      for (const clause of setClauses) {
        const eqMatch = clause.match(/(\w+)\s*=\s*(.+)/);
        if (!eqMatch) continue;
        const col = eqMatch[1].trim();
        const val = eqMatch[2].trim();
        if (val === '?') {
          row[col] = resolvedParams[paramIdx++];
        } else {
          row[col] = this.parseLiteral(val);
        }
      }
    }

    return { rows: [], rowCount: matching.length };
  }

  // --------------------------------------------------------------------------
  // DELETE
  // --------------------------------------------------------------------------

  private handleDelete(sql: string, params?: unknown[]): QueryResult {
    // DELETE FROM <table> WHERE ...
    const match = sql.match(
      /DELETE\s+FROM\s+(\w+)\s+WHERE\s+(.+)/i,
    );
    if (!match) throw new Error(`Invalid DELETE: ${sql}`);

    const tableName = match[1];
    const whereClause = match[2];

    const table = this.getTable(tableName);
    const toRemove = new Set(this.applyWhere(table, whereClause, params));
    const remaining = table.filter((r) => !toRemove.has(r));
    const removedCount = table.length - remaining.length;

    this.tables.set(tableName, remaining);
    return { rows: [], rowCount: removedCount };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private assertConnected(): void {
    if (!this.connected) {
      throw new Error('Database client is not connected');
    }
  }

  private getTable(name: string): Row[] {
    const table = this.tables.get(name);
    if (!table) {
      throw new Error(`Table "${name}" does not exist`);
    }
    return table;
  }

  private applyWhere(
    rows: Row[],
    whereClause: string,
    params?: unknown[],
  ): Row[] {
    // Support AND-separated equality conditions: col1 = ? AND col2 = ?
    const rawConditions = whereClause.split(/\s+AND\s+/i).map((c) => c.trim());
    const resolvedParams = params ?? [];
    let paramIdx = 0;

    // Resolve conditions once: extract column names and expected values
    const resolved: Array<{ col: string; expected: unknown }> = [];
    for (const cond of rawConditions) {
      const condMatch = cond.match(/(\w+)\s*=\s*(.+)/);
      if (!condMatch) continue;
      const col = condMatch[1].trim();
      const val = condMatch[2].trim();

      let expected: unknown;
      if (val === '?') {
        expected = resolvedParams[paramIdx++];
      } else {
        expected = this.parseLiteral(val);
      }
      resolved.push({ col, expected });
    }

    return rows.filter((row) => {
      return resolved.every(({ col, expected }) => row[col] === expected);
    });
  }

  private parseLiteral(val: string): unknown {
    // String literal
    if (
      (val.startsWith("'") && val.endsWith("'")) ||
      (val.startsWith('"') && val.endsWith('"'))
    ) {
      return val.slice(1, -1);
    }
    // Numeric literal
    const num = Number(val);
    if (!isNaN(num)) {
      return num;
    }
    // NULL
    if (val.toUpperCase() === 'NULL') {
      return null;
    }
    return val;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an in-memory database client for testing and development.
 */
export function createInMemoryDBClient(): InMemoryDBClient {
  return new InMemoryDBClient();
}
