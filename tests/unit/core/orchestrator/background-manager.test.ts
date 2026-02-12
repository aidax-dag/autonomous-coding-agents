/**
 * Background Manager Tests
 */

import { BackgroundManager } from '@/core/orchestrator/background-manager';
import type { WorkflowResult } from '@/core/orchestrator/orchestrator-runner';

function mockResult(id: string): WorkflowResult {
  return { success: true, taskId: id, duration: 10, teamType: 'development' };
}

describe('BackgroundManager', () => {
  let manager: BackgroundManager;

  beforeEach(() => {
    manager = new BackgroundManager();
  });

  it('should launch background tasks', () => {
    const handle = manager.launch(async () => mockResult('t1'));
    expect(handle.id).toBeDefined();
    expect(handle.status).toBe('running');
    expect(manager.count()).toBe(1);
  });

  it('should track task completion', async () => {
    const handle = manager.launch(async () => mockResult('t1'));
    await handle.promise;
    expect(handle.status).toBe('completed');
  });

  it('should track task failure', async () => {
    const handle = manager.launch(async () => {
      throw new Error('test error');
    });
    try {
      await handle.promise;
    } catch {
      // expected
    }
    expect(handle.status).toBe('failed');
  });

  it('should cancel running tasks', () => {
    const handle = manager.launch(
      () => new Promise<WorkflowResult>((resolve) => setTimeout(() => resolve(mockResult('t1')), 5000)),
    );
    const cancelled = manager.cancel(handle.id);
    expect(cancelled).toBe(true);
    expect(handle.status).toBe('cancelled');
  });

  it('should await all tasks', async () => {
    manager.launch(async () => mockResult('t1'));
    manager.launch(async () => mockResult('t2'));
    const results = await manager.awaitAll();
    expect(results.size).toBe(2);
  });

  it('should get running tasks', () => {
    manager.launch(
      () => new Promise<WorkflowResult>((resolve) => setTimeout(() => resolve(mockResult('t1')), 5000)),
    );
    expect(manager.getRunning()).toHaveLength(1);
  });

  it('should clear all tasks', () => {
    manager.launch(
      () => new Promise<WorkflowResult>((resolve) => setTimeout(() => resolve(mockResult('t1')), 5000)),
    );
    manager.clear();
    expect(manager.count()).toBe(0);
  });

  it('should use custom task id', () => {
    const handle = manager.launch(async () => mockResult('t1'), 'custom-id');
    expect(handle.id).toBe('custom-id');
    expect(manager.get('custom-id')).toBe(handle);
  });
});
