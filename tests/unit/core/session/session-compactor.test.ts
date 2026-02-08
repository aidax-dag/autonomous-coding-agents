/**
 * Unit tests for SessionCompactor
 */

import { rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  SessionCompactor,
  createSessionCompactor,
} from '../../../../src/core/session/session-compactor.js';
import { JSONLStorageAdapter } from '../../../../src/core/session/jsonl-storage-adapter.js';
import {
  SessionStatus,
  CheckpointType,
} from '../../../../src/core/hooks/session-recovery/session-recovery.interface.js';
import type {
  Session,
  Checkpoint,
} from '../../../../src/core/hooks/session-recovery/session-recovery.interface.js';

// ============================================================================
// Helpers
// ============================================================================

let testCounter = 0;

function uniqueTestDir(): string {
  testCounter++;
  return join(tmpdir(), `compactor-test-${Date.now()}-${testCounter}`);
}

function makeSession(id: string, overrides?: Partial<Session>): Session {
  return {
    id,
    name: `Session ${id}`,
    status: SessionStatus.ACTIVE,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    metadata: {},
    context: {},
    checkpointIds: [],
    tags: [],
    ...overrides,
  };
}

function makeCheckpoint(id: string, sessionId: string): Checkpoint {
  return {
    id,
    sessionId,
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
    checksum: 'abc',
    sizeBytes: 128,
    tags: [],
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('SessionCompactor', () => {
  let testDir: string;
  let adapter: JSONLStorageAdapter;
  let compactor: SessionCompactor;

  beforeEach(async () => {
    testDir = uniqueTestDir();
    adapter = new JSONLStorageAdapter({ basePath: testDir });
    await adapter.initialize();
  });

  afterEach(async () => {
    if (compactor?.isRunning()) compactor.stop();
    await adapter.dispose();
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('runCompaction', () => {
    it('should compact files and return a report', async () => {
      // Create redundant entries
      await adapter.saveSession(makeSession('s1', { name: 'V1' }));
      await adapter.saveSession(makeSession('s1', { name: 'V2' }));
      await adapter.saveSession(makeSession('s1', { name: 'V3' }));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));

      compactor = new SessionCompactor(adapter);
      const report = await compactor.runCompaction();

      expect(report.filesCompacted).toBe(1);
      expect(report.totalEntriesReduced).toBe(2); // 4 entries → 2 (1 session + 1 cp)
      expect(report.durationMs).toBeGreaterThanOrEqual(0);
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    it('should return zero reduction when nothing to compact', async () => {
      await adapter.saveSession(makeSession('s1'));

      compactor = new SessionCompactor(adapter);
      const report = await compactor.runCompaction();

      expect(report.filesCompacted).toBe(1);
      expect(report.totalEntriesReduced).toBe(0);
    });

    it('should preserve data integrity after compaction', async () => {
      await adapter.saveSession(makeSession('s1', { name: 'Keep' }));
      await adapter.saveCheckpoint(makeCheckpoint('cp1', 's1'));

      compactor = new SessionCompactor(adapter);
      await compactor.runCompaction();

      const session = await adapter.loadSession('s1');
      expect(session!.name).toBe('Keep');

      const cp = await adapter.loadCheckpoint('cp1');
      expect(cp).toBeDefined();
    });
  });

  describe('getLastReport', () => {
    it('should return null before any compaction', () => {
      compactor = new SessionCompactor(adapter);
      expect(compactor.getLastReport()).toBeNull();
    });

    it('should return the last report after compaction', async () => {
      await adapter.saveSession(makeSession('s1'));

      compactor = new SessionCompactor(adapter);
      await compactor.runCompaction();

      const report = compactor.getLastReport();
      expect(report).not.toBeNull();
      expect(report!.filesCompacted).toBe(1);
    });
  });

  describe('start / stop / isRunning', () => {
    it('should start and stop the compaction timer', async () => {
      compactor = new SessionCompactor(adapter, { interval: 60000 });

      expect(compactor.isRunning()).toBe(false);
      await compactor.start();
      expect(compactor.isRunning()).toBe(true);
      compactor.stop();
      expect(compactor.isRunning()).toBe(false);
    });

    it('should be idempotent on multiple start calls', async () => {
      compactor = new SessionCompactor(adapter, { interval: 60000 });
      await compactor.start();
      await compactor.start();
      expect(compactor.isRunning()).toBe(true);
      compactor.stop();
    });

    it('should run compaction on start when compactOnStart is true', async () => {
      await adapter.saveSession(makeSession('s1', { name: 'V1' }));
      await adapter.saveSession(makeSession('s1', { name: 'V2' }));

      compactor = new SessionCompactor(adapter, {
        interval: 60000,
        compactOnStart: true,
      });

      await compactor.start();

      const report = compactor.getLastReport();
      expect(report).not.toBeNull();
      expect(report!.totalEntriesReduced).toBe(1);

      compactor.stop();
    });

    it('should not run compaction on start when compactOnStart is false', async () => {
      compactor = new SessionCompactor(adapter, {
        interval: 60000,
        compactOnStart: false,
      });

      await compactor.start();
      expect(compactor.getLastReport()).toBeNull();
      compactor.stop();
    });
  });

  describe('createSessionCompactor', () => {
    it('should create a compactor instance', () => {
      const c = createSessionCompactor(adapter);
      expect(c).toBeInstanceOf(SessionCompactor);
    });

    it('should accept partial config', () => {
      const c = createSessionCompactor(adapter, { interval: 5000 });
      expect(c).toBeInstanceOf(SessionCompactor);
    });
  });
});
