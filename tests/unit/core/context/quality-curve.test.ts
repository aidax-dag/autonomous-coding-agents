/**
 * QualityCurve Unit Tests
 *
 * Tests for quality level management based on context usage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  QualityCurve,
  createQualityCurve,
  QUALITY_THRESHOLDS,
  QUALITY_LEVEL_INFO,
  PLAN_CONFIG,
  WARNING_TEMPLATES,
} from '../../../../src/core/context/index.js';
import {
  QualityLevel,
  type ContextState,
} from '../../../../src/core/context/interfaces/quality-curve.interface.js';

describe('QualityCurve', () => {
  let curve: QualityCurve;

  beforeEach(() => {
    curve = new QualityCurve();
  });

  // ==========================================================================
  // getLevel Tests
  // ==========================================================================

  describe('getLevel', () => {
    it('should return PEAK for 0-30%', () => {
      expect(curve.getLevel(0)).toBe(QualityLevel.PEAK);
      expect(curve.getLevel(15)).toBe(QualityLevel.PEAK);
      expect(curve.getLevel(29)).toBe(QualityLevel.PEAK);
      expect(curve.getLevel(29.9)).toBe(QualityLevel.PEAK);
    });

    it('should return GOOD for 30-50%', () => {
      expect(curve.getLevel(30)).toBe(QualityLevel.GOOD);
      expect(curve.getLevel(40)).toBe(QualityLevel.GOOD);
      expect(curve.getLevel(49)).toBe(QualityLevel.GOOD);
      expect(curve.getLevel(49.9)).toBe(QualityLevel.GOOD);
    });

    it('should return DEGRADING for 50-70%', () => {
      expect(curve.getLevel(50)).toBe(QualityLevel.DEGRADING);
      expect(curve.getLevel(60)).toBe(QualityLevel.DEGRADING);
      expect(curve.getLevel(69)).toBe(QualityLevel.DEGRADING);
      expect(curve.getLevel(69.9)).toBe(QualityLevel.DEGRADING);
    });

    it('should return POOR for 70%+', () => {
      expect(curve.getLevel(70)).toBe(QualityLevel.POOR);
      expect(curve.getLevel(85)).toBe(QualityLevel.POOR);
      expect(curve.getLevel(100)).toBe(QualityLevel.POOR);
    });

    it('should handle edge cases', () => {
      expect(curve.getLevel(-5)).toBe(QualityLevel.PEAK);
      expect(curve.getLevel(150)).toBe(QualityLevel.POOR);
    });
  });

  // ==========================================================================
  // getLevelInfo Tests
  // ==========================================================================

  describe('getLevelInfo', () => {
    it('should return info for PEAK level', () => {
      const info = curve.getLevelInfo(QualityLevel.PEAK);
      expect(info.level).toBe(QualityLevel.PEAK);
      expect(info.label).toBeDefined();
      expect(info.rangeStart).toBe(0);
      expect(info.rangeEnd).toBe(30);
      expect(info.characteristics).toBeInstanceOf(Array);
      expect(info.recommendations).toBeInstanceOf(Array);
      expect(info.compressionStrategy).toBeDefined();
    });

    it('should return info for GOOD level', () => {
      const info = curve.getLevelInfo(QualityLevel.GOOD);
      expect(info.level).toBe(QualityLevel.GOOD);
      expect(info.rangeStart).toBe(30);
      expect(info.rangeEnd).toBe(50);
    });

    it('should return info for DEGRADING level', () => {
      const info = curve.getLevelInfo(QualityLevel.DEGRADING);
      expect(info.level).toBe(QualityLevel.DEGRADING);
      expect(info.rangeStart).toBe(50);
      expect(info.rangeEnd).toBe(70);
    });

    it('should return info for POOR level', () => {
      const info = curve.getLevelInfo(QualityLevel.POOR);
      expect(info.level).toBe(QualityLevel.POOR);
      expect(info.rangeStart).toBe(70);
      expect(info.rangeEnd).toBe(100);
    });

    it('should have increasing compression strategies', () => {
      const peakStrategy = curve.getLevelInfo(QualityLevel.PEAK).compressionStrategy;
      const goodStrategy = curve.getLevelInfo(QualityLevel.GOOD).compressionStrategy;
      const degradingStrategy = curve.getLevelInfo(QualityLevel.DEGRADING).compressionStrategy;
      const poorStrategy = curve.getLevelInfo(QualityLevel.POOR).compressionStrategy;

      expect(peakStrategy.tokenReduction).toBeLessThan(goodStrategy.tokenReduction);
      expect(goodStrategy.tokenReduction).toBeLessThan(degradingStrategy.tokenReduction);
      expect(degradingStrategy.tokenReduction).toBeLessThan(poorStrategy.tokenReduction);
    });
  });

  // ==========================================================================
  // getCurrentLevel Tests
  // ==========================================================================

  describe('getCurrentLevel', () => {
    it('should return PEAK without context provider', async () => {
      const level = await curve.getCurrentLevel();
      expect(level).toBe(QualityLevel.PEAK);
    });

    it('should use context provider when available', async () => {
      const providerCurve = new QualityCurve(async () => ({ used: 40, total: 100 }));
      const level = await providerCurve.getCurrentLevel();
      expect(level).toBe(QualityLevel.GOOD);
    });

    it('should return DEGRADING for 60% usage', async () => {
      const providerCurve = new QualityCurve(async () => ({ used: 60, total: 100 }));
      const level = await providerCurve.getCurrentLevel();
      expect(level).toBe(QualityLevel.DEGRADING);
    });

    it('should return POOR for 80% usage', async () => {
      const providerCurve = new QualityCurve(async () => ({ used: 80, total: 100 }));
      const level = await providerCurve.getCurrentLevel();
      expect(level).toBe(QualityLevel.POOR);
    });
  });

  // ==========================================================================
  // getRecommendations Tests
  // ==========================================================================

  describe('getRecommendations', () => {
    it('should return recommendations for each level', () => {
      const peakRecs = curve.getRecommendations(QualityLevel.PEAK);
      const goodRecs = curve.getRecommendations(QualityLevel.GOOD);
      const degradingRecs = curve.getRecommendations(QualityLevel.DEGRADING);
      const poorRecs = curve.getRecommendations(QualityLevel.POOR);

      expect(peakRecs.length).toBeGreaterThan(0);
      expect(goodRecs.length).toBeGreaterThan(0);
      expect(degradingRecs.length).toBeGreaterThan(0);
      expect(poorRecs.length).toBeGreaterThan(0);
    });

    it('should include new plan recommendation for DEGRADING', () => {
      const recs = curve.getRecommendations(QualityLevel.DEGRADING);
      expect(recs.some(r => r.includes('새 계획'))).toBe(true);
    });

    it('should include urgent recommendation for POOR', () => {
      const recs = curve.getRecommendations(QualityLevel.POOR);
      expect(recs.some(r => r.includes('즉시') || r.includes('🚨'))).toBe(true);
    });
  });

  // ==========================================================================
  // getCompressionStrategy Tests
  // ==========================================================================

  describe('getCompressionStrategy', () => {
    it('should return no compression for PEAK', () => {
      const strategy = curve.getCompressionStrategy(QualityLevel.PEAK);
      expect(strategy.name).toBe('none');
      expect(strategy.tokenReduction).toBe(0);
      expect(strategy.techniques.length).toBe(0);
    });

    it('should return light compression for GOOD', () => {
      const strategy = curve.getCompressionStrategy(QualityLevel.GOOD);
      expect(strategy.name).toBe('light');
      expect(strategy.tokenReduction).toBe(0.1);
      expect(strategy.techniques.length).toBeGreaterThan(0);
    });

    it('should return moderate compression for DEGRADING', () => {
      const strategy = curve.getCompressionStrategy(QualityLevel.DEGRADING);
      expect(strategy.name).toBe('moderate');
      expect(strategy.tokenReduction).toBe(0.25);
      expect(strategy.techniques.length).toBeGreaterThan(1);
    });

    it('should return aggressive compression for POOR', () => {
      const strategy = curve.getCompressionStrategy(QualityLevel.POOR);
      expect(strategy.name).toBe('aggressive');
      expect(strategy.tokenReduction).toBeGreaterThan(0.3);
      expect(strategy.techniques.length).toBeGreaterThan(2);
    });

    it('should have enabled techniques', () => {
      const strategy = curve.getCompressionStrategy(QualityLevel.POOR);
      expect(strategy.techniques.every(t => t.enabled)).toBe(true);
    });
  });

  // ==========================================================================
  // shouldStartNewPlan Tests
  // ==========================================================================

  describe('shouldStartNewPlan', () => {
    it('should return false below 50%', () => {
      expect(curve.shouldStartNewPlan(0)).toBe(false);
      expect(curve.shouldStartNewPlan(30)).toBe(false);
      expect(curve.shouldStartNewPlan(49)).toBe(false);
      expect(curve.shouldStartNewPlan(49.9)).toBe(false);
    });

    it('should return true at or above 50%', () => {
      expect(curve.shouldStartNewPlan(50)).toBe(true);
      expect(curve.shouldStartNewPlan(60)).toBe(true);
      expect(curve.shouldStartNewPlan(75)).toBe(true);
      expect(curve.shouldStartNewPlan(100)).toBe(true);
    });
  });

  // ==========================================================================
  // analyzeContextState Tests
  // ==========================================================================

  describe('analyzeContextState', () => {
    it('should calculate correct usage percent', () => {
      const state = curve.analyzeContextState(50000, 100000);
      expect(state.usagePercent).toBe(50);
      expect(state.usedTokens).toBe(50000);
      expect(state.totalTokens).toBe(100000);
      expect(state.remainingTokens).toBe(50000);
    });

    it('should determine quality level correctly', () => {
      const peakState = curve.analyzeContextState(20000, 100000);
      expect(peakState.qualityLevel).toBe(QualityLevel.PEAK);

      const goodState = curve.analyzeContextState(40000, 100000);
      expect(goodState.qualityLevel).toBe(QualityLevel.GOOD);

      const degradingState = curve.analyzeContextState(60000, 100000);
      expect(degradingState.qualityLevel).toBe(QualityLevel.DEGRADING);

      const poorState = curve.analyzeContextState(80000, 100000);
      expect(poorState.qualityLevel).toBe(QualityLevel.POOR);
    });

    it('should estimate tasks remaining', () => {
      const state = curve.analyzeContextState(0, 30000);
      expect(state.estimatedTasksRemaining).toBeGreaterThan(0);
    });

    it('should set shouldStartNewPlan correctly', () => {
      const lowUsageState = curve.analyzeContextState(30000, 100000);
      expect(lowUsageState.shouldStartNewPlan).toBe(false);

      const highUsageState = curve.analyzeContextState(60000, 100000);
      expect(highUsageState.shouldStartNewPlan).toBe(true);
    });

    it('should include warnings for degrading quality', () => {
      const state = curve.analyzeContextState(51000, 100000);
      expect(state.warnings.length).toBeGreaterThan(0);
      expect(state.warnings.some(w => w.severity === 'warning')).toBe(true);
    });

    it('should include critical warnings for poor quality', () => {
      const state = curve.analyzeContextState(71000, 100000);
      expect(state.warnings.some(w => w.severity === 'critical')).toBe(true);
    });

    it('should include budget critical warning for 90%+ usage', () => {
      const state = curve.analyzeContextState(92000, 100000);
      expect(state.warnings.some(w => w.type === 'budget' && w.severity === 'critical')).toBe(true);
    });

    it('should include info warning approaching GOOD level', () => {
      const state = curve.analyzeContextState(27000, 100000);
      expect(state.warnings.some(w => w.severity === 'info')).toBe(true);
    });
  });

  // ==========================================================================
  // getPlanRecommendation Tests
  // ==========================================================================

  describe('getPlanRecommendation', () => {
    it('should not recommend new plan below threshold', () => {
      const rec = curve.getPlanRecommendation(30, 3);
      expect(rec.shouldStartNew).toBe(false);
      expect(rec.reason).toBeUndefined();
    });

    it('should recommend new plan above threshold', () => {
      const rec = curve.getPlanRecommendation(55, 3);
      expect(rec.shouldStartNew).toBe(true);
      expect(rec.reason).toBeDefined();
      expect(rec.reason).toContain('50%');
    });

    it('should predict quality for next task', () => {
      const rec = curve.getPlanRecommendation(45, 3);
      expect(rec.qualityPrediction).toBeDefined();
      expect(Object.values(QualityLevel)).toContain(rec.qualityPrediction);
    });

    it('should provide suggestions', () => {
      const rec = curve.getPlanRecommendation(60, 5);
      expect(rec.suggestions.length).toBeGreaterThan(0);
    });

    it('should suggest splitting tasks when too many remaining', () => {
      const rec = curve.getPlanRecommendation(80, 10);
      expect(rec.suggestions.some(s => s.includes('태스크') || s.includes('세션'))).toBe(true);
    });

    it('should estimate remaining tasks', () => {
      const rec = curve.getPlanRecommendation(20, 5);
      expect(rec.estimatedTasksRemaining).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // estimateQualityDegradation Tests
  // ==========================================================================

  describe('estimateQualityDegradation', () => {
    it('should predict same level for small token addition', () => {
      const level = curve.estimateQualityDegradation(10, 100);
      expect(level).toBe(QualityLevel.PEAK);
    });

    it('should predict degradation for large token addition', () => {
      const level = curve.estimateQualityDegradation(40, 50000);
      expect([QualityLevel.DEGRADING, QualityLevel.POOR]).toContain(level);
    });

    it('should return POOR for usage exceeding 70%', () => {
      const level = curve.estimateQualityDegradation(65, 100000);
      expect(level).toBe(QualityLevel.POOR);
    });
  });

  // ==========================================================================
  // suggestOptimizations Tests
  // ==========================================================================

  describe('suggestOptimizations', () => {
    it('should return empty for PEAK quality', () => {
      const state = curve.analyzeContextState(10000, 100000);
      const suggestions = curve.suggestOptimizations(state);
      expect(suggestions.length).toBe(0);
    });

    it('should return empty for GOOD quality', () => {
      const state = curve.analyzeContextState(35000, 100000);
      const suggestions = curve.suggestOptimizations(state);
      expect(suggestions.length).toBe(0);
    });

    it('should suggest compression for DEGRADING quality', () => {
      const state = curve.analyzeContextState(55000, 100000);
      const suggestions = curve.suggestOptimizations(state);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.type === 'compress')).toBe(true);
    });

    it('should suggest more optimizations for POOR quality', () => {
      const state = curve.analyzeContextState(75000, 100000);
      const suggestions = curve.suggestOptimizations(state);
      expect(suggestions.length).toBeGreaterThan(2);
      expect(suggestions.some(s => s.type === 'prioritize')).toBe(true);
    });

    it('should suggest offload when tokens are low', () => {
      const state = curve.analyzeContextState(99000, 100000);
      const suggestions = curve.suggestOptimizations(state);
      expect(suggestions.some(s => s.type === 'offload')).toBe(true);
    });

    it('should include priority and estimated saving', () => {
      const state = curve.analyzeContextState(60000, 100000);
      const suggestions = curve.suggestOptimizations(state);

      for (const suggestion of suggestions) {
        expect(['high', 'medium', 'low']).toContain(suggestion.priority);
        expect(suggestion.estimatedSaving).toBeGreaterThan(0);
        expect(typeof suggestion.applicable).toBe('boolean');
      }
    });
  });

  // ==========================================================================
  // calculateOptimalTaskCount Tests
  // ==========================================================================

  describe('calculateOptimalTaskCount', () => {
    it('should return at least 1 task', () => {
      const count = curve.calculateOptimalTaskCount(100);
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should return more tasks for more tokens', () => {
      const smallCount = curve.calculateOptimalTaskCount(5000);
      const largeCount = curve.calculateOptimalTaskCount(50000);
      expect(largeCount).toBeGreaterThan(smallCount);
    });

    it('should apply safety margin', () => {
      // With safety margin of 80%, 30000 tokens -> 24000 safe tokens
      // At 3000 tokens per task -> 8 tasks
      const count = curve.calculateOptimalTaskCount(30000);
      expect(count).toBe(8);
    });

    it('should handle edge cases', () => {
      expect(curve.calculateOptimalTaskCount(0)).toBe(1);
      expect(curve.calculateOptimalTaskCount(-100)).toBe(1);
    });
  });

  // ==========================================================================
  // onLevelChange Tests
  // ==========================================================================

  describe('onLevelChange', () => {
    it('should notify on level change', async () => {
      let notified = false;
      let oldLevel: QualityLevel | null = null;
      let newLevel: QualityLevel | null = null;

      const providerCurve = new QualityCurve(async () => ({ used: 60, total: 100 }));

      providerCurve.onLevelChange((old, current) => {
        notified = true;
        oldLevel = old;
        newLevel = current;
      });

      await providerCurve.getCurrentLevel();

      expect(notified).toBe(true);
      expect(oldLevel).toBe(QualityLevel.PEAK);
      expect(newLevel).toBe(QualityLevel.DEGRADING);
    });

    it('should not notify when level stays the same', async () => {
      let notifyCount = 0;

      const providerCurve = new QualityCurve(async () => ({ used: 20, total: 100 }));

      providerCurve.onLevelChange(() => {
        notifyCount++;
      });

      // First call - no change from PEAK
      await providerCurve.getCurrentLevel();
      // Second call - still PEAK
      await providerCurve.getCurrentLevel();

      expect(notifyCount).toBe(0);
    });

    it('should support multiple callbacks', async () => {
      const callbacks: number[] = [];

      const providerCurve = new QualityCurve(async () => ({ used: 60, total: 100 }));

      providerCurve.onLevelChange(() => callbacks.push(1));
      providerCurve.onLevelChange(() => callbacks.push(2));
      providerCurve.onLevelChange(() => callbacks.push(3));

      await providerCurve.getCurrentLevel();

      expect(callbacks).toEqual([1, 2, 3]);
    });

    it('should handle callback errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      let secondCallbackCalled = false;

      const providerCurve = new QualityCurve(async () => ({ used: 60, total: 100 }));

      providerCurve.onLevelChange(() => {
        throw new Error('Callback error');
      });
      providerCurve.onLevelChange(() => {
        secondCallbackCalled = true;
      });

      await providerCurve.getCurrentLevel();

      expect(consoleSpy).toHaveBeenCalled();
      expect(secondCallbackCalled).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('createQualityCurve', () => {
    it('should create instance without options', () => {
      const instance = createQualityCurve();
      expect(instance).toBeInstanceOf(QualityCurve);
    });

    it('should create instance with context provider', async () => {
      const instance = createQualityCurve(async () => ({ used: 40, total: 100 }));
      const level = await instance.getCurrentLevel();
      expect(level).toBe(QualityLevel.GOOD);
    });
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe('Constants', () => {
    it('should export QUALITY_THRESHOLDS', () => {
      expect(QUALITY_THRESHOLDS.PEAK_END).toBe(30);
      expect(QUALITY_THRESHOLDS.GOOD_END).toBe(50);
      expect(QUALITY_THRESHOLDS.DEGRADING_END).toBe(70);
    });

    it('should export QUALITY_LEVEL_INFO for all levels', () => {
      expect(QUALITY_LEVEL_INFO[QualityLevel.PEAK]).toBeDefined();
      expect(QUALITY_LEVEL_INFO[QualityLevel.GOOD]).toBeDefined();
      expect(QUALITY_LEVEL_INFO[QualityLevel.DEGRADING]).toBeDefined();
      expect(QUALITY_LEVEL_INFO[QualityLevel.POOR]).toBeDefined();
    });

    it('should export PLAN_CONFIG', () => {
      expect(PLAN_CONFIG.RECOMMENDED_TASKS_PER_PLAN).toBe(3);
      expect(PLAN_CONFIG.NEW_PLAN_THRESHOLD).toBe(50);
      expect(PLAN_CONFIG.CRITICAL_THRESHOLD).toBe(70);
      expect(PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE).toBe(3000);
    });

    it('should export WARNING_TEMPLATES', () => {
      expect(WARNING_TEMPLATES.approaching_good).toBeDefined();
      expect(WARNING_TEMPLATES.entering_degrading).toBeDefined();
      expect(WARNING_TEMPLATES.entering_poor).toBeDefined();
      expect(WARNING_TEMPLATES.budget_critical).toBeDefined();
    });
  });
});
