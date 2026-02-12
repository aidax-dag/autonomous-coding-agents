/**
 * Cost Tracker
 *
 * Tracks LLM API costs and enforces budget limits.
 *
 * @module shared/llm/cost-tracker
 */

import type { CostRecord, ICostTracker } from './interfaces/routing.interface';

/**
 * Cost Tracker
 *
 * Records API call costs and manages budget enforcement.
 */
export class CostTracker implements ICostTracker {
  private records: CostRecord[] = [];
  private budgetLimit: number | null = null;

  record(record: CostRecord): void {
    this.records.push(record);
  }

  getTotalCost(): number {
    return this.records.reduce((sum, r) => sum + r.totalCost, 0);
  }

  setBudget(limit: number): void {
    if (limit < 0) {
      throw new Error('Budget limit must be non-negative');
    }
    this.budgetLimit = limit;
  }

  isBudgetExceeded(): boolean {
    if (this.budgetLimit === null) return false;
    return this.getTotalCost() >= this.budgetLimit;
  }

  getRemainingBudget(): number {
    if (this.budgetLimit === null) return Infinity;
    return Math.max(0, this.budgetLimit - this.getTotalCost());
  }

  getRecords(): CostRecord[] {
    return [...this.records];
  }

  getBudgetUtilization(): number {
    if (this.budgetLimit === null || this.budgetLimit === 0) return 0;
    return this.getTotalCost() / this.budgetLimit;
  }

  reset(): void {
    this.records = [];
  }
}

/**
 * Create a cost tracker
 */
export function createCostTracker(): CostTracker {
  return new CostTracker();
}
