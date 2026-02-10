/**
 * SessionManager Unit Tests
 */

import { mkdtemp, rm } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JSONLPersistence } from '../../../../src/core/session/jsonl-persistence';
import { SessionRecovery } from '../../../../src/core/session/session-recovery';
import { SessionManager, createSessionManager } from '../../../../src/core/session/session-manager';
import type { SessionEntry } from '../../../../src/core/session/interfaces/session.interface';

describe('SessionManager', () => {
  let tmpDir: string;
  let persistence: JSONLPersistence;
  let recovery: SessionRecovery;
  let manager: SessionManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'manager-test-'));
    persistence = new JSONLPersistence(tmpDir);
    recovery = new SessionRecovery(persistence);
    manager = new SessionManager(persistence, recovery, 0); // 0 = no auto-checkpoint
  });

  afterEach(async () => {
    await manager.dispose();
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('startSession', () => {
    it('should generate a UUID session ID', async () => {
      const id = await manager.startSession();
      // UUID v4 pattern
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('should use provided session ID', async () => {
      const id = await manager.startSession('custom-id');
      expect(id).toBe('custom-id');
    });

    it('should write session_start entry', async () => {
      const id = await manager.startSession('s1');
      const entries = await persistence.readLast(id, 1);
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('state_change');
      expect((entries[0].data as Record<string, unknown>).action).toBe('session_start');
    });

    it('should set active session', async () => {
      expect(manager.getActiveSession()).toBeNull();
      const id = await manager.startSession();
      expect(manager.getActiveSession()).toBe(id);
    });

    it('should emit session:start event', async () => {
      const events: string[] = [];
      manager.on('session:start', (sid) => events.push(sid));

      const id = await manager.startSession();
      expect(events).toEqual([id]);
    });
  });

  describe('endSession', () => {
    it('should write session_end entry', async () => {
      const id = await manager.startSession('s1');
      await manager.endSession(id);

      const entries = await persistence.readLast(id, 1);
      expect(entries[0].type).toBe('state_change');
      expect((entries[0].data as Record<string, unknown>).action).toBe('session_end');
    });

    it('should clear active session', async () => {
      const id = await manager.startSession();
      expect(manager.getActiveSession()).toBe(id);
      await manager.endSession(id);
      expect(manager.getActiveSession()).toBeNull();
    });

    it('should emit session:end event', async () => {
      const events: string[] = [];
      manager.on('session:end', (sid) => events.push(sid));

      const id = await manager.startSession('s1');
      await manager.endSession(id);
      expect(events).toEqual([id]);
    });
  });

  describe('appendEntry', () => {
    it('should add timestamp and seq to entry', async () => {
      const id = await manager.startSession('s1');
      await manager.appendEntry(id, {
        type: 'user_message',
        data: { text: 'hi' },
      });

      const entries = await persistence.readLast(id, 1);
      expect(entries[0].type).toBe('user_message');
      expect(entries[0].timestamp).toBeDefined();
      expect(entries[0].seq).toBeDefined();
      expect(typeof entries[0].seq).toBe('number');
    });

    it('should emit session:entry event', async () => {
      const received: SessionEntry[] = [];
      manager.on('session:entry', (_sid, entry) => received.push(entry));

      const id = await manager.startSession('s1');
      await manager.appendEntry(id, {
        type: 'tool_call',
        data: { tool: 'read' },
      });

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('tool_call');
    });

    it('should increment seq for each entry', async () => {
      const id = await manager.startSession('s1');
      await manager.appendEntry(id, { type: 'user_message', data: {} });
      await manager.appendEntry(id, { type: 'agent_response', data: {} });

      const all: SessionEntry[] = [];
      for await (const e of persistence.readAll(id)) {
        all.push(e);
      }
      // session_start (seq=0), user_message (seq=1), agent_response (seq=2)
      expect(all[0].seq).toBe(0);
      expect(all[1].seq).toBe(1);
      expect(all[2].seq).toBe(2);
    });

    it('should preserve metadata', async () => {
      const id = await manager.startSession('s1');
      await manager.appendEntry(id, {
        type: 'user_message',
        data: { text: 'hi' },
        metadata: { source: 'cli' },
      });

      const entries = await persistence.readLast(id, 1);
      expect(entries[0].metadata).toEqual({ source: 'cli' });
    });
  });

  describe('checkpoint', () => {
    it('should write checkpoint entry', async () => {
      const id = await manager.startSession('s1');
      await manager.checkpoint(id);

      const entries = await persistence.readLast(id, 1);
      expect(entries[0].type).toBe('checkpoint');
    });

    it('should emit session:checkpoint event', async () => {
      const events: string[] = [];
      manager.on('session:checkpoint', (sid) => events.push(sid));

      const id = await manager.startSession('s1');
      await manager.checkpoint(id);
      expect(events).toEqual([id]);
    });
  });

  describe('auto-checkpoint', () => {
    it('should auto-checkpoint at interval', async () => {
      const autoManager = new SessionManager(persistence, recovery, 50); // 50ms
      const events: string[] = [];
      autoManager.on('session:checkpoint', (sid) => events.push(sid));

      const id = await autoManager.startSession('auto');

      // Wait for at least one checkpoint
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]).toBe(id);

      await autoManager.dispose();
    });
  });

  describe('listSessions', () => {
    it('should list all sessions with info', async () => {
      await manager.startSession('a');
      await manager.endSession('a');
      await manager.startSession('b');

      const list = await manager.listSessions();
      expect(list).toHaveLength(2);
      const ids = list.map((i) => i.sessionId).sort();
      expect(ids).toEqual(['a', 'b']);
    });

    it('should return empty when no sessions', async () => {
      const list = await manager.listSessions();
      expect(list).toHaveLength(0);
    });
  });

  describe('dispose', () => {
    it('should end active session on dispose', async () => {
      const id = await manager.startSession('s1');

      const events: string[] = [];
      manager.on('session:end', (sid) => events.push(sid));

      await manager.dispose();
      expect(events).toEqual([id]);
      expect(manager.getActiveSession()).toBeNull();
    });

    it('should clear checkpoint timer', async () => {
      const autoManager = new SessionManager(persistence, recovery, 50);
      await autoManager.startSession('s1');
      await autoManager.dispose();

      // Wait to ensure no more checkpoints fire
      const events: string[] = [];
      autoManager.on('session:checkpoint', (sid) => events.push(sid));
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(events).toHaveLength(0);
    });

    it('should be safe to call multiple times', async () => {
      await manager.startSession('s1');
      await manager.dispose();
      await expect(manager.dispose()).resolves.not.toThrow();
    });
  });

  describe('crash recovery on start', () => {
    it('should detect and recover incomplete session', async () => {
      // Simulate crash: write start but no end
      await persistence.append('crashed', {
        timestamp: new Date().toISOString(),
        type: 'state_change',
        data: { action: 'session_start' },
        seq: 0,
      });
      await persistence.append('crashed', {
        timestamp: new Date().toISOString(),
        type: 'user_message',
        data: { text: 'mid-session' },
        seq: 1,
      });

      // Starting with same ID should trigger recovery
      const id = await manager.startSession('crashed');
      expect(id).toBe('crashed');

      // The new session_start should be appended (3rd entry)
      const all: SessionEntry[] = [];
      for await (const e of persistence.readAll('crashed')) {
        all.push(e);
      }
      expect(all.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('createSessionManager', () => {
    it('should create with defaults', async () => {
      const m = await createSessionManager({ persistence });
      expect(m).toBeInstanceOf(SessionManager);
      await m.dispose();
    });

    it('should create with recovery', async () => {
      const m = await createSessionManager({ persistence, recovery });
      expect(m).toBeInstanceOf(SessionManager);
      await m.dispose();
    });
  });
});
