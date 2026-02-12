# F020 -- CheckpointManager

> In-memory checkpoint storage for saving, restoring, and managing agent execution snapshots with per-task limits.

## 1. Purpose

CheckpointManager provides a checkpoint/restore protocol for agent task execution. When an agent is partway through a multi-step task and needs to pause, fail over, or resume later, it can save a checkpoint capturing the current execution state -- completed steps, pending steps, context data, and progress index. The manager supports restoring the latest or a specific checkpoint, listing history, and enforcing a maximum number of checkpoints per task to prevent unbounded memory growth. This is the foundation for task resumption and crash recovery.

## 2. Interface

```typescript
interface CheckpointState {
  id: string;
  taskId: string;
  agentId: string;
  stepIndex: number;
  totalSteps: number;
  context: Record<string, unknown>;
  completedSteps: CompletedStep[];
  pendingSteps: string[];
  createdAt: string;                     // ISO timestamp
  metadata?: Record<string, unknown>;
}

interface CompletedStep {
  stepId: string;
  name: string;
  result: unknown;
  durationMs: number;
  completedAt: string;  // ISO timestamp
}

interface CheckpointStorageOptions {
  storagePath: string;
  maxPerTask?: number;
  autoCleanup?: boolean;
}

interface RestoreResult {
  success: boolean;
  checkpoint?: CheckpointState;
  error?: string;
  remainingSteps: string[];
}

interface ICheckpointManager {
  save(state: CheckpointState): Promise<void>;
  restore(taskId: string): Promise<RestoreResult>;
  restoreById(checkpointId: string): Promise<RestoreResult>;
  list(taskId: string): Promise<CheckpointState[]>;
  delete(checkpointId: string): Promise<boolean>;
  deleteAll(taskId: string): Promise<number>;
}
```

## 3. Implementation

- **Class**: `CheckpointManager` implements `ICheckpointManager`
- **Factory**: `createCheckpointManager(config?: CheckpointManagerConfig): CheckpointManager`
- **Configuration** (`CheckpointManagerConfig`):
  - `storage?` -- `CheckpointStorageOptions` (currently used only for `maxPerTask`)
  - `maxPerTask?` -- maximum checkpoints retained per task (default: 10)
- **Storage**: In-memory using `Map<string, CheckpointState>` for checkpoints and `Map<string, string[]>` for the task-to-checkpoint-ID index.

**Key behaviors:**

- `save()` stores a defensive copy. Updates the task index. If the task exceeds `maxPerTask`, the oldest checkpoints are evicted (FIFO). Saving with an existing checkpoint ID updates in place without duplicating the index entry.
- `restore(taskId)` returns the latest checkpoint for the task (last in the index array). Returns `{ success: false, error }` if no checkpoints exist.
- `restoreById(checkpointId)` returns a specific checkpoint by ID as a defensive copy.
- `list(taskId)` returns all checkpoints for a task in save order, each as a copy.
- `delete(checkpointId)` removes a single checkpoint and updates the task index. Cleans up the task index entry when the last checkpoint is removed.
- `deleteAll(taskId)` removes all checkpoints for a task, returns the count deleted.
- All restore operations return `remainingSteps` copied from the checkpoint's `pendingSteps`.

## 4. Dependencies

**Depends on:**

- No external modules. Self-contained with only its own interface types.

**Depended on by:**

- Agent orchestrator and DeepWorker for task pause/resume and crash recovery.
- Session persistence layer may coordinate with checkpoints for full state reconstruction.
- E2E test scenarios use checkpoints to validate multi-step task resumption.

## 5. Testing

- **Test file**: `tests/unit/core/checkpoint/checkpoint-manager.test.ts`
- **Test count**: 21 tests
- **Key test scenarios**:
  - **Constructor**: Default config, custom `maxPerTask`
  - **Save**: Basic save and restore round-trip, max-per-task eviction (oldest removed), overwrite same ID updates stepIndex, stored as defensive copy (mutation of original does not affect stored state)
  - **Restore**: Latest checkpoint for task, failure result for unknown task, remaining steps populated from pending steps
  - **RestoreById**: Specific checkpoint retrieval, failure for unknown ID, returned as defensive copy (different reference, same content)
  - **List**: Checkpoints in save order, task isolation (task-2 unaffected by task-1 operations), empty array for unknown task
  - **Delete**: Single checkpoint removal, false for unknown ID, task index cleanup when last checkpoint removed
  - **DeleteAll**: All checkpoints for task removed and count returned, other tasks unaffected, zero for unknown task
  - Factory function `createCheckpointManager` passes config correctly (enforces maxPerTask: 1)
