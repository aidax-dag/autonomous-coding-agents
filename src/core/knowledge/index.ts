/**
 * Knowledge Management Module
 *
 * Provides centralized knowledge storage and pattern matching for
 * architectural decisions, code patterns, and lessons learned.
 *
 * @module core/knowledge
 *
 * @example
 * ```typescript
 * import {
 *   KnowledgeStore,
 *   PatternMatcher,
 *   createKnowledgeStore,
 *   createPatternMatcher,
 * } from '@core/knowledge';
 *
 * // Create store
 * const store = createKnowledgeStore({ name: 'project-knowledge' });
 *
 * // Add an ADR
 * store.addADR({
 *   title: 'Use TypeScript for type safety',
 *   status: 'accepted',
 *   context: 'We need strong typing for large codebase',
 *   decision: 'Adopt TypeScript across all modules',
 *   consequences: 'Better IDE support, learning curve for team',
 * });
 *
 * // Add a pattern
 * store.addPattern({
 *   name: 'Repository Pattern',
 *   description: 'Abstract data access layer',
 *   category: 'architecture',
 *   language: 'typescript',
 *   problem: 'Direct database access couples business logic to storage',
 *   solution: 'Create repository interfaces that abstract data access',
 *   whenToUse: ['Complex data access', 'Multiple data sources'],
 *   whenNotToUse: ['Simple CRUD apps'],
 *   confidence: 'high',
 * });
 *
 * // Create matcher and find solutions
 * const matcher = createPatternMatcher(store);
 * const recommendation = matcher.recommend({
 *   description: 'Need to decouple database access from business logic',
 *   language: 'typescript',
 * });
 *
 * console.log(recommendation.primary?.title);
 * // => 'Repository Pattern'
 * ```
 */

// ============================================================================
// Knowledge Store
// ============================================================================

export {
  // Core class
  KnowledgeStore,
  createKnowledgeStore,

  // Configuration
  DEFAULT_KNOWLEDGE_STORE_CONFIG,

  // Types
  type KnowledgeType,
  type KnowledgeStatus,
  type ConfidenceLevel,
  type KnowledgeTag,
  type KnowledgeReference,
  type ADREntry,
  type PatternEntry,
  type LessonEntry,
  type KnowledgeEntry,
  type KnowledgeSearchOptions,
  type KnowledgeSearchResult,
  type KnowledgeStoreConfig,
  type KnowledgeStoreEvents,
  type KnowledgeStoreStats,
} from './knowledge-store';

// ============================================================================
// Pattern Matcher
// ============================================================================

export {
  // Core class
  PatternMatcher,
  createPatternMatcher,

  // Configuration
  DEFAULT_PATTERN_MATCHER_CONFIG,

  // Types
  type ProblemContext,
  type MatchResult,
  type Recommendation,
  type PatternMatcherConfig,
  type PatternMatcherEvents,
  type MatchStats,
} from './pattern-matcher';
