/**
 * Instinct Transfer Interfaces
 *
 * Defines abstractions for exporting/importing instincts
 * between projects in a portable format.
 *
 * @module core/instinct-transfer/interfaces
 */

import type {
  Instinct,
  InstinctFilter,
  ImportResult,
} from '../../learning/interfaces/learning.interface';

/**
 * Transfer format metadata
 */
export interface TransferManifest {
  /** Format version */
  version: string;
  /** Source project name */
  sourceProject: string;
  /** Export timestamp */
  exportedAt: string;
  /** Number of instincts */
  count: number;
  /** Applied filter (if any) */
  filter?: InstinctFilter;
}

/**
 * Portable instinct bundle
 */
export interface InstinctBundle {
  /** Bundle manifest */
  manifest: TransferManifest;
  /** Instinct data */
  instincts: Instinct[];
}

/**
 * Transfer options
 */
export interface TransferOptions {
  /** Confidence discount for imported instincts (0-1, default 0.8) */
  confidenceDiscount?: number;
  /** Skip instincts below this confidence */
  minConfidence?: number;
  /** Merge strategy for duplicates */
  mergeStrategy?: 'skip' | 'overwrite' | 'merge-higher';
}

/**
 * Instinct transfer interface
 */
export interface IInstinctTransfer {
  /** Export instincts to a portable bundle */
  exportBundle(projectName: string, filter?: InstinctFilter): Promise<InstinctBundle>;

  /** Import instincts from a bundle */
  importBundle(bundle: InstinctBundle, options?: TransferOptions): Promise<ImportResult>;

  /** Serialize bundle to JSON string */
  serialize(bundle: InstinctBundle): string;

  /** Deserialize bundle from JSON string */
  deserialize(json: string): InstinctBundle;
}
