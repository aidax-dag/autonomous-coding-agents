/**
 * Hook Executor Tests
 */

import { HookRegistry, HookExecutor, BaseHook } from '../../../../src/core/hooks';
import {
  HookEvent,
  HookContext,
  HookResult,
  HookAction,
  HookCondition,
} from '../../../../src/core/interfaces/hook.interface';

/**
 * Mock hook for testing
 */
class MockHook extends BaseHook<{ value: number }, { processed: boolean }> {
  readonly name: string;
  readonly description: string;
  readonly event: HookEvent;
  private executionDelay: number;
  private shouldFail: boolean;
  private returnAction: HookAction;
  public executeCount = 0;

  constructor(
    name: string,
    options: {
      event?: HookEvent;
      priority?: number;
      delay?: number;
      shouldFail?: boolean;
      returnAction?: HookAction;
      conditions?: HookCondition[];
      enabled?: boolean;
    } = {}
  ) {
    super({
      priority: options.priority ?? 100,
      conditions: options.conditions,
      enabled: options.enabled ?? true,
    });
    this.name = name;
    this.description = `Description for ${name}`;
    this.event = options.event ?? HookEvent.TASK_BEFORE;
    this.executionDelay = options.delay ?? 0;
    this.shouldFail = options.shouldFail ?? false;
    this.returnAction = options.returnAction ?? HookAction.CONTINUE;
  }

  async execute(
    _context: HookContext<{ value: number }>
  ): Promise<HookResult<{ processed: boolean }>> {
    this.executeCount++;

    if (this.executionDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.executionDelay));
    }

    if (this.shouldFail) {
      throw new Error('Hook execution failed');
    }

    switch (this.returnAction) {
      case HookAction.CONTINUE:
        return this.continue({ processed: true });
      case HookAction.SKIP:
        return this.skip('Skipping');
      case HookAction.ABORT:
        return this.abort('Aborting');
      case HookAction.MODIFY:
        return this.modify({ processed: true }, 'Modified');
      default:
        return this.continue({ processed: true });
    }
  }
}

describe('HookExecutor', () => {
  let registry: HookRegistry;
  let executor: HookExecutor;

  beforeEach(() => {
    registry = new HookRegistry();
    executor = new HookExecutor(registry);
  });

  describe('executeHooks', () => {
    it('should execute all hooks for an event', async () => {
      const hook1 = new MockHook('hook-1');
      const hook2 = new MockHook('hook-2');
      registry.register(hook1);
      registry.register(hook2);

      const results = await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.action === HookAction.CONTINUE)).toBe(true);
      expect(hook1.executeCount).toBe(1);
      expect(hook2.executeCount).toBe(1);
    });

    it('should return empty array when no hooks registered', async () => {
      const results = await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      expect(results).toHaveLength(0);
    });

    it('should only execute hooks for matching event', async () => {
      const taskHook = new MockHook('task-hook', { event: HookEvent.TASK_BEFORE });
      const workflowHook = new MockHook('workflow-hook', { event: HookEvent.WORKFLOW_START });
      registry.register(taskHook);
      registry.register(workflowHook);

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      expect(taskHook.executeCount).toBe(1);
      expect(workflowHook.executeCount).toBe(0);
    });

    it('should only execute enabled hooks', async () => {
      const enabledHook = new MockHook('enabled-hook');
      const disabledHook = new MockHook('disabled-hook', { enabled: false });
      registry.register(enabledHook);
      registry.register(disabledHook);

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      expect(enabledHook.executeCount).toBe(1);
      expect(disabledHook.executeCount).toBe(0);
    });
  });

  describe('Sequential Execution', () => {
    it('should execute hooks in priority order', async () => {
      const executionOrder: string[] = [];

      class OrderTrackingHook extends MockHook {
        async execute(
          context: HookContext<{ value: number }>
        ): Promise<HookResult<{ processed: boolean }>> {
          executionOrder.push(this.name);
          return super.execute(context);
        }
      }

      registry.register(new OrderTrackingHook('low-priority', { priority: 10 }));
      registry.register(new OrderTrackingHook('high-priority', { priority: 100 }));
      registry.register(new OrderTrackingHook('medium-priority', { priority: 50 }));

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      expect(executionOrder).toEqual([
        'high-priority',
        'medium-priority',
        'low-priority',
      ]);
    });

    it('should stop on ABORT action', async () => {
      const hook1 = new MockHook('hook-1', { priority: 100 });
      const hook2 = new MockHook('hook-2', { priority: 50, returnAction: HookAction.ABORT });
      const hook3 = new MockHook('hook-3', { priority: 10 });
      registry.register(hook1);
      registry.register(hook2);
      registry.register(hook3);

      const results = await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      expect(results).toHaveLength(2);
      expect(hook1.executeCount).toBe(1);
      expect(hook2.executeCount).toBe(1);
      expect(hook3.executeCount).toBe(0); // Not executed due to ABORT
    });

    it('should continue on error by default', async () => {
      const hook1 = new MockHook('hook-1', { priority: 100 });
      const hook2 = new MockHook('hook-2', { priority: 50, shouldFail: true });
      const hook3 = new MockHook('hook-3', { priority: 10 });
      registry.register(hook1);
      registry.register(hook2);
      registry.register(hook3);

      const results = await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      expect(results).toHaveLength(3);
      expect(hook3.executeCount).toBe(1); // Should still execute
    });

    it('should stop on error when configured', async () => {
      const hook1 = new MockHook('hook-1', { priority: 100 });
      const hook2 = new MockHook('hook-2', { priority: 50, shouldFail: true });
      const hook3 = new MockHook('hook-3', { priority: 10 });
      registry.register(hook1);
      registry.register(hook2);
      registry.register(hook3);

      const results = await executor.executeHooks(
        HookEvent.TASK_BEFORE,
        { value: 42 },
        { stopOnError: true }
      );

      expect(results).toHaveLength(2);
      expect(hook3.executeCount).toBe(0); // Not executed due to error
    });
  });

  describe('Parallel Execution', () => {
    it('should execute hooks in parallel', async () => {
      registry.register(new MockHook('hook-1', { delay: 50 }));
      registry.register(new MockHook('hook-2', { delay: 50 }));
      registry.register(new MockHook('hook-3', { delay: 50 }));

      const startTime = Date.now();
      const results = await executor.executeHooks(
        HookEvent.TASK_BEFORE,
        { value: 42 },
        { parallel: true }
      );
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(3);
      // Should complete faster than sequential (3 * 50ms = 150ms)
      expect(duration).toBeLessThan(150);
    });

    it('should handle errors in parallel execution', async () => {
      registry.register(new MockHook('hook-1'));
      registry.register(new MockHook('hook-2', { shouldFail: true }));
      registry.register(new MockHook('hook-3'));

      const results = await executor.executeHooks(
        HookEvent.TASK_BEFORE,
        { value: 42 },
        { parallel: true }
      );

      expect(results).toHaveLength(3);
      // All results have CONTINUE action (errors are caught and returned with CONTINUE)
      expect(results.every((r) => r.action === HookAction.CONTINUE)).toBe(true);
      // One result should have an error message
      const errorCount = results.filter((r) => r.message?.includes('failed')).length;
      expect(errorCount).toBe(1);
    });
  });

  describe('Timeout', () => {
    it('should timeout slow hooks', async () => {
      registry.register(new MockHook('slow-hook', { delay: 200 }));

      const results = await executor.executeHooks(
        HookEvent.TASK_BEFORE,
        { value: 42 },
        { timeout: 50 }
      );

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('timed out');
    });
  });

  describe('executeAndReduce', () => {
    it('should reduce results to final value', async () => {
      registry.register(new MockHook('hook-1'));
      registry.register(new MockHook('hook-2'));

      const result = await executor.executeAndReduce<{ value: number }, number>(
        HookEvent.TASK_BEFORE,
        { value: 42 },
        (acc, _result, index) => (acc ?? 0) + index
      );

      expect(result).toBe(1); // 0 + 1
    });
  });

  describe('executeUntilAction', () => {
    it('should return when action is found', async () => {
      registry.register(new MockHook('hook-1', { priority: 100 }));
      registry.register(new MockHook('hook-2', { priority: 50, returnAction: HookAction.SKIP }));
      registry.register(new MockHook('hook-3', { priority: 10 }));

      const result = await executor.executeUntilAction(
        HookEvent.TASK_BEFORE,
        { value: 42 },
        HookAction.SKIP
      );

      expect(result).toBeDefined();
      expect(result!.action).toBe(HookAction.SKIP);
    });

    it('should return undefined when action not found', async () => {
      registry.register(new MockHook('hook-1'));
      registry.register(new MockHook('hook-2'));

      const result = await executor.executeUntilAction(
        HookEvent.TASK_BEFORE,
        { value: 42 },
        HookAction.ABORT
      );

      expect(result).toBeUndefined();
    });
  });

  describe('Condition Evaluation', () => {
    it('should only execute when conditions are met', async () => {
      const hook = new MockHook('conditional-hook', {
        conditions: [{ field: 'value', operator: 'gt', value: 50 }],
      });
      registry.register(hook);

      // Condition not met
      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });
      expect(hook.executeCount).toBe(0);

      // Condition met
      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 100 });
      expect(hook.executeCount).toBe(1);
    });
  });

  describe('Context Modification', () => {
    it('should pass modified context to next hook', async () => {
      class ModifyingHook extends BaseHook<{ value: number }, { value: number }> {
        readonly name = 'modifying-hook';
        readonly description = 'Modifies value';
        readonly event = HookEvent.TASK_BEFORE;

        constructor() {
          super({ priority: 100 });
        }

        async execute(
          context: HookContext<{ value: number }>
        ): Promise<HookResult<{ value: number }>> {
          return this.modify({ value: context.data.value * 2 });
        }
      }

      class ReadingHook extends BaseHook<{ value: number }, { value: number }> {
        readonly name = 'reading-hook';
        readonly description = 'Reads value';
        readonly event = HookEvent.TASK_BEFORE;
        public receivedValue = 0;

        constructor() {
          super({ priority: 50 });
        }

        async execute(
          context: HookContext<{ value: number }>
        ): Promise<HookResult<{ value: number }>> {
          this.receivedValue = context.data.value;
          return this.continue();
        }
      }

      const modifyingHook = new ModifyingHook();
      const readingHook = new ReadingHook();
      registry.register(modifyingHook);
      registry.register(readingHook);

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 10 });

      expect(readingHook.receivedValue).toBe(20); // 10 * 2
    });
  });

  describe('History', () => {
    it('should record execution history', async () => {
      registry.register(new MockHook('test-hook'));

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      const history = executor.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].hookName).toBe('test-hook');
      expect(history[0].event).toBe(HookEvent.TASK_BEFORE);
    });

    it('should limit history with parameter', async () => {
      registry.register(new MockHook('test-hook'));

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 1 });
      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 2 });
      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 3 });

      const history = executor.getHistory(2);
      expect(history).toHaveLength(2);
    });

    it('should clear history', async () => {
      registry.register(new MockHook('test-hook'));

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });
      executor.clearHistory();

      expect(executor.getHistory()).toHaveLength(0);
    });

    it('should record errors in history', async () => {
      registry.register(new MockHook('failing-hook', { shouldFail: true }));

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      const history = executor.getHistory();
      expect(history[0].error).toBeDefined();
    });

    it('should include execution duration', async () => {
      registry.register(new MockHook('slow-hook', { delay: 50 }));

      await executor.executeHooks(HookEvent.TASK_BEFORE, { value: 42 });

      const history = executor.getHistory();
      // Allow ~10% tolerance for timer imprecision across different systems
      expect(history[0].duration).toBeGreaterThanOrEqual(45);
    });
  });
});
