/**
 * Complexity-Based Routing Strategy
 *
 * Routes to model tier based on message length, code presence, and estimated complexity.
 *
 * @module shared/llm/routing-strategies/complexity-based
 */

import type {
  IRoutingStrategy,
  RoutingContext,
  RoutingDecision,
  ModelProfile,
  ModelTier,
} from '../interfaces/routing.interface';

/**
 * Complexity scoring thresholds
 */
export interface ComplexityThresholds {
  /** Message char count for moderate complexity */
  moderateLength: number;
  /** Message char count for high complexity */
  complexLength: number;
  /** Code patterns that indicate complexity */
  codePatterns: RegExp[];
}

const DEFAULT_THRESHOLDS: ComplexityThresholds = {
  moderateLength: 2000,
  complexLength: 8000,
  codePatterns: [
    /```[\s\S]*?```/,
    /function\s+\w+/,
    /class\s+\w+/,
    /import\s+/,
    /async\s+/,
  ],
};

/**
 * Complexity-Based Routing Strategy
 *
 * Analyzes message content to determine complexity and select appropriate model tier.
 */
export class ComplexityBasedStrategy implements IRoutingStrategy {
  readonly name = 'complexity-based';
  private thresholds: ComplexityThresholds;

  constructor(thresholds?: Partial<ComplexityThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  selectModel(context: RoutingContext, profiles: ModelProfile[]): RoutingDecision {
    const tier = this.determineTier(context);
    const profile = this.findBestProfile(tier, profiles);

    return {
      profile,
      confidence: this.calculateConfidence(context),
      reason: `Complexity analysis → ${tier} tier`,
      strategy: this.name,
    };
  }

  private determineTier(context: RoutingContext): ModelTier {
    // Explicit complexity override
    if (context.estimatedComplexity === 'complex') return 'quality';
    if (context.estimatedComplexity === 'simple') return 'budget';
    if (context.estimatedComplexity === 'moderate') return 'balanced';

    const totalLength = context.messages.reduce((sum, m) => sum + m.content.length, 0);
    const hasCode = this.detectCode(context);

    if (totalLength >= this.thresholds.complexLength || (hasCode && totalLength >= this.thresholds.moderateLength)) {
      return 'quality';
    }

    if (totalLength >= this.thresholds.moderateLength || hasCode) {
      return 'balanced';
    }

    return 'budget';
  }

  private detectCode(context: RoutingContext): boolean {
    const content = context.messages.map((m) => m.content).join('\n');
    return this.thresholds.codePatterns.some((pattern) => pattern.test(content));
  }

  private calculateConfidence(context: RoutingContext): number {
    if (context.estimatedComplexity) return 0.9;
    return 0.7;
  }

  private findBestProfile(tier: ModelTier, profiles: ModelProfile[]): ModelProfile {
    const tierProfiles = profiles.filter((p) => p.tier === tier);
    if (tierProfiles.length > 0) return tierProfiles[0];

    // Fallback: find closest tier
    const fallbackOrder: ModelTier[] =
      tier === 'quality'
        ? ['balanced', 'budget']
        : tier === 'budget'
          ? ['balanced', 'quality']
          : ['quality', 'budget'];

    for (const fallbackTier of fallbackOrder) {
      const fallback = profiles.filter((p) => p.tier === fallbackTier);
      if (fallback.length > 0) return fallback[0];
    }

    return profiles[0];
  }
}

/**
 * Create a complexity-based routing strategy
 */
export function createComplexityBasedStrategy(
  thresholds?: Partial<ComplexityThresholds>
): ComplexityBasedStrategy {
  return new ComplexityBasedStrategy(thresholds);
}
