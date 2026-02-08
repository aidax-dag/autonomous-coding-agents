/**
 * CostTracker Unit Tests
 */

import {
  CostTracker,
  createCostTracker,
  ModelTier,
  DEFAULT_TIER_COSTS,
} from '../../../../src/shared/llm/index.js';
import type { LLMCompletionResult } from '../../../../src/shared/llm/base-client.js';

function makeResult(tokens: { prompt: number; completion: number }): LLMCompletionResult {
  return {
    content: 'test',
    model: 'test-model',
    usage: {
      promptTokens: tokens.prompt,
      completionTokens: tokens.completion,
      totalTokens: tokens.prompt + tokens.completion,
    },
    finishReason: 'stop',
  };
}

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = createCostTracker();
  });

  describe('record', () => {
    it('should record a cost entry', () => {
      const result = makeResult({ prompt: 500, completion: 200 });
      const entry = tracker.record(result, ModelTier.FAST, 'claude');

      expect(entry.model).toBe('test-model');
      expect(entry.tier).toBe(ModelTier.FAST);
      expect(entry.provider).toBe('claude');
      expect(entry.inputTokens).toBe(500);
      expect(entry.outputTokens).toBe(200);
      expect(entry.cost).toBeCloseTo((700 / 1000) * DEFAULT_TIER_COSTS[ModelTier.FAST]);
    });

    it('should accumulate entries', () => {
      tracker.record(makeResult({ prompt: 100, completion: 50 }), ModelTier.FAST, 'claude');
      tracker.record(makeResult({ prompt: 200, completion: 100 }), ModelTier.BALANCED, 'claude');
      tracker.record(makeResult({ prompt: 500, completion: 300 }), ModelTier.POWERFUL, 'openai');

      expect(tracker.getEntries().length).toBe(3);
    });
  });

  describe('getReport', () => {
    it('should compute correct totals', () => {
      tracker.record(makeResult({ prompt: 1000, completion: 500 }), ModelTier.FAST, 'claude');
      tracker.record(makeResult({ prompt: 1000, completion: 500 }), ModelTier.POWERFUL, 'claude');

      const report = tracker.getReport();
      expect(report.requestCount).toBe(2);
      expect(report.totalInputTokens).toBe(2000);
      expect(report.totalOutputTokens).toBe(1000);
    });

    it('should break down costs by tier', () => {
      tracker.record(makeResult({ prompt: 1000, completion: 0 }), ModelTier.FAST, 'claude');
      tracker.record(makeResult({ prompt: 1000, completion: 0 }), ModelTier.BALANCED, 'claude');

      const report = tracker.getReport();
      expect(report.costByTier[ModelTier.FAST]).toBeGreaterThan(0);
      expect(report.costByTier[ModelTier.BALANCED]).toBeGreaterThan(0);
      expect(report.costByTier[ModelTier.POWERFUL]).toBe(0);
    });

    it('should break down costs by provider', () => {
      tracker.record(makeResult({ prompt: 1000, completion: 0 }), ModelTier.FAST, 'claude');
      tracker.record(makeResult({ prompt: 1000, completion: 0 }), ModelTier.FAST, 'openai');

      const report = tracker.getReport();
      expect(report.costByProvider['claude']).toBeGreaterThan(0);
      expect(report.costByProvider['openai']).toBeGreaterThan(0);
    });

    it('should compute estimated savings', () => {
      // Mix of tiers should show savings vs all-powerful
      tracker.record(makeResult({ prompt: 5000, completion: 2000 }), ModelTier.FAST, 'claude');
      tracker.record(makeResult({ prompt: 3000, completion: 1000 }), ModelTier.BALANCED, 'claude');

      const report = tracker.getReport();
      expect(report.estimatedSavings).toBeGreaterThan(0);
    });

    it('should filter by time window', async () => {
      tracker.record(makeResult({ prompt: 100, completion: 50 }), ModelTier.FAST, 'claude');
      // Wait to ensure distinct timestamps
      await new Promise((resolve) => setTimeout(resolve, 50));
      const midpoint = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 50));
      tracker.record(makeResult({ prompt: 200, completion: 100 }), ModelTier.BALANCED, 'claude');

      const report = tracker.getReport(midpoint);
      expect(report.requestCount).toBe(1);
    });

    it('should handle empty entries', () => {
      const report = tracker.getReport();
      expect(report.totalCost).toBe(0);
      expect(report.requestCount).toBe(0);
      expect(report.avgCostPerRequest).toBe(0);
    });
  });

  describe('budget management', () => {
    it('should track remaining budget', () => {
      const budgeted = createCostTracker({ budgetLimit: 10 });
      expect(budgeted.getRemainingBudget()).toBe(10);

      budgeted.record(makeResult({ prompt: 1000, completion: 0 }), ModelTier.FAST, 'claude');
      expect(budgeted.getRemainingBudget()).toBeLessThan(10);
    });

    it('should report infinite budget when no limit', () => {
      expect(tracker.getRemainingBudget()).toBe(Infinity);
      expect(tracker.hasBudget()).toBe(true);
    });

    it('should fire budget warning callback', () => {
      const onWarning = jest.fn();
      const budgeted = createCostTracker({
        budgetLimit: 1,
        budgetWarningThreshold: 0.5,
        onBudgetWarning: onWarning,
      });

      // Record enough to exceed 50% of budget
      budgeted.record(makeResult({ prompt: 5000, completion: 5000 }), ModelTier.BALANCED, 'claude');
      expect(onWarning).toHaveBeenCalled();
    });

    it('should fire budget exceeded callback', () => {
      const onExceeded = jest.fn();
      const budgeted = createCostTracker({
        budgetLimit: 0.01,
        onBudgetExceeded: onExceeded,
      });

      budgeted.record(makeResult({ prompt: 10000, completion: 5000 }), ModelTier.POWERFUL, 'claude');
      expect(onExceeded).toHaveBeenCalled();
    });

    it('should only fire warning once', () => {
      const onWarning = jest.fn();
      const budgeted = createCostTracker({
        budgetLimit: 1,
        budgetWarningThreshold: 0.1,
        onBudgetWarning: onWarning,
      });

      budgeted.record(makeResult({ prompt: 5000, completion: 0 }), ModelTier.BALANCED, 'claude');
      budgeted.record(makeResult({ prompt: 5000, completion: 0 }), ModelTier.BALANCED, 'claude');
      expect(onWarning).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('should clear all entries', () => {
      tracker.record(makeResult({ prompt: 100, completion: 50 }), ModelTier.FAST, 'claude');
      expect(tracker.getEntries().length).toBe(1);

      tracker.reset();
      expect(tracker.getEntries().length).toBe(0);
      expect(tracker.getReport().totalCost).toBe(0);
    });
  });
});
