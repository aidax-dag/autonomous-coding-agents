/**
 * LLM Client Factory and Exports
 *
 * Provides a unified interface to create LLM clients for different providers.
 *
 * Feature: F1.6 - LLM API Client
 */

import { Config, LLMProvider, getLLMApiKey } from '@/shared/config';
import { ILLMClient } from '@/shared/llm/base-client';
import { ClaudeClient } from '@/shared/llm/claude-client';
import { OpenAIClient } from '@/shared/llm/openai-client';
import { GeminiClient } from '@/shared/llm/gemini-client';

// Re-export types and utilities
export * from '@/shared/llm/base-client';
export { ClaudeClient } from '@/shared/llm/claude-client';
export { OpenAIClient } from '@/shared/llm/openai-client';
export { GeminiClient } from '@/shared/llm/gemini-client';

/**
 * Create an LLM client based on provider
 */
export function createLLMClient(
  provider: LLMProvider,
  apiKey: string,
  defaultModel?: string
): ILLMClient {
  switch (provider) {
    case 'claude':
      return new ClaudeClient(apiKey, defaultModel);
    case 'openai':
      return new OpenAIClient(apiKey, defaultModel);
    case 'gemini':
      return new GeminiClient(apiKey, defaultModel);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

/**
 * Create an LLM client from configuration
 */
export function createLLMClientFromConfig(config: Config): ILLMClient {
  const provider = config.llm.provider;
  const apiKey = getLLMApiKey(config);

  return createLLMClient(provider, apiKey);
}

/**
 * Singleton LLM client instance
 */
let llmClientInstance: ILLMClient | null = null;

/**
 * Get or create singleton LLM client
 */
export function getLLMClient(config?: Config): ILLMClient {
  if (!llmClientInstance) {
    if (!config) {
      throw new Error('Config is required to initialize LLM client');
    }
    llmClientInstance = createLLMClientFromConfig(config);
  }
  return llmClientInstance;
}

/**
 * Reset LLM client (useful for testing)
 */
export function resetLLMClient(): void {
  llmClientInstance = null;
}
