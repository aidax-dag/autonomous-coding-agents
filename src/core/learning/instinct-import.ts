/**
 * Instinct Importer
 *
 * Imports external instincts with validation and stores them
 * into an IInstinctStore with configurable initial confidence.
 *
 * D-1: Adds bundle-based import for instinct sharing across projects.
 *
 * @module core/learning
 */

import type {
  IInstinctStore,
  InstinctDomain,
  InstinctMetadata,
} from './interfaces/learning.interface';
import type { InstinctRecord, ExportedInstinctBundle } from './instinct-export';
import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('Learning', 'instinct-import');

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: InstinctRecord[];
  invalid: string[];
}

// ============================================================================
// Constants
// ============================================================================

const VALID_DOMAINS: Set<string> = new Set([
  'code-style',
  'testing',
  'git',
  'documentation',
  'architecture',
  'debugging',
  'performance',
  'security',
  'workflow',
  'communication',
  'custom',
]);

const VALID_SOURCES: Set<string> = new Set([
  'session-observation',
  'repo-analysis',
  'user-correction',
  'explicit-teaching',
  'pattern-inference',
  'imported',
]);

// ============================================================================
// Implementation
// ============================================================================

export class InstinctImporter {
  /**
   * Parse a JSON string into an array of InstinctRecords.
   * Throws on invalid JSON.
   */
  fromJSON(json: string): InstinctRecord[] {
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      throw new Error('Expected an array of instinct records');
    }

    return parsed as InstinctRecord[];
  }

  /**
   * Validate instinct records, separating valid from invalid.
   */
  validate(instincts: InstinctRecord[]): ValidationResult {
    const valid: InstinctRecord[] = [];
    const invalid: string[] = [];

    for (const inst of instincts) {
      const errors = this.validateRecord(inst);
      if (errors.length === 0) {
        valid.push(inst);
      } else {
        invalid.push(`${inst.id ?? 'unknown'}: ${errors.join(', ')}`);
      }
    }

    return { valid, invalid };
  }

  /**
   * Import validated instinct records into a store.
   * Returns the number of instincts successfully imported.
   */
  async importToStore(
    store: IInstinctStore,
    instincts: InstinctRecord[],
    initialConfidence?: number,
  ): Promise<number> {
    let imported = 0;

    for (const record of instincts) {
      const confidence = initialConfidence ?? record.confidence;

      await store.create({
        trigger: record.trigger,
        action: record.action,
        confidence,
        domain: record.domain as InstinctDomain,
        source: 'imported',
        evidence: record.evidence,
        metadata: record.metadata as InstinctMetadata | undefined,
      });

      imported++;
    }

    return imported;
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private validateRecord(record: InstinctRecord): string[] {
    const errors: string[] = [];

    if (!record.id || typeof record.id !== 'string') {
      errors.push('missing or invalid id');
    }

    if (!record.trigger || typeof record.trigger !== 'string') {
      errors.push('missing or invalid trigger');
    }

    if (!record.action || typeof record.action !== 'string') {
      errors.push('missing or invalid action');
    }

    if (typeof record.confidence !== 'number' || record.confidence < 0 || record.confidence > 1) {
      errors.push('confidence must be a number between 0 and 1');
    }

    if (!record.domain || !VALID_DOMAINS.has(record.domain)) {
      errors.push(`invalid domain: ${record.domain}`);
    }

    if (!record.source || !VALID_SOURCES.has(record.source)) {
      errors.push(`invalid source: ${record.source}`);
    }

    if (!Array.isArray(record.evidence)) {
      errors.push('evidence must be an array');
    }

    return errors;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInstinctImporter(): InstinctImporter {
  return new InstinctImporter();
}

// ============================================================================
// D-1 Bundle Import Types
// ============================================================================

/**
 * Options for bundle-based instinct import.
 */
export interface ImportOptions {
  /** Cap imported confidence to this maximum (default: 0.7) */
  maxConfidence?: number;
  /** Overwrite if pattern already exists (default: false) */
  overwriteExisting?: boolean;
  /** Preview only, do not persist (default: false) */
  dryRun?: boolean;
  /** Override the source label on imported instincts */
  source?: string;
}

/**
 * Result of a bundle import operation.
 */
export interface BundleImportResult {
  /** Total instincts in the bundle */
  total: number;
  /** Number successfully imported */
  imported: number;
  /** Number skipped (duplicate patterns) */
  skipped: number;
  /** Error messages from failed imports */
  errors: string[];
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Store interface accepted by the bundle importer.
 */
export interface BundleImportStore {
  getAll(): { trigger: string }[];
  add(instinct: Record<string, unknown>): void;
}

// ============================================================================
// D-1 Bundle Importer
// ============================================================================

/**
 * Bundle-based instinct importer for cross-project sharing (D-1).
 *
 * Validates incoming bundles and imports instincts with confidence
 * capping, deduplication, and dry-run support.
 */
export class InstinctBundleImporter {
  constructor(private readonly store: BundleImportStore) {}

  /**
   * Validate a bundle object for structural correctness.
   *
   * @param bundle Unknown input to validate
   * @returns Validation result with errors list
   */
  validate(bundle: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!bundle || typeof bundle !== 'object') {
      return { valid: false, errors: ['Bundle must be an object'] };
    }

    const b = bundle as Record<string, unknown>;

    if (b.version !== '1.0') {
      errors.push(`Unsupported version: ${b.version}`);
    }

    if (!Array.isArray(b.instincts)) {
      errors.push('Missing instincts array');
    } else {
      for (let i = 0; i < b.instincts.length; i++) {
        const inst = b.instincts[i] as Record<string, unknown>;
        if (!inst.pattern) errors.push(`Instinct[${i}]: missing pattern`);
        if (!inst.action) errors.push(`Instinct[${i}]: missing action`);
        if (
          typeof inst.confidence !== 'number' ||
          inst.confidence < 0 ||
          inst.confidence > 1
        ) {
          errors.push(`Instinct[${i}]: invalid confidence`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Import instincts from a validated bundle.
   *
   * @param bundle Exported instinct bundle
   * @param options Import options (confidence cap, overwrite, dry-run)
   * @returns Import result summary
   */
  import(
    bundle: ExportedInstinctBundle,
    options: ImportOptions = {},
  ): BundleImportResult {
    const maxConfidence = options.maxConfidence ?? 0.7;
    const overwrite = options.overwriteExisting ?? false;
    const dryRun = options.dryRun ?? false;
    const source = options.source ?? bundle.source ?? 'external';

    const validation = this.validate(bundle);
    if (!validation.valid) {
      return {
        total: 0,
        imported: 0,
        skipped: 0,
        errors: validation.errors,
        dryRun,
      };
    }

    const existing = new Set(
      this.store.getAll().map((i) => i.trigger),
    );
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const inst of bundle.instincts) {
      const cappedConfidence = Math.min(inst.confidence, maxConfidence);

      if (existing.has(inst.pattern) && !overwrite) {
        skipped++;
        continue;
      }

      if (!dryRun) {
        try {
          this.store.add({
            pattern: inst.pattern,
            action: inst.action,
            confidence: cappedConfidence,
            category: inst.category ?? 'general',
            tags: inst.tags ?? [],
            source,
            createdAt: new Date().toISOString(),
          });
          imported++;
        } catch (e: unknown) {
          const msg =
            e instanceof Error ? e.message : String(e);
          errors.push(`Failed to import '${inst.pattern}': ${msg}`);
        }
      } else {
        imported++;
      }
    }

    logger.info(
      `Import result: ${imported} imported, ${skipped} skipped, ${errors.length} errors (dryRun: ${dryRun})`,
    );

    return {
      total: bundle.instincts.length,
      imported,
      skipped,
      errors,
      dryRun,
    };
  }
}

// ============================================================================
// D-1 Factory Function
// ============================================================================

export function createInstinctBundleImporter(
  store: BundleImportStore,
): InstinctBundleImporter {
  return new InstinctBundleImporter(store);
}
