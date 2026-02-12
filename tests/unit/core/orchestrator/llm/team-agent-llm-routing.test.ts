/**
 * Team Agent LLM Adapter - Routing Integration Tests
 *
 * Tests the routing-aware behavior added to TeamAgentLLMAdapter:
 * - isModelRouter type guard
 * - agentRole field
 * - chatWithContext conditional dispatch
 */

import { z } from 'zod';
import {
  TeamAgentLLMAdapter,
  createTeamAgentLLMAdapter,
  isModelRouter,
} from '../../../../../src/core/orchestrator/llm/team-agent-llm';
import type { ILLMClient, LLMCompletionResult } from '../../../../../src/shared/llm/base-client';
import type { IModelRouter, RoutingContext, RoutingDecision, ICostTracker, IRoutingStrategy } from '../../../../../src/shared/llm/interfaces/routing.interface';
import type { LLMMessage } from '../../../../../src/shared/llm/base-client';

// ============================================================================
// Helpers
// ============================================================================

function makeCompletionResult(content: string): LLMCompletionResult {
  return {
    content,
    model: 'test-model',
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
  };
}

function makeMockClient(overrides: Partial<ILLMClient> = {}): ILLMClient {
  return {
    getProvider: jest.fn().mockReturnValue('test'),
    getDefaultModel: jest.fn().mockReturnValue('test-model'),
    chat: jest.fn().mockResolvedValue(makeCompletionResult('{"result": "ok"}')),
    chatStream: jest.fn().mockResolvedValue(makeCompletionResult('streamed')),
    getMaxContextLength: jest.fn().mockReturnValue(4096),
    ...overrides,
  };
}

function makeMockModelRouter(overrides: Partial<IModelRouter> = {}): IModelRouter {
  return {
    getProvider: jest.fn().mockReturnValue('model-router'),
    getDefaultModel: jest.fn().mockReturnValue('auto'),
    chat: jest.fn().mockResolvedValue(makeCompletionResult('{"result": "routed"}')),
    chatStream: jest.fn().mockResolvedValue(makeCompletionResult('streamed')),
    getMaxContextLength: jest.fn().mockReturnValue(200000),
    chatWithContext: jest.fn().mockResolvedValue(makeCompletionResult('{"result": "context-routed"}')),
    getRoutingDecision: jest.fn().mockReturnValue({
      profile: { id: 'test', name: 'Test', tier: 'balanced', provider: 'test', model: 'test', inputCostPer1K: 0, outputCostPer1K: 0, maxContextLength: 4096, capabilities: [] },
      confidence: 0.9,
      reason: 'test',
      strategy: 'test',
    } as RoutingDecision),
    getCostTracker: jest.fn().mockReturnValue({
      record: jest.fn(),
      getTotalCost: jest.fn().mockReturnValue(0),
      setBudget: jest.fn(),
      isBudgetExceeded: jest.fn().mockReturnValue(false),
      getRemainingBudget: jest.fn().mockReturnValue(Infinity),
      getRecords: jest.fn().mockReturnValue([]),
      reset: jest.fn(),
    } as ICostTracker),
    switchStrategy: jest.fn(),
    getCurrentStrategy: jest.fn().mockReturnValue({ name: 'test' } as IRoutingStrategy),
    ...overrides,
  };
}

// ============================================================================
// isModelRouter type guard
// ============================================================================

describe('isModelRouter', () => {
  it('should return false for a plain ILLMClient', () => {
    const client = makeMockClient();
    expect(isModelRouter(client)).toBe(false);
  });

  it('should return true for a ModelRouter-like object', () => {
    const router = makeMockModelRouter();
    expect(isModelRouter(router)).toBe(true);
  });

  it('should return false when chatWithContext is not a function', () => {
    const client = makeMockClient({ chatWithContext: 'not-a-function' } as unknown as Partial<ILLMClient>);
    expect(isModelRouter(client)).toBe(false);
  });
});

// ============================================================================
// TeamAgentLLMAdapter - routing features
// ============================================================================

describe('TeamAgentLLMAdapter routing', () => {
  describe('agentRole', () => {
    it('should store agentRole when provided', () => {
      const client = makeMockClient();
      const adapter = new TeamAgentLLMAdapter({ client, agentRole: 'planning' });
      expect(adapter.getAgentRole()).toBe('planning');
    });

    it('should return undefined when agentRole is not set', () => {
      const client = makeMockClient();
      const adapter = new TeamAgentLLMAdapter({ client });
      expect(adapter.getAgentRole()).toBeUndefined();
    });

    it('should accept any valid TeamType as agentRole', () => {
      const client = makeMockClient();
      const roles = ['planning', 'development', 'qa', 'frontend', 'backend'] as const;
      for (const role of roles) {
        const adapter = new TeamAgentLLMAdapter({ client, agentRole: role });
        expect(adapter.getAgentRole()).toBe(role);
      }
    });
  });

  describe('executeWithRetry routing dispatch', () => {
    const schema = z.object({ result: z.string() });

    it('should call chat() on a plain client even with agentRole', async () => {
      const client = makeMockClient();
      const adapter = new TeamAgentLLMAdapter({ client, agentRole: 'planning' });

      await adapter.execute('system', 'user', schema);

      expect(client.chat).toHaveBeenCalledTimes(1);
    });

    it('should call chatWithContext() when client is ModelRouter and agentRole is set', async () => {
      const router = makeMockModelRouter();
      const adapter = new TeamAgentLLMAdapter({ client: router, agentRole: 'development' });

      await adapter.execute('system', 'user', schema);

      expect(router.chatWithContext).toHaveBeenCalledTimes(1);
      expect(router.chat).not.toHaveBeenCalled();

      // Verify routing context includes agentRole
      const call = (router.chatWithContext as jest.Mock).mock.calls[0];
      const routingContext: RoutingContext = call[1];
      expect(routingContext.agentRole).toBe('development');
    });

    it('should call chat() when client is ModelRouter but agentRole is NOT set', async () => {
      const router = makeMockModelRouter();
      const adapter = new TeamAgentLLMAdapter({ client: router });

      await adapter.execute('system', 'user', schema);

      expect(router.chat).toHaveBeenCalledTimes(1);
      expect(router.chatWithContext).not.toHaveBeenCalled();
    });

    it('should pass messages in routing context', async () => {
      const router = makeMockModelRouter();
      const adapter = new TeamAgentLLMAdapter({ client: router, agentRole: 'qa' });

      await adapter.execute('sys prompt', 'user prompt', schema);

      const call = (router.chatWithContext as jest.Mock).mock.calls[0];
      const messages: LLMMessage[] = call[0];
      const routingContext: RoutingContext = call[1];

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(routingContext.messages).toBe(messages);
    });

    it('should pass merged options to chatWithContext', async () => {
      const router = makeMockModelRouter();
      const adapter = new TeamAgentLLMAdapter({ client: router, agentRole: 'planning', temperature: 0.5 });

      await adapter.execute('system', 'user', schema, { maxTokens: 2000 });

      const call = (router.chatWithContext as jest.Mock).mock.calls[0];
      const options = call[2];
      expect(options.temperature).toBe(0.5);
      expect(options.maxTokens).toBe(2000);
    });

    it('should work with executeRaw for routing dispatch', async () => {
      const router = makeMockModelRouter();
      const adapter = new TeamAgentLLMAdapter({ client: router, agentRole: 'development' });

      const result = await adapter.executeRaw('system', 'user');

      expect(router.chatWithContext).toHaveBeenCalledTimes(1);
      expect(result.content).toBe('{"result": "context-routed"}');
    });
  });

  describe('createTeamAgentLLMAdapter factory', () => {
    it('should create adapter with agentRole', () => {
      const client = makeMockClient();
      const adapter = createTeamAgentLLMAdapter({ client, agentRole: 'qa' });
      expect(adapter.getAgentRole()).toBe('qa');
    });

    it('should create adapter without agentRole (legacy)', () => {
      const client = makeMockClient();
      const adapter = createTeamAgentLLMAdapter({ client });
      expect(adapter.getAgentRole()).toBeUndefined();
    });
  });
});
