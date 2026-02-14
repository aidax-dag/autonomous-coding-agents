/**
 * RAG Module Tests
 *
 * Comprehensive tests for the RAG system: chunking, embedding,
 * vector store, and orchestrator pipeline.
 */

import { CodeChunkStrategy } from '@/core/rag/chunk-strategy';
import { LocalEmbeddingEngine } from '@/core/rag/embedding-engine';
import { InMemoryVectorStore } from '@/core/rag/vector-store';
import { RAGOrchestrator } from '@/core/rag/rag-orchestrator';
import type { CodeChunk } from '@/core/rag/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const SAMPLE_TS_FILE = `
import { EventEmitter } from 'events';
import { readFile } from 'fs/promises';

export interface Config {
  name: string;
  timeout: number;
}

export class UserService extends EventEmitter {
  private users: Map<string, User> = new Map();

  constructor(private config: Config) {
    super();
  }

  async getUser(id: string): Promise<User | undefined> {
    if (!id) {
      throw new Error('User ID required');
    }
    return this.users.get(id);
  }

  async createUser(name: string, email: string): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.emit('user:created', user);
    return user;
  }

  async deleteUser(id: string): Promise<boolean> {
    const deleted = this.users.delete(id);
    if (deleted) {
      this.emit('user:deleted', { id });
    }
    return deleted;
  }
}

export function validateEmail(email: string): boolean {
  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
}
`.trim();

const SAMPLE_PY_FILE = `
import os
from typing import List, Optional

class DataProcessor:
    def __init__(self, config: dict):
        self.config = config
        self.data = []

    def process(self, items: List[str]) -> List[str]:
        results = []
        for item in items:
            if self.validate(item):
                results.append(self.transform(item))
        return results

    def validate(self, item: str) -> bool:
        return len(item) > 0

    def transform(self, item: str) -> str:
        return item.strip().lower()

def create_processor(config: Optional[dict] = None) -> DataProcessor:
    return DataProcessor(config or {})
`.trim();

const SMALL_SNIPPET = `
function hello() {
  return 'world';
}
`.trim();

// ============================================================================
// CodeChunkStrategy Tests
// ============================================================================

describe('CodeChunkStrategy', () => {
  let strategy: CodeChunkStrategy;

  beforeEach(() => {
    strategy = new CodeChunkStrategy(500, 50);
  });

  test('chunks file into appropriate pieces', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'user-service.ts', 'typescript');

    expect(chunks.length).toBeGreaterThan(1);
    // All chunks should reference the source file
    for (const chunk of chunks) {
      expect(chunk.filePath).toBe('user-service.ts');
      expect(chunk.language).toBe('typescript');
    }
  });

  test('respects chunk size limits', () => {
    const smallStrategy = new CodeChunkStrategy(200, 0);
    const chunks = smallStrategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    for (const chunk of chunks) {
      // Allow some tolerance for boundary snapping
      expect(chunk.content.length).toBeLessThanOrEqual(400);
    }
  });

  test('detects function boundaries', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    const functionChunks = chunks.filter((c) => c.type === 'function');
    expect(functionChunks.length).toBeGreaterThanOrEqual(1);

    // Should find validateEmail function
    const validateChunk = chunks.find(
      (c) => c.metadata.name === 'validateEmail',
    );
    expect(validateChunk).toBeDefined();
  });

  test('detects class boundaries', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    const classChunks = chunks.filter((c) => c.type === 'class');
    expect(classChunks.length).toBeGreaterThanOrEqual(1);
  });

  test('infers chunk type correctly', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    const types = new Set(chunks.map((c) => c.type));
    // Should have at least imports and some code structure
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  test('extracts names from code', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    const namedChunks = chunks.filter((c) => c.metadata.name !== undefined);
    expect(namedChunks.length).toBeGreaterThan(0);

    const names = namedChunks.map((c) => c.metadata.name);
    // Should extract at least the class name or function name
    expect(
      names.includes('UserService') || names.includes('validateEmail'),
    ).toBe(true);
  });

  test('handles empty content', () => {
    const chunks = strategy.chunkFile('', 'empty.ts', 'typescript');
    expect(chunks).toEqual([]);

    const chunks2 = strategy.chunkFile('   \n\n  ', 'whitespace.ts', 'typescript');
    expect(chunks2).toEqual([]);
  });

  test('overlap between chunks preserves context', () => {
    const overlapStrategy = new CodeChunkStrategy(200, 30);
    const chunks = overlapStrategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    if (chunks.length >= 2) {
      // Second chunk should contain some text from the end of the first chunk
      const firstEnd = chunks[0].content.slice(-30);
      expect(chunks[1].content.startsWith(firstEnd)).toBe(true);
    }
  });

  test('each chunk has a unique id', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    const ids = new Set(chunks.map((c) => c.id));
    expect(ids.size).toBe(chunks.length);
  });

  test('startLine and endLine are set correctly', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    for (const chunk of chunks) {
      expect(chunk.startLine).toBeGreaterThanOrEqual(1);
      expect(chunk.endLine).toBeGreaterThanOrEqual(chunk.startLine);
    }
  });

  test('extracts dependencies from imports', () => {
    const chunks = strategy.chunkFile(SAMPLE_TS_FILE, 'test.ts', 'typescript');

    const importChunks = chunks.filter((c) => c.type === 'import');
    if (importChunks.length > 0) {
      const allDeps = importChunks.flatMap((c) => c.metadata.dependencies ?? []);
      expect(allDeps).toContain('events');
    }
  });
});

// ============================================================================
// LocalEmbeddingEngine Tests
// ============================================================================

describe('LocalEmbeddingEngine', () => {
  let engine: LocalEmbeddingEngine;

  beforeEach(() => {
    engine = new LocalEmbeddingEngine(128);
  });

  test('embed produces vector of correct dimension', () => {
    const vector = engine.embedSync('function hello() { return 42; }');

    expect(vector).toHaveLength(128);
    expect(vector.every((v) => typeof v === 'number')).toBe(true);
  });

  test('async embed produces vector of correct dimension', async () => {
    const vector = await engine.embed('function hello() { return 42; }');

    expect(vector).toHaveLength(128);
    expect(vector.every((v) => typeof v === 'number')).toBe(true);
  });

  test('batch embed produces correct count', () => {
    const texts = ['hello world', 'foo bar', 'function test()'];
    const vectors = engine.batchEmbed(texts);

    expect(vectors).toHaveLength(3);
    for (const vec of vectors) {
      expect(vec).toHaveLength(128);
    }
  });

  test('async embedBatch produces correct count', async () => {
    const texts = ['hello world', 'foo bar', 'function test()'];
    const vectors = await engine.embedBatch(texts);

    expect(vectors).toHaveLength(3);
    for (const vec of vectors) {
      expect(vec).toHaveLength(128);
    }
  });

  test('similarity of identical texts equals 1.0', () => {
    const text = 'export function processData(items: string[]) { return items; }';
    const vecA = engine.embedSync(text);
    const vecB = engine.embedSync(text);

    const sim = engine.similarity(vecA, vecB);
    expect(sim).toBeCloseTo(1.0, 5);
  });

  test('similarity of different texts is less than 1.0', () => {
    const vecA = engine.embedSync('function add(a: number, b: number) { return a + b; }');
    const vecB = engine.embedSync('class HttpServer { listen(port: number) { } }');

    const sim = engine.similarity(vecA, vecB);
    expect(sim).toBeLessThan(1.0);
  });

  test('similarity is symmetric', () => {
    const vecA = engine.embedSync('import { readFile } from "fs"');
    const vecB = engine.embedSync('class DataProcessor { process() {} }');

    const simAB = engine.similarity(vecA, vecB);
    const simBA = engine.similarity(vecB, vecA);

    expect(simAB).toBeCloseTo(simBA, 10);
  });

  test('normalize produces unit vector', () => {
    const vector = engine.embedSync('some code content here');

    // A normalized vector should have magnitude close to 1.0
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });

  test('empty text handling', () => {
    const vector = engine.embedSync('');
    expect(vector).toHaveLength(128);

    // Empty text should produce a zero vector
    expect(vector.every((v) => v === 0)).toBe(true);
  });

  test('similar code produces higher similarity than unrelated code', () => {
    const funcA = engine.embedSync('function add(a: number, b: number): number { return a + b; }');
    const funcB = engine.embedSync('function sum(x: number, y: number): number { return x + y; }');
    const unrelated = engine.embedSync('import * as fs from "fs"; const data = fs.readFileSync("file.txt");');

    const simAB = engine.similarity(funcA, funcB);
    const simAC = engine.similarity(funcA, unrelated);

    expect(simAB).toBeGreaterThan(simAC);
  });

  test('custom dimension is respected', () => {
    const smallEngine = new LocalEmbeddingEngine(32);
    const vector = smallEngine.embedSync('test content');

    expect(vector).toHaveLength(32);
  });

  test('getProvider returns local', () => {
    expect(engine.getProvider()).toBe('local');
  });

  test('throws on invalid dimension', () => {
    expect(() => new LocalEmbeddingEngine(0)).toThrow();
    expect(() => new LocalEmbeddingEngine(-5)).toThrow();
  });
});

// ============================================================================
// InMemoryVectorStore Tests
// ============================================================================

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;
  let engine: LocalEmbeddingEngine;

  beforeEach(() => {
    store = new InMemoryVectorStore();
    engine = new LocalEmbeddingEngine(64);
  });

  test('add and retrieve vector', async () => {
    const vector = engine.embedSync('test content');
    await store.add('v1', vector, { type: 'test' });

    const result = store.get('v1');
    expect(result).toBeDefined();
    expect(result!.id).toBe('v1');
    expect(result!.vector).toEqual(vector);
    expect(result!.metadata).toEqual({ type: 'test' });
  });

  test('batch add', async () => {
    const entries = [
      { id: 'a', vector: engine.embedSync('first'), metadata: { idx: 0 } },
      { id: 'b', vector: engine.embedSync('second'), metadata: { idx: 1 } },
      { id: 'c', vector: engine.embedSync('third'), metadata: { idx: 2 } },
    ];

    await store.addBatch(entries);
    expect(store.size()).toBe(3);
    expect(store.get('a')).toBeDefined();
    expect(store.get('b')).toBeDefined();
    expect(store.get('c')).toBeDefined();
  });

  test('search returns top-k by similarity', async () => {
    // Add vectors with known similarity patterns
    const queryText = 'function add numbers';
    await store.add('v1', engine.embedSync('function add(a, b) { return a + b; }'), { name: 'add' });
    await store.add('v2', engine.embedSync('class HttpServer { listen() {} }'), { name: 'server' });
    await store.add('v3', engine.embedSync('function sum(x, y) { return x + y; }'), { name: 'sum' });

    const queryVector = engine.embedSync(queryText);
    const results = await store.search(queryVector, 2);

    expect(results).toHaveLength(2);
    // Results should be sorted by score descending
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
  });

  test('search respects minScore filter', async () => {
    await store.add('v1', engine.embedSync('function hello()'), { name: 'hello' });
    await store.add('v2', engine.embedSync('completely different content about databases'), { name: 'db' });

    const queryVector = engine.embedSync('function hello()');
    const results = await store.search(queryVector, 10, 0.9);

    // Only the very similar vector should pass the high threshold
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0.9);
    }
  });

  test('delete removes vector', async () => {
    await store.add('v1', engine.embedSync('test'), { name: 'test' });
    expect(store.size()).toBe(1);

    await store.delete('v1');
    expect(store.size()).toBe(0);
    expect(store.get('v1')).toBeUndefined();
  });

  test('delete is safe for non-existent id', async () => {
    await store.delete('nonexistent');
    expect(store.size()).toBe(0);
  });

  test('clear empties store', async () => {
    await store.add('v1', engine.embedSync('a'), {});
    await store.add('v2', engine.embedSync('b'), {});
    await store.add('v3', engine.embedSync('c'), {});
    expect(store.size()).toBe(3);

    await store.clear();
    expect(store.size()).toBe(0);
  });

  test('size returns correct count', async () => {
    expect(store.size()).toBe(0);

    await store.add('v1', engine.embedSync('a'), {});
    expect(store.size()).toBe(1);

    await store.add('v2', engine.embedSync('b'), {});
    expect(store.size()).toBe(2);

    await store.delete('v1');
    expect(store.size()).toBe(1);
  });

  test('stats calculation', async () => {
    await store.add('v1', engine.embedSync('hello world'), { type: 'test' });
    await store.add('v2', engine.embedSync('goodbye world'), { type: 'test' });

    const stats = store.getStats();
    expect(stats.totalVectors).toBe(2);
    expect(stats.dimensions).toBe(64);
    expect(stats.memoryEstimate).toBeGreaterThan(0);
  });

  test('stats for empty store', () => {
    const stats = store.getStats();
    expect(stats.totalVectors).toBe(0);
    expect(stats.dimensions).toBe(0);
    expect(stats.memoryEstimate).toBe(0);
  });
});

// ============================================================================
// RAGOrchestrator Tests
// ============================================================================

describe('RAGOrchestrator', () => {
  let orchestrator: RAGOrchestrator;

  beforeEach(() => {
    orchestrator = new RAGOrchestrator({
      chunkSize: 300,
      chunkOverlap: 20,
      embeddingDimension: 64,
      maxResults: 5,
      minScore: 0.1,
    });
  });

  test('index single file', async () => {
    const count = await orchestrator.indexFile(
      'user-service.ts',
      SAMPLE_TS_FILE,
      'typescript',
    );

    expect(count).toBeGreaterThan(0);

    const stats = await orchestrator.getStats();
    expect(stats.totalChunks).toBe(count);
    expect(stats.totalFiles).toBe(1);
  });

  test('index multiple files', async () => {
    const stats = await orchestrator.indexFiles([
      { path: 'user-service.ts', content: SAMPLE_TS_FILE, language: 'typescript' },
      { path: 'processor.py', content: SAMPLE_PY_FILE, language: 'python' },
    ]);

    expect(stats.totalFiles).toBe(2);
    expect(stats.totalChunks).toBeGreaterThan(2);
    expect(stats.languages['typescript']).toBeGreaterThan(0);
    expect(stats.languages['python']).toBeGreaterThan(0);
  });

  test('search returns relevant results', async () => {
    await orchestrator.indexFile('user-service.ts', SAMPLE_TS_FILE, 'typescript');

    const results = await orchestrator.search('getUser function');

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0.1);
      expect(result.chunk).toBeDefined();
      expect(result.chunk.content.length).toBeGreaterThan(0);
    }
  });

  test('search with language filter', async () => {
    await orchestrator.indexFiles([
      { path: 'service.ts', content: SAMPLE_TS_FILE, language: 'typescript' },
      { path: 'processor.py', content: SAMPLE_PY_FILE, language: 'python' },
    ]);

    const tsResults = await orchestrator.search('class', { language: 'typescript' });
    for (const result of tsResults) {
      expect(result.chunk.language).toBe('typescript');
    }

    const pyResults = await orchestrator.search('class', { language: 'python' });
    for (const result of pyResults) {
      expect(result.chunk.language).toBe('python');
    }
  });

  test('remove file clears its chunks', async () => {
    await orchestrator.indexFile('service.ts', SAMPLE_TS_FILE, 'typescript');
    const statsBefore = await orchestrator.getStats();
    expect(statsBefore.totalFiles).toBe(1);
    expect(statsBefore.totalChunks).toBeGreaterThan(0);

    const removed = await orchestrator.removeFile('service.ts');
    expect(removed).toBe(statsBefore.totalChunks);

    const statsAfter = await orchestrator.getStats();
    expect(statsAfter.totalFiles).toBe(0);
    expect(statsAfter.totalChunks).toBe(0);
  });

  test('remove non-existent file returns zero', async () => {
    const removed = await orchestrator.removeFile('nonexistent.ts');
    expect(removed).toBe(0);
  });

  test('stats reflect current state', async () => {
    const emptyStats = await orchestrator.getStats();
    expect(emptyStats.totalChunks).toBe(0);
    expect(emptyStats.totalFiles).toBe(0);

    await orchestrator.indexFile('test.ts', SAMPLE_TS_FILE, 'typescript');

    const stats = await orchestrator.getStats();
    expect(stats.totalChunks).toBeGreaterThan(0);
    expect(stats.totalFiles).toBe(1);
    expect(stats.languages['typescript']).toBe(stats.totalChunks);
    expect(stats.lastUpdated).toBeTruthy();
    expect(stats.indexSize).toBeGreaterThan(0);
  });

  test('clear resets everything', async () => {
    await orchestrator.indexFiles([
      { path: 'a.ts', content: SAMPLE_TS_FILE, language: 'typescript' },
      { path: 'b.py', content: SAMPLE_PY_FILE, language: 'python' },
    ]);

    await orchestrator.clear();

    const stats = await orchestrator.getStats();
    expect(stats.totalChunks).toBe(0);
    expect(stats.totalFiles).toBe(0);
    expect(Object.keys(stats.languages)).toHaveLength(0);
  });

  test('events emitted correctly', async () => {
    const events: Array<{ event: string; data: unknown }> = [];

    orchestrator.on('index:file-added', (data) => events.push({ event: 'index:file-added', data }));
    orchestrator.on('index:file-removed', (data) => events.push({ event: 'index:file-removed', data }));
    orchestrator.on('index:complete', (data) => events.push({ event: 'index:complete', data }));
    orchestrator.on('search:complete', (data) => events.push({ event: 'search:complete', data }));

    await orchestrator.indexFiles([
      { path: 'test.ts', content: SAMPLE_TS_FILE, language: 'typescript' },
    ]);

    await orchestrator.search('function');
    await orchestrator.removeFile('test.ts');

    const eventTypes = events.map((e) => e.event);
    expect(eventTypes).toContain('index:file-added');
    expect(eventTypes).toContain('index:complete');
    expect(eventTypes).toContain('search:complete');
    expect(eventTypes).toContain('index:file-removed');
  });

  test('search with empty index returns empty', async () => {
    const results = await orchestrator.search('anything');
    expect(results).toEqual([]);
  });

  test('full pipeline: index then search then verify relevance', async () => {
    // Index two distinct files
    await orchestrator.indexFiles([
      { path: 'service.ts', content: SAMPLE_TS_FILE, language: 'typescript' },
      { path: 'processor.py', content: SAMPLE_PY_FILE, language: 'python' },
    ]);

    // Search for user-related functionality
    const userResults = await orchestrator.search('user service create delete');
    expect(userResults.length).toBeGreaterThan(0);

    // The top result should come from the TypeScript service file
    const topResult = userResults[0];
    expect(topResult.chunk.filePath).toBe('service.ts');
    expect(topResult.score).toBeGreaterThan(0.1);

    // Search for data processing functionality (Python-specific terms)
    const procResults = await orchestrator.search('DataProcessor process items config dict');
    expect(procResults.length).toBeGreaterThan(0);

    // At least one result should come from the Python file
    const pyResults = procResults.filter((r) => r.chunk.filePath === 'processor.py');
    expect(pyResults.length).toBeGreaterThan(0);
  });

  test('re-indexing a file replaces old chunks', async () => {
    await orchestrator.indexFile('file.ts', SAMPLE_TS_FILE, 'typescript');
    const statsBefore = await orchestrator.getStats();

    // Re-index with different content
    await orchestrator.indexFile('file.ts', SMALL_SNIPPET, 'typescript');
    const statsAfter = await orchestrator.getStats();

    expect(statsAfter.totalFiles).toBe(1);
    // Small snippet should produce fewer chunks than the large file
    expect(statsAfter.totalChunks).toBeLessThan(statsBefore.totalChunks);
  });

  test('search results are sorted by score descending', async () => {
    await orchestrator.indexFile('service.ts', SAMPLE_TS_FILE, 'typescript');

    const results = await orchestrator.search('getUser', { limit: 10, minScore: 0 });

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});
