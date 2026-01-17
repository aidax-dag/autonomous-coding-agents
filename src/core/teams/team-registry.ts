/**
 * Team Registry
 *
 * Central registry for managing team instances in the Agent OS.
 * Provides team discovery, routing, and coordination capabilities.
 *
 * Feature: Team System
 */

import { EventEmitter } from 'events';
import {
  TeamType,
  TeamCapability,
  TeamStatus,
  TaskDocument,
  TeamMessage,
} from './team-types';
import { BaseTeam } from './base-team';

// ============================================================================
// Types
// ============================================================================

/**
 * Team registry configuration
 */
export interface TeamRegistryConfig {
  /** Enable automatic team discovery */
  autoDiscovery: boolean;
  /** Health check interval in ms */
  healthCheckIntervalMs: number;
  /** Maximum teams per type */
  maxTeamsPerType: number;
  /** Enable load balancing */
  loadBalancing: boolean;
  /** Load balancing strategy */
  loadBalancingStrategy: 'round_robin' | 'least_loaded' | 'capability_match';
}

/**
 * Team registry events
 */
export interface TeamRegistryEvents {
  'team:registered': (team: BaseTeam) => void;
  'team:unregistered': (teamId: string) => void;
  'team:status_changed': (teamId: string, status: TeamStatus) => void;
  'task:routed': (taskId: string, teamId: string) => void;
  'message:routed': (messageId: string, fromTeam: string, toTeam: string) => void;
  'error': (error: Error) => void;
}

/**
 * Team routing decision
 */
export interface RoutingDecision {
  /** Selected team ID */
  teamId: string;
  /** Routing score */
  score: number;
  /** Reasoning */
  reason: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_REGISTRY_CONFIG: TeamRegistryConfig = {
  autoDiscovery: true,
  healthCheckIntervalMs: 30000,
  maxTeamsPerType: 5,
  loadBalancing: true,
  loadBalancingStrategy: 'least_loaded',
};

// ============================================================================
// Team Registry
// ============================================================================

/**
 * Central registry for team management
 *
 * @example
 * ```typescript
 * const registry = new TeamRegistry();
 *
 * // Register teams
 * registry.register(planningTeam);
 * registry.register(developmentTeam);
 *
 * // Route task to appropriate team
 * const teamId = registry.routeTask(task);
 * ```
 */
export class TeamRegistry extends EventEmitter {
  /** Registry configuration */
  private readonly config: TeamRegistryConfig;

  /** Registered teams */
  private readonly teams: Map<string, BaseTeam> = new Map();

  /** Teams indexed by type */
  private readonly teamsByType: Map<TeamType, Set<string>> = new Map();

  /** Teams indexed by capability */
  private readonly teamsByCapability: Map<TeamCapability, Set<string>> = new Map();

  /** Round-robin counters for load balancing */
  private readonly roundRobinCounters: Map<string, number> = new Map();

  /** Health check interval */
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  /** Logger instance */
  private readonly logger: Console = console;

  constructor(config: Partial<TeamRegistryConfig> = {}) {
    super();
    this.config = { ...DEFAULT_REGISTRY_CONFIG, ...config };

    // Initialize type and capability maps
    for (const type of Object.values(TeamType)) {
      this.teamsByType.set(type, new Set());
    }
    for (const capability of Object.values(TeamCapability)) {
      this.teamsByCapability.set(capability, new Set());
    }
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Start the registry
   */
  start(): void {
    // Start health checks
    if (this.config.healthCheckIntervalMs > 0) {
      this.healthCheckInterval = setInterval(() => {
        this.performHealthChecks().catch((error) => {
          this.emit('error', error);
        });
      }, this.config.healthCheckIntervalMs);
    }
  }

  /**
   * Stop the registry
   */
  async stop(): Promise<void> {
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    // Stop all teams
    const stopPromises = Array.from(this.teams.values()).map((team) =>
      team.stop().catch((error) => {
        this.logger.error(`Error stopping team ${team.id}:`, error);
      })
    );

    await Promise.all(stopPromises);
  }

  // ============================================================================
  // Team Management
  // ============================================================================

  /**
   * Register a team
   */
  register(team: BaseTeam): void {
    if (this.teams.has(team.id)) {
      throw new Error(`Team ${team.id} is already registered`);
    }

    // Check max teams per type
    const typeTeams = this.teamsByType.get(team.type);
    if (typeTeams && typeTeams.size >= this.config.maxTeamsPerType) {
      throw new Error(
        `Maximum number of ${team.type} teams (${this.config.maxTeamsPerType}) reached`
      );
    }

    // Register team
    this.teams.set(team.id, team);

    // Index by type
    this.teamsByType.get(team.type)?.add(team.id);

    // Index by capabilities
    for (const capability of team.capabilities) {
      this.teamsByCapability.get(capability as TeamCapability)?.add(team.id);
    }

    // Setup event forwarding
    this.setupTeamEventForwarding(team);

    this.emit('team:registered', team);
  }

  /**
   * Unregister a team
   */
  unregister(teamId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) {
      return false;
    }

    // Remove from type index
    this.teamsByType.get(team.type)?.delete(teamId);

    // Remove from capability index
    for (const capability of team.capabilities) {
      this.teamsByCapability.get(capability as TeamCapability)?.delete(teamId);
    }

    // Remove from registry
    this.teams.delete(teamId);

    this.emit('team:unregistered', teamId);
    return true;
  }

  /**
   * Get a team by ID
   */
  getTeam(teamId: string): BaseTeam | undefined {
    return this.teams.get(teamId);
  }

  /**
   * Get all teams
   */
  getAllTeams(): BaseTeam[] {
    return Array.from(this.teams.values());
  }

  /**
   * Get teams by type
   */
  getTeamsByType(type: TeamType): BaseTeam[] {
    const teamIds = this.teamsByType.get(type);
    if (!teamIds) return [];

    return Array.from(teamIds)
      .map((id) => this.teams.get(id))
      .filter((team): team is BaseTeam => team !== undefined);
  }

  /**
   * Get teams by capability
   */
  getTeamsByCapability(capability: TeamCapability): BaseTeam[] {
    const teamIds = this.teamsByCapability.get(capability);
    if (!teamIds) return [];

    return Array.from(teamIds)
      .map((id) => this.teams.get(id))
      .filter((team): team is BaseTeam => team !== undefined);
  }

  /**
   * Get available teams (idle or working with capacity)
   */
  getAvailableTeams(): BaseTeam[] {
    return this.getAllTeams().filter((team) => {
      const status = team.getStatus();
      return (
        (status === TeamStatus.IDLE || status === TeamStatus.WORKING) &&
        team.getActiveTaskCount() < team.getConfig().maxConcurrentTasks
      );
    });
  }

  // ============================================================================
  // Task Routing
  // ============================================================================

  /**
   * Route a task to the best available team
   */
  routeTask(task: TaskDocument): RoutingDecision | null {
    const candidates = this.findCandidateTeams(task);
    if (candidates.length === 0) {
      return null;
    }

    const decision = this.selectBestTeam(candidates, task);
    if (decision) {
      this.emit('task:routed', task.id, decision.teamId);
    }

    return decision;
  }

  /**
   * Route a task and submit it to the selected team
   */
  async routeAndSubmitTask(task: TaskDocument): Promise<string | null> {
    const decision = this.routeTask(task);
    if (!decision) {
      return null;
    }

    const team = this.teams.get(decision.teamId);
    if (!team) {
      return null;
    }

    return team.submitTask(task);
  }

  /**
   * Find candidate teams for a task
   */
  private findCandidateTeams(task: TaskDocument): BaseTeam[] {
    // If task has assigned team, check if available
    if (task.assignedTeam) {
      const team = this.teams.get(task.assignedTeam);
      if (team && this.isTeamAvailable(team)) {
        return [team];
      }
    }

    // Find teams by task type
    const taskType = task.type as TeamType;
    const typeTeams = this.getTeamsByType(taskType);
    if (typeTeams.length > 0) {
      return typeTeams.filter((team) => this.isTeamAvailable(team));
    }

    // Find teams by required capabilities (inferred from task)
    const requiredCapabilities = this.inferRequiredCapabilities(task);
    const capabilityTeams = new Set<BaseTeam>();

    for (const capability of requiredCapabilities) {
      for (const team of this.getTeamsByCapability(capability)) {
        if (this.isTeamAvailable(team)) {
          capabilityTeams.add(team);
        }
      }
    }

    return Array.from(capabilityTeams);
  }

  /**
   * Select the best team from candidates
   */
  private selectBestTeam(candidates: BaseTeam[], task: TaskDocument): RoutingDecision | null {
    if (candidates.length === 0) {
      return null;
    }

    switch (this.config.loadBalancingStrategy) {
      case 'round_robin':
        return this.selectRoundRobin(candidates, task);
      case 'least_loaded':
        return this.selectLeastLoaded(candidates, task);
      case 'capability_match':
        return this.selectBestCapabilityMatch(candidates, task);
      default:
        return this.selectLeastLoaded(candidates, task);
    }
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(candidates: BaseTeam[], task: TaskDocument): RoutingDecision {
    const key = task.type;
    const counter = (this.roundRobinCounters.get(key) || 0) % candidates.length;
    this.roundRobinCounters.set(key, counter + 1);

    const team = candidates[counter];
    return {
      teamId: team.id,
      score: 1,
      reason: 'Round-robin selection',
    };
  }

  /**
   * Least-loaded selection
   */
  private selectLeastLoaded(candidates: BaseTeam[], _task: TaskDocument): RoutingDecision {
    let bestTeam = candidates[0];
    let lowestLoad = bestTeam.getActiveTaskCount() + bestTeam.getQueueLength();

    for (const team of candidates) {
      const load = team.getActiveTaskCount() + team.getQueueLength();
      if (load < lowestLoad) {
        lowestLoad = load;
        bestTeam = team;
      }
    }

    return {
      teamId: bestTeam.id,
      score: 1 / (lowestLoad + 1),
      reason: `Least loaded (${lowestLoad} tasks)`,
    };
  }

  /**
   * Best capability match selection
   */
  private selectBestCapabilityMatch(
    candidates: BaseTeam[],
    task: TaskDocument
  ): RoutingDecision {
    const requiredCapabilities = this.inferRequiredCapabilities(task);
    let bestTeam = candidates[0];
    let bestScore = 0;

    for (const team of candidates) {
      let score = 0;
      for (const capability of requiredCapabilities) {
        if (team.hasCapability(capability)) {
          score++;
        }
      }

      // Factor in availability
      const loadFactor = 1 / (team.getActiveTaskCount() + team.getQueueLength() + 1);
      score *= loadFactor;

      if (score > bestScore) {
        bestScore = score;
        bestTeam = team;
      }
    }

    return {
      teamId: bestTeam.id,
      score: bestScore,
      reason: `Best capability match (score: ${bestScore.toFixed(2)})`,
    };
  }

  /**
   * Infer required capabilities from task
   */
  private inferRequiredCapabilities(task: TaskDocument): TeamCapability[] {
    const capabilities: TeamCapability[] = [];
    const title = task.title.toLowerCase();
    const description = task.description.toLowerCase();
    const content = `${title} ${description}`;

    // Keyword-based capability inference
    if (content.includes('test') || content.includes('spec')) {
      capabilities.push(TeamCapability.TEST_GENERATION);
    }
    if (content.includes('code') || content.includes('implement') || content.includes('build')) {
      capabilities.push(TeamCapability.CODE_GENERATION);
    }
    if (content.includes('review') || content.includes('check')) {
      capabilities.push(TeamCapability.CODE_REVIEW);
    }
    if (content.includes('refactor') || content.includes('cleanup')) {
      capabilities.push(TeamCapability.REFACTORING);
    }
    if (content.includes('debug') || content.includes('fix')) {
      capabilities.push(TeamCapability.DEBUGGING);
    }
    if (content.includes('document') || content.includes('readme')) {
      capabilities.push(TeamCapability.DOCUMENTATION);
    }
    if (content.includes('security') || content.includes('vulnerability')) {
      capabilities.push(TeamCapability.SECURITY_ANALYSIS);
    }
    if (content.includes('deploy') || content.includes('infrastructure')) {
      capabilities.push(TeamCapability.DEPLOYMENT);
    }
    if (content.includes('plan') || content.includes('decompose') || content.includes('break down')) {
      capabilities.push(TeamCapability.TASK_DECOMPOSITION);
    }
    if (content.includes('architect') || content.includes('design')) {
      capabilities.push(TeamCapability.ARCHITECTURE_ANALYSIS);
    }

    return capabilities;
  }

  /**
   * Check if team is available
   */
  private isTeamAvailable(team: BaseTeam): boolean {
    const status = team.getStatus();
    const hasCapacity = team.getActiveTaskCount() < team.getConfig().maxConcurrentTasks;
    return (status === TeamStatus.IDLE || status === TeamStatus.WORKING) && hasCapacity;
  }

  // ============================================================================
  // Message Routing
  // ============================================================================

  /**
   * Route a message to the target team
   */
  async routeMessage(message: TeamMessage): Promise<boolean> {
    const targetTeam = this.teams.get(message.to);
    if (!targetTeam) {
      return false;
    }

    await targetTeam.receiveMessage(message);
    this.emit('message:routed', message.id, message.from, message.to);
    return true;
  }

  /**
   * Broadcast a message to all teams
   */
  async broadcastMessage(
    message: Omit<TeamMessage, 'to'>,
    filter?: (team: BaseTeam) => boolean
  ): Promise<number> {
    let count = 0;
    for (const team of this.teams.values()) {
      if (filter && !filter(team)) continue;

      await team.receiveMessage({ ...message, to: team.id } as TeamMessage);
      count++;
    }
    return count;
  }

  /**
   * Broadcast to teams of a specific type
   */
  async broadcastToType(type: TeamType, message: Omit<TeamMessage, 'to'>): Promise<number> {
    const teams = this.getTeamsByType(type);
    let count = 0;

    for (const team of teams) {
      await team.receiveMessage({ ...message, to: team.id } as TeamMessage);
      count++;
    }

    return count;
  }

  // ============================================================================
  // Health Monitoring
  // ============================================================================

  /**
   * Perform health checks on all teams
   */
  private async performHealthChecks(): Promise<void> {
    for (const team of this.teams.values()) {
      const status = team.getStatus();

      // Check for stuck teams
      const stats = team.getStats();
      const lastActivityMs = Date.now() - stats.lastActivity.getTime();

      if (
        status === TeamStatus.WORKING &&
        team.getActiveTaskCount() > 0 &&
        lastActivityMs > this.config.healthCheckIntervalMs * 3
      ) {
        this.logger.warn(`Team ${team.id} appears stuck (no activity for ${lastActivityMs}ms)`);
      }

      // Emit status changes
      this.emit('team:status_changed', team.id, status);
    }
  }

  /**
   * Get registry health summary
   */
  getHealthSummary(): {
    totalTeams: number;
    byStatus: Record<TeamStatus, number>;
    byType: Record<TeamType, number>;
    totalTasks: number;
    totalQueuedTasks: number;
  } {
    const byStatus: Record<TeamStatus, number> = {} as Record<TeamStatus, number>;
    const byType: Record<TeamType, number> = {} as Record<TeamType, number>;
    let totalTasks = 0;
    let totalQueuedTasks = 0;

    for (const status of Object.values(TeamStatus)) {
      byStatus[status] = 0;
    }
    for (const type of Object.values(TeamType)) {
      byType[type] = 0;
    }

    for (const team of this.teams.values()) {
      byStatus[team.getStatus()]++;
      byType[team.type]++;
      totalTasks += team.getActiveTaskCount();
      totalQueuedTasks += team.getQueueLength();
    }

    return {
      totalTeams: this.teams.size,
      byStatus,
      byType,
      totalTasks,
      totalQueuedTasks,
    };
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Setup event forwarding from team
   */
  private setupTeamEventForwarding(team: BaseTeam): void {
    team.on('team:status_changed', (teamId, status) => {
      this.emit('team:status_changed', teamId, status);
    });

    team.on('team:error', (teamId, error) => {
      this.logger.error(`Team ${teamId} error:`, error);
    });
  }

  // ============================================================================
  // Event Typing
  // ============================================================================

  override on<K extends keyof TeamRegistryEvents>(
    event: K,
    listener: TeamRegistryEvents[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof TeamRegistryEvents>(
    event: K,
    ...args: Parameters<TeamRegistryEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a team registry instance
 */
export function createTeamRegistry(config: Partial<TeamRegistryConfig> = {}): TeamRegistry {
  return new TeamRegistry(config);
}
