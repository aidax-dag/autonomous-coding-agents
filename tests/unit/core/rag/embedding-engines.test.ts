/**
 * Embedding Engines Tests
 *
 * Tests for the IEmbeddingEngine interface, OllamaEmbeddingEngine,
 * HuggingFaceEmbeddingEngine, EmbeddingFactory, and DimensionAdapter.
 */

import { LocalEmbeddingEngine } from '@/core/rag/embedding-engine';
import type { IEmbeddingEngine } from '@/core/rag/embedding-engine';
import { OllamaEmbeddingEngine } from '@/core/rag/ollama-embedding-engine';
import { HuggingFaceEmbeddingEngine } from '@/core/rag/huggingface-embedding-engine';
import { createEmbeddingEngine } from '@/core/rag/embedding-factory';
import { DimensionAdapter } from '@/core/rag/dimension-adapter';

// ============================================================================
// Mock Setup
// ============================================================================

// Save original fetch
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

function mockFetchError(message: string): jest.Mock {
  const mock = jest.fn().mockRejectedValue(new Error(message));
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

afterEach(() => {
  global.fetch = originalFetch;
});

// ============================================================================
// IEmbeddingEngine Interface Compliance
// ============================================================================

describe('IEmbeddingEngine interface compliance', () => {
  test('LocalEmbeddingEngine implements the interface correctly', async () => {
    const engine: IEmbeddingEngine = new LocalEmbeddingEngine(64);

    const vector = await engine.embed('test text');
    expect(vector).toHaveLength(64);
    expect(vector.every((v) => typeof v === 'number')).toBe(true);

    const batch = await engine.embedBatch(['a', 'b']);
    expect(batch).toHaveLength(2);
  });

  test('getDimension returns a positive number for all engines', () => {
    const local: IEmbeddingEngine = new LocalEmbeddingEngine(128);
    expect(local.getDimension()).toBe(128);
    expect(local.getDimension()).toBeGreaterThan(0);

    const ollama: IEmbeddingEngine = new OllamaEmbeddingEngine({ dimension: 768 });
    expect(ollama.getDimension()).toBe(768);
    expect(ollama.getDimension()).toBeGreaterThan(0);

    const hf: IEmbeddingEngine = new HuggingFaceEmbeddingEngine({
      apiKey: 'test-key',
      dimension: 384,
    });
    expect(hf.getDimension()).toBe(384);
    expect(hf.getDimension()).toBeGreaterThan(0);
  });

  test('getProvider returns a non-empty string for all engines', () => {
    const local: IEmbeddingEngine = new LocalEmbeddingEngine();
    expect(local.getProvider()).toBe('local');
    expect(local.getProvider().length).toBeGreaterThan(0);

    const ollama: IEmbeddingEngine = new OllamaEmbeddingEngine();
    expect(ollama.getProvider()).toBe('ollama');
    expect(ollama.getProvider().length).toBeGreaterThan(0);

    const hf: IEmbeddingEngine = new HuggingFaceEmbeddingEngine({ apiKey: 'test-key' });
    expect(hf.getProvider()).toBe('huggingface');
    expect(hf.getProvider().length).toBeGreaterThan(0);
  });
});

// ============================================================================
// OllamaEmbeddingEngine Tests
// ============================================================================

describe('OllamaEmbeddingEngine', () => {
  test('constructor sets defaults correctly', () => {
    const engine = new OllamaEmbeddingEngine();

    expect(engine.getDimension()).toBe(768);
    expect(engine.getProvider()).toBe('ollama');
  });

  test('embed sends correct HTTP request', async () => {
    const mockVector = Array.from({ length: 768 }, (_, i) => i * 0.001);
    const fetchMock = mockFetchResponse({ embedding: mockVector });

    const engine = new OllamaEmbeddingEngine({
      host: 'http://localhost:11434',
      model: 'nomic-embed-text',
    });

    const result = await engine.embed('test text');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/embeddings');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({
      model: 'nomic-embed-text',
      prompt: 'test text',
    });
    expect(result).toEqual(mockVector);
  });

  test('embed returns vector of correct dimension', async () => {
    const mockVector = Array.from({ length: 768 }, () => Math.random());
    mockFetchResponse({ embedding: mockVector });

    const engine = new OllamaEmbeddingEngine({ dimension: 768 });
    const result = await engine.embed('hello world');

    expect(result).toHaveLength(768);
    expect(result.every((v) => typeof v === 'number')).toBe(true);
  });

  test('embedBatch processes multiple texts', async () => {
    const mockVector1 = Array.from({ length: 768 }, () => 0.1);
    const mockVector2 = Array.from({ length: 768 }, () => 0.2);

    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      const vector = callCount === 1 ? mockVector1 : mockVector2;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ embedding: vector }),
      });
    }) as unknown as typeof fetch;

    const engine = new OllamaEmbeddingEngine();
    const results = await engine.embedBatch(['text 1', 'text 2']);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(mockVector1);
    expect(results[1]).toEqual(mockVector2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test('handles connection refused error', async () => {
    mockFetchError('fetch failed (ECONNREFUSED)');

    const engine = new OllamaEmbeddingEngine();

    await expect(engine.embed('test')).rejects.toThrow(
      /Ollama connection refused/,
    );
  });

  test('handles invalid model error', async () => {
    mockFetchResponse('model "bad-model" not found', 404);

    const engine = new OllamaEmbeddingEngine({ model: 'bad-model' });

    await expect(engine.embed('test')).rejects.toThrow(
      /Ollama model 'bad-model' not found/,
    );
  });

  test('handles malformed response', async () => {
    mockFetchResponse({ result: 'no embedding field' });

    const engine = new OllamaEmbeddingEngine();

    await expect(engine.embed('test')).rejects.toThrow(
      /malformed response/,
    );
  });

  test('custom host and model configuration works', async () => {
    const mockVector = Array.from({ length: 512 }, () => 0.5);
    const fetchMock = mockFetchResponse({ embedding: mockVector });

    const engine = new OllamaEmbeddingEngine({
      host: 'http://remote-host:8080',
      model: 'custom-model',
      dimension: 512,
    });

    await engine.embed('test');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://remote-host:8080/api/embeddings');
    expect(JSON.parse(options.body).model).toBe('custom-model');
    expect(engine.getDimension()).toBe(512);
  });

  test('embed returns zero vector for empty text', async () => {
    const engine = new OllamaEmbeddingEngine({ dimension: 768 });
    const result = await engine.embed('');

    expect(result).toHaveLength(768);
    expect(result.every((v) => v === 0)).toBe(true);
  });
});

// ============================================================================
// HuggingFaceEmbeddingEngine Tests
// ============================================================================

describe('HuggingFaceEmbeddingEngine', () => {
  test('constructor sets defaults correctly', () => {
    const engine = new HuggingFaceEmbeddingEngine({ apiKey: 'hf_test' });

    expect(engine.getDimension()).toBe(384);
    expect(engine.getProvider()).toBe('huggingface');
  });

  test('constructor throws on missing API key', () => {
    expect(() => new HuggingFaceEmbeddingEngine({ apiKey: '' })).toThrow(
      /API key is required/,
    );
  });

  test('embed sends correct HTTP request with auth header', async () => {
    const mockVector = Array.from({ length: 384 }, () => Math.random());
    const fetchMock = mockFetchResponse(mockVector);

    const engine = new HuggingFaceEmbeddingEngine({
      apiKey: 'hf_test_key_123',
      model: 'sentence-transformers/all-MiniLM-L6-v2',
    });

    await engine.embed('test text');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
    );
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer hf_test_key_123');
    expect(JSON.parse(options.body)).toEqual({ inputs: 'test text' });
  });

  test('embed returns vector of correct dimension', async () => {
    const mockVector = Array.from({ length: 384 }, () => Math.random());
    mockFetchResponse(mockVector);

    const engine = new HuggingFaceEmbeddingEngine({
      apiKey: 'hf_test',
      dimension: 384,
    });
    const result = await engine.embed('hello world');

    expect(result).toHaveLength(384);
    expect(result.every((v) => typeof v === 'number')).toBe(true);
  });

  test('embedBatch sends batch request', async () => {
    const mockVectors = [
      Array.from({ length: 384 }, () => 0.1),
      Array.from({ length: 384 }, () => 0.2),
    ];
    const fetchMock = mockFetchResponse(mockVectors);

    const engine = new HuggingFaceEmbeddingEngine({ apiKey: 'hf_test' });
    const results = await engine.embedBatch(['text 1', 'text 2']);

    expect(results).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.inputs).toEqual(['text 1', 'text 2']);
  });

  test('handles 401 auth error', async () => {
    mockFetchResponse('Unauthorized', 401);

    const engine = new HuggingFaceEmbeddingEngine({ apiKey: 'bad_key' });

    await expect(engine.embed('test')).rejects.toThrow(
      /authentication failed/,
    );
  });

  test('handles 429 rate limit', async () => {
    mockFetchResponse('Rate limit exceeded', 429);

    const engine = new HuggingFaceEmbeddingEngine({ apiKey: 'hf_test' });

    await expect(engine.embed('test')).rejects.toThrow(
      /rate limit exceeded/,
    );
  });

  test('handles model not found', async () => {
    mockFetchResponse('Model nonexistent/model not found', 404);

    const engine = new HuggingFaceEmbeddingEngine({
      apiKey: 'hf_test',
      model: 'nonexistent/model',
    });

    await expect(engine.embed('test')).rejects.toThrow(
      /model 'nonexistent\/model' not found/,
    );
  });

  test('custom model configuration works', async () => {
    const mockVector = Array.from({ length: 768 }, () => 0.3);
    const fetchMock = mockFetchResponse(mockVector);

    const engine = new HuggingFaceEmbeddingEngine({
      apiKey: 'hf_test',
      model: 'BAAI/bge-large-en-v1.5',
      dimension: 768,
      apiUrl: 'https://custom-hf.example.com',
    });

    await engine.embed('test');

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://custom-hf.example.com/pipeline/feature-extraction/BAAI/bge-large-en-v1.5',
    );
    expect(engine.getDimension()).toBe(768);
  });

  test('embed returns zero vector for empty text', async () => {
    const engine = new HuggingFaceEmbeddingEngine({
      apiKey: 'hf_test',
      dimension: 384,
    });
    const result = await engine.embed('');

    expect(result).toHaveLength(384);
    expect(result.every((v) => v === 0)).toBe(true);
  });
});

// ============================================================================
// EmbeddingFactory Tests
// ============================================================================

describe('EmbeddingFactory', () => {
  test('creates LocalEmbeddingEngine for local provider', () => {
    const engine = createEmbeddingEngine({ provider: 'local', local: { dimension: 64 } });

    expect(engine).toBeInstanceOf(LocalEmbeddingEngine);
    expect(engine.getProvider()).toBe('local');
    expect(engine.getDimension()).toBe(64);
  });

  test('creates OllamaEmbeddingEngine for ollama provider', () => {
    const engine = createEmbeddingEngine({
      provider: 'ollama',
      ollama: { model: 'nomic-embed-text', dimension: 768 },
    });

    expect(engine).toBeInstanceOf(OllamaEmbeddingEngine);
    expect(engine.getProvider()).toBe('ollama');
    expect(engine.getDimension()).toBe(768);
  });

  test('creates HuggingFaceEmbeddingEngine for huggingface provider', () => {
    const engine = createEmbeddingEngine({
      provider: 'huggingface',
      huggingface: { apiKey: 'hf_test', dimension: 384 },
    });

    expect(engine).toBeInstanceOf(HuggingFaceEmbeddingEngine);
    expect(engine.getProvider()).toBe('huggingface');
    expect(engine.getDimension()).toBe(384);
  });

  test('defaults to local when no provider specified', () => {
    const engine = createEmbeddingEngine();

    expect(engine).toBeInstanceOf(LocalEmbeddingEngine);
    expect(engine.getProvider()).toBe('local');
  });

  test('throws on unknown provider', () => {
    expect(() =>
      createEmbeddingEngine({ provider: 'unknown' as 'local' }),
    ).toThrow(/Unknown embedding provider: 'unknown'/);
  });

  test('throws when huggingface config is missing for huggingface provider', () => {
    expect(() =>
      createEmbeddingEngine({ provider: 'huggingface' }),
    ).toThrow(/HuggingFace configuration is required/);
  });
});

// ============================================================================
// DimensionAdapter Tests
// ============================================================================

describe('DimensionAdapter', () => {
  test('truncates vector longer than target', () => {
    const adapter = new DimensionAdapter(3);
    const result = adapter.adapt([1, 2, 3, 4, 5]);

    expect(result).toEqual([1, 2, 3]);
    expect(result).toHaveLength(3);
  });

  test('pads vector shorter than target with zeros', () => {
    const adapter = new DimensionAdapter(5);
    const result = adapter.adapt([1, 2, 3]);

    expect(result).toEqual([1, 2, 3, 0, 0]);
    expect(result).toHaveLength(5);
  });

  test('returns copy of same vector when dimensions match', () => {
    const adapter = new DimensionAdapter(3);
    const original = [1, 2, 3];
    const result = adapter.adapt(original);

    expect(result).toEqual([1, 2, 3]);
    expect(result).toHaveLength(3);
    // Verify it is a copy, not the same reference
    expect(result).not.toBe(original);
  });

  test('adaptBatch processes multiple vectors', () => {
    const adapter = new DimensionAdapter(3);
    const results = adapter.adaptBatch([
      [1, 2, 3, 4, 5],
      [1, 2],
      [1, 2, 3],
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual([1, 2, 3]);
    expect(results[1]).toEqual([1, 2, 0]);
    expect(results[2]).toEqual([1, 2, 3]);
  });

  test('handles empty vector', () => {
    const adapter = new DimensionAdapter(3);
    const result = adapter.adapt([]);

    expect(result).toEqual([0, 0, 0]);
    expect(result).toHaveLength(3);
  });

  test('handles zero-dimension target gracefully', () => {
    const adapter = new DimensionAdapter(0);
    const result = adapter.adapt([1, 2, 3]);

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  test('getTargetDimension returns configured value', () => {
    const adapter = new DimensionAdapter(256);
    expect(adapter.getTargetDimension()).toBe(256);
  });

  test('throws on negative target dimension', () => {
    expect(() => new DimensionAdapter(-1)).toThrow(
      /Target dimension must be non-negative/,
    );
  });
});
