/**
 * Cost Analytics Tests
 */

import {
  CostAnalytics,
  createCostAnalytics,
} from '../../../../src/shared/telemetry/cost-analytics';

describe('CostAnalytics', () => {
  let analytics: CostAnalytics;

  beforeEach(() => {
    analytics = new CostAnalytics();
  });

  describe('recordLLMCall', () => {
    it('should record a call and update call count', () => {
      analytics.recordLLMCall('gpt-4', 'openai', 500, 200, 0.05);

      expect(analytics.getCallCount()).toBe(1);
      expect(analytics.getTotalCost()).toBeCloseTo(0.05);
    });

    it('should accumulate multiple calls', () => {
      analytics.recordLLMCall('gpt-4', 'openai', 500, 200, 0.05);
      analytics.recordLLMCall('claude-3', 'anthropic', 300, 100, 0.03);
      analytics.recordLLMCall('gpt-4', 'openai', 1000, 500, 0.10);

      expect(analytics.getCallCount()).toBe(3);
      expect(analytics.getTotalCost()).toBeCloseTo(0.18);
    });
  });

  describe('getTotalCost', () => {
    it('should return 0 when no calls recorded', () => {
      expect(analytics.getTotalCost()).toBe(0);
    });

    it('should sum all call costs', () => {
      analytics.recordLLMCall('model-a', 'provider-a', 100, 50, 0.01);
      analytics.recordLLMCall('model-b', 'provider-b', 200, 100, 0.02);

      expect(analytics.getTotalCost()).toBeCloseTo(0.03);
    });
  });

  describe('getCostByModel', () => {
    it('should aggregate cost per model', () => {
      analytics.recordLLMCall('gpt-4', 'openai', 500, 200, 0.05);
      analytics.recordLLMCall('claude-3', 'anthropic', 300, 100, 0.03);
      analytics.recordLLMCall('gpt-4', 'openai', 1000, 500, 0.10);

      const byModel = analytics.getCostByModel();

      expect(byModel.get('gpt-4')).toBeCloseTo(0.15);
      expect(byModel.get('claude-3')).toBeCloseTo(0.03);
      expect(byModel.size).toBe(2);
    });

    it('should return empty map when no calls recorded', () => {
      expect(analytics.getCostByModel().size).toBe(0);
    });
  });

  describe('getCostByProvider', () => {
    it('should aggregate cost per provider', () => {
      analytics.recordLLMCall('gpt-4', 'openai', 500, 200, 0.05);
      analytics.recordLLMCall('gpt-3.5', 'openai', 300, 100, 0.01);
      analytics.recordLLMCall('claude-3', 'anthropic', 400, 150, 0.04);

      const byProvider = analytics.getCostByProvider();

      expect(byProvider.get('openai')).toBeCloseTo(0.06);
      expect(byProvider.get('anthropic')).toBeCloseTo(0.04);
      expect(byProvider.size).toBe(2);
    });
  });

  describe('getSummary', () => {
    it('should produce a complete cost summary', () => {
      analytics.recordLLMCall('gpt-4', 'openai', 500, 200, 0.05);
      analytics.recordLLMCall('claude-3', 'anthropic', 300, 100, 0.03);
      analytics.recordLLMCall('gpt-4', 'openai', 1000, 500, 0.10);

      const summary = analytics.getSummary();

      expect(summary.totalCost).toBeCloseTo(0.18);
      expect(summary.totalCalls).toBe(3);
      expect(summary.totalInputTokens).toBe(1800);
      expect(summary.totalOutputTokens).toBe(800);

      expect(summary.byModel['gpt-4'].cost).toBeCloseTo(0.15);
      expect(summary.byModel['gpt-4'].calls).toBe(2);
      expect(summary.byModel['claude-3'].cost).toBeCloseTo(0.03);
      expect(summary.byModel['claude-3'].calls).toBe(1);

      expect(summary.byProvider['openai'].cost).toBeCloseTo(0.15);
      expect(summary.byProvider['openai'].calls).toBe(2);
      expect(summary.byProvider['anthropic'].cost).toBeCloseTo(0.03);
      expect(summary.byProvider['anthropic'].calls).toBe(1);
    });

    it('should produce an empty summary when no calls recorded', () => {
      const summary = analytics.getSummary();

      expect(summary.totalCost).toBe(0);
      expect(summary.totalCalls).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(Object.keys(summary.byModel)).toHaveLength(0);
      expect(Object.keys(summary.byProvider)).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('should clear all recorded data', () => {
      analytics.recordLLMCall('gpt-4', 'openai', 500, 200, 0.05);
      analytics.recordLLMCall('claude-3', 'anthropic', 300, 100, 0.03);

      expect(analytics.getCallCount()).toBe(2);

      analytics.reset();

      expect(analytics.getCallCount()).toBe(0);
      expect(analytics.getTotalCost()).toBe(0);
      expect(analytics.getCostByModel().size).toBe(0);
      expect(analytics.getCostByProvider().size).toBe(0);
      expect(analytics.getSummary().totalCalls).toBe(0);
    });
  });

  describe('createCostAnalytics factory', () => {
    it('should return a functional CostAnalytics instance', () => {
      const ca = createCostAnalytics();
      expect(ca).toBeInstanceOf(CostAnalytics);

      ca.recordLLMCall('test', 'test-provider', 10, 5, 0.001);
      expect(ca.getCallCount()).toBe(1);
    });
  });
});
