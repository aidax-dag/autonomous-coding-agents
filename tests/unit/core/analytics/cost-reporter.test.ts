/**
 * Cost Reporter Tests
 *
 * Tests for the CostReporter class covering report generation,
 * cost breakdowns, top consumers, daily aggregation, and recommendations.
 */

import { CostReporter } from '../../../../src/core/analytics/cost-reporter';
import { UsageTracker, UsageRecord } from '../../../../src/core/analytics/usage-tracker';

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    timestamp: '2025-01-15T10:00:00.000Z',
    agentId: 'agent-1',
    modelId: 'gpt-4o',
    provider: 'openai',
    inputTokens: 100,
    outputTokens: 50,
    cost: 0.005,
    durationMs: 200,
    success: true,
    ...overrides,
  };
}

describe('CostReporter', () => {
  let tracker: UsageTracker;
  let reporter: CostReporter;

  beforeEach(() => {
    tracker = new UsageTracker();
    reporter = new CostReporter(tracker);
  });

  describe('generateReport', () => {
    it('should generate a report for empty tracker', () => {
      const report = reporter.generateReport();

      expect(report.totalCost).toBe(0);
      expect(report.costBreakdown.byProvider).toEqual({});
      expect(report.costBreakdown.byModel).toEqual({});
      expect(report.costBreakdown.byAgent).toEqual({});
      expect(report.topConsumers).toEqual([]);
      expect(report.dailyCosts).toEqual([]);
      expect(report.generatedAt).toBeDefined();
      expect(report.period).toBeDefined();
    });

    it('should include generatedAt timestamp', () => {
      const before = new Date().toISOString();
      const report = reporter.generateReport();
      const after = new Date().toISOString();

      expect(report.generatedAt >= before).toBe(true);
      expect(report.generatedAt <= after).toBe(true);
    });

    it('should calculate correct total cost', () => {
      tracker.record(makeRecord({ cost: 0.01 }));
      tracker.record(makeRecord({ cost: 0.02 }));
      tracker.record(makeRecord({ cost: 0.03 }));

      const report = reporter.generateReport();
      expect(report.totalCost).toBeCloseTo(0.06);
    });
  });

  describe('cost breakdown', () => {
    beforeEach(() => {
      tracker.record(makeRecord({ provider: 'openai', modelId: 'gpt-4o', agentId: 'agent-a', cost: 0.01 }));
      tracker.record(makeRecord({ provider: 'openai', modelId: 'gpt-4o', agentId: 'agent-a', cost: 0.02 }));
      tracker.record(makeRecord({ provider: 'anthropic', modelId: 'claude-3-opus', agentId: 'agent-b', cost: 0.03 }));
    });

    it('should break down costs by provider', () => {
      const report = reporter.generateReport();

      expect(report.costBreakdown.byProvider['openai']).toBeCloseTo(0.03);
      expect(report.costBreakdown.byProvider['anthropic']).toBeCloseTo(0.03);
    });

    it('should break down costs by model', () => {
      const report = reporter.generateReport();

      expect(report.costBreakdown.byModel['gpt-4o']).toBeCloseTo(0.03);
      expect(report.costBreakdown.byModel['claude-3-opus']).toBeCloseTo(0.03);
    });

    it('should break down costs by agent', () => {
      const report = reporter.generateReport();

      expect(report.costBreakdown.byAgent['agent-a']).toBeCloseTo(0.03);
      expect(report.costBreakdown.byAgent['agent-b']).toBeCloseTo(0.03);
    });
  });

  describe('top consumers', () => {
    it('should rank consumers by cost descending', () => {
      tracker.record(makeRecord({ agentId: 'cheap-agent', modelId: 'small-model', cost: 0.001 }));
      tracker.record(makeRecord({ agentId: 'expensive-agent', modelId: 'big-model', cost: 0.1 }));

      const report = reporter.generateReport();

      expect(report.topConsumers.length).toBeGreaterThan(0);
      expect(report.topConsumers[0].cost).toBeGreaterThanOrEqual(report.topConsumers[1].cost);
    });

    it('should include percentage for each consumer', () => {
      tracker.record(makeRecord({ agentId: 'agent-a', modelId: 'model-a', cost: 0.25 }));
      tracker.record(makeRecord({ agentId: 'agent-b', modelId: 'model-b', cost: 0.75 }));

      const report = reporter.generateReport();
      const agentConsumers = report.topConsumers.filter(c => c.type === 'agent');
      const agentB = agentConsumers.find(c => c.name === 'agent-b');

      expect(agentB).toBeDefined();
      expect(agentB!.percentage).toBeCloseTo(0.75);
    });

    it('should limit to top 10 consumers', () => {
      // Create many agents and models to exceed 10
      for (let i = 0; i < 8; i++) {
        tracker.record(makeRecord({ agentId: `agent-${i}`, modelId: `model-${i}`, cost: 0.01 * (i + 1) }));
      }

      const report = reporter.generateReport();
      expect(report.topConsumers.length).toBeLessThanOrEqual(10);
    });

    it('should handle zero total cost gracefully', () => {
      tracker.record(makeRecord({ cost: 0 }));

      const report = reporter.generateReport();
      for (const consumer of report.topConsumers) {
        expect(consumer.percentage).toBe(0);
      }
    });
  });

  describe('daily costs', () => {
    it('should aggregate costs by date', () => {
      tracker.record(makeRecord({ timestamp: '2025-01-15T08:00:00.000Z', cost: 0.01 }));
      tracker.record(makeRecord({ timestamp: '2025-01-15T14:00:00.000Z', cost: 0.02 }));
      tracker.record(makeRecord({ timestamp: '2025-01-16T10:00:00.000Z', cost: 0.03 }));

      const report = reporter.generateReport();

      expect(report.dailyCosts).toHaveLength(2);
      const day1 = report.dailyCosts.find(d => d.date === '2025-01-15');
      const day2 = report.dailyCosts.find(d => d.date === '2025-01-16');

      expect(day1).toBeDefined();
      expect(day1!.cost).toBeCloseTo(0.03);
      expect(day1!.requests).toBe(2);
      expect(day2).toBeDefined();
      expect(day2!.cost).toBeCloseTo(0.03);
      expect(day2!.requests).toBe(1);
    });

    it('should sort daily costs by date ascending', () => {
      tracker.record(makeRecord({ timestamp: '2025-01-20T10:00:00.000Z', cost: 0.01 }));
      tracker.record(makeRecord({ timestamp: '2025-01-10T10:00:00.000Z', cost: 0.02 }));
      tracker.record(makeRecord({ timestamp: '2025-01-15T10:00:00.000Z', cost: 0.03 }));

      const report = reporter.generateReport();

      expect(report.dailyCosts[0].date).toBe('2025-01-10');
      expect(report.dailyCosts[1].date).toBe('2025-01-15');
      expect(report.dailyCosts[2].date).toBe('2025-01-20');
    });
  });

  describe('recommendations', () => {
    it('should recommend reviewing failing requests when error rate is high', () => {
      tracker.record(makeRecord({ success: true }));
      tracker.record(makeRecord({ success: false }));
      tracker.record(makeRecord({ success: false }));

      const report = reporter.generateReport();

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('error rate'))).toBe(true);
    });

    it('should not recommend error review when success rate is high', () => {
      for (let i = 0; i < 10; i++) {
        tracker.record(makeRecord({ success: true }));
      }

      const report = reporter.generateReport();
      expect(report.recommendations.every(r => !r.includes('error rate'))).toBe(true);
    });

    it('should flag expensive models consuming over 50% of cost', () => {
      tracker.record(makeRecord({ modelId: 'expensive-model', cost: 0.80 }));
      tracker.record(makeRecord({ modelId: 'cheap-model', cost: 0.10 }));
      tracker.record(makeRecord({ modelId: 'other-model', cost: 0.10 }));

      const report = reporter.generateReport();

      expect(report.recommendations.some(r => r.includes("'expensive-model'") && r.includes('cheaper alternatives'))).toBe(true);
    });

    it('should flag zero cost with positive requests', () => {
      tracker.record(makeRecord({ cost: 0 }));
      tracker.record(makeRecord({ cost: 0 }));

      const report = reporter.generateReport();

      expect(report.recommendations.some(r => r.includes('No cost data recorded'))).toBe(true);
    });

    it('should return no recommendations for healthy usage', () => {
      // All success, balanced cost distribution
      tracker.record(makeRecord({ modelId: 'model-a', cost: 0.05, success: true }));
      tracker.record(makeRecord({ modelId: 'model-b', cost: 0.05, success: true }));

      const report = reporter.generateReport();
      expect(report.recommendations).toHaveLength(0);
    });
  });

  describe('time range filtering', () => {
    it('should pass time range options through to usage tracker', () => {
      tracker.record(makeRecord({ timestamp: '2025-01-10T10:00:00.000Z', cost: 0.01 }));
      tracker.record(makeRecord({ timestamp: '2025-01-15T10:00:00.000Z', cost: 0.02 }));
      tracker.record(makeRecord({ timestamp: '2025-01-20T10:00:00.000Z', cost: 0.03 }));

      const report = reporter.generateReport({
        since: '2025-01-14T00:00:00.000Z',
        until: '2025-01-16T00:00:00.000Z',
      });

      expect(report.totalCost).toBe(0.02);
    });
  });
});
