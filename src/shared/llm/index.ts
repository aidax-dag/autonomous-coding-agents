/**
 * LLM Client Factory and Exports
 *
 * Provides a unified interface to create LLM clients for different providers.
 * Supports both API-based providers (require API keys) and CLI-based providers
 * (use subscription authentication).
 *
 * Feature: F1.6 - LLM API Client
 */

import { Config, LLMProvider, getLLMApiKey, isCLIProvider } from '@/shared/config';
import { ILLMClient } from '@/shared/llm/base-client';
import { ClaudeClient } from '@/shared/llm/claude-client';
import { OpenAIClient } from '@/shared/llm/openai-client';
import { GeminiClient } from '@/shared/llm/gemini-client';
import { ClaudeCLIClient } from '@/shared/llm/cli/claude-cli-client';
import { CodexCLIClient } from '@/shared/llm/cli/codex-cli-client';
import { GeminiCLIClient } from '@/shared/llm/cli/gemini-cli-client';
import { OllamaClient } from '@/shared/llm/cli/ollama-client';
import { ResilientLLMClient, ResilientClientConfig } from '@/shared/llm/resilient-client';

// Re-export types and utilities
export * from '@/shared/llm/base-client';

// Re-export routing interfaces
export type {
  ModelTier,
  ModelProfile,
  RoutingContext,
  RoutingDecision,
  CostRecord,
  IRoutingStrategy,
  IModelRouter,
  ICostTracker,
} from '@/shared/llm/interfaces/routing.interface';

// Re-export model profiles
export {
  ModelProfileRegistry,
  createModelProfileRegistry,
  DEFAULT_MODEL_PROFILES,
} from '@/shared/llm/model-profiles';

// Re-export cost tracker
export { CostTracker, createCostTracker } from '@/shared/llm/cost-tracker';

// Re-export routing strategies
export * from '@/shared/llm/routing-strategies';

// Re-export model router
export { ModelRouter, createModelRouter, type ModelRouterConfig } from '@/shared/llm/model-router';
export { ClaudeClient } from '@/shared/llm/claude-client';
export { OpenAIClient } from '@/shared/llm/openai-client';
export { GeminiClient } from '@/shared/llm/gemini-client';

// Re-export CLI clients
export * from '@/shared/llm/cli';

// Re-export resilient client
export {
  ResilientLLMClient,
  createResilientClient,
  withResilience,
  type ResilientClientConfig,
  DEFAULT_RESILIENT_CONFIG,
} from '@/shared/llm/resilient-client';

/**
 * Create an LLM client based on provider (API-based)
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
      throw new Error(`Unknown API-based LLM provider: ${provider}. Use createCLILLMClient for CLI providers.`);
  }
}

/**
 * Create a CLI-based LLM client
 */
export function createCLILLMClient(
  provider: LLMProvider,
  defaultModel?: string,
  ollamaHost?: string
): ILLMClient {
  switch (provider) {
    case 'claude-cli':
      return new ClaudeCLIClient(defaultModel);
    case 'codex-cli':
      return new CodexCLIClient(defaultModel);
    case 'gemini-cli':
      return new GeminiCLIClient(defaultModel);
    case 'ollama':
      return new OllamaClient(defaultModel, ollamaHost);
    default:
      throw new Error(`Unknown CLI-based LLM provider: ${provider}. Use createLLMClient for API providers.`);
  }
}

/**
 * Create an LLM client from configuration
 * Automatically selects API or CLI client based on provider type
 */
export function createLLMClientFromConfig(config: Config): ILLMClient {
  const { provider, defaultModel, ollamaHost } = config.llm;

  // CLI-based providers don't need API keys
  if (isCLIProvider(provider)) {
    return createCLILLMClient(provider, defaultModel, ollamaHost);
  }

  // API-based providers need API keys
  const apiKey = getLLMApiKey(config);
  return createLLMClient(provider, apiKey, defaultModel);
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

/**
 * Create a resilient LLM client from configuration
 * Wraps the base client with error recovery capabilities
 */
export function createResilientLLMClientFromConfig(
  config: Config,
  resilientConfig?: ResilientClientConfig
): ResilientLLMClient {
  const baseClient = createLLMClientFromConfig(config);
  return new ResilientLLMClient(baseClient, resilientConfig);
}

/**
 * Singleton resilient LLM client instance
 */
let resilientClientInstance: ResilientLLMClient | null = null;

/**
 * Get or create singleton resilient LLM client
 */
export function getResilientLLMClient(
  config?: Config,
  resilientConfig?: ResilientClientConfig
): ResilientLLMClient {
  if (!resilientClientInstance) {
    if (!config) {
      throw new Error('Config is required to initialize resilient LLM client');
    }
    resilientClientInstance = createResilientLLMClientFromConfig(config, resilientConfig);
  }
  return resilientClientInstance;
}

/**
 * Reset resilient LLM client (useful for testing)
 */
export function resetResilientLLMClient(): void {
  if (resilientClientInstance) {
    resilientClientInstance.dispose();
    resilientClientInstance = null;
  }
}
