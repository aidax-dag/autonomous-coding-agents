/**
 * Qdrant Vector Database Adapter
 *
 * Provides IVectorStore integration with Qdrant via its HTTP REST API.
 * Uses Node.js native fetch, no external dependencies required.
 * Qdrant must be running and accessible at the configured URL.
 *
 * @module core/rag/qdrant-adapter
 */

import type {
  IVectorStore,
  VectorSearchResult,
  VectorEntry,
  QdrantConfig,
} from './vector-store-types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_URL = 'http://localhost:6333';
const DEFAULT_COLLECTION = 'aca-vectors';
const DEFAULT_DISTANCE: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine';

// ============================================================================
// Implementation
// ============================================================================

export class QdrantAdapter implements IVectorStore {
  private readonly url: string;
  private readonly collectionName: string;
  private readonly apiKey: string | undefined;
  private readonly dimension: number;
  private readonly distance: 'Cosine' | 'Euclid' | 'Dot';
  private initialized: boolean = false;

  constructor(config: QdrantConfig) {
    if (!config.dimension || config.dimension < 1) {
      throw new Error(`Qdrant vector dimension must be a positive integer, got ${config.dimension}`);
    }

    this.url = (config.url ?? DEFAULT_URL).replace(/\/+$/, '');
    this.collectionName = config.collectionName ?? DEFAULT_COLLECTION;
    this.apiKey = config.apiKey;
    this.dimension = config.dimension;
    this.distance = config.distance ?? DEFAULT_DISTANCE;
  }

  /**
   * Add a single vector to the Qdrant collection.
   */
  async add(id: string, vector: number[], metadata?: Record<string, unknown>): Promise<void> {
    await this.ensureCollection();

    const pointId = this.stringToPointId(id);

    await this.request('PUT', `/collections/${this.collectionName}/points`, {
      points: [
        {
          id: pointId,
          vector,
          payload: { _originalId: id, ...metadata },
        },
      ],
    });
  }

  /**
   * Add multiple vectors in a single batch operation.
   */
  async addBatch(items: Array<{ id: string; vector: number[]; metadata?: Record<string, unknown> }>): Promise<void> {
    if (items.length === 0) {
      return;
    }

    await this.ensureCollection();

    const points = items.map((item) => ({
      id: this.stringToPointId(item.id),
      vector: item.vector,
      payload: { _originalId: item.id, ...item.metadata },
    }));

    await this.request('PUT', `/collections/${this.collectionName}/points`, {
      points,
    });
  }

  /**
   * Search for the most similar vectors using Qdrant's search endpoint.
   */
  async search(
    query: number[],
    topK: number = 10,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    await this.ensureCollection();

    const body: Record<string, unknown> = {
      vector: query,
      limit: topK,
      with_payload: true,
      with_vector: false,
    };

    if (filter && Object.keys(filter).length > 0) {
      body.filter = this.buildQdrantFilter(filter);
    }

    const data = await this.request('POST', `/collections/${this.collectionName}/points/search`, body);

    const result = data as { result?: Array<{ id: number; score: number; payload?: Record<string, unknown> }> };

    if (!result.result || !Array.isArray(result.result)) {
      return [];
    }

    return result.result.map((hit) => ({
      id: (hit.payload?._originalId as string) ?? String(hit.id),
      score: hit.score,
      metadata: this.stripInternalPayload(hit.payload),
    }));
  }

  /**
   * Delete a vector by its original string ID.
   */
  async delete(id: string): Promise<void> {
    await this.ensureCollection();

    const pointId = this.stringToPointId(id);

    await this.request('POST', `/collections/${this.collectionName}/points/delete`, {
      points: [pointId],
    });
  }

  /**
   * Clear all vectors by deleting and recreating the collection.
   */
  async clear(): Promise<void> {
    try {
      await this.request('DELETE', `/collections/${this.collectionName}`);
    } catch {
      // Collection may not exist, ignore
    }

    this.initialized = false;
    await this.ensureCollection();
  }

  /**
   * Get the total number of vectors in the collection.
   */
  async count(): Promise<number> {
    await this.ensureCollection();

    const data = await this.request('GET', `/collections/${this.collectionName}`);
    const result = data as { result?: { points_count?: number } };

    return result.result?.points_count ?? 0;
  }

  /**
   * Retrieve a single vector entry by its original string ID.
   */
  async getById(id: string): Promise<VectorEntry | null> {
    await this.ensureCollection();

    const pointId = this.stringToPointId(id);

    try {
      const data = await this.request(
        'GET',
        `/collections/${this.collectionName}/points/${pointId}`,
      );
      const result = data as {
        result?: {
          id: number;
          vector?: number[];
          payload?: Record<string, unknown>;
        };
      };

      if (!result.result) {
        return null;
      }

      return {
        id: (result.result.payload?._originalId as string) ?? id,
        vector: result.result.vector ?? [],
        metadata: this.stripInternalPayload(result.result.payload),
      };
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Create the collection if it does not already exist.
   */
  private async ensureCollection(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.request('GET', `/collections/${this.collectionName}`);
      this.initialized = true;
      return;
    } catch {
      // Collection does not exist, create it
    }

    await this.request('PUT', `/collections/${this.collectionName}`, {
      vectors: {
        size: this.dimension,
        distance: this.distance,
      },
    });

    this.initialized = true;
  }

  /**
   * Execute an HTTP request against the Qdrant API.
   */
  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.url}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }

    const options: RequestInit = { method, headers };
    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetch(url, options);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
        throw new Error(
          `Qdrant connection refused at ${this.url}. ` +
          'Ensure Qdrant is running and accessible.',
        );
      }
      throw new Error(`Qdrant request failed: ${message}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');

      if (response.status === 404) {
        if (errorBody.includes('Not found') || errorBody.includes('not found')) {
          throw new Error(
            `Qdrant collection '${this.collectionName}' not found.`,
          );
        }
        throw new Error(`Qdrant resource not found: ${path}`);
      }

      if (errorBody.includes('dimension') || errorBody.includes('Dimension')) {
        throw new Error(
          `Qdrant dimension mismatch: expected ${this.dimension}. ${errorBody}`,
        );
      }

      throw new Error(
        `Qdrant API error (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Convert a string ID to a numeric point ID via FNV-1a hash.
   * Qdrant supports both integer and UUID point IDs. We use
   * positive integers derived from hashing the original string ID.
   */
  private stringToPointId(id: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i++) {
      hash ^= id.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    // Ensure positive 32-bit integer
    return hash >>> 0;
  }

  /**
   * Build a Qdrant filter from a simple key-value object.
   */
  private buildQdrantFilter(
    filter: Record<string, unknown>,
  ): Record<string, unknown> {
    const must = Object.entries(filter).map(([key, value]) => ({
      key,
      match: { value },
    }));

    return { must };
  }

  /**
   * Remove internal payload fields from metadata.
   */
  private stripInternalPayload(
    payload?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!payload) {
      return undefined;
    }

    const rest = Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== '_originalId'),
    );
    return Object.keys(rest).length > 0 ? rest : undefined;
  }
}
