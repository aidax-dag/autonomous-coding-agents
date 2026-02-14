/**
 * Weaviate Vector Database Adapter
 *
 * Provides IVectorStore integration with Weaviate via its REST and
 * GraphQL APIs. Uses Node.js native fetch, no external dependencies.
 * Weaviate must be running and accessible at the configured URL.
 *
 * @module core/rag/weaviate-adapter
 */

import type {
  IVectorStore,
  VectorSearchResult,
  VectorEntry,
  WeaviateConfig,
} from './vector-store-types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_URL = 'http://localhost:8080';
const DEFAULT_CLASS_NAME = 'ACAVector';

// ============================================================================
// Implementation
// ============================================================================

export class WeaviateAdapter implements IVectorStore {
  private readonly url: string;
  private readonly className: string;
  private readonly apiKey: string | undefined;
  private readonly dimension: number;
  private initialized: boolean = false;

  constructor(config: WeaviateConfig) {
    if (!config.dimension || config.dimension < 1) {
      throw new Error(`Weaviate vector dimension must be a positive integer, got ${config.dimension}`);
    }

    this.url = (config.url ?? DEFAULT_URL).replace(/\/+$/, '');
    this.className = config.className ?? DEFAULT_CLASS_NAME;
    this.apiKey = config.apiKey;
    this.dimension = config.dimension;
  }

  /**
   * Add a single vector to the Weaviate class.
   */
  async add(id: string, vector: number[], metadata?: Record<string, unknown>): Promise<void> {
    await this.ensureSchema();

    const properties = this.toWeaviateProperties(id, metadata);

    await this.request('POST', '/v1/objects', {
      class: this.className,
      id: this.toWeaviateId(id),
      vector,
      properties,
    });
  }

  /**
   * Add multiple vectors in a single batch operation.
   */
  async addBatch(items: Array<{ id: string; vector: number[]; metadata?: Record<string, unknown> }>): Promise<void> {
    if (items.length === 0) {
      return;
    }

    await this.ensureSchema();

    const objects = items.map((item) => ({
      class: this.className,
      id: this.toWeaviateId(item.id),
      vector: item.vector,
      properties: this.toWeaviateProperties(item.id, item.metadata),
    }));

    await this.request('POST', '/v1/batch/objects', { objects });
  }

  /**
   * Search for the most similar vectors using Weaviate's GraphQL nearVector.
   */
  async search(
    query: number[],
    topK: number = 10,
    filter?: Record<string, unknown>,
  ): Promise<VectorSearchResult[]> {
    await this.ensureSchema();

    let whereClause = '';
    if (filter && Object.keys(filter).length > 0) {
      whereClause = this.buildWhereClause(filter);
    }

    const graphql = `{
      Get {
        ${this.className}(
          nearVector: { vector: [${query.join(',')}] }
          limit: ${topK}
          ${whereClause}
        ) {
          _additional {
            id
            distance
          }
          _originalId
          _metadataJson
        }
      }
    }`;

    const data = await this.request('POST', '/v1/graphql', { query: graphql });
    const result = data as {
      data?: {
        Get?: Record<string, Array<{
          _additional?: { id?: string; distance?: number };
          _originalId?: string;
          _metadataJson?: string;
        }>>;
      };
    };

    const hits = result.data?.Get?.[this.className];
    if (!hits || !Array.isArray(hits)) {
      return [];
    }

    return hits.map((hit) => {
      const distance = hit._additional?.distance ?? 0;
      // Weaviate returns distance (lower is better), convert to score (higher is better)
      const score = 1 - distance;

      let metadata: Record<string, unknown> | undefined;
      if (hit._metadataJson) {
        try {
          metadata = JSON.parse(hit._metadataJson) as Record<string, unknown>;
        } catch {
          metadata = undefined;
        }
      }

      return {
        id: hit._originalId ?? hit._additional?.id ?? '',
        score,
        metadata,
      };
    });
  }

  /**
   * Delete a vector by its original string ID.
   */
  async delete(id: string): Promise<void> {
    await this.ensureSchema();

    const weaviateId = this.toWeaviateId(id);

    try {
      await this.request('DELETE', `/v1/objects/${this.className}/${weaviateId}`);
    } catch {
      // Object may not exist, ignore
    }
  }

  /**
   * Clear all vectors by deleting and recreating the class schema.
   */
  async clear(): Promise<void> {
    try {
      await this.request('DELETE', `/v1/schema/${this.className}`);
    } catch {
      // Class may not exist, ignore
    }

    this.initialized = false;
    await this.ensureSchema();
  }

  /**
   * Get the total number of vectors in the class.
   */
  async count(): Promise<number> {
    await this.ensureSchema();

    const graphql = `{
      Aggregate {
        ${this.className} {
          meta {
            count
          }
        }
      }
    }`;

    const data = await this.request('POST', '/v1/graphql', { query: graphql });
    const result = data as {
      data?: {
        Aggregate?: Record<string, Array<{
          meta?: { count?: number };
        }>>;
      };
    };

    const aggregation = result.data?.Aggregate?.[this.className];
    if (!aggregation || aggregation.length === 0) {
      return 0;
    }

    return aggregation[0].meta?.count ?? 0;
  }

  /**
   * Retrieve a single vector entry by its original string ID.
   */
  async getById(id: string): Promise<VectorEntry | null> {
    await this.ensureSchema();

    const weaviateId = this.toWeaviateId(id);

    try {
      const data = await this.request(
        'GET',
        `/v1/objects/${this.className}/${weaviateId}?include=vector`,
      );
      const result = data as {
        id?: string;
        vector?: number[];
        properties?: {
          _originalId?: string;
          _metadataJson?: string;
        };
      };

      if (!result.id) {
        return null;
      }

      let metadata: Record<string, unknown> | undefined;
      if (result.properties?._metadataJson) {
        try {
          metadata = JSON.parse(result.properties._metadataJson) as Record<string, unknown>;
        } catch {
          metadata = undefined;
        }
      }

      return {
        id: result.properties?._originalId ?? id,
        vector: result.vector ?? [],
        metadata,
      };
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Internal Methods
  // ==========================================================================

  /**
   * Create the class schema if it does not already exist.
   */
  private async ensureSchema(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.request('GET', `/v1/schema/${this.className}`);
      this.initialized = true;
      return;
    } catch {
      // Class does not exist, create it
    }

    await this.request('POST', '/v1/schema', {
      class: this.className,
      vectorizer: 'none',
      properties: [
        {
          name: '_originalId',
          dataType: ['text'],
          description: 'Original string ID from the application',
        },
        {
          name: '_metadataJson',
          dataType: ['text'],
          description: 'JSON-serialized metadata',
        },
      ],
    });

    this.initialized = true;
  }

  /**
   * Execute an HTTP request against the Weaviate API.
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
      headers['Authorization'] = `Bearer ${this.apiKey}`;
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
          `Weaviate connection refused at ${this.url}. ` +
          'Ensure Weaviate is running and accessible.',
        );
      }
      throw new Error(`Weaviate request failed: ${message}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');

      if (response.status === 404) {
        throw new Error(
          `Weaviate class '${this.className}' not found.`,
        );
      }

      if (errorBody.includes('schema') || errorBody.includes('Schema')) {
        throw new Error(
          `Weaviate schema mismatch for class '${this.className}': ${errorBody}`,
        );
      }

      throw new Error(
        `Weaviate API error (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    const text = await response.text();
    if (!text) {
      return {};
    }

    return JSON.parse(text);
  }

  /**
   * Convert a string ID to a deterministic Weaviate UUID.
   * Generates a UUID v5-like format from FNV-1a hash of the string.
   */
  private toWeaviateId(id: string): string {
    let hash1 = 0x811c9dc5;
    let hash2 = 0x811c9dc5;

    for (let i = 0; i < id.length; i++) {
      hash1 ^= id.charCodeAt(i);
      hash1 = Math.imul(hash1, 0x01000193);
    }
    // Second hash with different seed for more bits
    for (let i = id.length - 1; i >= 0; i--) {
      hash2 ^= id.charCodeAt(i);
      hash2 = Math.imul(hash2, 0x01000193);
    }

    const h1 = (hash1 >>> 0).toString(16).padStart(8, '0');
    const h2 = (hash2 >>> 0).toString(16).padStart(8, '0');

    // Format as UUID: 8-4-4-4-12
    return `${h1}-${h2.slice(0, 4)}-4${h2.slice(5, 8)}-8${h1.slice(1, 4)}-${h1}${h2.slice(0, 4)}`;
  }

  /**
   * Convert metadata to Weaviate properties format.
   * Stores the original ID and serialized metadata as properties.
   */
  private toWeaviateProperties(
    id: string,
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {
      _originalId: id,
    };

    if (metadata && Object.keys(metadata).length > 0) {
      properties._metadataJson = JSON.stringify(metadata);
    }

    return properties;
  }

  /**
   * Build a Weaviate where clause from a simple key-value filter.
   * Uses the _metadataJson field for filtering since metadata is
   * stored as serialized JSON.
   */
  private buildWhereClause(filter: Record<string, unknown>): string {
    const conditions = Object.entries(filter).map(([key, value]) => {
      const valueStr = typeof value === 'string' ? `"${value}"` : String(value);
      return `{ path: ["_metadataJson"], operator: Like, valueText: "*\\"${key}\\"*${valueStr}*" }`;
    });

    if (conditions.length === 1) {
      return `where: ${conditions[0]}`;
    }

    return `where: { operator: And, operands: [${conditions.join(', ')}] }`;
  }
}
