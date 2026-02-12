/**
 * Research Snapshot
 *
 * Persists per-phase research results as JSON files.
 *
 * @module core/context/planning-context/research-snapshot
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import path from 'path';
import type { IResearchSnapshot, ResearchSnapshot } from './interfaces/planning.interface';

/**
 * Research Snapshot Manager
 *
 * Saves and retrieves research data keyed by phase ID.
 */
export class ResearchSnapshotManager implements IResearchSnapshot {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async save(snapshot: Omit<ResearchSnapshot, 'timestamp'>): Promise<void> {
    await mkdir(this.basePath, { recursive: true });
    const fullSnapshot: ResearchSnapshot = {
      ...snapshot,
      timestamp: Date.now(),
    };
    const filename = `${snapshot.phaseId}-${fullSnapshot.timestamp}.json`;
    await writeFile(
      path.join(this.basePath, filename),
      JSON.stringify(fullSnapshot, null, 2),
      'utf-8',
    );
  }

  async getByPhase(phaseId: string): Promise<ResearchSnapshot[]> {
    const all = await this.getAll();
    return all.filter((s) => s.phaseId === phaseId);
  }

  async getAll(): Promise<ResearchSnapshot[]> {
    try {
      const files = await readdir(this.basePath);
      const snapshots: ResearchSnapshot[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await readFile(path.join(this.basePath, file), 'utf-8');
          snapshots.push(JSON.parse(content));
        } catch {
          // Skip invalid files
        }
      }

      return snapshots.sort((a, b) => a.timestamp - b.timestamp);
    } catch {
      return [];
    }
  }

  async clean(phaseId?: string): Promise<void> {
    try {
      const files = await readdir(this.basePath);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        if (phaseId && !file.startsWith(phaseId)) continue;
        await unlink(path.join(this.basePath, file));
      }
    } catch {
      // Directory doesn't exist, nothing to clean
    }
  }
}

/**
 * Create a research snapshot manager
 */
export function createResearchSnapshot(basePath: string): ResearchSnapshotManager {
  return new ResearchSnapshotManager(basePath);
}
