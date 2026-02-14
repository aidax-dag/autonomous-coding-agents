/**
 * RAG (Retrieval-Augmented Generation) Module
 *
 * Provides code-aware semantic search through embedding-based
 * vector similarity. Includes chunking, embedding, storage, and
 * orchestration components.
 *
 * @module core/rag
 */

export type {
  CodeChunk,
  ChunkType,
  EmbeddingVector,
  SearchResult,
  RAGConfig,
  IndexStats,
} from './types';
export { DEFAULT_RAG_CONFIG } from './types';

export { CodeChunkStrategy } from './chunk-strategy';

// Embedding engines and interface
export type { IEmbeddingEngine } from './embedding-engine';
export { LocalEmbeddingEngine } from './embedding-engine';
export { OllamaEmbeddingEngine } from './ollama-embedding-engine';
export type { OllamaEmbeddingConfig } from './ollama-embedding-engine';
export { HuggingFaceEmbeddingEngine } from './huggingface-embedding-engine';
export type { HuggingFaceEmbeddingConfig } from './huggingface-embedding-engine';

// Embedding factory
export { createEmbeddingEngine } from './embedding-factory';
export type { EmbeddingProvider, EmbeddingConfig } from './embedding-factory';

// Dimension adapter
export { DimensionAdapter } from './dimension-adapter';

// Vector store interface and types
export type {
  IVectorStore,
  VectorEntry,
  QdrantConfig,
  WeaviateConfig,
  VectorStoreProvider,
  VectorStoreConfig,
} from './vector-store-types';

// Vector store implementations
export { InMemoryVectorStore } from './vector-store';
export type { VectorSearchResult, VectorStoreStats } from './vector-store';
export { QdrantAdapter } from './qdrant-adapter';
export { WeaviateAdapter } from './weaviate-adapter';

// Vector store factory
export { createVectorStore } from './vector-store-factory';

// Orchestrator
export { RAGOrchestrator } from './rag-orchestrator';
export type { SearchOptions, FileInput, RAGEvents } from './rag-orchestrator';
