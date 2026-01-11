/**
 * Session Recovery Hook Tests
 */

import {
  SessionRecoveryHook,
  SessionStatus,
  CheckpointType,
  StorageBackend,
  IStorageAdapter,
  StorageStats,
  DEFAULT_SESSION_RECOVERY_CONFIG,
} from '../../../../../src/core/hooks/session-recovery/index.js';
import { HookEvent, HookContext, HookAction } from '../../../../../src/core/interfaces/hook.interface.js';

describe('SessionRecoveryHook', () => {
  let hook: SessionRecoveryHook;

  beforeEach(() => {
    hook = new SessionRecoveryHook();
  });

  afterEach(async () => {
    await hook.dispose();
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      const config = hook.getRecoveryConfig();
      expect(config.storageBackend).toBe(StorageBackend.MEMORY);
      expect(config.autoCheckpointInterval).toBe(DEFAULT_SESSION_RECOVERY_CONFIG.autoCheckpointInterval);
      expect(config.maxCheckpoints).toBe(DEFAULT_SESSION_RECOVERY_CONFIG.maxCheckpoints);
      expect(config.autoRecovery).toBe(DEFAULT_SESSION_RECOVERY_CONFIG.autoRecovery);
    });

    it('should create with custom config', () => {
      const customHook = new SessionRecoveryHook({
        autoCheckpointInterval: 60000,
        maxCheckpoints: 5,
        autoRecovery: false,
      });

      const config = customHook.getRecoveryConfig();
      expect(config.autoCheckpointInterval).toBe(60000);
      expect(config.maxCheckpoints).toBe(5);
      expect(config.autoRecovery).toBe(false);
    });

    it('should have correct hook metadata', () => {
      expect(hook.name).toBe('session-recovery');
      expect(hook.description).toBe('Manages session persistence, checkpoints, and recovery');
      expect(hook.event).toBe(HookEvent.SESSION_START);
    });
  });

  describe('Session Lifecycle', () => {
    it('should start a new session', async () => {
      const session = await hook.startSession({ projectId: 'test-project' });

      expect(session.id).toBeDefined();
      expect(session.status).toBe(SessionStatus.ACTIVE);
      expect(session.metadata.projectId).toBe('test-project');
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should get current session', async () => {
      const started = await hook.startSession();
      const current = hook.getCurrentSession();

      expect(current).toBeDefined();
      expect(current?.id).toBe(started.id);
    });

    it('should end a session', async () => {
      await hook.startSession();
      const ended = await hook.endSession();

      expect(ended).toBeDefined();
      expect(ended?.status).toBe(SessionStatus.COMPLETED);
      expect(hook.getCurrentSession()).toBeUndefined();
    });

    it('should return undefined when ending non-existent session', async () => {
      const result = await hook.endSession();
      expect(result).toBeUndefined();
    });

    it('should update session context', async () => {
      await hook.startSession();
      await hook.updateContext({
        variables: { key: 'value' },
        messages: [{ role: 'user', content: 'hello' }],
      });

      const session = hook.getCurrentSession();
      expect(session?.context.variables).toEqual({ key: 'value' });
      expect(session?.context.messages).toHaveLength(1);
    });

    it('should throw when updating context without active session', async () => {
      await expect(hook.updateContext({ variables: {} })).rejects.toThrow('No active session');
    });
  });

  describe('Checkpoints', () => {
    beforeEach(async () => {
      await hook.startSession();
    });

    it('should create a checkpoint', async () => {
      const checkpoint = await hook.checkpoint('test-checkpoint');

      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.name).toBe('test-checkpoint');
      expect(checkpoint.type).toBe(CheckpointType.MANUAL);
      expect(checkpoint.checksum).toBeDefined();
      expect(checkpoint.sizeBytes).toBeGreaterThan(0);
    });

    it('should list checkpoints', async () => {
      await hook.checkpoint('first');
      await hook.checkpoint('second');

      const checkpoints = await hook.listCheckpoints();
      expect(checkpoints).toHaveLength(2);
      // Both checkpoints should exist
      const names = checkpoints.map((c) => c.name);
      expect(names).toContain('first');
      expect(names).toContain('second');
    });

    it('should get a specific checkpoint', async () => {
      const created = await hook.checkpoint('test');
      const retrieved = await hook.getCheckpoint(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('test');
    });

    it('should delete a checkpoint', async () => {
      const checkpoint = await hook.checkpoint('to-delete');
      const deleted = await hook.deleteCheckpoint(checkpoint.id);

      expect(deleted).toBe(true);
      expect(await hook.getCheckpoint(checkpoint.id)).toBeUndefined();
    });

    it('should enforce max checkpoints limit', async () => {
      const limitedHook = new SessionRecoveryHook({ maxCheckpoints: 3 });
      await limitedHook.startSession();

      for (let i = 0; i < 5; i++) {
        await limitedHook.checkpoint(`checkpoint-${i}`);
      }

      const checkpoints = await limitedHook.listCheckpoints();
      expect(checkpoints).toHaveLength(3);

      await limitedHook.dispose();
    });

    it('should throw when creating checkpoint without active session', async () => {
      await hook.endSession();
      await expect(hook.checkpoint()).rejects.toThrow('No active session');
    });
  });

  describe('Session Recovery', () => {
    it('should recover session from checkpoint', async () => {
      // Create session with context
      const session = await hook.startSession({ projectId: 'recovery-test' });
      await hook.updateContext({
        variables: { foo: 'bar' },
        messages: [{ role: 'user', content: 'test message' }],
      });
      await hook.checkpoint('recovery-point');

      // End session
      await hook.endSession();

      // Recover session
      const result = await hook.recoverSession(session.id);

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.status).toBe(SessionStatus.ACTIVE);
      expect(result.session?.context.variables).toEqual({ foo: 'bar' });
      expect(result.checkpoint).toBeDefined();
    });

    it('should recover from specific checkpoint', async () => {
      await hook.startSession();
      await hook.updateContext({ variables: { version: 1 } });
      const first = await hook.checkpoint('v1');

      await hook.updateContext({ variables: { version: 2 } });
      await hook.checkpoint('v2');

      const sessionId = hook.getCurrentSession()!.id;
      await hook.endSession();

      const result = await hook.recoverSession(sessionId, { checkpointId: first.id });

      expect(result.success).toBe(true);
      expect(result.session?.context.variables).toEqual({ version: 1 });
    });

    it('should fail recovery for non-existent session', async () => {
      const result = await hook.recoverSession('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Session not found');
    });

    it('should fail recovery when no checkpoint exists', async () => {
      const session = await hook.startSession();
      await hook.endSession();

      // Clear checkpoints
      const checkpoints = await hook.listCheckpoints(session.id);
      for (const cp of checkpoints) {
        await hook.deleteCheckpoint(cp.id);
      }

      const result = await hook.recoverSession(session.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No checkpoint found');
    });

    it('should validate checksum during recovery', async () => {
      const session = await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();

      const result = await hook.recoverSession(session.id, { validateChecksum: true });
      expect(result.success).toBe(true);
    });

    it('should create recovery checkpoint after restoration', async () => {
      const session = await hook.startSession();
      await hook.checkpoint('original');
      const sessionId = session.id;
      await hook.endSession();

      await hook.recoverSession(sessionId, { createRecoveryCheckpoint: true });

      const checkpoints = await hook.listCheckpoints();
      const recoveryCheckpoint = checkpoints.find((c) => c.type === CheckpointType.RECOVERY);
      expect(recoveryCheckpoint).toBeDefined();
    });
  });

  describe('Session Management', () => {
    it('should list all sessions', async () => {
      await hook.startSession({ projectId: 'project-1' });
      await hook.endSession();
      await hook.startSession({ projectId: 'project-2' });
      await hook.endSession();

      const sessions = await hook.listSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should get a specific session', async () => {
      const created = await hook.startSession({ projectId: 'test' });
      await hook.endSession();

      const retrieved = await hook.getSession(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.metadata.projectId).toBe('test');
    });

    it('should delete a session and its checkpoints', async () => {
      const session = await hook.startSession();
      await hook.checkpoint('cp1');
      await hook.checkpoint('cp2');
      const sessionId = session.id;
      await hook.endSession();

      const deleted = await hook.deleteSession(sessionId);
      expect(deleted).toBe(true);
      expect(await hook.getSession(sessionId)).toBeUndefined();
      expect(await hook.listCheckpoints(sessionId)).toHaveLength(0);
    });
  });

  describe('Metrics', () => {
    it('should track session metrics', async () => {
      await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();

      const metrics = hook.getMetrics();
      expect(metrics.totalSessions).toBe(1);
      expect(metrics.totalCheckpoints).toBeGreaterThanOrEqual(1);
      expect(metrics.lastCheckpointAt).toBeDefined();
    });

    it('should track recovery metrics', async () => {
      const session = await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();

      await hook.recoverSession(session.id);

      const metrics = hook.getMetrics();
      expect(metrics.totalRecoveries).toBe(1);
      expect(metrics.successfulRecoveries).toBe(1);
      expect(metrics.lastRecoveryAt).toBeDefined();
    });

    it('should track failed recovery', async () => {
      await hook.recoverSession('non-existent');

      const metrics = hook.getMetrics();
      expect(metrics.failedRecoveries).toBe(1);
    });

    it('should reset metrics', async () => {
      await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();

      hook.resetMetrics();

      const metrics = hook.getMetrics();
      expect(metrics.totalSessions).toBe(0);
      expect(metrics.totalCheckpoints).toBe(0);
    });
  });

  describe('Event Subscriptions', () => {
    it('should notify on session start', async () => {
      const callback = jest.fn();
      hook.onSessionStart(callback);

      await hook.startSession();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SessionStatus.ACTIVE,
        })
      );
    });

    it('should notify on session end', async () => {
      const callback = jest.fn();
      hook.onSessionEnd(callback);

      await hook.startSession();
      await hook.endSession();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should notify on checkpoint created', async () => {
      const callback = jest.fn();
      hook.onCheckpointCreated(callback);

      await hook.startSession();
      await hook.checkpoint('test');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'test' }),
        expect.objectContaining({ status: SessionStatus.ACTIVE })
      );
    });

    it('should notify on checkpoint restored', async () => {
      const callback = jest.fn();
      hook.onCheckpointRestored(callback);

      const session = await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();
      await hook.recoverSession(session.id);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should notify on recovery failed', async () => {
      const callback = jest.fn();
      hook.onRecoveryFailed(callback);

      await hook.recoverSession('non-existent');

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(Error), 'non-existent');
    });

    it('should allow unsubscription', async () => {
      const callback = jest.fn();
      const subscription = hook.onSessionStart(callback);

      subscription.unsubscribe();
      await hook.startSession();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Hook Execution', () => {
    it('should handle SESSION_START event', async () => {
      const context: HookContext<unknown> = {
        event: HookEvent.SESSION_START,
        timestamp: new Date(),
        source: 'test',
        data: { metadata: { projectId: 'test-project' } },
      };

      const result = await hook.execute(context);

      expect(result.action).toBe(HookAction.MODIFY);
      expect(result.data?.eventType).toBe('session_start');
      expect(result.data?.session).toBeDefined();
    });

    it('should handle SESSION_END event', async () => {
      await hook.startSession();

      const context: HookContext<unknown> = {
        event: HookEvent.SESSION_END,
        timestamp: new Date(),
        source: 'test',
        data: {},
      };

      const result = await hook.execute(context);

      expect(result.action).toBe(HookAction.MODIFY);
      expect(result.data?.eventType).toBe('session_end');
    });

    it('should handle SESSION_CHECKPOINT event', async () => {
      await hook.startSession();

      const context: HookContext<unknown> = {
        event: HookEvent.SESSION_CHECKPOINT,
        timestamp: new Date(),
        source: 'test',
        data: { name: 'manual-checkpoint' },
      };

      const result = await hook.execute(context);

      expect(result.action).toBe(HookAction.MODIFY);
      expect(result.data?.eventType).toBe('checkpoint_created');
      expect(result.data?.checkpoint?.name).toBe('manual-checkpoint');
    });

    it('should handle SESSION_RESTORE event', async () => {
      const session = await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();

      const context: HookContext<unknown> = {
        event: HookEvent.SESSION_RESTORE,
        timestamp: new Date(),
        source: 'test',
        data: {},
        metadata: { sessionId: session.id },
      };

      const result = await hook.execute(context);

      expect(result.action).toBe(HookAction.MODIFY);
      expect(result.data?.eventType).toBe('checkpoint_restored');
    });

    it('should check shouldRun correctly', () => {
      const sessionEvents = [
        HookEvent.SESSION_START,
        HookEvent.SESSION_END,
        HookEvent.SESSION_CHECKPOINT,
        HookEvent.SESSION_RESTORE,
      ];

      for (const event of sessionEvents) {
        const context: HookContext<unknown> = {
          event,
          timestamp: new Date(),
          source: 'test',
          data: {},
        };
        expect(hook.shouldRun(context)).toBe(true);
      }

      // Non-session event should not run
      const otherContext: HookContext<unknown> = {
        event: HookEvent.TASK_BEFORE,
        timestamp: new Date(),
        source: 'test',
        data: {},
      };
      expect(hook.shouldRun(otherContext)).toBe(false);
    });
  });

  describe('Storage Statistics', () => {
    it('should return storage stats', async () => {
      await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();

      const stats = await hook.getStorageStats();

      expect(stats.sessionCount).toBe(1);
      expect(stats.checkpointCount).toBeGreaterThanOrEqual(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  describe('Custom Storage Adapter', () => {
    it('should use custom storage adapter', async () => {
      const customAdapter: IStorageAdapter = {
        initialize: jest.fn().mockResolvedValue(undefined),
        saveSession: jest.fn().mockResolvedValue(undefined),
        loadSession: jest.fn().mockResolvedValue(undefined),
        deleteSession: jest.fn().mockResolvedValue(true),
        listSessions: jest.fn().mockResolvedValue([]),
        saveCheckpoint: jest.fn().mockResolvedValue(undefined),
        loadCheckpoint: jest.fn().mockResolvedValue(undefined),
        deleteCheckpoint: jest.fn().mockResolvedValue(true),
        listCheckpoints: jest.fn().mockResolvedValue([]),
        getStats: jest.fn().mockResolvedValue({
          sessionCount: 0,
          checkpointCount: 0,
          totalSizeBytes: 0,
        } as StorageStats),
        clear: jest.fn().mockResolvedValue(undefined),
        dispose: jest.fn().mockResolvedValue(undefined),
      };

      const customHook = new SessionRecoveryHook({ storageAdapter: customAdapter });
      await customHook.startSession();

      expect(customAdapter.initialize).toHaveBeenCalled();
      expect(customAdapter.saveSession).toHaveBeenCalled();

      await customHook.dispose();
    });
  });

  describe('Auto Checkpoint', () => {
    jest.useFakeTimers();

    it('should create auto checkpoints at interval', async () => {
      const fastHook = new SessionRecoveryHook({
        autoCheckpointInterval: 1000,
      });

      await fastHook.startSession();

      // Advance timer past interval
      jest.advanceTimersByTime(1100);

      // Need to flush promises
      await Promise.resolve();

      const checkpoints = await fastHook.listCheckpoints();
      expect(checkpoints.some((c) => c.type === CheckpointType.AUTO)).toBe(true);

      await fastHook.dispose();
    });

    it('should not create auto checkpoints when disabled', async () => {
      const noAutoHook = new SessionRecoveryHook({
        autoCheckpointInterval: 0,
      });

      await noAutoHook.startSession();
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      const checkpoints = await noAutoHook.listCheckpoints();
      expect(checkpoints.filter((c) => c.type === CheckpointType.AUTO)).toHaveLength(0);

      await noAutoHook.dispose();
    });

    afterEach(() => {
      jest.useRealTimers();
    });
  });

  describe('Hook Lifecycle', () => {
    it('should respect enabled state', () => {
      hook.disable();

      const context: HookContext<unknown> = {
        event: HookEvent.SESSION_START,
        timestamp: new Date(),
        source: 'test',
        data: {},
      };

      expect(hook.shouldRun(context)).toBe(false);

      hook.enable();
      expect(hook.shouldRun(context)).toBe(true);
    });

    it('should get hook config', () => {
      const config = hook.getConfig();

      expect(config.name).toBe('session-recovery');
      // Priority comes from BaseHook default when not specified in constructor
      expect(config.priority).toBe(100);
      expect(config.enabled).toBe(true);
    });

    it('should use DEFAULT_SESSION_RECOVERY_CONFIG priority when specified', () => {
      const configuredHook = new SessionRecoveryHook({
        priority: DEFAULT_SESSION_RECOVERY_CONFIG.priority,
      });
      const config = configuredHook.getConfig();
      expect(config.priority).toBe(50);
    });
  });

  describe('Dispose', () => {
    it('should clean up on dispose', async () => {
      await hook.startSession();
      await hook.checkpoint();

      await hook.dispose();

      // After dispose, starting new session should work (re-initialize)
      await hook.startSession();
      expect(hook.getCurrentSession()).toBeDefined();

      await hook.dispose();
    });

    it('should end active session on dispose', async () => {
      const callback = jest.fn();
      hook.onSessionEnd(callback);

      await hook.startSession();
      await hook.dispose();

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should clear callbacks on dispose', async () => {
      const callback = jest.fn();
      hook.onSessionStart(callback);

      await hook.dispose();

      // Start fresh hook
      await hook.startSession();

      // Callback should not be called since it was cleared
      expect(callback).not.toHaveBeenCalled();

      await hook.dispose();
    });
  });

  describe('Default Config', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.priority).toBe(50);
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.enabled).toBe(true);
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.storageBackend).toBe(StorageBackend.MEMORY);
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.autoCheckpointInterval).toBe(300000);
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.maxCheckpoints).toBe(10);
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.autoRecovery).toBe(true);
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.sessionExpiry).toBe(86400000);
      expect(DEFAULT_SESSION_RECOVERY_CONFIG.checkpointExpiry).toBe(604800000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple startSession calls', async () => {
      const first = await hook.startSession();
      const second = await hook.startSession();

      // Second call should create a new session
      expect(second.id).not.toBe(first.id);
    });

    it('should handle recovery callback', async () => {
      const onRecovery = jest.fn();
      const session = await hook.startSession();
      await hook.checkpoint();
      await hook.endSession();

      await hook.recoverSession(session.id, { onRecovery });

      expect(onRecovery).toHaveBeenCalledWith(
        expect.objectContaining({ id: session.id }),
        expect.objectContaining({ sessionId: session.id })
      );
    });

    it('should preserve session context through checkpoints', async () => {
      await hook.startSession();

      const complexContext = {
        variables: {
          nested: { deep: { value: 123 } },
          array: [1, 2, 3],
        },
        messages: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
        ],
        custom: {
          flag: true,
          timestamp: new Date().toISOString(),
        },
      };

      await hook.updateContext(complexContext);
      const checkpoint = await hook.checkpoint();
      const sessionId = hook.getCurrentSession()!.id;
      await hook.endSession();

      const result = await hook.recoverSession(sessionId, { checkpointId: checkpoint.id });

      expect(result.session?.context.variables).toEqual(complexContext.variables);
      expect(result.session?.context.messages).toEqual(complexContext.messages);
    });
  });
});
