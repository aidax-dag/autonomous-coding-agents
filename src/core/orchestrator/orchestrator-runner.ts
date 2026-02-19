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
import {
  DEFAULT_MAX_CONCURRENT_TASKS,
  DEFAULT_TASK_TIMEOUT_MS,
  MIN_CONFIDENCE_THRESHOLD,
  DEFAULT_PARALLEL_CONCURRENCY,
  GLOBAL_AGENT_POOL_MAX,
  MAX_TASK_RETRIES,
  generateUniqueId,
} from './constants';

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
 * Core execution/runtime configuration.
 */
export interface OrchestratorRunnerCoreConfig {
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
}

/**
 * Validation and recovery configuration.
 */
export interface OrchestratorRunnerValidationConfig {
  /** Enable pre/post validation hooks (default: false) */
  enableValidation?: boolean;
  /** Minimum confidence threshold for task validation (0-100, default: 70) */
  minConfidenceThreshold?: number;
  /** Enable error learning hooks (default: false) */
  enableLearning?: boolean;
  /** Enable error recovery pipeline with retry logic (default: false) */
  enableErrorRecovery?: boolean;
  /** Maximum retries per task when error recovery is enabled (default: 2) */
  maxRetries?: number;
}

/**
 * Parallel/background execution configuration.
 */
export interface OrchestratorRunnerParallelConfig {
  /** Enable parallel task execution (default: false) */
  enableParallelExecution?: boolean;
  /** Max parallel concurrency */
  parallelConcurrency?: number;
  /** Per-provider concurrency limits (e.g. { claude: 3, openai: 5 }) */
  providerLimits?: Record<string, number>;
  /** Global concurrency cap across all providers */
  globalMax?: number;
  /** Enable fire-and-forget goal execution via BackgroundManager (default: false) */
  enableBackgroundGoals?: boolean;
}

/**
 * Feature-toggle configuration.
 */
export interface OrchestratorRunnerFeatureToggleConfig {
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
  /** Enable OpenTelemetry tracing (default: false) */
  enableTelemetry?: boolean;
}

/**
 * Runner configuration (composed from focused config groups).
 */
export interface OrchestratorRunnerConfig
  extends OrchestratorRunnerCoreConfig,
  OrchestratorRunnerValidationConfig,
  OrchestratorRunnerParallelConfig,
  OrchestratorRunnerFeatureToggleConfig {}

type ResolvedOrchestratorRunnerConfig =
  Required<OrchestratorRunnerCoreConfig> &
  Required<OrchestratorRunnerValidationConfig> &
  Required<OrchestratorRunnerParallelConfig> &
  Required<OrchestratorRunnerFeatureToggleConfig>;

type TraceSpan = ReturnType<ReturnType<OTelProvider['getTraceManager']>['startSpan']> | undefined;

function resolveCoreConfig(config: OrchestratorRunnerCoreConfig): Required<OrchestratorRunnerCoreConfig> {
  return {
    llmClient: config.llmClient,
    agentModelMap: config.agentModelMap ?? {},
    workspaceDir: config.workspaceDir || process.cwd(),
    routingStrategy: config.routingStrategy || RoutingStrategy.LOAD_BALANCED,
    maxConcurrentTasks: config.maxConcurrentTasks || DEFAULT_MAX_CONCURRENT_TASKS,
    taskTimeout: config.taskTimeout || DEFAULT_TASK_TIMEOUT_MS,
    enableLLM: config.enableLLM ?? true,
    projectContext: config.projectContext || '',
    useRealQualityTools: config.useRealQualityTools ?? false,
  };
}

function resolveValidationConfig(
  config: OrchestratorRunnerValidationConfig,
): Required<OrchestratorRunnerValidationConfig> {
  return {
    enableValidation: config.enableValidation ?? false,
    minConfidenceThreshold: config.minConfidenceThreshold ?? MIN_CONFIDENCE_THRESHOLD,
    enableLearning: config.enableLearning ?? false,
    enableErrorRecovery: config.enableErrorRecovery ?? false,
    maxRetries: config.maxRetries ?? MAX_TASK_RETRIES,
  };
}

function resolveParallelConfig(
  config: OrchestratorRunnerParallelConfig,
): Required<OrchestratorRunnerParallelConfig> {
  return {
    enableParallelExecution: config.enableParallelExecution ?? false,
    parallelConcurrency: config.parallelConcurrency ?? DEFAULT_PARALLEL_CONCURRENCY,
    providerLimits: config.providerLimits ?? {},
    globalMax: config.globalMax ?? GLOBAL_AGENT_POOL_MAX,
    enableBackgroundGoals: config.enableBackgroundGoals ?? false,
  };
}

function resolveFeatureToggleConfig(
  config: OrchestratorRunnerFeatureToggleConfig,
): Required<OrchestratorRunnerFeatureToggleConfig> {
  return {
    enableContextManagement: config.enableContextManagement ?? false,
    enableSecurity: config.enableSecurity ?? false,
    enableSession: config.enableSession ?? false,
    enableMCP: config.enableMCP ?? false,
    enableLSP: config.enableLSP ?? false,
    enablePlugins: config.enablePlugins ?? false,
    pluginsDir: config.pluginsDir ?? 'plugins',
    enablePlanningContext: config.enablePlanningContext ?? false,
    enableExpandedAgents: config.enableExpandedAgents ?? false,
    enableTelemetry: config.enableTelemetry ?? false,
  };
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
  private readonly config: ResolvedOrchestratorRunnerConfig;
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
  /** Guards one-time bootstrap to avoid duplicate team registration */
  private bootstrapComplete: boolean = false;

  constructor(config: OrchestratorRunnerConfig) {
    super();

    this.config = {
      ...resolveCoreConfig(config),
      ...resolveValidationConfig(config),
      ...resolveParallelConfig(config),
      ...resolveFeatureToggleConfig(config),
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

      await this.initializeWorkspace();
      await this.initializeAgentsAndIntegrations();

      await this.lifecycle.startSession();
      this.lifecycle.wireContextMonitoring();

      await this.orchestrator.start();

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

    const goalId = generateUniqueId('goal');
    const startTime = Date.now();
    const goalSpan = this.createGoalSpan(goalId, title);
    this.emit('goal:started', goalId);

    try {
      return await this.executeGoalWorkflow(goalId, startTime, goalSpan, title, description, options);
    } catch (error) {
      return this.handleGoalExecutionError(goalId, description, startTime, goalSpan, error);
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
      generateUniqueId('goal-bg'),
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

    const goalId = generateUniqueId('xmlplan');
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

  private async initializeWorkspace(): Promise<void> {
    await this.workspace.ensureInitialized();
    await this.queue.start();
  }

  private async initializeAgentsAndIntegrations(): Promise<void> {
    if (this.bootstrapComplete) {
      return;
    }

    const llmAdapter = this.config.enableLLM
      ? createTeamAgentLLMAdapter({ client: this.config.llmClient })
      : undefined;

    await createAndRegisterAgents({
      llmAdapter,
      llmClient: this.config.llmClient,
      agentModelMap: this.config.agentModelMap,
      queue: this.queue,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      enableLLM: this.config.enableLLM,
      projectContext: this.config.projectContext,
      useRealQualityTools: this.config.useRealQualityTools,
      workspaceDir: this.config.workspaceDir,
      enableExpandedAgents: this.config.enableExpandedAgents,
    }, this.orchestrator);

    await initializeIntegrations({
      enableValidation: this.config.enableValidation,
      enableLearning: this.config.enableLearning,
      enableContextManagement: this.config.enableContextManagement,
      enableSecurity: this.config.enableSecurity,
      enableSession: this.config.enableSession,
      useRealQualityTools: this.config.useRealQualityTools,
      enableMCP: this.config.enableMCP,
      enableLSP: this.config.enableLSP,
      enablePlugins: this.config.enablePlugins,
      pluginsDir: this.config.pluginsDir,
      enablePlanningContext: this.config.enablePlanningContext,
      llmAdapter,
      projectContext: this.config.projectContext,
    }, this.hookRegistry, this.config.workspaceDir, this);

    this.bootstrapComplete = true;
  }

  private async runWorkflowHook(event: HookEvent, data: Record<string, unknown>): Promise<void> {
    if (this.hookRegistry.count() === 0) {
      return;
    }

    await this.hookExecutor.executeHooks(event, data).catch((err: unknown) => {
      logger.warn(`${event} hook failed`, { error: err instanceof Error ? err.message : String(err) });
    });
  }

  private async executeTasks(
    tasks: TaskDocument[],
    waitForCompletion: boolean = true,
  ): Promise<WorkflowResult[]> {
    if (!waitForCompletion) {
      logger.debug('waitForCompletion=false requested; executing synchronously until background goal flow is enabled');
    }

    if (this.config.enableParallelExecution && this.parallelExecutor) {
      return this.parallelExecutor.execute(tasks, {
        executeTask: async (task) => this.executeTask(task),
      });
    }

    const results: WorkflowResult[] = [];
    for (const task of tasks) {
      results.push(await this.executeTask(task));
    }
    return results;
  }

  private async runGoalVerification(
    goalId: string,
    goalDescription: string,
    tasks: TaskDocument[],
    results: WorkflowResult[],
  ): Promise<GoalBackwardResult | undefined> {
    if (!this.config.enableValidation) {
      return undefined;
    }

    if (results.some((result) => !result.success)) {
      return undefined;
    }

    const verification = await this.taskExecutor.verifyGoal(goalDescription, tasks);
    if (verification) {
      this.emit('goal:verification', goalId, verification);
    }
    return verification;
  }

  private buildGoalResult(
    goalId: string,
    tasks: WorkflowResult[],
    startTime: number,
    verification?: GoalBackwardResult,
    error?: string,
  ): GoalResult {
    const failedTasks = tasks.filter((task) => !task.success).length;
    const completedTasks = tasks.length - failedTasks;

    return {
      success: !error && failedTasks === 0,
      goalId,
      tasks,
      totalDuration: Date.now() - startTime,
      completedTasks,
      failedTasks,
      error,
      verification,
    };
  }

  private createGoalSpan(goalId: string, goalTitle: string): TraceSpan {
    const span = this.telemetry?.getTraceManager().startSpan('executeGoal');
    if (!span) {
      return undefined;
    }

    span.attributes['goal.id'] = goalId;
    span.attributes['goal.title'] = goalTitle;
    return span;
  }

  private endGoalSpan(span: TraceSpan, status: 'ok' | 'error'): void {
    if (!span || !this.telemetry) {
      return;
    }
    this.telemetry.getTraceManager().endSpan(span, status);
  }

  private async executeGoalWorkflow(
    goalId: string,
    startTime: number,
    goalSpan: TraceSpan,
    title: string,
    description: string,
    options?: {
      priority?: TaskPriority;
      projectId?: string;
      tags?: string[];
      waitForCompletion?: boolean;
    },
  ): Promise<GoalResult> {
    const tasks = await this.orchestrator.submitGoal(title, description, {
      priority: options?.priority,
      projectId: options?.projectId,
      tags: options?.tags,
    });

    await this.runWorkflowHook(HookEvent.WORKFLOW_START, { goal: description, tasks, goalId });

    const results = await this.executeTasks(tasks, options?.waitForCompletion);
    const verification = await this.runGoalVerification(goalId, description, tasks, results);
    const goalResult = this.buildGoalResult(goalId, results, startTime, verification);

    await this.runWorkflowHook(HookEvent.WORKFLOW_END, { goal: description, results, verification, goalId });

    this.endGoalSpan(goalSpan, goalResult.success ? 'ok' : 'error');
    this.emit('goal:completed', goalResult);
    return goalResult;
  }

  private async handleGoalExecutionError(
    goalId: string,
    description: string,
    startTime: number,
    goalSpan: TraceSpan,
    originalError: unknown,
  ): Promise<GoalResult> {
    const wrappedError = wrapError(originalError, undefined, ErrorCode.WORKFLOW_ERROR);
    logger.error('Goal execution failed', {
      goalId,
      error: wrappedError.message,
      code: wrappedError.code,
    });

    await this.runWorkflowHook(HookEvent.WORKFLOW_ERROR, {
      goal: description,
      error: wrappedError,
      goalId,
    });

    const goalResult = this.buildGoalResult(goalId, [], startTime, undefined, wrappedError.message);
    this.endGoalSpan(goalSpan, 'error');
    this.emit('error', wrappedError);
    return goalResult;
  }

  private setupEventHandlers(): void {
    this.orchestrator.on('task:completed', (task, result) => {
      const workflowResult = this.createWorkflowResult(
        task.metadata.id,
        task.metadata.to,
        result.success,
        0,
        { result: result.result },
      );
      this.stateManager.recordResult(task.metadata.id, workflowResult);
    });

    this.orchestrator.on('task:failed', (task, error) => {
      const workflowResult = this.createWorkflowResult(
        task.metadata.id,
        task.metadata.to,
        false,
        0,
        { error: error.message },
      );
      this.stateManager.recordResult(task.metadata.id, workflowResult);
    });

    this.orchestrator.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private createWorkflowResult(
    taskId: string,
    teamType: TeamType,
    success: boolean,
    duration: number,
    payload?: { result?: unknown; error?: string },
  ): WorkflowResult {
    return {
      success,
      taskId,
      duration,
      teamType,
      result: payload?.result,
      error: payload?.error,
    };
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
