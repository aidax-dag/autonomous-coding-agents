/**
 * Usage Tracker Tests
 *
 * Tests for the UsageTracker class covering recording,
 * aggregation, filtering, eviction, and edge cases.
 */

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

describe('UsageTracker', () => {
  let tracker: UsageTracker;

  beforeEach(() => {
    tracker = new UsageTracker();
  });

  describe('record', () => {
    it('should record a usage entry', () => {
      const record = makeRecord();
      tracker.record(record);

      expect(tracker.getRecordCount()).toBe(1);
      expect(tracker.getRecords()).toHaveLength(1);
      expect(tracker.getRecords()[0]).toEqual(record);
    });

    it('should record multiple entries', () => {
      tracker.record(makeRecord({ agentId: 'agent-1' }));
      tracker.record(makeRecord({ agentId: 'agent-2' }));
      tracker.record(makeRecord({ agentId: 'agent-3' }));

      expect(tracker.getRecordCount()).toBe(3);
    });
  });

  describe('max records eviction', () => {
    it('should evict oldest records when exceeding maxRecords', () => {
      const smallTracker = new UsageTracker({ maxRecords: 3 });

      smallTracker.record(makeRecord({ agentId: 'first' }));
      smallTracker.record(makeRecord({ agentId: 'second' }));
      smallTracker.record(makeRecord({ agentId: 'third' }));
      smallTracker.record(makeRecord({ agentId: 'fourth' }));

      expect(smallTracker.getRecordCount()).toBe(3);
      const records = smallTracker.getRecords();
      expect(records[0].agentId).toBe('second');
      expect(records[1].agentId).toBe('third');
      expect(records[2].agentId).toBe('fourth');
    });

    it('should use default maxRecords of 10000', () => {
      const defaultTracker = new UsageTracker();
      // Just confirm it doesn't throw; we trust the default
      defaultTracker.record(makeRecord());
      expect(defaultTracker.getRecordCount()).toBe(1);
    });
  });

  describe('getRecords', () => {
    it('should return a shallow copy of records', () => {
      tracker.record(makeRecord());
      const records = tracker.getRecords();

      expect(records).toHaveLength(1);
      // Mutating returned array should not affect internal state
      records.pop();
      expect(tracker.getRecordCount()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all records', () => {
      tracker.record(makeRecord());
      tracker.record(makeRecord());
      expect(tracker.getRecordCount()).toBe(2);

      tracker.clear();
      expect(tracker.getRecordCount()).toBe(0);
      expect(tracker.getRecords()).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    it('should return correct totals for empty tracker', () => {
      const summary = tracker.getSummary();

      expect(summary.totalRequests).toBe(0);
      expect(summary.totalTokens.input).toBe(0);
      expect(summary.totalTokens.output).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.averageDurationMs).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.byAgent).toEqual({});
      expect(summary.byModel).toEqual({});
      expect(summary.byProvider).toEqual({});
    });

    it('should calculate correct totals for single record', () => {
      tracker.record(makeRecord({
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.005,
        durationMs: 200,
        success: true,
      }));

      const summary = tracker.getSummary();

      expect(summary.totalRequests).toBe(1);
      expect(summary.totalTokens.input).toBe(100);
      expect(summary.totalTokens.output).toBe(50);
      expect(summary.totalCost).toBe(0.005);
      expect(summary.averageDurationMs).toBe(200);
      expect(summary.successRate).toBe(1);
    });

    it('should calculate correct totals for multiple records', () => {
      tracker.record(makeRecord({ inputTokens: 100, outputTokens: 50, cost: 0.01, durationMs: 100, success: true }));
      tracker.record(makeRecord({ inputTokens: 200, outputTokens: 100, cost: 0.02, durationMs: 300, success: true }));
      tracker.record(makeRecord({ inputTokens: 50, outputTokens: 25, cost: 0.005, durationMs: 200, success: false }));

      const summary = tracker.getSummary();

      expect(summary.totalRequests).toBe(3);
      expect(summary.totalTokens.input).toBe(350);
      expect(summary.totalTokens.output).toBe(175);
      expect(summary.totalCost).toBeCloseTo(0.035);
      expect(summary.averageDurationMs).toBe(200);
    });

    it('should calculate correct success rate', () => {
      tracker.record(makeRecord({ success: true }));
      tracker.record(makeRecord({ success: true }));
      tracker.record(makeRecord({ success: false }));
      tracker.record(makeRecord({ success: false }));

      const summary = tracker.getSummary();
      expect(summary.successRate).toBe(0.5);
    });

    describe('agent breakdown', () => {
      it('should aggregate by agent', () => {
        tracker.record(makeRecord({ agentId: 'agent-a', inputTokens: 100, outputTokens: 50, cost: 0.01, durationMs: 100 }));
        tracker.record(makeRecord({ agentId: 'agent-a', inputTokens: 200, outputTokens: 100, cost: 0.02, durationMs: 300 }));
        tracker.record(makeRecord({ agentId: 'agent-b', inputTokens: 50, outputTokens: 25, cost: 0.005, durationMs: 150 }));

        const summary = tracker.getSummary();

        const agentA = summary.byAgent['agent-a'];
        expect(agentA.requests).toBe(2);
        expect(agentA.tokens).toBe(450);
        expect(agentA.cost).toBeCloseTo(0.03);
        expect(agentA.averageDurationMs).toBe(200);
        expect(summary.byAgent['agent-b']).toEqual({
          requests: 1,
          tokens: 75,
          cost: 0.005,
          averageDurationMs: 150,
        });
      });
    });

    describe('model breakdown', () => {
      it('should aggregate by model', () => {
        tracker.record(makeRecord({ modelId: 'gpt-4o', inputTokens: 100, outputTokens: 50, cost: 0.01 }));
        tracker.record(makeRecord({ modelId: 'gpt-4o', inputTokens: 200, outputTokens: 100, cost: 0.02 }));
        tracker.record(makeRecord({ modelId: 'claude-3-opus', inputTokens: 150, outputTokens: 75, cost: 0.03 }));

        const summary = tracker.getSummary();

        const gpt4o = summary.byModel['gpt-4o'];
        expect(gpt4o.requests).toBe(2);
        expect(gpt4o.tokens).toBe(450);
        expect(gpt4o.cost).toBeCloseTo(0.03);

        const claude = summary.byModel['claude-3-opus'];
        expect(claude.requests).toBe(1);
        expect(claude.tokens).toBe(225);
        expect(claude.cost).toBeCloseTo(0.03);
      });
    });

    describe('provider breakdown', () => {
      it('should aggregate by provider with error rate', () => {
        tracker.record(makeRecord({ provider: 'openai', success: true }));
        tracker.record(makeRecord({ provider: 'openai', success: true }));
        tracker.record(makeRecord({ provider: 'openai', success: false }));
        tracker.record(makeRecord({ provider: 'anthropic', success: true }));

        const summary = tracker.getSummary();

        expect(summary.byProvider['openai'].requests).toBe(3);
        expect(summary.byProvider['openai'].errorRate).toBeCloseTo(1 / 3);
        expect(summary.byProvider['anthropic'].requests).toBe(1);
        expect(summary.byProvider['anthropic'].errorRate).toBe(0);
      });
    });

    describe('time range filtering', () => {
      beforeEach(() => {
        tracker.record(makeRecord({ timestamp: '2025-01-10T10:00:00.000Z', cost: 0.01 }));
        tracker.record(makeRecord({ timestamp: '2025-01-15T10:00:00.000Z', cost: 0.02 }));
        tracker.record(makeRecord({ timestamp: '2025-01-20T10:00:00.000Z', cost: 0.03 }));
      });

      it('should filter by since', () => {
        const summary = tracker.getSummary({ since: '2025-01-14T00:00:00.000Z' });

        expect(summary.totalRequests).toBe(2);
        expect(summary.totalCost).toBeCloseTo(0.05);
      });

      it('should filter by until', () => {
        const summary = tracker.getSummary({ until: '2025-01-16T00:00:00.000Z' });

        expect(summary.totalRequests).toBe(2);
        expect(summary.totalCost).toBeCloseTo(0.03);
      });

      it('should filter by both since and until', () => {
        const summary = tracker.getSummary({
          since: '2025-01-14T00:00:00.000Z',
          until: '2025-01-16T00:00:00.000Z',
        });

        expect(summary.totalRequests).toBe(1);
        expect(summary.totalCost).toBe(0.02);
      });

      it('should return empty summary when range matches nothing', () => {
        const summary = tracker.getSummary({
          since: '2025-02-01T00:00:00.000Z',
        });

        expect(summary.totalRequests).toBe(0);
        expect(summary.totalCost).toBe(0);
      });
    });

    describe('period', () => {
      it('should set period start/end from filtered records', () => {
        tracker.record(makeRecord({ timestamp: '2025-01-10T10:00:00.000Z' }));
        tracker.record(makeRecord({ timestamp: '2025-01-20T10:00:00.000Z' }));

        const summary = tracker.getSummary();

        expect(summary.period.start).toBe('2025-01-10T10:00:00.000Z');
        expect(summary.period.end).toBe('2025-01-20T10:00:00.000Z');
      });

      it('should use current timestamp for empty results', () => {
        const before = new Date().toISOString();
        const summary = tracker.getSummary();
        const after = new Date().toISOString();

        expect(summary.period.start >= before).toBe(true);
        expect(summary.period.end <= after).toBe(true);
      });
    });
  });
});
