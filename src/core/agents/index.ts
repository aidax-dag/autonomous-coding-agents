/**
 * Core Agents Module
 *
 * Provides the refactored agent system with:
 * - Dependency injection support
 * - Event-driven architecture
 * - SOLID principles compliance
 *
 * @module core/agents
 *
 * @example
 * ```typescript
 * import { BaseAgent, AGENT_TOKENS } from '@core/agents';
 * import { createContainer, createToken } from '@core/di';
 *
 * // Create a custom agent
 * class MyAgent extends BaseAgent {
 *   async processTask(task: ITask): Promise<TaskResult> {
 *     // Implementation
 *   }
 *
 *   getCapabilities(): AgentCapability[] {
 *     return [{ name: 'myCapability', description: 'Does something' }];
 *   }
 * }
 *
 * // Register with DI container
 * container.registerFactory(AGENT_TOKENS.LLM_CLIENT, () => myLLMClient);
 * container.registerFactory(AGENT_TOKENS.MESSAGE_BROKER, () => myBroker);
 * ```
 */

// Interfaces
export type {
  ILLMClient,
  IMessageBroker,
  IAgentLogger,
  AgentDependencies,
  LLMMessage,
  LLMOptions,
  LLMTool,
  LLMResponse,
  LLMToolCall,
  LLMStreamChunk,
  LLMUsage,
  MessageHandler,
} from './interfaces';

export { AGENT_TOKENS } from './interfaces';

// Base Agent
export { BaseAgent } from './base-agent';

// Agent Factory
export {
  AgentFactory,
  createAgentFactory,
  type AgentFactoryOptions,
  type AgentCreationContext,
  type AgentFactoryHook,
} from './agent-factory';

// Agent Registry
export {
  AgentRegistry,
  createAgentRegistry,
  REGISTRY_EVENTS,
  type AgentRegistryOptions,
  type RegistryStats,
} from './agent-registry';

// Specialized Agents
export {
  CoderAgent,
  createCoderAgent,
  type CoderAgentConfig,
} from './specialized';

// Agent Communication
export {
  AgentCommunication,
  createAgentCommunication,
  COMMUNICATION_EVENTS,
  type AgentMessage,
  type MessageRoutingOptions,
  type MessageFilter,
  type AgentMessageHandler,
  type Subscription,
  type AgentCommunicationOptions,
} from './communication';
