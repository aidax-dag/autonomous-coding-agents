/**
 * Complexity-Based Strategy Tests
 */

import { ComplexityBasedStrategy } from '@/shared/llm/routing-strategies/complexity-based';
import type { ModelProfile, RoutingContext } from '@/shared/llm/interfaces/routing.interface';

const profiles: ModelProfile[] = [
  { id: 'q1', name: 'Quality', tier: 'quality', provider: 'p', model: 'q', inputCostPer1K: 0.01, outputCostPer1K: 0.03, maxContextLength: 200000, capabilities: [] },
  { id: 'b1', name: 'Balanced', tier: 'balanced', provider: 'p', model: 'b', inputCostPer1K: 0.003, outputCostPer1K: 0.015, maxContextLength: 200000, capabilities: [] },
  { id: 'bu1', name: 'Budget', tier: 'budget', provider: 'p', model: 'bu', inputCostPer1K: 0.0005, outputCostPer1K: 0.002, maxContextLength: 128000, capabilities: [] },
];

describe('ComplexityBasedStrategy', () => {
  let strategy: ComplexityBasedStrategy;

  beforeEach(() => {
    strategy = new ComplexityBasedStrategy();
  });

  it('should route simple messages to budget tier', () => {
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'Hello world' }],
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('budget');
    expect(decision.strategy).toBe('complexity-based');
  });

  it('should route long messages to quality tier', () => {
    const longContent = 'x'.repeat(10000);
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: longContent }],
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('quality');
  });

  it('should detect code and route to balanced or higher', () => {
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'Please review:\n```\nfunction hello() { return 1; }\n```' }],
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(['balanced', 'quality']).toContain(decision.profile.tier);
  });

  it('should respect explicit estimatedComplexity', () => {
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'short' }],
      estimatedComplexity: 'complex',
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('quality');
    expect(decision.confidence).toBe(0.9);
  });

  it('should fallback when tier has no profiles', () => {
    const limitedProfiles = profiles.filter((p) => p.tier !== 'budget');
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'hi' }],
      estimatedComplexity: 'simple',
    };
    // Should find a fallback (balanced or quality)
    const decision = strategy.selectModel(ctx, limitedProfiles);
    expect(decision.profile).toBeDefined();
  });

  it('should use custom thresholds', () => {
    const custom = new ComplexityBasedStrategy({ moderateLength: 10, complexLength: 20 });
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'x'.repeat(25) }],
    };
    const decision = custom.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('quality');
  });
});
