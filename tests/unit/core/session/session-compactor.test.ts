/**
 * SessionCompactor Unit Tests
 */

import { mkdtemp, rm } from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JSONLPersistence } from '../../../../src/core/session/jsonl-persistence';
import {
  SessionCompactor,
  createSessionCompactor,
  DEFAULT_COMPACTION_POLICY,
} from '../../../../src/core/session/session-compactor';
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

describe('SessionCompactor', () => {
  let tmpDir: string;
  let persistence: JSONLPersistence;
  let compactor: SessionCompactor;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'compactor-test-'));
    persistence = new JSONLPersistence(tmpDir);
    compactor = new SessionCompactor(persistence, {
      ...DEFAULT_COMPACTION_POLICY,
      maxEntries: 10,
      keepRecentCount: 3,
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('shouldCompact', () => {
    it('should return false for non-existent session', async () => {
      expect(await compactor.shouldCompact('nope')).toBe(false);
    });

    it('should return false when under thresholds', async () => {
      for (let i = 0; i < 5; i++) {
        await persistence.append('s1', makeEntry({ seq: i }));
      }
      expect(await compactor.shouldCompact('s1')).toBe(false);
    });

    it('should return true when entry count exceeds maxEntries', async () => {
      for (let i = 0; i < 15; i++) {
        await persistence.append('s1', makeEntry({ seq: i }));
      }
      expect(await compactor.shouldCompact('s1')).toBe(true);
    });
  });

  describe('compact', () => {
    it('should compact old entries and keep recent ones', async () => {
      for (let i = 0; i < 8; i++) {
        await persistence.append('s1', makeEntry({ seq: i }));
      }

      const result = await compactor.compact('s1');
      expect(result.sessionId).toBe('s1');
      expect(result.originalEntries).toBe(8);
      // 1 summary + 3 recent = 4
      expect(result.compactedEntries).toBe(4);

      // Verify contents
      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('s1')) {
        entries.push(entry);
      }
      expect(entries).toHaveLength(4);
      expect(entries[0].type).toBe('compaction_summary');
      // Recent entries should have seq 5, 6, 7
      expect(entries[1].seq).toBe(5);
      expect(entries[2].seq).toBe(6);
      expect(entries[3].seq).toBe(7);
    });

    it('should not compact when entries <= keepRecentCount', async () => {
      for (let i = 0; i < 3; i++) {
        await persistence.append('s1', makeEntry({ seq: i }));
      }

      const result = await compactor.compact('s1');
      expect(result.originalEntries).toBe(3);
      expect(result.compactedEntries).toBe(3);
      expect(result.bytesReclaimed).toBe(0);
    });

    it('should return zeros for non-existent session', async () => {
      const result = await compactor.compact('ghost');
      expect(result.originalEntries).toBe(0);
      expect(result.compactedEntries).toBe(0);
    });

    it('should use custom summarizer', async () => {
      for (let i = 0; i < 6; i++) {
        await persistence.append('s1', makeEntry({ seq: i }));
      }

      const result = await compactor.compact('s1', (entries) => ({
        timestamp: new Date().toISOString(),
        type: 'compaction_summary',
        data: { custom: true, removed: entries.length },
      }));

      expect(result.originalEntries).toBe(6);

      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('s1')) {
        entries.push(entry);
      }
      expect(entries[0].type).toBe('compaction_summary');
      expect((entries[0].data as Record<string, unknown>).custom).toBe(true);
    });

    it('should include type counts in default summarizer', async () => {
      await persistence.append('s1', makeEntry({ seq: 0, type: 'user_message' }));
      await persistence.append('s1', makeEntry({ seq: 1, type: 'agent_response' }));
      await persistence.append('s1', makeEntry({ seq: 2, type: 'user_message' }));
      await persistence.append('s1', makeEntry({ seq: 3, type: 'tool_call' }));
      await persistence.append('s1', makeEntry({ seq: 4, type: 'user_message' }));
      await persistence.append('s1', makeEntry({ seq: 5, type: 'user_message' }));

      await compactor.compact('s1');

      const entries: SessionEntry[] = [];
      for await (const entry of persistence.readAll('s1')) {
        entries.push(entry);
      }

      const summary = entries[0];
      expect(summary.type).toBe('compaction_summary');
      const data = summary.data as Record<string, unknown>;
      expect(data.compactedCount).toBe(3);
      const typeCounts = data.typeCounts as Record<string, number>;
      expect(typeCounts.user_message).toBe(2);
      expect(typeCounts.agent_response).toBe(1);
    });
  });

  describe('compactAll', () => {
    it('should compact sessions that exceed thresholds', async () => {
      // Over threshold
      for (let i = 0; i < 15; i++) {
        await persistence.append('big', makeEntry({ seq: i }));
      }
      // Under threshold
      for (let i = 0; i < 3; i++) {
        await persistence.append('small', makeEntry({ seq: i }));
      }

      const results = await compactor.compactAll();
      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe('big');
    });

    it('should return empty when nothing needs compaction', async () => {
      await persistence.append('s1', makeEntry());
      const results = await compactor.compactAll();
      expect(results).toHaveLength(0);
    });
  });

  describe('DEFAULT_COMPACTION_POLICY', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_COMPACTION_POLICY.maxEntries).toBe(10_000);
      expect(DEFAULT_COMPACTION_POLICY.maxSizeBytes).toBe(50 * 1024 * 1024);
      expect(DEFAULT_COMPACTION_POLICY.keepRecentCount).toBe(500);
      expect(DEFAULT_COMPACTION_POLICY.maxAgeMs).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('createSessionCompactor', () => {
    it('should create with default policy', () => {
      const c = createSessionCompactor({ persistence });
      expect(c).toBeInstanceOf(SessionCompactor);
    });

    it('should merge partial policy', () => {
      const c = createSessionCompactor({
        persistence,
        policy: { maxEntries: 100 },
      });
      expect(c).toBeInstanceOf(SessionCompactor);
    });
  });
});
