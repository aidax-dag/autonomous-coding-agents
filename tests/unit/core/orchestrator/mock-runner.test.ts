/**
 * Mock Runner Tests
 */

import { createMockRunner } from '../../../../src/core/orchestrator/mock-runner';
import { RunnerStatus } from '../../../../src/core/orchestrator/orchestrator-runner';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('MockRunner', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `mock-runner-test-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
  });

  afterEach(async () => {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('should create a runner instance', () => {
    const runner = createMockRunner({ workspaceDir });
    expect(runner).toBeDefined();
    expect(runner.currentStatus).toBe(RunnerStatus.IDLE);
  });

  it('should accept workspaceDir option', () => {
    const runner = createMockRunner({ workspaceDir });
    expect(runner).toBeDefined();
  });

  it('should accept projectContext option', () => {
    const runner = createMockRunner({
      workspaceDir,
      projectContext: 'Test project',
    });
    expect(runner).toBeDefined();
  });

  it('should be startable', async () => {
    const runner = createMockRunner({ workspaceDir });
    await runner.start();
    expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);
    await runner.destroy();
  });

  it('should be re-exported from orchestrator-runner', async () => {
    const { createMockRunner: reExported } = await import(
      '../../../../src/core/orchestrator/orchestrator-runner'
    );
    expect(reExported).toBeDefined();
    expect(typeof reExported).toBe('function');
  });
});
