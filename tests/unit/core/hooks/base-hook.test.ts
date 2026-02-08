/**
 * Base Hook Tests
 */

import { BaseHook } from '../../../../src/core/hooks/base-hook';
import {
  HookEvent,
  HookAction,
  HookContext,
  HookResult,
} from '../../../../src/core/interfaces/hook.interface';

// ============================================================================
// Concrete test implementation
// ============================================================================

class TestHook extends BaseHook<{ value: number }, string> {
  readonly name = 'test-hook';
  readonly description = 'A test hook';
  readonly event = HookEvent.TASK_BEFORE;

  async execute(context: HookContext<{ value: number }>): Promise<HookResult<string>> {
    if (context.data.value > 10) {
      return this.abort('Value too high');
    }
    if (context.data.value < 0) {
      return this.skip('Negative value');
    }
    if (context.data.value === 0) {
      return this.retry('Zero value');
    }
    if (context.data.value === 5) {
      return this.modify('modified', 'Value was 5');
    }
    return this.continue(`ok:${context.data.value}`);
  }
}

function makeContext(data: { value: number }, event = HookEvent.TASK_BEFORE): HookContext<{ value: number }> {
  return { event, data, timestamp: new Date(), source: 'test' };
}

// ============================================================================
// Tests
// ============================================================================

describe('BaseHook', () => {
  let hook: TestHook;

  beforeEach(() => {
    hook = new TestHook();
  });

  // ==========================================================================
  // Constructor & Config
  // ==========================================================================

  describe('constructor', () => {
    it('should use defaults', () => {
      expect(hook.priority).toBe(100);
      expect(hook.isEnabled()).toBe(true);
    });

    it('should accept custom config', () => {
      const custom = new TestHook({ priority: 200, enabled: false, timeout: 10000 });
      expect(custom.priority).toBe(200);
      expect(custom.isEnabled()).toBe(false);
    });
  });

  describe('getConfig', () => {
    it('should return full config', () => {
      const config = hook.getConfig();
      expect(config.name).toBe('test-hook');
      expect(config.description).toBe('A test hook');
      expect(config.event).toBe(HookEvent.TASK_BEFORE);
      expect(config.priority).toBe(100);
      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(5000);
      expect(config.retryOnError).toBe(false);
      expect(config.conditions).toEqual([]);
    });
  });

  // ==========================================================================
  // Enable / Disable
  // ==========================================================================

  describe('enable / disable', () => {
    it('should toggle enabled state', () => {
      hook.disable();
      expect(hook.isEnabled()).toBe(false);
      hook.enable();
      expect(hook.isEnabled()).toBe(true);
    });
  });

  // ==========================================================================
  // shouldRun
  // ==========================================================================

  describe('shouldRun', () => {
    it('should return true for matching event', () => {
      expect(hook.shouldRun(makeContext({ value: 1 }))).toBe(true);
    });

    it('should return false when disabled', () => {
      hook.disable();
      expect(hook.shouldRun(makeContext({ value: 1 }))).toBe(false);
    });

    it('should return false for non-matching event', () => {
      expect(hook.shouldRun(makeContext({ value: 1 }, HookEvent.TASK_AFTER))).toBe(false);
    });

    it('should evaluate conditions', () => {
      const condHook = new TestHook({
        conditions: [{ field: 'value', operator: 'gt', value: 5 }],
      });
      expect(condHook.shouldRun(makeContext({ value: 10 }))).toBe(true);
      expect(condHook.shouldRun(makeContext({ value: 3 }))).toBe(false);
    });
  });

  // ==========================================================================
  // execute (result helpers)
  // ==========================================================================

  describe('execute', () => {
    it('should return CONTINUE for normal values', async () => {
      const result = await hook.execute(makeContext({ value: 3 }));
      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.data).toBe('ok:3');
    });

    it('should return ABORT for high values', async () => {
      const result = await hook.execute(makeContext({ value: 15 }));
      expect(result.action).toBe(HookAction.ABORT);
      expect(result.message).toBe('Value too high');
    });

    it('should return SKIP for negative values', async () => {
      const result = await hook.execute(makeContext({ value: -1 }));
      expect(result.action).toBe(HookAction.SKIP);
    });

    it('should return RETRY for zero', async () => {
      const result = await hook.execute(makeContext({ value: 0 }));
      expect(result.action).toBe(HookAction.RETRY);
    });

    it('should return MODIFY for value 5', async () => {
      const result = await hook.execute(makeContext({ value: 5 }));
      expect(result.action).toBe(HookAction.MODIFY);
      expect(result.data).toBe('modified');
    });
  });

  // ==========================================================================
  // Condition Evaluation
  // ==========================================================================

  describe('condition operators', () => {
    function hookWithCondition(field: string, operator: string, value: unknown) {
      return new TestHook({
        conditions: [{ field, operator: operator as any, value }],
      });
    }

    it('eq: should match equal values', () => {
      const h = hookWithCondition('value', 'eq', 5);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 6 }))).toBe(false);
    });

    it('ne: should match non-equal values', () => {
      const h = hookWithCondition('value', 'ne', 5);
      expect(h.shouldRun(makeContext({ value: 3 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(false);
    });

    it('gt: should match greater values', () => {
      const h = hookWithCondition('value', 'gt', 5);
      expect(h.shouldRun(makeContext({ value: 6 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(false);
    });

    it('gte: should match greater or equal', () => {
      const h = hookWithCondition('value', 'gte', 5);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 4 }))).toBe(false);
    });

    it('lt: should match lesser values', () => {
      const h = hookWithCondition('value', 'lt', 5);
      expect(h.shouldRun(makeContext({ value: 4 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(false);
    });

    it('lte: should match lesser or equal', () => {
      const h = hookWithCondition('value', 'lte', 5);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 6 }))).toBe(false);
    });

    it('in: should match value in array', () => {
      const h = hookWithCondition('value', 'in', [1, 2, 3]);
      expect(h.shouldRun(makeContext({ value: 2 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(false);
    });

    it('nin: should match value not in array', () => {
      const h = hookWithCondition('value', 'nin', [1, 2, 3]);
      expect(h.shouldRun(makeContext({ value: 5 }))).toBe(true);
      expect(h.shouldRun(makeContext({ value: 2 }))).toBe(false);
    });

    it('regex: should match string pattern', () => {
      class StringHook extends BaseHook<{ name: string }> {
        readonly name = 'str-hook';
        readonly description = 'str';
        readonly event = HookEvent.TASK_BEFORE;
        async execute() { return this.continue(); }
      }
      const h = new StringHook({
        conditions: [{ field: 'name', operator: 'regex', value: '^test' }],
      });
      expect(h.shouldRun({ event: HookEvent.TASK_BEFORE, data: { name: 'testing' }, timestamp: new Date(), source: 'test' })).toBe(true);
      expect(h.shouldRun({ event: HookEvent.TASK_BEFORE, data: { name: 'other' }, timestamp: new Date(), source: 'test' })).toBe(false);
    });

    it('unknown operator: should default to true', () => {
      const h = hookWithCondition('value', 'unknown_op', 5);
      expect(h.shouldRun(makeContext({ value: 1 }))).toBe(true);
    });
  });
});
