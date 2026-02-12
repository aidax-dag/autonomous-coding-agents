/**
 * Cost-Optimized Routing Strategy
 *
 * Downgrades model tier as budget is consumed.
 * >80% usage → balanced, >95% usage → budget.
 *
 * @module shared/llm/routing-strategies/cost-optimized
 */

import type {
  IRoutingStrategy,
  RoutingContext,
  RoutingDecision,
  ModelProfile,
  ModelTier,
} from '../interfaces/routing.interface';

/**
 * Cost optimization thresholds
 */
export interface CostThresholds {
  /** Budget utilization % to switch to balanced (default: 0.8) */
  balancedThreshold: number;
  /** Budget utilization % to switch to budget (default: 0.95) */
  budgetThreshold: number;
}

const DEFAULT_COST_THRESHOLDS: CostThresholds = {
  balancedThreshold: 0.8,
  budgetThreshold: 0.95,
};

/**
 * Cost-Optimized Routing Strategy
 *
 * Automatically downgrades model tier as budget is consumed.
 */
export class CostOptimizedStrategy implements IRoutingStrategy {
  readonly name = 'cost-optimized';
  private thresholds: CostThresholds;
  private budgetLimit: number;

  constructor(budgetLimit: number, thresholds?: Partial<CostThresholds>) {
    this.budgetLimit = budgetLimit;
    this.thresholds = { ...DEFAULT_COST_THRESHOLDS, ...thresholds };
  }

  selectModel(context: RoutingContext, profiles: ModelProfile[]): RoutingDecision {
    const tier = this.determineTier(context);
    const profile = this.selectFromTier(tier, profiles);

    return {
      profile,
      confidence: 0.85,
      reason: `Budget-aware selection → ${tier} tier (remaining: $${(context.budgetRemaining ?? this.budgetLimit).toFixed(4)})`,
      strategy: this.name,
    };
  }

  private determineTier(context: RoutingContext): ModelTier {
    const remaining = context.budgetRemaining ?? this.budgetLimit;
    const utilization = 1 - remaining / this.budgetLimit;

    if (utilization >= this.thresholds.budgetThreshold) return 'budget';
    if (utilization >= this.thresholds.balancedThreshold) return 'balanced';
    return 'quality';
  }

  private selectFromTier(tier: ModelTier, profiles: ModelProfile[]): ModelProfile {
    // Within tier, prefer cheapest
    const tierProfiles = profiles
      .filter((p) => p.tier === tier)
      .sort((a, b) => a.inputCostPer1K - b.inputCostPer1K);

    if (tierProfiles.length > 0) return tierProfiles[0];

    // Fallback: cheapest overall if budget tier empty
    if (tier === 'budget') {
      const sorted = [...profiles].sort((a, b) => a.inputCostPer1K - b.inputCostPer1K);
      return sorted[0];
    }

    // Fallback to any profile in adjacent tier
    const fallback = profiles.filter(
      (p) => p.tier === (tier === 'quality' ? 'balanced' : 'quality')
    );
    return fallback.length > 0 ? fallback[0] : profiles[0];
  }

  setBudgetLimit(limit: number): void {
    this.budgetLimit = limit;
  }
}

/**
 * Create a cost-optimized routing strategy
 */
export function createCostOptimizedStrategy(
  budgetLimit: number,
  thresholds?: Partial<CostThresholds>
): CostOptimizedStrategy {
  return new CostOptimizedStrategy(budgetLimit, thresholds);
}
