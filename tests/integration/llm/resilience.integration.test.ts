/**
 * LLM Resilience Integration Tests (I-7)
 *
 * Validates timeout handling, error recovery, sequential stability,
 * large payload handling, and concurrent request safety across providers.
 *
 * Run with: npm run test:integration
 * Dry run:  npm run test:integration:dry
 */

import { ClaudeClient } from '../../../src/shared/llm/claude-client';
import { OpenAIClient } from '../../../src/shared/llm/openai-client';
import { GeminiClient } from '../../../src/shared/llm/gemini-client';
import type { ILLMClient, LLMCompletionResult } from '../../../src/shared/llm/base-client';

import {
  getProviderKey,
  getTestModel,
  INTEGRATION_TIMEOUT,
  SLOW_TEST_TIMEOUT,
  type LLMProvider,
} from './helpers/integration-config';
import {
  describeIntegration,
  describeProvider,
  withRetry,
  createMessages,
} from './helpers/integration-test-base';
import { SIMPLE_MATH, MINIMAL_PROMPT } from './helpers/test-prompts';
import { validateBasicResponse } from './helpers/response-validators';

// ---------------------------------------------------------------------------
// Helpers local to this file
// ---------------------------------------------------------------------------

/** Create a client for a given provider, or return null when the key is missing. */
function createClient(provider: LLMProvider): ILLMClient | null {
  const key = getProviderKey(provider);
  if (!key) return null;
  const model = getTestModel(provider);
  switch (provider) {
    case 'anthropic':
      return new ClaudeClient(key, model);
    case 'openai':
      return new OpenAIClient(key, model);
    case 'gemini':
      return new GeminiClient(key, model);
    default:
      return null;
  }
}

/** Generate a long prompt string of at least the given character count. */
function generateLongPrompt(minChars: number): string {
  const base =
    'Explain in great detail the history and philosophy of mathematics, ' +
    'covering number theory, algebra, geometry, calculus, and statistics. ';
  let result = '';
  while (result.length < minChars) {
    result += base;
  }
  return result + ' Summarize in one sentence.';
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describeIntegration('LLM Resilience', () => {
  const apiProviders: LLMProvider[] = ['anthropic', 'openai', 'gemini'];

  // =========================================================================
  // Per-provider resilience tests
  // =========================================================================
  for (const provider of apiProviders) {
    describeProvider(provider, () => {
      let client: ILLMClient;

      beforeAll(() => {
        client = createClient(provider)!;
      });

      // -------------------------------------------------------------------
      // 1. Timeout Handling
      // -------------------------------------------------------------------
      describe('Timeout Handling', () => {
        it(
          'should not hang when timeout option is set very short (100ms)',
          async () => {
            const messages = createMessages(SIMPLE_MATH);
            // Raw provider clients may not enforce the timeout option from
            // LLMCompletionOptions (that is the ResilientLLMClient's job).
            // What matters here is that the client does NOT hang and either
            // succeeds quickly or throws a catchable error.
            const startTime = Date.now();
            try {
              await client.chat(messages, { maxTokens: 32, timeout: 100 });
              // If it succeeds, the option was simply ignored — that is fine
            } catch (error) {
              expect(error).toBeInstanceOf(Error);
              expect((error as Error).message.length).toBeGreaterThan(0);
            }
            // Regardless of outcome, should finish well within the Jest timeout
            const elapsed = Date.now() - startTime;
            expect(elapsed).toBeLessThan(INTEGRATION_TIMEOUT);
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should succeed with normal timeout (30s) and simple prompt',
          async () => {
            const messages = createMessages(SIMPLE_MATH);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 32, timeout: 30000 })
            );

            validateBasicResponse(result);
            expect(result.content).toMatch(/4/);
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should accept the timeout option without throwing on valid requests',
          async () => {
            const messages = createMessages(MINIMAL_PROMPT);
            // Passing a generous timeout should never interfere with a simple request
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 32, timeout: 60000 })
            );

            validateBasicResponse(result);
          },
          INTEGRATION_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 2. Sequential Request Stability
      // -------------------------------------------------------------------
      describe('Sequential Request Stability', () => {
        it(
          'should succeed on 3 sequential requests with consistent results',
          async () => {
            const messages = createMessages(SIMPLE_MATH);
            const results: LLMCompletionResult[] = [];

            for (let i = 0; i < 3; i++) {
              const result = await withRetry(() =>
                client.chat(messages, { maxTokens: 32 })
              );
              results.push(result);
            }

            expect(results).toHaveLength(3);
            for (const result of results) {
              validateBasicResponse(result);
              expect(result.content).toMatch(/4/);
            }
          },
          SLOW_TEST_TIMEOUT
        );

        it(
          'should not leak state between sequential requests with different prompts',
          async () => {
            const mathMessages = createMessages(SIMPLE_MATH);
            const greetMessages = createMessages('Say exactly: HELLO WORLD');

            const mathResult = await withRetry(() =>
              client.chat(mathMessages, { maxTokens: 32 })
            );
            const greetResult = await withRetry(() =>
              client.chat(greetMessages, { maxTokens: 32 })
            );

            // Math request should contain "4", greeting should contain "HELLO"
            expect(mathResult.content).toMatch(/4/);
            expect(greetResult.content.toUpperCase()).toContain('HELLO');

            // Greeting result should NOT contain the math answer as a primary response
            // (it might mention numbers incidentally, but should not be "4" alone)
            expect(greetResult.content.trim()).not.toBe('4');
          },
          SLOW_TEST_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 3. Error Recovery
      // -------------------------------------------------------------------
      describe('Error Recovery', () => {
        it(
          'should recover after a failed request with invalid model',
          async () => {
            const messages = createMessages(SIMPLE_MATH);

            // First request: deliberately fail with a bad model name
            await expect(
              client.chat(messages, {
                model: 'nonexistent-model-xyz-999',
                maxTokens: 32,
              })
            ).rejects.toThrow();

            // Second request: should succeed with the default model (client not poisoned)
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 32 })
            );

            validateBasicResponse(result);
            expect(result.content).toMatch(/4/);
          },
          SLOW_TEST_TIMEOUT
        );

        it(
          'should recover after a request with extreme options',
          async () => {
            const messages = createMessages(SIMPLE_MATH);

            // First request: use extreme options (very short timeout, if honoured)
            // that may or may not cause failure depending on the provider SDK
            try {
              await client.chat(messages, { maxTokens: 32, timeout: 1 });
            } catch {
              // May fail or succeed — we only care that the client survives
            }

            // Second request: should succeed normally regardless of first outcome
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 32 })
            );

            validateBasicResponse(result);
          },
          SLOW_TEST_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 4. Large Payload Handling
      // -------------------------------------------------------------------
      describe('Large Payload Handling', () => {
        it(
          'should handle a prompt longer than 1000 characters',
          async () => {
            const longPrompt = generateLongPrompt(1500);
            const messages = createMessages(longPrompt);

            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 64 })
            );

            validateBasicResponse(result);
          },
          SLOW_TEST_TIMEOUT
        );

        it(
          'should return a minimal response when maxTokens is 1',
          async () => {
            const messages = createMessages(MINIMAL_PROMPT);

            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 1 })
            );

            // Should not throw — response may be empty or very short
            expect(result).toBeDefined();
            expect(typeof result.content).toBe('string');
            // Completion tokens should be at most a small number
            expect(result.usage.completionTokens).toBeLessThanOrEqual(5);
          },
          INTEGRATION_TIMEOUT
        );
      });
    });
  }

  // =========================================================================
  // Cross-provider concurrent request tests
  // =========================================================================
  describe('Concurrent Request Safety', () => {
    it(
      'should handle concurrent requests to the same provider',
      async () => {
        // Find the first available provider
        let client: ILLMClient | null = null;
        for (const provider of apiProviders) {
          client = createClient(provider);
          if (client) break;
        }
        if (!client) {
          // No providers available, skip gracefully
          return;
        }

        const messages = createMessages(SIMPLE_MATH);

        // Send 3 concurrent requests
        const promises = [
          withRetry(() => client!.chat(messages, { maxTokens: 32 })),
          withRetry(() => client!.chat(messages, { maxTokens: 32 })),
          withRetry(() => client!.chat(messages, { maxTokens: 32 })),
        ];

        const results = await Promise.all(promises);

        expect(results).toHaveLength(3);
        for (const result of results) {
          validateBasicResponse(result);
          expect(result.content).toMatch(/4/);
        }
      },
      SLOW_TEST_TIMEOUT
    );

    it(
      'should handle concurrent requests to different providers',
      async () => {
        // Create clients for all available providers
        const clients: Array<{ provider: LLMProvider; client: ILLMClient }> = [];
        for (const provider of apiProviders) {
          const c = createClient(provider);
          if (c) {
            clients.push({ provider, client: c });
          }
        }

        if (clients.length < 2) {
          // Need at least 2 providers for a meaningful cross-provider test
          return;
        }

        const messages = createMessages(SIMPLE_MATH);

        const promises = clients.map(({ client: c }) =>
          withRetry(() => c.chat(messages, { maxTokens: 32 }))
        );

        const results = await Promise.all(promises);

        expect(results).toHaveLength(clients.length);
        for (const result of results) {
          validateBasicResponse(result);
          expect(result.content).toMatch(/4/);
        }
      },
      SLOW_TEST_TIMEOUT
    );

    it(
      'should handle a mix of fast and slow concurrent requests',
      async () => {
        let client: ILLMClient | null = null;
        for (const provider of apiProviders) {
          client = createClient(provider);
          if (client) break;
        }
        if (!client) {
          return;
        }

        const fastMessages = createMessages(SIMPLE_MATH);
        const slowMessages = createMessages(
          'Write a brief paragraph about the history of computing. Keep it under 50 words.'
        );

        const promises = [
          withRetry(() => client!.chat(fastMessages, { maxTokens: 16 })),
          withRetry(() => client!.chat(slowMessages, { maxTokens: 128 })),
          withRetry(() => client!.chat(fastMessages, { maxTokens: 16 })),
        ];

        const results = await Promise.all(promises);

        expect(results).toHaveLength(3);
        for (const result of results) {
          validateBasicResponse(result);
        }
        // Fast requests should still contain the math answer
        expect(results[0].content).toMatch(/4/);
        expect(results[2].content).toMatch(/4/);
      },
      SLOW_TEST_TIMEOUT
    );
  });
});
