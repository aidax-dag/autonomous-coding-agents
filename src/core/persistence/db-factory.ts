/**
 * Database Client Factory
 *
 * Creates the appropriate IDBClient based on engine configuration.
 * Falls back to InMemoryDBClient when a driver is unavailable.
 *
 * @module core/persistence/db-factory
 */

import type { IDBClient, DBConfig } from './db-client';
import { InMemoryDBClient } from './db-client';
import { SQLiteClient } from './sqlite-client';
import { PostgresClient } from './postgres-client';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('db-factory');

export type DBEngine = 'sqlite' | 'postgres' | 'memory';

export interface DBFactoryConfig extends Omit<DBConfig, 'engine'> {
  engine: DBEngine;
}

/**
 * Create a database client based on engine configuration.
 *
 * @param config - Engine type and connection parameters.
 * @returns An IDBClient implementation for the requested engine.
 */
export function createDBClient(config: DBFactoryConfig): IDBClient {
  switch (config.engine) {
    case 'sqlite':
      logger.info('Creating SQLite client');
      return new SQLiteClient(config as DBConfig);
    case 'postgres':
      logger.info('Creating PostgreSQL client');
      return new PostgresClient(config as DBConfig);
    case 'memory':
    default:
      logger.info('Creating InMemory client');
      return new InMemoryDBClient();
  }
}
