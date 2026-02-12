/**
 * Context Budget
 *
 * Enforces the 50% rule: planning phase cannot exceed 50% of total context budget.
 *
 * @module core/context/planning-context/context-budget
 */

import type { IContextBudget, BudgetAllocation } from './interfaces/planning.interface';

/**
 * Context Budget
 *
 * Tracks token allocation between planning and execution phases.
 */
export class ContextBudget implements IContextBudget {
  private totalBudget: number;
  private planningRatio: number;
  private planningConsumed = 0;
  private executionConsumed = 0;

  constructor(totalBudget?: number, planningRatio?: number) {
    this.totalBudget = totalBudget ?? 200000;
    this.planningRatio = planningRatio ?? 0.5;
  }

  setTotalBudget(tokens: number): void {
    if (tokens <= 0) throw new Error('Budget must be positive');
    this.totalBudget = tokens;
  }

  getAllocation(): BudgetAllocation {
    const planningTokens = Math.floor(this.totalBudget * this.planningRatio);
    const executionTokens = this.totalBudget - planningTokens;
    return {
      planningTokens,
      executionTokens,
      totalTokens: this.totalBudget,
      planningRatio: this.planningRatio,
    };
  }

  consumePlanning(tokens: number): void {
    this.planningConsumed += tokens;
  }

  consumeExecution(tokens: number): void {
    this.executionConsumed += tokens;
  }

  isOverBudget(): boolean {
    const alloc = this.getAllocation();
    return (
      this.planningConsumed > alloc.planningTokens ||
      this.executionConsumed > alloc.executionTokens
    );
  }

  getRemainingPlanning(): number {
    const alloc = this.getAllocation();
    return Math.max(0, alloc.planningTokens - this.planningConsumed);
  }

  getRemainingExecution(): number {
    const alloc = this.getAllocation();
    return Math.max(0, alloc.executionTokens - this.executionConsumed);
  }

  getTotalConsumed(): number {
    return this.planningConsumed + this.executionConsumed;
  }

  reset(): void {
    this.planningConsumed = 0;
    this.executionConsumed = 0;
  }
}

/**
 * Create a context budget
 */
export function createContextBudget(
  totalBudget?: number,
  planningRatio?: number,
): ContextBudget {
  return new ContextBudget(totalBudget, planningRatio);
}
