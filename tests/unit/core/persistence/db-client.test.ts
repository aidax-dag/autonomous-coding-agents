/**
 * InMemoryDBClient Unit Tests
 */

import {
  InMemoryDBClient,
  createInMemoryDBClient,
} from '../../../../src/core/persistence/db-client';

describe('InMemoryDBClient', () => {
  let client: InMemoryDBClient;

  beforeEach(async () => {
    client = createInMemoryDBClient();
    await client.connect();
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  // ==========================================================================
  // Connection lifecycle
  // ==========================================================================

  describe('connection lifecycle', () => {
    it('should report connected after connect()', () => {
      expect(client.isConnected()).toBe(true);
    });

    it('should report disconnected after disconnect()', async () => {
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('should throw on query when disconnected', async () => {
      await client.disconnect();
      await expect(
        client.query('SELECT * FROM test'),
      ).rejects.toThrow('not connected');
    });

    it('should throw on execute when disconnected', async () => {
      await client.disconnect();
      await expect(
        client.execute('INSERT INTO test (id) VALUES (?)', ['1']),
      ).rejects.toThrow('not connected');
    });
  });

  // ==========================================================================
  // CREATE TABLE
  // ==========================================================================

  describe('CREATE TABLE', () => {
    it('should create a table', async () => {
      await client.execute(
        'CREATE TABLE users (id TEXT, name TEXT, age INTEGER)',
      );
      // Table exists — querying should not throw
      const result = await client.query('SELECT * FROM users');
      expect(result.rows).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it('should support IF NOT EXISTS', async () => {
      await client.execute(
        'CREATE TABLE IF NOT EXISTS items (id TEXT, title TEXT)',
      );
      await client.execute(
        'CREATE TABLE IF NOT EXISTS items (id TEXT, title TEXT)',
      );
      // No error on second call
      const result = await client.query('SELECT * FROM items');
      expect(result.rows).toEqual([]);
    });

    it('should throw on invalid CREATE TABLE syntax', async () => {
      await expect(
        client.execute('CREATE TABLE'),
      ).rejects.toThrow('Invalid CREATE TABLE');
    });
  });

  // ==========================================================================
  // INSERT
  // ==========================================================================

  describe('INSERT', () => {
    beforeEach(async () => {
      await client.execute(
        'CREATE TABLE users (id TEXT, name TEXT, age INTEGER)',
      );
    });

    it('should insert a row with params', async () => {
      const result = await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u1', 'Alice', 30],
      );
      expect(result.rowCount).toBe(1);
      expect(result.lastInsertId).toBeDefined();
    });

    it('should insert a row with literal values', async () => {
      await client.execute(
        "INSERT INTO users (id, name, age) VALUES ('u2', 'Bob', 25)",
      );
      const result = await client.query('SELECT * FROM users WHERE id = ?', [
        'u2',
      ]);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Bob');
    });

    it('should insert multiple rows', async () => {
      await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u1', 'Alice', 30],
      );
      await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u2', 'Bob', 25],
      );
      const result = await client.query('SELECT * FROM users');
      expect(result.rows).toHaveLength(2);
    });

    it('should throw on non-existent table', async () => {
      await expect(
        client.execute(
          'INSERT INTO nonexistent (id) VALUES (?)',
          ['1'],
        ),
      ).rejects.toThrow('does not exist');
    });

    it('should return incrementing lastInsertId', async () => {
      const r1 = await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u1', 'Alice', 30],
      );
      const r2 = await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u2', 'Bob', 25],
      );
      expect(r2.lastInsertId!).toBeGreaterThan(r1.lastInsertId!);
    });
  });

  // ==========================================================================
  // SELECT
  // ==========================================================================

  describe('SELECT', () => {
    beforeEach(async () => {
      await client.execute(
        'CREATE TABLE users (id TEXT, name TEXT, age INTEGER)',
      );
      await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u1', 'Alice', 30],
      );
      await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u2', 'Bob', 25],
      );
      await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u3', 'Charlie', 30],
      );
    });

    it('should select all rows', async () => {
      const result = await client.query('SELECT * FROM users');
      expect(result.rows).toHaveLength(3);
      expect(result.rowCount).toBe(3);
    });

    it('should filter with WHERE clause using params', async () => {
      const result = await client.query(
        'SELECT * FROM users WHERE id = ?',
        ['u2'],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('Bob');
    });

    it('should filter with multiple WHERE conditions (AND)', async () => {
      const result = await client.query(
        'SELECT * FROM users WHERE age = ? AND name = ?',
        [30, 'Alice'],
      );
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe('u1');
    });

    it('should return empty when no rows match', async () => {
      const result = await client.query(
        'SELECT * FROM users WHERE id = ?',
        ['nonexistent'],
      );
      expect(result.rows).toHaveLength(0);
      expect(result.rowCount).toBe(0);
    });

    it('should return copies of rows (no mutation)', async () => {
      const r1 = await client.query('SELECT * FROM users WHERE id = ?', ['u1']);
      r1.rows[0].name = 'MODIFIED';

      const r2 = await client.query('SELECT * FROM users WHERE id = ?', ['u1']);
      expect(r2.rows[0].name).toBe('Alice');
    });
  });

  // ==========================================================================
  // COUNT
  // ==========================================================================

  describe('COUNT', () => {
    beforeEach(async () => {
      await client.execute(
        'CREATE TABLE items (id TEXT, status TEXT)',
      );
      await client.execute(
        'INSERT INTO items (id, status) VALUES (?, ?)',
        ['i1', 'active'],
      );
      await client.execute(
        'INSERT INTO items (id, status) VALUES (?, ?)',
        ['i2', 'inactive'],
      );
      await client.execute(
        'INSERT INTO items (id, status) VALUES (?, ?)',
        ['i3', 'active'],
      );
    });

    it('should count all rows', async () => {
      const result = await client.query('SELECT COUNT(*) FROM items');
      expect(result.rows[0]['COUNT(*)']).toBe(3);
    });

    it('should count with WHERE clause', async () => {
      const result = await client.query(
        'SELECT COUNT(*) FROM items WHERE status = ?',
        ['active'],
      );
      expect(result.rows[0]['COUNT(*)']).toBe(2);
    });

    it('should return 0 for empty table', async () => {
      await client.execute('CREATE TABLE empty_table (id TEXT)');
      const result = await client.query('SELECT COUNT(*) FROM empty_table');
      expect(result.rows[0]['COUNT(*)']).toBe(0);
    });
  });

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  describe('UPDATE', () => {
    beforeEach(async () => {
      await client.execute(
        'CREATE TABLE users (id TEXT, name TEXT, age INTEGER)',
      );
      await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u1', 'Alice', 30],
      );
      await client.execute(
        'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
        ['u2', 'Bob', 25],
      );
    });

    it('should update a single row', async () => {
      const result = await client.execute(
        'UPDATE users SET name = ? WHERE id = ?',
        ['Alicia', 'u1'],
      );
      expect(result.rowCount).toBe(1);

      const check = await client.query(
        'SELECT * FROM users WHERE id = ?',
        ['u1'],
      );
      expect(check.rows[0].name).toBe('Alicia');
    });

    it('should update multiple columns', async () => {
      await client.execute(
        'UPDATE users SET name = ?, age = ? WHERE id = ?',
        ['Alicia', 31, 'u1'],
      );

      const check = await client.query(
        'SELECT * FROM users WHERE id = ?',
        ['u1'],
      );
      expect(check.rows[0].name).toBe('Alicia');
      expect(check.rows[0].age).toBe(31);
    });

    it('should return 0 rowCount when no rows match', async () => {
      const result = await client.execute(
        'UPDATE users SET name = ? WHERE id = ?',
        ['Ghost', 'nonexistent'],
      );
      expect(result.rowCount).toBe(0);
    });

    it('should not affect other rows', async () => {
      await client.execute(
        'UPDATE users SET name = ? WHERE id = ?',
        ['Alicia', 'u1'],
      );
      const bob = await client.query(
        'SELECT * FROM users WHERE id = ?',
        ['u2'],
      );
      expect(bob.rows[0].name).toBe('Bob');
    });
  });

  // ==========================================================================
  // DELETE
  // ==========================================================================

  describe('DELETE', () => {
    beforeEach(async () => {
      await client.execute(
        'CREATE TABLE users (id TEXT, name TEXT)',
      );
      await client.execute(
        'INSERT INTO users (id, name) VALUES (?, ?)',
        ['u1', 'Alice'],
      );
      await client.execute(
        'INSERT INTO users (id, name) VALUES (?, ?)',
        ['u2', 'Bob'],
      );
    });

    it('should delete a matching row', async () => {
      const result = await client.execute(
        'DELETE FROM users WHERE id = ?',
        ['u1'],
      );
      expect(result.rowCount).toBe(1);

      const remaining = await client.query('SELECT * FROM users');
      expect(remaining.rows).toHaveLength(1);
      expect(remaining.rows[0].id).toBe('u2');
    });

    it('should return 0 rowCount when no rows match', async () => {
      const result = await client.execute(
        'DELETE FROM users WHERE id = ?',
        ['nonexistent'],
      );
      expect(result.rowCount).toBe(0);
    });
  });

  // ==========================================================================
  // Transactions
  // ==========================================================================

  describe('transactions', () => {
    beforeEach(async () => {
      await client.execute(
        'CREATE TABLE accounts (id TEXT, balance INTEGER)',
      );
      await client.execute(
        'INSERT INTO accounts (id, balance) VALUES (?, ?)',
        ['a1', 100],
      );
    });

    it('should commit changes on success', async () => {
      await client.transaction(async (tx) => {
        await tx.execute(
          'UPDATE accounts SET balance = ? WHERE id = ?',
          [80, 'a1'],
        );
        await tx.execute(
          'INSERT INTO accounts (id, balance) VALUES (?, ?)',
          ['a2', 20],
        );
      });

      const a1 = await client.query(
        'SELECT * FROM accounts WHERE id = ?',
        ['a1'],
      );
      expect(a1.rows[0].balance).toBe(80);

      const a2 = await client.query(
        'SELECT * FROM accounts WHERE id = ?',
        ['a2'],
      );
      expect(a2.rows).toHaveLength(1);
      expect(a2.rows[0].balance).toBe(20);
    });

    it('should rollback changes on error', async () => {
      await expect(
        client.transaction(async (tx) => {
          await tx.execute(
            'UPDATE accounts SET balance = ? WHERE id = ?',
            [50, 'a1'],
          );
          throw new Error('Transfer failed');
        }),
      ).rejects.toThrow('Transfer failed');

      // Balance should be unchanged
      const a1 = await client.query(
        'SELECT * FROM accounts WHERE id = ?',
        ['a1'],
      );
      expect(a1.rows[0].balance).toBe(100);
    });

    it('should return the transaction result on success', async () => {
      const result = await client.transaction(async (_tx) => {
        return 42;
      });
      expect(result).toBe(42);
    });
  });

  // ==========================================================================
  // Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should throw on unsupported SQL', async () => {
      await expect(
        client.execute('DROP TABLE users'),
      ).rejects.toThrow('Unsupported SQL');
    });

    it('should throw on query to non-existent table', async () => {
      await expect(
        client.query('SELECT * FROM nonexistent'),
      ).rejects.toThrow('does not exist');
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createInMemoryDBClient', () => {
    it('should create a disconnected client', () => {
      const c = createInMemoryDBClient();
      expect(c).toBeInstanceOf(InMemoryDBClient);
      expect(c.isConnected()).toBe(false);
    });
  });
});
