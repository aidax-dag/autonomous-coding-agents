/**
 * Checkpoint Manager
 *
 * In-memory checkpoint storage with save/restore/list/delete operations.
 * Supports max-per-task limits and auto-cleanup of older checkpoints.
 *
 * @module core/checkpoint
 */

import type {
  ICheckpointManager,
  CheckpointState,
  CheckpointStorageOptions,
  RestoreResult,
} from './interfaces/checkpoint.interface';

/**
 * Checkpoint manager config
 */
export interface CheckpointManagerConfig {
  /** Storage options */
  storage?: CheckpointStorageOptions;
  /** Max checkpoints per task (default: 10) */
  maxPerTask?: number;
}

/**
 * In-memory checkpoint manager implementation
 */
export class CheckpointManager implements ICheckpointManager {
  private readonly checkpoints = new Map<string, CheckpointState>();
  private readonly taskIndex = new Map<string, string[]>();
  private readonly maxPerTask: number;

  constructor(config: CheckpointManagerConfig = {}) {
    this.maxPerTask = config.maxPerTask ?? config.storage?.maxPerTask ?? 10;
  }

  async save(state: CheckpointState): Promise<void> {
    this.checkpoints.set(state.id, { ...state });

    // Update task index
    const taskCheckpoints = this.taskIndex.get(state.taskId) ?? [];
    if (!taskCheckpoints.includes(state.id)) {
      taskCheckpoints.push(state.id);
    }
    this.taskIndex.set(state.taskId, taskCheckpoints);

    // Enforce max-per-task limit (remove oldest first)
    if (taskCheckpoints.length > this.maxPerTask) {
      const toRemove = taskCheckpoints.splice(0, taskCheckpoints.length - this.maxPerTask);
      for (const id of toRemove) {
        this.checkpoints.delete(id);
      }
    }
  }

  async restore(taskId: string): Promise<RestoreResult> {
    const taskCheckpoints = this.taskIndex.get(taskId);
    if (!taskCheckpoints || taskCheckpoints.length === 0) {
      return {
        success: false,
        error: `No checkpoints found for task: ${taskId}`,
        remainingSteps: [],
      };
    }

    // Get latest checkpoint (last in array)
    const latestId = taskCheckpoints[taskCheckpoints.length - 1];
    return this.restoreById(latestId);
  }

  async restoreById(checkpointId: string): Promise<RestoreResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return {
        success: false,
        error: `Checkpoint not found: ${checkpointId}`,
        remainingSteps: [],
      };
    }

    return {
      success: true,
      checkpoint: { ...checkpoint },
      remainingSteps: [...checkpoint.pendingSteps],
    };
  }

  async list(taskId: string): Promise<CheckpointState[]> {
    const taskCheckpoints = this.taskIndex.get(taskId) ?? [];
    return taskCheckpoints
      .map((id) => this.checkpoints.get(id))
      .filter((cp): cp is CheckpointState => cp !== undefined)
      .map((cp) => ({ ...cp }));
  }

  async delete(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) return false;

    this.checkpoints.delete(checkpointId);

    // Remove from task index
    const taskCheckpoints = this.taskIndex.get(checkpoint.taskId);
    if (taskCheckpoints) {
      const idx = taskCheckpoints.indexOf(checkpointId);
      if (idx !== -1) taskCheckpoints.splice(idx, 1);
      if (taskCheckpoints.length === 0) {
        this.taskIndex.delete(checkpoint.taskId);
      }
    }

    return true;
  }

  async deleteAll(taskId: string): Promise<number> {
    const taskCheckpoints = this.taskIndex.get(taskId) ?? [];
    const count = taskCheckpoints.length;

    for (const id of taskCheckpoints) {
      this.checkpoints.delete(id);
    }
    this.taskIndex.delete(taskId);

    return count;
  }
}

/**
 * Factory function
 */
export function createCheckpointManager(
  config?: CheckpointManagerConfig,
): CheckpointManager {
  return new CheckpointManager(config);
}
