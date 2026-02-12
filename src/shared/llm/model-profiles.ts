/**
 * Model Profiles
 *
 * Default model profiles and profile registry for multi-model routing.
 *
 * @module shared/llm/model-profiles
 */

import type { ModelProfile, ModelTier } from './interfaces/routing.interface';

/**
 * Default model profiles for common providers
 */
export const DEFAULT_MODEL_PROFILES: ModelProfile[] = [
  // Quality tier
  {
    id: 'claude-opus',
    name: 'Claude Opus',
    tier: 'quality',
    provider: 'claude',
    model: 'claude-opus-4-6',
    inputCostPer1K: 0.015,
    outputCostPer1K: 0.075,
    maxContextLength: 200000,
    capabilities: ['reasoning', 'coding', 'analysis', 'creative'],
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    tier: 'quality',
    provider: 'openai',
    model: 'gpt-4o',
    inputCostPer1K: 0.005,
    outputCostPer1K: 0.015,
    maxContextLength: 128000,
    capabilities: ['reasoning', 'coding', 'analysis'],
  },
  // Balanced tier
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    tier: 'balanced',
    provider: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    inputCostPer1K: 0.003,
    outputCostPer1K: 0.015,
    maxContextLength: 200000,
    capabilities: ['reasoning', 'coding', 'analysis'],
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    tier: 'balanced',
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    inputCostPer1K: 0.00025,
    outputCostPer1K: 0.001,
    maxContextLength: 1000000,
    capabilities: ['reasoning', 'coding'],
  },
  // Budget tier
  {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    tier: 'budget',
    provider: 'claude',
    model: 'claude-haiku-4-5-20251001',
    inputCostPer1K: 0.0008,
    outputCostPer1K: 0.004,
    maxContextLength: 200000,
    capabilities: ['coding', 'simple-tasks'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    tier: 'budget',
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPer1K: 0.00015,
    outputCostPer1K: 0.0006,
    maxContextLength: 128000,
    capabilities: ['coding', 'simple-tasks'],
  },
];

/**
 * Model Profile Registry
 *
 * Manages available model profiles for routing decisions.
 */
export class ModelProfileRegistry {
  private profiles: Map<string, ModelProfile> = new Map();

  constructor(initialProfiles?: ModelProfile[]) {
    const profiles = initialProfiles ?? DEFAULT_MODEL_PROFILES;
    for (const profile of profiles) {
      this.profiles.set(profile.id, profile);
    }
  }

  register(profile: ModelProfile): void {
    this.profiles.set(profile.id, profile);
  }

  unregister(id: string): boolean {
    return this.profiles.delete(id);
  }

  get(id: string): ModelProfile | undefined {
    return this.profiles.get(id);
  }

  getByTier(tier: ModelTier): ModelProfile[] {
    return Array.from(this.profiles.values()).filter((p) => p.tier === tier);
  }

  getByProvider(provider: string): ModelProfile[] {
    return Array.from(this.profiles.values()).filter((p) => p.provider === provider);
  }

  getAll(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  count(): number {
    return this.profiles.size;
  }

  clear(): void {
    this.profiles.clear();
  }
}

/**
 * Create a model profile registry with defaults
 */
export function createModelProfileRegistry(profiles?: ModelProfile[]): ModelProfileRegistry {
  return new ModelProfileRegistry(profiles);
}
