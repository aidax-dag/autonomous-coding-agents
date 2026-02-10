/**
 * Checkpoint Protocol Module
 *
 * @module core/checkpoint
 */

export type {
  ICheckpointManager,
  CheckpointState,
  CompletedStep,
  CheckpointStorageOptions,
  RestoreResult,
} from './interfaces/checkpoint.interface';

export {
  CheckpointManager,
  createCheckpointManager,
  type CheckpointManagerConfig,
} from './checkpoint-manager';
