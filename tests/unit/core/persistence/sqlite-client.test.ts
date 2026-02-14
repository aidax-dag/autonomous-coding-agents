/**
 * SQLiteClient Unit Tests
 */

const mockPragma = jest.fn();
const mockPrepare = jest.fn();
const mockClose = jest.fn();

const mockStatement = {
  all: jest.fn().mockReturnValue([]),
  run: jest.fn().mockReturnValue({ changes: 0, lastInsertRowid: BigInt(0) }),
  get: jest.fn().mockReturnValue({ '1': 1 }),
};
mockPrepare.mockReturnValue(mockStatement);

const MockDatabase = jest.fn().mockImplementation(() => ({
  pragma: mockPragma,
  prepare: mockPrepare,
  close: mockClose,
  transaction: jest.fn((fn: Function) => fn),
}));

jest.mock('better-sqlite3', () => {
  const mod = { default: MockDatabase, __esModule: true };
  return mod;
}, { virtual: true });
jest.mock('../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

import {
  SQLiteClient,
  createSQLiteClient,
  DatabaseError,
} from '../../../../src/core/persistence/sqlite-client';

describe('SQLiteClient', () => {
  let client: SQLiteClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrepare.mockReturnValue(mockStatement);
    client = new SQLiteClient({ engine: 'sqlite', filePath: '/tmp/test.db' });
  });

  // ==========================================================================
  // Connection lifecycle
  // ==========================================================================

  describe('connection lifecycle', () => {
    it('should connect with WAL mode by default', async () => {
      await client.connect();
      expect(client.isConnected()).toBe(true);
      expect(MockDatabase).toHaveBeenCalledWith('/tmp/test.db');
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('should skip WAL mode when disabled', async () => {
      client = new SQLiteClient({
        engine: 'sqlite',
        filePath: '/tmp/test.db',
        enableWAL: false,
      });
      await client.connect();
      expect(mockPragma).not.toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('should use :memory: when no filePath', async () => {
      client = new SQLiteClient({ engine: 'sqlite' });
      await client.connect();
      expect(MockDatabase).toHaveBeenCalledWith(':memory:');
    });

    it('should be idempotent on connect', async () => {
      await client.connect();
      await client.connect();
      expect(MockDatabase).toHaveBeenCalledTimes(1);
    });

    it('should disconnect and close the database', async () => {
      await client.connect();
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
      expect(mockClose).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', async () => {
      await client.disconnect();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('should throw DatabaseError on connect failure', async () => {
      MockDatabase.mockImplementationOnce(() => {
        throw new Error('SQLITE_CANTOPEN');
      });
      const freshClient = new SQLiteClient({ engine: 'sqlite', filePath: '/bad/path.db' });
      await expect(freshClient.connect()).rejects.toThrow('Failed to connect');
    });
  });

  // ==========================================================================
  // Query
  // ==========================================================================

  describe('query', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should query with params', async () => {
      mockStatement.all.mockReturnValueOnce([{ id: '1', name: 'Alice' }]);
      const result = await client.query('SELECT * FROM users WHERE id = ?', [
        '1',
      ]);
      expect(mockPrepare).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
      );
      expect(mockStatement.all).toHaveBeenCalledWith('1');
      expect(result.rows).toHaveLength(1);
      expect(result.rowCount).toBe(1);
    });

    it('should query without params', async () => {
      mockStatement.all.mockReturnValueOnce([]);
      const result = await client.query('SELECT * FROM users');
      expect(mockStatement.all).toHaveBeenCalledWith();
      expect(result.rows).toEqual([]);
    });

    it('should throw DatabaseError on query failure', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('syntax error');
      });
      await expect(client.query('INVALID SQL')).rejects.toThrow(DatabaseError);
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

    it('should execute with params and return rowCount', async () => {
      mockStatement.run.mockReturnValueOnce({
        changes: 1,
        lastInsertRowid: BigInt(5),
      });
      const result = await client.execute(
        'INSERT INTO users (id, name) VALUES (?, ?)',
        ['1', 'Alice'],
      );
      expect(result.rowCount).toBe(1);
      expect(result.lastInsertId).toBe(5);
    });

    it('should execute without params', async () => {
      mockStatement.run.mockReturnValueOnce({
        changes: 0,
        lastInsertRowid: BigInt(0),
      });
      const result = await client.execute(
        'CREATE TABLE test (id TEXT PRIMARY KEY)',
      );
      expect(result.rowCount).toBe(0);
    });

    it('should throw DatabaseError on execute failure', async () => {
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('table does not exist');
      });
      await expect(
        client.execute('INSERT INTO bad (id) VALUES (?)', ['1']),
      ).rejects.toThrow(DatabaseError);
    });
  });

  // ==========================================================================
  // Transaction
  // ==========================================================================

  describe('transaction', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should execute transaction and return result', async () => {
      mockStatement.run.mockReturnValue({
        changes: 0,
        lastInsertRowid: BigInt(0),
      });
      const result = await client.transaction(async (tx) => {
        await tx.execute('INSERT INTO test (id) VALUES (?)', ['1']);
        return 'done';
      });
      expect(result).toBe('done');
    });

    it('should rollback on error', async () => {
      mockStatement.run.mockReturnValue({
        changes: 0,
        lastInsertRowid: BigInt(0),
      });
      await expect(
        client.transaction(async () => {
          throw new Error('abort');
        }),
      ).rejects.toThrow('abort');
      // ROLLBACK was called via prepare('ROLLBACK').run()
      expect(mockPrepare).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  // ==========================================================================
  // Health Check
  // ==========================================================================

  describe('healthCheck', () => {
    it('should return true when healthy', async () => {
      await client.connect();
      expect(client.healthCheck()).toBe(true);
    });

    it('should return false when not connected', () => {
      expect(client.healthCheck()).toBe(false);
    });

    it('should return false on error', async () => {
      await client.connect();
      mockPrepare.mockImplementationOnce(() => {
        throw new Error('db locked');
      });
      expect(client.healthCheck()).toBe(false);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createSQLiteClient', () => {
    it('should create a SQLiteClient instance', () => {
      const c = createSQLiteClient({
        engine: 'sqlite',
        filePath: '/tmp/test.db',
      });
      expect(c).toBeInstanceOf(SQLiteClient);
      expect(c.isConnected()).toBe(false);
    });
  });

  // ==========================================================================
  // DatabaseError
  // ==========================================================================

  describe('DatabaseError', () => {
    it('should carry code and cause', () => {
      const cause = new Error('original');
      const err = new DatabaseError('wrapped', 'TEST_CODE', cause);
      expect(err.name).toBe('DatabaseError');
      expect(err.code).toBe('TEST_CODE');
      expect(err.cause).toBe(cause);
      expect(err.message).toBe('wrapped');
    });
  });
});
