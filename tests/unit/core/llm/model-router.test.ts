/**
 * Model Router Tests
 */

import { ModelRouter } from '@/shared/llm/model-router';
import { ModelProfileRegistry } from '@/shared/llm/model-profiles';
import { ComplexityBasedStrategy } from '@/shared/llm/routing-strategies/complexity-based';
import type { ILLMClient, LLMCompletionResult } from '@/shared/llm/base-client';
import type { ModelProfile, IRoutingStrategy, RoutingDecision, RoutingContext } from '@/shared/llm/interfaces/routing.interface';

const mockResult: LLMCompletionResult = {
  content: 'response',
  model: 'test-model',
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
  finishReason: 'stop',
};

function createMockClient(provider: string): ILLMClient {
  return {
    getProvider: () => provider,
    getDefaultModel: () => `${provider}-default`,
    chat: jest.fn().mockResolvedValue(mockResult),
    chatStream: jest.fn().mockResolvedValue(mockResult),
    getMaxContextLength: () => 200000,
  };
}

const testProfiles: ModelProfile[] = [
  { id: 'q1', name: 'Quality', tier: 'quality', provider: 'mock-a', model: 'q-model', inputCostPer1K: 0.01, outputCostPer1K: 0.03, maxContextLength: 200000, capabilities: [] },
  { id: 'b1', name: 'Balanced', tier: 'balanced', provider: 'mock-a', model: 'b-model', inputCostPer1K: 0.003, outputCostPer1K: 0.015, maxContextLength: 200000, capabilities: [] },
  { id: 'bu1', name: 'Budget', tier: 'budget', provider: 'mock-a', model: 'bu-model', inputCostPer1K: 0.0005, outputCostPer1K: 0.002, maxContextLength: 128000, capabilities: [] },
];

describe('ModelRouter', () => {
  let clients: Map<string, ILLMClient>;
  let profileRegistry: ModelProfileRegistry;

  beforeEach(() => {
    clients = new Map([['mock-a', createMockClient('mock-a')]]);
    profileRegistry = new ModelProfileRegistry(testProfiles);
  });

  it('should implement ILLMClient interface', () => {
    const router = new ModelRouter({
      clients,
      strategy: new ComplexityBasedStrategy(),
      profileRegistry,
    });
    expect(router.getProvider()).toBe('model-router');
    expect(typeof router.getDefaultModel()).toBe('string');
    expect(typeof router.getMaxContextLength()).toBe('number');
  });

  it('should route chat through strategy', async () => {
    const router = new ModelRouter({
      clients,
      strategy: new ComplexityBasedStrategy(),
      profileRegistry,
    });
    const result = await router.chat([{ role: 'user', content: 'hello' }]);
    expect(result.content).toBe('response');
    const client = clients.get('mock-a')!;
    expect(client.chat).toHaveBeenCalled();
  });

  it('should record costs after chat', async () => {
    const router = new ModelRouter({
      clients,
      strategy: new ComplexityBasedStrategy(),
      profileRegistry,
    });
    await router.chat([{ role: 'user', content: 'hello' }]);
    expect(router.getCostTracker().getTotalCost()).toBeGreaterThan(0);
    expect(router.getCostTracker().getRecords()).toHaveLength(1);
  });

  it('should use routing context in chatWithContext', async () => {
    const router = new ModelRouter({
      clients,
      strategy: new ComplexityBasedStrategy(),
      profileRegistry,
    });
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'complex task' }],
      estimatedComplexity: 'complex',
    };
    const result = await router.chatWithContext(ctx.messages, ctx);
    expect(result).toBeDefined();
    const client = clients.get('mock-a')!;
    expect(client.chat).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: 'q-model' }),
    );
  });

  it('should switch strategy', () => {
    const router = new ModelRouter({
      clients,
      strategy: new ComplexityBasedStrategy(),
      profileRegistry,
    });
    const newStrategy: IRoutingStrategy = {
      name: 'custom',
      selectModel: (_ctx, ps): RoutingDecision => ({
        profile: ps[0],
        confidence: 1.0,
        reason: 'custom',
        strategy: 'custom',
      }),
    };
    router.switchStrategy(newStrategy);
    expect(router.getCurrentStrategy().name).toBe('custom');
  });

  it('should get routing decision without execution', () => {
    const router = new ModelRouter({
      clients,
      strategy: new ComplexityBasedStrategy(),
      profileRegistry,
    });
    const decision = router.getRoutingDecision({
      messages: [{ role: 'user', content: 'test' }],
    });
    expect(decision.profile).toBeDefined();
    expect(decision.strategy).toBe('complexity-based');
  });

  it('should throw when no clients provided', () => {
    expect(
      () =>
        new ModelRouter({
          clients: new Map(),
          strategy: new ComplexityBasedStrategy(),
        }),
    ).toThrow('at least one client');
  });

  it('should enforce budget limit', async () => {
    const router = new ModelRouter({
      clients,
      strategy: new ComplexityBasedStrategy(),
      profileRegistry,
      budgetLimit: 0.0001,
    });
    await router.chat([{ role: 'user', content: 'test' }]);
    expect(router.getCostTracker().isBudgetExceeded()).toBe(true);
  });
});
