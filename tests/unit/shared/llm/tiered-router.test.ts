/**
 * TieredRouter & DefaultRoutingStrategy Unit Tests
 */

import {
  TieredRouter,
  createTieredRouter,
  DefaultRoutingStrategy,
  ModelTier,
  DEFAULT_MODEL_MAPPING,
  type IRoutingStrategy,
} from '../../../../src/shared/llm/index.js';
import type {
  ILLMClient,
  LLMMessage,
  LLMCompletionResult,
} from '../../../../src/shared/llm/base-client.js';

// Mock LLM client
function createMockClient(provider = 'claude'): ILLMClient {
  return {
    getProvider: () => provider,
    getDefaultModel: () => 'mock-model',
    chat: jest.fn(async (_msgs: LLMMessage[], options?: any): Promise<LLMCompletionResult> => ({
      content: 'mock response',
      model: options?.model ?? 'mock-model',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      finishReason: 'stop',
    })),
    chatStream: jest.fn(async (_msgs: LLMMessage[], _cb: any, options?: any): Promise<LLMCompletionResult> => ({
      content: 'mock stream response',
      model: options?.model ?? 'mock-model',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      finishReason: 'stop',
    })),
    getMaxContextLength: () => 200000,
  };
}

describe('DefaultRoutingStrategy', () => {
  const strategy = new DefaultRoutingStrategy();

  describe('evaluateComplexity', () => {
    it('should return explicit complexity when provided', () => {
      expect(strategy.evaluateComplexity({ description: 'anything', complexity: 3 })).toBe(3);
      expect(strategy.evaluateComplexity({ description: 'anything', complexity: 8 })).toBe(8);
    });

    it('should clamp complexity to 1-10', () => {
      expect(strategy.evaluateComplexity({ description: '', complexity: 0 })).toBe(1);
      expect(strategy.evaluateComplexity({ description: '', complexity: 15 })).toBe(10);
    });

    it('should rate simple tasks as low complexity', () => {
      const complexity = strategy.evaluateComplexity({ description: 'fix typo in readme' });
      expect(complexity).toBeLessThanOrEqual(4);
    });

    it('should rate complex tasks as high complexity', () => {
      const complexity = strategy.evaluateComplexity({
        description: 'architect a distributed system with security audit and optimization',
      });
      expect(complexity).toBeGreaterThanOrEqual(7);
    });

    it('should default to medium for ambiguous tasks', () => {
      const complexity = strategy.evaluateComplexity({ description: 'update the config' });
      expect(complexity).toBeGreaterThanOrEqual(3);
      expect(complexity).toBeLessThanOrEqual(7);
    });
  });

  describe('selectTier', () => {
    it('should select FAST for low complexity', () => {
      expect(strategy.selectTier(1)).toBe(ModelTier.FAST);
      expect(strategy.selectTier(3)).toBe(ModelTier.FAST);
    });

    it('should select BALANCED for medium complexity', () => {
      expect(strategy.selectTier(4)).toBe(ModelTier.BALANCED);
      expect(strategy.selectTier(7)).toBe(ModelTier.BALANCED);
    });

    it('should select POWERFUL for high complexity', () => {
      expect(strategy.selectTier(8)).toBe(ModelTier.POWERFUL);
      expect(strategy.selectTier(10)).toBe(ModelTier.POWERFUL);
    });

    it('should force FAST when budget is very low', () => {
      expect(strategy.selectTier(10, 0.5)).toBe(ModelTier.FAST);
    });

    it('should ignore budget when sufficient', () => {
      expect(strategy.selectTier(10, 100)).toBe(ModelTier.POWERFUL);
    });
  });

  describe('selectModel', () => {
    it('should return correct model for provider and tier', () => {
      expect(strategy.selectModel(ModelTier.FAST, 'claude')).toBe(DEFAULT_MODEL_MAPPING.claude[ModelTier.FAST]);
      expect(strategy.selectModel(ModelTier.POWERFUL, 'openai')).toBe(DEFAULT_MODEL_MAPPING.openai[ModelTier.POWERFUL]);
    });

    it('should fallback to claude for unknown provider', () => {
      const model = strategy.selectModel(ModelTier.BALANCED, 'unknown-provider');
      expect(model).toBe(DEFAULT_MODEL_MAPPING.claude[ModelTier.BALANCED]);
    });
  });
});

describe('TieredRouter', () => {
  let client: ILLMClient;
  let router: TieredRouter;

  beforeEach(() => {
    client = createMockClient();
    router = createTieredRouter({ client });
  });

  describe('route', () => {
    it('should route simple task to FAST tier', () => {
      const selection = router.route({ description: 'fix typo', complexity: 2 });
      expect(selection.tier).toBe(ModelTier.FAST);
      expect(selection.model).toBe(DEFAULT_MODEL_MAPPING.claude[ModelTier.FAST]);
    });

    it('should route complex task to POWERFUL tier', () => {
      const selection = router.route({ description: 'architecture', complexity: 9 });
      expect(selection.tier).toBe(ModelTier.POWERFUL);
      expect(selection.model).toBe(DEFAULT_MODEL_MAPPING.claude[ModelTier.POWERFUL]);
    });

    it('should include rationale', () => {
      const selection = router.route({ description: 'test', complexity: 5 });
      expect(selection.rationale).toContain('complexity=5');
      expect(selection.rationale).toContain('tier=balanced');
    });

    it('should store last selection', () => {
      expect(router.getLastSelection()).toBeUndefined();
      router.route({ description: 'test', complexity: 5 });
      expect(router.getLastSelection()).toBeDefined();
    });
  });

  describe('ILLMClient implementation', () => {
    it('should delegate getProvider to underlying client', () => {
      expect(router.getProvider()).toBe('claude');
    });

    it('should use routed model in chat', async () => {
      router.setTaskContext({ description: 'simple fix', complexity: 2 });
      await router.chat([{ role: 'user', content: 'test' }]);
      expect(client.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'test' }],
        expect.objectContaining({ model: DEFAULT_MODEL_MAPPING.claude[ModelTier.FAST] }),
      );
    });

    it('should use routed model in chatStream', async () => {
      router.setTaskContext({ description: 'complex architecture', complexity: 9 });
      const callback = jest.fn();
      await router.chatStream([{ role: 'user', content: 'test' }], callback);
      expect(client.chatStream).toHaveBeenCalledWith(
        [{ role: 'user', content: 'test' }],
        callback,
        expect.objectContaining({ model: DEFAULT_MODEL_MAPPING.claude[ModelTier.POWERFUL] }),
      );
    });

    it('should respect explicit model override', async () => {
      router.setTaskContext({ description: 'test', complexity: 2 });
      await router.chat([{ role: 'user', content: 'test' }], { model: 'explicit-model' });
      expect(client.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'test' }],
        expect.objectContaining({ model: 'explicit-model' }),
      );
    });

    it('should use default tier when no context set', async () => {
      await router.chat([{ role: 'user', content: 'test' }]);
      expect(client.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'test' }],
        expect.objectContaining({ model: DEFAULT_MODEL_MAPPING.claude[ModelTier.BALANCED] }),
      );
    });
  });

  describe('custom strategy', () => {
    it('should use custom routing strategy', () => {
      const customStrategy: IRoutingStrategy = {
        evaluateComplexity: () => 1,
        selectTier: () => ModelTier.POWERFUL,
        selectModel: () => 'custom-powerful-model',
      };

      const customRouter = createTieredRouter({ client, strategy: customStrategy });
      const selection = customRouter.route({ description: 'anything' });
      expect(selection.tier).toBe(ModelTier.POWERFUL);
      expect(selection.model).toBe('custom-powerful-model');
    });
  });

  describe('different providers', () => {
    it('should select correct models for OpenAI provider', () => {
      const openaiClient = createMockClient('openai');
      const openaiRouter = createTieredRouter({ client: openaiClient });
      const selection = openaiRouter.route({ description: 'test', complexity: 5 });
      expect(selection.model).toBe(DEFAULT_MODEL_MAPPING.openai[ModelTier.BALANCED]);
    });
  });
});
