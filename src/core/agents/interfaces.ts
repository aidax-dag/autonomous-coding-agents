/**
 * Agent System Interfaces
 *
 * Defines abstractions for agent dependencies to enable:
 * - Dependency injection
 * - Unit testing with mocks
 * - Loose coupling
 *
 * @module core/agents
 */

import { createToken } from '../di';

/**
 * LLM Client Interface
 * Abstracts LLM provider communication
 */
export interface ILLMClient {
  /**
   * Complete a prompt
   */
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;

  /**
   * Stream a completion
   */
  stream(
    messages: LLMMessage[],
    options?: LLMOptions
  ): AsyncIterable<LLMStreamChunk>;

  /**
   * Get provider name
   */
  getProvider(): string;

  /**
   * Get model name
   */
  getModel(): string;
}

/**
 * LLM Message
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM Options
 */
export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  tools?: LLMTool[];
}

/**
 * LLM Tool definition
 */
export interface LLMTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * LLM Response
 */
export interface LLMResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  usage: LLMUsage;
  stopReason: 'end' | 'stop_sequence' | 'tool_use' | 'max_tokens';
}

/**
 * LLM Tool Call
 */
export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/**
 * LLM Stream Chunk
 */
export interface LLMStreamChunk {
  type: 'text' | 'tool_use_start' | 'tool_use_delta' | 'tool_use_end';
  content?: string;
  toolCall?: Partial<LLMToolCall>;
}

/**
 * LLM Usage
 */
export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

/**
 * Message Broker Interface
 * Abstracts message queue communication
 */
export interface IMessageBroker {
  /**
   * Publish a message to a topic
   */
  publish(topic: string, message: unknown): Promise<void>;

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string, handler: MessageHandler): Promise<void>;

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string): Promise<void>;

  /**
   * Request-reply pattern
   */
  request(topic: string, message: unknown, timeout?: number): Promise<unknown>;

  /**
   * Check connection status
   */
  isConnected(): boolean;

  /**
   * Connect to the broker
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the broker
   */
  disconnect(): Promise<void>;
}

/**
 * Message handler function
 */
export type MessageHandler = (message: unknown) => Promise<void> | void;

/**
 * Agent Logger Interface
 * Abstracts logging for agents
 */
export interface IAgentLogger {
  /**
   * Log debug message
   */
  debug(message: string, context?: Record<string, unknown>): void;

  /**
   * Log info message
   */
  info(message: string, context?: Record<string, unknown>): void;

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, unknown>): void;

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, unknown>): void;

  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, unknown>): IAgentLogger;
}

/**
 * Agent Dependencies
 * All dependencies required by an agent
 */
export interface AgentDependencies {
  llmClient: ILLMClient;
  messageBroker: IMessageBroker;
  logger: IAgentLogger;
  eventBus?: import('../events').IEventBus;
  config?: import('../config').IConfigService;
  errorRecovery?: import('../../dx/error-recovery').IErrorRecovery;
  tokenBudget?: import('../../dx/token-budget').ITokenBudgetManager;
}

/**
 * DI Tokens for Agent Dependencies
 */
export const AGENT_TOKENS = {
  LLM_CLIENT: createToken<ILLMClient>('LLMClient'),
  MESSAGE_BROKER: createToken<IMessageBroker>('MessageBroker'),
  AGENT_LOGGER: createToken<IAgentLogger>('AgentLogger'),
  AGENT_FACTORY: createToken<unknown>('AgentFactory'),
  AGENT_REGISTRY: createToken<unknown>('AgentRegistry'),
  AGENT_LIFECYCLE: createToken<unknown>('AgentLifecycle'),
} as const;
