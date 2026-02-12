/**
 * Integration Tests — Module Cross-Wiring
 *
 * Validates that independently-implemented modules compose correctly
 * when wired together. Tests real module interactions, not mocks.
 *
 * Test groups:
 * 1. ServiceRegistry + Hook Pipeline
 * 2. DeepWorker + SkillPipeline
 * 3. ACP MessageBus + APIGateway
 * 4. Checkpoint + DeepWorker
 * 5. HUD + Agent Metrics
 * 6. Full Hook Chain Lifecycle
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// ── Hook system ─────────────────────────────────────────
import { HookRegistry } from '@/core/hooks/hook-registry';
import { HookExecutor } from '@/core/hooks/hook-executor';
import {
  HookEvent,
  HookAction,
  type IHook,
  type HookContext,
} from '@/core/interfaces/hook.interface';

// ── Service Registry ────────────────────────────────────
import { ServiceRegistry } from '@/core/services/service-registry';
import { initializeIntegrations, type IntegrationFlags } from '@/core/orchestrator/integration-setup';

// ── Deep Worker ─────────────────────────────────────────
import {
  createDeepWorker,
  createPreExploration,
  createSelfPlanning,
  createRetryStrategy,
  createTodoContinuationEnforcer,
  type DeepWorkerContext,
  type PlannedStep,
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
  type ACPMessage,
  type TaskResultPayload,
} from '@/core/protocols';
import { createAPIGateway, type GatewayEvent } from '@/api/gateway';

// ── Checkpoint ──────────────────────────────────────────
import { createCheckpointManager } from '@/core/checkpoint';
import type { CheckpointState, CompletedStep } from '@/core/checkpoint';

// ── HUD ─────────────────────────────────────────────────
import {
  createMetricsCollector,
  createHUDDashboard,
  type AgentHUDStatus,
} from '@/core/hud';

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

/** Create a simple hook for testing */
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

/** Create a simple ISkill for testing */
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
// 1. ServiceRegistry + Hook Pipeline Integration
// ═══════════════════════════════════════════════════════════

describe('Integration: ServiceRegistry + Hook Pipeline', () => {
  let workspaceDir: string;

  beforeEach(() => {
    workspaceDir = path.join(os.tmpdir(), `integ-svc-hook-${Date.now()}`);
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

  it('should bootstrap ServiceRegistry and register hooks into HookExecutor pipeline', async () => {
    const hookRegistry = new HookRegistry();
    const emitter = new EventEmitter();

    const flags: IntegrationFlags = {
      enableValidation: true,
      enableLearning: true,
      enableContextManagement: true,
      enableSecurity: false,
      enableSession: false,
      useRealQualityTools: false,
      enableMCP: false,
      enableLSP: false,
      enablePlugins: false,
      enablePlanningContext: false,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    // ServiceRegistry should be initialized
    const svcRegistry = ServiceRegistry.getInstance();
    expect(svcRegistry.isInitialized()).toBe(true);

    // Hooks should be registered
    expect(hookRegistry.count()).toBeGreaterThanOrEqual(3);

    // HookExecutor should be able to use the registry
    const executor = new HookExecutor(hookRegistry);
    const results = await executor.executeHooks(
      HookEvent.TASK_BEFORE,
      { taskId: 'test-task', description: 'test' },
    );

    // Results should be an array (may be empty if hooks don't listen to TASK_BEFORE)
    expect(Array.isArray(results)).toBe(true);
  });

  it('should survive partial module init failure gracefully', async () => {
    const hookRegistry = new HookRegistry();
    const emitter = new EventEmitter();

    // Use a non-writable path to force learning init failures
    const badDir = '/nonexistent-path-for-testing';

    const flags: IntegrationFlags = {
      enableValidation: true,
      enableLearning: true,
      enableContextManagement: false,
      enableSecurity: false,
      enableSession: false,
      useRealQualityTools: false,
      enableMCP: false,
      enableLSP: false,
      enablePlugins: false,
      enablePlanningContext: false,
    };

    // Should not throw — graceful degradation
    await initializeIntegrations(flags, hookRegistry, badDir, emitter);

    const svcRegistry = ServiceRegistry.getInstance();
    expect(svcRegistry.isInitialized()).toBe(true);

    // Validation hooks may still register even if learning fails
    expect(hookRegistry.count()).toBeGreaterThanOrEqual(1);
  });

  it('should wire learning listeners to EventEmitter via integration-setup', async () => {
    const hookRegistry = new HookRegistry();
    const emitter = new EventEmitter();

    const flags: IntegrationFlags = {
      enableValidation: false,
      enableLearning: true,
      enableContextManagement: false,
      enableSecurity: false,
      enableSession: false,
      useRealQualityTools: false,
      enableMCP: false,
      enableLSP: false,
      enablePlugins: false,
      enablePlanningContext: false,
    };

    await initializeIntegrations(flags, hookRegistry, workspaceDir, emitter);

    // The learning listeners should be registered on the emitter
    // Emitting workflow:completed should not throw
    emitter.emit('workflow:completed', {
      taskId: 'task-1',
      teamType: 'dev',
      success: true,
    });

    // No assertion needed — if it doesn't throw, listeners are wired safely
  });
});

// ═══════════════════════════════════════════════════════════
// 2. DeepWorker + SkillPipeline Integration
// ═══════════════════════════════════════════════════════════

describe('Integration: DeepWorker + SkillPipeline', () => {
  it('should use SkillPipeline as step executor inside DeepWorker', async () => {
    const skillRegistry = createSkillRegistry();
    const executionLog: string[] = [];

    // Register skills
    skillRegistry.register(makeTestSkill('analyze', async (input) => {
      executionLog.push('analyze');
      return { success: true, output: { ...input as object, analyzed: true }, duration: 10 };
    }, ['analysis']));

    skillRegistry.register(makeTestSkill('implement', async (input) => {
      executionLog.push('implement');
      return { success: true, output: { ...input as object, implemented: true }, duration: 20 };
    }, ['implementation']));

    skillRegistry.register(makeTestSkill('test', async (input) => {
      executionLog.push('test');
      return { success: true, output: { ...input as object, tested: true }, duration: 15 };
    }, ['testing']));

    // Create pipeline
    const pipeline = createSkillPipeline({
      name: 'dev-pipeline',
      registry: skillRegistry,
    });
    pipeline.addStep('analyze').addStep('implement').addStep('test');

    // Create DeepWorker with pipeline-based step executor
    const exploration = createPreExploration({
      executor: async () => ({
        relevantFiles: ['src/main.ts'],
        patterns: ['factory'],
        dependencies: [],
        summary: 'Found main entry',
        duration: 5,
      }),
    });

    const planning = createSelfPlanning({
      executor: async () => ({
        steps: [
          { id: 's1', description: 'Analyze code', type: 'explore' as const, dependencies: [], effort: 'small' as const, completed: false },
          { id: 's2', description: 'Implement feature', type: 'implement' as const, dependencies: ['s1'], effort: 'medium' as const, completed: false },
          { id: 's3', description: 'Write tests', type: 'test' as const, dependencies: ['s2'], effort: 'small' as const, completed: false },
        ],
        summary: 'Three-step plan',
        totalEffort: 'medium' as const,
        duration: 10,
      }),
    });

    const retry = createRetryStrategy({
      maxRetries: 2,
      strategyGenerator: (_ctx, _err, attempt) => ({
        name: 'retry',
        reason: `Attempt ${attempt}`,
        changes: [],
        attempt,
        maxAttempts: 2,
      }),
    });

    const continuation = createTodoContinuationEnforcer();

    // Step executor uses skill pipeline per step
    const skillCtx: SkillContext = { workspaceDir: '/tmp' };
    const worker = createDeepWorker({
      name: 'test-deep-worker',
      exploration,
      planning,
      retry,
      continuation,
      stepExecutor: async (stepId, stepDesc, _strategy, _context) => {
        // Run the entire pipeline for each step
        const result = await pipeline.execute({ stepId, stepDesc }, skillCtx);
        if (!result.success) {
          throw new Error(`Pipeline failed for step ${stepId}`);
        }
      },
    });

    const context: DeepWorkerContext = {
      workspaceDir: '/tmp',
      taskDescription: 'Implement feature X',
    };

    const result = await worker.execute(context);

    expect(result.success).toBe(true);
    expect(result.todoStatus.completedSteps).toBe(3);
    expect(result.todoStatus.failedSteps).toBe(0);
    // Pipeline ran 3 times (once per step), each running 3 skills
    expect(executionLog).toHaveLength(9);
    expect(executionLog).toEqual([
      'analyze', 'implement', 'test',
      'analyze', 'implement', 'test',
      'analyze', 'implement', 'test',
    ]);
  });

  it('should handle pipeline failure in DeepWorker step', async () => {
    const skillRegistry = createSkillRegistry();

    // Register a failing skill
    skillRegistry.register(makeTestSkill('fail-skill', async () => {
      return { success: false, error: 'Intentional failure', duration: 5 };
    }));

    const pipeline = createSkillPipeline({
      name: 'fail-pipeline',
      registry: skillRegistry,
    });
    pipeline.addStep('fail-skill');

    const exploration = createPreExploration({
      executor: async () => ({
        relevantFiles: [], patterns: [], dependencies: [],
        summary: 'Empty', duration: 1,
      }),
    });

    const planning = createSelfPlanning({
      executor: async () => ({
        steps: [
          { id: 's1', description: 'Step 1', type: 'implement' as const, dependencies: [], effort: 'small' as const, completed: false },
        ],
        summary: 'One step', totalEffort: 'small' as const, duration: 1,
      }),
    });

    const retry = createRetryStrategy({
      maxRetries: 1,
      strategyGenerator: (_ctx, _err, attempt) => ({
        name: 'retry', reason: 'retry', changes: [],
        attempt, maxAttempts: 1,
      }),
    });

    const continuation = createTodoContinuationEnforcer();
    const skillCtx: SkillContext = { workspaceDir: '/tmp' };

    const worker = createDeepWorker({
      name: 'fail-worker',
      exploration,
      planning,
      retry,
      continuation,
      stepExecutor: async () => {
        const result = await pipeline.execute({}, skillCtx);
        if (!result.success) throw new Error('Pipeline failed');
      },
    });

    const result = await worker.execute({
      workspaceDir: '/tmp',
      taskDescription: 'Failing task',
    });

    expect(result.success).toBe(false);
    expect(result.todoStatus.failedSteps).toBeGreaterThanOrEqual(1);
    expect(result.error).toContain('failed');
  });
});

// ═══════════════════════════════════════════════════════════
// 3. ACP MessageBus + APIGateway Integration
// ═══════════════════════════════════════════════════════════

describe('Integration: ACP MessageBus + APIGateway', () => {
  it('should route task submission through bus and receive task result events', async () => {
    const bus = createACPMessageBus();
    const gateway = createAPIGateway({ messageBus: bus, gatewayId: 'gw-1' });

    const events: GatewayEvent[] = [];
    gateway.onEvent((evt) => events.push(evt));

    // Simulate an orchestrator subscribing for tasks
    const receivedTasks: ACPMessage[] = [];
    bus.on('task:submit', async (msg) => {
      receivedTasks.push(msg);

      // Simulate the orchestrator sending back a result
      await bus.publish(createACPMessage({
        type: 'task:result',
        source: 'orchestrator',
        target: 'gw-1',
        payload: {
          taskId: msg.metadata?.taskId,
          success: true,
          result: { output: 'done' },
          duration: 1000,
        } as TaskResultPayload,
      }));
    });

    // Submit task through gateway
    const response = await gateway.submitTask({
      description: 'Fix auth bug',
      targetTeam: 'orchestrator',
    });

    expect(response.status).toBe('accepted');
    expect(response.taskId).toBeTruthy();

    // The orchestrator should have received the task
    expect(receivedTasks).toHaveLength(1);
    expect(receivedTasks[0].type).toBe('task:submit');

    // Gateway should have received the result event
    // Wait a tick for async event propagation
    await new Promise((r) => setTimeout(r, 50));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task:completed');
  });

  it('should handle health check request-response through bus', async () => {
    const bus = createACPMessageBus({ defaultTimeout: 2000 });
    const gateway = createAPIGateway({ messageBus: bus, healthTimeout: 1000 });

    // Simulate a system component responding to health checks
    // Must check correlationId to avoid infinite publish loops
    bus.on('system:health', async (msg) => {
      if (msg.correlationId) return; // Skip responses
      await bus.publish(createACPMessage({
        type: 'system:health',
        source: 'system',
        target: msg.source,
        payload: {
          status: 'healthy',
          activeAgents: 3,
          pendingTasks: 2,
          uptime: 60000,
          components: { orchestrator: 'healthy', llm: 'healthy' },
        },
        correlationId: msg.id,
      }));
    });

    const health = await gateway.getHealth();

    expect(health.status).toBe('healthy');
    expect(health.activeAgents).toBe(3);
    expect(health.pendingTasks).toBe(2);
    expect(health.components.orchestrator).toBe('healthy');
  });

  it('should return degraded health when no responder exists', async () => {
    const bus = createACPMessageBus();
    const gateway = createAPIGateway({
      messageBus: bus,
      healthTimeout: 200,
    });

    const health = await gateway.getHealth();

    expect(health.status).toBe('degraded');
    expect(health.activeAgents).toBe(0);
  });

  it('should forward task failure events', async () => {
    const bus = createACPMessageBus();
    const gateway = createAPIGateway({ messageBus: bus });

    const events: GatewayEvent[] = [];
    gateway.onEvent((evt) => events.push(evt));

    // Publish a failed task result directly on the bus
    await bus.publish(createACPMessage({
      type: 'task:result',
      source: 'agent-1',
      target: 'broadcast',
      payload: {
        taskId: 'task-99',
        success: false,
        error: 'Out of memory',
        duration: 5000,
      } as TaskResultPayload,
    }));

    await new Promise((r) => setTimeout(r, 20));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('task:failed');
  });

  it('should broadcast status updates through bus', async () => {
    const bus = createACPMessageBus();
    const gateway = createAPIGateway({ messageBus: bus });

    const statusMessages: ACPMessage[] = [];
    bus.on('task:status', async (msg) => {
      statusMessages.push(msg);
    });

    await gateway.publishStatus({
      taskId: 'task-1',
      status: 'running',
      progress: 50,
      message: 'Halfway done',
    });

    expect(statusMessages).toHaveLength(1);
    expect(statusMessages[0].payload).toEqual(expect.objectContaining({
      taskId: 'task-1',
      status: 'running',
      progress: 50,
    }));
  });
});

// ═══════════════════════════════════════════════════════════
// 4. Checkpoint + DeepWorker Integration
// ═══════════════════════════════════════════════════════════

describe('Integration: Checkpoint + DeepWorker', () => {
  it('should save checkpoints during DeepWorker execution and restore later', async () => {
    const checkpointMgr = createCheckpointManager({ maxPerTask: 5 });
    const checkpointsSaved: string[] = [];

    const exploration = createPreExploration({
      executor: async () => ({
        relevantFiles: ['a.ts', 'b.ts'],
        patterns: ['observer'],
        dependencies: ['lodash'],
        summary: 'Found 2 files',
        duration: 5,
      }),
    });

    const steps: PlannedStep[] = [
      { id: 'c1', description: 'Step 1', type: 'implement', dependencies: [], effort: 'small', completed: false },
      { id: 'c2', description: 'Step 2', type: 'test', dependencies: ['c1'], effort: 'small', completed: false },
    ];

    const planning = createSelfPlanning({
      executor: async () => ({
        steps,
        summary: 'Two steps',
        totalEffort: 'small' as const,
        duration: 3,
      }),
    });

    const retry = createRetryStrategy({
      maxRetries: 1,
      strategyGenerator: (_ctx, _err, attempt) => ({
        name: 'default', reason: 'retry', changes: [],
        attempt, maxAttempts: 1,
      }),
    });

    const continuation = createTodoContinuationEnforcer();

    const worker = createDeepWorker({
      name: 'checkpoint-worker',
      exploration,
      planning,
      retry,
      continuation,
      stepExecutor: async (stepId, stepDesc, _strategy, context) => {
        // Save checkpoint after each step
        const now = new Date().toISOString();
        const completedStep: CompletedStep = {
          stepId,
          name: stepDesc,
          result: { success: true },
          durationMs: 10,
          completedAt: now,
        };
        const cpState: CheckpointState = {
          id: `cp-${stepId}`,
          taskId: 'task-checkpoint-test',
          agentId: 'test-agent',
          stepIndex: steps.findIndex((s) => s.id === stepId),
          totalSteps: steps.length,
          completedSteps: [completedStep],
          pendingSteps: steps.filter((s) => s.id !== stepId).map((s) => s.id),
          context: { workspaceDir: context.workspaceDir },
          createdAt: now,
          metadata: {},
        };
        await checkpointMgr.save(cpState);
        checkpointsSaved.push(stepId);
      },
    });

    const result = await worker.execute({
      workspaceDir: '/tmp',
      taskDescription: 'Checkpointed task',
    });

    expect(result.success).toBe(true);
    expect(checkpointsSaved).toHaveLength(2);

    // Verify checkpoints were persisted
    const allCheckpoints = await checkpointMgr.list('task-checkpoint-test');
    expect(allCheckpoints).toHaveLength(2);

    // Restore latest checkpoint
    const restored = await checkpointMgr.restore('task-checkpoint-test');
    expect(restored.success).toBe(true);
    expect(restored.checkpoint?.id).toBe('cp-c2');

    // Restore by specific ID
    const restoredFirst = await checkpointMgr.restoreById('cp-c1');
    expect(restoredFirst.success).toBe(true);
    expect(restoredFirst.checkpoint?.completedSteps[0]?.stepId).toBe('c1');
  });

  it('should handle checkpoint restore for unknown task', async () => {
    const checkpointMgr = createCheckpointManager();

    const restored = await checkpointMgr.restore('nonexistent-task');
    expect(restored.success).toBe(false);
    expect(restored.error).toContain('No checkpoints found');
  });
});

// ═══════════════════════════════════════════════════════════
// 5. HUD + Agent Metrics Integration
// ═══════════════════════════════════════════════════════════

describe('Integration: HUD + Agent Metrics', () => {
  it('should collect metrics and reflect in HUD snapshot', () => {
    const metrics = createMetricsCollector({ maxPoints: 100 });
    const hud = createHUDDashboard({ metrics, maxWarnings: 20 });

    // Record metrics from simulated agent activity
    metrics.recordValue('latency', 150, 'ms');
    metrics.recordValue('tokens', 5000, 'tokens');
    metrics.recordValue('llm-calls', 3, 'calls');

    // Update agent statuses
    hud.updateAgent({
      agentId: 'planner-1',
      agentType: 'planner',
      state: 'working',
      progress: 75,
      tokensUsed: 3000,
      elapsedMs: 10000,
      updatedAt: new Date().toISOString(),
    });

    hud.updateAgent({
      agentId: 'coder-1',
      agentType: 'coder',
      state: 'idle',
      progress: 0,
      tokensUsed: 0,
      elapsedMs: 0,
      updatedAt: new Date().toISOString(),
    });

    const snap = hud.snapshot();

    expect(snap.agents).toHaveLength(2);
    expect(snap.metrics).toHaveLength(3);
    expect(snap.systemHealth).toBe(100); // No errors or blocks
    expect(snap.warnings).toHaveLength(0);
  });

  it('should degrade health when agents error and warnings accumulate', () => {
    const metrics = createMetricsCollector();
    const hud = createHUDDashboard({ metrics });

    // Two errored agents
    hud.updateAgent({
      agentId: 'a1', agentType: 'coder', state: 'error',
      progress: 0, tokensUsed: 0, elapsedMs: 0,
      updatedAt: new Date().toISOString(),
    });
    hud.updateAgent({
      agentId: 'a2', agentType: 'tester', state: 'blocked',
      progress: 0, tokensUsed: 0, elapsedMs: 0,
      updatedAt: new Date().toISOString(),
    });

    // 12 warnings (> 10 threshold)
    for (let i = 0; i < 12; i++) {
      hud.addWarning(`Warning ${i}`);
    }

    const snap = hud.snapshot();

    // Health: 100 - 20 (error) - 10 (blocked) - 10 (>10 warnings) = 60
    expect(snap.systemHealth).toBe(60);
    expect(snap.agents).toHaveLength(2);
    expect(snap.warnings).toHaveLength(12);
  });

  it('should update metrics in real-time and reflect in subsequent snapshots', () => {
    const metrics = createMetricsCollector();
    const hud = createHUDDashboard({ metrics });

    hud.updateAgent({
      agentId: 'a1', agentType: 'coder', state: 'working',
      progress: 50, tokensUsed: 1000, elapsedMs: 5000,
      updatedAt: new Date().toISOString(),
    });

    // First snapshot
    const snap1 = hud.snapshot();
    expect(snap1.metrics).toHaveLength(0);

    // Record metrics
    metrics.recordValue('tokens', 2000);

    // Second snapshot reflects new metrics
    const snap2 = hud.snapshot();
    expect(snap2.metrics).toHaveLength(1);
    expect(snap2.metrics[0].value).toBe(2000);

    // Update agent progress
    hud.updateAgent({
      agentId: 'a1', agentType: 'coder', state: 'completed',
      progress: 100, tokensUsed: 3000, elapsedMs: 15000,
      updatedAt: new Date().toISOString(),
    });

    const snap3 = hud.snapshot();
    expect(snap3.agents[0].state).toBe('completed');
    expect(snap3.agents[0].progress).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════
// 6. Full Hook Chain Lifecycle
// ═══════════════════════════════════════════════════════════

describe('Integration: Full Hook Chain Lifecycle', () => {
  it('should execute hooks in priority order through HookExecutor', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);
    const executionOrder: string[] = [];

    hookRegistry.register(makeTestHook({
      name: 'low-priority-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 5,
      execute: async () => {
        executionOrder.push('low');
        return { action: HookAction.CONTINUE };
      },
    }));

    hookRegistry.register(makeTestHook({
      name: 'high-priority-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 50,
      execute: async () => {
        executionOrder.push('high');
        return { action: HookAction.CONTINUE };
      },
    }));

    hookRegistry.register(makeTestHook({
      name: 'mid-priority-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 20,
      execute: async () => {
        executionOrder.push('mid');
        return { action: HookAction.CONTINUE };
      },
    }));

    const results = await executor.executeHooks(
      HookEvent.TASK_BEFORE,
      { task: 'test' },
    );

    expect(results).toHaveLength(3);
    expect(executionOrder).toEqual(['high', 'mid', 'low']);
  });

  it('should stop on ABORT action and record execution history', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);

    hookRegistry.register(makeTestHook({
      name: 'check-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 100,
      execute: async () => {
        return { action: HookAction.CONTINUE, message: 'Check passed' };
      },
    }));

    hookRegistry.register(makeTestHook({
      name: 'abort-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 50,
      execute: async () => {
        return { action: HookAction.ABORT, message: 'Confidence too low' };
      },
    }));

    hookRegistry.register(makeTestHook({
      name: 'never-reached-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 10,
      execute: async () => {
        return { action: HookAction.CONTINUE };
      },
    }));

    const results = await executor.executeHooks(
      HookEvent.TASK_BEFORE,
      { confidence: 0.2 },
    );

    // Should stop after abort
    expect(results).toHaveLength(2);
    expect(results[0].action).toBe(HookAction.CONTINUE);
    expect(results[1].action).toBe(HookAction.ABORT);

    // Execution history should be recorded
    const history = executor.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('should support MODIFY action passing context between hooks', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);

    hookRegistry.register(makeTestHook({
      name: 'enrich-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 100,
      execute: async (ctx: HookContext) => {
        return {
          action: HookAction.MODIFY,
          data: { ...(ctx.data as object), enriched: true },
        };
      },
    }));

    hookRegistry.register(makeTestHook({
      name: 'validate-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 50,
      execute: async (ctx: HookContext) => {
        const data = ctx.data as Record<string, unknown>;
        return {
          action: HookAction.CONTINUE,
          message: data.enriched ? 'Validated enriched data' : 'Not enriched',
          data: { validated: !!data.enriched },
        };
      },
    }));

    const results = await executor.executeHooks(
      HookEvent.TASK_BEFORE,
      { original: true },
    );

    expect(results).toHaveLength(2);
    expect(results[0].action).toBe(HookAction.MODIFY);
    expect(results[1].message).toBe('Validated enriched data');
  });

  it('should handle error hooks gracefully without crashing the chain', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);

    hookRegistry.register(makeTestHook({
      name: 'error-hook',
      event: HookEvent.TASK_ERROR,
      priority: 100,
      execute: async () => {
        return {
          action: HookAction.RETRY,
          message: 'Attempting recovery',
          metadata: { retryCount: 1 },
        };
      },
    }));

    hookRegistry.register(makeTestHook({
      name: 'log-hook',
      event: HookEvent.TASK_ERROR,
      priority: 50,
      execute: async () => {
        return {
          action: HookAction.CONTINUE,
          message: 'Error logged',
        };
      },
    }));

    const results = await executor.executeHooks(
      HookEvent.TASK_ERROR,
      { error: 'Something went wrong', taskId: 'test-1' },
    );

    expect(results).toHaveLength(2);
    expect(results[0].action).toBe(HookAction.RETRY);
    expect(results[1].action).toBe(HookAction.CONTINUE);
  });

  it('should support parallel hook execution', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);
    const timestamps: number[] = [];

    hookRegistry.register(makeTestHook({
      name: 'slow-hook',
      event: HookEvent.TASK_AFTER,
      priority: 10,
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
        timestamps.push(Date.now());
        return { action: HookAction.CONTINUE };
      },
    }));

    hookRegistry.register(makeTestHook({
      name: 'fast-hook',
      event: HookEvent.TASK_AFTER,
      priority: 5,
      execute: async () => {
        timestamps.push(Date.now());
        return { action: HookAction.CONTINUE };
      },
    }));

    const start = Date.now();
    const results = await executor.executeHooks(
      HookEvent.TASK_AFTER,
      { taskId: 'test' },
      { parallel: true },
    );

    expect(results).toHaveLength(2);
    // In parallel mode, total time should be close to the slowest hook (50ms)
    // Not the sum of both
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('should disable/enable hooks and respect enabled state', async () => {
    const hookRegistry = new HookRegistry();
    const executor = new HookExecutor(hookRegistry);

    hookRegistry.register(makeTestHook({
      name: 'toggleable-hook',
      event: HookEvent.TASK_BEFORE,
      priority: 10,
      execute: async () => ({ action: HookAction.CONTINUE, message: 'ran' }),
    }));

    // Execute with hook enabled
    let results = await executor.executeHooks(HookEvent.TASK_BEFORE, {});
    expect(results).toHaveLength(1);

    // Disable the hook
    hookRegistry.setEnabled('toggleable-hook', false);
    results = await executor.executeHooks(HookEvent.TASK_BEFORE, {});
    expect(results).toHaveLength(0);

    // Re-enable
    hookRegistry.setEnabled('toggleable-hook', true);
    results = await executor.executeHooks(HookEvent.TASK_BEFORE, {});
    expect(results).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 7. Cross-Module: ACP → HUD Integration
// ═══════════════════════════════════════════════════════════

describe('Integration: ACP → HUD monitoring', () => {
  it('should reflect ACP agent events in HUD dashboard', async () => {
    const bus = createACPMessageBus();
    const metrics = createMetricsCollector();
    const hud = createHUDDashboard({ metrics });

    // Wire ACP agent:status events to HUD updates
    bus.on('agent:status', async (msg) => {
      const payload = msg.payload as {
        agentId: string;
        name: string;
        status: string;
        activeTasks: number;
      };

      const stateMap: Record<string, AgentHUDStatus['state']> = {
        'idle': 'idle',
        'busy': 'working',
        'error': 'error',
        'stopped': 'completed',
      };

      hud.updateAgent({
        agentId: payload.agentId,
        agentType: payload.name,
        state: stateMap[payload.status] ?? 'idle',
        progress: payload.status === 'busy' ? 50 : 0,
        tokensUsed: 0,
        elapsedMs: 0,
        updatedAt: new Date().toISOString(),
      });
    });

    // Simulate agent status updates via ACP
    await bus.publish(createACPMessage({
      type: 'agent:status',
      source: 'agent-planner',
      target: 'broadcast',
      payload: {
        agentId: 'planner-1',
        name: 'planner',
        status: 'busy',
        activeTasks: 2,
        uptime: 10000,
      },
    }));

    await bus.publish(createACPMessage({
      type: 'agent:status',
      source: 'agent-coder',
      target: 'broadcast',
      payload: {
        agentId: 'coder-1',
        name: 'coder',
        status: 'error',
        activeTasks: 0,
        uptime: 5000,
      },
    }));

    const snap = hud.snapshot();

    expect(snap.agents).toHaveLength(2);
    expect(snap.agents.find((a) => a.agentId === 'planner-1')?.state).toBe('working');
    expect(snap.agents.find((a) => a.agentId === 'coder-1')?.state).toBe('error');
    // Health: 100 - 20 (1 error) = 80
    expect(snap.systemHealth).toBe(80);
  });
});

// ═══════════════════════════════════════════════════════════
// 8. Cross-Module: SkillPipeline + Checkpoint
// ═══════════════════════════════════════════════════════════

describe('Integration: SkillPipeline + Checkpoint', () => {
  it('should save checkpoints between pipeline steps for recovery', async () => {
    const skillRegistry = createSkillRegistry();
    const checkpointMgr = createCheckpointManager();
    const taskId = 'pipeline-checkpoint-task';

    let stepIndex = 0;

    // Skills that save checkpoints after execution
    const makeCheckpointedSkill = (name: string): ISkill => makeTestSkill(
      name,
      async (input) => {
        stepIndex++;
        const output = { ...(input as object), [`${name}_done`]: true };
        const now = new Date().toISOString();

        // Save checkpoint after each skill
        await checkpointMgr.save({
          id: `cp-${name}-${stepIndex}`,
          taskId,
          agentId: 'pipeline-agent',
          stepIndex,
          totalSteps: 3,
          completedSteps: [{
            stepId: name,
            name,
            result: output,
            durationMs: 10,
            completedAt: now,
          }],
          pendingSteps: [],
          context: { output },
          createdAt: now,
          metadata: { stepIndex },
        });

        return { success: true, output, duration: 10 };
      },
    );

    skillRegistry.register(makeCheckpointedSkill('plan'));
    skillRegistry.register(makeCheckpointedSkill('code'));
    skillRegistry.register(makeCheckpointedSkill('review'));

    const pipeline = createSkillPipeline({
      name: 'checkpointed-pipeline',
      registry: skillRegistry,
    });
    pipeline.addStep('plan').addStep('code').addStep('review');

    const result = await pipeline.execute(
      { initial: true },
      { workspaceDir: '/tmp' },
    );

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(3);

    // Verify checkpoints
    const checkpoints = await checkpointMgr.list(taskId);
    expect(checkpoints).toHaveLength(3);

    // Restore latest
    const restored = await checkpointMgr.restore(taskId);
    expect(restored.success).toBe(true);
    expect(restored.checkpoint?.context).toEqual(
      expect.objectContaining({ output: expect.objectContaining({ review_done: true }) }),
    );
  });
});
