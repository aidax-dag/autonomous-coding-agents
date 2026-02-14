/**
 * RunnerLifecycle Unit Tests
 *
 * Tests the extracted RunnerLifecycle module independently from OrchestratorRunner.
 * Verifies session management, context monitoring wiring, compaction triggers,
 * and hook-based lifecycle events.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { EventEmitter } from 'events';
import { RunnerLifecycle, RunnerLifecycleDeps } from '../../../../src/core/orchestrator/runner-lifecycle';
import { HookRegistry } from '../../../../src/core/hooks/hook-registry';
import { HookExecutor } from '../../../../src/core/hooks/hook-executor';
import { HookEvent, HookAction, IHook, HookContext, HookResult, HookConfig } from '../../../../src/core/interfaces/hook.interface';
import { ServiceRegistry } from '../../../../src/core/services/service-registry';

// Mock the logger
jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

/**
 * Create a spy hook
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
    getConfig: (): HookConfig => ({ name, event, priority: 100, enabled }),
  };

  return { hook, calls };
}

/**
 * Create RunnerLifecycle with default mocked dependencies
 */
function createTestLifecycle(overrides?: Partial<RunnerLifecycleDeps>): {
  lifecycle: RunnerLifecycle;
  deps: RunnerLifecycleDeps;
} {
  const hookRegistry = new HookRegistry();
  const hookExecutor = new HookExecutor(hookRegistry);
  const emitter = new EventEmitter();

  const deps: RunnerLifecycleDeps = {
    hookRegistry,
    hookExecutor,
    emitter,
    config: {
      enableSession: false,
      enableContextManagement: false,
    },
    ...overrides,
  };

  return { lifecycle: new RunnerLifecycle(deps), deps };
}

describe('RunnerLifecycle', () => {
  afterEach(async () => {
    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch {
      // ignore
    }
    ServiceRegistry.resetInstance();
  });

  describe('constructor', () => {
    it('should create a RunnerLifecycle with valid dependencies', () => {
      const { lifecycle } = createTestLifecycle();
      expect(lifecycle).toBeDefined();
      expect(lifecycle).toBeInstanceOf(RunnerLifecycle);
    });

    it('should start with null session ID', () => {
      const { lifecycle } = createTestLifecycle();
      expect(lifecycle.getSessionId()).toBeNull();
    });
  });

  describe('startSession', () => {
    it('should do nothing when enableSession is false', async () => {
      const { lifecycle } = createTestLifecycle();
      await lifecycle.startSession();
      expect(lifecycle.getSessionId()).toBeNull();
    });

    it('should start a session when enableSession is true and SessionManager is available', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableSession: true });

      const { lifecycle } = createTestLifecycle({
        config: { enableSession: true, enableContextManagement: false },
      });

      await lifecycle.startSession();

      expect(lifecycle.getSessionId()).toBeTruthy();
    });

    it('should not fail when SessionManager is unavailable', async () => {
      const { lifecycle } = createTestLifecycle({
        config: { enableSession: true, enableContextManagement: false },
      });

      // No ServiceRegistry initialization
      await lifecycle.startSession();
      expect(lifecycle.getSessionId()).toBeNull();
    });
  });

  describe('endSession', () => {
    it('should do nothing when no session is active', async () => {
      const { lifecycle } = createTestLifecycle();
      await lifecycle.endSession();
      expect(lifecycle.getSessionId()).toBeNull();
    });

    it('should end an active session', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableSession: true });

      const { lifecycle } = createTestLifecycle({
        config: { enableSession: true, enableContextManagement: false },
      });

      await lifecycle.startSession();
      expect(lifecycle.getSessionId()).toBeTruthy();

      await lifecycle.endSession();
      expect(lifecycle.getSessionId()).toBeNull();
    });

    it('should not fail when SessionManager is unavailable during end', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableSession: true });

      const { lifecycle } = createTestLifecycle({
        config: { enableSession: true, enableContextManagement: false },
      });

      await lifecycle.startSession();
      const sessionId = lifecycle.getSessionId();
      expect(sessionId).toBeTruthy();

      // Dispose registry before ending session
      await registry.dispose();
      ServiceRegistry.resetInstance();

      await lifecycle.endSession();
      expect(lifecycle.getSessionId()).toBeNull();
    });
  });

  describe('wireContextMonitoring', () => {
    it('should do nothing when enableContextManagement is false', () => {
      const { lifecycle } = createTestLifecycle();
      lifecycle.wireContextMonitoring();
      // Should not throw
      expect(true).toBe(true);
    });

    it('should wire context event listeners when ContextManager is available', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const { lifecycle } = createTestLifecycle({
        config: { enableSession: false, enableContextManagement: true },
      });

      lifecycle.wireContextMonitoring();

      // Access internal handlers to verify
      const handlers = (lifecycle as any).contextEventHandlers;
      expect(handlers.length).toBe(2);
      expect(handlers[0].event).toBe('usage-warning');
      expect(handlers[1].event).toBe('usage-critical');
    });

    it('should emit context:warning when ContextManager fires usage-warning', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const { lifecycle, deps } = createTestLifecycle({
        config: { enableSession: false, enableContextManagement: true },
      });

      lifecycle.wireContextMonitoring();

      const events: string[] = [];
      deps.emitter.on('context:warning', () => events.push('warning'));

      const contextManager = registry.getContextManager()!;
      const maxTokens = (contextManager as any).tokenManager.getMaxTokens();
      contextManager.addTokens(Math.floor(maxTokens * 0.8));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(events).toContain('warning');
    });

    it('should not fail when ContextManager is unavailable', () => {
      const { lifecycle } = createTestLifecycle({
        config: { enableSession: false, enableContextManagement: true },
      });

      // No ServiceRegistry initialization
      lifecycle.wireContextMonitoring();
      // Should not throw
    });
  });

  describe('cleanupContextListeners', () => {
    it('should clean up registered listeners', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const { lifecycle } = createTestLifecycle({
        config: { enableSession: false, enableContextManagement: true },
      });

      lifecycle.wireContextMonitoring();
      expect((lifecycle as any).contextEventHandlers.length).toBe(2);

      lifecycle.cleanupContextListeners();
      expect((lifecycle as any).contextEventHandlers.length).toBe(0);
    });

    it('should not fail when no listeners are registered', () => {
      const { lifecycle } = createTestLifecycle();
      lifecycle.cleanupContextListeners();
      expect((lifecycle as any).contextEventHandlers.length).toBe(0);
    });

    it('should not fail when ContextManager is unavailable', () => {
      const { lifecycle } = createTestLifecycle({
        config: { enableSession: false, enableContextManagement: true },
      });

      // Add some dummy handlers
      (lifecycle as any).contextEventHandlers = [
        { event: 'usage-warning', handler: () => {} },
      ];

      lifecycle.cleanupContextListeners();
      // Should not throw (cleanup is best-effort)
    });
  });

  describe('triggerContextCompaction', () => {
    it('should fire CONTEXT_COMPACT hook when ContextManager is available', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const { lifecycle, deps } = createTestLifecycle({
        config: { enableSession: false, enableContextManagement: true },
      });

      const { hook, calls } = createSpyHook('compact-hook', HookEvent.CONTEXT_COMPACT);
      deps.hookRegistry.register(hook);

      await lifecycle.triggerContextCompaction();

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.CONTEXT_COMPACT);
      expect((calls[0].data as any).usage).toBeDefined();
    });

    it('should not fail when no hooks are registered', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const { lifecycle } = createTestLifecycle({
        config: { enableSession: false, enableContextManagement: true },
      });

      await lifecycle.triggerContextCompaction();
      // Should not throw
    });

    it('should not fail when ContextManager is unavailable', async () => {
      const { lifecycle } = createTestLifecycle();
      await lifecycle.triggerContextCompaction();
      // Should not throw
    });
  });

  describe('fireAgentStartedHook', () => {
    it('should fire AGENT_STARTED hook with agent count', async () => {
      const { lifecycle, deps } = createTestLifecycle();
      const { hook, calls } = createSpyHook('started-hook', HookEvent.AGENT_STARTED);
      deps.hookRegistry.register(hook);

      await lifecycle.fireAgentStartedHook(5);

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.AGENT_STARTED);
      expect((calls[0].data as any).agentCount).toBe(5);
    });

    it('should do nothing when no hooks are registered', async () => {
      const { lifecycle } = createTestLifecycle();
      await lifecycle.fireAgentStartedHook(3);
      // Should not throw
    });
  });

  describe('fireAgentStoppedHook', () => {
    it('should fire AGENT_STOPPED hook', async () => {
      const { lifecycle, deps } = createTestLifecycle();
      const { hook, calls } = createSpyHook('stopped-hook', HookEvent.AGENT_STOPPED);
      deps.hookRegistry.register(hook);

      await lifecycle.fireAgentStoppedHook({});

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.AGENT_STOPPED);
    });

    it('should pass data to hook', async () => {
      const { lifecycle, deps } = createTestLifecycle();
      const { hook, calls } = createSpyHook('stopped-hook', HookEvent.AGENT_STOPPED);
      deps.hookRegistry.register(hook);

      await lifecycle.fireAgentStoppedHook({ reason: 'destroy' });

      expect(calls.length).toBe(1);
      expect((calls[0].data as any).reason).toBe('destroy');
    });

    it('should not fail when hook execution throws', async () => {
      const { lifecycle, deps } = createTestLifecycle();
      const hook: IHook = {
        name: 'failing-hook',
        description: 'Hook that fails',
        event: HookEvent.AGENT_STOPPED,
        priority: 100,
        execute: jest.fn(async () => { throw new Error('Hook error'); }),
        shouldRun: jest.fn(() => true),
        enable: () => {},
        disable: () => {},
        isEnabled: () => true,
        getConfig: () => ({ name: 'failing-hook', event: HookEvent.AGENT_STOPPED, priority: 100, enabled: true }),
      };
      deps.hookRegistry.register(hook);

      await lifecycle.fireAgentStoppedHook({});
      // Should not throw due to .catch() in implementation
    });
  });
});
