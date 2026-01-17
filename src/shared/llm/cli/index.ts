/**
 * CLI LLM Clients
 *
 * Export all CLI-based LLM client implementations.
 * These clients use subscription-authenticated CLI programs
 * instead of API keys, allowing users with active subscriptions
 * to use the system without API key setup.
 */

// Error classes
export {
  CLIError,
  CLINotFoundError,
  CLIAuthenticationError,
  CLITimeoutError,
  CLIRateLimitError,
  CLIResponseError,
  OllamaServerError,
  CLIParseError,
} from './errors';

// Base class
export { BaseCLIClient, CLIAvailability, CLIExecutionResult } from './base-cli-client';

// Client implementations
export { ClaudeCLIClient } from './claude-cli-client';
export { CodexCLIClient } from './codex-cli-client';
export { GeminiCLIClient } from './gemini-cli-client';
export { OllamaClient } from './ollama-client';

// Provider types for CLI clients
export type CLIProvider = 'claude-cli' | 'codex-cli' | 'gemini-cli' | 'ollama';

/**
 * Check if a provider is a CLI-based provider
 */
export function isCLIProvider(provider: string): provider is CLIProvider {
  return ['claude-cli', 'codex-cli', 'gemini-cli', 'ollama'].includes(provider);
}

/**
 * Create a CLI client instance based on provider
 */
export function createCLIClient(provider: CLIProvider, defaultModel?: string, host?: string) {
  switch (provider) {
    case 'claude-cli':
      return new (require('./claude-cli-client').ClaudeCLIClient)(defaultModel);
    case 'codex-cli':
      return new (require('./codex-cli-client').CodexCLIClient)(defaultModel);
    case 'gemini-cli':
      return new (require('./gemini-cli-client').GeminiCLIClient)(defaultModel);
    case 'ollama':
      return new (require('./ollama-client').OllamaClient)(defaultModel, host);
    default:
      throw new Error(`Unknown CLI provider: ${provider}`);
  }
}
