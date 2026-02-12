/**
 * Capability-Based Strategy Tests
 */

import { CapabilityBasedStrategy } from '@/shared/llm/routing-strategies/capability-based';
import type { ModelProfile, RoutingContext } from '@/shared/llm/interfaces/routing.interface';

const profiles: ModelProfile[] = [
  { id: 'q1', name: 'Quality', tier: 'quality', provider: 'p', model: 'q', inputCostPer1K: 0.01, outputCostPer1K: 0.03, maxContextLength: 200000, capabilities: [] },
  { id: 'b1', name: 'Balanced', tier: 'balanced', provider: 'p', model: 'b', inputCostPer1K: 0.003, outputCostPer1K: 0.015, maxContextLength: 200000, capabilities: [] },
  { id: 'bu1', name: 'Budget', tier: 'budget', provider: 'p', model: 'bu', inputCostPer1K: 0.0005, outputCostPer1K: 0.002, maxContextLength: 128000, capabilities: [] },
];

describe('CapabilityBasedStrategy', () => {
  let strategy: CapabilityBasedStrategy;

  beforeEach(() => {
    strategy = new CapabilityBasedStrategy();
  });

  it('should route planning role to quality tier', () => {
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'plan' }],
      agentRole: 'planning',
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('quality');
    expect(decision.confidence).toBe(0.85);
  });

  it('should route development role to balanced tier', () => {
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'code' }],
      agentRole: 'development',
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('balanced');
  });

  it('should route issue-response to budget tier', () => {
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'respond' }],
      agentRole: 'issue-response',
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('budget');
  });

  it('should default to balanced for unknown roles', () => {
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'test' }],
    };
    const decision = strategy.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('balanced');
    expect(decision.confidence).toBe(0.5);
  });

  it('should support custom role-tier mapping', () => {
    const custom = new CapabilityBasedStrategy({ development: 'quality' });
    const ctx: RoutingContext = {
      messages: [{ role: 'user', content: 'code' }],
      agentRole: 'development',
    };
    const decision = custom.selectModel(ctx, profiles);
    expect(decision.profile.tier).toBe('quality');
  });
});
