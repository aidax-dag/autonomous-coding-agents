/**
 * Agent Factory Implementation
 *
 * Creates agent instances using the Factory Pattern with:
 * - Type-based agent registration
 * - Dependency injection integration
 * - Configuration validation
 * - Lifecycle management hooks
 *
 * @module core/agents
 */

import type { IContainer } from '../di';
import {
  IAgent,
  IAgentConfig,
  IAgentFactory,
  AgentType,
  AgentConstructor,
} from '../interfaces';
import type { AgentDependencies, ILLMClient, IMessageBroker, IAgentLogger } from './interfaces';
import { AGENT_TOKENS } from './interfaces';

/**
 * Agent factory options
 */
export interface AgentFactoryOptions {
  /** DI Container for dependency resolution */
  container?: IContainer;
  /** Default dependencies for agents */
  defaultDependencies?: Partial<AgentDependencies>;
}

/**
 * Agent creation context
 */
export interface AgentCreationContext {
  config: IAgentConfig;
  dependencies: AgentDependencies;
}

/**
 * Agent factory hook
 */
export type AgentFactoryHook = (context: AgentCreationContext) => void | Promise<void>;

/**
 * Agent Factory Implementation
 */
export class AgentFactory implements IAgentFactory {
  private readonly agentClasses: Map<AgentType, AgentConstructor> = new Map();
  private readonly container?: IContainer;
  private readonly defaultDependencies: Partial<AgentDependencies>;
  private readonly preCreateHooks: AgentFactoryHook[] = [];
  private readonly postCreateHooks: AgentFactoryHook[] = [];

  constructor(options: AgentFactoryOptions = {}) {
    this.container = options.container;
    this.defaultDependencies = options.defaultDependencies || {};
  }

  /**
   * Register an agent class for a type
   */
  registerAgentClass(type: AgentType, agentClass: AgentConstructor): void {
    if (this.agentClasses.has(type)) {
      throw new Error(`Agent type '${type}' is already registered`);
    }
    this.agentClasses.set(type, agentClass);
  }

  /**
   * Unregister an agent class
   */
  unregisterAgentClass(type: AgentType): boolean {
    return this.agentClasses.delete(type);
  }

  /**
   * Check if agent type is registered
   */
  hasAgentType(type: AgentType): boolean {
    return this.agentClasses.has(type);
  }

  /**
   * Get registered agent types
   */
  getRegisteredTypes(): AgentType[] {
    return Array.from(this.agentClasses.keys());
  }

  /**
   * Create an agent instance
   */
  createAgent(config: IAgentConfig): IAgent {
    const AgentClass = this.agentClasses.get(config.type);

    if (!AgentClass) {
      throw new Error(`No agent class registered for type '${config.type}'`);
    }

    // Resolve dependencies
    const dependencies = this.resolveDependencies(config);

    // Create context
    const context: AgentCreationContext = { config, dependencies };

    // Run pre-create hooks synchronously
    for (const hook of this.preCreateHooks) {
      const result = hook(context);
      if (result instanceof Promise) {
        throw new Error('Pre-create hooks must be synchronous. Use createAgentAsync for async hooks.');
      }
    }

    // Create agent with dependencies
    const agent = new AgentClass(config, dependencies);

    // Run post-create hooks synchronously
    for (const hook of this.postCreateHooks) {
      const result = hook(context);
      if (result instanceof Promise) {
        throw new Error('Post-create hooks must be synchronous. Use createAgentAsync for async hooks.');
      }
    }

    return agent;
  }

  /**
   * Create an agent instance asynchronously (supports async hooks)
   */
  async createAgentAsync(config: IAgentConfig): Promise<IAgent> {
    const AgentClass = this.agentClasses.get(config.type);

    if (!AgentClass) {
      throw new Error(`No agent class registered for type '${config.type}'`);
    }

    // Resolve dependencies (may be async from container)
    const dependencies = await this.resolveDependenciesAsync(config);

    // Create context
    const context: AgentCreationContext = { config, dependencies };

    // Run pre-create hooks
    for (const hook of this.preCreateHooks) {
      await hook(context);
    }

    // Create agent with dependencies
    const agent = new AgentClass(config, dependencies);

    // Run post-create hooks
    for (const hook of this.postCreateHooks) {
      await hook(context);
    }

    return agent;
  }

  /**
   * Add a pre-create hook
   */
  addPreCreateHook(hook: AgentFactoryHook): void {
    this.preCreateHooks.push(hook);
  }

  /**
   * Add a post-create hook
   */
  addPostCreateHook(hook: AgentFactoryHook): void {
    this.postCreateHooks.push(hook);
  }

  /**
   * Remove a pre-create hook
   */
  removePreCreateHook(hook: AgentFactoryHook): boolean {
    const index = this.preCreateHooks.indexOf(hook);
    if (index !== -1) {
      this.preCreateHooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Remove a post-create hook
   */
  removePostCreateHook(hook: AgentFactoryHook): boolean {
    const index = this.postCreateHooks.indexOf(hook);
    if (index !== -1) {
      this.postCreateHooks.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Resolve dependencies for an agent
   */
  private resolveDependencies(config: IAgentConfig): AgentDependencies {
    // Try to resolve from container
    if (this.container) {
      const llmClient = this.container.tryResolve<ILLMClient>(AGENT_TOKENS.LLM_CLIENT);
      const messageBroker = this.container.tryResolve<IMessageBroker>(AGENT_TOKENS.MESSAGE_BROKER);
      const logger = this.container.tryResolve<IAgentLogger>(AGENT_TOKENS.AGENT_LOGGER);

      if (llmClient && messageBroker && logger) {
        return {
          llmClient,
          messageBroker,
          logger: logger.child({ agentId: config.id }),
        };
      }
    }

    // Fall back to default dependencies
    const deps = this.defaultDependencies;

    if (!deps.llmClient) {
      throw new Error('LLM client not available. Register with DI container or provide default.');
    }
    if (!deps.messageBroker) {
      throw new Error('Message broker not available. Register with DI container or provide default.');
    }
    if (!deps.logger) {
      throw new Error('Logger not available. Register with DI container or provide default.');
    }

    return {
      llmClient: deps.llmClient,
      messageBroker: deps.messageBroker,
      logger: deps.logger.child({ agentId: config.id }),
    };
  }

  /**
   * Resolve dependencies asynchronously
   */
  private async resolveDependenciesAsync(config: IAgentConfig): Promise<AgentDependencies> {
    // Try to resolve from container
    if (this.container) {
      const llmClient = await this.container.resolveAsync<ILLMClient>(AGENT_TOKENS.LLM_CLIENT)
        .catch(() => this.defaultDependencies.llmClient);
      const messageBroker = await this.container.resolveAsync<IMessageBroker>(AGENT_TOKENS.MESSAGE_BROKER)
        .catch(() => this.defaultDependencies.messageBroker);
      const logger = await this.container.resolveAsync<IAgentLogger>(AGENT_TOKENS.AGENT_LOGGER)
        .catch(() => this.defaultDependencies.logger);

      if (llmClient && messageBroker && logger) {
        return {
          llmClient,
          messageBroker,
          logger: logger.child({ agentId: config.id }),
        };
      }
    }

    // Fall back to sync resolution
    return this.resolveDependencies(config);
  }
}

/**
 * Create an agent factory
 */
export function createAgentFactory(options?: AgentFactoryOptions): IAgentFactory {
  return new AgentFactory(options);
}
