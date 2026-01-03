/**
 * Agent Registry Implementation
 *
 * Manages agent instances using the Registry Pattern with:
 * - Agent registration and lookup by ID
 * - Type-based agent queries
 * - Event emission for registry changes
 * - Thread-safe operations
 *
 * @module core/agents
 */

import { IAgent, IAgentRegistry, AgentType } from '../interfaces';
import type { IEventBus, IEvent } from '../events';

/**
 * Agent registry options
 */
export interface AgentRegistryOptions {
  /** Event bus for registry change notifications */
  eventBus?: IEventBus;
  /** Maximum number of agents allowed */
  maxAgents?: number;
}

/**
 * Registry event types
 */
export const REGISTRY_EVENTS = {
  AGENT_REGISTERED: 'registry.agent.registered',
  AGENT_UNREGISTERED: 'registry.agent.unregistered',
  REGISTRY_CLEARED: 'registry.cleared',
} as const;

/**
 * Agent Registry Implementation
 *
 * Provides centralized storage and lookup for agent instances.
 */
export class AgentRegistry implements IAgentRegistry {
  private readonly agents: Map<string, IAgent> = new Map();
  private readonly typeIndex: Map<AgentType, Set<string>> = new Map();
  private readonly eventBus?: IEventBus;
  private readonly maxAgents: number;

  constructor(options: AgentRegistryOptions = {}) {
    this.eventBus = options.eventBus;
    this.maxAgents = options.maxAgents || Infinity;
  }

  /**
   * Register an agent instance
   */
  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID '${agent.id}' is already registered`);
    }

    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Maximum agent limit (${this.maxAgents}) reached`);
    }

    // Add to main registry
    this.agents.set(agent.id, agent);

    // Add to type index
    if (!this.typeIndex.has(agent.type)) {
      this.typeIndex.set(agent.type, new Set());
    }
    this.typeIndex.get(agent.type)!.add(agent.id);

    // Emit event
    this.emitEvent(REGISTRY_EVENTS.AGENT_REGISTERED, {
      agentId: agent.id,
      agentType: agent.type,
      agentName: agent.name,
    });
  }

  /**
   * Unregister an agent by ID
   */
  unregister(agentId: string): boolean {
    const agent = this.agents.get(agentId);

    if (!agent) {
      return false;
    }

    // Remove from main registry
    this.agents.delete(agentId);

    // Remove from type index
    const typeSet = this.typeIndex.get(agent.type);
    if (typeSet) {
      typeSet.delete(agentId);
      if (typeSet.size === 0) {
        this.typeIndex.delete(agent.type);
      }
    }

    // Emit event
    this.emitEvent(REGISTRY_EVENTS.AGENT_UNREGISTERED, {
      agentId: agent.id,
      agentType: agent.type,
    });

    return true;
  }

  /**
   * Get an agent by ID
   */
  get(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agents of a specific type
   */
  getByType(type: AgentType): IAgent[] {
    const agentIds = this.typeIndex.get(type);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map((id) => this.agents.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get all registered agents
   */
  getAll(): IAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if an agent is registered
   */
  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get count of registered agents
   */
  count(): number {
    return this.agents.size;
  }

  /**
   * Get count of agents by type
   */
  countByType(type: AgentType): number {
    return this.typeIndex.get(type)?.size || 0;
  }

  /**
   * Get all registered agent types
   */
  getRegisteredTypes(): AgentType[] {
    return Array.from(this.typeIndex.keys());
  }

  /**
   * Find agents matching a predicate
   */
  find(predicate: (agent: IAgent) => boolean): IAgent[] {
    return this.getAll().filter(predicate);
  }

  /**
   * Find first agent matching a predicate
   */
  findOne(predicate: (agent: IAgent) => boolean): IAgent | undefined {
    return this.getAll().find(predicate);
  }

  /**
   * Clear all registered agents
   */
  clear(): void {
    const agentCount = this.agents.size;

    this.agents.clear();
    this.typeIndex.clear();

    // Emit event
    this.emitEvent(REGISTRY_EVENTS.REGISTRY_CLEARED, {
      clearedCount: agentCount,
    });
  }

  /**
   * Get registry statistics
   */
  getStats(): RegistryStats {
    const typeDistribution: Record<string, number> = {};

    for (const [type, ids] of this.typeIndex) {
      typeDistribution[type] = ids.size;
    }

    return {
      totalAgents: this.agents.size,
      typeDistribution,
      registeredTypes: this.getRegisteredTypes(),
    };
  }

  /**
   * Emit a registry event
   */
  private emitEvent(type: string, payload: Record<string, unknown>): void {
    if (this.eventBus) {
      const event: IEvent = {
        id: `registry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        source: 'agent-registry',
        timestamp: new Date(),
        payload,
      };
      this.eventBus.emit(event);
    }
  }
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  totalAgents: number;
  typeDistribution: Record<string, number>;
  registeredTypes: AgentType[];
}

/**
 * Create an agent registry
 */
export function createAgentRegistry(options?: AgentRegistryOptions): IAgentRegistry {
  return new AgentRegistry(options);
}
