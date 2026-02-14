/**
 * LLM Integration Test Configuration
 *
 * Reads environment variables to determine which providers are available
 * and provides helpers for conditional test execution.
 *
 * Environment Variables:
 *   LLM_INTEGRATION_ENABLED - Set to 'true' to enable integration tests
 *   ANTHROPIC_API_KEY       - Anthropic API key for Claude tests
 *   OPENAI_API_KEY          - OpenAI API key for GPT tests
 *   GEMINI_API_KEY          - Google API key for Gemini tests
 *   OLLAMA_HOST             - Ollama server URL (default: http://localhost:11434)
 */

export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'ollama';

/** Timeout for standard integration tests (30 seconds) */
export const INTEGRATION_TIMEOUT = 30_000;

/** Timeout for slower integration tests (60 seconds) */
export const SLOW_TEST_TIMEOUT = 60_000;

/** Minimum expected response length for a valid LLM response */
export const MIN_RESPONSE_LENGTH = 1;

/**
 * Provider-to-environment-variable mapping
 */
const PROVIDER_ENV_KEYS: Record<LLMProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  ollama: 'OLLAMA_HOST',
};

/**
 * Cheapest/fastest model per provider for integration testing.
 * These models minimize cost while still validating the integration path.
 */
const TEST_MODELS: Record<LLMProvider, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3',
};

/**
 * Returns true only when LLM_INTEGRATION_ENABLED is explicitly set to 'true'.
 */
export function isIntegrationEnabled(): boolean {
  return process.env.LLM_INTEGRATION_ENABLED === 'true';
}

/**
 * Returns the API key for a given provider, or undefined if not set.
 */
export function getProviderKey(provider: LLMProvider): string | undefined {
  const envKey = PROVIDER_ENV_KEYS[provider];
  const value = process.env[envKey];
  // For ollama, treat the default host as available even without explicit env var
  if (provider === 'ollama') {
    return value || 'http://localhost:11434';
  }
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Check if a specific provider has a valid API key configured.
 */
export function isProviderAvailable(provider: LLMProvider): boolean {
  if (!isIntegrationEnabled()) return false;
  if (provider === 'ollama') {
    // Ollama availability is checked at runtime via server ping
    return true;
  }
  return getProviderKey(provider) !== undefined;
}

/**
 * Returns a list of providers that have valid API keys configured.
 */
export function getAvailableProviders(): LLMProvider[] {
  if (!isIntegrationEnabled()) return [];
  const providers: LLMProvider[] = ['anthropic', 'openai', 'gemini', 'ollama'];
  return providers.filter((p) => isProviderAvailable(p));
}

/**
 * Returns the cheapest/fastest test model for a given provider.
 */
export function getTestModel(provider: LLMProvider): string {
  return TEST_MODELS[provider];
}

/**
 * Helper that returns the reason a test should be skipped, or null if it should run.
 */
export function getSkipReason(provider?: LLMProvider): string | null {
  if (!isIntegrationEnabled()) {
    return 'LLM_INTEGRATION_ENABLED is not set to true';
  }
  if (provider && !isProviderAvailable(provider)) {
    const envKey = PROVIDER_ENV_KEYS[provider];
    return `${envKey} is not set`;
  }
  return null;
}
