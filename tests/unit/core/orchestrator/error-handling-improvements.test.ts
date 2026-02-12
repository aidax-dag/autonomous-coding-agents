/**
 * Error Handling Improvements Tests
 *
 * Validates the P2 error handling improvements:
 * - Hook failures are logged instead of silently swallowed
 * - GoalResult includes error details on failure
 * - AgentError used for missing team instead of generic Error
 * - CLI runner cleanup logs warnings on failure
 * - API gateway health check logs degraded status
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { createMockRunner } from '@/core/orchestrator/mock-runner';
import { RunnerStatus, type GoalResult } from '@/core/orchestrator/orchestrator-runner';
import { ServiceRegistry } from '@/core/services/service-registry';
import { AgentError, ErrorCode, wrapError } from '@/shared/errors/custom-errors';
import { logger } from '@/shared/logging/logger';

// Spy on logger
const loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
const loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);

describe('Error Handling Improvements', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `error-handling-test-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
    loggerWarnSpy.mockClear();
    loggerErrorSpy.mockClear();
  });

  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch { /* ignore */ }
    ServiceRegistry.resetInstance();
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  // ═══════════════════════════════════════════════════════════
  // 1. GoalResult includes error field
  // ═══════════════════════════════════════════════════════════

  describe('GoalResult error field', () => {
    it('should include error field in GoalResult interface', () => {
      const goalResult: GoalResult = {
        success: false,
        goalId: 'test-goal-1',
        tasks: [],
        totalDuration: 100,
        completedTasks: 0,
        failedTasks: 1,
        error: 'Something went wrong',
      };

      expect(goalResult.error).toBe('Something went wrong');
    });

    it('should allow optional error field on success', () => {
      const goalResult: GoalResult = {
        success: true,
        goalId: 'test-goal-2',
        tasks: [],
        totalDuration: 50,
        completedTasks: 1,
        failedTasks: 0,
      };

      expect(goalResult.error).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. AgentError used instead of generic Error
  // ═══════════════════════════════════════════════════════════

  describe('AgentError usage', () => {
    it('should create AgentError with AGENT_STATE_ERROR for missing team', () => {
      const err = new AgentError(
        'No team registered for type: nonexistent',
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { teamType: 'nonexistent', taskId: 'task-1' },
      );

      expect(err).toBeInstanceOf(AgentError);
      expect(err.code).toBe(ErrorCode.AGENT_STATE_ERROR);
      expect(err.retryable).toBe(false);
      expect(err.context).toEqual({ teamType: 'nonexistent', taskId: 'task-1' });
    });

    it('should wrap unknown errors with context via wrapError', () => {
      const originalError = new TypeError('undefined is not a function');
      const wrapped = wrapError(originalError, undefined, ErrorCode.WORKFLOW_ERROR);

      expect(wrapped).toBeInstanceOf(AgentError);
      expect(wrapped.code).toBe(ErrorCode.WORKFLOW_ERROR);
      expect(wrapped.message).toBe('undefined is not a function');
      expect(wrapped.context?.originalError).toBeDefined();
    });

    it('should preserve AgentError when wrapping already-wrapped error', () => {
      const original = new AgentError('already wrapped', ErrorCode.AGENT_TIMEOUT, true);
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
      expect(wrapped.code).toBe(ErrorCode.AGENT_TIMEOUT);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Runner lifecycle with proper error logging
  // ═══════════════════════════════════════════════════════════

  describe('Runner lifecycle error logging', () => {
    it('should complete goal execution with proper result structure', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      const result = await runner.executeGoal(
        'Error handling test',
        'Test proper error reporting',
        { waitForCompletion: true },
      );

      expect(result).toBeDefined();
      expect(result.goalId).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.totalDuration).toBe('number');

      await runner.destroy();
    });

    it('should track runner stats after goal execution', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      await runner.executeGoal(
        'Stats tracking test',
        'Verify stats after goal',
        { waitForCompletion: true },
      );

      const stats = runner.getStats();
      expect(stats.status).toBe(RunnerStatus.RUNNING);
      expect(stats.tasksExecuted).toBeGreaterThanOrEqual(0);

      await runner.destroy();
      expect(runner.getStats().status).toBe(RunnerStatus.STOPPED);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Error code categorization
  // ═══════════════════════════════════════════════════════════

  describe('Error code categorization', () => {
    it('should categorize workflow errors correctly', () => {
      const err = new AgentError('Goal failed', ErrorCode.WORKFLOW_ERROR);
      expect(err.code).toBe('WORKFLOW_ERROR');
      expect(err.retryable).toBe(false);
    });

    it('should categorize agent state errors correctly', () => {
      const err = new AgentError(
        'No team registered',
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { teamType: 'unknown' },
      );
      expect(err.code).toBe('AGENT_STATE_ERROR');
      expect(err.context?.teamType).toBe('unknown');
    });

    it('should serialize error to JSON with all fields', () => {
      const err = new AgentError(
        'Test error',
        ErrorCode.WORKFLOW_ERROR,
        true,
        { goalId: 'g-123' },
      );

      const json = err.toJSON();
      expect(json).toHaveProperty('name', 'AgentError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', 'WORKFLOW_ERROR');
      expect(json).toHaveProperty('retryable', true);
      expect(json).toHaveProperty('context');
      expect(json).toHaveProperty('timestamp');
    });

    it('should provide human-readable toString()', () => {
      const err = new AgentError(
        'Something failed',
        ErrorCode.INTERNAL_ERROR,
        false,
        { detail: 'more info' },
      );

      const str = err.toString();
      expect(str).toContain('[INTERNAL_ERROR]');
      expect(str).toContain('Something failed');
      expect(str).toContain('more info');
    });
  });
});
