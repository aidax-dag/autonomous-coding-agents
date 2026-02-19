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
 * Routing strategy contract
 *
 * Strategy implementations can be registered at runtime to extend routing
 * behavior without modifying TaskRouter internals.
 */
export interface IRoutingStrategy {
  /** Strategy identifier */
  readonly type: RoutingStrategy;
  /** Resolve a routing decision for a task context */
  route(taskType: TaskType, priority: TaskPriority): RoutingDecision | null;
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

interface RoutingStrategyDeps {
  routeByCapability: (taskType: TaskType) => RoutingDecision | null;
  routeByLoad: (taskType: TaskType) => RoutingDecision | null;
  routeByPriority: (taskType: TaskType, priority: TaskPriority) => RoutingDecision | null;
  routeRoundRobin: (taskType: TaskType) => RoutingDecision | null;
}

class CapabilityMatchStrategy implements IRoutingStrategy {
  readonly type = RoutingStrategy.CAPABILITY_MATCH;

  constructor(private readonly deps: RoutingStrategyDeps) {}

  route(taskType: TaskType, _priority: TaskPriority): RoutingDecision | null {
    return this.deps.routeByCapability(taskType);
  }
}

class LoadBalancedStrategy implements IRoutingStrategy {
  readonly type = RoutingStrategy.LOAD_BALANCED;

  constructor(private readonly deps: RoutingStrategyDeps) {}

  route(taskType: TaskType, _priority: TaskPriority): RoutingDecision | null {
    return this.deps.routeByLoad(taskType);
  }
}

class PriorityBasedStrategy implements IRoutingStrategy {
  readonly type = RoutingStrategy.PRIORITY_BASED;

  constructor(private readonly deps: RoutingStrategyDeps) {}

  route(taskType: TaskType, priority: TaskPriority): RoutingDecision | null {
    return this.deps.routeByPriority(taskType, priority);
  }
}

class RoundRobinStrategy implements IRoutingStrategy {
  readonly type = RoutingStrategy.ROUND_ROBIN;

  constructor(private readonly deps: RoutingStrategyDeps) {}

  route(taskType: TaskType, _priority: TaskPriority): RoutingDecision | null {
    return this.deps.routeRoundRobin(taskType);
  }
}

function createRoutingStrategies(deps: RoutingStrategyDeps): Map<RoutingStrategy, IRoutingStrategy> {
  const strategies: IRoutingStrategy[] = [
    new CapabilityMatchStrategy(deps),
    new LoadBalancedStrategy(deps),
    new PriorityBasedStrategy(deps),
    new RoundRobinStrategy(deps),
  ];

  return new Map(strategies.map((strategy) => [strategy.type, strategy]));
}

/**
 * Task Router
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TaskRouter extends EventEmitter {
  private readonly registry: ITeamRegistry;
  private readonly queue: DocumentQueue;
  private readonly config: TaskRouterConfig;
  private roundRobinIndex: Map<TaskType, number> = new Map();
  private readonly strategyRegistry: Map<RoutingStrategy, IRoutingStrategy>;

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

    this.strategyRegistry = createRoutingStrategies({
      routeByCapability: (taskType) => this.routeByCapability(taskType),
      routeByLoad: (taskType) => this.routeByLoad(taskType),
      routeByPriority: (taskType, priority) => this.routeByPriority(taskType, priority),
      routeRoundRobin: (taskType) => this.routeRoundRobin(taskType),
    });
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
    const selectedStrategy = this.strategyRegistry.get(strategy)
      ?? this.strategyRegistry.get(this.config.defaultStrategy)
      ?? this.strategyRegistry.get(RoutingStrategy.CAPABILITY_MATCH);

    if (!selectedStrategy) {
      return null;
    }

    return selectedStrategy.route(taskType, priority);
  }

  /**
   * Register or override a routing strategy implementation.
   */
  registerStrategy(strategy: IRoutingStrategy): void {
    this.strategyRegistry.set(strategy.type, strategy);
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
    const teamCandidates = this.registry.findTeamsForTaskType(taskType);
    if (teamCandidates.length === 0) {
      return this.routeByDefaultMapping(taskType, RoutingStrategy.LOAD_BALANCED);
    }

    const availableCandidates = teamCandidates.filter((candidate) => this.isCandidateAvailable(candidate));
    if (availableCandidates.length === 0) {
      return this.createOverloadedDecision(teamCandidates);
    }

    return this.createAvailableDecision(availableCandidates);
  }

  private isCandidateAvailable(candidate: ReturnType<ITeamRegistry['findTeamsForTaskType']>[number]): boolean {
    return candidate.team.getLoad() < this.config.loadThreshold
      && (candidate.team.status === TeamAgentStatus.IDLE
      || candidate.team.status === TeamAgentStatus.PROCESSING);
  }

  private sortCandidatesByLoad(
    candidates: ReturnType<ITeamRegistry['findTeamsForTaskType']>,
  ): ReturnType<ITeamRegistry['findTeamsForTaskType']> {
    return [...candidates].sort((candidateA, candidateB) => candidateA.team.getLoad() - candidateB.team.getLoad());
  }

  private sortAvailableCandidates(
    candidates: ReturnType<ITeamRegistry['findTeamsForTaskType']>,
  ): ReturnType<ITeamRegistry['findTeamsForTaskType']> {
    return [...candidates].sort((candidateA, candidateB) => {
      const loadDiff = candidateA.team.getLoad() - candidateB.team.getLoad();
      if (Math.abs(loadDiff) < 0.1) {
        // Similar load, prefer higher capability score
        return candidateB.score - candidateA.score;
      }
      return loadDiff;
    });
  }

  private createOverloadedDecision(
    candidates: ReturnType<ITeamRegistry['findTeamsForTaskType']>,
  ): RoutingDecision {
    const sortedCandidates = this.sortCandidatesByLoad(candidates);
    const selectedCandidate = sortedCandidates[0];

    return {
      targetTeam: selectedCandidate.team.teamType,
      strategy: RoutingStrategy.LOAD_BALANCED,
      confidence: 0.5,
      alternatives: sortedCandidates.slice(1).map((candidate) => candidate.team.teamType),
      reason: `All teams loaded, picked least loaded: ${selectedCandidate.team.teamType} (${Math.round(selectedCandidate.team.getLoad() * 100)}%)`,
    };
  }

  private createAvailableDecision(
    availableCandidates: ReturnType<ITeamRegistry['findTeamsForTaskType']>,
  ): RoutingDecision {
    const sortedCandidates = this.sortAvailableCandidates(availableCandidates);
    const selectedCandidate = sortedCandidates[0];

    return {
      targetTeam: selectedCandidate.team.teamType,
      strategy: RoutingStrategy.LOAD_BALANCED,
      confidence: (1 - selectedCandidate.team.getLoad()) * (selectedCandidate.score / 100),
      alternatives: sortedCandidates.slice(1).map((candidate) => candidate.team.teamType),
      reason: `Load balanced selection: ${selectedCandidate.team.teamType} (${Math.round(selectedCandidate.team.getLoad() * 100)}% load)`,
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
