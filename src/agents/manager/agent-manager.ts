import { BaseAgent } from '@/agents/base/agent';
import {
  AgentType,
  AgentStatus,
  Task,
  HealthStatus,
} from '@/agents/base/types';
import { AgentError, ErrorCode } from '@/shared/errors/custom-errors';
import { AgentLogger, createAgentLogger } from '@/shared/logging/logger';
import { z } from 'zod';

/**
 * Agent Manager
 *
 * Manages lifecycle and coordination of multiple agents.
 * Implements strict quality standards:
 * - No resource leaks
 * - Explicit error handling
 * - Type safety with Zod validation
 * - Proper cleanup in finally blocks
 *
 * Feature: F2.2 - Agent Manager
 */

/**
 * Task validation schema
 */
const TaskSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  agentType: z.nativeEnum(AgentType),
  priority: z.string(),
  status: z.string(),
  payload: z.record(z.unknown()),
  metadata: z.object({
    createdAt: z.number(),
  }).passthrough(),
});

/**
 * Agent Manager class
 */
export class AgentManager {
  private agents: Map<string, BaseAgent>;
  private agentsByType: Map<AgentType, BaseAgent[]>;
  private roundRobinIndex: Map<AgentType, number>;
  private logger: AgentLogger;
  private isCleanedUp: boolean;

  constructor() {
    this.agents = new Map();
    this.agentsByType = new Map();
    this.roundRobinIndex = new Map();
    this.logger = createAgentLogger('MANAGER', 'agent-manager');
    this.isCleanedUp = false;

    // Initialize agent type arrays
    Object.values(AgentType).forEach((type) => {
      this.agentsByType.set(type, []);
      this.roundRobinIndex.set(type, 0);
    });
  }

  /**
   * Register an agent
   *
   * @throws {AgentError} If agent ID already registered
   */
  async registerAgent(agent: BaseAgent): Promise<void> {
    const agentId = agent.getId();
    const agentType = agent.getAgentType();

    this.logger.info('Registering agent', { agentId, agentType });

    if (this.agents.has(agentId)) {
      throw new AgentError(
        `Agent ${agentId} is already registered`,
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { agentId }
      );
    }

    try {
      // Add to main registry
      this.agents.set(agentId, agent);

      // Add to type-specific registry
      const typeAgents = this.agentsByType.get(agentType) ?? [];
      typeAgents.push(agent);
      this.agentsByType.set(agentType, typeAgents);

      this.logger.info('Agent registered successfully', { agentId, agentType });
    } catch (error) {
      // Rollback registration on error
      this.agents.delete(agentId);
      const typeAgents = this.agentsByType.get(agentType) ?? [];
      const index = typeAgents.indexOf(agent);
      if (index > -1) {
        typeAgents.splice(index, 1);
      }

      throw new AgentError(
        'Failed to register agent',
        ErrorCode.AGENT_INITIALIZATION_ERROR,
        false,
        { agentId, originalError: String(error) }
      );
    }
  }

  /**
   * Unregister an agent
   *
   * @throws {AgentError} If agent not found
   */
  async unregisterAgent(agentId: string): Promise<void> {
    this.logger.info('Unregistering agent', { agentId });

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentError(
        `Agent ${agentId} not found`,
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { agentId }
      );
    }

    try {
      // Stop agent before unregistering
      await agent.stop();
    } catch (error) {
      this.logger.warn('Error stopping agent during unregister', {
        agentId,
        error,
      });
      // Continue with unregistration even if stop fails
    }

    try {
      const agentType = agent.getAgentType();

      // Remove from main registry
      this.agents.delete(agentId);

      // Remove from type-specific registry
      const typeAgents = this.agentsByType.get(agentType) ?? [];
      const index = typeAgents.indexOf(agent);
      if (index > -1) {
        typeAgents.splice(index, 1);
      }

      this.logger.info('Agent unregistered successfully', { agentId });
    } catch (error) {
      throw new AgentError(
        'Failed to unregister agent',
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { agentId, originalError: String(error) }
      );
    }
  }

  /**
   * Start an agent
   *
   * @throws {AgentError} If agent not found or fails to start
   */
  async startAgent(agentId: string): Promise<void> {
    this.logger.info('Starting agent', { agentId });

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentError(
        `Agent ${agentId} not found`,
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { agentId }
      );
    }

    try {
      await agent.start();
      this.logger.info('Agent started successfully', { agentId });
    } catch (error) {
      throw new AgentError(
        `Failed to start agent ${agentId}`,
        ErrorCode.AGENT_INITIALIZATION_ERROR,
        false,
        { agentId, originalError: String(error) }
      );
    }
  }

  /**
   * Stop an agent
   *
   * @throws {AgentError} If agent not found
   */
  async stopAgent(agentId: string): Promise<void> {
    this.logger.info('Stopping agent', { agentId });

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentError(
        `Agent ${agentId} not found`,
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { agentId }
      );
    }

    try {
      await agent.stop();
      this.logger.info('Agent stopped successfully', { agentId });
    } catch (error) {
      throw new AgentError(
        `Failed to stop agent ${agentId}`,
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { agentId, originalError: String(error) }
      );
    }
  }

  /**
   * Route task to appropriate agent
   *
   * Uses round-robin load balancing for agents of same type
   *
   * @throws {AgentError} If no agent available for task type or validation fails
   */
  async routeTask(task: Task): Promise<string> {
    // Validate task structure
    const validationResult = TaskSchema.safeParse(task);
    if (!validationResult.success) {
      throw new AgentError(
        'Invalid task structure',
        ErrorCode.VALIDATION_ERROR,
        false,
        { validationError: validationResult.error.errors }
      );
    }

    const agentType = task.agentType;
    const agents = this.agentsByType.get(agentType) ?? [];

    // Filter for agents in IDLE state
    const availableAgents = agents.filter(
      (agent) => agent.getState() === 'IDLE'
    );

    if (availableAgents.length === 0) {
      throw new AgentError(
        `No available agent for type ${agentType}`,
        ErrorCode.AGENT_STATE_ERROR,
        true,
        { agentType, totalAgents: agents.length }
      );
    }

    // Round-robin selection
    const currentIndex = this.roundRobinIndex.get(agentType) ?? 0;
    const selectedAgent = availableAgents[currentIndex % availableAgents.length];

    // Update round-robin index
    this.roundRobinIndex.set(agentType, currentIndex + 1);

    const agentId = selectedAgent.getId();

    this.logger.info('Task routed to agent', {
      taskId: task.id,
      agentId,
      agentType,
    });

    return agentId;
  }

  /**
   * Get agent health status
   *
   * @throws {AgentError} If agent not found
   */
  async getAgentHealth(agentId: string): Promise<HealthStatus> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentError(
        `Agent ${agentId} not found`,
        ErrorCode.AGENT_STATE_ERROR,
        false,
        { agentId }
      );
    }

    return agent.getHealth();
  }

  /**
   * Get status for all agents
   */
  async getAllAgentStatus(): Promise<AgentStatus[]> {
    const statuses: AgentStatus[] = [];

    for (const agent of this.agents.values()) {
      const config = agent.getConfig();
      const health = agent.getHealth();

      statuses.push({
        id: agent.getId(),
        type: agent.getAgentType(),
        name: config.name,
        state: agent.getState(),
        health,
        config: {
          maxConcurrentTasks: config.maxConcurrentTasks ?? 1,
          timeout: config.timeout ?? 30000,
        },
      });
    }

    return statuses;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get agents by type
   */
  getAgentsByType(type: AgentType): BaseAgent[] {
    return this.agentsByType.get(type) ?? [];
  }

  /**
   * Cleanup all agents
   *
   * Ensures proper resource cleanup even if individual agent cleanup fails
   */
  async cleanup(): Promise<void> {
    if (this.isCleanedUp) {
      return;
    }

    this.logger.info('Cleaning up agent manager', {
      agentCount: this.agents.size,
    });

    const cleanupErrors: Array<{ agentId: string; error: unknown }> = [];

    // Stop all agents
    for (const [agentId, agent] of this.agents.entries()) {
      try {
        await agent.stop();
      } catch (error) {
        cleanupErrors.push({ agentId, error });
        this.logger.error('Error stopping agent during cleanup', {
          agentId,
          error,
        });
      }
    }

    // Clear registries
    this.agents.clear();
    this.agentsByType.forEach((agents) => agents.splice(0));
    this.roundRobinIndex.clear();

    this.isCleanedUp = true;

    if (cleanupErrors.length > 0) {
      this.logger.warn('Some agents failed to stop during cleanup', {
        errorCount: cleanupErrors.length,
      });
    } else {
      this.logger.info('Agent manager cleaned up successfully');
    }
  }
}
