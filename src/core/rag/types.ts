/**
 * RAG (Retrieval-Augmented Generation) Types
 *
 * Core type definitions for the code search RAG system including
 * code chunks, embedding vectors, search results, and configuration.
 *
 * @module core/rag/types
 */

// ============================================================================
// Code Chunk Types
// ============================================================================

/** Type classification for code chunks */
export type ChunkType = 'function' | 'class' | 'method' | 'import' | 'block' | 'comment';

/** A discrete unit of code extracted from a source file */
export interface CodeChunk {
  /** Unique identifier for this chunk */
  id: string;
  /** The source code content */
  content: string;
  /** Absolute or relative file path */
  filePath: string;
  /** Programming language identifier */
  language: string;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Structural classification of the chunk */
  type: ChunkType;
  /** Additional metadata extracted from the code */
  metadata: {
    /** Name of the function, class, or method */
    name?: string;
    /** Estimated cyclomatic complexity */
    complexity?: number;
    /** Import or dependency references */
    dependencies?: string[];
  };
}

// ============================================================================
// Embedding Types
// ============================================================================

/** A vector representation of a code chunk with associated metadata */
export interface EmbeddingVector {
  /** Unique identifier matching the source chunk */
  id: string;
  /** Numerical vector representation */
  vector: number[];
  /** Arbitrary metadata for filtering and context */
  metadata: Record<string, unknown>;
}

// ============================================================================
// Search Types
// ============================================================================

/** A single search result with relevance scoring */
export interface SearchResult {
  /** The matched code chunk */
  chunk: CodeChunk;
  /** Cosine similarity score (0-1, higher is more similar) */
  score: number;
  /** Optional highlighted matching segments */
  highlights?: string[];
}

// ============================================================================
// Configuration
// ============================================================================

/** Configuration parameters for the RAG system */
export interface RAGConfig {
  /** Maximum chunk size in characters (default: 500) */
  chunkSize: number;
  /** Overlap between consecutive chunks in characters (default: 50) */
  chunkOverlap: number;
  /** Dimensionality of embedding vectors (default: 128) */
  embeddingDimension: number;
  /** Maximum number of search results to return (default: 10) */
  maxResults: number;
  /** Minimum similarity score threshold (default: 0.3) */
  minScore: number;
  /** Interval between automatic index updates in ms (default: 300000) */
  indexUpdateInterval: number;
}

/** Default RAG configuration values */
export const DEFAULT_RAG_CONFIG: RAGConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  embeddingDimension: 128,
  maxResults: 10,
  minScore: 0.3,
  indexUpdateInterval: 300_000,
};

// ============================================================================
// Index Statistics
// ============================================================================

/** Statistics about the current state of the RAG index */
export interface IndexStats {
  /** Total number of indexed chunks */
  totalChunks: number;
  /** Total number of indexed files */
  totalFiles: number;
  /** Chunk count grouped by programming language */
  languages: Record<string, number>;
  /** ISO timestamp of last index update */
  lastUpdated: string;
  /** Estimated memory usage in bytes */
  indexSize: number;
}
