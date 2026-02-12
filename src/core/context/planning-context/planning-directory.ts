/**
 * Planning Directory
 *
 * Manages .planning/ directory structure for plan state persistence.
 *
 * @module core/context/planning-context/planning-directory
 */

import { mkdir, access, rm } from 'fs/promises';
import path from 'path';
import type { IPlanningDirectory } from './interfaces/planning.interface';

/**
 * Planning Directory
 *
 * Creates and manages the .planning/ filesystem structure.
 */
export class PlanningDirectory implements IPlanningDirectory {
  private basePath = '';
  private initialized = false;

  async initialize(basePath: string): Promise<void> {
    this.basePath = path.resolve(basePath, '.planning');
    await mkdir(this.basePath, { recursive: true });
    await mkdir(path.join(this.basePath, 'phases'), { recursive: true });
    await mkdir(path.join(this.basePath, 'research'), { recursive: true });
    this.initialized = true;
  }

  exists(): boolean {
    return this.initialized;
  }

  getBasePath(): string {
    return this.basePath;
  }

  getStatePath(): string {
    return path.join(this.basePath, 'STATE.md');
  }

  getPhasesPath(): string {
    return path.join(this.basePath, 'phases');
  }

  getResearchPath(): string {
    return path.join(this.basePath, 'research');
  }

  async clean(): Promise<void> {
    if (!this.basePath) return;
    try {
      await access(this.basePath);
      await rm(this.basePath, { recursive: true, force: true });
      this.initialized = false;
    } catch {
      // Directory doesn't exist, nothing to clean
    }
  }
}

/**
 * Create a planning directory
 */
export function createPlanningDirectory(): PlanningDirectory {
  return new PlanningDirectory();
}
