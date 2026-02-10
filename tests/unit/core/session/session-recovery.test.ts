/**
 * SessionRecovery Unit Tests
 */

import { mkdtemp, rm } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JSONLPersistence } from '../../../../src/core/session/jsonl-persistence';
import { SessionRecovery, createSessionRecovery } from '../../../../src/core/session/session-recovery';
import type { SessionEntry } from '../../../../src/core/session/interfaces/session.interface';

function makeEntry(overrides: Partial<SessionEntry> = {}): SessionEntry {
  return {
    timestamp: new Date().toISOString(),
    type: 'user_message',
    data: { text: 'hello' },
    seq: 0,
    ...overrides,
  };
}

describe('SessionRecovery', () => {
  let tmpDir: string;
  let persistence: JSONLPersistence;
  let recovery: SessionRecovery;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'recovery-test-'));
    persistence = new JSONLPersistence(tmpDir);
    recovery = new SessionRecovery(persistence);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('detectIncompleteSession', () => {
    it('should return false for non-existent session', async () => {
      expect(await recovery.detectIncompleteSession('nope')).toBe(false);
    });

    it('should return true for session without session_end', async () => {
      await persistence.append('s1', makeEntry({ type: 'state_change', data: { action: 'session_start' } }));
      await persistence.append('s1', makeEntry({ type: 'user_message' }));

      expect(await recovery.detectIncompleteSession('s1')).toBe(true);
    });

    it('should return false for properly closed session', async () => {
      await persistence.append('s1', makeEntry({ type: 'state_change', data: { action: 'session_start' } }));
      await persistence.append('s1', makeEntry({ type: 'user_message' }));
      await persistence.append('s1', makeEntry({ type: 'state_change', data: { action: 'session_end' } }));

      expect(await recovery.detectIncompleteSession('s1')).toBe(false);
    });

    it('should return true for empty file', async () => {
      // Create empty session file
      const { writeFile } = await import('fs/promises');
      await writeFile(path.join(tmpDir, 's1.jsonl'), '');

      expect(await recovery.detectIncompleteSession('s1')).toBe(true);
    });
  });

  describe('recover', () => {
    it('should return failed for non-existent session', async () => {
      const result = await recovery.recover('ghost');
      expect(result.status).toBe('failed');
      expect(result.entriesRecovered).toBe(0);
      expect(result.lastValidEntry).toBeNull();
    });

    it('should recover all entries from clean session', async () => {
      await persistence.append('s1', makeEntry({ seq: 0 }));
      await persistence.append('s1', makeEntry({ seq: 1 }));
      await persistence.append('s1', makeEntry({ seq: 2 }));

      const result = await recovery.recover('s1');
      expect(result.status).toBe('full');
      expect(result.entriesRecovered).toBe(3);
      expect(result.lastValidEntry!.seq).toBe(2);
      expect(result.corruptedLines).toBe(0);
    });

    it('should detect empty session', async () => {
      const { writeFile } = await import('fs/promises');
      await writeFile(path.join(tmpDir, 'empty.jsonl'), '');

      const result = await recovery.recover('empty');
      expect(result.status).toBe('empty');
      expect(result.entriesRecovered).toBe(0);
    });

    it('should return sessionId in result', async () => {
      await persistence.append('my-session', makeEntry());
      const result = await recovery.recover('my-session');
      expect(result.sessionId).toBe('my-session');
    });
  });

  describe('recoverAll', () => {
    it('should recover all incomplete sessions', async () => {
      // Complete session
      await persistence.append('complete', makeEntry({ type: 'state_change', data: { action: 'session_start' } }));
      await persistence.append('complete', makeEntry({ type: 'state_change', data: { action: 'session_end' } }));

      // Incomplete sessions
      await persistence.append('crash1', makeEntry({ type: 'state_change', data: { action: 'session_start' } }));
      await persistence.append('crash1', makeEntry({ type: 'user_message' }));

      await persistence.append('crash2', makeEntry({ type: 'state_change', data: { action: 'session_start' } }));

      const results = await recovery.recoverAll();
      expect(results).toHaveLength(2);

      const sessionIds = results.map((r) => r.sessionId).sort();
      expect(sessionIds).toEqual(['crash1', 'crash2']);
    });

    it('should return empty array when no incomplete sessions', async () => {
      await persistence.append('ok', makeEntry({ type: 'state_change', data: { action: 'session_end' } }));
      const results = await recovery.recoverAll();
      expect(results).toHaveLength(0);
    });

    it('should return empty array when no sessions exist', async () => {
      const results = await recovery.recoverAll();
      expect(results).toHaveLength(0);
    });
  });

  describe('createSessionRecovery', () => {
    it('should create instance', () => {
      const r = createSessionRecovery({ persistence });
      expect(r).toBeInstanceOf(SessionRecovery);
    });
  });
});
