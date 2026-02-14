/**
 * Cost Reporter
 *
 * Generates cost reports from usage data, including breakdowns
 * by provider, model, and agent, daily cost trends, top consumers,
 * and actionable recommendations.
 *
 * @module core/analytics/cost-reporter
 */

import { createAgentLogger } from '../../shared/logging/logger';
import type { UsageRecord, UsageSummary } from './usage-tracker';

const logger = createAgentLogger('Analytics', 'cost-reporter');

/**
 * Complete cost report for a time period.
 */
export interface CostReport {
  generatedAt: string;
  period: { start: string; end: string };
  totalCost: number;
  costBreakdown: CostBreakdown;
  topConsumers: TopConsumer[];
  dailyCosts: DailyCost[];
  recommendations: string[];
}

/**
 * Cost amounts broken down by dimension.
 */
export interface CostBreakdown {
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  byAgent: Record<string, number>;
}

/**
 * A top cost consumer entry.
 */
export interface TopConsumer {
  type: 'agent' | 'model' | 'provider';
  name: string;
  cost: number;
  percentage: number;
}

/**
 * Daily cost and request count.
 */
export interface DailyCost {
  date: string;
  cost: number;
  requests: number;
}

/**
 * Interface for the usage data source required by CostReporter.
 */
export interface UsageDataSource {
  getSummary(options?: { since?: string; until?: string }): UsageSummary;
  getRecords(): UsageRecord[];
}

/**
 * Cost Reporter
 *
 * Aggregates usage data into structured cost reports with
 * breakdowns, trend data, and optimization recommendations.
 */
export class CostReporter {
  constructor(private readonly usageTracker: UsageDataSource) {}

  /**
   * Generate a cost report for the given time range.
   */
  generateReport(options: { since?: string; until?: string } = {}): CostReport {
    const summary = this.usageTracker.getSummary(options);
    const records = this.usageTracker.getRecords();

    const costBreakdown = this.buildCostBreakdown(summary);
    const topConsumers = this.buildTopConsumers(costBreakdown, summary.totalCost);
    const dailyCosts = this.buildDailyCosts(records);
    const recommendations = this.buildRecommendations(summary);

    logger.info(
      `Generated cost report: $${summary.totalCost.toFixed(4)} total, ${summary.totalRequests} requests`,
    );

    return {
      generatedAt: new Date().toISOString(),
      period: summary.period,
      totalCost: summary.totalCost,
      costBreakdown,
      topConsumers,
      dailyCosts,
      recommendations,
    };
  }

  private buildCostBreakdown(summary: UsageSummary): CostBreakdown {
    const costBreakdown: CostBreakdown = {
      byProvider: {},
      byModel: {},
      byAgent: {},
    };

    for (const [k, v] of Object.entries(summary.byProvider)) {
      costBreakdown.byProvider[k] = v.cost;
    }
    for (const [k, v] of Object.entries(summary.byModel)) {
      costBreakdown.byModel[k] = v.cost;
    }
    for (const [k, v] of Object.entries(summary.byAgent)) {
      costBreakdown.byAgent[k] = v.cost;
    }

    return costBreakdown;
  }

  private buildTopConsumers(costBreakdown: CostBreakdown, totalCost: number): TopConsumer[] {
    const allConsumers: TopConsumer[] = [];

    for (const [name, cost] of Object.entries(costBreakdown.byAgent)) {
      allConsumers.push({
        type: 'agent',
        name,
        cost,
        percentage: totalCost > 0 ? cost / totalCost : 0,
      });
    }
    for (const [name, cost] of Object.entries(costBreakdown.byModel)) {
      allConsumers.push({
        type: 'model',
        name,
        cost,
        percentage: totalCost > 0 ? cost / totalCost : 0,
      });
    }

    return allConsumers.sort((a, b) => b.cost - a.cost).slice(0, 10);
  }

  private buildDailyCosts(records: UsageRecord[]): DailyCost[] {
    const dailyMap = new Map<string, { cost: number; requests: number }>();

    for (const r of records) {
      const date = r.timestamp.slice(0, 10);
      if (!dailyMap.has(date)) {
        dailyMap.set(date, { cost: 0, requests: 0 });
      }
      const d = dailyMap.get(date)!;
      d.cost += r.cost;
      d.requests++;
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private buildRecommendations(summary: UsageSummary): string[] {
    const recommendations: string[] = [];

    if (summary.totalRequests > 0 && summary.successRate < 0.9) {
      const errorPct = ((1 - summary.successRate) * 100).toFixed(1);
      recommendations.push(`High error rate (${errorPct}%). Review failing requests.`);
    }

    for (const [model, usage] of Object.entries(summary.byModel)) {
      if (summary.totalCost > 0 && usage.cost > summary.totalCost * 0.5) {
        const costPct = Math.round((usage.cost / summary.totalCost) * 100);
        recommendations.push(
          `Model '${model}' accounts for ${costPct}% of costs. Consider using cheaper alternatives for simple tasks.`,
        );
      }
    }

    if (summary.totalCost === 0 && summary.totalRequests > 0) {
      recommendations.push('No cost data recorded. Ensure cost tracking is enabled.');
    }

    return recommendations;
  }
}

/**
 * Factory: create a CostReporter instance.
 */
export function createCostReporter(usageTracker: UsageDataSource): CostReporter {
  return new CostReporter(usageTracker);
}
