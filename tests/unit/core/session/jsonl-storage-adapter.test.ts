/**
 * Unit tests for JSONLStorageAdapter
 *
 * Tests append-only JSONL file storage for crash-safe session persistence.
 */

import { mkdir, readFile, writeFile, readdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  JSONLStorageAdapter,
  createJSONLStorageAdapter,
} from '../../../../src/core/session/jsonl-storage-adapter.js';
import {
  SessionStatus,
  CheckpointType,
} from '../../../../src/core/hooks/session-recovery/session-recovery.interface.js';
import type {
  Session,
  Checkpoint,
} from '../../../../src/core/hooks/session-recovery/session-recovery.interface.js';

// ============================================================================
// Test Helpers
// ============================================================================

let testDir: string;
let testCounter = 0;

function uniqueTestDir(): string {
  testCounter++;
  return join(tmpdir(), `jsonl-adapter-test-${Date.now()}-${testCounter}`);
}

function makeSession(id: string, overrides?: Partial<Session>): Session {
  return {
    id,
    name: `Session ${id}`,
    status: SessionStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    metadata: { userId: 'test-user' },
    context: { variables: { key: 'value' } },
    checkpointIds: [],
    tags: ['test'],
    ...overrides,
  };
}

function makeCheckpoint(id: string, sessionId: string, overrides?: Partial<Checkpoint>): Checkpoint {
  return {
    id,
    sessionId,
    name: `Checkpoint ${id}`,
    type: CheckpointType.AUTO,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    snapshot: {
      sessionId,
      timestamp: new Date('2026-01-01T00:00:00Z'),
      status: SessionStatus.ACTIVE,
      context: {},
      metadata: {},
      version: '1.0.0',
    },
    checksum: 'abc123',
    sizeBytes: 256,
    tags: ['test'],
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('JSONLStorageAdapter', () => {
  let adapter: JSONLStorageAdapter;

  beforeEach(async () => {
    testDir = uniqueTestDir();
    adapter = new JSONLStorageAdapter({ basePath: testDir });
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.dispose();
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  describe('lifecycle', () => {
    it('should create base directory on initialize', async () => {
      const dir = uniqueTestDir();
      const a = new JSONLStorageAdapter({ basePath: dir });
      await a.initialize();

      const files = await readdir(dir);
      expect(files).toBeDefined();

      await a.dispose();
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    });

    it('should be idempotent on multiple initialize calls', async () => {
      await adapter.initialize();
      await adapter.initialize();
      // Should not throw
      const sessions = await adapter.listSessions();
      expect(sessions).toEqual([]);
    });

    it('should clear index on dispose', async () => {
      await adapter.saveSession(makeSession('s1'));
      expect((await adapter.listSessions()).length).toBe(1);

      await adapter.dispose();
      // After dispose, internal state is cleared
      // Re-initialize to verify file still exists on disk
      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();
      expect((await a2.listSessions()).length).toBe(1);
      await a2.dispose();
    });
  });

  // ==========================================================================
  // Sessions — CRUD
  // ==========================================================================

  describe('sessions', () => {
    it('should save and load a session', async () => {
      const session = makeSession('s1');
      await adapter.saveSession(session);

      const loaded = await adapter.loadSession('s1');
      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe('s1');
      expect(loaded!.name).toBe('Session s1');
      expect(loaded!.metadata.userId).toBe('test-user');
    });

    it('should return undefined for non-existent session', async () => {
      const loaded = await adapter.loadSession('nonexistent');
      expect(loaded).toBeUndefined();
    });

    it('should return a defensive copy on load', async () => {
      await adapter.saveSession(makeSession('s1'));
      const loaded1 = await adapter.loadSession('s1');
      const loaded2 = await adapter.loadSession('s1');
      expect(loaded1).not.toBe(loaded2);
      expect(loaded1).toEqual(loaded2);
    });

    it('should update session on re-save', async () => {
      await adapter.saveSession(makeSession('s1', { name: 'Original' }));
      await adapter.saveSession(makeSession('s1', { name: 'Updated' }));

      const loaded = await adapter.loadSession('s1');
      expect(loaded!.name).toBe('Updated');
    });

    it('should list multiple sessions', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveSession(makeSession('s2'));
      await adapter.saveSession(makeSession('s3'));

      const sessions = await adapter.listSessions();
      expect(sessions.length).toBe(3);
      const ids = sessions.map((s) => s.id).sort();
      expect(ids).toEqual(['s1', 's2', 's3']);
    });

    it('should delete a session', async () => {
      await adapter.saveSession(makeSession('s1'));
      const deleted = await adapter.deleteSession('s1');
      expect(deleted).toBe(true);

      const loaded = await adapter.loadSession('s1');
      expect(loaded).toBeUndefined();

      const sessions = await adapter.listSessions();
      expect(sessions.length).toBe(0);
    });

    it('should return false when deleting non-existent session', async () => {
      const deleted = await adapter.deleteSession('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should also remove checkpoints when deleting session', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp2', 's1'));

      await adapter.deleteSession('s1');

      const cp1 = await adapter.loadCheckpoint('cp1');
      const cp2 = await adapter.loadCheckpoint('cp2');
      expect(cp1).toBeUndefined();
      expect(cp2).toBeUndefined();
    });
  });

  // ==========================================================================
  // Checkpoints — CRUD
  // ==========================================================================

  describe('checkpoints', () => {
    beforeEach(async () => {
      await adapter.saveSession(makeSession('s1'));
    });

    it('should save and load a checkpoint', async () => {
      const cp = makeCheckpoint('cp1', 's1');
      await adapter.saveCheckpoint(cp);

      const loaded = await adapter.loadCheckpoint('cp1');
      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe('cp1');
      expect(loaded!.sessionId).toBe('s1');
    });

    it('should return undefined for non-existent checkpoint', async () => {
      const loaded = await adapter.loadCheckpoint('nonexistent');
      expect(loaded).toBeUndefined();
    });

    it('should return a defensive copy on load', async () => {
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      const loaded1 = await adapter.loadCheckpoint('cp1');
      const loaded2 = await adapter.loadCheckpoint('cp1');
      expect(loaded1).not.toBe(loaded2);
      expect(loaded1).toEqual(loaded2);
    });

    it('should list checkpoints for a session', async () => {
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp2', 's1'));

      // Different session
      await adapter.saveSession(makeSession('s2'));
      await adapter.saveCheckpoint(makeCheckpoint('cp3', 's2'));

      const cps = await adapter.listCheckpoints('s1');
      expect(cps.length).toBe(2);
      const ids = cps.map((c) => c.id).sort();
      expect(ids).toEqual(['cp1', 'cp2']);
    });

    it('should delete a checkpoint', async () => {
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      const deleted = await adapter.deleteCheckpoint('cp1');
      expect(deleted).toBe(true);

      const loaded = await adapter.loadCheckpoint('cp1');
      expect(loaded).toBeUndefined();
    });

    it('should return false when deleting non-existent checkpoint', async () => {
      const deleted = await adapter.deleteCheckpoint('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  // ==========================================================================
  // Stats
  // ==========================================================================

  describe('stats', () => {
    it('should return zero stats when empty', async () => {
      const stats = await adapter.getStats();
      expect(stats.sessionCount).toBe(0);
      expect(stats.checkpointCount).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
    });

    it('should count sessions and checkpoints', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveSession(makeSession('s2'));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));

      const stats = await adapter.getStats();
      expect(stats.sessionCount).toBe(2);
      expect(stats.checkpointCount).toBe(1);
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Clear
  // ==========================================================================

  describe('clear', () => {
    it('should remove all data', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));

      await adapter.clear();

      expect((await adapter.listSessions()).length).toBe(0);
      expect((await adapter.listCheckpoints('s1')).length).toBe(0);

      const stats = await adapter.getStats();
      expect(stats.sessionCount).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);
    });
  });

  // ==========================================================================
  // JSONL File Format & Replay
  // ==========================================================================

  describe('JSONL format and replay', () => {
    it('should persist data to JSONL file', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));

      const filePath = join(testDir, 's1.jsonl');
      const content = await readFile(filePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);

      const entry1 = JSON.parse(lines[0]);
      expect(entry1.type).toBe('session');
      expect(entry1.data.id).toBe('s1');

      const entry2 = JSON.parse(lines[1]);
      expect(entry2.type).toBe('checkpoint');
      expect(entry2.data.id).toBe('cp1');
    });

    it('should reconstruct state from disk on re-initialize', async () => {
      await adapter.saveSession(makeSession('s1', { name: 'Persisted' }));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      await adapter.dispose();

      // Create new adapter pointing to same directory
      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      const session = await a2.loadSession('s1');
      expect(session).toBeDefined();
      expect(session!.name).toBe('Persisted');

      const cp = await a2.loadCheckpoint('cp1');
      expect(cp).toBeDefined();
      expect(cp!.id).toBe('cp1');

      await a2.dispose();
    });

    it('should replay updates correctly (last write wins)', async () => {
      await adapter.saveSession(makeSession('s1', { name: 'V1' }));
      await adapter.saveSession(makeSession('s1', { name: 'V2' }));
      await adapter.saveSession(makeSession('s1', { name: 'V3' }));
      await adapter.dispose();

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      const session = await a2.loadSession('s1');
      expect(session!.name).toBe('V3');

      await a2.dispose();
    });

    it('should replay delete markers correctly', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      await adapter.deleteCheckpoint('cp1');
      await adapter.dispose();

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      const session = await a2.loadSession('s1');
      expect(session).toBeDefined();

      const cp = await a2.loadCheckpoint('cp1');
      expect(cp).toBeUndefined();

      await a2.dispose();
    });

    it('should replay session delete correctly', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      await adapter.deleteSession('s1');
      await adapter.dispose();

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      expect(await a2.loadSession('s1')).toBeUndefined();
      expect(await a2.loadCheckpoint('cp1')).toBeUndefined();
      expect((await a2.listSessions()).length).toBe(0);

      await a2.dispose();
    });
  });

  // ==========================================================================
  // Crash Safety
  // ==========================================================================

  describe('crash safety', () => {
    it('should skip malformed last line (partial write)', async () => {
      // Write valid entries then append a partial/corrupt line
      await adapter.saveSession(makeSession('s1'));
      await adapter.dispose();

      const filePath = join(testDir, 's1.jsonl');
      const content = await readFile(filePath, 'utf-8');
      // Append a truncated JSON line (simulating crash mid-write)
      await writeFile(filePath, content + '{"type":"session","timestamp":"2026-01-02T00:00:00Z","dat', 'utf-8');

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      // Original session should still be recoverable
      const session = await a2.loadSession('s1');
      expect(session).toBeDefined();
      expect(session!.id).toBe('s1');

      await a2.dispose();
    });

    it('should handle completely empty file', async () => {
      await mkdir(testDir, { recursive: true });
      await writeFile(join(testDir, 'empty.jsonl'), '', 'utf-8');

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      expect((await a2.listSessions()).length).toBe(0);
      await a2.dispose();
    });

    it('should handle file with only blank lines', async () => {
      await mkdir(testDir, { recursive: true });
      await writeFile(join(testDir, 'blank.jsonl'), '\n\n\n', 'utf-8');

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      expect((await a2.listSessions()).length).toBe(0);
      await a2.dispose();
    });

    it('should handle file with mixed valid and invalid lines', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.dispose();

      const filePath = join(testDir, 's1.jsonl');
      const content = await readFile(filePath, 'utf-8');
      // Insert a corrupt line between valid entries
      const validEntry = JSON.stringify({
        type: 'session',
        timestamp: new Date().toISOString(),
        data: makeSession('s1', { name: 'Updated' }),
      });
      await writeFile(filePath, content + 'CORRUPT_LINE\n' + validEntry + '\n', 'utf-8');

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      const session = await a2.loadSession('s1');
      expect(session).toBeDefined();
      expect(session!.name).toBe('Updated');

      await a2.dispose();
    });
  });

  // ==========================================================================
  // Compaction
  // ==========================================================================

  describe('compaction', () => {
    it('should compact a session file', async () => {
      // Generate multiple entries
      await adapter.saveSession(makeSession('s1', { name: 'V1' }));
      await adapter.saveSession(makeSession('s1', { name: 'V2' }));
      await adapter.saveSession(makeSession('s1', { name: 'V3' }));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp2', 's1'));
      await adapter.deleteCheckpoint('cp1');

      // 6 entries in file
      const result = await adapter.compact('s1');
      expect(result.entriesBefore).toBe(6);
      // After compaction: 1 session + 1 checkpoint = 2
      expect(result.entriesAfter).toBe(2);

      // Data integrity preserved
      const session = await adapter.loadSession('s1');
      expect(session!.name).toBe('V3');

      const cp1 = await adapter.loadCheckpoint('cp1');
      expect(cp1).toBeUndefined();

      const cp2 = await adapter.loadCheckpoint('cp2');
      expect(cp2).toBeDefined();
    });

    it('should handle compaction of deleted session', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.deleteSession('s1');

      const result = await adapter.compact('s1');
      expect(result.entriesBefore).toBe(0);
      expect(result.entriesAfter).toBe(0);
    });

    it('should produce valid file after compaction (re-initialize test)', async () => {
      await adapter.saveSession(makeSession('s1', { name: 'Final' }));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));
      await adapter.saveCheckpoint(makeCheckpoint('cp2', 's1'));
      await adapter.deleteCheckpoint('cp1');

      await adapter.compact('s1');
      await adapter.dispose();

      // Re-initialize from compacted file
      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      const session = await a2.loadSession('s1');
      expect(session!.name).toBe('Final');

      const cps = await a2.listCheckpoints('s1');
      expect(cps.length).toBe(1);
      expect(cps[0].id).toBe('cp2');

      await a2.dispose();
    });

    it('should compactAll across multiple session files', async () => {
      await adapter.saveSession(makeSession('s1'));
      await adapter.saveSession(makeSession('s1', { name: 'V2' }));
      await adapter.saveSession(makeSession('s2'));
      await adapter.saveSession(makeSession('s2', { name: 'V2' }));

      const result = await adapter.compactAll();
      expect(result.filesCompacted).toBe(2);
      expect(result.totalEntriesReduced).toBe(2); // each file reduced by 1
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle session with special characters in id', async () => {
      // Note: filesystem-safe IDs only
      const session = makeSession('session-with-dashes_and_underscores');
      await adapter.saveSession(session);

      const loaded = await adapter.loadSession('session-with-dashes_and_underscores');
      expect(loaded).toBeDefined();
      expect(loaded!.id).toBe('session-with-dashes_and_underscores');
    });

    it('should handle large session context', async () => {
      const largeContext = {
        variables: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`key_${i}`, `value_${i}_${'x'.repeat(100)}`])
        ),
      };
      const session = makeSession('s1', { context: largeContext });
      await adapter.saveSession(session);

      const loaded = await adapter.loadSession('s1');
      expect(loaded!.context.variables).toBeDefined();
      expect(Object.keys(loaded!.context.variables!).length).toBe(100);
    });

    it('should handle concurrent saves to different sessions', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        adapter.saveSession(makeSession(`s${i}`))
      );
      await Promise.all(promises);

      const sessions = await adapter.listSessions();
      expect(sessions.length).toBe(10);
    });

    it('should ignore non-jsonl files in base directory', async () => {
      await writeFile(join(testDir, 'readme.txt'), 'not a jsonl', 'utf-8');
      await writeFile(join(testDir, 'data.json'), '{}', 'utf-8');

      await adapter.saveSession(makeSession('s1'));
      await adapter.dispose();

      const a2 = new JSONLStorageAdapter({ basePath: testDir });
      await a2.initialize();

      const sessions = await a2.listSessions();
      expect(sessions.length).toBe(1);

      await a2.dispose();
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createJSONLStorageAdapter', () => {
    it('should create an adapter instance', () => {
      const a = createJSONLStorageAdapter({ basePath: testDir });
      expect(a).toBeInstanceOf(JSONLStorageAdapter);
    });
  });
});
