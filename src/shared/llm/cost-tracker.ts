/**
 * Cost Tracker
 *
 * Tracks LLM API costs by model tier, provider, and time period.
 * Provides cost reports and budget enforcement.
 *
 * @module shared/llm
 */

import type { LLMCompletionResult } from './base-client.js';
import { ModelTier, type TierCostConfig, DEFAULT_TIER_COSTS } from './tiered-router.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A single cost entry
 */
export interface CostEntry {
  /** Timestamp */
  timestamp: number;
  /** Model used */
  model: string;
  /** Model tier */
  tier: ModelTier;
  /** Provider */
  provider: string;
  /** Input tokens */
  inputTokens: number;
  /** Output tokens */
  outputTokens: number;
  /** Estimated cost (in cost units) */
  cost: number;
}

/**
 * Cost report
 */
export interface CostReport {
  /** Total cost */
  totalCost: number;
  /** Cost by tier */
  costByTier: Record<ModelTier, number>;
  /** Cost by provider */
  costByProvider: Record<string, number>;
  /** Total input tokens */
  totalInputTokens: number;
  /** Total output tokens */
  totalOutputTokens: number;
  /** Number of requests */
  requestCount: number;
  /** Average cost per request */
  avgCostPerRequest: number;
  /** Estimated savings vs all-powerful */
  estimatedSavings: number;
  /** Time period covered */
  periodStart: number;
  /** Time period end */
  periodEnd: number;
}

/**
 * CostTracker configuration
 */
export interface CostTrackerConfig {
  /** Cost per 1K tokens by tier */
  tierCosts?: TierCostConfig;
  /** Budget limit (0 = no limit) */
  budgetLimit?: number;
  /** Callback when budget exceeded */
  onBudgetExceeded?: (report: CostReport) => void;
  /** Callback when budget warning threshold reached */
  onBudgetWarning?: (report: CostReport, percentage: number) => void;
  /** Budget warning threshold (0-1, default: 0.8) */
  budgetWarningThreshold?: number;
}

// ============================================================================
// CostTracker
// ============================================================================

/**
 * Tracks and reports LLM API costs
 */
export class CostTracker {
  private readonly tierCosts: TierCostConfig;
  private readonly budgetLimit: number;
  private readonly budgetWarningThreshold: number;
  private readonly onBudgetExceeded?: (report: CostReport) => void;
  private readonly onBudgetWarning?: (report: CostReport, percentage: number) => void;

  private entries: CostEntry[] = [];
  private budgetWarningFired = false;

  constructor(config?: CostTrackerConfig) {
    this.tierCosts = config?.tierCosts ?? DEFAULT_TIER_COSTS;
    this.budgetLimit = config?.budgetLimit ?? 0;
    this.budgetWarningThreshold = config?.budgetWarningThreshold ?? 0.8;
    this.onBudgetExceeded = config?.onBudgetExceeded;
    this.onBudgetWarning = config?.onBudgetWarning;
  }

  /**
   * Record a completion result
   */
  record(
    result: LLMCompletionResult,
    tier: ModelTier,
    provider: string,
  ): CostEntry {
    const costPer1K = this.tierCosts[tier];
    const totalTokens = result.usage.totalTokens;
    const cost = (totalTokens / 1000) * costPer1K;

    const entry: CostEntry = {
      timestamp: Date.now(),
      model: result.model,
      tier,
      provider,
      inputTokens: result.usage.promptTokens,
      outputTokens: result.usage.completionTokens,
      cost,
    };

    this.entries.push(entry);
    this.checkBudget();

    return entry;
  }

  /**
   * Get cost report for all entries or a time window
   */
  getReport(since?: number): CostReport {
    const filtered = since
      ? this.entries.filter((e) => e.timestamp >= since)
      : this.entries;

    const costByTier: Record<ModelTier, number> = {
      [ModelTier.FAST]: 0,
      [ModelTier.BALANCED]: 0,
      [ModelTier.POWERFUL]: 0,
    };

    const costByProvider: Record<string, number> = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;

    for (const entry of filtered) {
      totalCost += entry.cost;
      costByTier[entry.tier] += entry.cost;
      costByProvider[entry.provider] = (costByProvider[entry.provider] ?? 0) + entry.cost;
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;
    }

    // Estimate savings: what would it have cost if all POWERFUL?
    const totalTokens = totalInputTokens + totalOutputTokens;
    const allPowerfulCost = (totalTokens / 1000) * this.tierCosts[ModelTier.POWERFUL];
    const estimatedSavings = allPowerfulCost > 0
      ? ((allPowerfulCost - totalCost) / allPowerfulCost) * 100
      : 0;

    const periodStart = filtered.length > 0 ? filtered[0].timestamp : Date.now();
    const periodEnd = filtered.length > 0 ? filtered[filtered.length - 1].timestamp : Date.now();

    return {
      totalCost,
      costByTier,
      costByProvider,
      totalInputTokens,
      totalOutputTokens,
      requestCount: filtered.length,
      avgCostPerRequest: filtered.length > 0 ? totalCost / filtered.length : 0,
      estimatedSavings,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): number {
    if (this.budgetLimit === 0) return Infinity;
    const report = this.getReport();
    return Math.max(0, this.budgetLimit - report.totalCost);
  }

  /**
   * Check if budget allows more requests
   */
  hasBudget(): boolean {
    if (this.budgetLimit === 0) return true;
    return this.getRemainingBudget() > 0;
  }

  /**
   * Reset all entries
   */
  reset(): void {
    this.entries = [];
    this.budgetWarningFired = false;
  }

  /**
   * Get all entries
   */
  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  // =========================================================================
  // Private
  // =========================================================================

  private checkBudget(): void {
    if (this.budgetLimit === 0) return;

    const report = this.getReport();
    const percentage = report.totalCost / this.budgetLimit;

    // Warning threshold
    if (
      !this.budgetWarningFired &&
      percentage >= this.budgetWarningThreshold &&
      this.onBudgetWarning
    ) {
      this.budgetWarningFired = true;
      this.onBudgetWarning(report, percentage);
    }

    // Budget exceeded
    if (percentage >= 1 && this.onBudgetExceeded) {
      this.onBudgetExceeded(report);
    }
  }
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a CostTracker instance
 */
export function createCostTracker(config?: CostTrackerConfig): CostTracker {
  return new CostTracker(config);
}
