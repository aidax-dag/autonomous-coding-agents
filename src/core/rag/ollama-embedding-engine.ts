/**
 * Ollama Embedding Engine
 *
 * Embedding engine that uses the Ollama local API for generating
 * real vector embeddings. Requires a running Ollama instance with
 * an embedding model installed (e.g., nomic-embed-text).
 *
 * @module core/rag/ollama-embedding-engine
 */

import type { IEmbeddingEngine } from './embedding-engine';

// ============================================================================
// Configuration
// ============================================================================

export interface OllamaEmbeddingConfig {
  /** Ollama API host URL (default: http://localhost:11434) */
  host?: string;
  /** Embedding model name (default: nomic-embed-text) */
  model?: string;
  /** Expected embedding dimension (default: 768) */
  dimension?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'nomic-embed-text';
const DEFAULT_DIMENSION = 768;

// ============================================================================
// Implementation
// ============================================================================

export class OllamaEmbeddingEngine implements IEmbeddingEngine {
  private readonly host: string;
  private readonly model: string;
  private readonly dimension: number;

  constructor(config?: OllamaEmbeddingConfig) {
    this.host = (config?.host ?? DEFAULT_HOST).replace(/\/+$/, '');
    this.model = config?.model ?? DEFAULT_MODEL;
    this.dimension = config?.dimension ?? DEFAULT_DIMENSION;

    if (this.dimension < 1) {
      throw new Error(`Embedding dimension must be positive, got ${this.dimension}`);
    }
  }

  /**
   * Embed a single text string by calling the Ollama embeddings API.
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return new Array(this.dimension).fill(0);
    }

    const url = `${this.host}/api/embeddings`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('ECONNREFUSED') || message.includes('fetch failed')) {
        throw new Error(
          `Ollama connection refused at ${this.host}. ` +
          'Ensure Ollama is running (ollama serve) and accessible.',
        );
      }
      throw new Error(`Ollama embedding request failed: ${message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      if (response.status === 404 || body.includes('not found')) {
        throw new Error(
          `Ollama model '${this.model}' not found. ` +
          `Install it with: ollama pull ${this.model}`,
        );
      }
      throw new Error(
        `Ollama API error (${response.status}): ${body || response.statusText}`,
      );
    }

    const data = await response.json() as { embedding?: number[] };

    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error(
        'Ollama returned malformed response: missing or invalid embedding array.',
      );
    }

    return data.embedding;
  }

  /**
   * Embed multiple texts sequentially.
   * Ollama does not natively support batch embedding requests.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  /**
   * Get the expected embedding dimension for the configured model.
   */
  getDimension(): number {
    return this.dimension;
  }

  /**
   * Get the provider identifier.
   */
  getProvider(): string {
    return 'ollama';
  }
}
