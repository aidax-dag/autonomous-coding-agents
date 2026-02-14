/**
 * TaskExecutor Unit Tests
 *
 * Tests the extracted TaskExecutor module independently from OrchestratorRunner.
 * Verifies task execution, hook pipeline, validation, error recovery, and learning lookups.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { EventEmitter } from 'events';
import { TaskExecutor, TaskExecutorDeps } from '../../../../src/core/orchestrator/task-executor';
import { RunnerStateManager } from '../../../../src/core/orchestrator/runner-state-manager';
import { ErrorEscalator, EscalationAction } from '../../../../src/core/orchestrator/error-escalator';
import { HookRegistry } from '../../../../src/core/hooks/hook-registry';
import { HookExecutor } from '../../../../src/core/hooks/hook-executor';
import { HookEvent, HookAction, IHook, HookContext, HookResult, HookConfig } from '../../../../src/core/interfaces/hook.interface';
import { ServiceRegistry } from '../../../../src/core/services/service-registry';
import type { TaskDocument } from '../../../../src/core/workspace/task-document';

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
 * Create a mock TaskDocument
 */
function createMockTask(overrides?: Partial<TaskDocument>): TaskDocument {
  return {
    content: 'Test task content',
    metadata: {
      id: `task-${Date.now()}`,
      title: 'Test Task',
      type: 'feature',
      from: 'orchestrator',
      to: 'development',
      priority: 'medium',
      status: 'pending',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...(overrides?.metadata || {}),
    },
    ...overrides,
  } as TaskDocument;
}

/**
 * Create a mock CEOOrchestrator with team support
 */
function createMockOrchestrator(processResult?: any) {
  const mockAgent = {
    processTask: jest.fn().mockResolvedValue(processResult ?? { success: true, result: 'done' }),
  };

  const teams = new Map();
  teams.set('development', mockAgent);
  teams.set('planning', mockAgent);
  teams.set('qa', mockAgent);

  return {
    teams: {
      get: (type: string) => teams.get(type),
      getAll: () => Array.from(teams.values()),
    },
  } as any;
}

/**
 * Create a spy hook that records invocations
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
 * Create TaskExecutor with default mocked dependencies
 */
function createTestExecutor(overrides?: Partial<TaskExecutorDeps>): {
  executor: TaskExecutor;
  deps: TaskExecutorDeps;
} {
  const hookRegistry = new HookRegistry();
  const hookExecutor = new HookExecutor(hookRegistry);
  const stateManager = new RunnerStateManager();
  const errorEscalator = new ErrorEscalator();
  const emitter = new EventEmitter();

  const deps: TaskExecutorDeps = {
    orchestrator: createMockOrchestrator(),
    hookRegistry,
    hookExecutor,
    stateManager,
    errorEscalator,
    emitter,
    telemetry: null,
    config: {
      enableValidation: false,
      minConfidenceThreshold: 70,
      enableLearning: false,
      enableErrorRecovery: false,
      maxRetries: 2,
    },
    ...overrides,
  };

  return { executor: new TaskExecutor(deps), deps };
}

describe('TaskExecutor', () => {
  afterEach(() => {
    try {
      ServiceRegistry.resetInstance();
    } catch {
      // ignore
    }
  });

  describe('constructor', () => {
    it('should create a TaskExecutor with valid dependencies', () => {
      const { executor } = createTestExecutor();
      expect(executor).toBeDefined();
      expect(executor).toBeInstanceOf(TaskExecutor);
    });
  });

  describe('executeTask', () => {
    it('should execute a task successfully and return a WorkflowResult', async () => {
      const { executor } = createTestExecutor();
      const task = createMockTask();

      const result = await executor.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.metadata.id);
      expect(result.teamType).toBe('development');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should emit workflow:started and workflow:completed events', async () => {
      const { executor, deps } = createTestExecutor();
      const task = createMockTask();
      const events: string[] = [];

      deps.emitter.on('workflow:started', () => events.push('started'));
      deps.emitter.on('workflow:completed', () => events.push('completed'));

      await executor.executeTask(task);

      expect(events).toContain('started');
      expect(events).toContain('completed');
    });

    it('should record result in state manager', async () => {
      const { executor, deps } = createTestExecutor();
      const task = createMockTask();

      await executor.executeTask(task);

      const recorded = deps.stateManager.getResult(task.metadata.id);
      expect(recorded).toBeDefined();
      expect(recorded!.success).toBe(true);
    });

    it('should record success in error escalator', async () => {
      const { executor, deps } = createTestExecutor();
      const task = createMockTask();
      const spy = jest.spyOn(deps.errorEscalator, 'recordSuccess');

      await executor.executeTask(task);

      expect(spy).toHaveBeenCalledWith(task.metadata.id);
    });

    it('should handle task failure gracefully', async () => {
      const orchestrator = createMockOrchestrator();
      const agent = orchestrator.teams.get('development');
      agent.processTask.mockRejectedValue(new Error('Agent failure'));

      const { executor, deps } = createTestExecutor({ orchestrator });
      const task = createMockTask();

      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Agent failure');
    });

    it('should throw AgentError when team is not registered', async () => {
      const { executor } = createTestExecutor();
      const task = createMockTask({
        metadata: {
          id: 'test-1',
          title: 'Test',
          type: 'feature',
          from: 'orchestrator',
          to: 'nonexistent' as any,
          priority: 'medium',
          status: 'pending',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any);

      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No team registered for type');
    });

    it('should return task result including result data', async () => {
      const orchestrator = createMockOrchestrator({ success: true, result: { code: 'generated' } });
      const { executor } = createTestExecutor({ orchestrator });
      const task = createMockTask();

      const result = await executor.executeTask(task);

      expect(result.result).toEqual({ code: 'generated' });
    });
  });

  describe('hooks', () => {
    it('should execute TASK_BEFORE hooks', async () => {
      const { executor, deps } = createTestExecutor();
      const { hook, calls } = createSpyHook('before-hook', HookEvent.TASK_BEFORE);
      deps.hookRegistry.register(hook);

      const task = createMockTask();
      await executor.executeTask(task);

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.TASK_BEFORE);
    });

    it('should abort task when TASK_BEFORE hook returns ABORT', async () => {
      const { executor, deps } = createTestExecutor();
      const { hook } = createSpyHook('abort-hook', HookEvent.TASK_BEFORE, { action: HookAction.ABORT });
      deps.hookRegistry.register(hook);

      const task = createMockTask();
      const result = await executor.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Blocked by validation');
    });

    it('should execute TASK_AFTER hooks on success', async () => {
      const { executor, deps } = createTestExecutor();
      const { hook, calls } = createSpyHook('after-hook', HookEvent.TASK_AFTER);
      deps.hookRegistry.register(hook);

      const task = createMockTask();
      await executor.executeTask(task);

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.TASK_AFTER);
    });

    it('should execute TASK_ERROR hooks on failure', async () => {
      const orchestrator = createMockOrchestrator();
      const agent = orchestrator.teams.get('development');
      agent.processTask.mockRejectedValue(new Error('fail'));

      const { executor, deps } = createTestExecutor({ orchestrator });
      const { hook, calls } = createSpyHook('error-hook', HookEvent.TASK_ERROR);
      deps.hookRegistry.register(hook);

      const task = createMockTask();
      await executor.executeTask(task);

      expect(calls.length).toBe(1);
      expect(calls[0].event).toBe(HookEvent.TASK_ERROR);
    });
  });

  describe('validateTaskResult', () => {
    it('should return null when no ConfidenceChecker is available', async () => {
      const { executor } = createTestExecutor();
      const task = createMockTask();

      const result = await executor.validateTaskResult(task, {
        success: true,
        taskId: task.metadata.id,
        duration: 100,
        teamType: 'development',
      });

      expect(result).toBeNull();
    });

    it('should return validation result when ConfidenceChecker is available', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableValidation: true });

      const { executor } = createTestExecutor();
      const task = createMockTask();

      const result = await executor.validateTaskResult(task, {
        success: true,
        taskId: task.metadata.id,
        duration: 100,
        teamType: 'development',
      });

      // ConfidenceChecker returns a result (may pass or fail based on defaults)
      expect(result).toBeDefined();
      if (result) {
        expect(typeof result.confidence).toBe('number');
        expect(typeof result.passed).toBe('boolean');
        expect(['proceed', 'alternatives', 'stop']).toContain(result.recommendation);
      }
    });
  });

  describe('verifyGoal', () => {
    it('should return undefined when no GoalBackwardVerifier is available', async () => {
      const { executor } = createTestExecutor();
      const tasks = [createMockTask()];

      const result = await executor.verifyGoal('goal description', tasks);

      expect(result).toBeUndefined();
    });

    it('should return undefined when tasks have no files', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableValidation: true });

      const { executor } = createTestExecutor();
      const tasks = [createMockTask()];

      const result = await executor.verifyGoal('goal description', tasks);

      expect(result).toBeUndefined();
    });
  });

  describe('checkContextBudget', () => {
    it('should not emit when context manager is unavailable', () => {
      const { executor, deps } = createTestExecutor();
      const events: string[] = [];
      deps.emitter.on('context:budget-warning', () => events.push('warning'));

      executor.checkContextBudget('test-task');

      expect(events.length).toBe(0);
    });

    it('should emit context:budget-warning when utilization exceeds 95%', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const { executor, deps } = createTestExecutor();
      const events: Array<{ taskId: string; utilization: number }> = [];
      deps.emitter.on('context:budget-warning', (info: any) => events.push(info));

      // Push context past 95%
      const contextManager = registry.getContextManager()!;
      const maxTokens = (contextManager as any).tokenManager.getMaxTokens();
      contextManager.addTokens(Math.floor(maxTokens * 0.96));

      executor.checkContextBudget('test-task');

      expect(events.length).toBe(1);
      expect(events[0].utilization).toBeGreaterThan(95);
    });
  });

  describe('trackContextTokens', () => {
    it('should not fail when context manager is unavailable', () => {
      const { executor } = createTestExecutor();

      // Should not throw
      executor.trackContextTokens('test-task', { success: true, result: 'done' });
    });

    it('should track tokens when result contains tokensUsed', async () => {
      const registry = ServiceRegistry.getInstance();
      await registry.initialize({ enableContext: true });

      const { executor } = createTestExecutor();
      const contextManager = registry.getContextManager()!;
      const before = contextManager.getUsageStats().used;

      executor.trackContextTokens('test-task', { success: true, result: 'done', tokensUsed: 500 } as any);

      const after = contextManager.getUsageStats().used;
      expect(after).toBe(before + 500);
    });
  });

  describe('handleTaskError', () => {
    it('should return null for IGNORE action (fall through to caller)', async () => {
      const { executor, deps } = createTestExecutor();
      const task = createMockTask();

      // Force escalator to return IGNORE which falls through to null
      jest.spyOn(deps.errorEscalator, 'handleError').mockReturnValue(EscalationAction.IGNORE);

      const result = await executor.handleTaskError(task, new Error('test'), Date.now());

      expect(result).toBeNull();
    });

    it('should retry and return success when default action is RETRY', async () => {
      const { executor } = createTestExecutor();
      const task = createMockTask();

      const result = await executor.handleTaskError(task, new Error('transient'), Date.now());

      // Default escalation is RETRY; the mock processTask succeeds, so result is success
      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
    });

    it('should emit error:escalated for FAIL_TASK action', async () => {
      const { executor, deps } = createTestExecutor();
      const task = createMockTask();
      const events: any[] = [];
      deps.emitter.on('error:escalated', (info: any) => events.push(info));

      // Force escalator to return FAIL_TASK
      jest.spyOn(deps.errorEscalator, 'handleError').mockReturnValue(EscalationAction.FAIL_TASK);

      const result = await executor.handleTaskError(task, new Error('test'), Date.now());

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(events.length).toBeGreaterThan(0);
    });
  });
});
