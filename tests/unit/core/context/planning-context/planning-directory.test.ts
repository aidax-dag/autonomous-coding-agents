/**
 * Planning Directory Tests
 */

import { PlanningDirectory } from '@/core/context/planning-context/planning-directory';
import { access } from 'fs/promises';
import path from 'path';
import os from 'os';

describe('PlanningDirectory', () => {
  let dir: PlanningDirectory;
  let tmpDir: string;

  beforeEach(() => {
    dir = new PlanningDirectory();
    tmpDir = path.join(os.tmpdir(), `aca-test-${Date.now()}`);
  });

  afterEach(async () => {
    await dir.clean();
  });

  it('should initialize directory structure', async () => {
    await dir.initialize(tmpDir);
    expect(dir.exists()).toBe(true);
    expect(dir.getBasePath()).toContain('.planning');
    await expect(access(dir.getBasePath())).resolves.not.toThrow();
  });

  it('should create phases and research subdirectories', async () => {
    await dir.initialize(tmpDir);
    await expect(access(path.join(dir.getBasePath(), 'phases'))).resolves.not.toThrow();
    await expect(access(path.join(dir.getBasePath(), 'research'))).resolves.not.toThrow();
  });

  it('should not exist before initialization', () => {
    expect(dir.exists()).toBe(false);
  });

  it('should clean up directory', async () => {
    await dir.initialize(tmpDir);
    expect(dir.exists()).toBe(true);
    await dir.clean();
    expect(dir.exists()).toBe(false);
  });

  it('should handle clean on non-existent directory', async () => {
    await expect(dir.clean()).resolves.not.toThrow();
  });
});
