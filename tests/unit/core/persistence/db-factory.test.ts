/**
 * DB Factory Unit Tests
 */

jest.mock('../../../../src/core/persistence/sqlite-client', () => ({
  SQLiteClient: jest.fn().mockImplementation(() => ({ _type: 'sqlite' })),
  DatabaseError: jest.fn(),
}));
jest.mock('../../../../src/core/persistence/postgres-client', () => ({
  PostgresClient: jest.fn().mockImplementation(() => ({ _type: 'postgres' })),
}));
jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import { createDBClient } from '../../../../src/core/persistence/db-factory';
import { InMemoryDBClient } from '../../../../src/core/persistence/db-client';

describe('createDBClient', () => {
  it('should create SQLiteClient for sqlite engine', () => {
    const client = createDBClient({
      engine: 'sqlite',
      filePath: '/tmp/test.db',
    });
    expect((client as any)._type).toBe('sqlite');
  });

  it('should create PostgresClient for postgres engine', () => {
    const client = createDBClient({
      engine: 'postgres',
      connectionString: 'postgresql://localhost/test',
    });
    expect((client as any)._type).toBe('postgres');
  });

  it('should create InMemoryDBClient for memory engine', () => {
    const client = createDBClient({ engine: 'memory' });
    expect(client).toBeInstanceOf(InMemoryDBClient);
  });

  it('should default to InMemoryDBClient for unknown engine', () => {
    const client = createDBClient({ engine: 'memory' as any });
    expect(client).toBeInstanceOf(InMemoryDBClient);
  });
});
