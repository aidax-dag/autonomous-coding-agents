/**
 * Instinct Transfer Module
 *
 * @module core/instinct-transfer
 */

export type {
  IInstinctTransfer,
  InstinctBundle,
  TransferManifest,
  TransferOptions,
} from './interfaces/instinct-transfer.interface';

export {
  InstinctTransfer,
  createInstinctTransfer,
  type InstinctTransferConfig,
} from './instinct-transfer';
