/**
 * Embedding Engine Interface and Local Implementation
 *
 * Defines the IEmbeddingEngine interface for all embedding providers,
 * plus the lightweight local engine using TF-IDF-like character n-gram
 * hashing. The local engine produces fixed-dimension vectors for code
 * similarity search without requiring external APIs or heavy dependencies.
 *
 * @module core/rag/embedding-engine
 */

// ============================================================================
// Interface
// ============================================================================

/**
 * Common interface for all embedding engines.
 *
 * Implementations include:
 * - LocalEmbeddingEngine (n-gram hashing, always available)
 * - OllamaEmbeddingEngine (local Ollama API)
 * - HuggingFaceEmbeddingEngine (HuggingFace Inference API)
 */
export interface IEmbeddingEngine {
  /** Embed a single text string into a fixed-dimension vector. */
  embed(text: string): Promise<number[]>;
  /** Embed multiple texts in batch. */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Get the configured embedding dimension. */
  getDimension(): number;
  /** Get the provider identifier string. */
  getProvider(): string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DIMENSION = 128;
const NGRAM_MIN = 2;
const NGRAM_MAX = 4;

// ============================================================================
// Implementation
// ============================================================================

export class LocalEmbeddingEngine implements IEmbeddingEngine {
  private readonly dimension: number;

  constructor(dimension?: number) {
    this.dimension = dimension ?? DEFAULT_DIMENSION;

    if (this.dimension < 1) {
      throw new Error(`Embedding dimension must be positive, got ${this.dimension}`);
    }
  }

  /**
   * Embed a single text string into a fixed-dimension vector.
   */
  async embed(text: string): Promise<number[]> {
    return this.embedSync(text);
  }

  /**
   * Embed multiple texts in batch.
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.embedSync(text));
  }

  /**
   * Synchronous embed for backward compatibility and internal use.
   */
  embedSync(text: string): number[] {
    if (!text || text.trim().length === 0) {
      return new Array(this.dimension).fill(0);
    }

    const tokens = this.tokenize(text);
    const vector = this.hashToVector(tokens, this.dimension);
    return this.normalize(vector);
  }

  /**
   * Synchronous batch embed for backward compatibility.
   */
  batchEmbed(texts: string[]): number[][] {
    return texts.map((text) => this.embedSync(text));
  }

  /**
   * Compute cosine similarity between two vectors.
   * Returns a value in [-1, 1], where 1 means identical direction.
   */
  similarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
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

  /**
   * Get the configured embedding dimension.
   */
  getDimension(): number {
    return this.dimension;
  }

  /**
   * Get the provider identifier.
   */
  getProvider(): string {
    return 'local';
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Tokenize text into character n-grams of varying lengths.
   *
   * Preprocessing:
   * 1. Lowercase the text
   * 2. Collapse whitespace
   * 3. Generate n-grams of sizes NGRAM_MIN through NGRAM_MAX
   *
   * This approach captures local character patterns that are effective
   * for code similarity since code has distinctive syntactic patterns.
   */
  private tokenize(text: string): string[] {
    const normalized = text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    const tokens: string[] = [];

    // Also add word-level tokens for semantic signal
    const words = normalized.split(/[\s.,;:(){}[\]<>'"=+\-*/&|!?@#$%^~`\\]+/).filter(Boolean);
    for (const word of words) {
      if (word.length >= 2) {
        tokens.push(`w:${word}`);
      }
    }

    // Character n-grams
    for (let n = NGRAM_MIN; n <= NGRAM_MAX; n++) {
      for (let i = 0; i <= normalized.length - n; i++) {
        tokens.push(normalized.substring(i, i + n));
      }
    }

    return tokens;
  }

  /**
   * Hash tokens into a fixed-dimension vector using feature hashing.
   *
   * Uses a simple but effective approach:
   * - Hash each token to a bucket index using FNV-1a
   * - Increment or decrement the bucket based on a secondary hash
   * - This preserves approximate token frequency information
   */
  private hashToVector(tokens: string[], dimension: number): number[] {
    const vector = new Array(dimension).fill(0);

    // Count token frequencies for TF weighting
    const freq = new Map<string, number>();
    for (const token of tokens) {
      freq.set(token, (freq.get(token) ?? 0) + 1);
    }

    for (const [token, count] of freq) {
      const hash = this.fnv1a(token);
      const index = Math.abs(hash) % dimension;
      // Use a secondary bit to determine sign (simulates random projection)
      const sign = (hash & 0x100) ? 1 : -1;
      // TF weight: log(1 + count) dampens high-frequency tokens
      vector[index] += sign * Math.log(1 + count);
    }

    return vector;
  }

  /**
   * Normalize a vector to unit length (L2 normalization).
   * Returns a zero vector if the input has zero magnitude.
   */
  private normalize(vector: number[]): number[] {
    let magnitude = 0;
    for (const val of vector) {
      magnitude += val * val;
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude === 0) {
      return vector;
    }

    return vector.map((val) => val / magnitude);
  }

  /**
   * FNV-1a hash function for strings.
   * Fast, well-distributed hash suitable for feature hashing.
   */
  private fnv1a(str: string): number {
    let hash = 0x811c9dc5; // FNV offset basis

    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }

    return hash >>> 0; // Convert to unsigned 32-bit integer
  }
}
