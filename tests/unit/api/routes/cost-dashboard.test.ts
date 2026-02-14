/**
 * Cost Dashboard API Tests
 */

jest.mock('../../../../src/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { CostDashboardAPI, BudgetManager } from '../../../../src/api/routes/cost-dashboard';
import { CostTracker } from '../../../../src/shared/llm/cost-tracker';
import { WebServer } from '../../../../src/ui/web/web-server';
import type { WebRequest } from '../../../../src/ui/web/interfaces/web.interface';
import type { CostRecord } from '../../../../src/shared/llm/interfaces/routing.interface';

function makeRequest(method: 'GET' | 'POST', path: string, body?: unknown, query?: Record<string, string>): WebRequest {
  return {
    method,
    path,
    params: {},
    query: query ?? {},
    body,
    headers: {},
  };
}

function makeCostRecord(overrides: Partial<CostRecord> = {}): CostRecord {
  return {
    timestamp: Date.now(),
    model: 'gpt-4',
    provider: 'openai',
    inputTokens: 100,
    outputTokens: 50,
    totalCost: 0.01,
    ...overrides,
  };
}

describe('CostDashboardAPI', () => {
  let server: WebServer;
  let costTracker: CostTracker;
  let budgetManager: BudgetManager;

  beforeEach(() => {
    server = new WebServer();
    costTracker = new CostTracker();
    budgetManager = new BudgetManager();
    new CostDashboardAPI({ server, costTracker, budgetManager });
  });

  describe('GET /api/costs/summary', () => {
    it('should return zero totals when no records exist', async () => {
      const res = await server.handleRequest(makeRequest('GET', '/api/costs/summary'));

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.totalCost).toBe(0);
      expect(body.totalInputTokens).toBe(0);
      expect(body.totalOutputTokens).toBe(0);
      expect(body.totalRequests).toBe(0);
      expect(body.byModel).toEqual({});
    });

    it('should return correct aggregation across multiple records', async () => {
      costTracker.record(makeCostRecord({ model: 'gpt-4', inputTokens: 100, outputTokens: 50, totalCost: 0.01 }));
      costTracker.record(makeCostRecord({ model: 'gpt-4', inputTokens: 200, outputTokens: 100, totalCost: 0.02 }));
      costTracker.record(makeCostRecord({ model: 'claude-3', inputTokens: 300, outputTokens: 150, totalCost: 0.03 }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/summary'));

      expect(res.status).toBe(200);
      const body = res.body as Record<string, unknown>;
      expect(body.totalCost).toBeCloseTo(0.06, 5);
      expect(body.totalInputTokens).toBe(600);
      expect(body.totalOutputTokens).toBe(300);
      expect(body.totalRequests).toBe(3);

      const byModel = body.byModel as Record<string, { requests: number; totalCost: number }>;
      expect(byModel['gpt-4'].requests).toBe(2);
      expect(byModel['gpt-4'].totalCost).toBeCloseTo(0.03, 5);
      expect(byModel['claude-3'].requests).toBe(1);
      expect(byModel['claude-3'].totalCost).toBeCloseTo(0.03, 5);
    });
  });

  describe('GET /api/costs/history', () => {
    it('should return records within default 24h range', async () => {
      const now = Date.now();
      costTracker.record(makeCostRecord({ timestamp: now - 1000, totalCost: 0.01 }));
      costTracker.record(makeCostRecord({ timestamp: now - 2000, totalCost: 0.02 }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/history'));

      expect(res.status).toBe(200);
      const body = res.body as { range: string; recordCount: number; buckets: unknown[] };
      expect(body.range).toBe('24h');
      expect(body.recordCount).toBe(2);
    });

    it('should filter records by 7d range', async () => {
      const now = Date.now();
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;

      costTracker.record(makeCostRecord({ timestamp: twoDaysAgo }));
      costTracker.record(makeCostRecord({ timestamp: tenDaysAgo }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/history', undefined, { range: '7d' }));

      expect(res.status).toBe(200);
      const body = res.body as { range: string; recordCount: number };
      expect(body.range).toBe('7d');
      expect(body.recordCount).toBe(1);
    });

    it('should reject invalid range', async () => {
      const res = await server.handleRequest(makeRequest('GET', '/api/costs/history', undefined, { range: '1y' }));

      expect(res.status).toBe(400);
      const body = res.body as { error: string };
      expect(body.error).toContain('Invalid range');
    });

    it('should accept 30d range', async () => {
      const res = await server.handleRequest(makeRequest('GET', '/api/costs/history', undefined, { range: '30d' }));

      expect(res.status).toBe(200);
      const body = res.body as { range: string };
      expect(body.range).toBe('30d');
    });
  });

  describe('GET /api/costs/budget', () => {
    it('should return default budget status with no limits set', async () => {
      const res = await server.handleRequest(makeRequest('GET', '/api/costs/budget'));

      expect(res.status).toBe(200);
      const body = res.body as { global: { limit: number; exceeded: boolean } };
      expect(body.global.limit).toBe(Infinity);
      expect(body.global.exceeded).toBe(false);
    });

    it('should reflect budget utilization after spending', async () => {
      budgetManager.setGlobalBudget(1.0, 0.8);
      costTracker.record(makeCostRecord({ totalCost: 0.5 }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/budget'));

      expect(res.status).toBe(200);
      const body = res.body as { global: { spent: number; remaining: number; utilization: number; warning: boolean; exceeded: boolean } };
      expect(body.global.spent).toBeCloseTo(0.5, 5);
      expect(body.global.remaining).toBeCloseTo(0.5, 5);
      expect(body.global.utilization).toBeCloseTo(0.5, 5);
      expect(body.global.warning).toBe(false);
      expect(body.global.exceeded).toBe(false);
    });

    it('should trigger warning at 80% threshold', async () => {
      budgetManager.setGlobalBudget(1.0, 0.8);
      costTracker.record(makeCostRecord({ totalCost: 0.85 }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/budget'));

      expect(res.status).toBe(200);
      const body = res.body as { global: { warning: boolean; exceeded: boolean } };
      expect(body.global.warning).toBe(true);
      expect(body.global.exceeded).toBe(false);
    });

    it('should mark exceeded when spend reaches limit', async () => {
      budgetManager.setGlobalBudget(1.0, 0.8);
      costTracker.record(makeCostRecord({ totalCost: 1.0 }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/budget'));

      expect(res.status).toBe(200);
      const body = res.body as { global: { warning: boolean; exceeded: boolean; remaining: number } };
      expect(body.global.warning).toBe(true);
      expect(body.global.exceeded).toBe(true);
      expect(body.global.remaining).toBe(0);
    });
  });

  describe('POST /api/costs/budget', () => {
    it('should set global budget and return updated status', async () => {
      const res = await server.handleRequest(
        makeRequest('POST', '/api/costs/budget', { globalLimit: 10.0, warningThreshold: 0.75 }),
      );

      expect(res.status).toBe(200);
      const body = res.body as { global: { limit: number; warningThreshold: number } };
      expect(body.global.limit).toBe(10.0);
      expect(body.global.warningThreshold).toBe(0.75);
    });

    it('should reject missing body', async () => {
      const res = await server.handleRequest(makeRequest('POST', '/api/costs/budget'));

      expect(res.status).toBe(400);
      const body = res.body as { error: string };
      expect(body.error).toContain('required');
    });

    it('should reject negative budget limit', async () => {
      const res = await server.handleRequest(
        makeRequest('POST', '/api/costs/budget', { globalLimit: -5 }),
      );

      expect(res.status).toBe(400);
      const body = res.body as { error: string };
      expect(body.error).toContain('non-negative');
    });

    it('should set per-model budgets', async () => {
      const res = await server.handleRequest(
        makeRequest('POST', '/api/costs/budget', {
          modelBudgets: {
            'gpt-4': { limit: 5.0, warningThreshold: 0.9 },
            'claude-3': { limit: 3.0 },
          },
        }),
      );

      expect(res.status).toBe(200);
      const body = res.body as { perModel: Record<string, { limit: number; warningThreshold: number }> };
      expect(body.perModel['gpt-4'].limit).toBe(5.0);
      expect(body.perModel['gpt-4'].warningThreshold).toBe(0.9);
      expect(body.perModel['claude-3'].limit).toBe(3.0);
      expect(body.perModel['claude-3'].warningThreshold).toBe(0.8);
    });
  });

  describe('per-model budget tracking', () => {
    it('should track spending per model and flag exceeded models', async () => {
      budgetManager.setModelBudget('gpt-4', 0.05, 0.8);
      budgetManager.setModelBudget('claude-3', 0.10, 0.8);

      costTracker.record(makeCostRecord({ model: 'gpt-4', totalCost: 0.06 }));
      costTracker.record(makeCostRecord({ model: 'claude-3', totalCost: 0.05 }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/budget'));

      expect(res.status).toBe(200);
      const body = res.body as { perModel: Record<string, { exceeded: boolean; warning: boolean; spent: number }> };
      expect(body.perModel['gpt-4'].exceeded).toBe(true);
      expect(body.perModel['gpt-4'].spent).toBeCloseTo(0.06, 5);
      expect(body.perModel['claude-3'].exceeded).toBe(false);
      expect(body.perModel['claude-3'].warning).toBe(false);
    });

    it('should flag model budget warning at threshold', async () => {
      budgetManager.setModelBudget('gpt-4', 1.0, 0.5);
      costTracker.record(makeCostRecord({ model: 'gpt-4', totalCost: 0.6 }));

      const res = await server.handleRequest(makeRequest('GET', '/api/costs/budget'));

      expect(res.status).toBe(200);
      const body = res.body as { perModel: Record<string, { warning: boolean; exceeded: boolean }> };
      expect(body.perModel['gpt-4'].warning).toBe(true);
      expect(body.perModel['gpt-4'].exceeded).toBe(false);
    });
  });
});

describe('BudgetManager', () => {
  let manager: BudgetManager;

  beforeEach(() => {
    manager = new BudgetManager();
  });

  it('should throw on negative budget limit', () => {
    expect(() => manager.setGlobalBudget(-1)).toThrow('non-negative');
  });

  it('should throw on invalid warning threshold', () => {
    expect(() => manager.setGlobalBudget(10, 1.5)).toThrow('between 0 and 1');
    expect(() => manager.setGlobalBudget(10, -0.1)).toThrow('between 0 and 1');
  });

  it('should return null when no budget is configured', () => {
    expect(manager.getGlobalBudget()).toBeNull();
    expect(manager.getModelBudget('gpt-4')).toBeNull();
  });

  it('should return configured budgets', () => {
    manager.setGlobalBudget(100, 0.9);
    manager.setModelBudget('gpt-4', 50, 0.7);

    const global = manager.getGlobalBudget();
    expect(global).toEqual({ limit: 100, warningThreshold: 0.9 });

    const model = manager.getModelBudget('gpt-4');
    expect(model).toEqual({ limit: 50, warningThreshold: 0.7 });
  });

  it('should compute status with empty records', () => {
    manager.setGlobalBudget(10);
    const status = manager.getStatus([]);

    expect(status.global.spent).toBe(0);
    expect(status.global.remaining).toBe(10);
    expect(status.global.exceeded).toBe(false);
    expect(status.global.warning).toBe(false);
  });
});
