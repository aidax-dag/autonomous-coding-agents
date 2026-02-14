/**
 * Vector Store Factory
 *
 * Factory function to create vector store instances based on
 * configuration. Supports in-memory, Qdrant, and Weaviate providers.
 *
 * @module core/rag/vector-store-factory
 */

import type { IVectorStore, VectorStoreConfig } from './vector-store-types';
import { InMemoryVectorStore } from './vector-store';
import { QdrantAdapter } from './qdrant-adapter';
import { WeaviateAdapter } from './weaviate-adapter';

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a vector store instance based on the provided configuration.
 *
 * @param config - Configuration specifying provider and options
 * @returns An IVectorStore instance for the requested provider
 * @throws Error if an unknown provider is specified or required config is missing
 *
 * @example
 * ```typescript
 * // In-memory (default, always available)
 * const store = createVectorStore({ provider: 'in-memory' });
 *
 * // Qdrant (requires running Qdrant instance)
 * const store = createVectorStore({
 *   provider: 'qdrant',
 *   qdrant: { url: 'http://localhost:6333', dimension: 384 },
 * });
 *
 * // Weaviate (requires running Weaviate instance)
 * const store = createVectorStore({
 *   provider: 'weaviate',
 *   weaviate: { url: 'http://localhost:8080', dimension: 384 },
 * });
 * ```
 */
export function createVectorStore(config?: VectorStoreConfig): IVectorStore {
  const provider = config?.provider ?? 'in-memory';

  switch (provider) {
    case 'in-memory':
      return new InMemoryVectorStore();

    case 'qdrant': {
      if (!config?.qdrant) {
        throw new Error(
          'Qdrant configuration is required when using the qdrant provider. ' +
          'Provide at minimum: { url, collectionName, dimension }.',
        );
      }
      return new QdrantAdapter(config.qdrant);
    }

    case 'weaviate': {
      if (!config?.weaviate) {
        throw new Error(
          'Weaviate configuration is required when using the weaviate provider. ' +
          'Provide at minimum: { url, className, dimension }.',
        );
      }
      return new WeaviateAdapter(config.weaviate);
    }

    default:
      throw new Error(
        `Unknown vector store provider: '${provider as string}'. ` +
        "Supported providers: 'in-memory', 'qdrant', 'weaviate'.",
      );
  }
}
