/**
 * RunnerStateManager Unit Tests
 */

import { RunnerStateManager } from '../../../../src/core/orchestrator/runner-state-manager';
import { RunnerStatus, type WorkflowResult } from '../../../../src/core/orchestrator/orchestrator-runner';

function createResult(taskId: string, success: boolean): WorkflowResult {
  return { success, taskId, duration: 100, teamType: 'development' as any };
}

describe('RunnerStateManager', () => {
  let manager: RunnerStateManager;

  beforeEach(() => {
    manager = new RunnerStateManager();
  });

  // ==========================================================================
  // Status
  // ==========================================================================
  describe('status', () => {
    it('should start as IDLE', () => {
      expect(manager.getStatus()).toBe(RunnerStatus.IDLE);
    });

    it('should update status', () => {
      manager.setStatus(RunnerStatus.RUNNING);
      expect(manager.getStatus()).toBe(RunnerStatus.RUNNING);
    });

    it('should report isRunning correctly', () => {
      expect(manager.isRunning()).toBe(false);
      manager.setStatus(RunnerStatus.RUNNING);
      expect(manager.isRunning()).toBe(true);
      manager.setStatus(RunnerStatus.PAUSED);
      expect(manager.isRunning()).toBe(false);
    });
  });

  // ==========================================================================
  // Timing
  // ==========================================================================
  describe('timing', () => {
    it('should return 0 uptime when not started', () => {
      expect(manager.getUptime()).toBe(0);
    });

    it('should track uptime after markStarted', () => {
      manager.markStarted();
      expect(manager.getUptime()).toBeGreaterThanOrEqual(0);
      expect(manager.getStatus()).toBe(RunnerStatus.RUNNING);
    });
  });

  // ==========================================================================
  // Task Results
  // ==========================================================================
  describe('task results', () => {
    it('should record and retrieve results', () => {
      const result = createResult('t-1', true);
      manager.recordResult('t-1', result);
      expect(manager.getResult('t-1')).toEqual(result);
    });

    it('should return undefined for unknown task', () => {
      expect(manager.getResult('unknown')).toBeUndefined();
    });

    it('should return all results as a copy', () => {
      manager.recordResult('t-1', createResult('t-1', true));
      manager.recordResult('t-2', createResult('t-2', false));
      const all = manager.getAllResults();
      expect(all.size).toBe(2);
      // Mutating copy should not affect internal state
      all.delete('t-1');
      expect(manager.getResult('t-1')).toBeDefined();
    });

    it('should clear results', () => {
      manager.recordResult('t-1', createResult('t-1', true));
      manager.clearResults();
      expect(manager.getResult('t-1')).toBeUndefined();
      expect(manager.getAllResults().size).toBe(0);
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================
  describe('getStats', () => {
    it('should aggregate stats correctly', () => {
      manager.markStarted();
      manager.recordResult('t-1', createResult('t-1', true));
      manager.recordResult('t-2', createResult('t-2', false));
      manager.recordResult('t-3', createResult('t-3', true));

      const mockOrchestrator = {
        getStats: jest.fn().mockReturnValue({ teams: 3, activeTasks: 0 }),
      } as any;

      const stats = manager.getStats(mockOrchestrator);
      expect(stats.status).toBe(RunnerStatus.RUNNING);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.tasksExecuted).toBe(3);
      expect(stats.tasksSucceeded).toBe(2);
      expect(stats.tasksFailed).toBe(1);
      expect(stats.orchestratorStats).toEqual({ teams: 3, activeTasks: 0 });
    });
  });
});
