/**
 * Generic Persistence Adapter
 *
 * Typed CRUD operations over any IDBClient implementation.
 * Maps domain entities to database rows using a column list,
 * providing create/read/update/delete/list/count semantics.
 *
 * @module core/persistence/persistence-adapter
 */

import type { IDBClient, QueryResult } from './db-client';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('persistence-adapter');

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Generic CRUD persistence interface for entities with a string `id`.
 */
export interface PersistenceAdapter<T extends { id: string }> {
  /** Create a new record and return it */
  create(data: T): Promise<T>;
  /** Retrieve a record by its ID, or null if not found */
  get(id: string): Promise<T | null>;
  /** Update fields of a record by ID; returns updated record or null */
  update(id: string, data: Partial<T>): Promise<T | null>;
  /** Delete a record by ID; returns true if removed */
  delete(id: string): Promise<boolean>;
  /** List records, optionally filtered by field equality */
  list(filter?: Record<string, unknown>): Promise<T[]>;
  /** Count records, optionally filtered by field equality */
  count(filter?: Record<string, unknown>): Promise<number>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Generic CRUD adapter backed by an IDBClient.
 *
 * Translates typed entity operations into parameterized SQL.
 * The entity type must have a string `id` field used as primary key.
 */
export class GenericPersistenceAdapter<T extends { id: string }>
  implements PersistenceAdapter<T>
{
  private readonly client: IDBClient;
  private readonly tableName: string;
  private readonly columns: string[];

  constructor(client: IDBClient, tableName: string, columns: string[]) {
    this.client = client;
    this.tableName = tableName;
    this.columns = columns;
  }

  /**
   * Insert a new entity. All configured columns are persisted.
   */
  async create(data: T): Promise<T> {
    const placeholders = this.columns.map(() => '?').join(', ');
    const values = this.columns.map((col) =>
      (data as Record<string, unknown>)[col],
    );

    const sql = `INSERT INTO ${this.tableName} (${this.columns.join(', ')}) VALUES (${placeholders})`;

    logger.debug(`Creating record in ${this.tableName}`, { id: data.id });
    await this.client.execute(sql, values);
    return data;
  }

  /**
   * Fetch a single entity by ID.
   */
  async get(id: string): Promise<T | null> {
    const sql = `SELECT ${this.columns.join(', ')} FROM ${this.tableName} WHERE id = ?`;
    const result = await this.client.query(sql, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToEntity(result.rows[0]);
  }

  /**
   * Update specific fields of an entity identified by ID.
   *
   * Only columns present in both `data` and the configured column list
   * are updated. Returns the updated entity, or null if the ID was
   * not found.
   */
  async update(id: string, data: Partial<T>): Promise<T | null> {
    // Check existence first
    const existing = await this.get(id);
    if (!existing) {
      return null;
    }

    const updatableKeys = Object.keys(data).filter(
      (k) => this.columns.includes(k) && k !== 'id',
    );

    if (updatableKeys.length === 0) {
      return existing;
    }

    const setClauses = updatableKeys.map((k) => `${k} = ?`).join(', ');
    const values = updatableKeys.map(
      (k) => (data as Record<string, unknown>)[k],
    );
    values.push(id);

    const sql = `UPDATE ${this.tableName} SET ${setClauses} WHERE id = ?`;

    logger.debug(`Updating record in ${this.tableName}`, { id });
    await this.client.execute(sql, values);

    // Return the merged entity
    return this.get(id);
  }

  /**
   * Delete an entity by ID. Returns true if a record was removed.
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.get(id);
    if (!existing) {
      return false;
    }

    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.client.execute(sql, [id]);
    return true;
  }

  /**
   * List entities matching an optional filter.
   *
   * Filter keys must be valid column names; values are matched with
   * strict equality.
   */
  async list(filter?: Record<string, unknown>): Promise<T[]> {
    const result = await this.buildFilteredQuery(filter);
    return result.rows.map((r) => this.rowToEntity(r));
  }

  /**
   * Count entities matching an optional filter.
   */
  async count(filter?: Record<string, unknown>): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      const sql = `SELECT COUNT(*) FROM ${this.tableName}`;
      const result = await this.client.query(sql);
      return (result.rows[0]?.['COUNT(*)'] as number) ?? 0;
    }

    const filterKeys = Object.keys(filter).filter((k) =>
      this.columns.includes(k),
    );
    const whereClauses = filterKeys.map((k) => `${k} = ?`).join(' AND ');
    const values = filterKeys.map((k) => filter[k]);

    const sql = `SELECT COUNT(*) FROM ${this.tableName} WHERE ${whereClauses}`;
    const result = await this.client.query(sql, values);
    return (result.rows[0]?.['COUNT(*)'] as number) ?? 0;
  }

  // --------------------------------------------------------------------------
  // Internal Helpers
  // --------------------------------------------------------------------------

  private async buildFilteredQuery(
    filter?: Record<string, unknown>,
  ): Promise<QueryResult> {
    if (!filter || Object.keys(filter).length === 0) {
      const sql = `SELECT ${this.columns.join(', ')} FROM ${this.tableName}`;
      return this.client.query(sql);
    }

    const filterKeys = Object.keys(filter).filter((k) =>
      this.columns.includes(k),
    );
    const whereClauses = filterKeys.map((k) => `${k} = ?`).join(' AND ');
    const values = filterKeys.map((k) => filter[k]);

    const sql = `SELECT ${this.columns.join(', ')} FROM ${this.tableName} WHERE ${whereClauses}`;
    return this.client.query(sql, values);
  }

  private rowToEntity(row: Record<string, unknown>): T {
    // Return only configured columns to avoid leaking internal fields
    const entity: Record<string, unknown> = {};
    for (const col of this.columns) {
      entity[col] = row[col];
    }
    return entity as T;
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a GenericPersistenceAdapter for the given table.
 */
export function createPersistenceAdapter<T extends { id: string }>(
  client: IDBClient,
  tableName: string,
  columns: string[],
): GenericPersistenceAdapter<T> {
  return new GenericPersistenceAdapter<T>(client, tableName, columns);
}
