/**
 * Dimension Adapter
 *
 * Handles dimension mismatches between different embedding engines
 * and the vector store. Truncates or zero-pads vectors to match
 * a target dimension.
 *
 * @module core/rag/dimension-adapter
 */

// ============================================================================
// Implementation
// ============================================================================

export class DimensionAdapter {
  private readonly targetDimension: number;

  constructor(targetDimension: number) {
    if (targetDimension < 0) {
      throw new Error(`Target dimension must be non-negative, got ${targetDimension}`);
    }
    this.targetDimension = targetDimension;
  }

  /**
   * Adapt a vector to the target dimension.
   * - If the vector is longer, truncate to targetDimension.
   * - If the vector is shorter, pad with zeros to targetDimension.
   * - If the vector matches, return a copy unchanged.
   */
  adapt(vector: number[]): number[] {
    if (this.targetDimension === 0) {
      return [];
    }

    if (vector.length === this.targetDimension) {
      return vector.slice();
    }

    if (vector.length > this.targetDimension) {
      return vector.slice(0, this.targetDimension);
    }

    // Pad with zeros
    const padded = new Array(this.targetDimension).fill(0);
    for (let i = 0; i < vector.length; i++) {
      padded[i] = vector[i];
    }
    return padded;
  }

  /**
   * Adapt multiple vectors in batch.
   */
  adaptBatch(vectors: number[][]): number[][] {
    return vectors.map((v) => this.adapt(v));
  }

  /**
   * Get the configured target dimension.
   */
  getTargetDimension(): number {
    return this.targetDimension;
  }
}
