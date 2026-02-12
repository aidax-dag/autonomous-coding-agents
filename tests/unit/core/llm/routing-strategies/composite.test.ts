/**
 * Composite Strategy Tests
 */

import { CompositeStrategy } from '@/shared/llm/routing-strategies/composite';
import { ComplexityBasedStrategy } from '@/shared/llm/routing-strategies/complexity-based';
import { CapabilityBasedStrategy } from '@/shared/llm/routing-strategies/capability-based';
import type { ModelProfile, RoutingContext, IRoutingStrategy, RoutingDecision } from '@/shared/llm/interfaces/routing.interface';

const profiles: ModelProfile[] = [
  { id: 'q1', name: 'Quality', tier: 'quality', provider: 'p', model: 'q', inputCostPer1K: 0.01, outputCostPer1K: 0.03, maxContextLength: 200000, capabilities: [] },
  { id: 'b1', name: 'Balanced', tier: 'balanced', provider: 'p', model: 'b', inputCostPer1K: 0.003, outputCostPer1K: 0.015, maxContextLength: 200000, capabilities: [] },
  { id: 'bu1', name: 'Budget', tier: 'budget', provider: 'p', model: 'bu', inputCostPer1K: 0.0005, outputCostPer1K: 0.002, maxContextLength: 128000, capabilities: [] },
];

describe('CompositeStrategy', () => {
  it('should combine strategies and select winning profile', () => {
    const composite = new CompositeStrategy([
      { strategy: new ComplexityBasedStrategy(), weight: 0.5 },
      { strategy: new CapabilityBasedStrategy(), weight: 0.5 },
    ]);
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'short msg' }],
      agentRole: 'planning',
    };
    const decision = composite.selectModel(ctx, profiles);
    expect(decision.profile).toBeDefined();
    expect(decision.strategy).toBe('composite');
  });

  it('should favor higher weighted strategy', () => {
    const alwaysQuality: IRoutingStrategy = {
      name: 'always-quality',
      selectModel: (_ctx, ps): RoutingDecision => ({
        profile: ps.find((p) => p.tier === 'quality')!,
        confidence: 1.0,
        reason: 'test',
        strategy: 'always-quality',
      }),
    };
    const alwaysBudget: IRoutingStrategy = {
      name: 'always-budget',
      selectModel: (_ctx, ps): RoutingDecision => ({
        profile: ps.find((p) => p.tier === 'budget')!,
        confidence: 1.0,
        reason: 'test',
        strategy: 'always-budget',
      }),
    };

    const composite = new CompositeStrategy([
      { strategy: alwaysQuality, weight: 0.9 },
      { strategy: alwaysBudget, weight: 0.1 },
    ]);
    const ctx: RoutingContext = { messages: [{ role: 'user', content: 'test' }] };
    const decision = composite.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('quality');
  });

  it('should throw when no strategies provided', () => {
    expect(() => new CompositeStrategy([])).toThrow('at least one strategy');
  });

  it('should return strategy list', () => {
    const composite = new CompositeStrategy([
      { strategy: new ComplexityBasedStrategy(), weight: 1 },
    ]);
    expect(composite.getStrategies()).toHaveLength(1);
  });
});
