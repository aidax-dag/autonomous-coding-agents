/**
 * API Client Integration Tests
 *
 * Validates real API calls to Claude, OpenAI, and Gemini providers.
 * Tests are skipped when the corresponding API key is not set or
 * LLM_INTEGRATION_ENABLED is not 'true'.
 *
 * Run with: npm run test:integration
 * Dry run:  npm run test:integration:dry
 */

import { ClaudeClient } from '../../../src/shared/llm/claude-client';
import { OpenAIClient } from '../../../src/shared/llm/openai-client';
import { GeminiClient } from '../../../src/shared/llm/gemini-client';
import type { ILLMClient } from '../../../src/shared/llm/base-client';

import {
  getProviderKey,
  getTestModel,
  INTEGRATION_TIMEOUT,
  SLOW_TEST_TIMEOUT,
} from './helpers/integration-config';
import {
  describeIntegration,
  describeProvider,
  withRetry,
  measureLatency,
  createMessages,
} from './helpers/integration-test-base';
import {
  SIMPLE_MATH,
  SIMPLE_GREETING,
  JSON_OUTPUT,
  TOKEN_COUNTER,
  MINIMAL_PROMPT,
} from './helpers/test-prompts';
import {
  validateBasicResponse,
  validateTokenCounts,
  validateJsonResponse,
  validateResponseTime,
  assertProviderMetadata,
} from './helpers/response-validators';

describeIntegration('API Client Integration', () => {
  // ---------------------------------------------------------------------------
  // Anthropic / Claude
  // ---------------------------------------------------------------------------
  describeProvider('anthropic', () => {
    let client: ILLMClient;

    beforeAll(() => {
      const apiKey = getProviderKey('anthropic')!;
      client = new ClaudeClient(apiKey, getTestModel('anthropic'));
    });

    it(
      'should send a simple prompt and receive a response',
      async () => {
        const messages = createMessages(SIMPLE_MATH);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        validateBasicResponse(result);
        expect(result.content).toMatch(/4/);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should return valid token counts',
      async () => {
        const messages = createMessages(TOKEN_COUNTER);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 128 }));

        validateTokenCounts(result);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should handle a minimal prompt gracefully',
      async () => {
        const messages = createMessages(MINIMAL_PROMPT);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        validateBasicResponse(result);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should return model name in response metadata',
      async () => {
        const messages = createMessages(SIMPLE_GREETING);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        assertProviderMetadata(result);
        expect(result.model).toContain('claude');
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should respond within the integration timeout',
      async () => {
        const messages = createMessages(SIMPLE_MATH);
        const startTime = Date.now();

        await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        validateResponseTime(startTime, SLOW_TEST_TIMEOUT);
      },
      SLOW_TEST_TIMEOUT
    );
  });

  // ---------------------------------------------------------------------------
  // OpenAI
  // ---------------------------------------------------------------------------
  describeProvider('openai', () => {
    let client: ILLMClient;

    beforeAll(() => {
      const apiKey = getProviderKey('openai')!;
      client = new OpenAIClient(apiKey, getTestModel('openai'));
    });

    it(
      'should send a simple prompt and receive a response',
      async () => {
        const messages = createMessages(SIMPLE_MATH);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        validateBasicResponse(result);
        expect(result.content).toMatch(/4/);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should return valid token counts',
      async () => {
        const messages = createMessages(TOKEN_COUNTER);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 128 }));

        validateTokenCounts(result);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should handle a minimal prompt gracefully',
      async () => {
        const messages = createMessages(MINIMAL_PROMPT);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        validateBasicResponse(result);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should return valid JSON when prompted',
      async () => {
        const messages = createMessages(JSON_OUTPUT);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 128 }));

        const parsed = validateJsonResponse(result, ['name', 'age']);
        expect(typeof parsed.name).toBe('string');
        expect(typeof parsed.age).toBe('number');
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should return model name in response metadata',
      async () => {
        const messages = createMessages(SIMPLE_GREETING);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        assertProviderMetadata(result);
        expect(result.model).toContain('gpt');
      },
      INTEGRATION_TIMEOUT
    );
  });

  // ---------------------------------------------------------------------------
  // Gemini
  // ---------------------------------------------------------------------------
  describeProvider('gemini', () => {
    let client: ILLMClient;

    beforeAll(() => {
      const apiKey = getProviderKey('gemini')!;
      client = new GeminiClient(apiKey, getTestModel('gemini'));
    });

    it(
      'should send a simple prompt and receive a response',
      async () => {
        const messages = createMessages(SIMPLE_MATH);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        validateBasicResponse(result);
        expect(result.content).toMatch(/4/);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should return valid token counts',
      async () => {
        const messages = createMessages(TOKEN_COUNTER);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 128 }));

        validateTokenCounts(result);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should handle a minimal prompt gracefully',
      async () => {
        const messages = createMessages(MINIMAL_PROMPT);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        validateBasicResponse(result);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should return model name in response metadata',
      async () => {
        const messages = createMessages(SIMPLE_GREETING);
        const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

        assertProviderMetadata(result);
        // Gemini client returns the model string used in the request
        expect(result.model).toContain('gemini');
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should respond within the integration timeout',
      async () => {
        const messages = createMessages(SIMPLE_MATH);
        const { latencyMs } = await measureLatency(() =>
          withRetry(() => client.chat(messages, { maxTokens: 64 }))
        );

        expect(latencyMs).toBeLessThan(SLOW_TEST_TIMEOUT);
      },
      SLOW_TEST_TIMEOUT
    );
  });
});
