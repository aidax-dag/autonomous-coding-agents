/**
 * Instinct Importer
 *
 * Imports external instincts with validation and stores them
 * into an IInstinctStore with configurable initial confidence.
 *
 * @module core/learning
 */

import type {
  IInstinctStore,
  InstinctDomain,
  InstinctMetadata,
} from './interfaces/learning.interface';
import type { InstinctRecord } from './instinct-export';

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
