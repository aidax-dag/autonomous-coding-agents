/**
 * CEO Orchestrator
 *
 * High-level orchestrator that coordinates all team agents.
 * Acts as the "CEO" of the Agent OS, making strategic decisions
 * about task decomposition, routing, and resource allocation.
 *
 * Responsibilities:
 * - Task decomposition and delegation
 * - Cross-team coordination
 * - Resource management
 * - Progress tracking and reporting
 * - Error recovery and escalation
 *
 * Feature: Orchestrator Core for Agent OS
 */

import { EventEmitter } from 'events';
import {
  TaskDocument,
  TaskType,
  TeamType,
  TaskPriority,
  CreateTaskInput,
  TaskStatus,
} from '../workspace/task-document';
import { parseXMLPlan, validateXMLPlan } from '../workspace/xml-plan-format';
import { DocumentQueue } from '../workspace/document-queue';
import { WorkspaceManager } from '../workspace/workspace-manager';
import { TeamRegistry, ITeamRegistry } from './team-registry';
import { TaskRouter, RoutingStrategy, RoutingDecision } from './task-router';
import { ITeamAgent, TeamAgentStatus, TaskHandlerResult } from './team-agent';

/**
 * Orchestrator status
 */
export enum CEOStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  RUNNING = 'running',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  ERROR = 'error',
}

/**
 * Orchestrator configuration
 */
export interface CEOOrchestratorConfig {
  /** Workspace base directory */
  workspaceDir?: string;
  /** Default routing strategy */
  routingStrategy: RoutingStrategy;
  /** Maximum concurrent tasks across all teams */
  maxConcurrentTasks: number;
  /** Task timeout in ms */
  taskTimeout: number;
  /** Health check interval in ms */
  healthCheckInterval: number;
  /** Auto-start teams on orchestrator start */
  autoStartTeams: boolean;
  /** Enable task decomposition */
  enableDecomposition: boolean;
}

/**
 * Orchestrator statistics
 */
export interface CEOStats {
  status: CEOStatus;
  uptime: number;
  totalTasksSubmitted: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  activeTeams: number;
  pendingTasks: number;
  inProgressTasks: number;
  teamStats: Map<TeamType, {
    tasksAssigned: number;
    tasksCompleted: number;
    tasksFailed: number;
    currentLoad: number;
  }>;
}

/**
 * Orchestrator events
 */
export interface CEOEvents {
  'started': () => void;
  'stopped': () => void;
  'paused': () => void;
  'resumed': () => void;
  'task:submitted': (task: TaskDocument) => void;
  'task:routed': (task: TaskDocument, decision: RoutingDecision) => void;
  'task:completed': (task: TaskDocument, result: TaskHandlerResult) => void;
  'task:failed': (task: TaskDocument, error: Error) => void;
  'task:decomposed': (parent: TaskDocument, children: TaskDocument[]) => void;
  'team:registered': (team: ITeamAgent) => void;
  'team:unregistered': (teamType: TeamType) => void;
  'error': (error: Error) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: CEOOrchestratorConfig = {
  routingStrategy: RoutingStrategy.LOAD_BALANCED,
  maxConcurrentTasks: 20,
  taskTimeout: 300000, // 5 minutes
  healthCheckInterval: 30000, // 30 seconds
  autoStartTeams: true,
  enableDecomposition: true,
};

/**
 * CEO Orchestrator
 */
export class CEOOrchestrator extends EventEmitter {
  private readonly config: CEOOrchestratorConfig;
  private readonly workspace: WorkspaceManager;
  private readonly queue: DocumentQueue;
  private readonly registry: TeamRegistry;
  private readonly router: TaskRouter;

  private status: CEOStatus = CEOStatus.STOPPED;
  private startTime?: Date;
  private healthCheckTimer?: ReturnType<typeof setInterval>;

  // Statistics
  private totalSubmitted = 0;
  private totalCompleted = 0;
  private totalFailed = 0;
  private teamTaskStats: Map<TeamType, { assigned: number; completed: number; failed: number }> =
    new Map();

  constructor(config?: Partial<CEOOrchestratorConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize components
    this.workspace = new WorkspaceManager({
      baseDir: this.config.workspaceDir,
      autoCreate: true,
    });
    this.queue = new DocumentQueue(this.workspace);
    this.registry = new TeamRegistry();
    this.router = new TaskRouter(this.registry, this.queue, {
      defaultStrategy: this.config.routingStrategy,
    });

    // Wire up events
    this.setupEventHandlers();
  }

  /**
   * Get current status
   */
  get currentStatus(): CEOStatus {
    return this.status;
  }

  /**
   * Get team registry
   */
  get teams(): ITeamRegistry {
    return this.registry;
  }

  /**
   * Get document queue
   */
  get taskQueue(): DocumentQueue {
    return this.queue;
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.status === CEOStatus.RUNNING) {
      return;
    }

    try {
      this.status = CEOStatus.STARTING;

      // Initialize workspace and queue
      await this.workspace.initialize();
      await this.queue.initialize();

      // Start all registered teams if configured
      if (this.config.autoStartTeams) {
        await this.registry.startAll();
      }

      // Start health check
      this.startHealthCheck();

      this.startTime = new Date();
      this.status = CEOStatus.RUNNING;
      this.emit('started');
    } catch (error) {
      this.status = CEOStatus.ERROR;
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    if (this.status === CEOStatus.STOPPED) {
      return;
    }

    try {
      this.status = CEOStatus.STOPPING;

      // Stop health check
      this.stopHealthCheck();

      // Stop all teams
      await this.registry.stopAll();

      // Stop queue
      await this.queue.stop();

      this.status = CEOStatus.STOPPED;
      this.emit('stopped');
    } catch (error) {
      this.status = CEOStatus.ERROR;
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Pause the orchestrator
   */
  async pause(): Promise<void> {
    if (this.status !== CEOStatus.RUNNING) {
      return;
    }

    this.status = CEOStatus.PAUSED;
    this.stopHealthCheck();
    this.emit('paused');
  }

  /**
   * Resume the orchestrator
   */
  async resume(): Promise<void> {
    if (this.status !== CEOStatus.PAUSED) {
      return;
    }

    this.status = CEOStatus.RUNNING;
    this.startHealthCheck();
    this.emit('resumed');
  }

  /**
   * Register a team agent
   */
  registerTeam(team: ITeamAgent): void {
    this.registry.register(team);
    this.teamTaskStats.set(team.teamType, { assigned: 0, completed: 0, failed: 0 });
    this.emit('team:registered', team);
  }

  /**
   * Unregister a team agent
   */
  unregisterTeam(teamType: TeamType): boolean {
    const result = this.registry.unregister(teamType);
    if (result) {
      this.teamTaskStats.delete(teamType);
      this.emit('team:unregistered', teamType);
    }
    return result;
  }

  /**
   * Submit a task for processing
   */
  async submitTask(input: CreateTaskInput): Promise<TaskDocument> {
    if (this.status !== CEOStatus.RUNNING) {
      throw new Error(`Orchestrator is not running (status: ${this.status})`);
    }

    // Route the task
    const task = await this.router.route(input);

    this.totalSubmitted++;
    const stats = this.teamTaskStats.get(task.metadata.to);
    if (stats) {
      stats.assigned++;
    }

    this.emit('task:submitted', task);
    return task;
  }

  /**
   * Submit a high-level goal and decompose into sub-tasks
   */
  async submitGoal(
    title: string,
    description: string,
    options?: {
      priority?: TaskPriority;
      projectId?: string;
      tags?: string[];
    }
  ): Promise<TaskDocument[]> {
    if (!this.config.enableDecomposition) {
      // Create single task
      const task = await this.submitTask({
        title,
        type: 'planning',
        from: 'orchestrator',
        to: 'planning',
        priority: options?.priority || 'medium',
        projectId: options?.projectId,
        tags: options?.tags || [],
        content: description,
      });
      return [task];
    }

    // Create planning task first
    const planningTask = await this.submitTask({
      title: `Plan: ${title}`,
      type: 'planning',
      from: 'orchestrator',
      to: 'planning',
      priority: options?.priority || 'high',
      projectId: options?.projectId,
      tags: [...(options?.tags || []), 'goal', 'decomposition'],
      content: `## Goal\n\n${title}\n\n## Description\n\n${description}\n\n## Instructions\n\nDecompose this goal into actionable tasks for the appropriate teams.`,
    });

    return [planningTask];
  }

  /**
   * Delegate sub-tasks from a parent task
   */
  async delegateTasks(
    parentTask: TaskDocument,
    subTasks: Array<{
      title: string;
      type: TaskType;
      targetTeam?: TeamType;
      priority?: TaskPriority;
      content?: string;
    }>
  ): Promise<TaskDocument[]> {
    const createdTasks: TaskDocument[] = [];

    for (const subTask of subTasks) {
      const task = await this.submitTask({
        title: subTask.title,
        type: subTask.type,
        from: parentTask.metadata.to,
        to: subTask.targetTeam || this.router.getSuggestedTeam(subTask.type) || 'development',
        priority: subTask.priority || parentTask.metadata.priority,
        parentTaskId: parentTask.metadata.id,
        projectId: parentTask.metadata.projectId,
        tags: [...parentTask.metadata.tags, 'delegated'],
        content: subTask.content || '',
      });
      createdTasks.push(task);
    }

    this.emit('task:decomposed', parentTask, createdTasks);
    return createdTasks;
  }

  /**
   * Execute a structured XML plan by parsing steps and creating tasks.
   *
   * @returns Array of tasks created from the plan, or empty if invalid XML
   */
  async executeXMLPlan(
    xml: string,
    options?: {
      priority?: TaskPriority;
      projectId?: string;
      tags?: string[];
    }
  ): Promise<TaskDocument[]> {
    const validation = validateXMLPlan(xml);
    if (!validation.valid) {
      this.emit('error', new Error(`Invalid XML plan: ${validation.errors.join(', ')}`));
      return [];
    }

    const plan = parseXMLPlan(xml);
    const tasks: TaskDocument[] = [];

    for (const step of plan.steps) {
      const taskType = mapActionToTaskType(step.action);
      const targetTeam = this.router.getSuggestedTeam(taskType) || 'development';

      const task = await this.submitTask({
        title: `[${plan.title}] Step ${step.id}: ${step.description || step.action}`,
        type: taskType,
        from: 'orchestrator',
        to: targetTeam,
        priority: options?.priority || 'medium',
        projectId: options?.projectId,
        tags: [...(options?.tags || []), 'xml-plan', `step-${step.id}`],
        content: `Action: ${step.action}\nTarget: ${step.target}\n${step.description || ''}`,
      });

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): CEOStats {
    const teamStats = new Map<TeamType, {
      tasksAssigned: number;
      tasksCompleted: number;
      tasksFailed: number;
      currentLoad: number;
    }>();

    for (const [teamType, stats] of this.teamTaskStats) {
      const team = this.registry.get(teamType);
      teamStats.set(teamType, {
        tasksAssigned: stats.assigned,
        tasksCompleted: stats.completed,
        tasksFailed: stats.failed,
        currentLoad: team?.getLoad() || 0,
      });
    }

    return {
      status: this.status,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      totalTasksSubmitted: this.totalSubmitted,
      totalTasksCompleted: this.totalCompleted,
      totalTasksFailed: this.totalFailed,
      activeTeams: this.registry.getTeamsByStatus(TeamAgentStatus.PROCESSING).length,
      pendingTasks: 0, // Would need to query queue
      inProgressTasks: 0, // Would need to query queue
      teamStats,
    };
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskDocument | null> {
    return this.queue.getTask(taskId);
  }

  /**
   * Get tasks with filter
   */
  async getTasks(filter?: {
    status?: TaskStatus[];
    type?: TaskType[];
    team?: TeamType[];
  }): Promise<TaskDocument[]> {
    return this.queue.getTasks({
      status: filter?.status,
      type: filter?.type,
      to: filter?.team,
    });
  }

  /**
   * Health check for all teams
   */
  async healthCheck(): Promise<Map<TeamType, { healthy: boolean; status: TeamAgentStatus }>> {
    const results = new Map<TeamType, { healthy: boolean; status: TeamAgentStatus }>();

    for (const team of this.registry.getAll()) {
      try {
        const health = await team.healthCheck();
        results.set(team.teamType, { healthy: health.healthy, status: health.status });
      } catch {
        results.set(team.teamType, { healthy: false, status: TeamAgentStatus.ERROR });
      }
    }

    return results;
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    // Queue events
    this.queue.on('task:completed', (task) => {
      this.totalCompleted++;
      const stats = this.teamTaskStats.get(task.metadata.to);
      if (stats) {
        stats.completed++;
      }
      this.emit('task:completed', task, { success: true });
    });

    this.queue.on('task:failed', (task, error) => {
      this.totalFailed++;
      const stats = this.teamTaskStats.get(task.metadata.to);
      if (stats) {
        stats.failed++;
      }
      this.emit('task:failed', task, error);
    });

    // Router events
    this.router.on('task:routed', (task, decision) => {
      this.emit('task:routed', task, decision);
    });

    this.router.on('task:routing-failed', (task, error) => {
      this.emit('task:failed', task, error);
    });

    // Registry events
    this.registry.on('team:error', (team, error) => {
      this.emit('error', new Error(`Team ${team.teamType} error: ${error.message}`));
    });
  }

  /**
   * Start health check timer
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Stop health check timer
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    await this.stop();
    this.registry.destroy();
    this.removeAllListeners();
  }
}

// Type-safe event emitter
export interface CEOOrchestrator {
  on<E extends keyof CEOEvents>(event: E, listener: CEOEvents[E]): this;
  emit<E extends keyof CEOEvents>(event: E, ...args: Parameters<CEOEvents[E]>): boolean;
}

/**
 * Create a pre-configured orchestrator
 */
export function createOrchestrator(config?: Partial<CEOOrchestratorConfig>): CEOOrchestrator {
  return new CEOOrchestrator(config);
}

/**
 * Map XML plan step action to a TaskType.
 */
function mapActionToTaskType(action: string): TaskType {
  switch (action) {
    case 'create':
    case 'modify':
    case 'refactor':
      return 'feature';
    case 'test':
      return 'test';
    case 'review':
      return 'review';
    case 'plan':
      return 'planning';
    case 'design':
      return 'design';
    case 'deploy':
    case 'configure':
      return 'infrastructure';
    default:
      return 'feature';
  }
}
