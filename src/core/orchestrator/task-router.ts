/**
 * Task Router
 *
 * Routes tasks between teams based on task type, team capabilities,
 * and current load. Integrates with DocumentQueue for file-based messaging.
 *
 * Routing Strategies:
 * - CAPABILITY_MATCH: Route to team with matching capability
 * - LOAD_BALANCED: Route to least loaded capable team
 * - PRIORITY_BASED: Route based on task priority
 * - ROUND_ROBIN: Distribute evenly across capable teams
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
} from '../workspace/task-document';
import { DocumentQueue } from '../workspace/document-queue';
import { ITeamRegistry } from './team-registry';
import { TeamAgentStatus } from './team-agent';

/**
 * Routing strategy
 */
export enum RoutingStrategy {
  CAPABILITY_MATCH = 'capability_match',
  LOAD_BALANCED = 'load_balanced',
  PRIORITY_BASED = 'priority_based',
  ROUND_ROBIN = 'round_robin',
}

/**
 * Router configuration
 */
export interface TaskRouterConfig {
  /** Default routing strategy */
  defaultStrategy: RoutingStrategy;
  /** Enable automatic routing based on task type */
  autoRoute: boolean;
  /** Maximum routing attempts before giving up */
  maxRoutingAttempts: number;
  /** Delay between routing attempts in ms */
  routingRetryDelay: number;
  /** Load threshold for load balancing (0-1) */
  loadThreshold: number;
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  /** Target team */
  targetTeam: TeamType;
  /** Routing strategy used */
  strategy: RoutingStrategy;
  /** Confidence score (0-1) */
  confidence: number;
  /** Alternative teams considered */
  alternatives: TeamType[];
  /** Reason for decision */
  reason: string;
}

/**
 * Router events
 */
export interface RouterEvents {
  'task:routed': (task: TaskDocument, decision: RoutingDecision) => void;
  'task:routing-failed': (task: TaskDocument, error: Error) => void;
  'task:rerouted': (task: TaskDocument, from: TeamType, to: TeamType) => void;
  'error': (error: Error) => void;
}

/**
 * Task type to team mapping
 */
const TASK_TYPE_TEAM_MAP: Record<TaskType, TeamType[]> = {
  feature: ['development', 'frontend', 'backend'],
  bugfix: ['development', 'frontend', 'backend', 'issue-response'],
  refactor: ['development', 'code-quality'],
  test: ['qa'],
  review: ['code-quality', 'qa'],
  documentation: ['pm', 'development'],
  infrastructure: ['infrastructure'],
  analysis: ['planning', 'orchestrator'],
  planning: ['planning', 'orchestrator'],
  design: ['design'],
};

/**
 * Priority-based team preference
 */
const PRIORITY_TEAM_ORDER: Record<TaskPriority, TeamType[]> = {
  critical: ['issue-response', 'development', 'orchestrator'],
  high: ['development', 'frontend', 'backend'],
  medium: ['development', 'planning'],
  low: ['development', 'pm'],
};

/**
 * Task Router
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TaskRouter extends EventEmitter {
  private readonly registry: ITeamRegistry;
  private readonly queue: DocumentQueue;
  private readonly config: TaskRouterConfig;
  private roundRobinIndex: Map<TaskType, number> = new Map();

  constructor(
    registry: ITeamRegistry,
    queue: DocumentQueue,
    config?: Partial<TaskRouterConfig>
  ) {
    super();
    this.registry = registry;
    this.queue = queue;
    this.config = {
      defaultStrategy: config?.defaultStrategy ?? RoutingStrategy.LOAD_BALANCED,
      autoRoute: config?.autoRoute ?? true,
      maxRoutingAttempts: config?.maxRoutingAttempts ?? 3,
      routingRetryDelay: config?.routingRetryDelay ?? 1000,
      loadThreshold: config?.loadThreshold ?? 0.8,
    };
  }

  /**
   * Route a task to the appropriate team
   */
  async route(input: CreateTaskInput, strategy?: RoutingStrategy): Promise<TaskDocument> {
    const effectiveStrategy = strategy || this.config.defaultStrategy;

    // Make routing decision
    const decision = this.makeRoutingDecision(input.type, input.priority, effectiveStrategy);

    if (!decision) {
      const error = new Error(`No team available to handle task type: ${input.type}`);
      this.emit('task:routing-failed', { metadata: input } as TaskDocument, error);
      throw error;
    }

    // Create task with routing decision
    const task = await this.queue.publish({
      ...input,
      to: decision.targetTeam,
    });

    this.emit('task:routed', task, decision);
    return task;
  }

  /**
   * Reroute a task to a different team
   */
  async reroute(
    taskId: string,
    newTeam: TeamType,
    reason?: string
  ): Promise<TaskDocument | null> {
    const task = await this.queue.getTask(taskId);
    if (!task) {
      return null;
    }

    const oldTeam = task.metadata.to;

    // Create new task for the new team
    const reroutedTask = await this.queue.publish({
      title: task.metadata.title,
      type: task.metadata.type,
      from: oldTeam,
      to: newTeam,
      priority: task.metadata.priority,
      parentTaskId: task.metadata.parentTaskId,
      projectId: task.metadata.projectId,
      tags: [...task.metadata.tags, 'rerouted'],
      content: task.content + (reason ? `\n\n## Rerouted\n\nReason: ${reason}` : ''),
    });

    this.emit('task:rerouted', reroutedTask, oldTeam, newTeam);
    return reroutedTask;
  }

  /**
   * Make a routing decision
   */
  makeRoutingDecision(
    taskType: TaskType,
    priority: TaskPriority = 'medium',
    strategy: RoutingStrategy = this.config.defaultStrategy
  ): RoutingDecision | null {
    switch (strategy) {
      case RoutingStrategy.CAPABILITY_MATCH:
        return this.routeByCapability(taskType);
      case RoutingStrategy.LOAD_BALANCED:
        return this.routeByLoad(taskType);
      case RoutingStrategy.PRIORITY_BASED:
        return this.routeByPriority(taskType, priority);
      case RoutingStrategy.ROUND_ROBIN:
        return this.routeRoundRobin(taskType);
      default:
        return this.routeByCapability(taskType);
    }
  }

  /**
   * Route by capability match
   */
  private routeByCapability(taskType: TaskType): RoutingDecision | null {
    const results = this.registry.findTeamsForTaskType(taskType);

    if (results.length === 0) {
      // Fall back to default team mapping
      return this.routeByDefaultMapping(taskType, RoutingStrategy.CAPABILITY_MATCH);
    }

    const best = results[0];
    const alternatives = results.slice(1).map((r) => r.team.teamType);

    return {
      targetTeam: best.team.teamType,
      strategy: RoutingStrategy.CAPABILITY_MATCH,
      confidence: best.score / 100,
      alternatives,
      reason: `Matched capability: ${best.capability.name}`,
    };
  }

  /**
   * Route by load balancing
   */
  private routeByLoad(taskType: TaskType): RoutingDecision | null {
    const results = this.registry.findTeamsForTaskType(taskType);

    if (results.length === 0) {
      return this.routeByDefaultMapping(taskType, RoutingStrategy.LOAD_BALANCED);
    }

    // Filter by available teams under load threshold
    const available = results.filter(
      (r) =>
        r.team.getLoad() < this.config.loadThreshold &&
        (r.team.status === TeamAgentStatus.IDLE ||
          r.team.status === TeamAgentStatus.PROCESSING)
    );

    if (available.length === 0) {
      // All teams are loaded, pick the least loaded
      const sorted = results.sort((a, b) => a.team.getLoad() - b.team.getLoad());
      const best = sorted[0];

      return {
        targetTeam: best.team.teamType,
        strategy: RoutingStrategy.LOAD_BALANCED,
        confidence: 0.5,
        alternatives: sorted.slice(1).map((r) => r.team.teamType),
        reason: `All teams loaded, picked least loaded: ${best.team.teamType} (${Math.round(best.team.getLoad() * 100)}%)`,
      };
    }

    // Sort by load (lowest first) then by capability score
    const sorted = available.sort((a, b) => {
      const loadDiff = a.team.getLoad() - b.team.getLoad();
      if (Math.abs(loadDiff) < 0.1) {
        // Similar load, prefer higher capability score
        return b.score - a.score;
      }
      return loadDiff;
    });

    const best = sorted[0];

    return {
      targetTeam: best.team.teamType,
      strategy: RoutingStrategy.LOAD_BALANCED,
      confidence: (1 - best.team.getLoad()) * (best.score / 100),
      alternatives: sorted.slice(1).map((r) => r.team.teamType),
      reason: `Load balanced selection: ${best.team.teamType} (${Math.round(best.team.getLoad() * 100)}% load)`,
    };
  }

  /**
   * Route by priority
   */
  private routeByPriority(taskType: TaskType, priority: TaskPriority): RoutingDecision | null {
    const priorityTeams = PRIORITY_TEAM_ORDER[priority] || [];

    // Find first available team from priority list that can handle the task
    for (const teamType of priorityTeams) {
      const team = this.registry.get(teamType);
      if (team && team.canHandle(taskType) && team.getLoad() < this.config.loadThreshold) {
        return {
          targetTeam: teamType,
          strategy: RoutingStrategy.PRIORITY_BASED,
          confidence: 0.8,
          alternatives: priorityTeams.filter((t) => t !== teamType),
          reason: `Priority-based routing for ${priority} task`,
        };
      }
    }

    // Fall back to capability match
    return this.routeByCapability(taskType);
  }

  /**
   * Route using round robin
   */
  private routeRoundRobin(taskType: TaskType): RoutingDecision | null {
    const results = this.registry.findTeamsForTaskType(taskType);

    if (results.length === 0) {
      return this.routeByDefaultMapping(taskType, RoutingStrategy.ROUND_ROBIN);
    }

    // Get current index for this task type
    const currentIndex = this.roundRobinIndex.get(taskType) || 0;
    const nextIndex = (currentIndex + 1) % results.length;
    this.roundRobinIndex.set(taskType, nextIndex);

    const selected = results[currentIndex % results.length];

    return {
      targetTeam: selected.team.teamType,
      strategy: RoutingStrategy.ROUND_ROBIN,
      confidence: 0.7,
      alternatives: results.filter((r) => r !== selected).map((r) => r.team.teamType),
      reason: `Round robin selection (index: ${currentIndex})`,
    };
  }

  /**
   * Route by default task type mapping
   */
  private routeByDefaultMapping(
    taskType: TaskType,
    strategy: RoutingStrategy
  ): RoutingDecision | null {
    const defaultTeams = TASK_TYPE_TEAM_MAP[taskType] || [];

    if (defaultTeams.length === 0) {
      return null;
    }

    // Find first available team from default list
    for (const teamType of defaultTeams) {
      const team = this.registry.get(teamType);
      if (team && team.status !== TeamAgentStatus.STOPPED && team.status !== TeamAgentStatus.ERROR) {
        return {
          targetTeam: teamType,
          strategy,
          confidence: 0.5,
          alternatives: defaultTeams.filter((t) => t !== teamType),
          reason: `Default mapping for task type: ${taskType}`,
        };
      }
    }

    // Return first default even if team not registered
    return {
      targetTeam: defaultTeams[0],
      strategy,
      confidence: 0.3,
      alternatives: defaultTeams.slice(1),
      reason: `Fallback to default team (team may not be registered)`,
    };
  }

  /**
   * Get suggested team for a task type
   */
  getSuggestedTeam(taskType: TaskType): TeamType | null {
    const decision = this.makeRoutingDecision(taskType);
    return decision?.targetTeam || null;
  }

  /**
   * Get all possible teams for a task type
   */
  getPossibleTeams(taskType: TaskType): TeamType[] {
    const registeredTeams = this.registry
      .findTeamsForTaskType(taskType)
      .map((r) => r.team.teamType);

    const defaultTeams = TASK_TYPE_TEAM_MAP[taskType] || [];

    // Combine and deduplicate
    const allTeams = new Set([...registeredTeams, ...defaultTeams]);
    return Array.from(allTeams);
  }

  /**
   * Validate routing configuration
   */
  validateRouting(taskType: TaskType): {
    valid: boolean;
    hasRegisteredTeam: boolean;
    hasDefaultMapping: boolean;
    availableTeams: TeamType[];
  } {
    const registeredTeams = this.registry
      .findTeamsForTaskType(taskType)
      .map((r) => r.team.teamType);

    const defaultTeams = TASK_TYPE_TEAM_MAP[taskType] || [];

    return {
      valid: registeredTeams.length > 0 || defaultTeams.length > 0,
      hasRegisteredTeam: registeredTeams.length > 0,
      hasDefaultMapping: defaultTeams.length > 0,
      availableTeams: [...new Set([...registeredTeams, ...defaultTeams])],
    };
  }
}

// Type-safe event emitter
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TaskRouter {
  on<E extends keyof RouterEvents>(event: E, listener: RouterEvents[E]): this;
  emit<E extends keyof RouterEvents>(event: E, ...args: Parameters<RouterEvents[E]>): boolean;
}
