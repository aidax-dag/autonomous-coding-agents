/**
 * SandboxEscalationHook Tests
 */

import { SandboxEscalationHook } from '../../../../src/core/hooks/sandbox-escalation/sandbox-escalation.hook';
import { SandboxEscalation, createSandboxEscalation, SandboxLevel } from '../../../../src/core/security/index';
import { ConfidenceChecker, createConfidenceChecker } from '../../../../src/core/validation/confidence-checker';
import { HookEvent, HookAction, type HookContext } from '../../../../src/core/interfaces/hook.interface';

// Minimal TaskDocument mock
function createMockTask(overrides: Record<string, unknown> = {}): HookContext<any> {
  return {
    event: HookEvent.TASK_BEFORE,
    timestamp: new Date(),
    source: 'test',
    data: {
      content: 'Test task description',
      metadata: {
        id: 'task-1',
        type: 'implementation',
        files: [],
        dependencies: [],
        ...overrides,
      },
    },
  };
}

describe('SandboxEscalationHook', () => {
  let sandbox: SandboxEscalation;
  let checker: ConfidenceChecker;
  let hook: SandboxEscalationHook;

  beforeEach(() => {
    sandbox = createSandboxEscalation();
    checker = createConfidenceChecker();
    hook = new SandboxEscalationHook(sandbox, checker);
  });

  describe('identification', () => {
    it('should have correct name', () => {
      expect(hook.name).toBe('sandbox-escalation');
    });

    it('should listen to TASK_BEFORE event', () => {
      expect(hook.event).toBe(HookEvent.TASK_BEFORE);
    });

    it('should have priority 150', () => {
      expect(hook.priority).toBe(150);
    });
  });

  describe('execution', () => {
    it('should execute and return CONTINUE action', async () => {
      const context = createMockTask();
      const result = await hook.execute(context);
      expect(result.action).toBe(HookAction.CONTINUE);
    });

    it('should include escalation result as data', async () => {
      const context = createMockTask();
      const result = await hook.execute(context);
      expect(result.data).toBeDefined();
    });

    it('should handle checker errors gracefully', async () => {
      const badChecker = createConfidenceChecker({
        checkItems: [
          {
            name: 'failing',
            weight: 1.0,
            check: async () => { throw new Error('Checker failure'); },
          },
        ],
      });
      const h = new SandboxEscalationHook(sandbox, badChecker);
      const context = createMockTask();
      // Should not throw, should continue
      const result = await h.execute(context);
      expect(result.action).toBe(HookAction.CONTINUE);
    });
  });

  describe('task counters', () => {
    it('should start with zero counters', () => {
      expect(hook.getCounters()).toEqual({ successful: 0, failed: 0 });
    });

    it('should track successful tasks', () => {
      hook.recordSuccess();
      hook.recordSuccess();
      expect(hook.getCounters().successful).toBe(2);
    });

    it('should track failed tasks', () => {
      hook.recordFailure();
      expect(hook.getCounters().failed).toBe(1);
    });
  });

  describe('level tracking', () => {
    it('should return current sandbox level', () => {
      expect(hook.getCurrentLevel()).toBe(SandboxLevel.RESTRICTED);
    });
  });

  describe('shouldRun', () => {
    it('should run on TASK_BEFORE events', () => {
      const context = createMockTask();
      expect(hook.shouldRun(context)).toBe(true);
    });

    it('should not run on other events', () => {
      const context = {
        ...createMockTask(),
        event: HookEvent.TASK_AFTER,
      };
      expect(hook.shouldRun(context)).toBe(false);
    });

    it('should not run when disabled', () => {
      hook.disable();
      const context = createMockTask();
      expect(hook.shouldRun(context)).toBe(false);
    });
  });
});
