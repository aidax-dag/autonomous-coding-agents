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

// Team Agents (consolidated from orchestrator/agents)
export {
  // Base team agent
  BaseTeamAgent,
  type BaseTeamAgentEvents,
  type BaseTeamAgentOptions,
  // Team agent interfaces
  type ITeamAgent,
  type TeamAgentStatus,
  type TeamAgentConfig,
  type TeamMetrics,
  type TeamCapability,
  type TaskHandler,
  type TaskHandlerResult,
  createTeamConfig,
  // Specialized team agents
  PlanningAgent,
  createPlanningAgent,
  type PlanningOutput,
  type PlanningAgentOptions,
  DevelopmentAgent,
  createDevelopmentAgent,
  createFrontendAgent,
  createBackendAgent,
  type DevelopmentOutput,
  type DevelopmentAgentOptions,
  QAAgent,
  createQAAgent,
  type QAOutput,
  type QAAgentOptions,
  type TestResult,
  CodeQualityAgent,
  createCodeQualityAgent,
  type CodeQualityAgentOptions,
  type GeneratedTestCase,
  type CodeReviewFinding,
  type RefactoringSuggestion,
  type TestGenerationOutput,
  type DeepReviewOutput,
  type RefactoringOutput,
} from './teams';
