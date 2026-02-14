/**
 * E2E: Hook Pipeline
 *
 * Verifies the HookRegistry + HookExecutor pipeline including
 * registration, execution order by priority, error handling,
 * sequential and parallel execution, and built-in hook event types.
 */

import { HookRegistry } from '@/core/hooks/hook-registry';
import { HookExecutor } from '@/core/hooks/hook-executor';
import {
  HookEvent,
  HookAction,
  type IHook,
  type HookContext,
  type HookResult,
  type HookConfig,
} from '@/core/interfaces/hook.interface';

/**
 * Helper to create a minimal IHook implementation for testing
 */
function createTestHook(overrides: {
  name: string;
  event: HookEvent;
  priority?: number;
  action?: HookAction;
  message?: string;
  executeFn?: (ctx: HookContext) => Promise<HookResult>;
  shouldRunFn?: (ctx: HookContext) => boolean;
}): IHook {
  let enabled = true;
  const config: HookConfig = {
    name: overrides.name,
    event: overrides.event,
    priority: overrides.priority ?? 100,
    enabled: true,
  };

  return {
    name: overrides.name,
    description: `Test hook: ${overrides.name}`,
    event: overrides.event,
    priority: overrides.priority ?? 100,

    execute: overrides.executeFn ?? (async () => ({
      action: overrides.action ?? HookAction.CONTINUE,
      message: overrides.message ?? `${overrides.name} executed`,
    })),

    shouldRun: overrides.shouldRunFn ?? (() => enabled),

    enable: () => { enabled = true; },
    disable: () => { enabled = false; },
    isEnabled: () => enabled,
    getConfig: () => config,
  };
}

describe('E2E: Hook Pipeline', () => {
  let registry: HookRegistry;
  let executor: HookExecutor;

  beforeEach(() => {
    registry = new HookRegistry();
    executor = new HookExecutor(registry);
  });

  // ═══════════════════════════════════════════════════════════
  // 1. Hook registration and execution order
  // ═══════════════════════════════════════════════════════════

  describe('Hook registration and execution order', () => {
    it('should register hooks and retrieve them by event', () => {
      const hookA = createTestHook({ name: 'hook-a', event: HookEvent.TASK_BEFORE, priority: 50 });
      const hookB = createTestHook({ name: 'hook-b', event: HookEvent.TASK_BEFORE, priority: 100 });
      const hookC = createTestHook({ name: 'hook-c', event: HookEvent.TASK_AFTER, priority: 75 });

      registry.register(hookA);
      registry.register(hookB);
      registry.register(hookC);

      expect(registry.count()).toBe(3);

      const taskBeforeHooks = registry.getByEvent(HookEvent.TASK_BEFORE);
      expect(taskBeforeHooks).toHaveLength(2);

      const taskAfterHooks = registry.getByEvent(HookEvent.TASK_AFTER);
      expect(taskAfterHooks).toHaveLength(1);
    });

    it('should execute hooks in descending priority order', async () => {
      const executionOrder: string[] = [];

      const lowPriority = createTestHook({
        name: 'low-priority',
        event: HookEvent.TASK_BEFORE,
        priority: 10,
        executeFn: async () => {
          executionOrder.push('low');
          return { action: HookAction.CONTINUE };
        },
      });

      const highPriority = createTestHook({
        name: 'high-priority',
        event: HookEvent.TASK_BEFORE,
        priority: 100,
        executeFn: async () => {
          executionOrder.push('high');
          return { action: HookAction.CONTINUE };
        },
      });

      const medPriority = createTestHook({
        name: 'med-priority',
        event: HookEvent.TASK_BEFORE,
        priority: 50,
        executeFn: async () => {
          executionOrder.push('med');
          return { action: HookAction.CONTINUE };
        },
      });

      registry.register(lowPriority);
      registry.register(highPriority);
      registry.register(medPriority);

      await executor.executeHooks(HookEvent.TASK_BEFORE, { task: 'test' });

      expect(executionOrder).toEqual(['high', 'med', 'low']);
    });

    it('should not allow duplicate hook names', () => {
      const hookA = createTestHook({ name: 'duplicate', event: HookEvent.TASK_BEFORE });
      const hookB = createTestHook({ name: 'duplicate', event: HookEvent.TASK_AFTER });

      registry.register(hookA);
      expect(() => registry.register(hookB)).toThrow(/already registered/);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 2. Hook execution with error handling
  // ═══════════════════════════════════════════════════════════

  describe('Hook execution with error handling', () => {
    it('should continue execution when a hook throws and stopOnError is false', async () => {
      const executionOrder: string[] = [];

      const throwingHook = createTestHook({
        name: 'throwing-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 100,
        executeFn: async () => {
          executionOrder.push('throwing');
          throw new Error('Hook failed');
        },
      });

      const normalHook = createTestHook({
        name: 'normal-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 50,
        executeFn: async () => {
          executionOrder.push('normal');
          return { action: HookAction.CONTINUE, message: 'OK' };
        },
      });

      registry.register(throwingHook);
      registry.register(normalHook);

      const results = await executor.executeHooks(
        HookEvent.TASK_BEFORE,
        { task: 'test' },
        { stopOnError: false },
      );

      expect(executionOrder).toEqual(['throwing', 'normal']);
      expect(results).toHaveLength(2);
      expect(results[0].message).toContain('failed');
      expect(results[1].action).toBe(HookAction.CONTINUE);
    });

    it('should stop execution when a hook throws and stopOnError is true', async () => {
      const executionOrder: string[] = [];

      const throwingHook = createTestHook({
        name: 'throwing-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 100,
        executeFn: async () => {
          executionOrder.push('throwing');
          throw new Error('Critical hook failure');
        },
      });

      const normalHook = createTestHook({
        name: 'normal-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 50,
        executeFn: async () => {
          executionOrder.push('normal');
          return { action: HookAction.CONTINUE };
        },
      });

      registry.register(throwingHook);
      registry.register(normalHook);

      const results = await executor.executeHooks(
        HookEvent.TASK_BEFORE,
        { task: 'test' },
        { stopOnError: true },
      );

      // Only the throwing hook ran, then execution stopped
      expect(executionOrder).toEqual(['throwing']);
      expect(results).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 3. Hook pipeline with ABORT action
  // ═══════════════════════════════════════════════════════════

  describe('Hook pipeline with ABORT action', () => {
    it('should stop pipeline when a hook returns ABORT', async () => {
      const executionOrder: string[] = [];

      const abortHook = createTestHook({
        name: 'abort-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 100,
        executeFn: async () => {
          executionOrder.push('abort');
          return { action: HookAction.ABORT, message: 'Blocked by validation' };
        },
      });

      const continueHook = createTestHook({
        name: 'continue-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 50,
        executeFn: async () => {
          executionOrder.push('continue');
          return { action: HookAction.CONTINUE };
        },
      });

      registry.register(abortHook);
      registry.register(continueHook);

      const results = await executor.executeHooks(
        HookEvent.TASK_BEFORE,
        { task: 'test' },
        { stopOnAction: [HookAction.ABORT] },
      );

      expect(executionOrder).toEqual(['abort']);
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe(HookAction.ABORT);
    });

    it('should support executeUntilAction for finding specific results', async () => {
      const abortHook = createTestHook({
        name: 'blocker',
        event: HookEvent.TASK_BEFORE,
        priority: 100,
        action: HookAction.ABORT,
        message: 'Confidence too low',
      });

      registry.register(abortHook);

      const result = await executor.executeUntilAction(
        HookEvent.TASK_BEFORE,
        { task: 'test' },
        HookAction.ABORT,
      );

      expect(result).toBeDefined();
      expect(result!.action).toBe(HookAction.ABORT);
      expect(result!.message).toContain('Confidence too low');
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 4. Parallel hook execution
  // ═══════════════════════════════════════════════════════════

  describe('Parallel hook execution', () => {
    it('should execute hooks in parallel when parallel option is set', async () => {
      const timestamps: { name: string; time: number }[] = [];

      const hookA = createTestHook({
        name: 'parallel-a',
        event: HookEvent.TASK_AFTER,
        priority: 100,
        executeFn: async () => {
          timestamps.push({ name: 'a', time: Date.now() });
          return { action: HookAction.CONTINUE };
        },
      });

      const hookB = createTestHook({
        name: 'parallel-b',
        event: HookEvent.TASK_AFTER,
        priority: 50,
        executeFn: async () => {
          timestamps.push({ name: 'b', time: Date.now() });
          return { action: HookAction.CONTINUE };
        },
      });

      registry.register(hookA);
      registry.register(hookB);

      const results = await executor.executeHooks(
        HookEvent.TASK_AFTER,
        { task: 'test' },
        { parallel: true },
      );

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.action === HookAction.CONTINUE)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 5. Enable/disable hooks
  // ═══════════════════════════════════════════════════════════

  describe('Enable/disable hooks', () => {
    it('should skip disabled hooks during execution', async () => {
      const executionOrder: string[] = [];

      const enabledHook = createTestHook({
        name: 'enabled-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 100,
        executeFn: async () => {
          executionOrder.push('enabled');
          return { action: HookAction.CONTINUE };
        },
      });

      const disabledHook = createTestHook({
        name: 'disabled-hook',
        event: HookEvent.TASK_BEFORE,
        priority: 50,
        executeFn: async () => {
          executionOrder.push('disabled');
          return { action: HookAction.CONTINUE };
        },
      });

      registry.register(enabledHook);
      registry.register(disabledHook);

      // Disable one hook
      registry.setEnabled('disabled-hook', false);

      await executor.executeHooks(HookEvent.TASK_BEFORE, { task: 'test' });

      expect(executionOrder).toEqual(['enabled']);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 6. Hook unregistration and clear
  // ═══════════════════════════════════════════════════════════

  describe('Hook unregistration and clear', () => {
    it('should unregister a hook by name', () => {
      const hook = createTestHook({ name: 'removable', event: HookEvent.TASK_BEFORE });
      registry.register(hook);
      expect(registry.has('removable')).toBe(true);

      const removed = registry.unregister('removable');
      expect(removed).toBe(true);
      expect(registry.has('removable')).toBe(false);
      expect(registry.count()).toBe(0);
    });

    it('should return false when unregistering non-existent hook', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });

    it('should clear all hooks', () => {
      registry.register(createTestHook({ name: 'a', event: HookEvent.TASK_BEFORE }));
      registry.register(createTestHook({ name: 'b', event: HookEvent.TASK_AFTER }));
      registry.register(createTestHook({ name: 'c', event: HookEvent.TASK_ERROR }));

      expect(registry.count()).toBe(3);

      registry.clear();
      expect(registry.count()).toBe(0);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 7. Execution history
  // ═══════════════════════════════════════════════════════════

  describe('Execution history', () => {
    it('should record execution history', async () => {
      const hook = createTestHook({
        name: 'tracked-hook',
        event: HookEvent.TASK_BEFORE,
        action: HookAction.CONTINUE,
      });

      registry.register(hook);

      await executor.executeHooks(HookEvent.TASK_BEFORE, { task: 'test' });
      await executor.executeHooks(HookEvent.TASK_BEFORE, { task: 'test-2' });

      const history = executor.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].hookName).toBe('tracked-hook');
    });

    it('should clear execution history', async () => {
      const hook = createTestHook({
        name: 'clearable-hook',
        event: HookEvent.TASK_BEFORE,
      });

      registry.register(hook);

      await executor.executeHooks(HookEvent.TASK_BEFORE, { task: 'test' });
      expect(executor.getHistory().length).toBeGreaterThan(0);

      executor.clearHistory();
      expect(executor.getHistory()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 8. Built-in hook event types
  // ═══════════════════════════════════════════════════════════

  describe('Built-in hook event types', () => {
    it.each([
      HookEvent.TASK_BEFORE,
      HookEvent.TASK_AFTER,
      HookEvent.TASK_ERROR,
      HookEvent.WORKFLOW_START,
      HookEvent.WORKFLOW_END,
      HookEvent.AGENT_STARTED,
      HookEvent.AGENT_STOPPED,
      HookEvent.CONTEXT_THRESHOLD,
    ])('should support %s event type', async (eventType) => {
      const received: HookEvent[] = [];

      const hook = createTestHook({
        name: `test-${eventType}`,
        event: eventType,
        executeFn: async (ctx) => {
          received.push(ctx.event);
          return { action: HookAction.CONTINUE };
        },
      });

      registry.register(hook);

      await executor.executeHooks(eventType, { data: 'test' });

      expect(received).toHaveLength(1);
      expect(received[0]).toBe(eventType);
    });
  });
});
