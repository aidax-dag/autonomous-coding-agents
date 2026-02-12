/**
 * Research Snapshot Tests
 */

import { ResearchSnapshotManager } from '@/core/context/planning-context/research-snapshot';
import path from 'path';
import os from 'os';
import { mkdir, rm } from 'fs/promises';

describe('ResearchSnapshotManager', () => {
  let manager: ResearchSnapshotManager;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `aca-research-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    manager = new ResearchSnapshotManager(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should save and retrieve snapshots', async () => {
    await manager.save({
      phaseId: 'phase-1',
      data: { findings: ['finding-1'] },
      summary: 'Test research',
    });
    const all = await manager.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].phaseId).toBe('phase-1');
    expect(all[0].data).toEqual({ findings: ['finding-1'] });
  });

  it('should filter by phase', async () => {
    await manager.save({ phaseId: 'phase-1', data: { a: 1 } });
    await manager.save({ phaseId: 'phase-2', data: { b: 2 } });

    const p1 = await manager.getByPhase('phase-1');
    expect(p1).toHaveLength(1);
    expect(p1[0].data).toEqual({ a: 1 });
  });

  it('should clean all snapshots', async () => {
    await manager.save({ phaseId: 'phase-1', data: {} });
    await manager.save({ phaseId: 'phase-2', data: {} });
    await manager.clean();
    expect(await manager.getAll()).toHaveLength(0);
  });

  it('should clean by phase', async () => {
    await manager.save({ phaseId: 'phase-1', data: {} });
    await manager.save({ phaseId: 'phase-2', data: {} });
    await manager.clean('phase-1');
    const remaining = await manager.getAll();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].phaseId).toBe('phase-2');
  });

  it('should handle empty directory', async () => {
    const all = await manager.getAll();
    expect(all).toEqual([]);
  });
});
