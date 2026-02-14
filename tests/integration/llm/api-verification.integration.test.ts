/**
 * API Verification Integration Tests (I-6)
 *
 * Deep API behavior tests beyond basic prompt/response: token counting
 * accuracy, error handling, rate limit resilience, response format
 * validation, multi-turn conversation, and option/parameter handling.
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
import {
  SIMPLE_MATH,
  JSON_OUTPUT,
  TOKEN_COUNTER,
} from './helpers/test-prompts';
import {
  validateBasicResponse,
  validateTokenCounts,
  validateJsonResponse,
  assertProviderMetadata,
} from './helpers/response-validators';

// ---------------------------------------------------------------------------
// Helpers local to this file
// ---------------------------------------------------------------------------

/** Known finish reason values across providers */
const VALID_FINISH_REASONS = [
  'stop',
  'end_turn',
  'length',
  'STOP',
  'MAX_TOKENS',
  'content_filter',
  'tool_use',
];

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

/** Model name substring expected in the response for each provider. */
const MODEL_SUBSTRINGS: Record<string, string> = {
  anthropic: 'claude',
  openai: 'gpt',
  gemini: 'gemini',
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describeIntegration('API Verification', () => {
  // =========================================================================
  // Per-provider test factory
  // =========================================================================
  const apiProviders: LLMProvider[] = ['anthropic', 'openai', 'gemini'];

  for (const provider of apiProviders) {
    describeProvider(provider, () => {
      let client: ILLMClient;

      beforeAll(() => {
        client = createClient(provider)!;
      });

      // -------------------------------------------------------------------
      // 1. Token Counting Accuracy
      // -------------------------------------------------------------------
      describe('Token Counting Accuracy', () => {
        it(
          'should return positive prompt and completion token counts',
          async () => {
            const messages = createMessages(TOKEN_COUNTER);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 128 })
            );

            validateTokenCounts(result);
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should have totalTokens equal to promptTokens + completionTokens (within tolerance)',
          async () => {
            const messages = createMessages(TOKEN_COUNTER);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 128 })
            );

            const { promptTokens, completionTokens, totalTokens } = result.usage;
            // Some providers may include slight overhead; allow +5 tolerance
            expect(totalTokens).toBeGreaterThanOrEqual(promptTokens + completionTokens);
            expect(totalTokens).toBeLessThanOrEqual(promptTokens + completionTokens + 5);
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should return proportionally more prompt tokens for a longer prompt',
          async () => {
            const shortMessages = createMessages('Say hi.');
            const longMessages = createMessages(
              'Please explain the theory of general relativity in simple terms, ' +
                'covering spacetime curvature, the equivalence principle, and gravitational time dilation. ' +
                'Keep your answer under 50 words.'
            );

            const [shortResult, longResult] = await Promise.all([
              withRetry(() => client.chat(shortMessages, { maxTokens: 64 })),
              withRetry(() => client.chat(longMessages, { maxTokens: 64 })),
            ]);

            expect(longResult.usage.promptTokens).toBeGreaterThan(
              shortResult.usage.promptTokens
            );
          },
          SLOW_TEST_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 2. Error Handling
      // -------------------------------------------------------------------
      describe('Error Handling', () => {
        it(
          'should throw on invalid model name without crashing',
          async () => {
            const messages = createMessages(SIMPLE_MATH);
            await expect(
              withRetry(
                () =>
                  client.chat(messages, {
                    model: 'nonexistent-model-xyz-999',
                    maxTokens: 64,
                  }),
                0 // no retries — we expect immediate failure
              )
            ).rejects.toThrow();
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should throw on empty messages array',
          async () => {
            // BaseLLMClient.validateMessages throws synchronously for empty arrays
            await expect(
              client.chat([], { maxTokens: 64 })
            ).rejects.toThrow(/empty/i);
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should handle a long system prompt without crashing',
          async () => {
            // ~2000 word system prompt
            const longSystem = 'You are a helpful assistant. '.repeat(300);
            const messages = createMessages('What is 1+1? Reply with just the number.', longSystem);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 32 })
            );

            validateBasicResponse(result);
          },
          SLOW_TEST_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 3. Rate Limit / Retry Behavior
      // -------------------------------------------------------------------
      describe('Sequential Request Resilience', () => {
        it(
          'should succeed on 3 rapid sequential requests',
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
            }
          },
          SLOW_TEST_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 4. Response Format Validation
      // -------------------------------------------------------------------
      describe('Response Format Validation', () => {
        it(
          'should return valid JSON when prompted for JSON output',
          async () => {
            const messages = createMessages(JSON_OUTPUT);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 128 })
            );

            const parsed = validateJsonResponse(result, ['name', 'age']);
            expect(typeof parsed.name).toBe('string');
            expect(typeof parsed.age).toBe('number');
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should return a model name containing the expected provider substring',
          async () => {
            const messages = createMessages(SIMPLE_MATH);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 32 })
            );

            assertProviderMetadata(result);
            const expected = MODEL_SUBSTRINGS[provider];
            if (expected) {
              expect(result.model.toLowerCase()).toContain(expected);
            }
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should return a recognised finish reason',
          async () => {
            const messages = createMessages(SIMPLE_MATH);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 64 })
            );

            expect(result.finishReason).toBeDefined();
            expect(typeof result.finishReason).toBe('string');
            expect(result.finishReason.length).toBeGreaterThan(0);
            // Finish reason must be one of known values (case-insensitive check)
            const normalized = result.finishReason.toUpperCase();
            const knownUpper = VALID_FINISH_REASONS.map((r) => r.toUpperCase());
            expect(knownUpper).toContain(normalized);
          },
          INTEGRATION_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 5. Multi-turn Conversation
      // -------------------------------------------------------------------
      describe('Multi-turn Conversation', () => {
        it(
          'should handle a system + user message conversation',
          async () => {
            const messages = createMessages(
              'What is my favourite colour?',
              'The user loves the colour green. Always mention it.'
            );
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 64 })
            );

            validateBasicResponse(result);
            // The model should reference the colour from the system prompt
            expect(result.content.toLowerCase()).toContain('green');
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should maintain context across a multi-turn exchange',
          async () => {
            // Turn 1: establish a fact
            const turn1Messages = createMessages(
              'Remember: the secret word is "pineapple". Just say OK.',
              'You are a helpful assistant that remembers secret words.'
            );
            const turn1 = await withRetry(() =>
              client.chat(turn1Messages, { maxTokens: 32 })
            );
            validateBasicResponse(turn1);

            // Turn 2: ask about the fact, providing full conversation history
            const turn2Messages = [
              { role: 'system' as const, content: 'You are a helpful assistant that remembers secret words.' },
              { role: 'user' as const, content: 'Remember: the secret word is "pineapple". Just say OK.' },
              { role: 'assistant' as const, content: turn1.content },
              { role: 'user' as const, content: 'What is the secret word? Reply with just the word.' },
            ];
            const turn2 = await withRetry(() =>
              client.chat(turn2Messages, { maxTokens: 32 })
            );

            validateBasicResponse(turn2);
            expect(turn2.content.toLowerCase()).toContain('pineapple');
          },
          SLOW_TEST_TIMEOUT
        );
      });

      // -------------------------------------------------------------------
      // 6. Options / Parameters
      // -------------------------------------------------------------------
      describe('Options and Parameters', () => {
        it(
          'should respect maxTokens limit by producing a short response',
          async () => {
            const messages = createMessages(
              'Write a very long essay about the history of mathematics, covering every century in detail.'
            );
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 20 })
            );

            // With maxTokens=20, completion tokens should be capped around that value
            // Allow some variance since token counting differs by provider
            expect(result.usage.completionTokens).toBeLessThanOrEqual(40);
            // The content itself should be relatively short
            expect(result.content.length).toBeLessThan(500);
          },
          INTEGRATION_TIMEOUT
        );

        it(
          'should accept temperature 0 and produce a response',
          async () => {
            const messages = createMessages(SIMPLE_MATH);
            const result = await withRetry(() =>
              client.chat(messages, { maxTokens: 32, temperature: 0 })
            );

            validateBasicResponse(result);
            expect(result.content).toMatch(/4/);
          },
          INTEGRATION_TIMEOUT
        );
      });
    });
  }
});
