/**
 * Instinct Exporter
 *
 * Exports instincts from an InstinctStore to portable formats
 * (JSON, YAML-like) for sharing between projects and teams.
 *
 * D-1: Adds bundle-based export for instinct sharing across projects.
 *
 * @module core/learning
 */

import type { IInstinctStore, Instinct } from './interfaces/learning.interface';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('Learning', 'instinct-export');

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
// D-1 Bundle Export Types
// ============================================================================

/**
 * Options for bundle-based instinct export.
 */
export interface ExportOptions {
  /** Minimum confidence threshold (default: 0.5) */
  minConfidence?: number;
  /** Filter by categories (domain values) */
  categories?: string[];
  /** Export format (default: 'json') */
  format?: 'json' | 'yaml';
  /** Include timestamps and source info (default: true) */
  includeMetadata?: boolean;
}

/**
 * A portable instinct bundle for cross-project sharing.
 */
export interface ExportedInstinctBundle {
  /** Bundle format version */
  version: string;
  /** ISO timestamp of export */
  exportedAt: string;
  /** Source project name */
  source: string;
  /** Number of instincts in bundle */
  count: number;
  /** Exported instinct entries */
  instincts: ExportedInstinct[];
}

/**
 * Single instinct entry within an exported bundle.
 */
export interface ExportedInstinct {
  /** Trigger pattern */
  pattern: string;
  /** Action to take */
  action: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Domain category */
  category: string;
  /** Descriptive tags */
  tags: string[];
  /** Optional metadata (timestamps, source info) */
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

// ============================================================================
// D-1 Bundle Exporter
// ============================================================================

/**
 * Store interface accepted by the bundle exporter.
 * Any object providing a synchronous getAll() is sufficient.
 */
export interface BundleExportStore {
  getAll(): Instinct[];
}

/**
 * Bundle-based instinct exporter for cross-project sharing (D-1).
 *
 * Wraps an instinct store and produces portable ExportedInstinctBundle
 * objects that can be serialized and transferred between projects.
 */
export class InstinctBundleExporter {
  constructor(private readonly store: BundleExportStore) {}

  /**
   * Export instincts as a portable bundle.
   *
   * @param options Export filtering and formatting options
   * @returns Portable instinct bundle
   */
  export(options: ExportOptions = {}): ExportedInstinctBundle {
    const minConfidence = options.minConfidence ?? 0.5;
    const includeMetadata = options.includeMetadata ?? true;

    let instincts = this.store.getAll();

    // Filter by confidence
    instincts = instincts.filter((i) => i.confidence >= minConfidence);

    // Filter by categories (domain)
    if (options.categories?.length) {
      instincts = instincts.filter((i) =>
        options.categories!.includes(i.domain),
      );
    }

    const exported: ExportedInstinct[] = instincts.map((i) => ({
      pattern: i.trigger,
      action: i.action,
      confidence: i.confidence,
      category: i.domain ?? 'general',
      tags: i.metadata?.tags ?? [],
      ...(includeMetadata
        ? { metadata: { source: i.source, createdAt: i.createdAt } }
        : {}),
    }));

    logger.info(
      `Exported ${exported.length} instincts (min confidence: ${minConfidence})`,
    );

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      source: 'aca',
      count: exported.length,
      instincts: exported,
    };
  }

  /**
   * Export instincts as a formatted JSON string.
   *
   * @param options Export filtering and formatting options
   * @returns Pretty-printed JSON string of the bundle
   */
  exportToJson(options: ExportOptions = {}): string {
    return JSON.stringify(this.export(options), null, 2);
  }
}

// ============================================================================
// D-1 Factory Function
// ============================================================================

export function createInstinctBundleExporter(
  store: BundleExportStore,
): InstinctBundleExporter {
  return new InstinctBundleExporter(store);
}
