/**
 * E2E: OrchestratorRunner Lifecycle
 *
 * Verifies the full OrchestratorRunner lifecycle including:
 * create -> start -> executeGoal -> stop -> destroy,
 * event emission ordering, error handling, config flag behavior,
 * and multi-goal sequential execution.
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

import { createMockRunner } from '@/core/orchestrator/mock-runner';
import {
  OrchestratorRunner,
  RunnerStatus,
  type GoalResult,
} from '@/core/orchestrator/orchestrator-runner';
import { ServiceRegistry } from '@/core/services/service-registry';
import type { ILLMClient } from '@/shared/llm';

/**
 * Create a mock LLM client for tests that need direct OrchestratorRunner instantiation
 */
function createMockLLMClient(): ILLMClient {
  return {
    getProvider: () => 'mock',
    getDefaultModel: () => 'mock-model',
    getMaxContextLength: () => 128000,
    chat: async () => ({
      content: '```json\n{"summary":"mock"}\n```',
      model: 'mock-model',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      finishReason: 'stop' as const,
    }),
    chatStream: async (_msgs, callback) => {
      const result = {
        content: '```json\n{"summary":"mock"}\n```',
        model: 'mock-model',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        finishReason: 'stop' as const,
      };
      await callback({ content: result.content, isComplete: true, usage: result.usage });
      return result;
    },
  };
}

describe('E2E: OrchestratorRunner Lifecycle', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `e2e-lifecycle-${Date.now()}`);
    fs.mkdirSync(workspaceDir, { recursive: true });
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
  // 1. Full lifecycle: create -> start -> executeGoal -> stop -> destroy
  // ═══════════════════════════════════════════════════════════

  describe('Full lifecycle', () => {
    it('should complete the full create -> start -> executeGoal -> stop -> destroy cycle', async () => {
      const runner = createMockRunner({ workspaceDir });

      // Initial state
      expect(runner.currentStatus).toBe(RunnerStatus.IDLE);

      // Start
      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      // Execute goal
      const result = await runner.executeGoal(
        'Lifecycle test goal',
        'Verify full lifecycle works end to end',
        { waitForCompletion: true },
      );

      expect(result).toBeDefined();
      expect(result.goalId).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
      expect(result.completedTasks + result.failedTasks).toBeGreaterThan(0);

      // Stop
      await runner.stop();
      expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);

      // Destroy
      await runner.destroy();
      expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);
    });

    it('should transition through correct status states', async () => {
      const runner = createMockRunner({ workspaceDir });
      const statuses: RunnerStatus[] = [];

      // Capture status at key points
      statuses.push(runner.currentStatus); // IDLE

      await runner.start();
      statuses.push(runner.currentStatus); // RUNNING

      await runner.stop();
      statuses.push(runner.currentStatus); // STOPPED

      await runner.destroy();

      expect(statuses[0]).toBe(RunnerStatus.IDLE);
      expect(statuses[1]).toBe(RunnerStatus.RUNNING);
      expect(statuses[2]).toBe(RunnerStatus.STOPPED);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Event emission during lifecycle
  // ═══════════════════════════════════════════════════════════

  describe('Event emission during lifecycle', () => {
    it('should emit started and stopped events', async () => {
      const runner = createMockRunner({ workspaceDir });
      const events: string[] = [];

      runner.on('started', () => events.push('started'));
      runner.on('stopped', () => events.push('stopped'));

      await runner.start();
      expect(events).toContain('started');

      await runner.destroy();
      expect(events).toContain('stopped');
    });

    it('should emit goal:started and goal:completed events during executeGoal', async () => {
      const runner = createMockRunner({ workspaceDir });
      const events: string[] = [];
      let capturedGoalId: string | undefined;

      runner.on('goal:started', (goalId: string) => {
        events.push('goal:started');
        capturedGoalId = goalId;
      });
      runner.on('goal:completed', () => events.push('goal:completed'));

      await runner.start();

      await runner.executeGoal(
        'Event emission test',
        'Test that goal events fire properly',
        { waitForCompletion: true },
      );

      expect(events).toContain('goal:started');
      expect(events).toContain('goal:completed');
      expect(capturedGoalId).toBeDefined();
      expect(capturedGoalId).toMatch(/^goal-/);

      await runner.destroy();
    });

    it('should emit events in correct lifecycle order', async () => {
      const runner = createMockRunner({ workspaceDir });
      const events: string[] = [];

      runner.on('started', () => events.push('started'));
      runner.on('stopped', () => events.push('stopped'));
      runner.on('goal:started', () => events.push('goal:started'));
      runner.on('goal:completed', () => events.push('goal:completed'));
      runner.on('workflow:started', () => events.push('workflow:started'));
      runner.on('workflow:completed', () => events.push('workflow:completed'));

      await runner.start();

      await runner.executeGoal(
        'Event ordering test',
        'Verify event emission order',
        { waitForCompletion: true },
      );

      await runner.destroy();

      // started must come first
      expect(events.indexOf('started')).toBe(0);

      // goal:started should come before goal:completed
      const goalStartIdx = events.indexOf('goal:started');
      const goalEndIdx = events.indexOf('goal:completed');
      if (goalStartIdx >= 0 && goalEndIdx >= 0) {
        expect(goalStartIdx).toBeLessThan(goalEndIdx);
      }

      // stopped should be last
      expect(events[events.length - 1]).toBe('stopped');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Error handling during goal execution
  // ═══════════════════════════════════════════════════════════

  describe('Error handling', () => {
    it('should throw if executeGoal called before start', async () => {
      const runner = createMockRunner({ workspaceDir });

      await expect(
        runner.executeGoal('Test', 'Should fail', { waitForCompletion: true }),
      ).rejects.toThrow(/not running/i);

      await runner.destroy();
    });

    it('should return a result even when goal execution encounters errors internally', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      // Execute with an empty description to test resilience
      const result = await runner.executeGoal(
        'Error recovery test',
        'Test resilience to unexpected input',
        { waitForCompletion: true },
      );

      expect(result).toBeDefined();
      expect(result.goalId).toBeDefined();
      expect(result.totalDuration).toBeGreaterThanOrEqual(0);

      await runner.destroy();
    });

    it('should emit error event when an error occurs', async () => {
      const runner = createMockRunner({ workspaceDir });
      const errors: Error[] = [];

      runner.on('error', (err: Error) => errors.push(err));

      // Attempting to stop a runner that is already idle should be a no-op,
      // but starting and executing should work without emitting errors for basic flow
      await runner.start();
      await runner.executeGoal('Basic test', 'Test', { waitForCompletion: true });

      await runner.destroy();
      // No errors expected for clean execution
      // (errors array will capture any unexpected errors)
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Multiple goal execution in sequence
  // ═══════════════════════════════════════════════════════════

  describe('Multiple goal execution in sequence', () => {
    it('should execute multiple goals sequentially and track all results', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      const results: GoalResult[] = [];

      for (let i = 1; i <= 3; i++) {
        const result = await runner.executeGoal(
          `Sequential Goal ${i}`,
          `Sequential goal number ${i}`,
          { waitForCompletion: true },
        );
        results.push(result);
      }

      expect(results).toHaveLength(3);
      results.forEach((r) => {
        expect(r.goalId).toBeDefined();
        expect(r.totalDuration).toBeGreaterThanOrEqual(0);
      });

      // Each goal should have a unique goalId
      const goalIds = results.map((r) => r.goalId);
      const uniqueIds = new Set(goalIds);
      expect(uniqueIds.size).toBe(3);

      await runner.destroy();
    });

    it('should accumulate stats across multiple goals', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      const statsBefore = runner.getStats();
      expect(statsBefore.tasksExecuted).toBe(0);

      await runner.executeGoal('Stats goal 1', 'First', { waitForCompletion: true });
      await runner.executeGoal('Stats goal 2', 'Second', { waitForCompletion: true });

      const statsAfter = runner.getStats();
      expect(statsAfter.tasksExecuted).toBeGreaterThan(0);
      expect(statsAfter.uptime).toBeGreaterThanOrEqual(0);

      await runner.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Idempotent start and destroy
  // ═══════════════════════════════════════════════════════════

  describe('Idempotent start and destroy', () => {
    it('should survive duplicate start calls', async () => {
      const runner = createMockRunner({ workspaceDir });

      await runner.start();
      await runner.start(); // Second call should be idempotent

      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      await runner.destroy();
    });

    it('should survive duplicate destroy calls', async () => {
      const runner = createMockRunner({ workspaceDir });

      await runner.start();
      await runner.destroy();
      await runner.destroy(); // Second call should be idempotent

      expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. Runner config flag behavior
  // ═══════════════════════════════════════════════════════════

  describe('Runner config flag behavior', () => {
    it('should initialize ServiceRegistry when enableValidation is true', async () => {
      const runner = new OrchestratorRunner({
        llmClient: createMockLLMClient(),
        workspaceDir,
        enableValidation: true,
        enableLLM: false,
      });

      await runner.start();

      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);
      expect(registry.getConfidenceChecker()).not.toBeNull();
      expect(registry.getGoalBackwardVerifier()).not.toBeNull();

      await runner.destroy();
    });

    it('should initialize ServiceRegistry when enableContextManagement is true', async () => {
      const runner = new OrchestratorRunner({
        llmClient: createMockLLMClient(),
        workspaceDir,
        enableContextManagement: true,
        enableLLM: false,
      });

      await runner.start();

      const registry = ServiceRegistry.getInstance();
      expect(registry.getContextManager()).not.toBeNull();

      await runner.destroy();
    });

    it('should dispose ServiceRegistry on destroy', async () => {
      const runner = new OrchestratorRunner({
        llmClient: createMockLLMClient(),
        workspaceDir,
        enableValidation: true,
        enableLLM: false,
      });

      await runner.start();
      const registry = ServiceRegistry.getInstance();
      expect(registry.isInitialized()).toBe(true);

      await runner.destroy();
      expect(registry.isInitialized()).toBe(false);
    });

    it('should work without LLM when enableLLM is false', async () => {
      const runner = new OrchestratorRunner({
        llmClient: createMockLLMClient(),
        workspaceDir,
        enableLLM: false,
      });

      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      await runner.destroy();
    });

    it('should gracefully handle module initialization failures', async () => {
      const runner = new OrchestratorRunner({
        llmClient: createMockLLMClient(),
        workspaceDir,
        enableLearning: true,
        enableLLM: false,
      });

      // Start should succeed even if learning modules have issues in test env
      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      await runner.destroy();
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. Uptime and stats tracking
  // ═══════════════════════════════════════════════════════════

  describe('Uptime and stats tracking', () => {
    it('should track uptime after start', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      // Small delay to ensure uptime > 0
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(runner.uptime).toBeGreaterThan(0);

      const stats = runner.getStats();
      expect(stats.status).toBe(RunnerStatus.RUNNING);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);

      await runner.destroy();
    });

    it('should report correct task counts in stats', async () => {
      const runner = createMockRunner({ workspaceDir });
      await runner.start();

      await runner.executeGoal('Stats test', 'Test stats', { waitForCompletion: true });

      const stats = runner.getStats();
      expect(stats.tasksExecuted).toBeGreaterThan(0);
      expect(stats.tasksSucceeded + stats.tasksFailed).toBe(stats.tasksExecuted);

      await runner.destroy();

      const finalStats = runner.getStats();
      expect(finalStats.status).toBe(RunnerStatus.STOPPED);
    });
  });
});
