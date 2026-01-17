/**
 * Orchestrator Runner
 *
 * Integrates CEOOrchestrator with Team Agents and LLM for complete
 * end-to-end workflow execution. Provides a high-level interface
 * for running orchestrated agent workflows.
 *
 * Feature: End-to-End Workflow Integration for Agent OS
 */

import { EventEmitter } from 'events';
import { CEOOrchestrator, CEOStatus } from './ceo-orchestrator';
import { PlanningAgent, createPlanningAgent, PlanningOutput } from './agents/planning-agent';
import {
  DevelopmentAgent,
  createDevelopmentAgent,
  DevelopmentOutput,
} from './agents/development-agent';
import { QAAgent, createQAAgent, QAOutput } from './agents/qa-agent';
import { TeamAgentLLMAdapter, createTeamAgentLLMAdapter } from './llm/team-agent-llm';
import {
  createPlanningLLMExecutor,
  createDevelopmentLLMExecutor,
  createQALLMExecutor,
} from './llm';
import { TaskDocument, TeamType, TaskPriority, TaskType } from '../workspace/task-document';
import { DocumentQueue } from '../workspace/document-queue';
import { WorkspaceManager } from '../workspace/workspace-manager';
import { ILLMClient } from '@/shared/llm';
import { RoutingStrategy } from './task-router';
import { TaskHandlerResult } from './team-agent';
import { BaseTeamAgent } from './base-team-agent';
import { createQAExecutor } from './quality';

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
}

/**
 * Runner configuration
 */
export interface OrchestratorRunnerConfig {
  /** LLM client for agent execution */
  llmClient: ILLMClient;
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
  error: (error: Error) => void;
}

/**
 * Orchestrator Runner
 *
 * High-level runner that integrates all components for end-to-end workflow execution.
 */
export class OrchestratorRunner extends EventEmitter {
  private readonly config: Required<OrchestratorRunnerConfig>;
  private readonly orchestrator: CEOOrchestrator;
  private readonly workspace: WorkspaceManager;
  private readonly queue: DocumentQueue;
  private readonly llmAdapter: TeamAgentLLMAdapter;

  private planningAgent?: PlanningAgent;
  private developmentAgent?: DevelopmentAgent;
  private qaAgent?: QAAgent;

  private status: RunnerStatus = RunnerStatus.IDLE;
  private startTime?: Date;
  private taskResults: Map<string, WorkflowResult> = new Map();

  constructor(config: OrchestratorRunnerConfig) {
    super();

    // Merge with defaults
    this.config = {
      llmClient: config.llmClient,
      workspaceDir: config.workspaceDir || process.cwd(),
      routingStrategy: config.routingStrategy || RoutingStrategy.LOAD_BALANCED,
      maxConcurrentTasks: config.maxConcurrentTasks || 10,
      taskTimeout: config.taskTimeout || 300000,
      enableLLM: config.enableLLM ?? true,
      projectContext: config.projectContext || '',
      useRealQualityTools: config.useRealQualityTools ?? false,
    };

    // Create workspace and queue
    this.workspace = new WorkspaceManager({
      baseDir: this.config.workspaceDir,
      autoCreate: true,
    });
    this.queue = new DocumentQueue(this.workspace);

    // Create LLM adapter
    this.llmAdapter = createTeamAgentLLMAdapter({
      client: this.config.llmClient,
    });

    // Create orchestrator
    this.orchestrator = new CEOOrchestrator({
      workspaceDir: this.config.workspaceDir,
      routingStrategy: this.config.routingStrategy,
      maxConcurrentTasks: this.config.maxConcurrentTasks,
      taskTimeout: this.config.taskTimeout,
      autoStartTeams: false, // We'll manage teams manually
      enableDecomposition: true,
    });

    this.setupEventHandlers();
  }

  /**
   * Get current status
   */
  get currentStatus(): RunnerStatus {
    return this.status;
  }

  /**
   * Get orchestrator status
   */
  get orchestratorStatus(): CEOStatus {
    return this.orchestrator.currentStatus;
  }

  /**
   * Get orchestrator instance
   */
  get ceoOrchestrator(): CEOOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get uptime in ms
   */
  get uptime(): number {
    return this.startTime ? Date.now() - this.startTime.getTime() : 0;
  }

  /**
   * Initialize and start the runner
   */
  async start(): Promise<void> {
    if (this.status === RunnerStatus.RUNNING) {
      return;
    }

    try {
      this.status = RunnerStatus.INITIALIZING;

      // Initialize workspace and queue
      await this.workspace.initialize();
      await this.queue.initialize();

      // Create and register team agents
      await this.initializeAgents();

      // Start orchestrator
      await this.orchestrator.start();

      this.startTime = new Date();
      this.status = RunnerStatus.RUNNING;
      this.emit('started');
    } catch (error) {
      this.status = RunnerStatus.ERROR;
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Stop the runner
   */
  async stop(): Promise<void> {
    if (this.status === RunnerStatus.STOPPED) {
      return;
    }

    try {
      this.status = RunnerStatus.STOPPING;

      // Stop orchestrator (which stops all teams)
      await this.orchestrator.stop();

      // Stop queue
      await this.queue.stop();

      this.status = RunnerStatus.STOPPED;
      this.emit('stopped');
    } catch (error) {
      this.status = RunnerStatus.ERROR;
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * Pause the runner
   */
  async pause(): Promise<void> {
    if (this.status !== RunnerStatus.RUNNING) {
      return;
    }

    await this.orchestrator.pause();
    this.status = RunnerStatus.PAUSED;
    this.emit('paused');
  }

  /**
   * Resume the runner
   */
  async resume(): Promise<void> {
    if (this.status !== RunnerStatus.PAUSED) {
      return;
    }

    await this.orchestrator.resume();
    this.status = RunnerStatus.RUNNING;
    this.emit('resumed');
  }

  /**
   * Execute a high-level goal
   *
   * This is the main entry point for running agent workflows.
   * The goal is decomposed into tasks and executed by appropriate teams.
   */
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
    if (this.status !== RunnerStatus.RUNNING) {
      throw new Error(`Runner is not running (status: ${this.status})`);
    }

    const goalId = `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    this.emit('goal:started', goalId);

    try {
      // Submit goal to orchestrator
      const tasks = await this.orchestrator.submitGoal(title, description, {
        priority: options?.priority,
        projectId: options?.projectId,
        tags: options?.tags,
      });

      const results: WorkflowResult[] = [];

      // If waitForCompletion, process tasks synchronously
      if (options?.waitForCompletion !== false) {
        for (const task of tasks) {
          const result = await this.executeTask(task);
          results.push(result);
        }
      } else {
        // Fire and forget - just record task IDs
        for (const task of tasks) {
          results.push({
            success: true,
            taskId: task.metadata.id,
            duration: 0,
            teamType: task.metadata.to,
          });
        }
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

      this.emit('error', err);
      return goalResult;
    }
  }

  /**
   * Execute a single task
   */
  async executeTask(task: TaskDocument): Promise<WorkflowResult> {
    const startTime = Date.now();
    const taskId = task.metadata.id;

    this.emit('workflow:started', taskId);

    try {
      // Get the appropriate team agent
      const team = this.orchestrator.teams.get(task.metadata.to);

      if (!team) {
        throw new Error(`No team registered for type: ${task.metadata.to}`);
      }

      // Execute the task with the team (cast to BaseTeamAgent to access processTask)
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

      this.taskResults.set(taskId, workflowResult);
      this.emit('workflow:completed', workflowResult);

      return workflowResult;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      const workflowResult: WorkflowResult = {
        success: false,
        taskId,
        error: err.message,
        duration: Date.now() - startTime,
        teamType: task.metadata.to,
      };

      this.taskResults.set(taskId, workflowResult);
      this.emit('workflow:failed', taskId, err);

      return workflowResult;
    }
  }

  /**
   * Submit a task directly to a specific team
   */
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
    if (this.status !== RunnerStatus.RUNNING) {
      throw new Error(`Runner is not running (status: ${this.status})`);
    }

    const taskType = this.getTaskTypeForTeam(teamType);

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
   * Get task result by ID
   */
  getTaskResult(taskId: string): WorkflowResult | undefined {
    return this.taskResults.get(taskId);
  }

  /**
   * Get all task results
   */
  getAllResults(): Map<string, WorkflowResult> {
    return new Map(this.taskResults);
  }

  /**
   * Get runner statistics
   */
  getStats(): {
    status: RunnerStatus;
    uptime: number;
    tasksExecuted: number;
    tasksSucceeded: number;
    tasksFailed: number;
    orchestratorStats: ReturnType<CEOOrchestrator['getStats']>;
  } {
    const results = Array.from(this.taskResults.values());

    return {
      status: this.status,
      uptime: this.uptime,
      tasksExecuted: results.length,
      tasksSucceeded: results.filter((r) => r.success).length,
      tasksFailed: results.filter((r) => !r.success).length,
      orchestratorStats: this.orchestrator.getStats(),
    };
  }

  /**
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    await this.stop();
    await this.orchestrator.destroy();
    this.taskResults.clear();
    this.removeAllListeners();
  }

  /**
   * Initialize team agents
   */
  private async initializeAgents(): Promise<void> {
    // Create Planning Agent
    this.planningAgent = createPlanningAgent(this.queue, {
      config: {
        maxConcurrentTasks: Math.ceil(this.config.maxConcurrentTasks / 3),
      },
    });

    if (this.config.enableLLM) {
      const planningExecutor = createPlanningLLMExecutor({
        adapter: this.llmAdapter,
        projectContext: this.config.projectContext,
      });
      this.planningAgent.setPlanGenerator(planningExecutor);
    }

    this.orchestrator.registerTeam(this.planningAgent);

    // Create Development Agent
    this.developmentAgent = createDevelopmentAgent(this.queue, {
      config: {
        maxConcurrentTasks: Math.ceil(this.config.maxConcurrentTasks / 2),
      },
    });

    if (this.config.enableLLM) {
      const devExecutor = createDevelopmentLLMExecutor({
        adapter: this.llmAdapter,
        projectContext: this.config.projectContext,
      });
      this.developmentAgent.setCodeExecutor(devExecutor);
    }

    this.orchestrator.registerTeam(this.developmentAgent);

    // Create QA Agent
    this.qaAgent = createQAAgent(this.queue, {
      config: {
        maxConcurrentTasks: Math.ceil(this.config.maxConcurrentTasks / 3),
      },
    });

    // Use real quality tools when enabled, otherwise fall back to LLM executor
    if (this.config.useRealQualityTools) {
      // Use real CodeQualityHook and TestResultParser
      const qaExecutor = createQAExecutor({
        workspaceDir: this.config.workspaceDir,
      });
      this.qaAgent.setQAExecutor(qaExecutor);
    } else if (this.config.enableLLM) {
      // Use LLM-powered executor
      const qaExecutor = createQALLMExecutor({
        adapter: this.llmAdapter,
        projectContext: this.config.projectContext,
      });
      this.qaAgent.setQAExecutor(qaExecutor);
    }

    this.orchestrator.registerTeam(this.qaAgent);

    // Start all agents
    await Promise.all([
      this.planningAgent.start(),
      this.developmentAgent.start(),
      this.qaAgent.start(),
    ]);
  }

  /**
   * Get task type for a team type
   */
  private getTaskTypeForTeam(teamType: TeamType): TaskType {
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
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Forward orchestrator events
    this.orchestrator.on('task:completed', (task, result) => {
      const workflowResult: WorkflowResult = {
        success: result.success,
        taskId: task.metadata.id,
        result: result.result,
        duration: 0,
        teamType: task.metadata.to,
      };
      this.taskResults.set(task.metadata.id, workflowResult);
    });

    this.orchestrator.on('task:failed', (task, error) => {
      const workflowResult: WorkflowResult = {
        success: false,
        taskId: task.metadata.id,
        error: error.message,
        duration: 0,
        teamType: task.metadata.to,
      };
      this.taskResults.set(task.metadata.id, workflowResult);
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
 * Create an orchestrator runner
 */
export function createOrchestratorRunner(config: OrchestratorRunnerConfig): OrchestratorRunner {
  return new OrchestratorRunner(config);
}

/**
 * Create a runner with mock LLM for testing
 */
export function createMockRunner(options?: {
  workspaceDir?: string;
  projectContext?: string;
}): OrchestratorRunner {
  // Create a simple mock LLM client
  const mockClient: ILLMClient = {
    getProvider: () => 'mock',
    getDefaultModel: () => 'mock-model',
    getMaxContextLength: () => 128000,
    chat: async (messages) => {
      const lastMessage = messages[messages.length - 1];
      const content = typeof lastMessage.content === 'string' ? lastMessage.content : '';

      // Generate mock response based on content
      let response: string;
      if (content.includes('planning') || content.includes('plan')) {
        const planOutput: PlanningOutput = {
          title: 'Mock Plan',
          summary: 'Mock planning output',
          tasks: [
            {
              title: 'Task 1',
              type: 'feature',
              targetTeam: 'development',
              description: 'First task',
            },
          ],
        };
        response = JSON.stringify(planOutput);
      } else if (content.includes('develop') || content.includes('implement')) {
        const devOutput: DevelopmentOutput = {
          summary: 'Mock development output',
          filesModified: [
            { path: 'src/test.ts', action: 'created', description: 'Test file' },
          ],
        };
        response = JSON.stringify(devOutput);
      } else if (content.includes('test') || content.includes('qa')) {
        const qaOutput: QAOutput = {
          summary: 'Mock QA output',
          approved: true,
          testResults: { total: 1, passed: 1, failed: 0, skipped: 0, tests: [] },
        };
        response = JSON.stringify(qaOutput);
      } else {
        response = JSON.stringify({ summary: 'Mock response' });
      }

      return {
        content: `\`\`\`json\n${response}\n\`\`\``,
        model: 'mock-model',
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        finishReason: 'stop',
      };
    },
    chatStream: async (messages, callback) => {
      const result = await mockClient.chat(messages);
      await callback({ content: result.content, isComplete: true, usage: result.usage });
      return result;
    },
  };

  return createOrchestratorRunner({
    llmClient: mockClient,
    workspaceDir: options?.workspaceDir,
    projectContext: options?.projectContext,
    enableLLM: true,
  });
}
