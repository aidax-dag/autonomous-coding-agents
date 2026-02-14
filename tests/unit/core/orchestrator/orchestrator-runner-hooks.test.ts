/**
 * Orchestrator Runner Hook Integration Tests
 *
 * Tests that OrchestratorRunner correctly fires hook events at
 * agent lifecycle (AGENT_STARTED, AGENT_STOPPED) and
 * goal/workflow lifecycle (WORKFLOW_START, WORKFLOW_END, WORKFLOW_ERROR) points.
 *
 * Existing TASK_BEFORE / TASK_AFTER / TASK_ERROR hooks are NOT tested here —
 * they were already wired and validated before this change.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  OrchestratorRunner,
  RunnerStatus,
} from '../../../../src/core/orchestrator/orchestrator-runner';
import { createMockRunner } from '../../../../src/core/orchestrator/mock-runner';
import { HookEvent, HookAction, IHook, HookContext, HookResult, HookConfig } from '../../../../src/core/interfaces/hook.interface';
import { HookRegistry } from '../../../../src/core/hooks/hook-registry';

/**
 * Create a disposable temp directory for each test.
 */
function createTestWorkspace(): string {
  const dir = path.join(os.tmpdir(), `runner-hooks-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
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

describe('OrchestratorRunner – Hook Pipeline', () => {
  let testDir: string;
  let runner: OrchestratorRunner;

  beforeEach(() => {
    testDir = createTestWorkspace();
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
  });

  // -----------------------------------------------------------------------
  // Agent lifecycle hooks
  // -----------------------------------------------------------------------

  describe('Agent Lifecycle Hooks', () => {
    it('should fire AGENT_STARTED after successful start()', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      // Access private hookRegistry via cast to register spy hooks
      const registry = (runner as any).hookRegistry as HookRegistry;

      const { hook, calls } = createSpyHook('test-agent-started', HookEvent.AGENT_STARTED);
      registry.register(hook);

      await runner.start();

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.AGENT_STARTED);
      expect((calls[0].data as any).agentCount).toBeGreaterThanOrEqual(0);
    });

    it('should fire AGENT_STOPPED during stop()', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      const registry = (runner as any).hookRegistry as HookRegistry;

      const { hook, calls } = createSpyHook('test-agent-stopped', HookEvent.AGENT_STOPPED);
      registry.register(hook);

      await runner.start();
      await runner.stop();

      // AGENT_STOPPED is called from stop()
      const stoppedCalls = calls.filter(c => c.event === HookEvent.AGENT_STOPPED);
      expect(stoppedCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should fire AGENT_STOPPED during destroy()', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      const registry = (runner as any).hookRegistry as HookRegistry;

      const { hook, calls } = createSpyHook('test-agent-stopped-destroy', HookEvent.AGENT_STOPPED);
      registry.register(hook);

      await runner.start();
      await runner.destroy();

      // destroy() fires AGENT_STOPPED (with reason: 'destroy') and then calls stop()
      // which also fires AGENT_STOPPED — so at least one call
      const stoppedCalls = calls.filter(c => c.event === HookEvent.AGENT_STOPPED);
      expect(stoppedCalls.length).toBeGreaterThanOrEqual(1);

      // The first call should include reason: 'destroy'
      expect((stoppedCalls[0].data as any).reason).toBe('destroy');

      // Prevent afterEach from calling destroy again
      runner = undefined as any;
    });

    it('should not fire AGENT_STARTED hook when no hooks are registered', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      const executorSpy = jest.spyOn((runner as any).hookExecutor, 'executeHooks');

      await runner.start();

      // executeHooks should not be called for AGENT_STARTED when count is 0
      const agentStartedCalls = executorSpy.mock.calls.filter(
        (call) => call[0] === HookEvent.AGENT_STARTED,
      );
      expect(agentStartedCalls.length).toBe(0);
    });

    it('should not break start() when AGENT_STARTED hook throws', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      const registry = (runner as any).hookRegistry as HookRegistry;

      const failingHook: IHook = {
        name: 'failing-agent-started',
        description: 'Fails on purpose',
        event: HookEvent.AGENT_STARTED,
        priority: 100,
        execute: jest.fn(async () => { throw new Error('hook boom'); }),
        shouldRun: () => true,
        enable: () => {},
        disable: () => {},
        isEnabled: () => true,
        getConfig: () => ({ name: 'failing-agent-started', event: HookEvent.AGENT_STARTED, priority: 100, enabled: true }),
      };
      registry.register(failingHook);

      // start() should still succeed despite hook failure
      await runner.start();
      expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);
    });
  });

  // -----------------------------------------------------------------------
  // Workflow / Goal lifecycle hooks
  // -----------------------------------------------------------------------

  describe('Workflow Lifecycle Hooks (executeGoal)', () => {
    it('should fire WORKFLOW_START and WORKFLOW_END for a successful goal', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      const registry = (runner as any).hookRegistry as HookRegistry;

      const { hook: startHook, calls: startCalls } = createSpyHook('test-wf-start', HookEvent.WORKFLOW_START);
      const { hook: endHook, calls: endCalls } = createSpyHook('test-wf-end', HookEvent.WORKFLOW_END);

      registry.register(startHook);
      registry.register(endHook);

      await runner.start();

      await runner.executeGoal(
        'Hook Test Goal',
        'Test planning description for hook testing',
        { waitForCompletion: true },
      );

      // WORKFLOW_START should have been called once
      expect(startCalls.length).toBe(1);
      expect(startCalls[0].event).toBe(HookEvent.WORKFLOW_START);
      expect((startCalls[0].data as any).goal).toBe('Test planning description for hook testing');
      expect((startCalls[0].data as any).goalId).toBeDefined();
      expect((startCalls[0].data as any).tasks).toBeDefined();

      // WORKFLOW_END should have been called once
      expect(endCalls.length).toBe(1);
      expect(endCalls[0].event).toBe(HookEvent.WORKFLOW_END);
      expect((endCalls[0].data as any).goal).toBe('Test planning description for hook testing');
      expect((endCalls[0].data as any).results).toBeDefined();
      expect((endCalls[0].data as any).goalId).toBeDefined();
    });

    it('should fire WORKFLOW_ERROR when goal execution fails', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      const registry = (runner as any).hookRegistry as HookRegistry;

      const { hook: errorHook, calls: errorCalls } = createSpyHook('test-wf-error', HookEvent.WORKFLOW_ERROR);
      registry.register(errorHook);

      await runner.start();

      // Attach error listener to prevent Node EventEmitter "unhandled error" throw
      runner.on('error', () => { /* swallow */ });

      // Force submitGoal to throw by spying on the orchestrator
      const orchestrator = (runner as any).orchestrator;
      jest.spyOn(orchestrator, 'submitGoal').mockRejectedValueOnce(new Error('submit failed'));

      const failResult = await runner.executeGoal('Failing Goal', 'This will fail');

      // Goal returns a failure result instead of throwing
      expect(failResult.success).toBe(false);

      // WORKFLOW_ERROR should have been called
      expect(errorCalls.length).toBe(1);
      expect(errorCalls[0].event).toBe(HookEvent.WORKFLOW_ERROR);
      expect((errorCalls[0].data as any).goal).toBe('This will fail');
      expect((errorCalls[0].data as any).error).toBeDefined();
    });

    it('should not fire WORKFLOW_START/END when no hooks are registered', async () => {
      runner = createMockRunner({ workspaceDir: testDir });

      const executorSpy = jest.spyOn((runner as any).hookExecutor, 'executeHooks');

      await runner.start();
      await runner.executeGoal('No Hooks Goal', 'Test planning without hooks');

      const workflowCalls = executorSpy.mock.calls.filter(
        (call) =>
          call[0] === HookEvent.WORKFLOW_START ||
          call[0] === HookEvent.WORKFLOW_END,
      );
      expect(workflowCalls.length).toBe(0);
    });

    it('should not break goal execution when WORKFLOW_START hook throws', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      const registry = (runner as any).hookRegistry as HookRegistry;

      const failingHook: IHook = {
        name: 'failing-wf-start',
        description: 'Fails on purpose',
        event: HookEvent.WORKFLOW_START,
        priority: 100,
        execute: jest.fn(async () => { throw new Error('workflow hook boom'); }),
        shouldRun: () => true,
        enable: () => {},
        disable: () => {},
        isEnabled: () => true,
        getConfig: () => ({ name: 'failing-wf-start', event: HookEvent.WORKFLOW_START, priority: 100, enabled: true }),
      };
      registry.register(failingHook);

      await runner.start();

      // Goal execution should succeed despite WORKFLOW_START hook failure
      const result = await runner.executeGoal('Resilient Goal', 'Test planning description');
      expect(result.goalId).toBeDefined();
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('should not break goal execution when WORKFLOW_END hook throws', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      const registry = (runner as any).hookRegistry as HookRegistry;

      const failingHook: IHook = {
        name: 'failing-wf-end',
        description: 'Fails on purpose',
        event: HookEvent.WORKFLOW_END,
        priority: 100,
        execute: jest.fn(async () => { throw new Error('workflow end hook boom'); }),
        shouldRun: () => true,
        enable: () => {},
        disable: () => {},
        isEnabled: () => true,
        getConfig: () => ({ name: 'failing-wf-end', event: HookEvent.WORKFLOW_END, priority: 100, enabled: true }),
      };
      registry.register(failingHook);

      await runner.start();

      const result = await runner.executeGoal('End Hook Fail Goal', 'Test planning description');
      expect(result.goalId).toBeDefined();
    });

    it('should not break goal failure handling when WORKFLOW_ERROR hook throws', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      const registry = (runner as any).hookRegistry as HookRegistry;

      const failingHook: IHook = {
        name: 'failing-wf-error',
        description: 'Fails on purpose',
        event: HookEvent.WORKFLOW_ERROR,
        priority: 100,
        execute: jest.fn(async () => { throw new Error('error hook boom'); }),
        shouldRun: () => true,
        enable: () => {},
        disable: () => {},
        isEnabled: () => true,
        getConfig: () => ({ name: 'failing-wf-error', event: HookEvent.WORKFLOW_ERROR, priority: 100, enabled: true }),
      };
      registry.register(failingHook);

      await runner.start();

      // Attach error listener to prevent Node EventEmitter "unhandled error" throw
      runner.on('error', () => { /* swallow */ });

      // Force an error
      const orchestrator = (runner as any).orchestrator;
      jest.spyOn(orchestrator, 'submitGoal').mockRejectedValueOnce(new Error('submit failed'));

      const result = await runner.executeGoal('Error Hook Fail', 'This will fail');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Ordering: verify hooks fire in the expected sequence
  // -----------------------------------------------------------------------

  describe('Hook Ordering', () => {
    it('should fire hooks in order: AGENT_STARTED -> WORKFLOW_START -> WORKFLOW_END -> AGENT_STOPPED', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      const registry = (runner as any).hookRegistry as HookRegistry;

      const eventLog: string[] = [];

      function registerLogger(name: string, event: HookEvent): void {
        const hook: IHook = {
          name,
          description: `Logger for ${event}`,
          event,
          priority: 100,
          execute: jest.fn(async (ctx: HookContext): Promise<HookResult> => {
            eventLog.push(ctx.event);
            return { action: HookAction.CONTINUE };
          }),
          shouldRun: () => true,
          enable: () => {},
          disable: () => {},
          isEnabled: () => true,
          getConfig: () => ({ name, event, priority: 100, enabled: true }),
        };
        registry.register(hook);
      }

      registerLogger('log-agent-started', HookEvent.AGENT_STARTED);
      registerLogger('log-agent-stopped', HookEvent.AGENT_STOPPED);
      registerLogger('log-wf-start', HookEvent.WORKFLOW_START);
      registerLogger('log-wf-end', HookEvent.WORKFLOW_END);

      await runner.start();
      await runner.executeGoal('Ordering Test', 'Test planning for ordering');
      await runner.stop();

      expect(eventLog[0]).toBe(HookEvent.AGENT_STARTED);

      const wfStartIdx = eventLog.indexOf(HookEvent.WORKFLOW_START);
      const wfEndIdx = eventLog.indexOf(HookEvent.WORKFLOW_END);
      expect(wfStartIdx).toBeGreaterThan(0);
      expect(wfEndIdx).toBeGreaterThan(wfStartIdx);

      const lastStopped = eventLog.lastIndexOf(HookEvent.AGENT_STOPPED);
      expect(lastStopped).toBeGreaterThan(wfEndIdx);
    });
  });

  // -----------------------------------------------------------------------
  // Existing TASK_* hooks are NOT broken
  // -----------------------------------------------------------------------

  describe('Existing TASK hooks remain intact', () => {
    it('should still fire TASK_BEFORE and TASK_AFTER during goal execution', async () => {
      runner = createMockRunner({ workspaceDir: testDir });
      const registry = (runner as any).hookRegistry as HookRegistry;

      const { hook: beforeHook, calls: beforeCalls } = createSpyHook('test-task-before', HookEvent.TASK_BEFORE);
      const { hook: afterHook, calls: afterCalls } = createSpyHook('test-task-after', HookEvent.TASK_AFTER);

      registry.register(beforeHook);
      registry.register(afterHook);

      await runner.start();
      await runner.executeGoal('Task Hook Test', 'Test planning for task hooks');

      // executeGoal submits tasks, each of which fires TASK_BEFORE and TASK_AFTER
      expect(beforeCalls.length).toBeGreaterThan(0);
      expect(afterCalls.length).toBeGreaterThan(0);
    });
  });
});
