/**
 * Instinct Transfer
 *
 * Portable import/export of instincts between projects.
 * Wraps IInstinctStore export/import with serialization
 * and confidence-discount logic.
 *
 * @module core/instinct-transfer
 */

import type {
  IInstinctStore,
  InstinctFilter,
  ImportResult,
} from '../learning/interfaces/learning.interface';
import type {
  IInstinctTransfer,
  InstinctBundle,
  TransferOptions,
} from './interfaces/instinct-transfer.interface';

const TRANSFER_VERSION = '1.0.0';

/**
 * Instinct transfer config
 */
export interface InstinctTransferConfig {
  /** Backing instinct store */
  store: IInstinctStore;
}

/**
 * Instinct transfer implementation
 */
export class InstinctTransfer implements IInstinctTransfer {
  private readonly store: IInstinctStore;

  constructor(config: InstinctTransferConfig) {
    this.store = config.store;
  }

  async exportBundle(
    projectName: string,
    filter?: InstinctFilter,
  ): Promise<InstinctBundle> {
    const instincts = await this.store.export(filter);

    return {
      manifest: {
        version: TRANSFER_VERSION,
        sourceProject: projectName,
        exportedAt: new Date().toISOString(),
        count: instincts.length,
        filter,
      },
      instincts,
    };
  }

  async importBundle(
    bundle: InstinctBundle,
    options: TransferOptions = {},
  ): Promise<ImportResult> {
    const {
      confidenceDiscount = 0.8,
      minConfidence = 0,
      mergeStrategy: _mergeStrategy = 'skip',
    } = options;

    // Apply confidence discount and filter
    const adjustedInstincts = bundle.instincts
      .map((inst) => ({
        ...inst,
        confidence: inst.confidence * confidenceDiscount,
      }))
      .filter((inst) => inst.confidence >= minConfidence);

    return this.store.import(adjustedInstincts);
  }

  serialize(bundle: InstinctBundle): string {
    return JSON.stringify(bundle, null, 2);
  }

  deserialize(json: string): InstinctBundle {
    const parsed = JSON.parse(json) as InstinctBundle;

    if (!parsed.manifest || !Array.isArray(parsed.instincts)) {
      throw new Error('Invalid instinct bundle format');
    }

    return parsed;
  }
}

/**
 * Factory function
 */
export function createInstinctTransfer(
  config: InstinctTransferConfig,
): InstinctTransfer {
  return new InstinctTransfer(config);
}
