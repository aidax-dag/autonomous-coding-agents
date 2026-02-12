/**
 * Model Profiles Tests
 */

import {
  ModelProfileRegistry,
  DEFAULT_MODEL_PROFILES,
  createModelProfileRegistry,
} from '@/shared/llm/model-profiles';
import type { ModelProfile } from '@/shared/llm/interfaces/routing.interface';

describe('ModelProfileRegistry', () => {
  let registry: ModelProfileRegistry;

  beforeEach(() => {
    registry = new ModelProfileRegistry();
  });

  it('should initialize with default profiles', () => {
    expect(registry.count()).toBe(DEFAULT_MODEL_PROFILES.length);
  });

  it('should register and retrieve a profile', () => {
    const custom: ModelProfile = {
      id: 'custom-1',
      name: 'Custom',
      tier: 'balanced',
      provider: 'custom',
      model: 'custom-v1',
      inputCostPer1K: 0.001,
      outputCostPer1K: 0.002,
      maxContextLength: 100000,
      capabilities: ['test'],
    };
    registry.register(custom);
    expect(registry.get('custom-1')).toEqual(custom);
  });

  it('should unregister a profile', () => {
    expect(registry.unregister('claude-opus')).toBe(true);
    expect(registry.get('claude-opus')).toBeUndefined();
    expect(registry.unregister('nonexistent')).toBe(false);
  });

  it('should filter by tier', () => {
    const quality = registry.getByTier('quality');
    const balanced = registry.getByTier('balanced');
    const budget = registry.getByTier('budget');
    expect(quality.length).toBeGreaterThan(0);
    expect(balanced.length).toBeGreaterThan(0);
    expect(budget.length).toBeGreaterThan(0);
    expect(quality.every((p) => p.tier === 'quality')).toBe(true);
  });

  it('should filter by provider', () => {
    const claude = registry.getByProvider('claude');
    expect(claude.length).toBeGreaterThan(0);
    expect(claude.every((p) => p.provider === 'claude')).toBe(true);
  });

  it('should clear all profiles', () => {
    registry.clear();
    expect(registry.count()).toBe(0);
    expect(registry.getAll()).toEqual([]);
  });
});

describe('DEFAULT_MODEL_PROFILES', () => {
  it('should contain profiles for all three tiers', () => {
    const tiers = new Set(DEFAULT_MODEL_PROFILES.map((p) => p.tier));
    expect(tiers).toEqual(new Set(['quality', 'balanced', 'budget']));
  });
});

describe('createModelProfileRegistry', () => {
  it('should create registry with custom profiles', () => {
    const custom: ModelProfile[] = [
      {
        id: 'test-1',
        name: 'Test',
        tier: 'budget',
        provider: 'test',
        model: 'test-v1',
        inputCostPer1K: 0.001,
        outputCostPer1K: 0.002,
        maxContextLength: 50000,
        capabilities: [],
      },
    ];
    const reg = createModelProfileRegistry(custom);
    expect(reg.count()).toBe(1);
    expect(reg.get('test-1')).toBeDefined();
  });
});
