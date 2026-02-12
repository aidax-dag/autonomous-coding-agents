/**
 * Learning Module
 *
 * Provides error learning and pattern-based continuous learning systems
 * for adaptive agent behavior improvement.
 *
 * Key Components:
 * - ReflexionPattern: Error-driven learning with solution caching
 * - InstinctStore: Instinct-based behavioral learning (0.3-0.9 confidence)
 * - SolutionsCache: Fast lookup cache for learned solutions
 *
 * @module core/learning
 *
 * @example
 * ```typescript
 * import {
 *   ReflexionPattern,
 *   InstinctStore,
 *   SolutionsCache,
 *   CONFIDENCE_LEVELS,
 * } from '@core/learning';
 *
 * // Error learning
 * const reflexion = new ReflexionPattern();
 * const existingSolution = await reflexion.lookup(error);
 * if (!existingSolution) {
 *   await reflexion.learn(error, solution, rootCause);
 * }
 *
 * // Instinct-based learning
 * const instinctStore = new InstinctStore();
 * const matchingInstincts = await instinctStore.findMatching(context);
 * if (userApproved) {
 *   await instinctStore.reinforce(instinctId);
 * } else {
 *   await instinctStore.correct(instinctId);
 * }
 * ```
 *
 * @see IMPROVEMENT_RECOMMENDATIONS_v2.md §3.2
 * @see CODE_STRUCTURE_IMPROVEMENT_PLAN.md §2.2
 */

// ============================================================================
// Interfaces
// ============================================================================

export {
  // Reflexion Pattern
  type LearnedSolution,
  type ReflexionResult,
  type IReflexionPattern,

  // Instinct Store
  type Instinct,
  type InstinctCreateInput,
  type InstinctDomain,
  type InstinctSource,
  type InstinctMetadata,
  type InstinctEvolution,
  type InstinctFilter,
  type InstinctStats,
  type ImportResult,
  type ConfidenceLevel,
  type IInstinctStore,

  // Solutions Cache
  type SolutionCacheEntry,
  type CachedSolution,
  type CacheSolutionMetadata,
  type CacheLookupResult,
  type CacheStats,
  type CacheConfig,
  type CacheEvent,
  type CacheEventHandler,
  type CacheEventData,
  type ISolutionsCache,

  // Constants
  CONFIDENCE_LEVELS,
  CONFIDENCE_ADJUSTMENTS,
  STORAGE_PATHS,
} from './interfaces/learning.interface';

// ============================================================================
// Implementations
// ============================================================================

export {
  ReflexionPattern,
  createReflexionPattern,
  STORAGE_CONFIG,
  type ReflexionPatternOptions,
} from './reflexion-pattern';

export {
  InstinctStore,
  createInstinctStore,
  INSTINCT_STORAGE_CONFIG,
  INITIAL_CONFIDENCE_BY_SOURCE,
  EVOLUTION_THRESHOLDS,
  MATCHING_CONFIG,
  type InstinctStoreOptions,
} from './instinct-store';

export {
  SolutionsCache,
  createSolutionsCache,
  DEFAULT_CACHE_CONFIG,
  LRU_CONFIG,
  FUZZY_MATCHING_CONFIG,
  PRUNING_CONFIG,
  type SolutionsCacheOptions,
} from './solutions-cache';

// ============================================================================
// Utility Functions (re-exported from learning-utils to maintain public API)
// ============================================================================

export {
  generateErrorSignature,
  calculateConfidenceAdjustment,
  shouldAutoApply,
  shouldSuggest,
  ERROR_CATEGORIES,
  classifyError,
  INSTINCT_DOMAINS,
} from './learning-utils';
