/**
 * Integration Test Base Utilities
 *
 * Provides wrappers around Jest's describe/it that conditionally skip
 * tests based on environment configuration, plus retry and latency helpers.
 */

import {
  isIntegrationEnabled,
  isProviderAvailable,
  getSkipReason,
  INTEGRATION_TIMEOUT,
  type LLMProvider,
} from './integration-config';

/**
 * Wrapper around `describe` that skips the entire suite if
 * LLM_INTEGRATION_ENABLED is not 'true'.
 *
 * Usage:
 *   describeIntegration('API Client Tests', () => { ... });
 */
export function describeIntegration(name: string, fn: () => void): void {
  const skipReason = getSkipReason();
  if (skipReason) {
    describe.skip(`[Integration] ${name} (${skipReason})`, fn);
  } else {
    describe(`[Integration] ${name}`, fn);
  }
}

/**
 * Wrapper around `describe` that skips the suite if the given provider's
 * API key is not available or integration tests are disabled.
 *
 * Usage:
 *   describeProvider('anthropic', () => { ... });
 */
export function describeProvider(provider: LLMProvider, fn: () => void): void {
  const skipReason = getSkipReason(provider);
  if (skipReason) {
    describe.skip(`[${provider}] (${skipReason})`, fn);
  } else {
    describe(`[${provider}]`, fn);
  }
}

/**
 * Retry wrapper for flaky network tests.
 * Executes the function up to maxRetries times, only failing if all attempts fail.
 *
 * Usage:
 *   const result = await withRetry(() => client.chat(messages), 2);
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  throw lastError;
}

/**
 * Executes a function and returns both the result and the latency in milliseconds.
 *
 * Usage:
 *   const { result, latencyMs } = await measureLatency(() => client.chat(messages));
 */
export async function measureLatency<T>(
  fn: () => Promise<T>
): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  const latencyMs = Date.now() - start;
  return { result, latencyMs };
}

/**
 * Creates a standard Jest timeout configuration for integration tests.
 * Call this at the top of a describe block to set the timeout for all tests in the suite.
 */
export function setIntegrationTimeout(timeoutMs: number = INTEGRATION_TIMEOUT): void {
  jest.setTimeout(timeoutMs);
}

/**
 * Helper to create LLM messages in the format expected by ILLMClient.
 */
export function createMessages(
  userContent: string,
  systemContent?: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemContent) {
    messages.push({ role: 'system', content: systemContent });
  }
  messages.push({ role: 'user', content: userContent });
  return messages;
}
