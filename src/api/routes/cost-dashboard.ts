/**
 * Cost Dashboard API
 *
 * REST endpoints for cost tracking, budget management, and spend history.
 * Provides per-model and global budget controls with configurable warning thresholds.
 *
 * @module api/routes/cost-dashboard
 */

import type { IWebServer, WebRequest, WebResponse } from '@/ui/web/interfaces/web.interface';
import type { ICostTracker, CostRecord } from '@/shared/llm/interfaces/routing.interface';
import { logger } from '@/shared/logging/logger';

/** Budget configuration for a single scope (global or per-model) */
export interface BudgetConfig {
  /** Maximum spend in USD before hard stop */
  limit: number;
  /** Fraction of limit at which a warning is emitted (0-1, default 0.8) */
  warningThreshold: number;
}

/** Full budget state returned by the budget endpoint */
export interface BudgetStatus {
  global: BudgetConfig & { spent: number; remaining: number; utilization: number; warning: boolean; exceeded: boolean };
  perModel: Record<string, BudgetConfig & { spent: number; remaining: number; utilization: number; warning: boolean; exceeded: boolean }>;
}

/**
 * Manages budget limits and warning thresholds for global and per-model scopes.
 */
export class BudgetManager {
  private globalBudget: BudgetConfig | null = null;
  private modelBudgets: Map<string, BudgetConfig> = new Map();

  setGlobalBudget(limit: number, warningThreshold = 0.8): void {
    if (limit < 0) throw new Error('Budget limit must be non-negative');
    if (warningThreshold < 0 || warningThreshold > 1) throw new Error('Warning threshold must be between 0 and 1');
    this.globalBudget = { limit, warningThreshold };
  }

  setModelBudget(model: string, limit: number, warningThreshold = 0.8): void {
    if (limit < 0) throw new Error('Budget limit must be non-negative');
    if (warningThreshold < 0 || warningThreshold > 1) throw new Error('Warning threshold must be between 0 and 1');
    this.modelBudgets.set(model, { limit, warningThreshold });
  }

  getGlobalBudget(): BudgetConfig | null {
    return this.globalBudget ? { ...this.globalBudget } : null;
  }

  getModelBudget(model: string): BudgetConfig | null {
    const cfg = this.modelBudgets.get(model);
    return cfg ? { ...cfg } : null;
  }

  /**
   * Compute full budget status from a set of cost records.
   */
  getStatus(records: CostRecord[]): BudgetStatus {
    const totalSpent = records.reduce((sum, r) => sum + r.totalCost, 0);
    const spentByModel = new Map<string, number>();
    for (const r of records) {
      spentByModel.set(r.model, (spentByModel.get(r.model) ?? 0) + r.totalCost);
    }

    const globalLimit = this.globalBudget?.limit ?? Infinity;
    const globalThreshold = this.globalBudget?.warningThreshold ?? 0.8;
    const globalUtilization = globalLimit === Infinity ? 0 : totalSpent / globalLimit;

    const perModel: BudgetStatus['perModel'] = {};
    for (const [model, cfg] of this.modelBudgets) {
      const spent = spentByModel.get(model) ?? 0;
      const utilization = cfg.limit === 0 ? 0 : spent / cfg.limit;
      perModel[model] = {
        limit: cfg.limit,
        warningThreshold: cfg.warningThreshold,
        spent,
        remaining: Math.max(0, cfg.limit - spent),
        utilization,
        warning: utilization >= cfg.warningThreshold,
        exceeded: spent >= cfg.limit,
      };
    }

    return {
      global: {
        limit: globalLimit,
        warningThreshold: globalThreshold,
        spent: totalSpent,
        remaining: Math.max(0, globalLimit - totalSpent),
        utilization: globalUtilization,
        warning: globalUtilization >= globalThreshold,
        exceeded: totalSpent >= globalLimit,
      },
      perModel,
    };
  }
}

export interface CostDashboardAPIOptions {
  server: IWebServer;
  costTracker: ICostTracker;
  budgetManager?: BudgetManager;
}

/**
 * Registers cost dashboard REST routes on the provided web server.
 */
export class CostDashboardAPI {
  private readonly server: IWebServer;
  private readonly costTracker: ICostTracker;
  private readonly budgetManager: BudgetManager;

  constructor(options: CostDashboardAPIOptions) {
    this.server = options.server;
    this.costTracker = options.costTracker;
    this.budgetManager = options.budgetManager ?? new BudgetManager();
    this.registerRoutes();
  }

  private registerRoutes(): void {
    this.server.addRoute('GET', '/api/costs/summary', this.handleSummary.bind(this));
    this.server.addRoute('GET', '/api/costs/history', this.handleHistory.bind(this));
    this.server.addRoute('GET', '/api/costs/budget', this.handleGetBudget.bind(this));
    this.server.addRoute('POST', '/api/costs/budget', this.handleSetBudget.bind(this));
  }

  // ── GET /api/costs/summary ──────────────────────────────────────

  private async handleSummary(_req: WebRequest): Promise<WebResponse> {
    const records = this.costTracker.getRecords();
    const totalCost = this.costTracker.getTotalCost();
    const totalInputTokens = records.reduce((s, r) => s + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((s, r) => s + r.outputTokens, 0);

    const byModel: Record<string, { inputTokens: number; outputTokens: number; totalCost: number; requests: number }> = {};
    for (const r of records) {
      const entry = byModel[r.model] ?? { inputTokens: 0, outputTokens: 0, totalCost: 0, requests: 0 };
      entry.inputTokens += r.inputTokens;
      entry.outputTokens += r.outputTokens;
      entry.totalCost += r.totalCost;
      entry.requests += 1;
      byModel[r.model] = entry;
    }

    return {
      status: 200,
      body: {
        totalCost,
        totalInputTokens,
        totalOutputTokens,
        totalRequests: records.length,
        byModel,
      },
    };
  }

  // ── GET /api/costs/history ──────────────────────────────────────

  private async handleHistory(req: WebRequest): Promise<WebResponse> {
    const range = req.query.range ?? '24h';
    const now = Date.now();
    const rangeMs = this.parseRange(range);
    if (rangeMs === null) {
      return { status: 400, body: { error: `Invalid range: ${range}. Use 24h, 7d, or 30d.` } };
    }
    const cutoff = now - rangeMs;
    const records = this.costTracker.getRecords().filter(r => r.timestamp >= cutoff);

    const bucketCount = Math.min(records.length, 50);
    const bucketSize = bucketCount > 0 ? rangeMs / bucketCount : rangeMs;
    const buckets: Array<{ timestamp: number; cost: number; tokens: number }> = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketStart = cutoff + i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;
      const inBucket = records.filter(r => r.timestamp >= bucketStart && r.timestamp < bucketEnd);
      buckets.push({
        timestamp: Math.round(bucketStart),
        cost: inBucket.reduce((s, r) => s + r.totalCost, 0),
        tokens: inBucket.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
      });
    }

    return {
      status: 200,
      body: { range, recordCount: records.length, buckets },
    };
  }

  // ── GET /api/costs/budget ───────────────────────────────────────

  private async handleGetBudget(_req: WebRequest): Promise<WebResponse> {
    const records = this.costTracker.getRecords();
    const status = this.budgetManager.getStatus(records);
    return { status: 200, body: status };
  }

  // ── POST /api/costs/budget ──────────────────────────────────────

  private async handleSetBudget(req: WebRequest): Promise<WebResponse> {
    const body = req.body as {
      globalLimit?: number;
      warningThreshold?: number;
      modelBudgets?: Record<string, { limit: number; warningThreshold?: number }>;
    } | undefined;

    if (!body) {
      return { status: 400, body: { error: 'Request body is required' } };
    }

    try {
      if (body.globalLimit !== undefined) {
        this.budgetManager.setGlobalBudget(body.globalLimit, body.warningThreshold ?? 0.8);
        this.costTracker.setBudget(body.globalLimit);
        logger.info('Global budget set', { limit: body.globalLimit, warningThreshold: body.warningThreshold ?? 0.8 });
      }

      if (body.modelBudgets) {
        for (const [model, cfg] of Object.entries(body.modelBudgets)) {
          this.budgetManager.setModelBudget(model, cfg.limit, cfg.warningThreshold ?? 0.8);
          logger.info('Model budget set', { model, limit: cfg.limit, warningThreshold: cfg.warningThreshold ?? 0.8 });
        }
      }
    } catch (err) {
      return { status: 400, body: { error: err instanceof Error ? err.message : 'Invalid budget configuration' } };
    }

    const records = this.costTracker.getRecords();
    const status = this.budgetManager.getStatus(records);
    return { status: 200, body: status };
  }

  // ── Helpers ─────────────────────────────────────────────────────

  private parseRange(range: string): number | null {
    const ranges: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    return ranges[range] ?? null;
  }

  getBudgetManager(): BudgetManager {
    return this.budgetManager;
  }
}

export function createCostDashboardAPI(options: CostDashboardAPIOptions): CostDashboardAPI {
  return new CostDashboardAPI(options);
}
