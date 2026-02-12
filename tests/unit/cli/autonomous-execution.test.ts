/**
 * Autonomous CLI Execution Tests
 *
 * Tests the actual execution paths of run/submit commands
 * with mocked runner to verify:
 * - withRunner lifecycle (start → fn → destroy)
 * - run command: goal → executeGoal → printGoalResult
 * - submit command: team/desc → submitToTeam → executeTask → printWorkflowResult
 * - Error handling and exitCode
 */

// Mock chalk
const passthrough = (s: string) => s;
const chalkMock: any = Object.assign(passthrough, {
  cyan: passthrough,
  green: passthrough,
  red: passthrough,
  yellow: passthrough,
  bold: passthrough,
  dim: passthrough,
});
jest.mock('chalk', () => ({ default: chalkMock, __esModule: true }));

// Mock runner-config
const mockRunner = {
  start: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  executeGoal: jest.fn(),
  submitToTeam: jest.fn(),
  executeTask: jest.fn(),
};

jest.mock('@/core/orchestrator/runner-config', () => ({
  createRunnerFromEnv: jest.fn(() => mockRunner),
  loadRunnerConfig: jest.fn(),
}));

import { createAutonomousCLI } from '@/cli/autonomous';
import { createRunnerFromEnv } from '@/core/orchestrator/runner-config';
import type { Command } from 'commander';

describe('Autonomous CLI Execution', () => {
  let cli: Command;
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    cli = createAutonomousCLI();
    cli.exitOverride();
    jest.clearAllMocks();
    mockRunner.start.mockResolvedValue(undefined);
    mockRunner.destroy.mockResolvedValue(undefined);
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.exitCode = undefined;
  });

  describe('run command execution', () => {
    it('should start runner, execute goal, and destroy', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-1',
        tasks: [],
        totalDuration: 500,
        completedTasks: 2,
        failedTasks: 0,
      });

      try {
        await cli.parseAsync(['run', 'Fix the login bug'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(createRunnerFromEnv).toHaveBeenCalled();
      expect(mockRunner.start).toHaveBeenCalled();
      expect(mockRunner.executeGoal).toHaveBeenCalledWith(
        'Fix the login bug',
        'Fix the login bug',
        expect.objectContaining({
          priority: 'medium',
          waitForCompletion: true,
        }),
      );
      expect(mockRunner.destroy).toHaveBeenCalled();
    });

    it('should set exitCode 0 on success', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-1',
        tasks: [],
        totalDuration: 100,
        completedTasks: 1,
        failedTasks: 0,
      });

      try {
        await cli.parseAsync(['run', 'Test goal'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(process.exitCode).toBe(0);
    });

    it('should set exitCode 1 on failure', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: false,
        goalId: 'g-2',
        tasks: [{ success: false, taskId: 't1', error: 'compile error', duration: 10, teamType: 'development' }],
        totalDuration: 200,
        completedTasks: 0,
        failedTasks: 1,
      });

      try {
        await cli.parseAsync(['run', 'Failing goal'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(process.exitCode).toBe(1);
    });

    it('should pass custom priority and tags', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-3',
        tasks: [],
        totalDuration: 50,
        completedTasks: 1,
        failedTasks: 0,
      });

      try {
        await cli.parseAsync(
          ['run', 'Custom goal', '-p', 'critical', '--tags', 'auth,security'],
          { from: 'user' },
        );
      } catch { /* commander exitOverride */ }

      expect(mockRunner.executeGoal).toHaveBeenCalledWith(
        'Custom goal',
        'Custom goal',
        expect.objectContaining({
          priority: 'critical',
          tags: ['auth', 'security'],
        }),
      );
    });

    it('should pass workspace override', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-4',
        tasks: [],
        totalDuration: 50,
        completedTasks: 1,
        failedTasks: 0,
      });

      try {
        await cli.parseAsync(
          ['run', 'Goal with workspace', '--workspace', '/tmp/custom'],
          { from: 'user' },
        );
      } catch { /* commander exitOverride */ }

      expect(createRunnerFromEnv).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceDir: '/tmp/custom' }),
      );
    });

    it('should enable validation and learning flags', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-5',
        tasks: [],
        totalDuration: 50,
        completedTasks: 1,
        failedTasks: 0,
      });

      try {
        await cli.parseAsync(
          ['run', 'Goal with flags', '--validation', '--learning'],
          { from: 'user' },
        );
      } catch { /* commander exitOverride */ }

      expect(createRunnerFromEnv).toHaveBeenCalledWith(
        expect.objectContaining({
          enableValidation: true,
          enableLearning: true,
        }),
      );
    });

    it('should handle runner crash gracefully', async () => {
      mockRunner.executeGoal.mockRejectedValue(new Error('LLM quota exceeded'));

      try {
        await cli.parseAsync(['run', 'Crash goal'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('LLM quota exceeded'),
      );
      expect(process.exitCode).toBe(1);
      expect(mockRunner.destroy).toHaveBeenCalled();
    });

    it('should print task details for goal with tasks', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-6',
        tasks: [
          { success: true, taskId: 't1', duration: 100, teamType: 'planning' },
          { success: true, taskId: 't2', duration: 200, teamType: 'development' },
        ],
        totalDuration: 300,
        completedTasks: 2,
        failedTasks: 0,
      });

      try {
        await cli.parseAsync(['run', 'Detailed goal'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(allOutput).toContain('planning');
      expect(allOutput).toContain('development');
    });

    it('should print verification info when present', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-7',
        tasks: [],
        totalDuration: 100,
        completedTasks: 1,
        failedTasks: 0,
        verification: { passed: true, checks: [] },
      });

      try {
        await cli.parseAsync(['run', 'Verified goal'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(allOutput).toContain('Verification');
      expect(allOutput).toContain('passed');
    });
  });

  describe('submit command execution', () => {
    it('should submit task to team and execute', async () => {
      const mockTask = { taskId: 'task-1', teamType: 'development', description: 'Fix bug' };
      mockRunner.submitToTeam.mockResolvedValue(mockTask);
      mockRunner.executeTask.mockResolvedValue({
        success: true,
        taskId: 'task-1',
        teamType: 'development',
        duration: 150,
      });

      try {
        await cli.parseAsync(['submit', 'development', 'Fix the auth bug'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(mockRunner.submitToTeam).toHaveBeenCalledWith(
        'development',
        'Fix the auth bug',
        'Fix the auth bug',
        expect.objectContaining({ priority: 'medium' }),
      );
      expect(mockRunner.executeTask).toHaveBeenCalledWith(mockTask);
      expect(process.exitCode).toBe(0);
    });

    it('should set exitCode 1 when task fails', async () => {
      const mockTask = { taskId: 'task-2', teamType: 'qa', description: 'Run tests' };
      mockRunner.submitToTeam.mockResolvedValue(mockTask);
      mockRunner.executeTask.mockResolvedValue({
        success: false,
        taskId: 'task-2',
        teamType: 'qa',
        duration: 100,
        error: 'Tests failed',
      });

      try {
        await cli.parseAsync(['submit', 'qa', 'Run failing tests'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(process.exitCode).toBe(1);
      const allOutput = consoleSpy.mock.calls.map((c: any[]) => c.join(' ')).join('\n');
      expect(allOutput).toContain('Tests failed');
    });

    it('should handle submit error gracefully', async () => {
      mockRunner.submitToTeam.mockRejectedValue(new Error('Team not found'));

      try {
        await cli.parseAsync(['submit', 'unknown', 'Some task'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Team not found'),
      );
      expect(process.exitCode).toBe(1);
    });
  });

  describe('runner lifecycle', () => {
    it('should destroy runner even if executeGoal throws', async () => {
      mockRunner.executeGoal.mockRejectedValue(new Error('Boom'));

      try {
        await cli.parseAsync(['run', 'Exploding goal'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      expect(mockRunner.start).toHaveBeenCalled();
      expect(mockRunner.destroy).toHaveBeenCalled();
    });

    it('should handle destroy failure silently', async () => {
      mockRunner.executeGoal.mockResolvedValue({
        success: true,
        goalId: 'g-8',
        tasks: [],
        totalDuration: 50,
        completedTasks: 1,
        failedTasks: 0,
      });
      mockRunner.destroy.mockRejectedValue(new Error('Cleanup failed'));

      try {
        await cli.parseAsync(['run', 'Goal with cleanup fail'], { from: 'user' });
      } catch { /* commander exitOverride */ }

      // Should not throw — destroy errors are swallowed
      expect(process.exitCode).toBe(0);
    });
  });
});
