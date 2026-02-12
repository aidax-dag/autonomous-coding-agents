/**
 * State Tracker Tests
 */

import { StateTracker } from '@/core/context/planning-context/state-tracker';
import path from 'path';
import os from 'os';
import { mkdir, rm } from 'fs/promises';

describe('StateTracker', () => {
  let tracker: StateTracker;
  let tmpDir: string;
  let statePath: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `aca-state-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    statePath = path.join(tmpDir, 'STATE.md');
    tracker = new StateTracker(statePath);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should load default state when file does not exist', async () => {
    const state = await tracker.load();
    expect(state.status).toBe('planning');
    expect(state.decisions).toEqual([]);
    expect(state.blockers).toEqual([]);
  });

  it('should save and reload state', async () => {
    const state = await tracker.load();
    state.goal = 'Test goal';
    state.status = 'executing';
    await tracker.save(state);

    const reloaded = await tracker.load();
    expect(reloaded.goal).toBe('Test goal');
    expect(reloaded.status).toBe('executing');
  });

  it('should add decisions', async () => {
    await tracker.load();
    const decision = await tracker.addDecision({
      description: 'Use TypeScript',
      rationale: 'Type safety',
    });
    expect(decision.id).toMatch(/^dec-/);
    expect(decision.timestamp).toBeGreaterThan(0);

    const state = await tracker.load();
    expect(state.decisions).toHaveLength(1);
  });

  it('should add and resolve blockers', async () => {
    await tracker.load();
    const blocker = await tracker.addBlocker({
      description: 'Missing API key',
      severity: 'high',
    });
    expect(blocker.resolved).toBe(false);

    await tracker.resolveBlocker(blocker.id);
    const state = await tracker.load();
    expect(state.blockers[0].resolved).toBe(true);
  });

  it('should persist across tracker instances', async () => {
    await tracker.load();
    await tracker.addDecision({
      description: 'Decision 1',
      rationale: 'Reason 1',
    });

    const tracker2 = new StateTracker(statePath);
    const state = await tracker2.load();
    expect(state.decisions).toHaveLength(1);
  });

  it('should handle phaseId in decisions and blockers', async () => {
    await tracker.load();
    const decision = await tracker.addDecision({
      description: 'Phase decision',
      rationale: 'Phase reason',
      phaseId: 'phase-1',
    });
    expect(decision.phaseId).toBe('phase-1');
  });
});
