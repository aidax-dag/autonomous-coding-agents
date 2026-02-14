/**
 * Orchestrator Runner
 *
 * Thin integration layer that coordinates CEOOrchestrator, Team Agents,
 * and Hook pipeline for end-to-end workflow execution.
 *
 * Agent initialization delegated to agent-factory.ts.
 * Integration module setup delegated to integration-setup.ts.
 * Task execution delegated to task-executor.ts.
 * Session/context lifecycle delegated to runner-lifecycle.ts.
 *
 * Feature: End-to-End Workflow Integration for Agent OS
 */

import { EventEmitter } from 'events';
import { CEOOrchestrator, CEOStatus } from './ceo-orchestrator';
import { isModelRouter } from './llm/team-agent-llm';
import type { IModelRouter, ICostTracker } from '@/shared/llm/interfaces/routing.interface';
import { TaskDocument, TeamType, TaskPriority, TaskType } from '../workspace/task-document';
import { DocumentQueue } from '../workspace/document-queue';
import { WorkspaceManager } from '../workspace/workspace-manager';
import { ILLMClient } from '@/shared/llm';
import { RoutingStrategy } from './task-router';
import { RunnerStateManager } from './runner-state-manager';
import { ErrorEscalator } from './error-escalator';
import { HookRegistry } from '../hooks/hook-registry';
import { HookExecutor } from '../hooks/hook-executor';
import { HookEvent } from '../interfaces/hook.interface';
import { ServiceRegistry } from '../services/service-registry';
import type { GoalBackwardResult } from '../validation/interfaces/validation.interface';
import { createAndRegisterAgents } from './agent-factory';
import { initializeIntegrations } from './integration-setup';
import { createTeamAgentLLMAdapter } from './llm/team-agent-llm';
import { ParallelExecutor } from './parallel-executor';
import { AgentPool } from './agent-pool';
import { BackgroundManager } from './background-manager';
import type { BackgroundTaskHandle } from './interfaces/parallel.interface';
import { OTelProvider, createOTelProvider } from '@/shared/telemetry';
import { logger } from '@/shared/logging/logger';
import { wrapError, ErrorCode } from '@/shared/errors/custom-errors';
import { TaskExecutor } from './task-executor';
import { RunnerLifecycle } from './runner-lifecycle';

/**
 * Runner status
 */
export enum RunnerStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
}

/**
 * Task-level validation result from post-execution confidence checking
 */
export interface TaskValidationResult {
  /** Confidence score from ConfidenceChecker (0-100) */
  confidence: number;
  /** Whether the confidence check passed threshold */
  passed: boolean;
  /** Recommendation from the checker */
  recommendation: 'proceed' | 'alternatives' | 'stop';
  /** Failed check item names */
  failedChecks?: string[];
}

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  taskId: string;
  result?: unknown;
  error?: string;
  duration: number;
  teamType: TeamType;
  /** Post-execution validation result (when enableValidation is true) */
  validation?: TaskValidationResult;
}

/**
 * Goal execution result
 */
export interface GoalResult {
  success: boolean;
  goalId: string;
  tasks: WorkflowResult[];
  totalDuration: number;
  completedTasks: number;
  failedTasks: number;
  /** Error message when goal execution fails */
  error?: string;
  /** Goal-backward verification result (when enableValidation is true) */
  verification?: GoalBackwardResult;
}

/**
 * Runner configuration
 */
export interface OrchestratorRunnerConfig {
  /** LLM client for agent execution */
  llmClient: ILLMClient;
  /** Per-agent model overrides (e.g. { planning: 'claude-opus-4-6' }) */
  agentModelMap?: Record<string, string>;
  /** Optional workspace directory */
  workspaceDir?: string;
  /** Routing strategy */
  routingStrategy?: RoutingStrategy;
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number;
  /** Task timeout in ms */
  taskTimeout?: number;
  /** Enable LLM-powered agents */
  enableLLM?: boolean;
  /** Project context for agents */
  projectContext?: string;
  /** Use real quality tools (CodeQualityHook, TestResultParser) instead of mock/LLM */
  useRealQualityTools?: boolean;
  /** Enable pre/post validation hooks (default: false) */
  enableValidation?: boolean;
  /** Minimum confidence threshold for task validation (0-100, default: 70) */
  minConfidenceThreshold?: number;
  /** Enable error learning hooks (default: false) */
  enableLearning?: boolean;
  /** Enable context management hooks (default: false) */
  enableContextManagement?: boolean;
  /** Enable security module - SandboxEscalation (default: false) */
  enableSecurity?: boolean;
  /** Enable session persistence module (default: false) */
  enableSession?: boolean;
  /** Enable MCP protocol integration (default: false) */
  enableMCP?: boolean;
  /** Enable LSP integration (default: false) */
  enableLSP?: boolean;
  /** Enable plugin system (default: false) */
  enablePlugins?: boolean;
  /** Plugin discovery directory (default: 'plugins') */
  pluginsDir?: string;
  /** Enable planning context module (default: false) */
  enablePlanningContext?: boolean;
  /** Enable expanded agent set (architecture, security, debugging, docs, exploration, integration) */
  enableExpandedAgents?: boolean;
  /** Enable parallel task execution (default: false) */
  enableParallelExecution?: boolean;
  /** Max parallel concurrency */
  parallelConcurrency?: number;
  /** Enable OpenTelemetry tracing (default: false) */
  enableTelemetry?: boolean;
  /** Per-provider concurrency limits (e.g. { claude: 3, openai: 5 }) */
  providerLimits?: Record<string, number>;
  /** Global concurrency cap across all providers */
  globalMax?: number;
  /** Enable fire-and-forget goal execution via BackgroundManager (default: false) */
  enableBackgroundGoals?: boolean;
  /** Enable error recovery pipeline with retry logic (default: false) */
  enableErrorRecovery?: boolean;
  /** Maximum retries per task when error recovery is enabled (default: 2) */
  maxRetries?: number;
}

/**
 * Runner events
 */
export interface RunnerEvents {
  started: () => void;
  stopped: () => void;
  paused: () => void;
  resumed: () => void;
  'workflow:started': (taskId: string) => void;
  'workflow:completed': (result: WorkflowResult) => void;
  'workflow:failed': (taskId: string, error: Error) => void;
  'goal:started': (goalId: string) => void;
  'goal:completed': (result: GoalResult) => void;
  'goal:verification': (goalId: string, result: GoalBackwardResult) => void;
  'validation:low-confidence': (info: { taskId: string; confidence: number; recommendation: string }) => void;
  'context:warning': () => void;
  'context:critical': () => void;
  'context:budget-warning': (info: { taskId: string; utilization: number }) => void;
  'parallel:batch-start': (info: { groupId: string; taskCount: number }) => void;
  'parallel:batch-complete': (info: { groupId: string; results: number; duration: number }) => void;
  'pool:acquired': (info: { provider: string; taskId: string }) => void;
  'pool:released': (info: { provider: string; taskId: string }) => void;
  'learning:solution-found': (info: { taskId: string; solution: unknown }) => void;
  'error:retry': (info: { taskId: string; attempt: number; maxRetries: number; error: Error }) => void;
  'error:escalated': (info: { taskId: string; action: string; error: Error }) => void;
  'error:recovered': (info: { taskId: string; attempt: number; error: Error }) => void;
  error: (error: Error) => void;
}

/**
 * Orchestrator Runner
 *
 * Thin runner that delegates agent creation and integration setup
 * to dedicated modules while focusing on lifecycle and execution flow.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class OrchestratorRunner extends EventEmitter {
  private readonly config: Required<OrchestratorRunnerConfig>;
  private readonly orchestrator: CEOOrchestrator;
  private readonly workspace: WorkspaceManager;
  private readonly queue: DocumentQueue;

  private readonly hookRegistry: HookRegistry;
  private readonly hookExecutor: HookExecutor;

  private readonly stateManager = new RunnerStateManager();
  private readonly errorEscalator = new ErrorEscalator();
  private readonly parallelExecutor: ParallelExecutor | null;
  private readonly agentPool: AgentPool | null;
  private readonly backgroundManager: BackgroundManager;
  private readonly telemetry: OTelProvider | null;

  /** Delegates task execution (extracted module) */
  private readonly taskExecutor: TaskExecutor;
  /** Delegates session/context lifecycle (extracted module) */
  private readonly lifecycle: RunnerLifecycle;

  constructor(config: OrchestratorRunnerConfig) {
    super();

    this.config = {
      llmClient: config.llmClient,
      agentModelMap: config.agentModelMap ?? {},
      workspaceDir: config.workspaceDir || process.cwd(),
      routingStrategy: config.routingStrategy || RoutingStrategy.LOAD_BALANCED,
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      taskTimeout: config.taskTimeout || 300000,
      enableLLM: config.enableLLM ?? true,
      projectContext: config.projectContext || '',
      useRealQualityTools: config.useRealQualityTools ?? false,
      enableValidation: config.enableValidation ?? false,
      minConfidenceThreshold: config.minConfidenceThreshold ?? 70,
      enableLearning: config.enableLearning ?? false,
      enableContextManagement: config.enableContextManagement ?? false,
      enableSecurity: config.enableSecurity ?? false,
      enableSession: config.enableSession ?? false,
      enableMCP: config.enableMCP ?? false,
      enableLSP: config.enableLSP ?? false,
      enablePlugins: config.enablePlugins ?? false,
      pluginsDir: config.pluginsDir ?? 'plugins',
      enablePlanningContext: config.enablePlanningContext ?? false,
      enableExpandedAgents: config.enableExpandedAgents ?? false,
      enableParallelExecution: config.enableParallelExecution ?? false,
      parallelConcurrency: config.parallelConcurrency ?? 5,
      enableTelemetry: config.enableTelemetry ?? false,
      providerLimits: config.providerLimits ?? {},
      globalMax: config.globalMax ?? 10,
      enableBackgroundGoals: config.enableBackgroundGoals ?? false,
      enableErrorRecovery: config.enableErrorRecovery ?? false,
      maxRetries: config.maxRetries ?? 2,
    };

    this.telemetry = this.config.enableTelemetry
      ? createOTelProvider({ enabled: true, serviceName: 'aca-runner' })
      : null;
    if (this.telemetry) this.telemetry.initialize();

    if (this.config.enableParallelExecution) {
      this.agentPool = new AgentPool({
        defaultMaxPerProvider: this.config.parallelConcurrency,
        providerLimits: Object.keys(this.config.providerLimits).length > 0
          ? this.config.providerLimits
          : undefined,
        globalMax: this.config.globalMax,
      });

      this.parallelExecutor = new ParallelExecutor({
        maxConcurrency: this.config.parallelConcurrency,
        agentPool: this.agentPool,
        emitter: this,
      });
    } else {
      this.agentPool = null;
      this.parallelExecutor = null;
    }

    this.backgroundManager = new BackgroundManager();

    this.hookRegistry = new HookRegistry();
    this.hookExecutor = new HookExecutor(this.hookRegistry);

    this.workspace = new WorkspaceManager({
      baseDir: this.config.workspaceDir,
      autoCreate: true,
    });
    this.queue = new DocumentQueue(this.workspace);

    this.orchestrator = new CEOOrchestrator({
      workspaceDir: this.config.workspaceDir,
      routingStrategy: this.config.routingStrategy,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      taskTimeout: this.config.taskTimeout,
      autoStartTeams: false,
      enableDecomposition: true,
    });

    // Initialize extracted delegates
    this.taskExecutor = new TaskExecutor({
      orchestrator: this.orchestrator,
      hookRegistry: this.hookRegistry,
      hookExecutor: this.hookExecutor,
      stateManager: this.stateManager,
      errorEscalator: this.errorEscalator,
      emitter: this,
      telemetry: this.telemetry,
      config: {
        enableValidation: this.config.enableValidation,
        minConfidenceThreshold: this.config.minConfidenceThreshold,
        enableLearning: this.config.enableLearning,
        enableErrorRecovery: this.config.enableErrorRecovery,
        maxRetries: this.config.maxRetries,
      },
    });

    this.lifecycle = new RunnerLifecycle({
      hookRegistry: this.hookRegistry,
      hookExecutor: this.hookExecutor,
      emitter: this,
      config: {
        enableSession: this.config.enableSession,
        enableContextManagement: this.config.enableContextManagement,
      },
    });

    this.setupEventHandlers();
  }

  get currentStatus(): RunnerStatus {
    return this.stateManager.getStatus();
  }

  get orchestratorStatus(): CEOStatus {
    return this.orchestrator.currentStatus;
  }

  get ceoOrchestrator(): CEOOrchestrator {
    return this.orchestrator;
  }

  get uptime(): number {
    return this.stateManager.getUptime();
  }

  /**
   * Get the cost tracker if the LLM client is a ModelRouter.
   * Returns null when routing is not enabled.
   */
  getCostTracker(): ICostTracker | null {
    if (isModelRouter(this.config.llmClient)) {
      return (this.config.llmClient as IModelRouter).getCostTracker();
    }
    return null;
  }

  /**
   * Get the telemetry provider (when enableTelemetry is true).
   */
  getTelemetry(): OTelProvider | null {
    return this.telemetry;
  }

  /**
   * Get the agent pool (when enableParallelExecution is true).
   */
  getAgentPool(): AgentPool | null {
    return this.agentPool;
  }

  /**
   * Get the background manager for async goal execution.
   */
  getBackgroundManager(): BackgroundManager {
    return this.backgroundManager;
  }

  /**
   * Get currently running background tasks.
   */
  getBackgroundTasks(): BackgroundTaskHandle[] {
    return this.backgroundManager.getRunning();
  }

  async start(): Promise<void> {
    if (this.stateManager.getStatus() === RunnerStatus.RUNNING) {
      return;
    }

    try {
      this.stateManager.setStatus(RunnerStatus.INITIALIZING);

      await this.workspace.initialize();
      await this.queue.initialize();

      // Delegate agent creation to factory (passes llmClient for per-agent routing)
      await createAndRegisterAgents(
        {
          llmClient: this.config.llmClient,
          agentModelMap: this.config.agentModelMap,
          queue: this.queue,
          maxConcurrentTasks: this.config.maxConcurrentTasks,
          enableLLM: this.config.enableLLM,
          projectContext: this.config.projectContext,
          useRealQualityTools: this.config.useRealQualityTools,
          workspaceDir: this.config.workspaceDir,
          enableExpandedAgents: this.config.enableExpandedAgents,
        },
        this.orchestrator,
      );
      // Delegate integration module setup
      // Create a skill-dedicated LLM adapter when LLM is enabled
      const skillLLMAdapter = this.config.enableLLM
        ? createTeamAgentLLMAdapter({
            client: this.config.llmClient,
            agentRole: 'code-quality',
            model: this.config.agentModelMap?.['skill'],
          })
        : undefined;

      await initializeIntegrations(
        {
          enableValidation: this.config.enableValidation,
          enableLearning: this.config.enableLearning,
          enableContextManagement: this.config.enableContextManagement,
          enableSecurity: this.config.enableSecurity,
          enableSession: this.config.enableSession,
          enableMCP: this.config.enableMCP,
          enableLSP: this.config.enableLSP,
          enablePlugins: this.config.enablePlugins,
          pluginsDir: this.config.pluginsDir,
          enablePlanningContext: this.config.enablePlanningContext,
          useRealQualityTools: this.config.useRealQualityTools,
          llmAdapter: skillLLMAdapter,
          projectContext: this.config.projectContext || undefined,
        },
        this.hookRegistry,
        this.config.workspaceDir,
        this,
      );

      // Wire session lifecycle via delegate
      await this.lifecycle.startSession();

      // Wire context monitoring via delegate
      this.lifecycle.wireContextMonitoring();

      await this.orchestrator.start();

      // AGENT_STARTED Hook via delegate
      await this.lifecycle.fireAgentStartedHook(this.orchestrator.teams.getAll().length);

      this.stateManager.markStarted();
      this.emit('started');
    } catch (error) {
      this.stateManager.setStatus(RunnerStatus.ERROR);
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.stateManager.getStatus() === RunnerStatus.STOPPED) {
      return;
    }

    try {
      this.stateManager.setStatus(RunnerStatus.STOPPING);

      // End session via delegate
      await this.lifecycle.endSession();

      // Clean up context event listeners via delegate
      this.lifecycle.cleanupContextListeners();

      // AGENT_STOPPED Hook via delegate
      await this.lifecycle.fireAgentStoppedHook({});

      await this.orchestrator.stop();
      await this.queue.stop();
      this.stateManager.setStatus(RunnerStatus.STOPPED);
      this.emit('stopped');
    } catch (error) {
      this.stateManager.setStatus(RunnerStatus.ERROR);
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  async pause(): Promise<void> {
    if (this.stateManager.getStatus() !== RunnerStatus.RUNNING) {
      return;
    }
    await this.orchestrator.pause();
    this.stateManager.setStatus(RunnerStatus.PAUSED);
    this.emit('paused');
  }

  async resume(): Promise<void> {
    if (this.stateManager.getStatus() !== RunnerStatus.PAUSED) {
      return;
    }
    await this.orchestrator.resume();
    this.stateManager.setStatus(RunnerStatus.RUNNING);
    this.emit('resumed');
  }

  async executeGoal(
    title: string,
    description: string,
    options?: {
      priority?: TaskPriority;
      projectId?: string;
      tags?: string[];
      waitForCompletion?: boolean;
    }
  ): Promise<GoalResult> {
    if (!this.stateManager.isRunning()) {
      throw new Error(`Runner is not running (status: ${this.stateManager.getStatus()})`);
    }

    const goalId = `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const goalSpan = this.telemetry?.getTraceManager().startSpan('executeGoal');
    if (goalSpan) {
      goalSpan.attributes['goal.id'] = goalId;
      goalSpan.attributes['goal.title'] = title;
    }

    this.emit('goal:started', goalId);

    try {
      const tasks = await this.orchestrator.submitGoal(title, description, {
        priority: options?.priority,
        projectId: options?.projectId,
        tags: options?.tags,
      });

      // WORKFLOW_START Hook
      if (this.hookRegistry.count() > 0) {
        await this.hookExecutor.executeHooks(
          HookEvent.WORKFLOW_START,
          { goal: description, tasks, goalId },
        ).catch((e) => {
          logger.warn('WORKFLOW_START hook failed', { goalId, error: e instanceof Error ? e.message : String(e) });
        });
      }

      const results: WorkflowResult[] = [];

      if (options?.waitForCompletion !== false) {
        if (this.parallelExecutor && this.config.enableParallelExecution) {
          const parallelResults = await this.parallelExecutor.execute(tasks, this);
          results.push(...parallelResults);
        } else {
          for (const task of tasks) {
            const result = await this.executeTask(task);
            results.push(result);
          }
        }
      } else {
        for (const task of tasks) {
          results.push({
            success: true,
            taskId: task.metadata.id,
            duration: 0,
            teamType: task.metadata.to,
          });
        }
      }

      let verification: GoalBackwardResult | undefined;
      if (this.config.enableValidation && results.every((r) => r.success)) {
        verification = await this.taskExecutor.verifyGoal(description, tasks).catch((e) => {
          logger.warn('Goal verification failed', { goalId, error: e instanceof Error ? e.message : String(e) });
          return undefined;
        });
        if (verification) {
          this.emit('goal:verification', goalId, verification);
        }
      }

      const goalResult: GoalResult = {
        success: results.every((r) => r.success),
        goalId,
        tasks: results,
        totalDuration: Date.now() - startTime,
        completedTasks: results.filter((r) => r.success).length,
        failedTasks: results.filter((r) => !r.success).length,
        verification,
      };

      // WORKFLOW_END Hook
      if (this.hookRegistry.count() > 0) {
        await this.hookExecutor.executeHooks(
          HookEvent.WORKFLOW_END,
          { goal: description, results, verification, goalId },
        ).catch((e) => {
          logger.warn('WORKFLOW_END hook failed', { goalId, error: e instanceof Error ? e.message : String(e) });
        });
      }

      if (goalSpan) this.telemetry!.getTraceManager().endSpan(goalSpan, goalResult.success ? 'ok' : 'error');
      this.emit('goal:completed', goalResult);
      return goalResult;
    } catch (error) {
      const err = wrapError(error, undefined, ErrorCode.WORKFLOW_ERROR);
      logger.error('Goal execution failed', { goalId, error: err.message, code: err.code });

      // WORKFLOW_ERROR Hook
      if (this.hookRegistry.count() > 0) {
        await this.hookExecutor.executeHooks(
          HookEvent.WORKFLOW_ERROR,
          { goal: description, error: err, goalId },
        ).catch((e) => {
          logger.warn('WORKFLOW_ERROR hook failed', { goalId, error: e instanceof Error ? e.message : String(e) });
        });
      }

      const goalResult: GoalResult = {
        success: false,
        goalId,
        tasks: [],
        totalDuration: Date.now() - startTime,
        completedTasks: 0,
        failedTasks: 1,
        error: err.message,
      };
      if (goalSpan) this.telemetry!.getTraceManager().endSpan(goalSpan, 'error');
      this.emit('error', err);
      return goalResult;
    }
  }

  /**
   * Execute a goal asynchronously in the background.
   * Returns a BackgroundTaskHandle for tracking and cancellation.
   */
  executeGoalAsync(
    title: string,
    description: string,
    options?: {
      priority?: TaskPriority;
      projectId?: string;
      tags?: string[];
    },
  ): BackgroundTaskHandle {
    return this.backgroundManager.launch(
      async () => {
        const goalResult = await this.executeGoal(title, description, options);
        return {
          success: goalResult.success,
          taskId: goalResult.goalId,
          duration: goalResult.totalDuration,
          teamType: 'planning' as TeamType,
          result: goalResult,
        };
      },
      `goal-${Date.now()}`,
    );
  }

  async executeTask(task: TaskDocument): Promise<WorkflowResult> {
    return this.taskExecutor.executeTask(task);
  }

  async submitToTeam(
    teamType: TeamType,
    title: string,
    content: string,
    options?: {
      priority?: TaskPriority;
      tags?: string[];
      projectId?: string;
    }
  ): Promise<TaskDocument> {
    if (!this.stateManager.isRunning()) {
      throw new Error(`Runner is not running (status: ${this.stateManager.getStatus()})`);
    }

    const taskType = getTaskTypeForTeam(teamType);

    return this.orchestrator.submitTask({
      title,
      type: taskType,
      from: 'orchestrator',
      to: teamType,
      priority: options?.priority || 'medium',
      tags: options?.tags || [],
      projectId: options?.projectId,
      content,
    });
  }

  /**
   * Execute a structured XML plan through the orchestrator.
   * Parses the XML into steps and creates tasks for each step.
   */
  async executeXMLPlan(
    xml: string,
    options?: { priority?: TaskPriority; projectId?: string; tags?: string[] },
  ): Promise<GoalResult> {
    if (!this.stateManager.isRunning()) {
      throw new Error(`Runner is not running (status: ${this.stateManager.getStatus()})`);
    }

    const goalId = `xmlplan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.emit('goal:started', goalId);

    const tasks = await this.orchestrator.executeXMLPlan(xml, options);
    if (tasks.length === 0) {
      return {
        success: false,
        goalId,
        tasks: [],
        totalDuration: Date.now() - startTime,
        completedTasks: 0,
        failedTasks: 0,
      };
    }

    const results: WorkflowResult[] = [];
    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);
    }

    const goalResult: GoalResult = {
      success: results.every((r) => r.success),
      goalId,
      tasks: results,
      totalDuration: Date.now() - startTime,
      completedTasks: results.filter((r) => r.success).length,
      failedTasks: results.filter((r) => !r.success).length,
    };

    this.emit('goal:completed', goalResult);
    return goalResult;
  }

  getTaskResult(taskId: string): WorkflowResult | undefined {
    return this.stateManager.getResult(taskId);
  }

  getAllResults(): Map<string, WorkflowResult> {
    return this.stateManager.getAllResults();
  }

  getStats(): {
    status: RunnerStatus;
    uptime: number;
    tasksExecuted: number;
    tasksSucceeded: number;
    tasksFailed: number;
    orchestratorStats: ReturnType<CEOOrchestrator['getStats']>;
  } {
    return this.stateManager.getStats(this.orchestrator);
  }

  async destroy(): Promise<void> {
    this.backgroundManager.cancelAll();

    // AGENT_STOPPED Hook (on destroy) via delegate
    await this.lifecycle.fireAgentStoppedHook({ reason: 'destroy' });

    await this.stop();
    await this.orchestrator.destroy();
    if (this.telemetry) this.telemetry.shutdown();
    this.stateManager.clearResults();
    this.errorEscalator.reset();
    this.lifecycle.cleanupContextListeners();
    this.removeAllListeners();

    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch {
      /* dispose error ignored */
    }
  }

  private setupEventHandlers(): void {
    this.orchestrator.on('task:completed', (task, result) => {
      const workflowResult: WorkflowResult = {
        success: result.success,
        taskId: task.metadata.id,
        result: result.result,
        duration: 0,
        teamType: task.metadata.to,
      };
      this.stateManager.recordResult(task.metadata.id, workflowResult);
    });

    this.orchestrator.on('task:failed', (task, error) => {
      const workflowResult: WorkflowResult = {
        success: false,
        taskId: task.metadata.id,
        error: error.message,
        duration: 0,
        teamType: task.metadata.to,
      };
      this.stateManager.recordResult(task.metadata.id, workflowResult);
    });

    this.orchestrator.on('error', (error) => {
      this.emit('error', error);
    });
  }
}

// Type-safe event emitter
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface OrchestratorRunner {
  on<E extends keyof RunnerEvents>(event: E, listener: RunnerEvents[E]): this;
  emit<E extends keyof RunnerEvents>(event: E, ...args: Parameters<RunnerEvents[E]>): boolean;
}

/**
 * Map team type to task type
 */
function getTaskTypeForTeam(teamType: TeamType): TaskType {
  switch (teamType) {
    case 'planning':
      return 'planning';
    case 'development':
    case 'frontend':
    case 'backend':
      return 'feature';
    case 'qa':
      return 'test';
    case 'code-quality':
      return 'review';
    case 'design':
      return 'design';
    case 'infrastructure':
      return 'infrastructure';
    default:
      return 'feature';
  }
}

/**
 * Create an orchestrator runner
 */
export function createOrchestratorRunner(config: OrchestratorRunnerConfig): OrchestratorRunner {
  return new OrchestratorRunner(config);
}

/**
 * Create a runner with mock LLM for testing
 *
 * @deprecated Use createMockRunner from './mock-runner' instead
 */
export { createMockRunner } from './mock-runner';
