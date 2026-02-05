/**
 * Context Module
 *
 * Provides context management and quality curve functionality.
 *
 * @module core/context
 */

// ============================================================================
// Interfaces
// ============================================================================

export {
  QualityLevel,
  type QualityLevelInfo,
  type CompressionStrategy,
  type CompressionTechnique,
  type ContextState,
  type ContextWarning,
  type PlanRecommendation,
  type OptimizationSuggestion,
  type IQualityCurve,
} from './interfaces/quality-curve.interface.js';

// ============================================================================
// Constants
// ============================================================================

export {
  QUALITY_THRESHOLDS,
  QUALITY_LEVEL_INFO,
  PLAN_CONFIG,
  WARNING_TEMPLATES,
} from './constants/quality-curve.constants.js';

// ============================================================================
// Implementation
// ============================================================================

export {
  QualityCurve,
  createQualityCurve,
  type ContextProvider,
} from './quality-curve.js';
