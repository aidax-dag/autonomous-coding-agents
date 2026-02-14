/**
 * Persistence Module
 *
 * Database abstraction layer supporting SQLite and PostgreSQL
 * through a driver-agnostic interface.
 *
 * @module core/persistence
 */

export type { DBConfig, QueryResult, IDBClient } from './db-client';
export { InMemoryDBClient, createInMemoryDBClient } from './db-client';

export type { Migration, MigrationStatus, MigrationRecord } from './migration-engine';
export { MigrationEngine, createMigrationEngine } from './migration-engine';

export type { MigrationRunnerOptions, MigrationRunnerStatus } from './migration-runner';
export { MigrationRunner, createMigrationRunner } from './migration-runner';

export type { PersistenceAdapter } from './persistence-adapter';
export { GenericPersistenceAdapter, createPersistenceAdapter } from './persistence-adapter';

export { DatabaseError, SQLiteClient, createSQLiteClient } from './sqlite-client';
export { PostgresClient, createPostgresClient } from './postgres-client';

export type { DBEngine, DBFactoryConfig } from './db-factory';
export { createDBClient } from './db-factory';
