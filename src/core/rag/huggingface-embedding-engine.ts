/**
 * HuggingFace Embedding Engine
 *
 * Embedding engine that uses the HuggingFace Inference API for
 * generating real vector embeddings. Requires a HuggingFace API
 * token and internet access.
 *
 * @module core/rag/huggingface-embedding-engine
 */

import type { IEmbeddingEngine } from './embedding-engine';

// ============================================================================
// Configuration
// ============================================================================

export interface HuggingFaceEmbeddingConfig {
  /** HuggingFace API token (required) */
  apiKey: string;
  /** Model ID on HuggingFace (default: sentence-transformers/all-MiniLM-L6-v2) */
  model?: string;
  /** Expected embedding dimension (default: 384) */
  dimension?: number;
  /** HuggingFace Inference API base URL (default: https://api-inference.huggingface.co) */
  apiUrl?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const DEFAULT_DIMENSION = 384;
const DEFAULT_API_URL = 'https://api-inference.huggingface.co';

// ============================================================================
// Implementation
// ============================================================================

export class HuggingFaceEmbeddingEngine implements IEmbeddingEngine {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimension: number;
  private readonly apiUrl: string;

  constructor(config: HuggingFaceEmbeddingConfig) {
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      throw new Error('HuggingFace API key is required.');
    }

    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.dimension = config.dimension ?? DEFAULT_DIMENSION;
    this.apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');

    if (this.dimension < 1) {
      throw new Error(`Embedding dimension must be positive, got ${this.dimension}`);
    }
  }

  /**
   * Embed a single text string using the HuggingFace feature-extraction pipeline.
   */
  async embed(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      return new Array(this.dimension).fill(0);
    }

    const result = await this.callApi(text);
    return this.extractVector(result);
  }

  /**
   * Embed multiple texts in a single batch request.
   * HuggingFace feature-extraction supports batch input natively.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // Handle empty strings in batch: track indices, send only non-empty
    const nonEmptyIndices: number[] = [];
    const nonEmptyTexts: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (texts[i] && texts[i].trim().length > 0) {
        nonEmptyIndices.push(i);
        nonEmptyTexts.push(texts[i]);
      }
    }

    // If all texts are empty, return zero vectors
    if (nonEmptyTexts.length === 0) {
      return texts.map(() => new Array(this.dimension).fill(0));
    }

    const result = await this.callApi(nonEmptyTexts);

    // Parse batch results
    const batchVectors = this.extractBatchVectors(result, nonEmptyTexts.length);

    // Reconstruct full result array with zero vectors for empty inputs
    const results: number[][] = texts.map(() => new Array(this.dimension).fill(0));
    for (let i = 0; i < nonEmptyIndices.length; i++) {
      results[nonEmptyIndices[i]] = batchVectors[i];
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
    return 'huggingface';
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Call the HuggingFace Inference API.
   */
  private async callApi(inputs: string | string[]): Promise<unknown> {
    const url = `${this.apiUrl}/pipeline/feature-extraction/${this.model}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs }),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`HuggingFace API request failed: ${message}`);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');

      if (response.status === 401) {
        throw new Error(
          'HuggingFace authentication failed. Check your API key.',
        );
      }

      if (response.status === 429) {
        throw new Error(
          'HuggingFace rate limit exceeded. Please wait before retrying.',
        );
      }

      if (response.status === 404 || body.includes('Model') && body.includes('not found')) {
        throw new Error(
          `HuggingFace model '${this.model}' not found. ` +
          'Verify the model ID exists on huggingface.co.',
        );
      }

      throw new Error(
        `HuggingFace API error (${response.status}): ${body || response.statusText}`,
      );
    }

    return response.json();
  }

  /**
   * Extract a single embedding vector from the API response.
   * HuggingFace feature-extraction returns token-level embeddings as
   * a 2D array [[token1_dim1, ...], [token2_dim1, ...]].
   * We mean-pool across tokens to get a single vector.
   */
  private extractVector(data: unknown): number[] {
    if (!Array.isArray(data)) {
      throw new Error('HuggingFace returned unexpected response format.');
    }

    // Single input: data is [[token_vectors...]] or [embedding_values...]
    // If it's a flat array of numbers, return directly
    if (data.length > 0 && typeof data[0] === 'number') {
      return data as number[];
    }

    // If it's a 2D array (token-level embeddings), mean-pool
    if (data.length > 0 && Array.isArray(data[0])) {
      return this.meanPool(data as number[][]);
    }

    throw new Error('HuggingFace returned unexpected embedding structure.');
  }

  /**
   * Extract batch vectors from the API response.
   */
  private extractBatchVectors(data: unknown, expectedCount: number): number[][] {
    if (!Array.isArray(data)) {
      throw new Error('HuggingFace returned unexpected batch response format.');
    }

    if (data.length !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} embeddings but received ${data.length}.`,
      );
    }

    return data.map((item: unknown) => this.extractVector(item));
  }

  /**
   * Mean-pool token-level embeddings into a single vector.
   */
  private meanPool(tokenEmbeddings: number[][]): number[] {
    if (tokenEmbeddings.length === 0) {
      return new Array(this.dimension).fill(0);
    }

    const dim = tokenEmbeddings[0].length;
    const pooled = new Array(dim).fill(0);

    for (const tokenVec of tokenEmbeddings) {
      for (let i = 0; i < dim; i++) {
        pooled[i] += tokenVec[i];
      }
    }

    const count = tokenEmbeddings.length;
    for (let i = 0; i < dim; i++) {
      pooled[i] /= count;
    }

    return pooled;
  }
}
