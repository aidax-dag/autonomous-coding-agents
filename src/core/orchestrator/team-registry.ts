/**
 * Team Registry
 *
 * Manages registration, discovery, and lifecycle of team agents.
 * Provides centralized access to all teams and their capabilities.
 *
 * Feature: Orchestrator Core for Agent OS
 */

import { EventEmitter } from 'events';
import { TeamType, TaskType } from '../workspace/task-document';
import {
  ITeamAgent,
  TeamAgentStatus,
  TeamAgentConfig,
  TeamCapability,
  TeamMetrics,
} from './team-agent';
import { STATUS_POLL_INTERVAL_MS } from './constants';

/**
 * Registry events
 */
export interface RegistryEvents {
  'team:registered': (team: ITeamAgent) => void;
  'team:unregistered': (teamType: TeamType) => void;
  'team:started': (team: ITeamAgent) => void;
  'team:stopped': (team: ITeamAgent) => void;
  'team:status-changed': (team: ITeamAgent, oldStatus: TeamAgentStatus, newStatus: TeamAgentStatus) => void;
  'team:error': (team: ITeamAgent, error: Error) => void;
}

/**
 * Team lookup result
 */
export interface TeamLookupResult {
  team: ITeamAgent;
  capability: TeamCapability;
  score: number;
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalTeams: number;
  activeTeams: number;
  idleTeams: number;
  errorTeams: number;
  totalCapabilities: number;
  teamMetrics: Map<TeamType, TeamMetrics>;
}

/**
 * Team Registry Interface
 */
export interface ITeamRegistry {
  /**
   * Register a team agent
   */
  register(team: ITeamAgent): void;

  /**
   * Unregister a team agent
   */
  unregister(teamType: TeamType): boolean;

  /**
   * Get a team by type
   */
  get(teamType: TeamType): ITeamAgent | undefined;

  /**
   * Get all registered teams
   */
  getAll(): ITeamAgent[];

  /**
   * Find teams that can handle a task type
   */
  findTeamsForTaskType(taskType: TaskType): TeamLookupResult[];

  /**
   * Get the best team for a task type
   */
  getBestTeamForTaskType(taskType: TaskType): TeamLookupResult | undefined;

  /**
   * Check if a team is registered
   */
  has(teamType: TeamType): boolean;

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats;

  /**
   * Start all teams
   */
  startAll(): Promise<void>;

  /**
   * Stop all teams
   */
  stopAll(): Promise<void>;
}

/**
 * Team Registry Implementation
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TeamRegistry extends EventEmitter implements ITeamRegistry {
  private readonly teams: Map<TeamType, ITeamAgent> = new Map();
  private readonly statusListeners: Map<TeamType, () => void> = new Map();

  constructor() {
    super();
  }

  /**
   * Register a team agent
   */
  register(team: ITeamAgent): void {
    if (this.teams.has(team.teamType)) {
      throw new Error(`Team ${team.teamType} is already registered`);
    }

    this.teams.set(team.teamType, team);

    // Track status changes
    this.trackTeamStatus(team);

    this.emit('team:registered', team);

    // Auto-start if configured
    if (team.config.autoStart) {
      team.start().catch((error) => {
        this.emit('team:error', team, error);
      });
    }
  }

  /**
   * Unregister a team agent
   */
  unregister(teamType: TeamType): boolean {
    const team = this.teams.get(teamType);
    if (!team) {
      return false;
    }

    // Stop status tracking
    const cleanup = this.statusListeners.get(teamType);
    if (cleanup) {
      cleanup();
      this.statusListeners.delete(teamType);
    }

    // Stop the team if running
    if (team.status === TeamAgentStatus.PROCESSING || team.status === TeamAgentStatus.IDLE) {
      team.stop().catch((error) => {
        this.emit('team:error', team, error);
      });
    }

    this.teams.delete(teamType);
    this.emit('team:unregistered', teamType);

    return true;
  }

  /**
   * Get a team by type
   */
  get(teamType: TeamType): ITeamAgent | undefined {
    return this.teams.get(teamType);
  }

  /**
   * Get all registered teams
   */
  getAll(): ITeamAgent[] {
    return Array.from(this.teams.values());
  }

  /**
   * Find teams that can handle a task type
   */
  findTeamsForTaskType(taskType: TaskType): TeamLookupResult[] {
    const results: TeamLookupResult[] = [];

    for (const team of this.teams.values()) {
      if (team.canHandle(taskType)) {
        const capability = team.getCapability(taskType);
        if (capability) {
          // Calculate score based on priority and current load
          const load = team.getLoad();
          const score = capability.priority * (1 - load);

          results.push({
            team,
            capability,
            score,
          });
        }
      }
    }

    // Sort by score (highest first)
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get the best team for a task type
   */
  getBestTeamForTaskType(taskType: TaskType): TeamLookupResult | undefined {
    const results = this.findTeamsForTaskType(taskType);

    // Filter out teams that are not available
    const available = results.filter(
      (r) =>
        r.team.status === TeamAgentStatus.IDLE ||
        r.team.status === TeamAgentStatus.PROCESSING
    );

    return available[0];
  }

  /**
   * Check if a team is registered
   */
  has(teamType: TeamType): boolean {
    return this.teams.has(teamType);
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const teams = Array.from(this.teams.values());
    const teamMetrics = new Map<TeamType, TeamMetrics>();

    let activeTeams = 0;
    let idleTeams = 0;
    let errorTeams = 0;
    let totalCapabilities = 0;

    for (const team of teams) {
      teamMetrics.set(team.teamType, team.metrics);
      totalCapabilities += team.config.capabilities.length;

      switch (team.status) {
        case TeamAgentStatus.PROCESSING:
          activeTeams++;
          break;
        case TeamAgentStatus.IDLE:
          idleTeams++;
          break;
        case TeamAgentStatus.ERROR:
          errorTeams++;
          break;
      }
    }

    return {
      totalTeams: teams.length,
      activeTeams,
      idleTeams,
      errorTeams,
      totalCapabilities,
      teamMetrics,
    };
  }

  /**
   * Start all teams
   */
  async startAll(): Promise<void> {
    const startPromises = Array.from(this.teams.values()).map(async (team) => {
      try {
        await team.start();
        this.emit('team:started', team);
      } catch (error) {
        this.emit('team:error', team, error instanceof Error ? error : new Error(String(error)));
      }
    });

    await Promise.all(startPromises);
  }

  /**
   * Stop all teams
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.teams.values()).map(async (team) => {
      try {
        await team.stop();
        this.emit('team:stopped', team);
      } catch (error) {
        this.emit('team:error', team, error instanceof Error ? error : new Error(String(error)));
      }
    });

    await Promise.all(stopPromises);
  }

  /**
   * Track team status changes
   */
  private trackTeamStatus(team: ITeamAgent): void {
    let lastStatus = team.status;

    // Poll for status changes (since ITeamAgent doesn't expose events)
    const intervalId = setInterval(() => {
      const currentStatus = team.status;
      if (currentStatus !== lastStatus) {
        this.emit('team:status-changed', team, lastStatus, currentStatus);
        lastStatus = currentStatus;
      }
    }, STATUS_POLL_INTERVAL_MS);
    if (intervalId.unref) {
      intervalId.unref();
    }

    // Store cleanup function
    this.statusListeners.set(team.teamType, () => {
      clearInterval(intervalId);
    });
  }

  /**
   * Create a snapshot of all team configurations
   */
  getTeamConfigs(): Map<TeamType, TeamAgentConfig> {
    const configs = new Map<TeamType, TeamAgentConfig>();
    for (const [teamType, team] of this.teams) {
      configs.set(teamType, team.config);
    }
    return configs;
  }

  /**
   * Get teams by status
   */
  getTeamsByStatus(status: TeamAgentStatus): ITeamAgent[] {
    return Array.from(this.teams.values()).filter((team) => team.status === status);
  }

  /**
   * Get available teams (idle or processing with capacity)
   */
  getAvailableTeams(): ITeamAgent[] {
    return Array.from(this.teams.values()).filter(
      (team) =>
        team.status === TeamAgentStatus.IDLE ||
        (team.status === TeamAgentStatus.PROCESSING && team.getLoad() < 1)
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // Stop all status listeners
    for (const cleanup of this.statusListeners.values()) {
      cleanup();
    }
    this.statusListeners.clear();

    // Clear teams
    this.teams.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}

// Type-safe event emitter
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TeamRegistry {
  on<E extends keyof RegistryEvents>(event: E, listener: RegistryEvents[E]): this;
  emit<E extends keyof RegistryEvents>(event: E, ...args: Parameters<RegistryEvents[E]>): boolean;
}

/**
 * Create a default team registry with standard teams
 */
export function createDefaultRegistry(): TeamRegistry {
  return new TeamRegistry();
}
