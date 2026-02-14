/**
 * GenericPersistenceAdapter Unit Tests
 */

import {
  InMemoryDBClient,
  createInMemoryDBClient,
} from '../../../../src/core/persistence/db-client';
import {
  GenericPersistenceAdapter,
  createPersistenceAdapter,
} from '../../../../src/core/persistence/persistence-adapter';

interface TestEntity {
  id: string;
  name: string;
  status: string;
}

const TABLE = 'entities';
const COLUMNS = ['id', 'name', 'status'];

describe('GenericPersistenceAdapter', () => {
  let client: InMemoryDBClient;
  let adapter: GenericPersistenceAdapter<TestEntity>;

  beforeEach(async () => {
    client = createInMemoryDBClient();
    await client.connect();
    await client.execute(
      `CREATE TABLE IF NOT EXISTS ${TABLE} (id TEXT, name TEXT, status TEXT)`,
    );
    adapter = createPersistenceAdapter<TestEntity>(client, TABLE, COLUMNS);
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  // ==========================================================================
  // create + get
  // ==========================================================================

  describe('create and get', () => {
    it('should create a record and retrieve it by ID', async () => {
      const entity: TestEntity = { id: 'e1', name: 'Alpha', status: 'active' };
      const created = await adapter.create(entity);

      expect(created).toEqual(entity);

      const fetched = await adapter.get('e1');
      expect(fetched).toEqual(entity);
    });

    it('should return null for non-existent ID', async () => {
      const result = await adapter.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should create multiple records independently', async () => {
      await adapter.create({ id: 'e1', name: 'Alpha', status: 'active' });
      await adapter.create({ id: 'e2', name: 'Beta', status: 'inactive' });

      const e1 = await adapter.get('e1');
      const e2 = await adapter.get('e2');

      expect(e1?.name).toBe('Alpha');
      expect(e2?.name).toBe('Beta');
    });
  });

  // ==========================================================================
  // update
  // ==========================================================================

  describe('update', () => {
    beforeEach(async () => {
      await adapter.create({ id: 'e1', name: 'Alpha', status: 'active' });
    });

    it('should update an existing record', async () => {
      const updated = await adapter.update('e1', { name: 'Alpha Updated' });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Alpha Updated');
      expect(updated!.status).toBe('active'); // unchanged field preserved
    });

    it('should update multiple fields at once', async () => {
      const updated = await adapter.update('e1', {
        name: 'New Name',
        status: 'inactive',
      });

      expect(updated!.name).toBe('New Name');
      expect(updated!.status).toBe('inactive');
    });

    it('should return null for non-existent ID', async () => {
      const result = await adapter.update('nonexistent', { name: 'Nope' });
      expect(result).toBeNull();
    });

    it('should not affect other records', async () => {
      await adapter.create({ id: 'e2', name: 'Beta', status: 'active' });
      await adapter.update('e1', { name: 'Changed' });

      const e2 = await adapter.get('e2');
      expect(e2!.name).toBe('Beta');
    });

    it('should ignore id field in update data', async () => {
      const updated = await adapter.update('e1', {
        id: 'e999',
        name: 'Modified',
      } as Partial<TestEntity>);

      expect(updated!.id).toBe('e1'); // id unchanged
      expect(updated!.name).toBe('Modified');
    });
  });

  // ==========================================================================
  // delete
  // ==========================================================================

  describe('delete', () => {
    beforeEach(async () => {
      await adapter.create({ id: 'e1', name: 'Alpha', status: 'active' });
      await adapter.create({ id: 'e2', name: 'Beta', status: 'active' });
    });

    it('should delete an existing record', async () => {
      const result = await adapter.delete('e1');
      expect(result).toBe(true);

      const check = await adapter.get('e1');
      expect(check).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const result = await adapter.delete('nonexistent');
      expect(result).toBe(false);
    });

    it('should not affect other records', async () => {
      await adapter.delete('e1');

      const e2 = await adapter.get('e2');
      expect(e2).not.toBeNull();
      expect(e2!.name).toBe('Beta');
    });
  });

  // ==========================================================================
  // list
  // ==========================================================================

  describe('list', () => {
    beforeEach(async () => {
      await adapter.create({ id: 'e1', name: 'Alpha', status: 'active' });
      await adapter.create({ id: 'e2', name: 'Beta', status: 'inactive' });
      await adapter.create({ id: 'e3', name: 'Gamma', status: 'active' });
    });

    it('should list all records without filter', async () => {
      const all = await adapter.list();
      expect(all).toHaveLength(3);
    });

    it('should filter records by a single field', async () => {
      const active = await adapter.list({ status: 'active' });
      expect(active).toHaveLength(2);
      expect(active.every((e) => e.status === 'active')).toBe(true);
    });

    it('should filter records by multiple fields', async () => {
      const result = await adapter.list({ status: 'active', name: 'Alpha' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e1');
    });

    it('should return empty array when no records match', async () => {
      const result = await adapter.list({ status: 'archived' });
      expect(result).toEqual([]);
    });

    it('should return empty array for empty table', async () => {
      // Create a fresh adapter on a new empty table
      await client.execute(
        'CREATE TABLE IF NOT EXISTS empty_tbl (id TEXT, name TEXT, status TEXT)',
      );
      const emptyAdapter = createPersistenceAdapter<TestEntity>(
        client,
        'empty_tbl',
        COLUMNS,
      );
      const result = await emptyAdapter.list();
      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // count
  // ==========================================================================

  describe('count', () => {
    beforeEach(async () => {
      await adapter.create({ id: 'e1', name: 'Alpha', status: 'active' });
      await adapter.create({ id: 'e2', name: 'Beta', status: 'inactive' });
      await adapter.create({ id: 'e3', name: 'Gamma', status: 'active' });
    });

    it('should count all records', async () => {
      const total = await adapter.count();
      expect(total).toBe(3);
    });

    it('should count records matching a filter', async () => {
      const activeCount = await adapter.count({ status: 'active' });
      expect(activeCount).toBe(2);
    });

    it('should return 0 for non-matching filter', async () => {
      const result = await adapter.count({ status: 'archived' });
      expect(result).toBe(0);
    });

    it('should return 0 for empty table', async () => {
      await client.execute(
        'CREATE TABLE IF NOT EXISTS empty_count (id TEXT, name TEXT, status TEXT)',
      );
      const emptyAdapter = createPersistenceAdapter<TestEntity>(
        client,
        'empty_count',
        COLUMNS,
      );
      const result = await emptyAdapter.count();
      expect(result).toBe(0);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createPersistenceAdapter', () => {
    it('should create a GenericPersistenceAdapter instance', () => {
      const a = createPersistenceAdapter<TestEntity>(client, TABLE, COLUMNS);
      expect(a).toBeInstanceOf(GenericPersistenceAdapter);
    });
  });
});
