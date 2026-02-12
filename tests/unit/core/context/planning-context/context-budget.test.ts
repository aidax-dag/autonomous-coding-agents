/**
 * Context Budget Tests
 */

import { ContextBudget } from '@/core/context/planning-context/context-budget';

describe('ContextBudget', () => {
  it('should default to 200K tokens with 50% split', () => {
    const budget = new ContextBudget();
    const alloc = budget.getAllocation();
    expect(alloc.totalTokens).toBe(200000);
    expect(alloc.planningRatio).toBe(0.5);
    expect(alloc.planningTokens).toBe(100000);
    expect(alloc.executionTokens).toBe(100000);
  });

  it('should track planning consumption', () => {
    const budget = new ContextBudget(100000);
    budget.consumePlanning(30000);
    expect(budget.getRemainingPlanning()).toBe(20000);
  });

  it('should track execution consumption', () => {
    const budget = new ContextBudget(100000);
    budget.consumeExecution(40000);
    expect(budget.getRemainingExecution()).toBe(10000);
  });

  it('should detect over-budget', () => {
    const budget = new ContextBudget(100000);
    expect(budget.isOverBudget()).toBe(false);
    budget.consumePlanning(60000);
    expect(budget.isOverBudget()).toBe(true);
  });

  it('should support custom planning ratio', () => {
    const budget = new ContextBudget(100000, 0.3);
    const alloc = budget.getAllocation();
    expect(alloc.planningTokens).toBe(30000);
    expect(alloc.executionTokens).toBe(70000);
  });

  it('should throw on non-positive budget', () => {
    const budget = new ContextBudget();
    expect(() => budget.setTotalBudget(0)).toThrow('Budget must be positive');
    expect(() => budget.setTotalBudget(-1)).toThrow('Budget must be positive');
  });

  it('should reset consumption', () => {
    const budget = new ContextBudget(100000);
    budget.consumePlanning(30000);
    budget.consumeExecution(20000);
    budget.reset();
    expect(budget.getRemainingPlanning()).toBe(50000);
    expect(budget.getRemainingExecution()).toBe(50000);
  });
});
