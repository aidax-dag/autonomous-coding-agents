/**
 * Checkpoint Protocol Interfaces
 *
 * Defines abstractions for creating, restoring, and managing
 * execution checkpoints for agent task resumption.
 *
 * @module core/checkpoint/interfaces
 */

/**
 * Checkpoint state — serializable snapshot of agent execution
 */
export interface CheckpointState {
  /** Unique checkpoint ID */
  id: string;
  /** Task ID this checkpoint belongs to */
  taskId: string;
  /** Agent identifier */
  agentId: string;
  /** Current execution step index */
  stepIndex: number;
  /** Total planned steps */
  totalSteps: number;
  /** Serialized execution context */
  context: Record<string, unknown>;
  /** Completed step results */
  completedSteps: CompletedStep[];
  /** Pending step IDs */
  pendingSteps: string[];
  /** Checkpoint creation timestamp */
  createdAt: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Completed step record
 */
export interface CompletedStep {
  /** Step ID */
  stepId: string;
  /** Step name */
  name: string;
  /** Step result (serializable) */
  result: unknown;
  /** Duration in ms */
  durationMs: number;
  /** Completion timestamp */
  completedAt: string;
}

/**
 * Checkpoint storage options
 */
export interface CheckpointStorageOptions {
  /** Storage directory path */
  storagePath: string;
  /** Max checkpoints per task */
  maxPerTask?: number;
  /** Auto-cleanup older checkpoints */
  autoCleanup?: boolean;
}

/**
 * Checkpoint restore result
 */
export interface RestoreResult {
  /** Whether restoration was successful */
  success: boolean;
  /** Restored checkpoint state */
  checkpoint?: CheckpointState;
  /** Error message if failed */
  error?: string;
  /** Steps that need to be re-executed */
  remainingSteps: string[];
}

/**
 * Checkpoint manager interface
 */
export interface ICheckpointManager {
  /** Save a checkpoint */
  save(state: CheckpointState): Promise<void>;

  /** Restore the latest checkpoint for a task */
  restore(taskId: string): Promise<RestoreResult>;

  /** Restore a specific checkpoint by ID */
  restoreById(checkpointId: string): Promise<RestoreResult>;

  /** List all checkpoints for a task */
  list(taskId: string): Promise<CheckpointState[]>;

  /** Delete a specific checkpoint */
  delete(checkpointId: string): Promise<boolean>;

  /** Delete all checkpoints for a task */
  deleteAll(taskId: string): Promise<number>;
}
