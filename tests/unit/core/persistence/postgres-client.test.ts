/**
 * PostgresClient Unit Tests
 */

const mockPoolQuery = jest.fn();
const mockPoolEnd = jest.fn().mockResolvedValue(undefined);
const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockPoolConnect = jest.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockClientRelease,
});

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
    end: mockPoolEnd,
    connect: mockPoolConnect,
  })),
}));

jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import {
  PostgresClient,
  createPostgresClient,
} from '../../../../src/core/persistence/postgres-client';
import { DatabaseError } from '../../../../src/core/persistence/sqlite-client';

describe('PostgresClient', () => {
  let client: PostgresClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    client = new PostgresClient({
      engine: 'postgres',
      connectionString: 'postgresql://localhost:5432/test',
    });
  });

  // ==========================================================================
  // Connection lifecycle
  // ==========================================================================

  describe('connection lifecycle', () => {
    it('should connect with pool and verify', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      // Pool.connect() called to verify, then released
      expect(mockPoolConnect).toHaveBeenCalled();
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should be idempotent on connect', async () => {
      await client.connect();
      await client.connect();
      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledTimes(1);
    });

    it('should disconnect and end pool', async () => {
      await client.connect();
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(mockPoolEnd).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await client.disconnect();
      expect(mockPoolEnd).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on connect failure', async () => {
      mockPoolConnect.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      await expect(client.connect()).rejects.toThrow(DatabaseError);
    });

    it('should configure pool with maxConnections', async () => {
      client = new PostgresClient({
        engine: 'postgres',
        connectionString: 'postgresql://localhost/test',
        maxConnections: 10,
      });
      await client.connect();
      const { Pool } = require('pg');
      expect(Pool).toHaveBeenCalledWith(
        expect.objectContaining({ max: 10 }),
      );
    });
  });

  // ==========================================================================
  // Query
  // ==========================================================================

  describe('query', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should query with params and convert placeholders', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Alice' }],
        rowCount: 1,
      });
      const result = await client.query(
        'SELECT * FROM users WHERE id = ? AND name = ?',
        [1, 'Alice'],
      );
      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = $1 AND name = $2',
        [1, 'Alice'],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rowCount).toBe(1);
    });

    it('should query without params', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await client.query('SELECT * FROM users');
      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM users',
        undefined,
      );
      expect(result.rows).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      mockPoolQuery.mockRejectedValueOnce(
        new Error('relation does not exist'),
      );
      await expect(
        client.query('SELECT * FROM nonexistent'),
      ).rejects.toThrow(DatabaseError);
    });

    it('should throw when not connected', async () => {
      await client.disconnect();
      await expect(client.query('SELECT 1')).rejects.toThrow('not connected');
    });
  });

  // ==========================================================================
  // Execute
  // ==========================================================================

  describe('execute', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should execute with params', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 1 });
      const result = await client.execute(
        'INSERT INTO users (id) VALUES (?)',
        ['u1'],
      );
      expect(mockPoolQuery).toHaveBeenCalledWith(
        'INSERT INTO users (id) VALUES ($1)',
        ['u1'],
      );
      expect(result.rowCount).toBe(1);
    });

    it('should execute DDL', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const result = await client.execute('CREATE TABLE test (id TEXT)');
      expect(result.rowCount).toBe(0);
    });

    it('should extract lastInsertId from RETURNING', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 42 }],
        rowCount: 1,
      });
      const result = await client.execute(
        'INSERT INTO users (name) VALUES (?) RETURNING id',
        ['Alice'],
      );
      expect(result.lastInsertId).toBe(42);
    });
  });

  // ==========================================================================
  // Transaction
  // ==========================================================================

  describe('transaction', () => {
    beforeEach(async () => {
      await client.connect();
      mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('should commit on success', async () => {
      const result = await client.transaction(async (tx) => {
        await tx.execute('INSERT INTO test (id) VALUES (?)', ['1']);
        return 'ok';
      });
      expect(result).toBe('ok');
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      await expect(
        client.transaction(async () => {
          throw new Error('fail');
        }),
      ).rejects.toThrow('fail');
      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should support nested savepoints', async () => {
      const result = await client.transaction(async (tx) => {
        return tx.transaction(async (innerTx) => {
          await innerTx.execute('INSERT INTO test (id) VALUES (?)', ['1']);
          return 'nested-ok';
        });
      });
      expect(result).toBe('nested-ok');
      expect(mockClientQuery).toHaveBeenCalledWith('SAVEPOINT nested');
      expect(mockClientQuery).toHaveBeenCalledWith('RELEASE SAVEPOINT nested');
    });
  });

  // ==========================================================================
  // Health Check
  // ==========================================================================

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      await client.connect();
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      expect(await client.healthCheck()).toBe(true);
    });

    it('should return false when not connected', async () => {
      expect(await client.healthCheck()).toBe(false);
    });

    it('should return false on error', async () => {
      await client.connect();
      mockPoolQuery.mockRejectedValueOnce(new Error('connection lost'));
      expect(await client.healthCheck()).toBe(false);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createPostgresClient', () => {
    it('should create a PostgresClient instance', () => {
      const c = createPostgresClient({
        engine: 'postgres',
        connectionString: 'postgresql://localhost/test',
      });
      expect(c).toBeInstanceOf(PostgresClient);
      expect(c.isConnected()).toBe(false);
    });
  });
});
