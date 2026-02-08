/**
 * Base LLM Client Interface
 *
 * Provides a unified interface for different LLM providers.
 * All LLM clients must implement this interface.
 *
 * Feature: F1.6 - LLM API Client
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
  timeout?: number;
}

export interface LLMCompletionResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_use' | string;
  metadata?: Record<string, unknown>;
}

export interface LLMStreamChunk {
  content: string;
  isComplete: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export type LLMStreamCallback = (chunk: LLMStreamChunk) => void | Promise<void>;

/**
 * Base LLM Client Interface
 */
/**
 * @deprecated Use ILLMClient from core/agents/interfaces.ts for new code.
 * This interface uses chat()/chatStream() convention. The canonical interface
 * uses complete()/stream(). Use SharedLLMClientAdapter (core/runner) to bridge.
 */
export interface ILLMClient {
  /**
   * Get the provider name
   */
  getProvider(): string;

  /**
   * Get the default model for this provider
   */
  getDefaultModel(): string;

  /**
   * Create a chat completion
   */
  chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  /**
   * Create a chat completion with streaming
   */
  chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  /**
   * Count tokens in a message (if supported)
   */
  countTokens?(messages: LLMMessage[]): Promise<number>;

  /**
   * Get maximum context length for a model
   */
  getMaxContextLength(model?: string): number;
}

/**
 * Base LLM Client abstract class
 */
export abstract class BaseLLMClient implements ILLMClient {
  protected apiKey: string;
  protected defaultModel: string;

  constructor(apiKey: string, defaultModel: string) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  abstract getProvider(): string;

  getDefaultModel(): string {
    return this.defaultModel;
  }

  abstract chat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  abstract chatStream(
    messages: LLMMessage[],
    callback: LLMStreamCallback,
    options?: LLMCompletionOptions
  ): Promise<LLMCompletionResult>;

  abstract getMaxContextLength(model?: string): number;

  /**
   * Validate messages
   */
  protected validateMessages(messages: LLMMessage[]): void {
    if (!messages || messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const message of messages) {
      if (!message.role || !['system', 'user', 'assistant'].includes(message.role)) {
        throw new Error(`Invalid message role: ${message.role}`);
      }
      if (typeof message.content !== 'string') {
        throw new Error('Message content must be a string');
      }
    }
  }

  /**
   * Get model name with fallback to default
   */
  protected getModel(options?: LLMCompletionOptions): string {
    return options?.model || this.defaultModel;
  }
}

/**
 * Helper function to create a user message
 */
export function createUserMessage(content: string): LLMMessage {
  return { role: 'user', content };
}

/**
 * Helper function to create a system message
 */
export function createSystemMessage(content: string): LLMMessage {
  return { role: 'system', content };
}

/**
 * Helper function to create an assistant message
 */
export function createAssistantMessage(content: string): LLMMessage {
  return { role: 'assistant', content };
}

/**
 * Helper function to format messages for display
 */
export function formatMessages(messages: LLMMessage[]): string {
  return messages
    .map((msg) => `[${msg.role.toUpperCase()}]: ${msg.content}`)
    .join('\n\n');
}
