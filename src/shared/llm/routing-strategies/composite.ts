/**
 * Composite Routing Strategy
 *
 * Combines multiple strategies with weighted scoring.
 *
 * @module shared/llm/routing-strategies/composite
 */

import type {
  IRoutingStrategy,
  RoutingContext,
  RoutingDecision,
  ModelProfile,
} from '../interfaces/routing.interface';

/**
 * Weighted strategy entry
 */
export interface WeightedStrategy {
  strategy: IRoutingStrategy;
  weight: number;
}

/**
 * Composite Routing Strategy
 *
 * Runs multiple strategies and selects the model with highest weighted score.
 */
export class CompositeStrategy implements IRoutingStrategy {
  readonly name = 'composite';
  private strategies: WeightedStrategy[];

  constructor(strategies: WeightedStrategy[]) {
    if (strategies.length === 0) {
      throw new Error('CompositeStrategy requires at least one strategy');
    }
    this.strategies = strategies;
  }

  selectModel(context: RoutingContext, profiles: ModelProfile[]): RoutingDecision {
    const decisions = this.strategies.map(({ strategy, weight }) => ({
      decision: strategy.selectModel(context, profiles),
      weight,
    }));

    // Score each profile by weighted confidence
    const profileScores = new Map<string, { score: number; decision: RoutingDecision }>();

    for (const { decision, weight } of decisions) {
      const profileId = decision.profile.id;
      const existing = profileScores.get(profileId);
      const weightedScore = decision.confidence * weight;

      if (!existing || weightedScore > existing.score) {
        profileScores.set(profileId, { score: weightedScore, decision });
      }
    }

    // Pick highest scoring
    let bestId = '';
    let bestScore = -1;
    for (const [id, { score }] of profileScores) {
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }

    const winner = profileScores.get(bestId)!;
    const reasons = decisions.map(
      ({ decision, weight }) => `${decision.strategy}(w=${weight}): ${decision.profile.id}`
    );

    return {
      profile: winner.decision.profile,
      confidence: bestScore / this.totalWeight(),
      reason: `Composite: ${reasons.join(', ')}`,
      strategy: this.name,
    };
  }

  private totalWeight(): number {
    return this.strategies.reduce((sum, s) => sum + s.weight, 0);
  }

  getStrategies(): WeightedStrategy[] {
    return [...this.strategies];
  }
}

/**
 * Create a composite routing strategy
 */
export function createCompositeStrategy(strategies: WeightedStrategy[]): CompositeStrategy {
  return new CompositeStrategy(strategies);
}
