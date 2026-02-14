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
      filtered = filtered.filter((r) => r.timestamp >= options.since!);
    }
    if (options.until) {
      filtered = filtered.filter((r) => r.timestamp <= options.until!);
    }

    const totalInput = filtered.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutput = filtered.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalCost = filtered.reduce((sum, r) => sum + r.cost, 0);
    const totalDuration = filtered.reduce((sum, r) => sum + r.durationMs, 0);
    const successCount = filtered.filter((r) => r.success).length;

    const byAgent: Record<string, AgentUsage> = {};
    const byModel: Record<string, ModelUsage> = {};
    const byProvider: Record<string, ProviderUsageInternal> = {};

    for (const r of filtered) {
      // By agent
      if (!byAgent[r.agentId]) {
        byAgent[r.agentId] = { requests: 0, tokens: 0, cost: 0, averageDurationMs: 0 };
      }
      const a = byAgent[r.agentId];
      a.requests++;
      a.tokens += r.inputTokens + r.outputTokens;
      a.cost += r.cost;
      a.averageDurationMs += r.durationMs;

      // By model
      if (!byModel[r.modelId]) {
        byModel[r.modelId] = { requests: 0, tokens: 0, cost: 0 };
      }
      const m = byModel[r.modelId];
      m.requests++;
      m.tokens += r.inputTokens + r.outputTokens;
      m.cost += r.cost;

      // By provider
      if (!byProvider[r.provider]) {
        byProvider[r.provider] = { requests: 0, tokens: 0, cost: 0, errorRate: 0, errors: 0 };
      }
      const p = byProvider[r.provider];
      p.requests++;
      p.tokens += r.inputTokens + r.outputTokens;
      p.cost += r.cost;
      if (!r.success) p.errors++;
    }

    // Calculate agent average durations
    for (const a of Object.values(byAgent)) {
      a.averageDurationMs = a.requests > 0 ? Math.round(a.averageDurationMs / a.requests) : 0;
    }

    // Calculate provider error rates and strip internal fields
    const byProviderClean: Record<string, ProviderUsage> = {};
    for (const [key, p] of Object.entries(byProvider)) {
      byProviderClean[key] = {
        requests: p.requests,
        tokens: p.tokens,
        cost: p.cost,
        errorRate: p.requests > 0 ? p.errors / p.requests : 0,
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
