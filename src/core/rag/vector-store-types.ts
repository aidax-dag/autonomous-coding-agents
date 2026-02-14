/**
 * Vector Store Interface and Types
 *
 * Defines the IVectorStore interface that all vector store adapters
 * implement, along with shared types for vector search results,
 * entries, and configuration.
 *
 * @module core/rag/vector-store-types
 */

// ============================================================================
// Core Types
// ============================================================================

/** Result entry from a vector similarity search */
export interface VectorSearchResult {
  /** ID of the matched vector */
  id: string;
  /** Similarity score (higher is more similar) */
  score: number;
  /** The stored vector (optional, not all backends return it) */
  vector?: number[];
  /** Associated metadata */
  metadata?: Record<string, unknown>;
}

/** A stored vector entry with its metadata */
export interface VectorEntry {
  /** Unique identifier */
  id: string;
  /** Numerical vector representation */
  vector: number[];
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Common interface for all vector store implementations.
 *
 * Implementations include:
 * - InMemoryVectorStore (brute-force cosine similarity, always available)
 * - QdrantAdapter (Qdrant HTTP API)
 * - WeaviateAdapter (Weaviate REST/GraphQL API)
 */
export interface IVectorStore {
  /** Add a single vector to the store. */
  add(id: string, vector: number[], metadata?: Record<string, unknown>): Promise<void>;

  /** Add multiple vectors in a single batch operation. */
  addBatch(items: Array<{ id: string; vector: number[]; metadata?: Record<string, unknown> }>): Promise<void>;

  /** Search for the most similar vectors to a query vector. */
  search(query: number[], topK?: number, filter?: Record<string, unknown>): Promise<VectorSearchResult[]>;

  /** Delete a vector by ID. */
  delete(id: string): Promise<void>;

  /** Remove all vectors from the store. */
  clear(): Promise<void>;

  /** Get the total number of stored vectors. */
  count(): Promise<number>;

  /** Retrieve a single vector entry by ID. */
  getById(id: string): Promise<VectorEntry | null>;
}

// ============================================================================
// Configuration
// ============================================================================

/** Qdrant vector database configuration */
export interface QdrantConfig {
  /** Qdrant HTTP API URL (default: http://localhost:6333) */
  url: string;
  /** Collection name (default: 'aca-vectors') */
  collectionName: string;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Vector dimension (required) */
  dimension: number;
  /** Distance metric (default: 'Cosine') */
  distance?: 'Cosine' | 'Euclid' | 'Dot';
}

/** Weaviate vector database configuration */
export interface WeaviateConfig {
  /** Weaviate HTTP API URL (default: http://localhost:8080) */
  url: string;
  /** Class name for the schema (default: 'ACAVector') */
  className: string;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Vector dimension (required) */
  dimension: number;
}

/** Supported vector store providers */
export type VectorStoreProvider = 'in-memory' | 'qdrant' | 'weaviate';

/** Configuration for the vector store factory */
export interface VectorStoreConfig {
  /** Provider to use (default: 'in-memory') */
  provider: VectorStoreProvider;
  /** Qdrant-specific configuration */
  qdrant?: QdrantConfig;
  /** Weaviate-specific configuration */
  weaviate?: WeaviateConfig;
  /** In-memory store configuration */
  inMemory?: { dimension?: number };
}
