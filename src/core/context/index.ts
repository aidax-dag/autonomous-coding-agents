/**
 * Context Module
 *
 * Unified context management providing:
 * - Token budget management
 * - Quality curve (context usage → quality level)
 * - Output optimization and compression
 * - Event-driven monitoring
 *
 * @module core/context
 */

// ============================================================================
// Quality Curve Interfaces (F007)
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
} from './interfaces/quality-curve.interface';

// ============================================================================
// Context Module Interfaces (F008)
// ============================================================================

export type {
  // Token Budget
  TokenBudgetConfig,
  TokenUsageStats,

  // Output Optimizer
  OutputOptimizerConfig,
  CompressionLevel,
  CompressionResult,
  SummarizationRequest,
  OptimizationOptions,

  // Context Monitor
  ContextMonitorConfig,
  MonitorCallbacks,

  // Events
  ContextEvent,
  ContextEventHandler,
  ContextEventData,

  // Compaction
  CompactionStrategyType,
  CompactionRequest,
  CompactionResult,

  // Configuration
  QualityCurveConfig,
  ContextManagerConfig,

  // Component Interfaces
  ITokenBudgetManager,
  IOutputOptimizer,
  IContextMonitor,
  ICompactionStrategy,
  IContextManager,
} from './interfaces/context.interface';

// ============================================================================
// Quality Curve Constants (F007)
// ============================================================================

export {
  QUALITY_THRESHOLDS,
  QUALITY_LEVEL_INFO,
  PLAN_CONFIG,
  WARNING_TEMPLATES,
} from './constants/quality-curve.constants';

// ============================================================================
// Context Module Constants (F008)
// ============================================================================

export {
  DEFAULT_CONTEXT_CONFIG,
  COMPRESSION_LEVELS,
  MODEL_TOKEN_LIMITS,
  CHARS_PER_TOKEN,
  TOKEN_ESTIMATION,
  COMPACTION_CONFIG,
  EVENT_DEBOUNCE,
  CONTEXT_THRESHOLDS,
  type CompressionLevelConfig,
} from './constants/context.constants';

// ============================================================================
// Quality Curve Implementation (F007)
// ============================================================================

export {
  QualityCurve,
  createQualityCurve,
  type ContextProvider,
} from './quality-curve';

// ============================================================================
// Token Budget Manager (F008)
// ============================================================================

export {
  TokenBudgetManager,
  createTokenBudgetManager,
} from './token-budget-manager';

// ============================================================================
// Output Optimizer (F008)
// ============================================================================

export {
  OutputOptimizer,
  createOutputOptimizer,
} from './output-optimizer';

// ============================================================================
// Context Monitor (F008)
// ============================================================================

export {
  ContextMonitor,
  createContextMonitor,
} from './context-monitor';

// ============================================================================
// Compaction Strategy (F008)
// ============================================================================

export {
  CompactionStrategy,
  createCompactionStrategy,
} from './compaction-strategy';

// ============================================================================
// Context Manager (F008)
// ============================================================================

export {
  ContextManager,
  createContextManager,
} from './context-manager';

// ============================================================================
// Legacy Token Budget types (migrated from dx/token-budget)
// ============================================================================

export type {
  BudgetStatus,
  BudgetSubscription,
  ILegacyTokenBudgetManager,
} from './interfaces/context.interface';

// ============================================================================
// Planning Context (P1-1)
// ============================================================================

export {
  PlanningDirectory,
  createPlanningDirectory,
  StateTracker,
  createStateTracker,
  PhaseManager,
  createPhaseManager,
  ContextBudget,
  createContextBudget,
  ResearchSnapshotManager,
  createResearchSnapshot,
} from './planning-context';

export type {
  PhaseStatus,
  Phase,
  Decision,
  Blocker,
  PlanningState,
  ResearchSnapshot,
  BudgetAllocation,
  IPlanningDirectory,
  IStateTracker,
  IPhaseManager,
  IContextBudget,
  IResearchSnapshot,
} from './planning-context';

// ============================================================================
// Default Export
// ============================================================================

export { ContextManager as default } from './context-manager';
