/**
 * In-Memory Vector Store
 *
 * Provides storage and retrieval of embedding vectors with brute-force
 * cosine similarity search. Suitable for small to medium datasets
 * (up to ~100K vectors) where the simplicity of in-memory storage
 * outweighs the need for approximate nearest neighbor algorithms.
 *
 * Implements IVectorStore for compatibility with all vector store
 * adapters, while preserving backward-compatible synchronous methods.
 *
 * @module core/rag/vector-store
 */

import type { EmbeddingVector } from './types';
import type {
  IVectorStore,
  VectorSearchResult,
  VectorEntry,
} from './vector-store-types';

// ============================================================================
// Re-export types for backward compatibility
// ============================================================================

export type { VectorSearchResult } from './vector-store-types';

/** Statistics about the vector store */
export interface VectorStoreStats {
  /** Total number of stored vectors */
  totalVectors: number;
  /** Dimension of stored vectors (0 if empty) */
  dimensions: number;
  /** Estimated memory usage in bytes */
  memoryEstimate: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class InMemoryVectorStore implements IVectorStore {
  private vectors: Map<string, EmbeddingVector> = new Map();

  /**
   * Add a single vector to the store.
   */
  async add(id: string, vector: number[], metadata: Record<string, unknown> = {}): Promise<void> {
    this.vectors.set(id, { id, vector, metadata });
  }

  /**
   * Add multiple vectors in a single operation.
   */
  async addBatch(entries: Array<{ id: string; vector: number[]; metadata?: Record<string, unknown> }>): Promise<void> {
    for (const entry of entries) {
      this.vectors.set(entry.id, {
        id: entry.id,
        vector: entry.vector,
        metadata: entry.metadata ?? {},
      });
    }
  }

  /**
   * Search for the most similar vectors to a query vector.
   *
   * Uses brute-force cosine similarity comparison against all stored
   * vectors. Results are sorted by descending score and filtered by
   * minimum score threshold.
   *
   * @param queryVector - The query embedding vector
   * @param topK - Maximum number of results to return (default: 10)
   * @param filterOrMinScore - Either a minimum score number (legacy) or filter object (IVectorStore)
   */
  async search(
    queryVector: number[],
    topK: number = 10,
    filterOrMinScore: number | Record<string, unknown> = 0,
  ): Promise<VectorSearchResult[]> {
    const minScore = typeof filterOrMinScore === 'number' ? filterOrMinScore : 0;
    const filter = typeof filterOrMinScore === 'object' ? filterOrMinScore : undefined;

    const results: VectorSearchResult[] = [];

    for (const entry of this.vectors.values()) {
      // Apply metadata filter if provided
      if (filter && !this.matchesFilter(entry.metadata, filter)) {
        continue;
      }

      const score = this.cosineSimilarity(queryVector, entry.vector);

      if (score >= minScore) {
        results.push({
          id: entry.id,
          score,
          metadata: entry.metadata,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Retrieve a single vector by ID (legacy synchronous method).
   */
  get(id: string): EmbeddingVector | undefined {
    return this.vectors.get(id);
  }

  /**
   * Retrieve a single vector entry by ID (IVectorStore interface).
   */
  async getById(id: string): Promise<VectorEntry | null> {
    const entry = this.vectors.get(id);
    if (!entry) {
      return null;
    }
    return {
      id: entry.id,
      vector: entry.vector,
      metadata: entry.metadata,
    };
  }

  /**
   * Delete a vector by ID.
   */
  async delete(id: string): Promise<void> {
    this.vectors.delete(id);
  }

  /**
   * Remove all vectors from the store.
   */
  async clear(): Promise<void> {
    this.vectors.clear();
  }

  /**
   * Get the number of stored vectors (IVectorStore interface).
   */
  async count(): Promise<number> {
    return this.vectors.size;
  }

  /**
   * Get the number of stored vectors (legacy synchronous method).
   */
  size(): number {
    return this.vectors.size;
  }

  /**
   * Get statistics about the store's current state.
   */
  getStats(): VectorStoreStats {
    let dimensions = 0;
    let memoryEstimate = 0;

    for (const entry of this.vectors.values()) {
      if (dimensions === 0 && entry.vector.length > 0) {
        dimensions = entry.vector.length;
      }

      // Estimate: 8 bytes per float64 + ID string + metadata overhead
      memoryEstimate += entry.vector.length * 8;
      memoryEstimate += entry.id.length * 2;
      memoryEstimate += JSON.stringify(entry.metadata).length * 2;
    }

    return {
      totalVectors: this.vectors.size,
      dimensions,
      memoryEstimate,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Check if metadata matches a simple equality filter.
   */
  private matchesFilter(
    metadata: Record<string, unknown>,
    filter: Record<string, unknown>,
  ): boolean {
    for (const [key, value] of Object.entries(filter)) {
      if (metadata[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Compute cosine similarity between two vectors.
   *
   * Returns 0 for zero-magnitude vectors. For well-formed normalized
   * vectors, returns a value in [-1, 1].
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    const len = Math.min(a.length, b.length);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);

    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }
}
