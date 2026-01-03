/**
 * Token Budget Manager Tests
 */

import {
  createTokenBudgetManager,
  BudgetExceededError,
  type ITokenBudgetManager,
} from '../../../../src/dx/token-budget';

describe('Token Budget Manager', () => {
  let manager: ITokenBudgetManager;

  beforeEach(() => {
    manager = createTokenBudgetManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('Budget Creation', () => {
    it('should create a budget with default warning threshold behavior', () => {
      const budget = manager.createBudget({
        maxTokens: 10000,
        name: 'test-budget',
      });

      expect(budget.id).toBeDefined();
      expect(budget.name).toBe('test-budget');
      expect(budget.config.maxTokens).toBe(10000);
      // warningThreshold is optional in config, defaults to 0.8 in status calculation
      expect(budget.config.warningThreshold).toBeUndefined();
    });

    it('should create a budget with custom thresholds', () => {
      const budget = manager.createBudget({
        name: 'custom-budget',
        maxTokens: 5000,
        warningThreshold: 0.7,
      });

      expect(budget.config.warningThreshold).toBe(0.7);
    });

    it('should get budget by ID', () => {
      const created = manager.createBudget({
        name: 'get-test',
        maxTokens: 1000,
      });

      const retrieved = manager.getBudget(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('get-test');
    });

    it('should return undefined for non-existent budget', () => {
      const budget = manager.getBudget('non-existent');
      expect(budget).toBeUndefined();
    });

    it('should delete budget', () => {
      const budget = manager.createBudget({
        name: 'to-delete',
        maxTokens: 1000,
      });

      expect(manager.deleteBudget(budget.id)).toBe(true);
      expect(manager.getBudget(budget.id)).toBeUndefined();
    });
  });

  describe('Usage Recording', () => {
    it('should record token usage', () => {
      const budget = manager.createBudget({
        name: 'usage-test',
        maxTokens: 10000,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 100,
        outputTokens: 50,
        operation: 'test',
      });

      const status = manager.checkBudget(budget.id);
      expect(status.used).toBe(150);
      expect(status.remaining).toBe(9850);
    });

    it('should accumulate usage across multiple records', () => {
      const budget = manager.createBudget({
        name: 'accumulate-test',
        maxTokens: 1000,
      });

      for (let i = 0; i < 5; i++) {
        manager.recordUsage({
          budgetId: budget.id,
          inputTokens: 50,
          outputTokens: 50,
        });
      }

      const status = manager.checkBudget(budget.id);
      expect(status.used).toBe(500);
    });

    it('should record to global budget when configured', () => {
      // Create a manager with global budget
      const managerWithGlobal = createTokenBudgetManager({
        maxTokens: 10000,
        name: 'Global',
      });

      managerWithGlobal.recordUsage({
        inputTokens: 100,
        outputTokens: 100,
      });

      const status = managerWithGlobal.checkBudget();
      expect(status.used).toBe(200);

      managerWithGlobal.dispose();
    });
  });

  describe('Budget Status', () => {
    it('should report normal status under threshold', () => {
      const budget = manager.createBudget({
        name: 'status-test',
        maxTokens: 1000,
        warningThreshold: 0.8,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 300,
        outputTokens: 200,
      });

      const status = manager.checkBudget(budget.id);
      expect(status.isWarning).toBe(false);
      expect(status.isExceeded).toBe(false);
      expect(status.percentage).toBe(50);
    });

    it('should report warning status at threshold', () => {
      const budget = manager.createBudget({
        name: 'warning-test',
        maxTokens: 1000,
        warningThreshold: 0.8,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 400,
        outputTokens: 450,
      });

      const status = manager.checkBudget(budget.id);
      expect(status.isWarning).toBe(true);
      expect(status.percentage).toBe(85);
    });

    it('should report exceeded status over limit', () => {
      const budget = manager.createBudget({
        name: 'exceeded-test',
        maxTokens: 1000,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 600,
        outputTokens: 500,
      });

      const status = manager.checkBudget(budget.id);
      expect(status.isExceeded).toBe(true);
      expect(status.used).toBe(1100);
    });
  });

  describe('Remaining Budget', () => {
    it('should return correct remaining tokens', () => {
      const budget = manager.createBudget({
        name: 'remaining-test',
        maxTokens: 1000,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 300,
        outputTokens: 200,
      });

      expect(manager.getRemainingBudget(budget.id)).toBe(500);
    });

    it('should return 0 when exceeded', () => {
      const budget = manager.createBudget({
        name: 'zero-remaining',
        maxTokens: 500,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 400,
        outputTokens: 300,
      });

      expect(manager.getRemainingBudget(budget.id)).toBe(0);
    });
  });

  describe('withBudget', () => {
    it('should execute operation within budget', async () => {
      const budget = manager.createBudget({
        name: 'with-budget-test',
        maxTokens: 10000,
      });

      const result = await manager.withBudget(budget.id, async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('should throw when budget exceeded', async () => {
      const budget = manager.createBudget({
        name: 'exceed-test',
        maxTokens: 100,
      });

      // Exceed the budget first
      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 100,
        outputTokens: 50,
      });

      await expect(
        manager.withBudget(budget.id, async () => 'should not run')
      ).rejects.toThrow(BudgetExceededError);
    });

    it('should accept budget object directly', async () => {
      const budget = manager.createBudget({
        name: 'budget-object-test',
        maxTokens: 10000,
      });

      const result = await manager.withBudget(budget, async () => {
        return 42;
      });

      expect(result).toBe(42);
    });
  });

  describe('Callbacks', () => {
    it('should call warning callback at threshold', () => {
      const warnings: unknown[] = [];

      const subscription = manager.onWarning((status) => {
        warnings.push(status);
      });

      const budget = manager.createBudget({
        name: 'callback-warning',
        maxTokens: 1000,
        warningThreshold: 0.5,
      });

      // Push past threshold
      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 300,
        outputTokens: 300,
      });

      expect(warnings).toHaveLength(1);
      expect((warnings[0] as { isWarning: boolean }).isWarning).toBe(true);

      subscription.unsubscribe();
    });

    it('should call exceeded callback when over limit', () => {
      const exceeded: unknown[] = [];

      const subscription = manager.onExceeded((status) => {
        exceeded.push(status);
      });

      const budget = manager.createBudget({
        name: 'callback-exceeded',
        maxTokens: 500,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 400,
        outputTokens: 200,
      });

      expect(exceeded).toHaveLength(1);
      expect((exceeded[0] as { isExceeded: boolean }).isExceeded).toBe(true);

      subscription.unsubscribe();
    });

    it('should stop calling after unsubscribe', () => {
      let callCount = 0;

      const subscription = manager.onWarning(() => {
        callCount++;
      });

      const budget = manager.createBudget({
        name: 'unsubscribe-test',
        maxTokens: 100,
        warningThreshold: 0.5,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 60,
        outputTokens: 0,
      });

      expect(callCount).toBe(1);

      subscription.unsubscribe();

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 20,
        outputTokens: 0,
      });

      expect(callCount).toBe(1); // Should not increment
    });
  });

  describe('List Budgets', () => {
    it('should list all budgets', () => {
      manager.createBudget({ name: 'budget-1', maxTokens: 1000 });
      manager.createBudget({ name: 'budget-2', maxTokens: 2000 });
      manager.createBudget({ name: 'budget-3', maxTokens: 3000 });

      const all = manager.listBudgets();
      expect(all).toHaveLength(3);
      expect(all.map((b) => b.name).sort()).toEqual([
        'budget-1',
        'budget-2',
        'budget-3',
      ]);
    });
  });

  describe('Reset', () => {
    it('should reset budget usage', () => {
      const budget = manager.createBudget({
        name: 'reset-test',
        maxTokens: 1000,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 500,
        outputTokens: 300,
      });

      expect(manager.checkBudget(budget.id).used).toBe(800);

      manager.resetBudget(budget.id);

      expect(manager.checkBudget(budget.id).used).toBe(0);
    });
  });

  describe('canAfford', () => {
    it('should return true when budget can afford tokens', () => {
      const budget = manager.createBudget({
        name: 'afford-test',
        maxTokens: 1000,
      });

      expect(manager.canAfford(budget.id, 500)).toBe(true);
    });

    it('should return false when budget cannot afford tokens', () => {
      const budget = manager.createBudget({
        name: 'cannot-afford-test',
        maxTokens: 1000,
      });

      manager.recordUsage({
        budgetId: budget.id,
        inputTokens: 800,
        outputTokens: 0,
      });

      expect(manager.canAfford(budget.id, 300)).toBe(false);
    });
  });
});
