/**
 * QualityCurve Module Interfaces
 *
 * Provides quality level management based on context usage.
 *
 * @module core/context/interfaces
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Quality level enum
 */
export enum QualityLevel {
  PEAK = 'peak',           // 0-30%: Comprehensive, thorough
  GOOD = 'good',           // 30-50%: Confident, solid
  DEGRADING = 'degrading', // 50-70%: Efficiency mode
  POOR = 'poor',           // 70%+: Rushed, minimal
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Compression technique
 */
export interface CompressionTechnique {
  /** Technique name */
  name: string;
  /** Description */
  description: string;
  /** Applicable content types */
  applicableTo: ('code' | 'text' | 'data' | 'all')[];
  /** Expected token saving */
  tokenSaving: number;
  /** Whether enabled */
  enabled: boolean;
}

/**
 * Compression strategy
 */
export interface CompressionStrategy {
  /** Strategy name */
  name: string;
  /** Expected token reduction rate (0-1) */
  tokenReduction: number;
  /** Quality impact (0-1, higher is worse) */
  qualityImpact: number;
  /** Techniques to apply */
  techniques: CompressionTechnique[];
}

/**
 * Quality level information
 */
export interface QualityLevelInfo {
  /** Quality level */
  level: QualityLevel;
  /** Display label */
  label: string;
  /** Description */
  description: string;
  /** Range start percent */
  rangeStart: number;
  /** Range end percent */
  rangeEnd: number;
  /** Characteristics at this level */
  characteristics: string[];
  /** Recommendations for this level */
  recommendations: string[];
  /** Compression strategy for this level */
  compressionStrategy: CompressionStrategy;
}

/**
 * Context warning
 */
export interface ContextWarning {
  /** Warning type */
  type: 'usage' | 'quality' | 'budget' | 'efficiency';
  /** Severity level */
  severity: 'info' | 'warning' | 'critical';
  /** Warning message */
  message: string;
  /** Suggestion for resolving */
  suggestion?: string;
}

/**
 * Context state
 */
export interface ContextState {
  /** Total available tokens */
  totalTokens: number;
  /** Used tokens */
  usedTokens: number;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Current quality level */
  qualityLevel: QualityLevel;
  /** Remaining tokens */
  remainingTokens: number;
  /** Estimated tasks that can be completed */
  estimatedTasksRemaining: number;
  /** Whether should start new plan */
  shouldStartNewPlan: boolean;
  /** Active warnings */
  warnings: ContextWarning[];
}

/**
 * Plan recommendation
 */
export interface PlanRecommendation {
  /** Whether should start new plan */
  shouldStartNew: boolean;
  /** Reason for recommendation */
  reason?: string;
  /** Estimated tasks remaining */
  estimatedTasksRemaining: number;
  /** Predicted quality after next task */
  qualityPrediction: QualityLevel;
  /** Suggestions */
  suggestions: string[];
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  /** Suggestion type */
  type: 'compress' | 'summarize' | 'offload' | 'prioritize' | 'defer';
  /** Description */
  description: string;
  /** Estimated token saving */
  estimatedSaving: number;
  /** Priority level */
  priority: 'high' | 'medium' | 'low';
  /** Whether applicable in current state */
  applicable: boolean;
}

// ============================================================================
// Main Interface
// ============================================================================

/**
 * QualityCurve interface
 *
 * Manages quality levels based on context usage.
 */
export interface IQualityCurve {
  // Quality level operations
  /**
   * Get quality level for usage percent
   * @param usagePercent Current usage percentage (0-100)
   */
  getLevel(usagePercent: number): QualityLevel;

  /**
   * Get detailed info for quality level
   * @param level Quality level to get info for
   */
  getLevelInfo(level: QualityLevel): QualityLevelInfo;

  /**
   * Get current quality level (async, uses context provider)
   */
  getCurrentLevel(): Promise<QualityLevel>;

  // Recommendations
  /**
   * Get recommendations for quality level
   * @param level Quality level
   */
  getRecommendations(level: QualityLevel): string[];

  /**
   * Get compression strategy for quality level
   * @param level Quality level
   */
  getCompressionStrategy(level: QualityLevel): CompressionStrategy;

  /**
   * Get plan recommendation based on current state
   * @param usagePercent Current usage percentage
   * @param tasksRemaining Number of tasks remaining
   */
  getPlanRecommendation(usagePercent: number, tasksRemaining: number): PlanRecommendation;

  // State analysis
  /**
   * Analyze context state
   * @param used Used tokens
   * @param total Total tokens
   */
  analyzeContextState(used: number, total: number): ContextState;

  /**
   * Check if should start new plan
   * @param usagePercent Current usage percentage
   */
  shouldStartNewPlan(usagePercent: number): boolean;

  /**
   * Estimate quality level after additional tokens
   * @param currentUsage Current usage percentage
   * @param additionalTokens Additional tokens to use
   */
  estimateQualityDegradation(currentUsage: number, additionalTokens: number): QualityLevel;

  // Optimization
  /**
   * Suggest optimizations for current state
   * @param state Context state
   */
  suggestOptimizations(state: ContextState): OptimizationSuggestion[];

  /**
   * Calculate optimal task count for remaining tokens
   * @param remainingTokens Remaining tokens
   */
  calculateOptimalTaskCount(remainingTokens: number): number;

  // Events
  /**
   * Register level change callback
   * @param callback Function to call on level change
   */
  onLevelChange(callback: (oldLevel: QualityLevel, newLevel: QualityLevel) => void): void;
}
