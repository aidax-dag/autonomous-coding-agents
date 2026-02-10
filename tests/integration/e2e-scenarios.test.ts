/**
 * E2E Scenario Tests — Full Pipeline Flows
 *
 * Tests end-to-end scenarios that exercise the full pipeline
 * from entry point to result, verifying that all layers compose
 * correctly under realistic usage patterns.
 *
 * Scenarios:
 * 1. OrchestratorRunner: start → submit → execute → result
 * 2. Deep Worker full autonomy cycle
 * 3. Skill composition pipeline with real skills
 * 4. ACP full task lifecycle (submit → status → result)
 * 5. Hook-guarded pipeline execution
 * 6. HUD monitoring during pipeline execution
 * 7. Checkpoint-based task recovery
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// ── Pipeline entry ──────────────────────────────────────
import { createMockRunner } from '@/core/orchestrator/mock-runner';
import { RunnerStatus, type GoalResult } from '@/core/orchestrator/orchestrator-runner';
import { ServiceRegistry } from '@/core/services/service-registry';

// ── Hook system ─────────────────────────────────────────
import { HookRegistry } from '@/core/hooks/hook-registry';
import { HookExecutor } from '@/core/hooks/hook-executor';
import { HookEvent, HookAction, type IHook, type HookContext } from '@/core/interfaces/hook.interface';

// ── Deep Worker ─────────────────────────────────────────
import {
  createDeepWorker,
  createPreExploration,
  createSelfPlanning,
  createRetryStrategy,
  createTodoContinuationEnforcer,
} from '@/core/deep-worker';

// ── Skills ──────────────────────────────────────────────
import {
  createSkillRegistry,
  createSkillPipeline,
  type SkillContext,
  type ISkill,
  type SkillResult,
} from '@/core/skills';

// ── ACP + API Gateway ───────────────────────────────────
import {
  createACPMessageBus,
  createACPMessage,
  type TaskResultPayload,
  type TaskStatusPayload,
} from '@/core/protocols';
import { createAPIGateway, type GatewayEvent } from '@/api/gateway';

// ── Checkpoint ──────────────────────────────────────────
import { createCheckpointManager } from '@/core/checkpoint';
import type { CompletedStep } from '@/core/checkpoint';

// ── HUD ─────────────────────────────────────────────────
import {
  createMetricsCollector,
  createHUDDashboard,
} from '@/core/hud';

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function makeTestHook(
  overrides: Partial<IHook> & { name: string; event: HookEvent },
): IHook {
  let enabled = true;
  return {
    name: overrides.name,
    description: overrides.description ?? `Test hook: ${overrides.name}`,
    event: overrides.event,
    priority: overrides.priority ?? 10,
    execute: overrides.execute ?? (async () => ({ action: HookAction.CONTINUE })),
    shouldRun: overrides.shouldRun ?? (() => true),
    enable: () => { enabled = true; },
    disable: () => { enabled = false; },
    isEnabled: () => enabled,
    getConfig: () => ({
      name: overrides.name,
      event: overrides.event,
      priority: overrides.priority ?? 10,
      enabled,
    }),
  };
}

function makeTestSkill(
  name: string,
  handler: (input: unknown, ctx: SkillContext) => Promise<SkillResult>,
  tags: string[] = [],
): ISkill {
  return {
    name,
    description: `Test skill: ${name}`,
    tags,
    version: '1.0.0',
    execute: handler,
  };
}

// ═══════════════════════════════════════════════════════════
// 1. OrchestratorRunner Full E2E
// ═══════════════════════════════════════════════════════════

describe('E2E: OrchestratorRunner Pipeline', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `e2e-runner-${Date.now()}`);
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

  it('should start, submit a goal, execute tasks, and stop', async () => {
    const runner = createMockRunner({ workspaceDir });
    const events: string[] = [];

    runner.on('started', () => events.push('started'));
    runner.on('stopped', () => events.push('stopped'));
    runner.on('workflow:started', () => events.push('workflow:started'));
    runner.on('workflow:completed', () => events.push('workflow:completed'));
    runner.on('goal:started', () => events.push('goal:started'));
    runner.on('goal:completed', () => events.push('goal:completed'));

    // Start
    await runner.start();
    expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);
    expect(events).toContain('started');

    // Execute goal
    const goalResult = await runner.executeGoal(
      'Add login feature',
      'Implement user authentication with JWT',
    );

    expect(goalResult.success).toBeDefined();
    expect(goalResult.goalId).toBeTruthy();
    expect(goalResult.totalDuration).toBeGreaterThanOrEqual(0);
    expect(events).toContain('goal:started');
    expect(events).toContain('goal:completed');

    // Stats should reflect execution
    const stats = runner.getStats();
    expect(stats.status).toBe(RunnerStatus.RUNNING);
    expect(stats.uptime).toBeGreaterThan(0);

    // Stop
    await runner.destroy();
    expect(events).toContain('stopped');
  });

  it('should execute multiple goals sequentially', async () => {
    const runner = createMockRunner({ workspaceDir });
    await runner.start();

    const results: GoalResult[] = [];

    results.push(await runner.executeGoal('Goal 1', 'First goal'));
    results.push(await runner.executeGoal('Goal 2', 'Second goal'));
    results.push(await runner.executeGoal('Goal 3', 'Third goal'));

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.goalId).toBeTruthy();
    }

    await runner.destroy();
  });

  it('should pause and resume execution', async () => {
    const runner = createMockRunner({ workspaceDir });
    await runner.start();

    await runner.pause();
    expect(runner.currentStatus).toBe(RunnerStatus.PAUSED);

    await runner.resume();
    expect(runner.currentStatus).toBe(RunnerStatus.RUNNING);

    await runner.destroy();
  });

  it('should reject goal execution when not running', async () => {
    const runner = createMockRunner({ workspaceDir });

    await expect(
      runner.executeGoal('Test', 'Should fail'),
    ).rejects.toThrow('not running');
  });

  it('should submit task to a specific team', async () => {
    const runner = createMockRunner({ workspaceDir });
    await runner.start();

    const task = await runner.submitToTeam(
      'development',
      'Implement auth module',
      'Create JWT authentication',
      { priority: 'high', tags: ['auth'] },
    );

    expect(task).toBeDefined();
    expect(task.metadata.to).toBe('development');
    expect(task.metadata.priority).toBe('high');

    await runner.destroy();
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Deep Worker Full Autonomy Cycle
// ═══════════════════════════════════════════════════════════

describe('E2E: Deep Worker Autonomy Cycle', () => {
  it('should complete explore → plan → execute → verify cycle', async () => {
    const executionLog: string[] = [];

    const exploration = createPreExploration({
      executor: async (ctx) => {
        executionLog.push('explore');
        return {
          relevantFiles: [`${ctx.workspaceDir}/src/main.ts`, `${ctx.workspaceDir}/src/auth.ts`],
          patterns: ['factory-pattern', 'singleton'],
          dependencies: ['express', 'jsonwebtoken'],
          summary: 'Found auth module with factory patterns',
          duration: 15,
        };
      },
    });

    const planning = createSelfPlanning({
      executor: async (ctx, explResult) => {
        executionLog.push('plan');
        return {
          steps: [
            { id: 'read', description: `Read ${explResult.relevantFiles.length} files`, type: 'explore' as const, dependencies: [], effort: 'small' as const, completed: false },
            { id: 'impl', description: 'Implement auth middleware', type: 'implement' as const, dependencies: ['read'], effort: 'medium' as const, completed: false },
            { id: 'test', description: 'Write auth tests', type: 'test' as const, dependencies: ['impl'], effort: 'small' as const, completed: false },
            { id: 'review', description: 'Self-review changes', type: 'review' as const, dependencies: ['test'], effort: 'small' as const, completed: false },
          ],
          summary: `Planned ${ctx.taskDescription} in 4 steps`,
          totalEffort: 'medium' as const,
          duration: 8,
        };
      },
    });

    const retry = createRetryStrategy({ maxRetries: 2 });
    const continuation = createTodoContinuationEnforcer();

    const worker = createDeepWorker({
      name: 'e2e-worker',
      exploration,
      planning,
      retry,
      continuation,
      stepExecutor: async (stepId, _stepDesc) => {
        executionLog.push(`exec:${stepId}`);
      },
    });

    const result = await worker.execute({
      workspaceDir: '/tmp/test-project',
      taskDescription: 'Add JWT authentication',
      maxRetries: 2,
    });

    // Verify full cycle
    expect(result.success).toBe(true);
    expect(result.exploration.relevantFiles).toHaveLength(2);
    expect(result.plan.steps).toHaveLength(4);
    expect(result.todoStatus.completedSteps).toBe(4);
    expect(result.todoStatus.failedSteps).toBe(0);
    expect(result.todoStatus.allComplete).toBe(true);
    expect(result.duration).toBeGreaterThanOrEqual(0);

    // Verify execution order
    expect(executionLog).toEqual([
      'explore', 'plan',
      'exec:read', 'exec:impl', 'exec:test', 'exec:review',
    ]);
  });

  it('should handle partial failure with dependency blocking', async () => {
    const planning = createSelfPlanning({
      executor: async () => ({
        steps: [
          { id: 'a', description: 'Step A', type: 'implement' as const, dependencies: [], effort: 'small' as const, completed: false },
          { id: 'b', description: 'Step B (depends on A)', type: 'implement' as const, dependencies: ['a'], effort: 'small' as const, completed: false },
          { id: 'c', description: 'Step C (independent)', type: 'test' as const, dependencies: [], effort: 'small' as const, completed: false },
        ],
        summary: 'Three-step plan with deps',
        totalEffort: 'small' as const,
        duration: 3,
      }),
    });

    let callCount = 0;
    const worker = createDeepWorker({
      name: 'partial-fail-worker',
      exploration: createPreExploration({
        executor: async () => ({
          relevantFiles: [], patterns: [], dependencies: [],
          summary: 'Empty', duration: 1,
        }),
      }),
      planning,
      retry: createRetryStrategy({ maxRetries: 0 }),
      continuation: createTodoContinuationEnforcer(),
      stepExecutor: async (stepId) => {
        callCount++;
        if (stepId === 'a') {
          throw new Error('Step A failed');
        }
      },
    });

    const result = await worker.execute({
      workspaceDir: '/tmp',
      taskDescription: 'Test partial failure',
      maxRetries: 0,
    });

    expect(result.success).toBe(false);
    expect(result.todoStatus.failedSteps).toBeGreaterThanOrEqual(1);
    // Step B should be blocked because A failed (its dependency)
    // Step C is independent and should still execute
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Skill Composition Pipeline
// ═══════════════════════════════════════════════════════════

describe('E2E: Skill Composition Pipeline', () => {
  it('should execute a multi-skill pipeline with data flowing between steps', async () => {
    const registry = createSkillRegistry();
    const pipelineLog: string[] = [];

    // Stage 1: Analyze code
    registry.register(makeTestSkill('analyze', async (input) => {
      pipelineLog.push('analyze');
      const data = input as Record<string, unknown>;
      return {
        success: true,
        output: {
          ...data,
          issues: ['missing-types', 'no-tests'],
          complexity: 'medium',
        },
        duration: 50,
      };
    }, ['analysis']));

    // Stage 2: Generate fix plan
    registry.register(makeTestSkill('plan-fixes', async (input) => {
      pipelineLog.push('plan-fixes');
      const data = input as Record<string, unknown>;
      const issues = (data.issues as string[]) ?? [];
      return {
        success: true,
        output: {
          ...data,
          fixPlan: issues.map((i) => `Fix: ${i}`),
          estimated: issues.length * 30,
        },
        duration: 30,
      };
    }, ['planning']));

    // Stage 3: Apply fixes
    registry.register(makeTestSkill('apply-fixes', async (input) => {
      pipelineLog.push('apply-fixes');
      const data = input as Record<string, unknown>;
      const plan = (data.fixPlan as string[]) ?? [];
      return {
        success: true,
        output: {
          ...data,
          applied: plan.length,
          filesModified: ['src/main.ts', 'tests/main.test.ts'],
        },
        duration: 100,
      };
    }, ['implementation']));

    // Stage 4: Validate results
    registry.register(makeTestSkill('validate', async (input) => {
      pipelineLog.push('validate');
      const data = input as Record<string, unknown>;
      return {
        success: true,
        output: {
          ...data,
          validated: true,
          score: 95,
        },
        duration: 20,
      };
    }, ['validation']));

    const pipeline = createSkillPipeline({
      name: 'code-improvement-pipeline',
      registry,
    });
    pipeline
      .addStep('analyze')
      .addStep('plan-fixes')
      .addStep('apply-fixes')
      .addStep('validate');

    // Validate pipeline before execution
    const validation = pipeline.validate();
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    // Execute
    const result = await pipeline.execute(
      { sourceFile: 'src/main.ts' },
      { workspaceDir: '/tmp' },
    );

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(4);
    expect(result.steps.every((s) => s.success)).toBe(true);
    expect(pipelineLog).toEqual(['analyze', 'plan-fixes', 'apply-fixes', 'validate']);

    // Check data flow through pipeline
    const finalOutput = result.finalOutput as Record<string, unknown>;
    expect(finalOutput.sourceFile).toBe('src/main.ts');
    expect(finalOutput.issues).toEqual(['missing-types', 'no-tests']);
    expect(finalOutput.applied).toBe(2);
    expect(finalOutput.validated).toBe(true);
    expect(finalOutput.score).toBe(95);
  });

  it('should handle conditional steps and fallbacks', async () => {
    const registry = createSkillRegistry();

    registry.register(makeTestSkill('check-types', async (input) => {
      return { success: true, output: { ...(input as object), hasTypes: false }, duration: 10 };
    }));

    registry.register(makeTestSkill('add-types', async (input) => {
      return { success: true, output: { ...(input as object), typesAdded: true }, duration: 20 };
    }));

    registry.register(makeTestSkill('skip-types', async (input) => {
      return { success: true, output: { ...(input as object), typesSkipped: true }, duration: 5 };
    }));

    const pipeline = createSkillPipeline({ name: 'conditional', registry });
    pipeline
      .addStep('check-types')
      .addStep('add-types', {
        condition: (prev: unknown) => (prev as Record<string, unknown>).hasTypes === false,
      })
      .addStep('skip-types', {
        condition: (prev: unknown) => (prev as Record<string, unknown>).hasTypes === true,
      });

    const result = await pipeline.execute({}, { workspaceDir: '/tmp' });

    expect(result.success).toBe(true);
    // add-types should run (condition true: hasTypes=false)
    // skip-types should be skipped (condition false: hasTypes is still false after add-types)
    const addStep = result.steps.find((s) => s.skillName === 'add-types');
    expect(addStep?.success).toBe(true);
    expect(addStep?.skipped).toBeUndefined();
  });

  it('should use fallback skill when primary fails', async () => {
    const registry = createSkillRegistry();

    registry.register(makeTestSkill('primary-lint', async () => {
      return { success: false, error: 'Linter crashed', duration: 5 };
    }));

    registry.register(makeTestSkill('backup-lint', async (input) => {
      return { success: true, output: { ...(input as object), linted: true }, duration: 10 };
    }));

    const pipeline = createSkillPipeline({
      name: 'fallback-test',
      registry,
      stopOnFailure: true,
    });
    pipeline.addStep('primary-lint', { fallback: 'backup-lint' });

    const result = await pipeline.execute({}, { workspaceDir: '/tmp' });

    expect(result.success).toBe(true);
    expect(result.steps[0].skillName).toContain('backup-lint');
  });
});

// ═══════════════════════════════════════════════════════════
// 4. ACP Full Task Lifecycle
// ═══════════════════════════════════════════════════════════

describe('E2E: ACP Full Task Lifecycle', () => {
  it('should complete submit → in-progress → completed lifecycle', async () => {
    const bus = createACPMessageBus();
    const gateway = createAPIGateway({ messageBus: bus });
    const lifecycle: string[] = [];

    // Track gateway events
    gateway.onEvent((evt) => lifecycle.push(evt.type));

    // Simulate an orchestrator that processes tasks
    bus.on('task:submit', async (msg) => {
      const taskId = msg.metadata?.taskId as string;

      // Phase 1: Accept and report in-progress
      await bus.publish(createACPMessage({
        type: 'task:status',
        source: 'orchestrator',
        target: 'broadcast',
        payload: {
          taskId,
          status: 'running',
          progress: 0,
          message: 'Task accepted',
        } as TaskStatusPayload,
      }));

      // Phase 2: Progress update
      await bus.publish(createACPMessage({
        type: 'task:status',
        source: 'orchestrator',
        target: 'broadcast',
        payload: {
          taskId,
          status: 'running',
          progress: 50,
          message: 'Halfway done',
        } as TaskStatusPayload,
      }));

      // Phase 3: Complete
      await bus.publish(createACPMessage({
        type: 'task:result',
        source: 'orchestrator',
        target: msg.source,
        payload: {
          taskId,
          success: true,
          result: { output: 'Auth module implemented' },
          duration: 5000,
        } as TaskResultPayload,
      }));
    });

    // Track status updates
    const statusUpdates: TaskStatusPayload[] = [];
    bus.on('task:status', async (msg) => {
      statusUpdates.push(msg.payload as TaskStatusPayload);
    });

    // Submit task
    const response = await gateway.submitTask({
      description: 'Implement auth module',
      targetTeam: 'orchestrator',
    });

    expect(response.status).toBe('accepted');

    // Wait for async propagation
    await new Promise((r) => setTimeout(r, 100));

    // Verify lifecycle
    expect(lifecycle).toContain('task:completed');
    expect(statusUpdates).toHaveLength(2);
    expect(statusUpdates[0].status).toBe('running');
    expect(statusUpdates[0].progress).toBe(0);
    expect(statusUpdates[1].progress).toBe(50);
  });

  it('should handle task failure in full lifecycle', async () => {
    const bus = createACPMessageBus();
    const gateway = createAPIGateway({ messageBus: bus });
    const events: GatewayEvent[] = [];
    gateway.onEvent((evt) => events.push(evt));

    // Orchestrator that fails tasks
    bus.on('task:submit', async (msg) => {
      const taskId = msg.metadata?.taskId as string;

      await bus.publish(createACPMessage({
        type: 'task:result',
        source: 'orchestrator',
        target: msg.source,
        payload: {
          taskId,
          success: false,
          error: 'Compilation error in auth module',
          duration: 2000,
        } as TaskResultPayload,
      }));
    });

    await gateway.submitTask({ description: 'Bad task' });

    await new Promise((r) => setTimeout(r, 50));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task:failed');
  });

  it('should support multiple concurrent task submissions', async () => {
    const bus = createACPMessageBus();
    const gateway = createAPIGateway({ messageBus: bus });

    const completedTasks: string[] = [];

    bus.on('task:submit', async (msg) => {
      const taskId = msg.metadata?.taskId as string;
      // Simulate variable processing time
      await new Promise((r) => setTimeout(r, Math.random() * 20));
      await bus.publish(createACPMessage({
        type: 'task:result',
        source: 'orchestrator',
        target: msg.source,
        payload: {
          taskId,
          success: true,
          duration: 1000,
        } as TaskResultPayload,
      }));
      completedTasks.push(taskId);
    });

    // Submit 5 tasks concurrently
    const submissions = await Promise.all([
      gateway.submitTask({ description: 'Task A' }),
      gateway.submitTask({ description: 'Task B' }),
      gateway.submitTask({ description: 'Task C' }),
      gateway.submitTask({ description: 'Task D' }),
      gateway.submitTask({ description: 'Task E' }),
    ]);

    expect(submissions).toHaveLength(5);
    expect(submissions.every((s) => s.status === 'accepted')).toBe(true);

    // Wait for all completions
    await new Promise((r) => setTimeout(r, 100));
    expect(completedTasks).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. Hook-Guarded Pipeline Execution
// ═══════════════════════════════════════════════════════════

describe('E2E: Hook-Guarded Pipeline', () => {
  it('should execute full task lifecycle with before/after/error hooks', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);
    const hookLog: string[] = [];

    // Validation hook (TASK_BEFORE)
    hookRegistry.register(makeTestHook({
      name: 'input-validator',
      event: HookEvent.TASK_BEFORE,
      priority: 100,
      execute: async (ctx: HookContext) => {
        hookLog.push('validate-input');
        const data = ctx.data as Record<string, unknown>;
        if (!data.description) {
          return { action: HookAction.ABORT, message: 'Missing description' };
        }
        return { action: HookAction.CONTINUE };
      },
    }));

    // Confidence check hook (TASK_BEFORE)
    hookRegistry.register(makeTestHook({
      name: 'confidence-gate',
      event: HookEvent.TASK_BEFORE,
      priority: 50,
      execute: async () => {
        hookLog.push('confidence-check');
        return { action: HookAction.CONTINUE, metadata: { confidence: 0.85 } };
      },
    }));

    // Post-execution analytics hook (TASK_AFTER)
    hookRegistry.register(makeTestHook({
      name: 'analytics',
      event: HookEvent.TASK_AFTER,
      priority: 10,
      execute: async (_ctx: HookContext) => {
        hookLog.push('analytics');
        return {
          action: HookAction.CONTINUE,
          metadata: { recorded: true },
        };
      },
    }));

    // Error recovery hook (TASK_ERROR)
    hookRegistry.register(makeTestHook({
      name: 'error-recovery',
      event: HookEvent.TASK_ERROR,
      priority: 100,
      execute: async () => {
        hookLog.push('error-recovery');
        return { action: HookAction.RETRY, message: 'Suggesting retry' };
      },
    }));

    // Simulate task lifecycle

    // 1. TASK_BEFORE — validation passes
    const beforeResults = await executor.executeHooks(
      HookEvent.TASK_BEFORE,
      { description: 'Implement auth', taskId: 'task-1' },
    );
    const aborted = beforeResults.find((r) => r.action === HookAction.ABORT);
    expect(aborted).toBeUndefined();

    // 2. Execute task (simulated)
    hookLog.push('task-execute');

    // 3. TASK_AFTER
    await executor.executeHooks(
      HookEvent.TASK_AFTER,
      { taskId: 'task-1', result: { success: true } },
    );

    // Verify hook execution order
    expect(hookLog).toEqual([
      'validate-input',
      'confidence-check',
      'task-execute',
      'analytics',
    ]);
  });

  it('should abort task when validation hook rejects', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);

    hookRegistry.register(makeTestHook({
      name: 'strict-validator',
      event: HookEvent.TASK_BEFORE,
      priority: 100,
      execute: async (ctx: HookContext) => {
        const data = ctx.data as Record<string, unknown>;
        if ((data.confidence as number) < 0.5) {
          return { action: HookAction.ABORT, message: 'Confidence too low' };
        }
        return { action: HookAction.CONTINUE };
      },
    }));

    const results = await executor.executeHooks(
      HookEvent.TASK_BEFORE,
      { confidence: 0.2, taskId: 'risky-task' },
    );

    expect(results[0].action).toBe(HookAction.ABORT);
    expect(results[0].message).toBe('Confidence too low');
  });

  it('should use executeUntilAction for early termination', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);

    hookRegistry.register(makeTestHook({
      name: 'first-check',
      event: HookEvent.TASK_BEFORE,
      priority: 100,
      execute: async () => ({ action: HookAction.CONTINUE }),
    }));

    hookRegistry.register(makeTestHook({
      name: 'abort-check',
      event: HookEvent.TASK_BEFORE,
      priority: 50,
      execute: async () => ({ action: HookAction.ABORT, message: 'Stopped' }),
    }));

    const result = await executor.executeUntilAction(
      HookEvent.TASK_BEFORE,
      {},
      HookAction.ABORT,
    );

    expect(result).toBeDefined();
    expect(result?.action).toBe(HookAction.ABORT);
    expect(result?.message).toBe('Stopped');
  });
});

// ═══════════════════════════════════════════════════════════
// 6. HUD Monitoring During Pipeline Execution
// ═══════════════════════════════════════════════════════════

describe('E2E: HUD Monitoring During Execution', () => {
  it('should track full pipeline execution in HUD', async () => {
    const metrics = createMetricsCollector({ maxPoints: 500 });
    const hud = createHUDDashboard({ metrics, maxWarnings: 20 });

    // Simulate a full pipeline execution with HUD monitoring
    const phases = ['initializing', 'exploring', 'planning', 'implementing', 'testing', 'completed'] as const;
    const stateMap: Record<string, 'idle' | 'working' | 'completed' | 'error'> = {
      initializing: 'idle',
      exploring: 'working',
      planning: 'working',
      implementing: 'working',
      testing: 'working',
      completed: 'completed',
    };

    for (const phase of phases) {
      hud.updateAgent({
        agentId: 'deep-worker-1',
        agentType: 'deep-worker',
        state: stateMap[phase],
        progress: Math.round((phases.indexOf(phase) / (phases.length - 1)) * 100),
        tokensUsed: phases.indexOf(phase) * 1000,
        elapsedMs: phases.indexOf(phase) * 5000,
        updatedAt: new Date().toISOString(),
      });

      // Record metrics at each phase
      metrics.recordValue('phase-duration', Math.random() * 100, 'ms');
      metrics.recordValue('tokens-used', phases.indexOf(phase) * 1000, 'tokens');
    }

    // Final snapshot
    const snap = hud.snapshot();
    expect(snap.agents).toHaveLength(1);
    expect(snap.agents[0].state).toBe('completed');
    expect(snap.agents[0].progress).toBe(100);
    expect(snap.metrics.length).toBeGreaterThan(0);
    expect(snap.systemHealth).toBe(100); // No errors
  });

  it('should degrade health when worker errors during execution', () => {
    const metrics = createMetricsCollector();
    const hud = createHUDDashboard({ metrics });

    // Worker 1 working normally
    hud.updateAgent({
      agentId: 'w1', agentType: 'worker', state: 'working',
      progress: 50, tokensUsed: 1000, elapsedMs: 5000,
      updatedAt: new Date().toISOString(),
    });

    // Worker 2 errors
    hud.updateAgent({
      agentId: 'w2', agentType: 'worker', state: 'error',
      progress: 30, tokensUsed: 500, elapsedMs: 3000,
      updatedAt: new Date().toISOString(),
    });

    hud.addWarning('Worker w2 failed: OOM');
    hud.addWarning('Retrying with simplified strategy');

    const snap = hud.snapshot();
    expect(snap.systemHealth).toBe(80); // 100 - 20 (error)
    expect(snap.warnings).toHaveLength(2);
    expect(snap.agents).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Checkpoint-Based Task Recovery
// ═══════════════════════════════════════════════════════════

describe('E2E: Checkpoint-Based Recovery', () => {
  it('should save progress and resume from checkpoint after failure', async () => {
    const checkpointMgr = createCheckpointManager({ maxPerTask: 10 });
    const taskId = 'recoverable-task';

    const allSteps = ['analyze', 'implement', 'test', 'deploy'];
    const executedSteps: string[] = [];

    // Simulate first run — fails at step 3
    let failAtStep = 'test';
    for (let i = 0; i < allSteps.length; i++) {
      const step = allSteps[i];

      if (step === failAtStep) {
        // Save checkpoint before failure
        const completedSteps: CompletedStep[] = executedSteps.map((s) => ({
          stepId: s,
          name: s,
          result: { done: true },
          durationMs: 100,
          completedAt: new Date().toISOString(),
        }));

        await checkpointMgr.save({
          id: `cp-run1-${i}`,
          taskId,
          agentId: 'worker-1',
          stepIndex: i,
          totalSteps: allSteps.length,
          completedSteps,
          pendingSteps: allSteps.slice(i),
          context: { lastOutput: 'partial' },
          createdAt: new Date().toISOString(),
        });

        break; // Simulate crash
      }

      executedSteps.push(step);
    }

    expect(executedSteps).toEqual(['analyze', 'implement']);

    // Restore from checkpoint
    const restored = await checkpointMgr.restore(taskId);
    expect(restored.success).toBe(true);
    expect(restored.remainingSteps).toEqual(['test', 'deploy']);
    expect(restored.checkpoint?.stepIndex).toBe(2);

    // Resume execution from checkpoint
    const resumeFrom = restored.remainingSteps;
    const resumedSteps: string[] = [];

    for (const step of resumeFrom) {
      resumedSteps.push(step);

      // Save checkpoint after each resumed step
      const allCompleted: CompletedStep[] = [
        ...executedSteps.map((s) => ({
          stepId: s, name: s, result: { done: true },
          durationMs: 100, completedAt: new Date().toISOString(),
        })),
        ...resumedSteps.map((s) => ({
          stepId: s, name: s, result: { done: true },
          durationMs: 100, completedAt: new Date().toISOString(),
        })),
      ];

      await checkpointMgr.save({
        id: `cp-run2-${resumedSteps.length}`,
        taskId,
        agentId: 'worker-1',
        stepIndex: executedSteps.length + resumedSteps.length,
        totalSteps: allSteps.length,
        completedSteps: allCompleted,
        pendingSteps: resumeFrom.slice(resumedSteps.length),
        context: { recovered: true },
        createdAt: new Date().toISOString(),
      });
    }

    expect(resumedSteps).toEqual(['test', 'deploy']);

    // Verify final state
    const finalCheckpoints = await checkpointMgr.list(taskId);
    expect(finalCheckpoints.length).toBeGreaterThanOrEqual(3);

    const latestRestore = await checkpointMgr.restore(taskId);
    expect(latestRestore.success).toBe(true);
    expect(latestRestore.checkpoint?.pendingSteps).toHaveLength(0);
    expect(latestRestore.checkpoint?.completedSteps).toHaveLength(4);
  });

  it('should clean up old checkpoints when max exceeded', async () => {
    const checkpointMgr = createCheckpointManager({ maxPerTask: 3 });
    const taskId = 'cleanup-task';

    // Save 5 checkpoints
    for (let i = 0; i < 5; i++) {
      await checkpointMgr.save({
        id: `cp-${i}`,
        taskId,
        agentId: 'worker',
        stepIndex: i,
        totalSteps: 10,
        completedSteps: [],
        pendingSteps: [],
        context: { step: i },
        createdAt: new Date().toISOString(),
      });
    }

    // Should only keep latest 3
    const checkpoints = await checkpointMgr.list(taskId);
    expect(checkpoints).toHaveLength(3);
    expect(checkpoints[0].id).toBe('cp-2');
    expect(checkpoints[2].id).toBe('cp-4');
  });
});
