/**
 * F007-QualityCurve: Quality Level Management
 *
 * Manages quality levels based on context usage.
 * - PEAK (0-30%): Comprehensive, thorough
 * - GOOD (30-50%): Confident, solid
 * - DEGRADING (50-70%): Efficiency mode
 * - POOR (70%+): Rushed, minimal
 *
 * @module core/context/quality-curve
 */

import { createAgentLogger } from '../../shared/logging/logger.js';
import type {
  IQualityCurve,
  QualityLevelInfo,
  CompressionStrategy,
  ContextState,
  ContextWarning,
  PlanRecommendation,
  OptimizationSuggestion,
} from './interfaces/quality-curve.interface.js';
import { QualityLevel } from './interfaces/quality-curve.interface.js';
import {
  QUALITY_THRESHOLDS,
  QUALITY_LEVEL_INFO,
  PLAN_CONFIG,
  WARNING_TEMPLATES,
} from './constants/quality-curve.constants.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Context provider function type
 */
export type ContextProvider = () => Promise<{ used: number; total: number }>;

// ============================================================================
// Implementation
// ============================================================================

/**
 * QualityCurve
 *
 * Manages quality levels based on context usage percentage.
 */
const logger = createAgentLogger('quality-curve');

export class QualityCurve implements IQualityCurve {
  private levelChangeCallbacks: Array<(oldLevel: QualityLevel, newLevel: QualityLevel) => void> = [];
  private currentLevel: QualityLevel = QualityLevel.PEAK;
  private contextProvider?: ContextProvider;

  constructor(contextProvider?: ContextProvider) {
    this.contextProvider = contextProvider;
  }

  // ==========================================================================
  // Quality Level Operations
  // ==========================================================================

  /**
   * Get quality level for usage percent
   */
  getLevel(usagePercent: number): QualityLevel {
    if (usagePercent < QUALITY_THRESHOLDS.PEAK_END) {
      return QualityLevel.PEAK;
    } else if (usagePercent < QUALITY_THRESHOLDS.GOOD_END) {
      return QualityLevel.GOOD;
    } else if (usagePercent < QUALITY_THRESHOLDS.DEGRADING_END) {
      return QualityLevel.DEGRADING;
    } else {
      return QualityLevel.POOR;
    }
  }

  /**
   * Get detailed info for quality level
   */
  getLevelInfo(level: QualityLevel): QualityLevelInfo {
    return QUALITY_LEVEL_INFO[level];
  }

  /**
   * Get current quality level (async, uses context provider)
   */
  async getCurrentLevel(): Promise<QualityLevel> {
    if (this.contextProvider) {
      const { used, total } = await this.contextProvider();
      const usagePercent = (used / total) * 100;
      const newLevel = this.getLevel(usagePercent);

      if (newLevel !== this.currentLevel) {
        this.notifyLevelChange(this.currentLevel, newLevel);
        this.currentLevel = newLevel;
      }

      return this.currentLevel;
    }

    return this.currentLevel;
  }

  // ==========================================================================
  // Recommendations
  // ==========================================================================

  /**
   * Get recommendations for quality level
   */
  getRecommendations(level: QualityLevel): string[] {
    return QUALITY_LEVEL_INFO[level].recommendations;
  }

  /**
   * Get compression strategy for quality level
   */
  getCompressionStrategy(level: QualityLevel): CompressionStrategy {
    return QUALITY_LEVEL_INFO[level].compressionStrategy;
  }

  /**
   * Get plan recommendation based on current state
   */
  getPlanRecommendation(usagePercent: number, tasksRemaining: number): PlanRecommendation {
    const currentLevel = this.getLevel(usagePercent);
    const shouldStartNew = this.shouldStartNewPlan(usagePercent);

    // Estimate how many tasks can be completed with remaining capacity
    const remainingCapacity = 100 - usagePercent;
    const estimatedTasksRemaining = Math.floor(
      (remainingCapacity / 100) * PLAN_CONFIG.RECOMMENDED_TASKS_PER_PLAN * 2
    );

    // Predict quality after next task
    const tokenPerTask = 100 / PLAN_CONFIG.RECOMMENDED_TASKS_PER_PLAN / 2;
    const nextUsage = usagePercent + tokenPerTask;
    const qualityPrediction = this.getLevel(nextUsage);

    const suggestions: string[] = [];

    if (shouldStartNew) {
      suggestions.push('새 계획을 시작하여 최적의 품질을 유지하세요.');
    }

    if (tasksRemaining > estimatedTasksRemaining) {
      suggestions.push(
        `남은 ${tasksRemaining}개 태스크 중 ${estimatedTasksRemaining}개만 현재 세션에서 처리 권장.`
      );
      suggestions.push('나머지 태스크는 새 세션에서 처리하세요.');
    }

    if (currentLevel === QualityLevel.DEGRADING || currentLevel === QualityLevel.POOR) {
      suggestions.push('출력 압축 전략 활성화를 권장합니다.');
    }

    return {
      shouldStartNew,
      reason: shouldStartNew
        ? `컨텍스트 사용률 ${usagePercent.toFixed(0)}%가 임계값 ${PLAN_CONFIG.NEW_PLAN_THRESHOLD}%를 초과했습니다.`
        : undefined,
      estimatedTasksRemaining,
      qualityPrediction,
      suggestions,
    };
  }

  // ==========================================================================
  // State Analysis
  // ==========================================================================

  /**
   * Analyze context state
   */
  analyzeContextState(used: number, total: number): ContextState {
    const usagePercent = (used / total) * 100;
    const qualityLevel = this.getLevel(usagePercent);
    const remainingTokens = total - used;

    // Estimate tasks remaining based on tokens per task
    const estimatedTasksRemaining = Math.floor(
      remainingTokens / PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE
    );

    // Generate warnings based on usage
    const warnings: ContextWarning[] = [];

    // Approaching GOOD level warning (25-30%)
    if (usagePercent >= 25 && usagePercent < 30) {
      warnings.push({ ...WARNING_TEMPLATES.approaching_good });
    }

    // Entering DEGRADING level warning (50-55%)
    if (usagePercent >= QUALITY_THRESHOLDS.GOOD_END && usagePercent < QUALITY_THRESHOLDS.GOOD_END + 5) {
      warnings.push({ ...WARNING_TEMPLATES.entering_degrading });
    }

    // Entering POOR level warning (70-75%)
    if (usagePercent >= QUALITY_THRESHOLDS.DEGRADING_END && usagePercent < QUALITY_THRESHOLDS.DEGRADING_END + 5) {
      warnings.push({ ...WARNING_TEMPLATES.entering_poor });
    }

    // Budget critical warning (90%+)
    if (usagePercent >= 90) {
      warnings.push({ ...WARNING_TEMPLATES.budget_critical });
    }

    return {
      totalTokens: total,
      usedTokens: used,
      usagePercent,
      qualityLevel,
      remainingTokens,
      estimatedTasksRemaining,
      shouldStartNewPlan: this.shouldStartNewPlan(usagePercent),
      warnings,
    };
  }

  /**
   * Check if should start new plan
   */
  shouldStartNewPlan(usagePercent: number): boolean {
    return usagePercent >= PLAN_CONFIG.NEW_PLAN_THRESHOLD;
  }

  /**
   * Estimate quality level after additional tokens
   */
  estimateQualityDegradation(currentUsage: number, additionalTokens: number): QualityLevel {
    // Calculate new usage based on tokens per task estimate
    const additionalUsagePercent = (additionalTokens / (PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE * PLAN_CONFIG.RECOMMENDED_TASKS_PER_PLAN * 2 / 100)) ;
    const newUsage = currentUsage + additionalUsagePercent;
    return this.getLevel(newUsage);
  }

  // ==========================================================================
  // Optimization
  // ==========================================================================

  /**
   * Suggest optimizations for current state
   */
  suggestOptimizations(state: ContextState): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const level = state.qualityLevel;

    // Only suggest for DEGRADING or POOR levels
    if (level === QualityLevel.PEAK || level === QualityLevel.GOOD) {
      return suggestions;
    }

    // DEGRADING or POOR: suggest compression and summarization
    if (level === QualityLevel.DEGRADING || level === QualityLevel.POOR) {
      suggestions.push({
        type: 'compress',
        description: '출력 압축 활성화',
        estimatedSaving: 500,
        priority: 'high',
        applicable: true,
      });

      suggestions.push({
        type: 'summarize',
        description: '긴 설명을 요약으로 대체',
        estimatedSaving: 300,
        priority: 'medium',
        applicable: true,
      });
    }

    // POOR: additional aggressive suggestions
    if (level === QualityLevel.POOR) {
      suggestions.push({
        type: 'defer',
        description: '복잡한 태스크 다음 세션으로 연기',
        estimatedSaving: 1000,
        priority: 'high',
        applicable: state.estimatedTasksRemaining < 2,
      });

      suggestions.push({
        type: 'prioritize',
        description: '필수 태스크만 우선 처리',
        estimatedSaving: 500,
        priority: 'high',
        applicable: true,
      });
    }

    // Very low tokens: suggest offload
    if (state.remainingTokens < PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE) {
      suggestions.push({
        type: 'offload',
        description: '히스토리 요약 및 새 세션 시작',
        estimatedSaving: state.usedTokens * 0.8,
        priority: 'high',
        applicable: true,
      });
    }

    return suggestions;
  }

  /**
   * Calculate optimal task count for remaining tokens
   */
  calculateOptimalTaskCount(remainingTokens: number): number {
    // Apply 80% safety margin
    const safeTokens = remainingTokens * 0.8;
    return Math.max(1, Math.floor(safeTokens / PLAN_CONFIG.TOKENS_PER_TASK_ESTIMATE));
  }

  // ==========================================================================
  // Events
  // ==========================================================================

  /**
   * Register level change callback
   */
  onLevelChange(callback: (oldLevel: QualityLevel, newLevel: QualityLevel) => void): void {
    this.levelChangeCallbacks.push(callback);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Notify all registered callbacks of level change
   */
  private notifyLevelChange(oldLevel: QualityLevel, newLevel: QualityLevel): void {
    for (const callback of this.levelChangeCallbacks) {
      try {
        callback(oldLevel, newLevel);
      } catch (error) {
        logger.error('Level change callback error', { error });
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a QualityCurve instance
 *
 * @example
 * ```typescript
 * // Without context provider
 * const curve = createQualityCurve();
 * const level = curve.getLevel(45); // QualityLevel.GOOD
 *
 * // With context provider
 * const curve = createQualityCurve(async () => ({
 *   used: contextManager.getUsedTokens(),
 *   total: contextManager.getTotalTokens(),
 * }));
 * const level = await curve.getCurrentLevel();
 * ```
 */
export function createQualityCurve(contextProvider?: ContextProvider): QualityCurve {
  return new QualityCurve(contextProvider);
}

// ============================================================================
// Default Export
// ============================================================================

export default QualityCurve;
