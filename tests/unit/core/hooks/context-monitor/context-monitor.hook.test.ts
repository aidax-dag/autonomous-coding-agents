/**
 * Context Monitor Hook Tests
 */

import {
  ContextMonitorHook,
  ContextUsageLevel,
  CompactionStrategy,
  CompactionResult,
  IContextProvider,
  IContextCompactor,
  DEFAULT_CONTEXT_MONITOR_CONFIG,
} from '../../../../../src/core/hooks/context-monitor';
import { HookEvent, HookAction, HookContext } from '../../../../../src/core/interfaces/hook.interface';
import {
  ILegacyTokenBudgetManager as ITokenBudgetManager,
  BudgetStatus,
} from '../../../../../src/core/context';

// Mock Token Budget Manager
function createMockTokenBudgetManager(overrides?: Partial<BudgetStatus>): ITokenBudgetManager {
  const defaultStatus: BudgetStatus = {
    budgetId: 'test-budget',
    name: 'Test Budget',
    used: 0,
    limit: 100000,
    remaining: 100000,
    percentage: 0,
    isWarning: false,
    isExceeded: false,
    lastUpdated: new Date(),
    ...overrides,
  };

  return {
    createBudget: jest.fn(),
    getBudget: jest.fn(),
    deleteBudget: jest.fn(),
    listBudgets: jest.fn(),
    updateBudget: jest.fn(),
    recordUsage: jest.fn(),
    checkBudget: jest.fn().mockReturnValue(defaultStatus),
    getRemainingBudget: jest.fn().mockReturnValue(defaultStatus.remaining),
    canAfford: jest.fn().mockReturnValue(true),
    withBudget: jest.fn(),
    reserveTokens: jest.fn(),
    releaseReservedTokens: jest.fn(),
    getHistory: jest.fn(),
    getUsageStats: jest.fn(),
    resetBudget: jest.fn(),
    onWarning: jest.fn(),
    onExceeded: jest.fn(),
    onUsage: jest.fn(),
    getGlobalStatus: jest.fn().mockReturnValue(defaultStatus),
    dispose: jest.fn(),
  } as unknown as ITokenBudgetManager;
}

// Mock Context Provider
function createMockContextProvider(
  currentSize: number = 0,
  maxSize: number = 100000
): IContextProvider {
  let context: unknown = {};
  return {
    getCurrentSize: jest.fn().mockReturnValue(currentSize),
    getMaxSize: jest.fn().mockReturnValue(maxSize),
    getContext: jest.fn().mockReturnValue(context),
    setContext: jest.fn((ctx: unknown) => {
      context = ctx;
    }),
  };
}

// Mock Context Compactor
function createMockContextCompactor(
  canCompactResult: boolean = true,
  compactResult?: Partial<CompactionResult>
): IContextCompactor {
  const defaultResult: CompactionResult = {
    success: true,
    tokensFreed: 10000,
    newPercentage: 60,
    strategyUsed: CompactionStrategy.HYBRID,
    compactedContext: { compacted: true },
    ...compactResult,
  };

  return {
    compact: jest.fn().mockResolvedValue(defaultResult),
    canCompact: jest.fn().mockReturnValue(canCompactResult),
    estimateFreeable: jest.fn().mockReturnValue(10000),
  };
}

// Create hook context
function createHookContext(data?: unknown): HookContext<unknown> {
  return {
    event: HookEvent.TASK_BEFORE,
    timestamp: new Date(),
    source: 'test',
    data: data ?? {},
  };
}

describe('ContextMonitorHook', () => {
  describe('Construction', () => {
    it('should create with default config', () => {
      const hook = new ContextMonitorHook();

      expect(hook.name).toBe('context-monitor');
      expect(hook.event).toBe(HookEvent.TASK_BEFORE);
      expect(hook.isEnabled()).toBe(true);

      const thresholds = hook.getThresholds();
      expect(thresholds.warning).toBe(0.7);
      expect(thresholds.critical).toBe(0.85);
      expect(thresholds.overflow).toBe(0.95);
    });

    it('should create with custom config', () => {
      const hook = new ContextMonitorHook({
        warningThreshold: 0.6,
        criticalThreshold: 0.8,
        overflowThreshold: 0.9,
        priority: 50,
      });

      const thresholds = hook.getThresholds();
      expect(thresholds.warning).toBe(0.6);
      expect(thresholds.critical).toBe(0.8);
      expect(thresholds.overflow).toBe(0.9);
      expect(hook.priority).toBe(50);
    });

    it('should throw error for invalid warning threshold', () => {
      expect(() => new ContextMonitorHook({ warningThreshold: 1.5 })).toThrow();
      expect(() => new ContextMonitorHook({ warningThreshold: -0.1 })).toThrow();
    });

    it('should throw error for threshold ordering violations', () => {
      expect(
        () => new ContextMonitorHook({ warningThreshold: 0.9, criticalThreshold: 0.8 })
      ).toThrow('Warning threshold must be less than critical threshold');

      expect(
        () => new ContextMonitorHook({ criticalThreshold: 0.96, overflowThreshold: 0.95 })
      ).toThrow('Critical threshold must be less than overflow threshold');
    });
  });

  describe('Usage Level Detection', () => {
    let hook: ContextMonitorHook;

    beforeEach(() => {
      hook = new ContextMonitorHook();
    });

    it('should detect NORMAL level', () => {
      expect(hook.getUsageLevel(0)).toBe(ContextUsageLevel.NORMAL);
      expect(hook.getUsageLevel(50)).toBe(ContextUsageLevel.NORMAL);
      expect(hook.getUsageLevel(69)).toBe(ContextUsageLevel.NORMAL);
    });

    it('should detect WARNING level', () => {
      expect(hook.getUsageLevel(70)).toBe(ContextUsageLevel.WARNING);
      expect(hook.getUsageLevel(80)).toBe(ContextUsageLevel.WARNING);
      expect(hook.getUsageLevel(84)).toBe(ContextUsageLevel.WARNING);
    });

    it('should detect CRITICAL level', () => {
      expect(hook.getUsageLevel(85)).toBe(ContextUsageLevel.CRITICAL);
      expect(hook.getUsageLevel(90)).toBe(ContextUsageLevel.CRITICAL);
      expect(hook.getUsageLevel(94)).toBe(ContextUsageLevel.CRITICAL);
    });

    it('should detect OVERFLOW level', () => {
      expect(hook.getUsageLevel(95)).toBe(ContextUsageLevel.OVERFLOW);
      expect(hook.getUsageLevel(99)).toBe(ContextUsageLevel.OVERFLOW);
      expect(hook.getUsageLevel(100)).toBe(ContextUsageLevel.OVERFLOW);
    });
  });

  describe('Execution with Token Budget Manager', () => {
    it('should continue on normal usage', async () => {
      const manager = createMockTokenBudgetManager({
        used: 50000,
        limit: 100000,
        remaining: 50000,
        percentage: 50,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const result = await hook.execute(createHookContext());

      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.data?.currentStatus.level).toBe(ContextUsageLevel.NORMAL);
    });

    it('should warn on warning threshold', async () => {
      const manager = createMockTokenBudgetManager({
        used: 75000,
        limit: 100000,
        remaining: 25000,
        percentage: 75,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const result = await hook.execute(createHookContext());

      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.data?.currentStatus.level).toBe(ContextUsageLevel.WARNING);
      expect(result.message).toContain('75');
    });

    it('should continue on critical without compactor', async () => {
      const manager = createMockTokenBudgetManager({
        used: 90000,
        limit: 100000,
        remaining: 10000,
        percentage: 90,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const result = await hook.execute(createHookContext());

      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.data?.currentStatus.level).toBe(ContextUsageLevel.CRITICAL);
    });

    it('should abort on overflow', async () => {
      const manager = createMockTokenBudgetManager({
        used: 98000,
        limit: 100000,
        remaining: 2000,
        percentage: 98,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const result = await hook.execute(createHookContext());

      expect(result.action).toBe(HookAction.ABORT);
      expect(result.data?.currentStatus.level).toBe(ContextUsageLevel.OVERFLOW);
      expect(result.message).toContain('overflow');
    });
  });

  describe('Execution with Context Provider', () => {
    it('should calculate usage from context provider', async () => {
      const provider = createMockContextProvider(60000, 100000);

      const hook = new ContextMonitorHook();
      hook.setContextProvider(provider);

      const status = hook.getUsageStatus();

      expect(status.usedTokens).toBe(60000);
      expect(status.maxTokens).toBe(100000);
      expect(status.percentage).toBe(60);
      expect(status.level).toBe(ContextUsageLevel.NORMAL);
    });
  });

  describe('Auto Compaction', () => {
    it('should attempt compaction on critical', async () => {
      const manager = createMockTokenBudgetManager({
        used: 90000,
        limit: 100000,
        remaining: 10000,
        percentage: 90,
      });

      const provider = createMockContextProvider(90000, 100000);
      const compactor = createMockContextCompactor(true, {
        success: true,
        tokensFreed: 20000,
        newPercentage: 70,
      });

      const hook = new ContextMonitorHook({
        tokenBudgetManager: manager,
        autoCompact: true,
      });
      hook.setContextProvider(provider);
      hook.setContextCompactor(compactor);

      const result = await hook.execute(createHookContext());

      expect(result.action).toBe(HookAction.MODIFY);
      expect(result.data?.compactionResult?.success).toBe(true);
      expect(compactor.compact).toHaveBeenCalled();
    });

    it('should continue if compaction fails', async () => {
      const manager = createMockTokenBudgetManager({
        used: 90000,
        limit: 100000,
        remaining: 10000,
        percentage: 90,
      });

      const provider = createMockContextProvider(90000, 100000);
      const compactor = createMockContextCompactor(true, {
        success: false,
        tokensFreed: 0,
        error: 'Compaction failed',
      });

      const hook = new ContextMonitorHook({
        tokenBudgetManager: manager,
        autoCompact: true,
      });
      hook.setContextProvider(provider);
      hook.setContextCompactor(compactor);

      const result = await hook.execute(createHookContext());

      expect(result.action).toBe(HookAction.CONTINUE);
      expect(result.message).toContain('Compaction failed');
    });

    it('should skip compaction if autoCompact is false', async () => {
      const manager = createMockTokenBudgetManager({
        used: 90000,
        limit: 100000,
        remaining: 10000,
        percentage: 90,
      });

      const compactor = createMockContextCompactor();

      const hook = new ContextMonitorHook({
        tokenBudgetManager: manager,
        autoCompact: false,
      });
      hook.setContextCompactor(compactor);

      await hook.execute(createHookContext());

      expect(compactor.compact).not.toHaveBeenCalled();
    });
  });

  describe('Event Subscriptions', () => {
    it('should notify warning callbacks', async () => {
      const manager = createMockTokenBudgetManager({
        used: 75000,
        limit: 100000,
        remaining: 25000,
        percentage: 75,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const callback = jest.fn();

      hook.onWarning(callback);
      await hook.execute(createHookContext());

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: ContextUsageLevel.WARNING,
          percentage: 75,
        })
      );
    });

    it('should notify critical callbacks', async () => {
      const manager = createMockTokenBudgetManager({
        used: 90000,
        limit: 100000,
        remaining: 10000,
        percentage: 90,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const callback = jest.fn();

      hook.onCritical(callback);
      await hook.execute(createHookContext());

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          level: ContextUsageLevel.CRITICAL,
        })
      );
    });

    it('should notify overflow callbacks', async () => {
      const manager = createMockTokenBudgetManager({
        used: 98000,
        limit: 100000,
        remaining: 2000,
        percentage: 98,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const callback = jest.fn();

      hook.onOverflow(callback);
      await hook.execute(createHookContext());

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscription', async () => {
      const manager = createMockTokenBudgetManager({
        used: 75000,
        limit: 100000,
        remaining: 25000,
        percentage: 75,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });
      const callback = jest.fn();

      const subscription = hook.onWarning(callback);
      subscription.unsubscribe();

      await hook.execute(createHookContext());

      expect(callback).not.toHaveBeenCalled();
    });

    it('should notify compaction callbacks', async () => {
      const manager = createMockTokenBudgetManager({
        used: 90000,
        limit: 100000,
        remaining: 10000,
        percentage: 90,
      });

      const provider = createMockContextProvider(90000, 100000);
      const compactor = createMockContextCompactor(true);

      const hook = new ContextMonitorHook({
        tokenBudgetManager: manager,
        autoCompact: true,
      });
      hook.setContextProvider(provider);
      hook.setContextCompactor(compactor);

      const callback = jest.fn();
      hook.onCompaction(callback);

      await hook.execute(createHookContext());

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  describe('Threshold Crossing Detection', () => {
    it('should detect threshold crossing from normal to warning', async () => {
      const hook = new ContextMonitorHook();

      // First execution - normal
      const normalProvider = createMockContextProvider(50000, 100000);
      hook.setContextProvider(normalProvider);
      await hook.execute(createHookContext());

      // Second execution - warning
      const warningProvider = createMockContextProvider(75000, 100000);
      hook.setContextProvider(warningProvider);
      const result = await hook.execute(createHookContext());

      expect(result.data?.thresholdCrossed).toBe('warning');
    });

    it('should detect threshold crossing from warning to critical', async () => {
      const hook = new ContextMonitorHook();

      // First execution - warning
      const warningProvider = createMockContextProvider(75000, 100000);
      hook.setContextProvider(warningProvider);
      await hook.execute(createHookContext());

      // Second execution - critical
      const criticalProvider = createMockContextProvider(90000, 100000);
      hook.setContextProvider(criticalProvider);
      const result = await hook.execute(createHookContext());

      expect(result.data?.thresholdCrossed).toBe('critical');
    });
  });

  describe('Hook Lifecycle', () => {
    it('should respect shouldRun check', () => {
      const hook = new ContextMonitorHook();

      // Should run for TASK_BEFORE
      expect(
        hook.shouldRun({
          event: HookEvent.TASK_BEFORE,
          timestamp: new Date(),
          source: 'test',
          data: {},
        })
      ).toBe(true);

      // Should not run for different event
      expect(
        hook.shouldRun({
          event: HookEvent.TASK_AFTER,
          timestamp: new Date(),
          source: 'test',
          data: {},
        })
      ).toBe(false);
    });

    it('should respect enabled state', () => {
      const hook = new ContextMonitorHook();

      hook.disable();
      expect(
        hook.shouldRun({
          event: HookEvent.TASK_BEFORE,
          timestamp: new Date(),
          source: 'test',
          data: {},
        })
      ).toBe(false);

      hook.enable();
      expect(
        hook.shouldRun({
          event: HookEvent.TASK_BEFORE,
          timestamp: new Date(),
          source: 'test',
          data: {},
        })
      ).toBe(true);
    });
  });

  describe('Dispose', () => {
    it('should clean up subscriptions on dispose', async () => {
      const manager = createMockTokenBudgetManager({
        used: 75000,
        limit: 100000,
        remaining: 25000,
        percentage: 75,
      });

      const hook = new ContextMonitorHook({ tokenBudgetManager: manager });

      const warningCallback = jest.fn();
      const criticalCallback = jest.fn();

      hook.onWarning(warningCallback);
      hook.onCritical(criticalCallback);

      hook.dispose();

      await hook.execute(createHookContext());

      expect(warningCallback).not.toHaveBeenCalled();
      expect(criticalCallback).not.toHaveBeenCalled();
    });
  });

  describe('Default Config', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CONTEXT_MONITOR_CONFIG.warningThreshold).toBe(0.7);
      expect(DEFAULT_CONTEXT_MONITOR_CONFIG.criticalThreshold).toBe(0.85);
      expect(DEFAULT_CONTEXT_MONITOR_CONFIG.overflowThreshold).toBe(0.95);
      expect(DEFAULT_CONTEXT_MONITOR_CONFIG.autoCompact).toBe(true);
      expect(DEFAULT_CONTEXT_MONITOR_CONFIG.maxContextSize).toBe(128000);
    });
  });

  describe('Configuration', () => {
    it('should set token budget manager', () => {
      const hook = new ContextMonitorHook();
      const manager = createMockTokenBudgetManager({
        used: 50000,
        limit: 100000,
      });

      hook.setTokenBudgetManager(manager);

      const status = hook.getUsageStatus();
      expect(status.usedTokens).toBe(50000);
    });

    it('should set budget ID', () => {
      const hook = new ContextMonitorHook();
      const manager = createMockTokenBudgetManager();

      hook.setTokenBudgetManager(manager);
      hook.setBudgetId('custom-budget');

      hook.getUsageStatus();

      expect(manager.checkBudget).toHaveBeenCalledWith('custom-budget');
    });
  });
});
