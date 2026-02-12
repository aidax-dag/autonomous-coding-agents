/**
 * Cost Analytics
 *
 * LLM-specific cost tracking and analysis. Aggregates spend by model
 * and provider, producing summary reports suitable for dashboards and
 * budget enforcement.
 *
 * @module shared/telemetry/cost-analytics
 */

import type { ICostAnalytics, CostSummary } from './interfaces/telemetry.interface';

interface LLMCallRecord {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
}

/**
 * In-memory LLM cost analytics.
 */
export class CostAnalytics implements ICostAnalytics {
  private records: LLMCallRecord[] = [];

  recordLLMCall(
    model: string,
    provider: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
  ): void {
    this.records.push({
      model,
      provider,
      inputTokens,
      outputTokens,
      cost,
      timestamp: Date.now(),
    });
  }

  getTotalCost(): number {
    return this.records.reduce((sum, r) => sum + r.cost, 0);
  }

  getCostByModel(): Map<string, number> {
    const result = new Map<string, number>();
    for (const r of this.records) {
      result.set(r.model, (result.get(r.model) ?? 0) + r.cost);
    }
    return result;
  }

  getCostByProvider(): Map<string, number> {
    const result = new Map<string, number>();
    for (const r of this.records) {
      result.set(r.provider, (result.get(r.provider) ?? 0) + r.cost);
    }
    return result;
  }

  getCallCount(): number {
    return this.records.length;
  }

  getSummary(): CostSummary {
    const byModel: Record<string, { cost: number; calls: number }> = {};
    const byProvider: Record<string, { cost: number; calls: number }> = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const r of this.records) {
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;

      if (!byModel[r.model]) {
        byModel[r.model] = { cost: 0, calls: 0 };
      }
      byModel[r.model].cost += r.cost;
      byModel[r.model].calls += 1;

      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { cost: 0, calls: 0 };
      }
      byProvider[r.provider].cost += r.cost;
      byProvider[r.provider].calls += 1;
    }

    return {
      totalCost: this.getTotalCost(),
      totalCalls: this.records.length,
      totalInputTokens,
      totalOutputTokens,
      byModel,
      byProvider,
    };
  }

  reset(): void {
    this.records = [];
  }
}

/**
 * Factory: create a CostAnalytics instance.
 */
export function createCostAnalytics(): CostAnalytics {
  return new CostAnalytics();
}
