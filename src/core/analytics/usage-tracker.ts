/**
 * Usage Tracker
 *
 * Tracks usage patterns across agents, skills, and models.
 * Provides aggregated summaries with breakdowns by agent, model,
 * and provider for analytics and cost monitoring.
 *
 * @module core/analytics/usage-tracker
 */

import { createAgentLogger } from '../../shared/logging/logger';

const logger = createAgentLogger('Analytics', 'usage-tracker');

/**
 * Individual usage record for a single LLM request.
 */
export interface UsageRecord {
  timestamp: string;
  agentId: string;
  skillId?: string;
  modelId: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
  success: boolean;
}

/**
 * Aggregated usage summary for a time period.
 */
export interface UsageSummary {
  period: { start: string; end: string };
  totalRequests: number;
  totalTokens: { input: number; output: number };
  totalCost: number;
  averageDurationMs: number;
  successRate: number;
  byAgent: Record<string, AgentUsage>;
  byModel: Record<string, ModelUsage>;
  byProvider: Record<string, ProviderUsage>;
}

/**
 * Usage metrics aggregated by agent.
 */
export interface AgentUsage {
  requests: number;
  tokens: number;
  cost: number;
  averageDurationMs: number;
}

/**
 * Usage metrics aggregated by model.
 */
export interface ModelUsage {
  requests: number;
  tokens: number;
  cost: number;
}

/**
 * Usage metrics aggregated by provider.
 */
export interface ProviderUsage {
  requests: number;
  tokens: number;
  cost: number;
  errorRate: number;
}

/** Internal type with mutable error count for provider aggregation */
interface ProviderUsageInternal extends ProviderUsage {
  errors: number;
}

/**
 * Usage Tracker
 *
 * Records LLM usage entries and provides aggregated summaries
 * with breakdowns by agent, model, and provider. Enforces a
 * configurable maximum record limit via oldest-first eviction.
 */
export class UsageTracker {
  private records: UsageRecord[] = [];
  private readonly maxRecords: number;

  constructor(options: { maxRecords?: number } = {}) {
    this.maxRecords = options.maxRecords ?? 10000;
    logger.info(`Usage tracker initialized (maxRecords=${this.maxRecords})`);
  }

  /**
   * Record a usage entry. Evicts oldest records when the limit is exceeded.
   */
  record(entry: UsageRecord): void {
    this.records.push(entry);
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * Get an aggregated usage summary, optionally filtered by time range.
   */
  getSummary(options: { since?: string; until?: string } = {}): UsageSummary {
    let filtered = this.records;

    if (options.since) {
      filtered = filtered.filter((record) => record.timestamp >= options.since!);
    }
    if (options.until) {
      filtered = filtered.filter((record) => record.timestamp <= options.until!);
    }

    const totalInput = filtered.reduce((sum, record) => sum + record.inputTokens, 0);
    const totalOutput = filtered.reduce((sum, record) => sum + record.outputTokens, 0);
    const totalCost = filtered.reduce((sum, record) => sum + record.cost, 0);
    const totalDuration = filtered.reduce((sum, record) => sum + record.durationMs, 0);
    const successCount = filtered.filter((record) => record.success).length;

    const byAgent: Record<string, AgentUsage> = {};
    const byModel: Record<string, ModelUsage> = {};
    const byProvider: Record<string, ProviderUsageInternal> = {};

    for (const record of filtered) {
      // By agent
      if (!byAgent[record.agentId]) {
        byAgent[record.agentId] = { requests: 0, tokens: 0, cost: 0, averageDurationMs: 0 };
      }
      const agentUsage = byAgent[record.agentId];
      agentUsage.requests++;
      agentUsage.tokens += record.inputTokens + record.outputTokens;
      agentUsage.cost += record.cost;
      agentUsage.averageDurationMs += record.durationMs;

      // By model
      if (!byModel[record.modelId]) {
        byModel[record.modelId] = { requests: 0, tokens: 0, cost: 0 };
      }
      const modelUsage = byModel[record.modelId];
      modelUsage.requests++;
      modelUsage.tokens += record.inputTokens + record.outputTokens;
      modelUsage.cost += record.cost;

      // By provider
      if (!byProvider[record.provider]) {
        byProvider[record.provider] = { requests: 0, tokens: 0, cost: 0, errorRate: 0, errors: 0 };
      }
      const providerUsage = byProvider[record.provider];
      providerUsage.requests++;
      providerUsage.tokens += record.inputTokens + record.outputTokens;
      providerUsage.cost += record.cost;
      if (!record.success) providerUsage.errors++;
    }

    // Calculate agent average durations
    for (const agentUsage of Object.values(byAgent)) {
      agentUsage.averageDurationMs =
        agentUsage.requests > 0
          ? Math.round(agentUsage.averageDurationMs / agentUsage.requests)
          : 0;
    }

    // Calculate provider error rates and strip internal fields
    const byProviderClean: Record<string, ProviderUsage> = {};
    for (const [key, providerUsage] of Object.entries(byProvider)) {
      byProviderClean[key] = {
        requests: providerUsage.requests,
        tokens: providerUsage.tokens,
        cost: providerUsage.cost,
        errorRate:
          providerUsage.requests > 0
            ? providerUsage.errors / providerUsage.requests
            : 0,
      };
    }

    return {
      period: {
        start: filtered.length > 0 ? filtered[0].timestamp : new Date().toISOString(),
        end:
          filtered.length > 0 ? filtered[filtered.length - 1].timestamp : new Date().toISOString(),
      },
      totalRequests: filtered.length,
      totalTokens: { input: totalInput, output: totalOutput },
      totalCost,
      averageDurationMs: filtered.length > 0 ? Math.round(totalDuration / filtered.length) : 0,
      successRate: filtered.length > 0 ? successCount / filtered.length : 0,
      byAgent,
      byModel,
      byProvider: byProviderClean,
    };
  }

  /**
   * Get a shallow copy of all recorded usage entries.
   */
  getRecords(): UsageRecord[] {
    return [...this.records];
  }

  /**
   * Get the number of stored records.
   */
  getRecordCount(): number {
    return this.records.length;
  }

  /**
   * Remove all stored records.
   */
  clear(): void {
    this.records = [];
  }
}

/**
 * Factory: create a UsageTracker instance.
 */
export function createUsageTracker(options?: { maxRecords?: number }): UsageTracker {
  return new UsageTracker(options);
}
