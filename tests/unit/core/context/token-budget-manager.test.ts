/**
 * Token Budget Manager Tests
 */

import {
  TokenBudgetManager,
  createTokenBudgetManager,
} from '../../../../src/core/context/token-budget-manager';

describe('TokenBudgetManager', () => {
  let manager: TokenBudgetManager;

  beforeEach(() => {
    manager = new TokenBudgetManager({
      maxTokens: 10000,
      warningThreshold: 70,
      criticalThreshold: 85,
      reserveTokens: 1000,
    });
  });

  // ==========================================================================
  // Basic Token Operations
  // ==========================================================================

  describe('getUsedTokens', () => {
    it('should start at 0', () => {
      expect(manager.getUsedTokens()).toBe(0);
    });
  });

  describe('getMaxTokens', () => {
    it('should return configured max', () => {
      expect(manager.getMaxTokens()).toBe(10000);
    });
  });

  describe('setMaxTokens', () => {
    it('should update max tokens', () => {
      manager.setMaxTokens(20000);
      expect(manager.getMaxTokens()).toBe(20000);
    });

    it('should throw for non-positive values', () => {
      expect(() => manager.setMaxTokens(0)).toThrow('positive');
      expect(() => manager.setMaxTokens(-1)).toThrow('positive');
    });
  });

  describe('addTokens', () => {
    it('should increase used tokens', () => {
      manager.addTokens(500);
      expect(manager.getUsedTokens()).toBe(500);
    });

    it('should accumulate', () => {
      manager.addTokens(100);
      manager.addTokens(200);
      expect(manager.getUsedTokens()).toBe(300);
    });

    it('should throw for negative count', () => {
      expect(() => manager.addTokens(-1)).toThrow('negative');
    });
  });

  describe('releaseTokens', () => {
    it('should decrease used tokens', () => {
      manager.addTokens(500);
      manager.releaseTokens(200);
      expect(manager.getUsedTokens()).toBe(300);
    });

    it('should not go below 0', () => {
      manager.addTokens(100);
      manager.releaseTokens(500);
      expect(manager.getUsedTokens()).toBe(0);
    });

    it('should throw for negative count', () => {
      expect(() => manager.releaseTokens(-1)).toThrow('negative');
    });
  });

  describe('canAfford', () => {
    it('should return true when tokens available', () => {
      // 10000 max - 0 used - 1000 reserve = 9000 available
      expect(manager.canAfford(5000)).toBe(true);
    });

    it('should return false when exceeds available', () => {
      // 10000 max - 0 used - 1000 reserve = 9000 available
      expect(manager.canAfford(9500)).toBe(false);
    });

    it('should account for used tokens', () => {
      manager.addTokens(8000);
      // 10000 - 8000 - 1000 = 1000 available
      expect(manager.canAfford(1000)).toBe(true);
      expect(manager.canAfford(1001)).toBe(false);
    });

    it('should account for reserve tokens', () => {
      // 10000 - 0 - 1000 = 9000 available
      expect(manager.canAfford(9000)).toBe(true);
      expect(manager.canAfford(9001)).toBe(false);
    });
  });

  // ==========================================================================
  // Threshold Checks
  // ==========================================================================

  describe('getUsagePercent', () => {
    it('should return 0 initially', () => {
      expect(manager.getUsagePercent()).toBe(0);
    });

    it('should return correct percentage', () => {
      manager.addTokens(5000);
      expect(manager.getUsagePercent()).toBe(50);
    });
  });

  describe('isAtWarning', () => {
    it('should return false below threshold', () => {
      manager.addTokens(6900); // 69%
      expect(manager.isAtWarning()).toBe(false);
    });

    it('should return true at threshold', () => {
      manager.addTokens(7000); // 70%
      expect(manager.isAtWarning()).toBe(true);
    });

    it('should return true above threshold', () => {
      manager.addTokens(8000); // 80%
      expect(manager.isAtWarning()).toBe(true);
    });
  });

  describe('isAtCritical', () => {
    it('should return false below threshold', () => {
      manager.addTokens(8400); // 84%
      expect(manager.isAtCritical()).toBe(false);
    });

    it('should return true at threshold', () => {
      manager.addTokens(8500); // 85%
      expect(manager.isAtCritical()).toBe(true);
    });
  });

  describe('getRemainingTokens', () => {
    it('should return full amount initially', () => {
      expect(manager.getRemainingTokens()).toBe(10000);
    });

    it('should decrease with usage', () => {
      manager.addTokens(3000);
      expect(manager.getRemainingTokens()).toBe(7000);
    });
  });

  describe('getAvailableTokens', () => {
    it('should subtract reserve from remaining', () => {
      // 10000 - 0 - 1000 = 9000
      expect(manager.getAvailableTokens()).toBe(9000);
    });

    it('should not go below 0', () => {
      manager.addTokens(9500);
      // 10000 - 9500 - 1000 = -500 → 0
      expect(manager.getAvailableTokens()).toBe(0);
    });
  });

  // ==========================================================================
  // Configuration & Reset
  // ==========================================================================

  describe('configure', () => {
    it('should update config', () => {
      manager.configure({ maxTokens: 50000 });
      expect(manager.getMaxTokens()).toBe(50000);
    });

    it('should merge with existing', () => {
      manager.configure({ warningThreshold: 80 });
      expect(manager.getConfig().warningThreshold).toBe(80);
      expect(manager.getConfig().maxTokens).toBe(10000); // unchanged
    });
  });

  describe('getConfig', () => {
    it('should return copy of config', () => {
      const config = manager.getConfig();
      config.maxTokens = 999;
      expect(manager.getMaxTokens()).toBe(10000); // unchanged
    });
  });

  describe('reset', () => {
    it('should reset usage to zero', () => {
      manager.addTokens(5000);
      manager.reset();
      expect(manager.getUsedTokens()).toBe(0);
    });
  });

  // ==========================================================================
  // Factory
  // ==========================================================================

  describe('createTokenBudgetManager', () => {
    it('should create with defaults', () => {
      const mgr = createTokenBudgetManager();
      expect(mgr).toBeInstanceOf(TokenBudgetManager);
      expect(mgr.getMaxTokens()).toBe(128000); // default
    });

    it('should create with custom config', () => {
      const mgr = createTokenBudgetManager({ maxTokens: 5000 });
      expect(mgr.getMaxTokens()).toBe(5000);
    });
  });
});
