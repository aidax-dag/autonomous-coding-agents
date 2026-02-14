/**
 * Vector Store Adapters Tests
 *
 * Tests for the IVectorStore interface, QdrantAdapter, WeaviateAdapter,
 * VectorStoreFactory, and InMemoryVectorStore IVectorStore compliance.
 */

import { InMemoryVectorStore } from '@/core/rag/vector-store';
import { QdrantAdapter } from '@/core/rag/qdrant-adapter';
import { WeaviateAdapter } from '@/core/rag/weaviate-adapter';
import { createVectorStore } from '@/core/rag/vector-store-factory';
import type { IVectorStore } from '@/core/rag/vector-store-types';

// ============================================================================
// Mock Setup
// ============================================================================

const originalFetch = global.fetch;

function mockFetchResponse(body: unknown, status = 200): jest.Mock {
  const mock = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>): jest.Mock {
  let callIndex = 0;
  const mock = jest.fn().mockImplementation(() => {
    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    const status = resp.status ?? 200;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      json: () => Promise.resolve(resp.body),
      text: () =>
        Promise.resolve(
          typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body),
        ),
    });
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

function mockFetchError(message: string): jest.Mock {
  const mock = jest.fn().mockRejectedValue(new Error(message));
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(() => {
  global.fetch = originalFetch;
});

// ============================================================================
// IVectorStore Interface Compliance
// ============================================================================

describe('IVectorStore interface compliance', () => {
  test('InMemoryVectorStore implements all interface methods', () => {
    const store: IVectorStore = new InMemoryVectorStore();

    expect(typeof store.add).toBe('function');
    expect(typeof store.addBatch).toBe('function');
    expect(typeof store.search).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.clear).toBe('function');
    expect(typeof store.count).toBe('function');
    expect(typeof store.getById).toBe('function');
  });

  test('QdrantAdapter implements all interface methods', () => {
    const store: IVectorStore = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test',
      dimension: 128,
    });

    expect(typeof store.add).toBe('function');
    expect(typeof store.addBatch).toBe('function');
    expect(typeof store.search).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.clear).toBe('function');
    expect(typeof store.count).toBe('function');
    expect(typeof store.getById).toBe('function');
  });

  test('WeaviateAdapter implements all interface methods', () => {
    const store: IVectorStore = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'Test',
      dimension: 128,
    });

    expect(typeof store.add).toBe('function');
    expect(typeof store.addBatch).toBe('function');
    expect(typeof store.search).toBe('function');
    expect(typeof store.delete).toBe('function');
    expect(typeof store.clear).toBe('function');
    expect(typeof store.count).toBe('function');
    expect(typeof store.getById).toBe('function');
  });
});

// ============================================================================
// QdrantAdapter Tests
// ============================================================================

describe('QdrantAdapter', () => {
  test('constructor sets defaults correctly', () => {
    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'my-vectors',
      dimension: 384,
    });

    // Verify it was constructed without error
    expect(adapter).toBeInstanceOf(QdrantAdapter);
  });

  test('constructor throws on invalid dimension', () => {
    expect(
      () =>
        new QdrantAdapter({
          url: 'http://localhost:6333',
          collectionName: 'test',
          dimension: 0,
        }),
    ).toThrow(/dimension must be a positive integer/);
  });

  test('add sends correct HTTP request to Qdrant API', async () => {
    // First call: GET collection (ensureCollection check) returns 404
    // Second call: PUT collection (create) returns ok
    // Third call: PUT points (add vector) returns ok
    const fetchMock = mockFetchSequence([
      { body: 'Not found', status: 404 },
      { body: { result: true } },
      { body: { result: { status: 'completed' } } },
    ]);

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 3,
    });

    await adapter.add('doc-1', [0.1, 0.2, 0.3], { type: 'test' });

    // Third call should be the PUT points request
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toBe('http://localhost:6333/collections/test-col/points');
    expect(options.method).toBe('PUT');

    const body = JSON.parse(options.body);
    expect(body.points).toHaveLength(1);
    expect(body.points[0].vector).toEqual([0.1, 0.2, 0.3]);
    expect(body.points[0].payload._originalId).toBe('doc-1');
    expect(body.points[0].payload.type).toBe('test');
  });

  test('addBatch sends batch request', async () => {
    // ensureCollection succeeds (already exists)
    // addBatch PUT points
    const fetchMock = mockFetchSequence([
      { body: { result: { status: 'ok' } } },
      { body: { result: { status: 'completed' } } },
    ]);

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 2,
    });

    await adapter.addBatch([
      { id: 'a', vector: [1.0, 0.0], metadata: { idx: 0 } },
      { id: 'b', vector: [0.0, 1.0], metadata: { idx: 1 } },
    ]);

    // Second call is the PUT points
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('http://localhost:6333/collections/test-col/points');
    expect(options.method).toBe('PUT');

    const body = JSON.parse(options.body);
    expect(body.points).toHaveLength(2);
  });

  test('search sends nearVector query and returns results', async () => {
    const fetchMock = mockFetchSequence([
      { body: { result: { status: 'ok' } } },
      {
        body: {
          result: [
            { id: 12345, score: 0.95, payload: { _originalId: 'doc-1', type: 'test' } },
            { id: 67890, score: 0.80, payload: { _originalId: 'doc-2', type: 'other' } },
          ],
        },
      },
    ]);

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 3,
    });

    const results = await adapter.search([0.1, 0.2, 0.3], 5);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('doc-1');
    expect(results[0].score).toBe(0.95);
    expect(results[0].metadata).toEqual({ type: 'test' });
    expect(results[1].id).toBe('doc-2');
    expect(results[1].score).toBe(0.80);

    // Verify the POST request
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('http://localhost:6333/collections/test-col/points/search');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.vector).toEqual([0.1, 0.2, 0.3]);
    expect(body.limit).toBe(5);
  });

  test('delete sends correct delete request', async () => {
    const fetchMock = mockFetchSequence([
      { body: { result: { status: 'ok' } } },
      { body: { result: { status: 'completed' } } },
    ]);

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 3,
    });

    await adapter.delete('doc-1');

    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('http://localhost:6333/collections/test-col/points/delete');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.points).toHaveLength(1);
    expect(typeof body.points[0]).toBe('number');
  });

  test('clear deletes and recreates collection', async () => {
    const fetchMock = mockFetchSequence([
      { body: { result: true } },           // DELETE collection
      { body: 'Not found', status: 404 },    // GET collection (ensureCollection check)
      { body: { result: true } },           // PUT collection (create)
    ]);

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 3,
    });

    await adapter.clear();

    // First call: DELETE
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:6333/collections/test-col');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');

    // Third call: PUT (recreate)
    expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:6333/collections/test-col');
    expect(fetchMock.mock.calls[2][1].method).toBe('PUT');
  });

  test('count parses collection info', async () => {
    mockFetchSequence([
      { body: { result: { status: 'ok' } } },
      { body: { result: { points_count: 42 } } },
    ]);

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 3,
    });

    const count = await adapter.count();
    expect(count).toBe(42);
  });

  test('handles connection refused error', async () => {
    mockFetchError('fetch failed (ECONNREFUSED)');

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 3,
    });

    await expect(adapter.count()).rejects.toThrow(/Qdrant connection refused/);
  });

  test('getById retrieves a single point', async () => {
    mockFetchSequence([
      { body: { result: { status: 'ok' } } },
      {
        body: {
          result: {
            id: 12345,
            vector: [0.1, 0.2, 0.3],
            payload: { _originalId: 'doc-1', type: 'test' },
          },
        },
      },
    ]);

    const adapter = new QdrantAdapter({
      url: 'http://localhost:6333',
      collectionName: 'test-col',
      dimension: 3,
    });

    const entry = await adapter.getById('doc-1');

    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('doc-1');
    expect(entry!.vector).toEqual([0.1, 0.2, 0.3]);
    expect(entry!.metadata).toEqual({ type: 'test' });
  });
});

// ============================================================================
// WeaviateAdapter Tests
// ============================================================================

describe('WeaviateAdapter', () => {
  test('constructor sets defaults correctly', () => {
    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'MyVectors',
      dimension: 384,
    });

    expect(adapter).toBeInstanceOf(WeaviateAdapter);
  });

  test('constructor throws on invalid dimension', () => {
    expect(
      () =>
        new WeaviateAdapter({
          url: 'http://localhost:8080',
          className: 'Test',
          dimension: 0,
        }),
    ).toThrow(/dimension must be a positive integer/);
  });

  test('add sends correct HTTP request', async () => {
    // ensureSchema: GET schema returns 404, then POST schema, then POST object
    const fetchMock = mockFetchSequence([
      { body: 'Not found', status: 404 },
      { body: { class: 'TestClass' } },
      { body: { id: 'some-uuid' } },
    ]);

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 3,
    });

    await adapter.add('doc-1', [0.1, 0.2, 0.3], { type: 'test' });

    // Third call: POST /v1/objects
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toBe('http://localhost:8080/v1/objects');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.class).toBe('TestClass');
    expect(body.vector).toEqual([0.1, 0.2, 0.3]);
    expect(body.properties._originalId).toBe('doc-1');
    expect(body.properties._metadataJson).toBe(JSON.stringify({ type: 'test' }));
  });

  test('addBatch sends batch request', async () => {
    const fetchMock = mockFetchSequence([
      { body: { class: 'TestClass' } },
      { body: [{ result: { status: 'SUCCESS' } }] },
    ]);

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 2,
    });

    await adapter.addBatch([
      { id: 'a', vector: [1.0, 0.0], metadata: { idx: 0 } },
      { id: 'b', vector: [0.0, 1.0], metadata: { idx: 1 } },
    ]);

    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('http://localhost:8080/v1/batch/objects');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.objects).toHaveLength(2);
    expect(body.objects[0].class).toBe('TestClass');
    expect(body.objects[1].class).toBe('TestClass');
  });

  test('search sends GraphQL nearVector query', async () => {
    const fetchMock = mockFetchSequence([
      { body: { class: 'TestClass' } },
      {
        body: {
          data: {
            Get: {
              TestClass: [
                {
                  _additional: { id: 'uuid-1', distance: 0.1 },
                  _originalId: 'doc-1',
                  _metadataJson: JSON.stringify({ type: 'test' }),
                },
                {
                  _additional: { id: 'uuid-2', distance: 0.3 },
                  _originalId: 'doc-2',
                  _metadataJson: JSON.stringify({ type: 'other' }),
                },
              ],
            },
          },
        },
      },
    ]);

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 3,
    });

    const results = await adapter.search([0.1, 0.2, 0.3], 5);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('doc-1');
    expect(results[0].score).toBeCloseTo(0.9, 5);
    expect(results[0].metadata).toEqual({ type: 'test' });
    expect(results[1].id).toBe('doc-2');
    expect(results[1].score).toBeCloseTo(0.7, 5);

    // Verify GraphQL request
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toBe('http://localhost:8080/v1/graphql');
    expect(options.method).toBe('POST');

    const body = JSON.parse(options.body);
    expect(body.query).toContain('nearVector');
    expect(body.query).toContain('TestClass');
  });

  test('delete sends correct request', async () => {
    const fetchMock = mockFetchSequence([
      { body: { class: 'TestClass' } },
      { body: '' },
    ]);

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 3,
    });

    await adapter.delete('doc-1');

    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toMatch(/^http:\/\/localhost:8080\/v1\/objects\/TestClass\//);
    expect(options.method).toBe('DELETE');
  });

  test('clear deletes and recreates schema', async () => {
    const fetchMock = mockFetchSequence([
      { body: '' },                          // DELETE schema
      { body: 'Not found', status: 404 },    // GET schema (ensureSchema check)
      { body: { class: 'TestClass' } },      // POST schema (recreate)
    ]);

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 3,
    });

    await adapter.clear();

    // First call: DELETE schema
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8080/v1/schema/TestClass');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');

    // Third call: POST schema (recreate)
    expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:8080/v1/schema');
    expect(fetchMock.mock.calls[2][1].method).toBe('POST');
  });

  test('count returns total results', async () => {
    mockFetchSequence([
      { body: { class: 'TestClass' } },
      {
        body: {
          data: {
            Aggregate: {
              TestClass: [{ meta: { count: 17 } }],
            },
          },
        },
      },
    ]);

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 3,
    });

    const count = await adapter.count();
    expect(count).toBe(17);
  });

  test('handles connection refused error', async () => {
    mockFetchError('fetch failed (ECONNREFUSED)');

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 3,
    });

    await expect(adapter.count()).rejects.toThrow(/Weaviate connection refused/);
  });

  test('getById retrieves a single object', async () => {
    mockFetchSequence([
      { body: { class: 'TestClass' } },
      {
        body: {
          id: 'weaviate-uuid',
          vector: [0.1, 0.2, 0.3],
          properties: {
            _originalId: 'doc-1',
            _metadataJson: JSON.stringify({ type: 'test' }),
          },
        },
      },
    ]);

    const adapter = new WeaviateAdapter({
      url: 'http://localhost:8080',
      className: 'TestClass',
      dimension: 3,
    });

    const entry = await adapter.getById('doc-1');

    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('doc-1');
    expect(entry!.vector).toEqual([0.1, 0.2, 0.3]);
    expect(entry!.metadata).toEqual({ type: 'test' });
  });
});

// ============================================================================
// VectorStoreFactory Tests
// ============================================================================

describe('VectorStoreFactory', () => {
  test('creates InMemoryVectorStore for in-memory provider', () => {
    const store = createVectorStore({ provider: 'in-memory' });
    expect(store).toBeInstanceOf(InMemoryVectorStore);
  });

  test('creates QdrantAdapter for qdrant provider', () => {
    const store = createVectorStore({
      provider: 'qdrant',
      qdrant: {
        url: 'http://localhost:6333',
        collectionName: 'test',
        dimension: 128,
      },
    });
    expect(store).toBeInstanceOf(QdrantAdapter);
  });

  test('creates WeaviateAdapter for weaviate provider', () => {
    const store = createVectorStore({
      provider: 'weaviate',
      weaviate: {
        url: 'http://localhost:8080',
        className: 'Test',
        dimension: 128,
      },
    });
    expect(store).toBeInstanceOf(WeaviateAdapter);
  });

  test('defaults to in-memory when no config provided', () => {
    const store = createVectorStore();
    expect(store).toBeInstanceOf(InMemoryVectorStore);
  });

  test('throws on unknown provider', () => {
    expect(() =>
      createVectorStore({ provider: 'unknown' as 'in-memory' }),
    ).toThrow(/Unknown vector store provider: 'unknown'/);
  });

  test('throws when qdrant config is missing', () => {
    expect(() => createVectorStore({ provider: 'qdrant' })).toThrow(
      /Qdrant configuration is required/,
    );
  });

  test('throws when weaviate config is missing', () => {
    expect(() => createVectorStore({ provider: 'weaviate' })).toThrow(
      /Weaviate configuration is required/,
    );
  });
});

// ============================================================================
// InMemoryVectorStore IVectorStore Compatibility Tests
// ============================================================================

describe('InMemoryVectorStore IVectorStore compatibility', () => {
  test('implements IVectorStore interface with async methods', async () => {
    const store: IVectorStore = new InMemoryVectorStore();

    // count returns 0 for empty store
    const count = await store.count();
    expect(count).toBe(0);

    // getById returns null for non-existent ID
    const entry = await store.getById('nonexistent');
    expect(entry).toBeNull();
  });

  test('async methods work correctly end-to-end', async () => {
    const store: IVectorStore = new InMemoryVectorStore();

    // Add a vector
    await store.add('v1', [1, 2, 3], { type: 'test' });
    expect(await store.count()).toBe(1);

    // Retrieve by ID
    const entry = await store.getById('v1');
    expect(entry).not.toBeNull();
    expect(entry!.id).toBe('v1');
    expect(entry!.vector).toEqual([1, 2, 3]);
    expect(entry!.metadata).toEqual({ type: 'test' });

    // Batch add
    await store.addBatch([
      { id: 'v2', vector: [4, 5, 6], metadata: { type: 'a' } },
      { id: 'v3', vector: [7, 8, 9], metadata: { type: 'b' } },
    ]);
    expect(await store.count()).toBe(3);

    // Search
    const results = await store.search([1, 2, 3], 2);
    expect(results.length).toBeLessThanOrEqual(2);
    expect(results[0].score).toBeGreaterThanOrEqual(results[results.length - 1].score);

    // Delete
    await store.delete('v1');
    expect(await store.count()).toBe(2);
    expect(await store.getById('v1')).toBeNull();

    // Clear
    await store.clear();
    expect(await store.count()).toBe(0);
  });
});
