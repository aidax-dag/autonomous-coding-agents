/**
 * Tests for Checkpoint Manager
 */

import {
  CheckpointManager,
  createCheckpointManager,
} from '@/core/checkpoint';
import type { CheckpointState } from '@/core/checkpoint';

function makeCheckpoint(overrides: Partial<CheckpointState> = {}): CheckpointState {
  return {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    taskId: 'task-1',
    agentId: 'agent-1',
    stepIndex: 0,
    totalSteps: 3,
    context: {},
    completedSteps: [],
    pendingSteps: ['step-1', 'step-2', 'step-3'],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('CheckpointManager', () => {
  describe('constructor', () => {
    it('should create with default config', () => {
      const mgr = new CheckpointManager();
      expect(mgr).toBeInstanceOf(CheckpointManager);
    });

    it('should accept maxPerTask config', () => {
      const mgr = new CheckpointManager({ maxPerTask: 5 });
      expect(mgr).toBeInstanceOf(CheckpointManager);
    });
  });

  describe('save', () => {
    it('should save checkpoint', async () => {
      const mgr = new CheckpointManager();
      const cp = makeCheckpoint({ id: 'cp-1' });

      await mgr.save(cp);
      const result = await mgr.restoreById('cp-1');

      expect(result.success).toBe(true);
      expect(result.checkpoint?.id).toBe('cp-1');
    });

    it('should enforce max-per-task limit', async () => {
      const mgr = new CheckpointManager({ maxPerTask: 2 });

      await mgr.save(makeCheckpoint({ id: 'cp-1', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-2', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-3', taskId: 'task-1' }));

      const all = await mgr.list('task-1');
      expect(all).toHaveLength(2);
      // Oldest (cp-1) should be evicted
      expect(all.map((c) => c.id)).toEqual(['cp-2', 'cp-3']);
    });

    it('should overwrite same checkpoint id', async () => {
      const mgr = new CheckpointManager();
      const cp1 = makeCheckpoint({ id: 'cp-1', stepIndex: 0 });
      const cp2 = makeCheckpoint({ id: 'cp-1', stepIndex: 2 });

      await mgr.save(cp1);
      await mgr.save(cp2);

      const result = await mgr.restoreById('cp-1');
      expect(result.checkpoint?.stepIndex).toBe(2);
    });

    it('should store checkpoint as a copy', async () => {
      const mgr = new CheckpointManager();
      const cp = makeCheckpoint({ id: 'cp-1' });

      await mgr.save(cp);
      cp.stepIndex = 99; // Modify original

      const result = await mgr.restoreById('cp-1');
      expect(result.checkpoint?.stepIndex).toBe(0); // Unchanged
    });
  });

  describe('restore', () => {
    it('should restore latest checkpoint for task', async () => {
      const mgr = new CheckpointManager();

      await mgr.save(makeCheckpoint({ id: 'cp-1', taskId: 'task-1', stepIndex: 0 }));
      await mgr.save(makeCheckpoint({ id: 'cp-2', taskId: 'task-1', stepIndex: 1 }));
      await mgr.save(makeCheckpoint({ id: 'cp-3', taskId: 'task-1', stepIndex: 2 }));

      const result = await mgr.restore('task-1');

      expect(result.success).toBe(true);
      expect(result.checkpoint?.id).toBe('cp-3');
      expect(result.checkpoint?.stepIndex).toBe(2);
    });

    it('should return failure for unknown task', async () => {
      const mgr = new CheckpointManager();
      const result = await mgr.restore('unknown-task');

      expect(result.success).toBe(false);
      expect(result.error).toContain('unknown-task');
      expect(result.remainingSteps).toEqual([]);
    });

    it('should include remaining steps', async () => {
      const mgr = new CheckpointManager();
      const cp = makeCheckpoint({
        id: 'cp-1',
        pendingSteps: ['step-2', 'step-3'],
      });

      await mgr.save(cp);
      const result = await mgr.restore('task-1');

      expect(result.remainingSteps).toEqual(['step-2', 'step-3']);
    });
  });

  describe('restoreById', () => {
    it('should restore specific checkpoint', async () => {
      const mgr = new CheckpointManager();
      await mgr.save(makeCheckpoint({ id: 'cp-1', stepIndex: 0 }));
      await mgr.save(makeCheckpoint({ id: 'cp-2', stepIndex: 1 }));

      const result = await mgr.restoreById('cp-1');
      expect(result.success).toBe(true);
      expect(result.checkpoint?.stepIndex).toBe(0);
    });

    it('should return failure for unknown id', async () => {
      const mgr = new CheckpointManager();
      const result = await mgr.restoreById('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('nonexistent');
    });

    it('should return restored checkpoint as a copy', async () => {
      const mgr = new CheckpointManager();
      await mgr.save(makeCheckpoint({ id: 'cp-1' }));

      const r1 = await mgr.restoreById('cp-1');
      const r2 = await mgr.restoreById('cp-1');
      expect(r1.checkpoint).not.toBe(r2.checkpoint); // Different references
      expect(r1.checkpoint).toEqual(r2.checkpoint); // Same content
    });
  });

  describe('list', () => {
    it('should list checkpoints in save order', async () => {
      const mgr = new CheckpointManager();

      await mgr.save(makeCheckpoint({ id: 'cp-a', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-b', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-c', taskId: 'task-2' }));

      const task1 = await mgr.list('task-1');
      expect(task1).toHaveLength(2);
      expect(task1.map((c) => c.id)).toEqual(['cp-a', 'cp-b']);

      const task2 = await mgr.list('task-2');
      expect(task2).toHaveLength(1);
    });

    it('should return empty for unknown task', async () => {
      const mgr = new CheckpointManager();
      const result = await mgr.list('unknown');
      expect(result).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete specific checkpoint', async () => {
      const mgr = new CheckpointManager();
      await mgr.save(makeCheckpoint({ id: 'cp-1', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-2', taskId: 'task-1' }));

      const deleted = await mgr.delete('cp-1');
      expect(deleted).toBe(true);

      const remaining = await mgr.list('task-1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('cp-2');
    });

    it('should return false for unknown id', async () => {
      const mgr = new CheckpointManager();
      const deleted = await mgr.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should clean up task index when last checkpoint removed', async () => {
      const mgr = new CheckpointManager();
      await mgr.save(makeCheckpoint({ id: 'cp-1', taskId: 'task-1' }));

      await mgr.delete('cp-1');
      const result = await mgr.restore('task-1');
      expect(result.success).toBe(false);
    });
  });

  describe('deleteAll', () => {
    it('should delete all checkpoints for a task', async () => {
      const mgr = new CheckpointManager();
      await mgr.save(makeCheckpoint({ id: 'cp-1', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-2', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-3', taskId: 'task-2' }));

      const count = await mgr.deleteAll('task-1');
      expect(count).toBe(2);

      const remaining1 = await mgr.list('task-1');
      expect(remaining1).toEqual([]);

      // task-2 unaffected
      const remaining2 = await mgr.list('task-2');
      expect(remaining2).toHaveLength(1);
    });

    it('should return 0 for unknown task', async () => {
      const mgr = new CheckpointManager();
      const count = await mgr.deleteAll('unknown');
      expect(count).toBe(0);
    });
  });

  describe('createCheckpointManager', () => {
    it('should create instance via factory', () => {
      const mgr = createCheckpointManager();
      expect(mgr).toBeInstanceOf(CheckpointManager);
    });

    it('should pass config to constructor', async () => {
      const mgr = createCheckpointManager({ maxPerTask: 1 });

      await mgr.save(makeCheckpoint({ id: 'cp-1', taskId: 'task-1' }));
      await mgr.save(makeCheckpoint({ id: 'cp-2', taskId: 'task-1' }));

      const all = await mgr.list('task-1');
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('cp-2');
    });
  });
});
