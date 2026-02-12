/**
 * Cost-Optimized Strategy Tests
 */

import { CostOptimizedStrategy } from '@/shared/llm/routing-strategies/cost-optimized';
import type { ModelProfile, RoutingContext } from '@/shared/llm/interfaces/routing.interface';

const profiles: ModelProfile[] = [
  { id: 'q1', name: 'Quality', tier: 'quality', provider: 'p', model: 'q', inputCostPer1K: 0.01, outputCostPer1K: 0.03, maxContextLength: 200000, capabilities: [] },
  { id: 'b1', name: 'Balanced', tier: 'balanced', provider: 'p', model: 'b', inputCostPer1K: 0.003, outputCostPer1K: 0.015, maxContextLength: 200000, capabilities: [] },
  { id: 'bu1', name: 'Budget', tier: 'budget', provider: 'p', model: 'bu', inputCostPer1K: 0.0005, outputCostPer1K: 0.002, maxContextLength: 128000, capabilities: [] },
];

describe('CostOptimizedStrategy', () => {
  it('should select quality tier when budget usage is low', () => {
    const strategy = new CostOptimizedStrategy(1.0);
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'test' }],
      budgetRemaining: 0.9, // 10% used
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('quality');
  });

  it('should downgrade to balanced when >80% budget used', () => {
    const strategy = new CostOptimizedStrategy(1.0);
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'test' }],
      budgetRemaining: 0.15, // 85% used
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('balanced');
  });

  it('should downgrade to budget when >95% budget used', () => {
    const strategy = new CostOptimizedStrategy(1.0);
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'test' }],
      budgetRemaining: 0.03, // 97% used
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('budget');
  });

  it('should prefer cheapest model within tier', () => {
    const multiProfiles: ModelProfile[] = [
      ...profiles,
      { id: 'bu2', name: 'Budget Cheap', tier: 'budget', provider: 'p', model: 'bu2', inputCostPer1K: 0.0001, outputCostPer1K: 0.001, maxContextLength: 100000, capabilities: [] },
    ];
    const strategy = new CostOptimizedStrategy(1.0);
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'test' }],
      budgetRemaining: 0.01,
    };
    const decision = strategy.selectModel(ctx, multiProfiles);
    expect(decision.profile.id).toBe('bu2');
  });

  it('should fallback when tier is empty', () => {
    const noQuality = profiles.filter((p) => p.tier !== 'quality');
    const strategy = new CostOptimizedStrategy(1.0);
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'test' }],
      budgetRemaining: 0.9,
    };
    const decision = strategy.selectModel(ctx, noQuality);
    expect(decision.profile).toBeDefined();
  });
});
