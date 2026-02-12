/**
 * Instinct Exporter
 *
 * Exports instincts from an InstinctStore to portable formats
 * (JSON, YAML-like) for sharing between projects and teams.
 *
 * @module core/learning
 */

import type { IInstinctStore, Instinct } from './interfaces/learning.interface';

// ============================================================================
// Types
// ============================================================================

/**
 * Serializable instinct record for export.
 * Dates are converted to ISO strings for portability.
 */
export interface InstinctRecord {
  id: string;
  trigger: string;
  action: string;
  confidence: number;
  domain: string;
  source: string;
  evidence: string[];
  usageCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Implementation
// ============================================================================

export class InstinctExporter {
  /**
   * Export all instincts from the store as serializable records.
   */
  async exportAll(store: IInstinctStore): Promise<InstinctRecord[]> {
    const instincts = await store.export();
    return instincts.map((inst) => this.toRecord(inst));
  }

  /**
   * Export instincts filtered by minimum confidence.
   */
  async exportFiltered(store: IInstinctStore, minConfidence: number): Promise<InstinctRecord[]> {
    const instincts = await store.export({ minConfidence });
    return instincts.map((inst) => this.toRecord(inst));
  }

  /**
   * Convert instinct records to a JSON string.
   */
  toJSON(instincts: InstinctRecord[]): string {
    return JSON.stringify(instincts, null, 2);
  }

  /**
   * Convert instinct records to a simple YAML-like string format.
   */
  toYAML(instincts: InstinctRecord[]): string {
    const lines: string[] = [];

    for (const inst of instincts) {
      lines.push(`- id: ${inst.id}`);
      lines.push(`  trigger: "${this.escapeYAML(inst.trigger)}"`);
      lines.push(`  action: "${this.escapeYAML(inst.action)}"`);
      lines.push(`  confidence: ${inst.confidence}`);
      lines.push(`  domain: ${inst.domain}`);
      lines.push(`  source: ${inst.source}`);
      lines.push(`  usageCount: ${inst.usageCount}`);
      lines.push(`  successCount: ${inst.successCount}`);
      lines.push(`  failureCount: ${inst.failureCount}`);
      lines.push(`  createdAt: ${inst.createdAt}`);
      lines.push(`  updatedAt: ${inst.updatedAt}`);

      if (inst.lastUsedAt) {
        lines.push(`  lastUsedAt: ${inst.lastUsedAt}`);
      }

      if (inst.evidence.length > 0) {
        lines.push(`  evidence:`);
        for (const ev of inst.evidence) {
          lines.push(`    - "${this.escapeYAML(ev)}"`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private toRecord(inst: Instinct): InstinctRecord {
    return {
      id: inst.id,
      trigger: inst.trigger,
      action: inst.action,
      confidence: inst.confidence,
      domain: inst.domain,
      source: inst.source,
      evidence: inst.evidence,
      usageCount: inst.usageCount,
      successCount: inst.successCount,
      failureCount: inst.failureCount,
      createdAt: inst.createdAt instanceof Date ? inst.createdAt.toISOString() : String(inst.createdAt),
      updatedAt: inst.updatedAt instanceof Date ? inst.updatedAt.toISOString() : String(inst.updatedAt),
      lastUsedAt: inst.lastUsedAt
        ? (inst.lastUsedAt instanceof Date ? inst.lastUsedAt.toISOString() : String(inst.lastUsedAt))
        : undefined,
      metadata: inst.metadata as Record<string, unknown> | undefined,
    };
  }

  private escapeYAML(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInstinctExporter(): InstinctExporter {
  return new InstinctExporter();
}
