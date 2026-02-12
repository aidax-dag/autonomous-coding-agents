/**
 * Capability-Based Routing Strategy
 *
 * Maps agent roles to optimal model profiles based on task requirements.
 *
 * @module shared/llm/routing-strategies/capability-based
 */

import type {
  IRoutingStrategy,
  RoutingContext,
  RoutingDecision,
  ModelProfile,
  ModelTier,
} from '../interfaces/routing.interface';
import type { TeamType } from '@/core/workspace/task-document';

/**
 * Default agent role → tier mapping
 */
const DEFAULT_ROLE_TIER_MAP: Record<string, ModelTier> = {
  orchestrator: 'quality',
  planning: 'quality',
  development: 'balanced',
  frontend: 'balanced',
  backend: 'balanced',
  qa: 'balanced',
  'code-quality': 'quality',
  design: 'balanced',
  infrastructure: 'balanced',
  pm: 'balanced',
  'issue-response': 'budget',
};

/**
 * Capability-Based Routing Strategy
 *
 * Routes based on agent role and required capabilities.
 */
export class CapabilityBasedStrategy implements IRoutingStrategy {
  readonly name = 'capability-based';
  private roleTierMap: Record<string, ModelTier>;

  constructor(roleTierMap?: Record<string, ModelTier>) {
    this.roleTierMap = roleTierMap ?? { ...DEFAULT_ROLE_TIER_MAP };
  }

  selectModel(context: RoutingContext, profiles: ModelProfile[]): RoutingDecision {
    const tier = this.determineTier(context);
    const profile = this.selectFromTier(tier, profiles, context);

    return {
      profile,
      confidence: context.agentRole ? 0.85 : 0.5,
      reason: `Agent role "${context.agentRole ?? 'unknown'}" → ${tier} tier`,
      strategy: this.name,
    };
  }

  private determineTier(context: RoutingContext): ModelTier {
    if (context.agentRole && this.roleTierMap[context.agentRole]) {
      return this.roleTierMap[context.agentRole];
    }
    return 'balanced';
  }

  private selectFromTier(
    tier: ModelTier,
    profiles: ModelProfile[],
    _context: RoutingContext
  ): ModelProfile {
    const tierProfiles = profiles.filter((p) => p.tier === tier);
    if (tierProfiles.length > 0) return tierProfiles[0];

    // Fallback
    const fallback =
      tier === 'quality'
        ? profiles.filter((p) => p.tier === 'balanced')
        : tier === 'budget'
          ? profiles.filter((p) => p.tier === 'balanced')
          : profiles.filter((p) => p.tier === 'quality');

    return fallback.length > 0 ? fallback[0] : profiles[0];
  }

  setRoleTier(role: TeamType, tier: ModelTier): void {
    this.roleTierMap[role] = tier;
  }

  getRoleTierMap(): Record<string, ModelTier> {
    return { ...this.roleTierMap };
  }
}

/**
 * Create a capability-based routing strategy
 */
export function createCapabilityBasedStrategy(
  roleTierMap?: Record<string, ModelTier>
): CapabilityBasedStrategy {
  return new CapabilityBasedStrategy(roleTierMap);
}
