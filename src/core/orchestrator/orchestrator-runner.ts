/**
 * Orchestrator Runner
 *
 * Thin integration layer that coordinates CEOOrchestrator, Team Agents,
 * and Hook pipeline for end-to-end workflow execution.
 *
 * Agent initialization delegated to agent-factory.ts.
 * Integration module setup delegated to integration-setup.ts.
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
import { TaskHandlerResult } from './team-agent';
import { BaseTeamAgent } from './base-team-agent';
import { RunnerStateManager } from './runner-state-manager';
import { ErrorEscalator, EscalationAction } from './error-escalator';
import { HookRegistry } from '../hooks/hook-registry';
import { HookExecutor } from '../hooks/hook-executor';
import { HookEvent, HookAction } from '../interfaces/hook.interface';
import { ServiceRegistry } from '../services/service-registry';
import type { GoalBackwardResult } from '../validation/interfaces/validation.interface';
import { createAndRegisterAgents } from './agent-factory';
import { initializeIntegrations } from './integration-setup';
import { ParallelExecutor } from './parallel-executor';
import { OTelProvider, createOTelProvider } from '@/shared/telemetry';

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
 * Workflow execution result
 */
export interface WorkflowResult {
  success: boolean;
  taskId: string;
  result?: unknown;
  error?: string;
  duration: number;
  teamType: TeamType;
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
  'context:warning': () => void;
  'context:critical': () => void;
  error: (error: Error) => void;
}

/**
 * Orchestrator Runner
 *
 * Thin runner that delegates agent creation and integration setup
 * to dedicated modules while focusing on lifecycle and execution flow.
 */
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
  private readonly telemetry: OTelProvider | null;

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
    };

    this.telemetry = this.config.enableTelemetry
      ? createOTelProvider({ enabled: true, serviceName: 'aca-runner' })
      : null;
    if (this.telemetry) this.telemetry.initialize();

    this.parallelExecutor = this.config.enableParallelExecution
      ? new ParallelExecutor({ maxConcurrency: this.config.parallelConcurrency })
      : null;

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
        },
        this.hookRegistry,
        this.config.workspaceDir,
        this,
      );

      await this.orchestrator.start();

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
        verification = await this.verifyGoal(description, tasks).catch(() => undefined);
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

      if (goalSpan) this.telemetry!.getTraceManager().endSpan(goalSpan, goalResult.success ? 'ok' : 'error');
      this.emit('goal:completed', goalResult);
      return goalResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const goalResult: GoalResult = {
        success: false,
        goalId,
        tasks: [],
        totalDuration: Date.now() - startTime,
        completedTasks: 0,
        failedTasks: 1,
      };
      if (goalSpan) this.telemetry!.getTraceManager().endSpan(goalSpan, 'error');
      this.emit('error', err);
      return goalResult;
    }
  }

  async executeTask(task: TaskDocument): Promise<WorkflowResult> {
    const startTime = Date.now();
    const taskId = task.metadata.id;
    const taskSpan = this.telemetry?.getTraceManager().startSpan('executeTask');
    if (taskSpan) {
      taskSpan.attributes['task.id'] = taskId;
      taskSpan.attributes['task.team'] = task.metadata.to;
      taskSpan.attributes['task.type'] = task.metadata.type;
    }

    this.emit('workflow:started', taskId);

    try {
      // TASK_BEFORE Hooks
      if (this.hookRegistry.count() > 0) {
        const beforeResults = await this.hookExecutor.executeHooks(
          HookEvent.TASK_BEFORE, task, { stopOnAction: [HookAction.ABORT] }
        ).catch(() => []);

        const aborted = beforeResults.find(r => r.action === HookAction.ABORT);
        if (aborted) {
          const workflowResult: WorkflowResult = {
            success: false,
            taskId,
            error: `Blocked by validation: ${aborted.message}`,
            duration: Date.now() - startTime,
            teamType: task.metadata.to,
          };
          this.stateManager.recordResult(taskId, workflowResult);
          this.emit('workflow:completed', workflowResult);
          return workflowResult;
        }
      }

      const team = this.orchestrator.teams.get(task.metadata.to);
      if (!team) {
        throw new Error(`No team registered for type: ${task.metadata.to}`);
      }

      const baseAgent = team as BaseTeamAgent;
      const result: TaskHandlerResult = await baseAgent.processTask(task);

      const workflowResult: WorkflowResult = {
        success: result.success,
        taskId,
        result: result.result,
        error: result.error,
        duration: Date.now() - startTime,
        teamType: task.metadata.to,
      };

      // TASK_AFTER Hooks
      if (this.hookRegistry.count() > 0) {
        await this.hookExecutor.executeHooks(
          HookEvent.TASK_AFTER, { task, result }
        ).catch(() => []);
      }

      if (taskSpan) this.telemetry!.getTraceManager().endSpan(taskSpan, workflowResult.success ? 'ok' : 'error');
      this.stateManager.recordResult(taskId, workflowResult);
      this.errorEscalator.recordSuccess(taskId);
      this.emit('workflow:completed', workflowResult);

      return workflowResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const classification = this.errorEscalator.classify(err, 'executeTask');
      const action = this.errorEscalator.handleError(err, 'executeTask', taskId);

      // TASK_ERROR Hooks (pass classification for learning system)
      if (this.hookRegistry.count() > 0) {
        await this.hookExecutor.executeHooks(
          HookEvent.TASK_ERROR, { task, error: err, classification }
        ).catch(() => []);
      }

      if (action === EscalationAction.STOP_RUNNER) {
        this.stateManager.setStatus(RunnerStatus.ERROR);
        this.emit('error', err);
      }

      const workflowResult: WorkflowResult = {
        success: false,
        taskId,
        error: err.message,
        duration: Date.now() - startTime,
        teamType: task.metadata.to,
      };

      if (taskSpan) this.telemetry!.getTraceManager().endSpan(taskSpan, 'error');
      this.stateManager.recordResult(taskId, workflowResult);
      this.emit('workflow:failed', taskId, err);

      return workflowResult;
    }
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
    await this.stop();
    await this.orchestrator.destroy();
    if (this.telemetry) this.telemetry.shutdown();
    this.stateManager.clearResults();
    this.errorEscalator.reset();
    this.removeAllListeners();

    try {
      const registry = ServiceRegistry.getInstance();
      if (registry.isInitialized()) await registry.dispose();
    } catch {
      /* dispose error ignored */
    }
  }

  private async verifyGoal(
    goalDescription: string,
    tasks: TaskDocument[],
  ): Promise<GoalBackwardResult | undefined> {
    const registry = ServiceRegistry.getInstance();
    const verifier = registry.getGoalBackwardVerifier();
    if (!verifier) return undefined;

    const expectedPaths: string[] = [];
    for (const task of tasks) {
      if (task.metadata.files) {
        for (const file of task.metadata.files) {
          if (file.path && !expectedPaths.includes(file.path)) {
            expectedPaths.push(file.path);
          }
        }
      }
    }

    if (expectedPaths.length === 0) return undefined;

    return verifier.verify({
      description: goalDescription,
      expectedPaths,
    });
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
