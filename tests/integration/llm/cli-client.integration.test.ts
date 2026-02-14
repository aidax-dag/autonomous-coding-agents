/**
 * CLI Client Integration Tests
 *
 * Validates real CLI-based LLM clients (Claude CLI, Ollama).
 * Tests are skipped when the corresponding CLI tool is not available
 * or LLM_INTEGRATION_ENABLED is not 'true'.
 *
 * Run with: npm run test:integration
 * Dry run:  npm run test:integration:dry
 */

import { ClaudeCLIClient } from '../../../src/shared/llm/cli/claude-cli-client';
import { OllamaClient } from '../../../src/shared/llm/cli/ollama-client';

import {
  getProviderKey,
  INTEGRATION_TIMEOUT,
  SLOW_TEST_TIMEOUT,
} from './helpers/integration-config';
import {
  describeIntegration,
  withRetry,
  createMessages,
} from './helpers/integration-test-base';
import { SIMPLE_MATH, MINIMAL_PROMPT } from './helpers/test-prompts';
import {
  validateBasicResponse,
  assertProviderMetadata,
} from './helpers/response-validators';
import { isIntegrationEnabled, getSkipReason } from './helpers/integration-config';

describeIntegration('CLI Client Integration', () => {
  // ---------------------------------------------------------------------------
  // Claude CLI
  // ---------------------------------------------------------------------------
  describe('claude-cli', () => {
    let client: ClaudeCLIClient;
    let available = false;

    beforeAll(async () => {
      if (!isIntegrationEnabled()) return;
      client = new ClaudeCLIClient();
      const availability = await client.checkAvailability();
      available = availability.available;
    });

    /**
     * Helper to conditionally skip tests when the CLI is not installed.
     */
    function skipIfUnavailable(): void {
      if (!isIntegrationEnabled() || !available) {
        pending('Claude CLI is not available on this machine');
      }
    }

    it(
      'should report availability status',
      async () => {
        if (!isIntegrationEnabled()) {
          pending('LLM_INTEGRATION_ENABLED is not set');
          return;
        }
        const availability = await client.checkAvailability();
        expect(availability).toBeDefined();
        expect(typeof availability.available).toBe('boolean');
        if (availability.available) {
          expect(availability.path).toBeDefined();
        }
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should execute CLI and return response',
      async () => {
        skipIfUnavailable();
        const messages = createMessages(SIMPLE_MATH);
        const result = await withRetry(
          () => client.chat(messages, { maxTokens: 100 }),
          1
        );

        validateBasicResponse(result);
        assertProviderMetadata(result);
      },
      SLOW_TEST_TIMEOUT
    );

    it(
      'should timeout on slow response when timeout is very short',
      async () => {
        skipIfUnavailable();
        const messages = createMessages(
          'Write a 5000 word essay about the history of computing.'
        );

        // Use an extremely short timeout to force a timeout error
        await expect(
          client.chat(messages, { timeout: 100 })
        ).rejects.toThrow();
      },
      INTEGRATION_TIMEOUT
    );
  });

  // ---------------------------------------------------------------------------
  // Ollama
  // ---------------------------------------------------------------------------
  describe('ollama', () => {
    let client: OllamaClient;
    let serverAvailable = false;

    beforeAll(async () => {
      if (!isIntegrationEnabled()) return;
      const host = getProviderKey('ollama') || 'http://localhost:11434';
      client = new OllamaClient('llama3', host);
      const status = await client.checkServer();
      serverAvailable = status.available;
    });

    /**
     * Helper to conditionally skip tests when Ollama is not running.
     */
    function skipIfUnavailable(): void {
      if (!isIntegrationEnabled() || !serverAvailable) {
        pending('Ollama server is not running');
      }
    }

    it(
      'should report server availability',
      async () => {
        if (!isIntegrationEnabled()) {
          pending('LLM_INTEGRATION_ENABLED is not set');
          return;
        }
        const status = await client.checkServer();
        expect(status).toBeDefined();
        expect(typeof status.available).toBe('boolean');
        if (status.available) {
          expect(Array.isArray(status.models)).toBe(true);
        }
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'should execute a prompt and return response',
      async () => {
        skipIfUnavailable();
        const messages = createMessages(MINIMAL_PROMPT);
        const result = await withRetry(
          () => client.chat(messages, { maxTokens: 64 }),
          1
        );

        validateBasicResponse(result);
        assertProviderMetadata(result);
      },
      SLOW_TEST_TIMEOUT
    );

    it(
      'should timeout on slow response when timeout is very short',
      async () => {
        skipIfUnavailable();
        const messages = createMessages(
          'Write a 5000 word essay about the history of computing.'
        );

        await expect(
          client.chat(messages, { timeout: 50 })
        ).rejects.toThrow();
      },
      INTEGRATION_TIMEOUT
    );
  });
});
