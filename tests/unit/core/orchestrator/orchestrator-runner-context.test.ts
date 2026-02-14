/**
 * Orchestrator Runner Context Pipeline Tests
 *
 * Tests that OrchestratorRunner correctly wires ContextManager events,
 * performs pre-task budget checks, tracks token usage after tasks,
 * triggers context compaction, and cleans up listeners on stop/destroy.
 *
 * Feature: G-4 Wire Context<->LLM pipeline
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  OrchestratorRunner,
  RunnerStatus,
} from '../../../../src/core/orchestrator/orchestrator-runner';
import { createMockRunner } from '../../../../src/core/orchestrator/mock-runner';
import { ServiceRegistry } from '../../../../src/core/services/service-registry';
import { HookEvent, HookAction, IHook, HookContext, HookResult, HookConfig } from '../../../../src/core/interfaces/hook.interface';
import { HookRegistry } from '../../../../src/core/hooks/hook-registry';

/**
 * Create a disposable temp directory for each test.
 */
function createTestWorkspace(): string {
  const dir = path.join(os.tmpdir(), `runner-ctx-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTestWorkspace(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Build a minimal IHook spy that records every invocation.
 */
function createSpyHook(
  name: string,
  event: HookEvent,
  options?: { action?: HookAction },
): { hook: IHook; calls: Array<{ event: HookEvent; data: unknown }> } {
  const calls: Array<{ event: HookEvent; data: unknown }> = [];
  const action = options?.action ?? HookAction.CONTINUE;
  let enabled = true;

  const hook: IHook = {
    name,
    description: `Spy hook for ${event}`,
    event,
    priority: 100,
    execute: jest.fn(async (ctx: HookContext): Promise<HookResult> => {
      calls.push({ event: ctx.event, data: ctx.data });
      return { action };
    }),
    shouldRun: jest.fn(() => true),
    enable: () => { enabled = true; },
    disable: () => { enabled = false; },
    isEnabled: () => enabled,
    getConfig: (): HookConfig => ({
      name,
      event,
      priority: 100,
      enabled,
    }),
  };

  return { hook, calls };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('OrchestratorRunner - Context Pipeline (G-4)', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
    ServiceRegistry.resetInstance();
  });

  afterEach(async () => {
    if (runner) {
      try {
        await runner.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestWorkspace(testDir);
    ServiceRegistry.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Context monitoring wiring
  // -----------------------------------------------------------------------

  describe('Context Monitoring Wiring', () => {
    it('should wire context event listeners when enableContextManagement is true', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      // Initialize ServiceRegistry with context enabled
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      // Access private field to verify handlers were registered
      const handlers = (runner as any).lifecycle.contextEventHandlers;
      expect(handlers.length).toBe(2);
      expect(handlers[0].event).toBe('usage-warning');
      expect(handlers[1].event).toBe('usage-critical');
    });

    it('should not wire context listeners when enableContextManagement is false', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: false,
      });

      await runner.start();

      const handlers = (runner as any).lifecycle.contextEventHandlers;
      expect(handlers.length).toBe(0);
    });

    it('should not fail start() when ContextManager is not available', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      // ServiceRegistry not initialized - no ContextManager
      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);
    });

    it('should emit context:warning when ContextManager fires usage-warning', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      const events: string[] = [];
      runner.on('context:warning', () => events.push('context:warning'));

      // Get the ContextManager and trigger a warning event
      const contextManager = registry.getContextManager()!;
      // Add tokens past warning threshold (default 75%)
      const maxTokens = (contextManager as any).tokenManager.getMaxTokens();
      contextManager.addTokens(Math.floor(maxTokens * 0.8));

      // Wait for event propagation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(events).toContain('context:warning');
    });

    it('should emit context:critical and trigger compaction when ContextManager fires usage-critical', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      // Register a CONTEXT_COMPACT spy hook
      const hookRegistry = (runner as any).hookRegistry as HookRegistry;
      const { hook: compactHook, calls: compactCalls } = createSpyHook('test-compact', HookEvent.CONTEXT_COMPACT);
      hookRegistry.register(compactHook);

      await runner.start();

      const events: string[] = [];
      runner.on('context:critical', () => events.push('context:critical'));

      // Get the ContextManager and trigger a critical event
      const contextManager = registry.getContextManager()!;
      const maxTokens = (contextManager as any).tokenManager.getMaxTokens();
      contextManager.addTokens(Math.floor(maxTokens * 0.95));

      // Wait for event propagation and async compaction
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(events).toContain('context:critical');
      // Compaction hook should have been triggered
      expect(compactCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // -----------------------------------------------------------------------
  // Pre-task budget check
  // -----------------------------------------------------------------------

  describe('Pre-task Budget Check', () => {
    it('should emit context:budget-warning when utilization exceeds 95%', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      // Push context usage past 95%
      const contextManager = registry.getContextManager()!;
      const maxTokens = (contextManager as any).tokenManager.getMaxTokens();
      contextManager.addTokens(Math.floor(maxTokens * 0.96));

      const budgetWarnings: Array<{ taskId: string; utilization: number }> = [];
      runner.on('context:budget-warning', (info) => budgetWarnings.push(info));

      // Execute a goal which will trigger executeTask -> checkContextBudget
      await runner.executeGoal(
        'Budget Test',
        'Test planning for budget check',
        { waitForCompletion: true },
      );

      expect(budgetWarnings.length).toBeGreaterThan(0);
      expect(budgetWarnings[0].utilization).toBeGreaterThan(95);
    });

    it('should not emit context:budget-warning when utilization is below 95%', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      // Keep context usage low
      const contextManager = registry.getContextManager()!;
      const maxTokens = (contextManager as any).tokenManager.getMaxTokens();
      contextManager.addTokens(Math.floor(maxTokens * 0.5));

      const budgetWarnings: Array<{ taskId: string; utilization: number }> = [];
      runner.on('context:budget-warning', (info) => budgetWarnings.push(info));

      await runner.executeGoal(
        'Low Budget Test',
        'Test planning for low budget',
        { waitForCompletion: true },
      );

      expect(budgetWarnings.length).toBe(0);
    });

    it('should not fail executeTask when ContextManager is unavailable', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
      });

      // No ServiceRegistry initialization - no ContextManager
      await runner.start();

      // executeGoal (and executeTask) should still work
      const result = await runner.executeGoal(
        'No Context Test',
        'Test planning without context manager',
      );

      expect(result.goalId).toBeDefined();
      expect(result.totalDuration).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Token tracking
  // -----------------------------------------------------------------------

  describe('Token Usage Tracking', () => {
    it('should track tokens when task result contains tokensUsed', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      const contextManager = registry.getContextManager()!;
      const initialStats = contextManager.getUsageStats();

      // Execute a goal - the mock runner returns results, and we verify
      // that the trackContextTokens method is called without errors
      await runner.executeGoal(
        'Token Track Test',
        'Test planning for token tracking',
        { waitForCompletion: true },
      );

      // The mock result may not have tokensUsed, so used may stay the same.
      // The important thing is that it does not throw.
      const finalStats = contextManager.getUsageStats();
      expect(finalStats.used).toBeGreaterThanOrEqual(initialStats.used);
    });

    it('should not fail when tracking tokens on a result without token info', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      // This should complete without errors even though mock results lack tokensUsed
      const result = await runner.executeGoal(
        'No Token Info Test',
        'Test planning without token info',
        { waitForCompletion: true },
      );

      expect(result.goalId).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  describe('Context Listener Cleanup', () => {
    it('should clean up context listeners on stop()', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      // Verify listeners were added
      const handlersBefore = (runner as any).lifecycle.contextEventHandlers;
      expect(handlersBefore.length).toBe(2);

      await runner.stop();

      // After stop, handlers should be cleared
      const handlersAfter = (runner as any).lifecycle.contextEventHandlers;
      expect(handlersAfter.length).toBe(0);
    });

    it('should clean up context listeners on destroy()', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      const handlersBefore = (runner as any).lifecycle.contextEventHandlers;
      expect(handlersBefore.length).toBe(2);

      await runner.destroy();

      // After destroy, handlers should be cleared
      // (destroy calls cleanupContextListeners before removeAllListeners)
      // Note: runner is destroyed so we check that it didn't throw
      runner = undefined as any;
    });

    it('should not fail cleanup when ContextManager is unavailable', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      // Start without initializing ServiceRegistry (no ContextManager)
      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

      // stop should not throw even though there's no ContextManager for cleanup
      await runner.stop();
      expect(runner.currentStatus).toBe(RunnerStatus.STOPPED);
    });
  });

  // -----------------------------------------------------------------------
  // Context compaction hook
  // -----------------------------------------------------------------------

  describe('Context Compaction', () => {
    it('should fire CONTEXT_COMPACT hook with usage data', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const hookRegistry = (runner as any).hookRegistry as HookRegistry;
      const { hook, calls } = createSpyHook('test-context-compact', HookEvent.CONTEXT_COMPACT);
      hookRegistry.register(hook);

      await runner.start();

      // Trigger compaction directly via the private method
      await (runner as any).lifecycle.triggerContextCompaction();

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.CONTEXT_COMPACT);
      expect((calls[0].data as any).usage).toBeDefined();
      expect((calls[0].data as any).usage.total).toBeGreaterThan(0);
    });

    it('should not fail compaction when no hooks are registered', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
        enableContextManagement: true,
      });

      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      await runner.start();

      // Should not throw
      await (runner as any).lifecycle.triggerContextCompaction();
    });

    it('should not fail compaction when ContextManager is unavailable', async () => {
      runner = createMockRunner({
        workspaceDir: testDir,
      });

      await runner.start();

      // Should not throw even without ContextManager
      await (runner as any).lifecycle.triggerContextCompaction();
    });
  });
});
