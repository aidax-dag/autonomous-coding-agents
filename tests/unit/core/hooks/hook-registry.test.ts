/**
 * Hook Registry Tests
 */

import { HookRegistry, BaseHook } from '../../../../src/core/hooks';
import {
  HookEvent,
  HookContext,
  HookResult,
} from '../../../../src/core/interfaces/hook.interface';

/**
 * Mock hook for testing
 */
class MockHook extends BaseHook<unknown, void> {
  readonly name: string;
  readonly description: string;
  readonly event: HookEvent;

  constructor(
    name: string,
    event: HookEvent = HookEvent.AGENT_INITIALIZED,
    priority: number = 100
  ) {
    super({ priority });
    this.name = name;
    this.description = `Description for ${name}`;
    this.event = event;
  }

  async execute(_context: HookContext<unknown>): Promise<HookResult<void>> {
    return this.continue();
  }
}

describe('HookRegistry', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry();
  });

  describe('Registration', () => {
    it('should register a hook', () => {
      const hook = new MockHook('test-hook');

      registry.register(hook);

      expect(registry.has('test-hook')).toBe(true);
      expect(registry.count()).toBe(1);
    });

    it('should throw when registering duplicate name', () => {
      const hook1 = new MockHook('test-hook');
      const hook2 = new MockHook('test-hook');

      registry.register(hook1);

      expect(() => registry.register(hook2)).toThrow(
        "Hook 'test-hook' is already registered"
      );
    });

    it('should register multiple hooks', () => {
      registry.register(new MockHook('hook-1'));
      registry.register(new MockHook('hook-2'));
      registry.register(new MockHook('hook-3'));

      expect(registry.count()).toBe(3);
    });
  });

  describe('Unregistration', () => {
    it('should unregister a hook', () => {
      const hook = new MockHook('test-hook');

      registry.register(hook);
      expect(registry.unregister('test-hook')).toBe(true);
      expect(registry.has('test-hook')).toBe(false);
    });

    it('should return false when unregistering non-existent hook', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });

    it('should update event index on unregistration', () => {
      const hook = new MockHook('lifecycle-hook', HookEvent.AGENT_INITIALIZED);

      registry.register(hook);
      expect(registry.getByEvent(HookEvent.AGENT_INITIALIZED)).toHaveLength(1);

      registry.unregister('lifecycle-hook');
      expect(registry.getByEvent(HookEvent.AGENT_INITIALIZED)).toHaveLength(0);
    });
  });

  describe('Lookup', () => {
    beforeEach(() => {
      registry.register(new MockHook('lifecycle-hook-1', HookEvent.AGENT_INITIALIZED));
      registry.register(new MockHook('lifecycle-hook-2', HookEvent.AGENT_INITIALIZED));
      registry.register(new MockHook('task-hook-1', HookEvent.TASK_BEFORE));
    });

    it('should get hook by name', () => {
      const hook = registry.get('lifecycle-hook-1');

      expect(hook).toBeDefined();
      expect(hook!.name).toBe('lifecycle-hook-1');
    });

    it('should return undefined for unknown name', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });

    it('should get hooks by event', () => {
      const lifecycleHooks = registry.getByEvent(HookEvent.AGENT_INITIALIZED);

      expect(lifecycleHooks).toHaveLength(2);
      expect(lifecycleHooks.map((h) => h.name)).toContain('lifecycle-hook-1');
      expect(lifecycleHooks.map((h) => h.name)).toContain('lifecycle-hook-2');
    });

    it('should return empty array for unregistered event', () => {
      const workflowHooks = registry.getByEvent(HookEvent.WORKFLOW_START);
      expect(workflowHooks).toHaveLength(0);
    });

    it('should get all hooks', () => {
      const all = registry.getAll();
      expect(all).toHaveLength(3);
    });

    it('should check if hook exists', () => {
      expect(registry.has('lifecycle-hook-1')).toBe(true);
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('Priority Sorting', () => {
    it('should sort hooks by priority (highest first)', () => {
      registry.register(new MockHook('low-priority', HookEvent.TASK_BEFORE, 10));
      registry.register(new MockHook('high-priority', HookEvent.TASK_BEFORE, 100));
      registry.register(new MockHook('medium-priority', HookEvent.TASK_BEFORE, 50));

      const hooks = registry.getByEvent(HookEvent.TASK_BEFORE);

      expect(hooks[0].name).toBe('high-priority');
      expect(hooks[1].name).toBe('medium-priority');
      expect(hooks[2].name).toBe('low-priority');
    });

    it('should maintain order for same priority', () => {
      registry.register(new MockHook('hook-a', HookEvent.TASK_BEFORE, 50));
      registry.register(new MockHook('hook-b', HookEvent.TASK_BEFORE, 50));

      const hooks = registry.getByEvent(HookEvent.TASK_BEFORE);

      expect(hooks).toHaveLength(2);
      // Both should have same priority
      expect(hooks[0].priority).toBe(50);
      expect(hooks[1].priority).toBe(50);
    });
  });

  describe('Event Management', () => {
    it('should get registered events', () => {
      registry.register(new MockHook('hook-1', HookEvent.AGENT_INITIALIZED));
      registry.register(new MockHook('hook-2', HookEvent.TASK_BEFORE));

      const events = registry.getRegisteredEvents();

      expect(events).toContain(HookEvent.AGENT_INITIALIZED);
      expect(events).toContain(HookEvent.TASK_BEFORE);
      expect(events).toHaveLength(2);
    });

    it('should remove event from index when last hook unregistered', () => {
      registry.register(new MockHook('lifecycle-hook', HookEvent.AGENT_INITIALIZED));

      expect(registry.getRegisteredEvents()).toContain(HookEvent.AGENT_INITIALIZED);

      registry.unregister('lifecycle-hook');

      expect(registry.getRegisteredEvents()).not.toContain(HookEvent.AGENT_INITIALIZED);
    });
  });

  describe('Clear', () => {
    it('should clear all hooks', () => {
      registry.register(new MockHook('hook-1'));
      registry.register(new MockHook('hook-2'));

      registry.clear();

      expect(registry.count()).toBe(0);
      expect(registry.getRegisteredEvents()).toHaveLength(0);
    });
  });

  describe('Enable/Disable', () => {
    it('should enable a hook', () => {
      const hook = new MockHook('test-hook');
      hook.disable();
      registry.register(hook);

      expect(registry.setEnabled('test-hook', true)).toBe(true);
      expect(hook.isEnabled()).toBe(true);
    });

    it('should disable a hook', () => {
      const hook = new MockHook('test-hook');
      registry.register(hook);

      expect(registry.setEnabled('test-hook', false)).toBe(true);
      expect(hook.isEnabled()).toBe(false);
    });

    it('should return false for non-existent hook', () => {
      expect(registry.setEnabled('non-existent', true)).toBe(false);
    });

    it('should get enabled hooks by event', () => {
      const hook1 = new MockHook('hook-1', HookEvent.TASK_BEFORE);
      const hook2 = new MockHook('hook-2', HookEvent.TASK_BEFORE);
      hook2.disable();

      registry.register(hook1);
      registry.register(hook2);

      const enabled = registry.getEnabledByEvent(HookEvent.TASK_BEFORE);

      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('hook-1');
    });
  });

  describe('Priority Range', () => {
    beforeEach(() => {
      registry.register(new MockHook('hook-low', HookEvent.TASK_BEFORE, 10));
      registry.register(new MockHook('hook-medium', HookEvent.TASK_BEFORE, 50));
      registry.register(new MockHook('hook-high', HookEvent.TASK_BEFORE, 100));
    });

    it('should get hooks by priority range', () => {
      const hooks = registry.getByPriorityRange(40, 110);

      expect(hooks).toHaveLength(2);
      expect(hooks.map((h) => h.name)).toContain('hook-medium');
      expect(hooks.map((h) => h.name)).toContain('hook-high');
    });

    it('should return empty for non-matching range', () => {
      const hooks = registry.getByPriorityRange(200, 300);
      expect(hooks).toHaveLength(0);
    });
  });
});
