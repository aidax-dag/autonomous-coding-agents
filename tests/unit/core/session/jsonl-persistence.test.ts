/**
 * JSONLPersistence Unit Tests
 */

import { mkdtemp, rm, readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JSONLPersistence, createJSONLPersistence } from '../../../../src/core/session/jsonl-persistence';
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

describe('JSONLPersistence', () => {
  let tmpDir: string;
  let persistence: JSONLPersistence;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'session-test-'));
    persistence = new JSONLPersistence(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('append', () => {
    it('should create file and append entry', async () => {
      const entry = makeEntry();
      await persistence.append('s1', entry);

      const raw = await readFile(path.join(tmpDir, 's1.jsonl'), 'utf-8');
      const parsed = JSON.parse(raw.trim());
      expect(parsed.type).toBe('user_message');
      expect(parsed.data).toEqual({ text: 'hello' });
    });

    it('should append multiple entries as separate lines', async () => {
      await persistence.append('s1', makeEntry({ seq: 0 }));
      await persistence.append('s1', makeEntry({ seq: 1, type: 'agent_response' }));

      const raw = await readFile(path.join(tmpDir, 's1.jsonl'), 'utf-8');
      const lines = raw.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).seq).toBe(0);
      expect(JSON.parse(lines[1]).seq).toBe(1);
    });

    it('should create subdirectories if needed', async () => {
      const nested = new JSONLPersistence(path.join(tmpDir, 'deep', 'nested'));
      await nested.append('s1', makeEntry());
      expect(await nested.exists('s1')).toBe(true);
    });
  });

  describe('readAll', () => {
    it('should yield all entries in order', async () => {
      await persistence.append('s1', makeEntry({ seq: 0 }));
      await persistence.append('s1', makeEntry({ seq: 1 }));
      await persistence.append('s1', makeEntry({ seq: 2 }));

      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('s1')) {
        entries.push(entry);
      }
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.seq)).toEqual([0, 1, 2]);
    });

    it('should return empty iterable for non-existent session', async () => {
      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('nonexistent')) {
        entries.push(entry);
      }
      expect(entries).toHaveLength(0);
    });

    it('should skip corrupted lines', async () => {
      const fp = path.join(tmpDir, 'corrupt.jsonl');
      const validEntry = JSON.stringify(makeEntry({ seq: 0 }));
      await writeFile(fp, `${validEntry}\n{broken json\n${validEntry.replace('"seq":0', '"seq":1')}\n`);

      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('corrupt')) {
        entries.push(entry);
      }
      expect(entries).toHaveLength(2);
      expect(entries[0].seq).toBe(0);
      expect(entries[1].seq).toBe(1);
    });

    it('should handle empty file', async () => {
      const fp = path.join(tmpDir, 'empty.jsonl');
      await writeFile(fp, '');

      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('empty')) {
        entries.push(entry);
      }
      expect(entries).toHaveLength(0);
    });
  });

  describe('readLast', () => {
    it('should return last N entries', async () => {
      for (let i = 0; i < 5; i++) {
        await persistence.append('s1', makeEntry({ seq: i }));
      }

      const last = await persistence.readLast('s1', 2);
      expect(last).toHaveLength(2);
      expect(last[0].seq).toBe(3);
      expect(last[1].seq).toBe(4);
    });

    it('should return all entries if count exceeds total', async () => {
      await persistence.append('s1', makeEntry({ seq: 0 }));
      const last = await persistence.readLast('s1', 10);
      expect(last).toHaveLength(1);
    });

    it('should return empty for non-existent session', async () => {
      const last = await persistence.readLast('nonexistent', 5);
      expect(last).toHaveLength(0);
    });
  });

  describe('compact', () => {
    it('should replace file with summarizer output', async () => {
      await persistence.append('s1', makeEntry({ seq: 0 }));
      await persistence.append('s1', makeEntry({ seq: 1 }));
      await persistence.append('s1', makeEntry({ seq: 2 }));

      await persistence.compact('s1', (entries) => ({
        timestamp: new Date().toISOString(),
        type: 'compaction_summary',
        data: { count: entries.length },
        seq: 0,
      }));

      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('s1')) {
        entries.push(entry);
      }
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe('compaction_summary');
      expect((entries[0].data as Record<string, unknown>).count).toBe(3);
    });

    it('should be no-op for empty session', async () => {
      // Non-existent file — should not throw
      await persistence.compact('nonexistent', () => makeEntry());
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      await persistence.append('s1', makeEntry());
      expect(await persistence.exists('s1')).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      expect(await persistence.exists('nope')).toBe(false);
    });
  });

  describe('getInfo', () => {
    it('should return session info with correct counts', async () => {
      const t1 = '2025-01-01T00:00:00.000Z';
      const t2 = '2025-01-01T01:00:00.000Z';
      await persistence.append('s1', makeEntry({ timestamp: t1, seq: 0 }));
      await persistence.append('s1', makeEntry({ timestamp: t2, seq: 1 }));

      const info = await persistence.getInfo('s1');
      expect(info).not.toBeNull();
      expect(info!.sessionId).toBe('s1');
      expect(info!.entryCount).toBe(2);
      expect(info!.createdAt).toBe(t1);
      expect(info!.lastActivityAt).toBe(t2);
      expect(info!.sizeBytes).toBeGreaterThan(0);
    });

    it('should detect closed status', async () => {
      await persistence.append('s1', makeEntry({ type: 'state_change', data: { action: 'session_start' } }));
      await persistence.append('s1', makeEntry({ type: 'state_change', data: { action: 'session_end' } }));

      const info = await persistence.getInfo('s1');
      expect(info!.status).toBe('closed');
    });

    it('should detect active status', async () => {
      await persistence.append('s1', makeEntry({ type: 'state_change', data: { action: 'session_start' } }));
      await persistence.append('s1', makeEntry({ type: 'user_message', data: { text: 'hi' } }));

      const info = await persistence.getInfo('s1');
      expect(info!.status).toBe('active');
    });

    it('should return null for non-existent session', async () => {
      expect(await persistence.getInfo('nope')).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete existing session file', async () => {
      await persistence.append('s1', makeEntry());
      expect(await persistence.delete('s1')).toBe(true);
      expect(await persistence.exists('s1')).toBe(false);
    });

    it('should return false for non-existent session', async () => {
      expect(await persistence.delete('nope')).toBe(false);
    });
  });

  describe('listSessionIds', () => {
    it('should list all session IDs', async () => {
      await persistence.append('alpha', makeEntry());
      await persistence.append('beta', makeEntry());

      const ids = await persistence.listSessionIds();
      expect(ids.sort()).toEqual(['alpha', 'beta']);
    });

    it('should return empty array when directory is empty', async () => {
      const ids = await persistence.listSessionIds();
      expect(ids).toEqual([]);
    });

    it('should return empty array when directory does not exist', async () => {
      const p = new JSONLPersistence(path.join(tmpDir, 'gone'));
      const ids = await p.listSessionIds();
      expect(ids).toEqual([]);
    });
  });

  describe('createJSONLPersistence', () => {
    it('should create instance with default dir', async () => {
      const dir = path.join(tmpDir, 'factory');
      const p = await createJSONLPersistence({ baseDir: dir });
      expect(p).toBeInstanceOf(JSONLPersistence);
      await p.append('test', makeEntry());
      expect(await p.exists('test')).toBe(true);
    });
  });
});
