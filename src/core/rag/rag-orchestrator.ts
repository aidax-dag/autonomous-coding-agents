/**
 * RAG Orchestrator
 *
 * Coordinates the full RAG pipeline: file ingestion, chunking, embedding,
 * indexing, and semantic search. Provides event-driven notifications
 * for index updates and search operations.
 *
 * Accepts any IVectorStore implementation, defaulting to InMemoryVectorStore
 * for backward compatibility.
 *
 * @module core/rag/rag-orchestrator
 */

import { EventEmitter } from 'events';
import type { CodeChunk, RAGConfig, IndexStats, SearchResult } from './types';
import { DEFAULT_RAG_CONFIG } from './types';
import { CodeChunkStrategy } from './chunk-strategy';
import type { IEmbeddingEngine } from './embedding-engine';
import { LocalEmbeddingEngine } from './embedding-engine';
import type { IVectorStore } from './vector-store-types';
import { InMemoryVectorStore } from './vector-store';

// ============================================================================
// Types
// ============================================================================

/** Options for search queries */
export interface SearchOptions {
  /** Maximum number of results (overrides config.maxResults) */
  limit?: number;
  /** Minimum similarity score (overrides config.minScore) */
  minScore?: number;
  /** Filter results to a specific language */
  language?: string;
}

/** Input format for file indexing */
export interface FileInput {
  /** File path */
  path: string;
  /** File content */
  content: string;
  /** Programming language identifier */
  language: string;
}

// ============================================================================
// Events
// ============================================================================

export interface RAGEvents {
  'index:file-added': { filePath: string; chunkCount: number };
  'index:file-removed': { filePath: string; chunkCount: number };
  'index:complete': { stats: IndexStats };
  'search:complete': { query: string; resultCount: number; duration: number };
}

// ============================================================================
// Implementation
// ============================================================================

export class RAGOrchestrator extends EventEmitter {
  private readonly chunkStrategy: CodeChunkStrategy;
  private readonly embeddingEngine: IEmbeddingEngine;
  private readonly vectorStore: IVectorStore;
  private readonly chunks: Map<string, CodeChunk> = new Map();
  private readonly config: RAGConfig;
  private readonly fileIndex: Map<string, Set<string>> = new Map(); // filePath -> chunkIds
  private lastUpdated: string = '';

  constructor(
    config?: Partial<RAGConfig>,
    embeddingEngine?: IEmbeddingEngine,
    vectorStore?: IVectorStore,
  ) {
    super();
    this.config = { ...DEFAULT_RAG_CONFIG, ...config };

    this.chunkStrategy = new CodeChunkStrategy(
      this.config.chunkSize,
      this.config.chunkOverlap,
    );
    this.embeddingEngine = embeddingEngine ?? new LocalEmbeddingEngine(this.config.embeddingDimension);
    this.vectorStore = vectorStore ?? new InMemoryVectorStore();
  }

  /**
   * Index multiple files in batch.
   * Returns aggregated statistics after indexing is complete.
   */
  async indexFiles(files: FileInput[]): Promise<IndexStats> {
    for (const file of files) {
      await this.indexFile(file.path, file.content, file.language);
    }

    this.lastUpdated = new Date().toISOString();
    const stats = await this.getStats();

    this.emit('index:complete', { stats });

    return stats;
  }

  /**
   * Index a single file: chunk, embed, and store.
   * If the file was previously indexed, its old chunks are replaced.
   *
   * @returns The number of chunks created from this file
   */
  async indexFile(filePath: string, content: string, language: string): Promise<number> {
    // Remove existing chunks for this file if re-indexing
    if (this.fileIndex.has(filePath)) {
      await this.removeFile(filePath);
    }

    const codeChunks = this.chunkStrategy.chunkFile(content, filePath, language);

    if (codeChunks.length === 0) {
      return 0;
    }

    // Generate embeddings
    const texts = codeChunks.map((chunk) => chunk.content);
    const vectors = await this.embeddingEngine.embedBatch(texts);

    // Store chunks and vectors
    const chunkIds = new Set<string>();
    const batchEntries: Array<{ id: string; vector: number[]; metadata: Record<string, unknown> }> = [];

    for (let i = 0; i < codeChunks.length; i++) {
      const chunk = codeChunks[i];
      this.chunks.set(chunk.id, chunk);
      chunkIds.add(chunk.id);

      batchEntries.push({
        id: chunk.id,
        vector: vectors[i],
        metadata: {
          filePath: chunk.filePath,
          language: chunk.language,
          type: chunk.type,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          name: chunk.metadata.name,
        },
      });
    }

    await this.vectorStore.addBatch(batchEntries);
    this.fileIndex.set(filePath, chunkIds);
    this.lastUpdated = new Date().toISOString();

    this.emit('index:file-added', { filePath, chunkCount: codeChunks.length });

    return codeChunks.length;
  }

  /**
   * Search the index for code chunks matching a natural language query.
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const startTime = Date.now();

    const limit = options?.limit ?? this.config.maxResults;
    const minScore = options?.minScore ?? this.config.minScore;

    // Embed the query
    const queryVector = await this.embeddingEngine.embed(query);

    // Search vector store (request more results to allow for post-filtering)
    const searchLimit = options?.language ? limit * 3 : limit;
    const vectorResults = await this.vectorStore.search(queryVector, searchLimit);

    // Map vector results back to code chunks with score and language filtering
    const results: SearchResult[] = [];

    for (const vr of vectorResults) {
      // Apply minimum score filter
      if (vr.score < minScore) {
        continue;
      }

      const chunk = this.chunks.get(vr.id);
      if (!chunk) continue;

      // Apply language filter
      if (options?.language && chunk.language !== options.language) {
        continue;
      }

      results.push({
        chunk,
        score: vr.score,
      });

      if (results.length >= limit) {
        break;
      }
    }

    const duration = Date.now() - startTime;
    this.emit('search:complete', { query, resultCount: results.length, duration });

    return results;
  }

  /**
   * Remove all chunks associated with a file from the index.
   *
   * @returns The number of chunks removed
   */
  async removeFile(filePath: string): Promise<number> {
    const chunkIds = this.fileIndex.get(filePath);
    if (!chunkIds) {
      return 0;
    }

    let removedCount = 0;

    for (const id of chunkIds) {
      this.chunks.delete(id);
      await this.vectorStore.delete(id);
      removedCount++;
    }

    this.fileIndex.delete(filePath);
    this.lastUpdated = new Date().toISOString();

    this.emit('index:file-removed', { filePath, chunkCount: removedCount });

    return removedCount;
  }

  /**
   * Get current index statistics.
   */
  async getStats(): Promise<IndexStats> {
    const languages: Record<string, number> = {};

    for (const chunk of this.chunks.values()) {
      languages[chunk.language] = (languages[chunk.language] ?? 0) + 1;
    }

    // Calculate memory estimate from vector count and assumed dimensions
    const vectorCount = await this.vectorStore.count();
    const memoryEstimate = vectorCount * this.config.embeddingDimension * 8;

    return {
      totalChunks: this.chunks.size,
      totalFiles: this.fileIndex.size,
      languages,
      lastUpdated: this.lastUpdated || new Date().toISOString(),
      indexSize: memoryEstimate,
    };
  }

  /**
   * Clear all indexed data and reset state.
   */
  async clear(): Promise<void> {
    this.chunks.clear();
    await this.vectorStore.clear();
    this.fileIndex.clear();
    this.lastUpdated = '';
  }
}
