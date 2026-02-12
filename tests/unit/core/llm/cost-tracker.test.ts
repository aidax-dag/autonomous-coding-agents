/**
 * Cost Tracker Tests
 */

import { CostTracker, createCostTracker } from '@/shared/llm/cost-tracker';
import type { CostRecord } from '@/shared/llm/interfaces/routing.interface';

function makeCostRecord(cost: number, partial?: Partial<CostRecord>): CostRecord {
  return {
    timestamp: Date.now(),
    model: 'test-model',
    provider: 'test',
    inputTokens: 100,
    outputTokens: 50,
    totalCost: cost,
    ...partial,
  };
}

describe('CostTracker', () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  it('should record and accumulate costs', () => {
    tracker.record(makeCostRecord(0.01));
    tracker.record(makeCostRecord(0.02));
    expect(tracker.getTotalCost()).toBeCloseTo(0.03);
  });

  it('should return no budget exceeded when no budget set', () => {
    tracker.record(makeCostRecord(100));
    expect(tracker.isBudgetExceeded()).toBe(false);
    expect(tracker.getRemainingBudget()).toBe(Infinity);
  });

  it('should enforce budget limits', () => {
    tracker.setBudget(0.05);
    tracker.record(makeCostRecord(0.03));
    expect(tracker.isBudgetExceeded()).toBe(false);
    expect(tracker.getRemainingBudget()).toBeCloseTo(0.02);

    tracker.record(makeCostRecord(0.03));
    expect(tracker.isBudgetExceeded()).toBe(true);
    expect(tracker.getRemainingBudget()).toBe(0);
  });

  it('should throw on negative budget', () => {
    expect(() => tracker.setBudget(-1)).toThrow('Budget limit must be non-negative');
  });

  it('should calculate budget utilization', () => {
    tracker.setBudget(1.0);
    tracker.record(makeCostRecord(0.5));
    expect(tracker.getBudgetUtilization()).toBeCloseTo(0.5);
  });

  it('should return copy of records', () => {
    tracker.record(makeCostRecord(0.01));
    const records = tracker.getRecords();
    records.push(makeCostRecord(999));
    expect(tracker.getRecords().length).toBe(1);
  });

  it('should reset all records', () => {
    tracker.record(makeCostRecord(0.01));
    tracker.reset();
    expect(tracker.getTotalCost()).toBe(0);
    expect(tracker.getRecords()).toEqual([]);
  });

  it('should create via factory', () => {
    const t = createCostTracker();
    expect(t).toBeInstanceOf(CostTracker);
  });
});
