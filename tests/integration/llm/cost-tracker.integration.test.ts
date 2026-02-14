/**
 * Cost Tracker Integration Tests
 *
 * Validates that CostTracker correctly records token usage from
 * real LLM API responses. Uses the cheapest available provider.
 *
 * Run with: npm run test:integration
 * Dry run:  npm run test:integration:dry
 */

import { CostTracker } from '../../../src/shared/llm/cost-tracker';
import { ClaudeClient } from '../../../src/shared/llm/claude-client';
import { OpenAIClient } from '../../../src/shared/llm/openai-client';
import { GeminiClient } from '../../../src/shared/llm/gemini-client';
import type { ILLMClient, LLMCompletionResult } from '../../../src/shared/llm/base-client';
import type { CostRecord } from '../../../src/shared/llm/interfaces/routing.interface';

import {
  getProviderKey,
  getTestModel,
  getAvailableProviders,
  INTEGRATION_TIMEOUT,
  type LLMProvider,
} from './helpers/integration-config';
import {
  describeIntegration,
  withRetry,
  createMessages,
} from './helpers/integration-test-base';
import { SIMPLE_MATH } from './helpers/test-prompts';

/**
 * Cost per 1K tokens by provider (input / output).
 * Used to compute expected cost from real token usage.
 */
const COST_RATES: Record<string, { inputPer1K: number; outputPer1K: number }> = {
  anthropic: { inputPer1K: 0.0008, outputPer1K: 0.004 }, // Haiku pricing
  openai: { inputPer1K: 0.00015, outputPer1K: 0.0006 },  // gpt-4o-mini pricing
  gemini: { inputPer1K: 0.00025, outputPer1K: 0.001 },    // flash pricing
};

/**
 * Create a client for the first available API provider.
 * Returns null if no API provider has a key configured.
 */
function createFirstAvailableClient(): { client: ILLMClient; provider: LLMProvider } | null {
  const providers = getAvailableProviders();

  // Prefer API providers over CLI for cost tracking tests
  const apiProviders: LLMProvider[] = ['openai', 'gemini', 'anthropic'];
  for (const provider of apiProviders) {
    if (providers.includes(provider)) {
      const key = getProviderKey(provider);
      if (!key) continue;

      const model = getTestModel(provider);
      let client: ILLMClient;
      switch (provider) {
        case 'anthropic':
          client = new ClaudeClient(key, model);
          break;
        case 'openai':
          client = new OpenAIClient(key, model);
          break;
        case 'gemini':
          client = new GeminiClient(key, model);
          break;
        default:
          continue;
      }
      return { client, provider };
    }
  }
  return null;
}

/**
 * Compute cost from a completion result using known per-token rates.
 */
function computeCost(
  provider: LLMProvider,
  result: LLMCompletionResult
): number {
  const rates = COST_RATES[provider];
  if (!rates) return 0;
  const inputCost = (result.usage.promptTokens / 1000) * rates.inputPer1K;
  const outputCost = (result.usage.completionTokens / 1000) * rates.outputPer1K;
  return inputCost + outputCost;
}

describeIntegration('Cost Tracker Integration', () => {
  let clientInfo: { client: ILLMClient; provider: LLMProvider } | null;
  let tracker: CostTracker;

  beforeAll(() => {
    clientInfo = createFirstAvailableClient();
    tracker = new CostTracker();
  });

  beforeEach(() => {
    tracker.reset();
  });

  /**
   * Skip tests if no API provider is available.
   */
  function skipIfNoProvider(): void {
    if (!clientInfo) {
      pending('No API provider with key is available for cost tracking tests');
    }
  }

  it(
    'should track token usage from a real API call',
    async () => {
      skipIfNoProvider();
      const { client, provider } = clientInfo!;

      const messages = createMessages(SIMPLE_MATH);
      const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

      // Record the cost
      const cost = computeCost(provider, result);
      const record: CostRecord = {
        timestamp: Date.now(),
        model: result.model,
        provider: client.getProvider(),
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalCost: cost,
      };
      tracker.record(record);

      // Validate tracking
      expect(tracker.getTotalCost()).toBeGreaterThan(0);
      expect(tracker.getRecords()).toHaveLength(1);

      const recorded = tracker.getRecords()[0];
      expect(recorded.inputTokens).toBe(result.usage.promptTokens);
      expect(recorded.outputTokens).toBe(result.usage.completionTokens);
      expect(recorded.model).toBe(result.model);
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'should calculate cost correctly for the provider',
    async () => {
      skipIfNoProvider();
      const { client, provider } = clientInfo!;

      const messages = createMessages(SIMPLE_MATH);
      const result = await withRetry(() => client.chat(messages, { maxTokens: 64 }));

      const expectedCost = computeCost(provider, result);
      const record: CostRecord = {
        timestamp: Date.now(),
        model: result.model,
        provider: client.getProvider(),
        inputTokens: result.usage.promptTokens,
        outputTokens: result.usage.completionTokens,
        totalCost: expectedCost,
      };
      tracker.record(record);

      // The tracked cost should match the computed cost
      expect(tracker.getTotalCost()).toBeCloseTo(expectedCost, 8);

      // Cost should be a small positive number for a simple prompt
      expect(expectedCost).toBeGreaterThan(0);
      expect(expectedCost).toBeLessThan(0.01); // Should be fractions of a cent
    },
    INTEGRATION_TIMEOUT
  );

  it(
    'should accumulate costs across multiple API calls',
    async () => {
      skipIfNoProvider();
      const { client, provider } = clientInfo!;

      const messages = createMessages(SIMPLE_MATH);

      // Make two calls and track both
      const result1 = await withRetry(() => client.chat(messages, { maxTokens: 64 }));
      const cost1 = computeCost(provider, result1);
      tracker.record({
        timestamp: Date.now(),
        model: result1.model,
        provider: client.getProvider(),
        inputTokens: result1.usage.promptTokens,
        outputTokens: result1.usage.completionTokens,
        totalCost: cost1,
      });

      const result2 = await withRetry(() => client.chat(messages, { maxTokens: 64 }));
      const cost2 = computeCost(provider, result2);
      tracker.record({
        timestamp: Date.now(),
        model: result2.model,
        provider: client.getProvider(),
        inputTokens: result2.usage.promptTokens,
        outputTokens: result2.usage.completionTokens,
        totalCost: cost2,
      });

      expect(tracker.getRecords()).toHaveLength(2);
      expect(tracker.getTotalCost()).toBeCloseTo(cost1 + cost2, 8);
    },
    INTEGRATION_TIMEOUT
  );
});
