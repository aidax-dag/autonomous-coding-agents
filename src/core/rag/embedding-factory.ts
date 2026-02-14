/**
 * Embedding Engine Factory
 *
 * Factory function to create embedding engines based on configuration.
 * Supports local (n-gram), Ollama, and HuggingFace providers with
 * a fallback to the local engine for backward compatibility.
 *
 * @module core/rag/embedding-factory
 */

import type { IEmbeddingEngine } from './embedding-engine';
import { LocalEmbeddingEngine } from './embedding-engine';
import type { OllamaEmbeddingConfig } from './ollama-embedding-engine';
import { OllamaEmbeddingEngine } from './ollama-embedding-engine';
import type { HuggingFaceEmbeddingConfig } from './huggingface-embedding-engine';
import { HuggingFaceEmbeddingEngine } from './huggingface-embedding-engine';

// ============================================================================
// Types
// ============================================================================

/** Supported embedding providers */
export type EmbeddingProvider = 'local' | 'ollama' | 'huggingface';

/** Configuration for the embedding engine factory */
export interface EmbeddingConfig {
  /** Provider to use (default: 'local') */
  provider: EmbeddingProvider;
  /** Ollama-specific configuration */
  ollama?: OllamaEmbeddingConfig;
  /** HuggingFace-specific configuration */
  huggingface?: HuggingFaceEmbeddingConfig;
  /** Local engine configuration */
  local?: { dimension?: number };
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an embedding engine based on the provided configuration.
 *
 * @param config - Embedding configuration specifying provider and options
 * @returns An IEmbeddingEngine instance for the requested provider
 * @throws Error if an unknown provider is specified
 *
 * @example
 * ```typescript
 * // Local (default, always available)
 * const engine = createEmbeddingEngine({ provider: 'local' });
 *
 * // Ollama (requires running Ollama instance)
 * const engine = createEmbeddingEngine({
 *   provider: 'ollama',
 *   ollama: { model: 'nomic-embed-text' },
 * });
 *
 * // HuggingFace (requires API key)
 * const engine = createEmbeddingEngine({
 *   provider: 'huggingface',
 *   huggingface: { apiKey: 'hf_...' },
 * });
 * ```
 */
export function createEmbeddingEngine(config?: EmbeddingConfig): IEmbeddingEngine {
  const provider = config?.provider ?? 'local';

  switch (provider) {
    case 'local':
      return new LocalEmbeddingEngine(config?.local?.dimension);

    case 'ollama':
      return new OllamaEmbeddingEngine(config?.ollama);

    case 'huggingface': {
      if (!config?.huggingface) {
        throw new Error(
          'HuggingFace configuration is required when using the huggingface provider.',
        );
      }
      return new HuggingFaceEmbeddingEngine(config.huggingface);
    }

    default:
      throw new Error(
        `Unknown embedding provider: '${provider as string}'. ` +
        "Supported providers: 'local', 'ollama', 'huggingface'.",
      );
  }
}
