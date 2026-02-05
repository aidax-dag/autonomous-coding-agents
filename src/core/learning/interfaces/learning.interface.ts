/**
 * Learning Module Interfaces
 *
 * Provides error learning and pattern-based continuous learning systems.
 *
 * @module core/learning/interfaces
 */

// ============================================================================
// Reflexion Pattern Interfaces
// ============================================================================

/**
 * Learned solution from error resolution
 */
export interface LearnedSolution {
  /** Unique identifier */
  id: string;
  /** Type/category of error */
  errorType: string;
  /** Original error message */
  errorMessage: string;
  /** Error signature (normalized hash for matching) */
  errorSignature: string;
  /** Identified root cause */
  rootCause: string;
  /** Solution that worked */
  solution: string;
  /** Prevention checklist */
  prevention: string[];
  /** When this solution was learned */
  createdAt: Date;
  /** Last time this solution was used */
  lastUsedAt?: Date;
  /** Number of successful applications */
  successCount: number;
  /** Number of failed applications */
  failureCount: number;
  /** Tags for categorization */
  tags?: string[];
}

/**
 * Result of reflexion lookup
 */
export interface ReflexionResult {
  /** Whether solution was found in cache */
  cacheHit: boolean;
  /** Found solution (if any) */
  solution?: LearnedSolution;
  /** Tokens used (0 for cache hit, 1-2K for miss) */
  tokensUsed: number;
  /** Confidence in the solution */
  confidence?: number;
}

/**
 * Reflexion pattern interface
 */
export interface IReflexionPattern {
  /**
   * Look up existing solution for error
   * @param error Error to lookup
   * @returns Learned solution if found
   */
  lookup(error: Error): Promise<LearnedSolution | null>;

  /**
   * Learn from new error resolution
   * @param error Original error
   * @param solution Solution that worked
   * @param rootCause Identified root cause
   */
  learn(error: Error, solution: string, rootCause: string): Promise<void>;

  /**
   * Get prevention checklist for error type
   * @param errorType Type of error
   * @returns Prevention checklist
   */
  getPreventionChecklist(errorType: string): string[];

  /**
   * Record outcome of solution application
   * @param solutionId Solution ID
   * @param success Whether solution worked
   */
  recordOutcome(solutionId: string, success: boolean): Promise<void>;

  /**
   * Get statistics
   */
  getStats(): Promise<{
    totalSolutions: number;
    totalLookups: number;
    cacheHitRate: number;
    avgSuccessRate: number;
  }>;
}

// ============================================================================
// Instinct Store Interfaces
// ============================================================================

/**
 * Instinct domain types
 */
export type InstinctDomain =
  | 'code-style'
  | 'testing'
  | 'git'
  | 'documentation'
  | 'architecture'
  | 'debugging'
  | 'performance'
  | 'security'
  | 'workflow'
  | 'communication'
  | 'custom';

/**
 * Instinct source types
 */
export type InstinctSource =
  | 'session-observation'
  | 'repo-analysis'
  | 'user-correction'
  | 'explicit-teaching'
  | 'pattern-inference'
  | 'imported';

/**
 * Instinct metadata
 */
export interface InstinctMetadata {
  /** Project context */
  projectContext?: string;
  /** Related languages */
  languageContext?: string[];
  /** Related frameworks */
  frameworkContext?: string[];
  /** Tags */
  tags?: string[];
  /** Notes */
  notes?: string;
  /** Related instinct IDs */
  relatedInstincts?: string[];
}

/**
 * Instinct - atomic learned behavior with confidence scoring
 */
export interface Instinct {
  /** Unique identifier */
  id: string;
  /** When to apply this instinct */
  trigger: string;
  /** What action to take */
  action: string;
  /** Confidence level (0.3-0.9) */
  confidence: number;
  /** Domain/category */
  domain: InstinctDomain;
  /** How this instinct was learned */
  source: InstinctSource;
  /** Evidence/observations that created this */
  evidence: string[];
  /** When created */
  createdAt: Date;
  /** When last updated */
  updatedAt: Date;
  /** Number of times applied */
  usageCount: number;
  /** Number of successful applications */
  successCount: number;
  /** Number of failed applications */
  failureCount: number;
  /** When last used */
  lastUsedAt?: Date;
  /** Additional metadata */
  metadata?: InstinctMetadata;
  /** Source repository (if from repo-analysis) */
  sourceRepo?: string;
}

/**
 * Result of instinct evolution (clustering)
 */
export interface InstinctEvolution {
  /** What type of artifact this evolved into */
  type: 'skill' | 'command' | 'agent';
  /** IDs of source instincts */
  sourceInstincts: string[];
  /** Suggested name for the evolved artifact */
  suggestedName: string;
  /** Suggested description */
  suggestedDescription: string;
  /** Average confidence of source instincts */
  confidence: number;
  /** Extracted common pattern */
  pattern: string;
  /** Evolution timestamp */
  createdAt: Date;
}

/**
 * Filter for instinct queries
 */
export interface InstinctFilter {
  /** Filter by domain */
  domain?: InstinctDomain | InstinctDomain[];
  /** Filter by source */
  source?: InstinctSource | InstinctSource[];
  /** Minimum confidence */
  minConfidence?: number;
  /** Maximum confidence */
  maxConfidence?: number;
  /** Filter by usage count */
  minUsageCount?: number;
  /** Created after date */
  createdAfter?: Date;
  /** Created before date */
  createdBefore?: Date;
  /** Search text in trigger/action */
  searchText?: string;
  /** Filter by tags */
  tags?: string[];
}

/**
 * Import result
 */
export interface ImportResult {
  /** Number of imported instincts */
  imported: number;
  /** Number of skipped instincts */
  skipped: number;
  /** Number of merged instincts */
  merged: number;
  /** Error messages */
  errors: string[];
}

/**
 * Instinct statistics
 */
export interface InstinctStats {
  /** Total instincts */
  total: number;
  /** Count by domain */
  byDomain: Partial<Record<InstinctDomain, number>>;
  /** Count by source */
  bySource: Partial<Record<InstinctSource, number>>;
  /** Count by confidence level */
  byConfidenceLevel: Partial<Record<ConfidenceLevel, number>>;
  /** Average confidence */
  averageConfidence: number;
  /** Total usage count */
  totalUsageCount: number;
  /** Success rate */
  successRate: number;
  /** Number of evolution candidates */
  evolutionCandidates: number;
}

/**
 * Confidence level type
 */
export type ConfidenceLevel = keyof typeof CONFIDENCE_LEVELS;

/**
 * Input type for creating an instinct
 * confidence is optional (defaults based on source)
 */
export type InstinctCreateInput = {
  trigger: string;
  action: string;
  confidence?: number;
  domain: InstinctDomain;
  source: InstinctSource;
  evidence: string[];
  metadata?: InstinctMetadata;
  sourceRepo?: string;
};

/**
 * Instinct store interface
 */
export interface IInstinctStore {
  // CRUD operations
  /**
   * Create new instinct from observation
   * @param instinct Instinct data (confidence is optional, defaults based on source)
   * @returns Created instinct
   */
  create(instinct: InstinctCreateInput): Promise<Instinct>;

  /**
   * Get instinct by ID
   */
  get(id: string): Promise<Instinct | null>;

  /**
   * Update instinct
   * @param id Instinct ID
   * @param updates Partial updates
   * @returns Updated instinct or null if not found
   */
  update(id: string, updates: Partial<Omit<Instinct, 'id' | 'createdAt'>>): Promise<Instinct | null>;

  /**
   * Delete instinct
   */
  delete(id: string): Promise<boolean>;

  // Search and matching
  /**
   * Find instincts matching context
   * @param context Current context description
   * @param domain Optional domain filter
   * @returns Matching instincts sorted by confidence
   */
  findMatching(context: string, domain?: InstinctDomain): Promise<Instinct[]>;

  /**
   * List instincts by filter
   */
  list(filter?: InstinctFilter): Promise<Instinct[]>;

  // Confidence adjustment
  /**
   * Reinforce instinct (increase confidence by +0.05)
   * Called when instinct was applied and not corrected
   * @param id Instinct ID
   * @returns Updated instinct or null if not found
   */
  reinforce(id: string): Promise<Instinct | null>;

  /**
   * Correct instinct (decrease confidence by -0.10)
   * Called when user explicitly corrects the behavior
   * @param id Instinct ID
   * @returns Updated instinct or null if not found
   */
  correct(id: string): Promise<Instinct | null>;

  // Usage recording
  /**
   * Record usage of instinct
   * @param id Instinct ID
   * @param success Whether the usage was successful
   */
  recordUsage(id: string, success: boolean): Promise<void>;

  // Evolution mechanism
  /**
   * Cluster related instincts and evolve into higher-level artifact
   * @param threshold Minimum confidence threshold for evolution
   * @returns Evolution results
   */
  evolve(threshold?: number): Promise<InstinctEvolution[]>;

  // Export/Import
  /**
   * Export instincts for sharing
   * @param filter Optional filter
   * @returns Filtered instincts
   */
  export(filter?: InstinctFilter): Promise<Instinct[]>;

  /**
   * Import instincts from external source
   * @param instincts Instincts to import
   * @returns Import result
   */
  import(instincts: Instinct[]): Promise<ImportResult>;

  // Statistics
  /**
   * Get instinct statistics
   */
  getStats(): Promise<InstinctStats>;

  /**
   * Get confidence distribution
   */
  getConfidenceDistribution(): Promise<Map<ConfidenceLevel, number>>;
}

// ============================================================================
// Solutions Cache Interfaces
// ============================================================================

/**
 * Cache entry for quick solution lookup
 */
export interface SolutionCacheEntry {
  /** Error signature (hash) */
  errorSignature: string;
  /** Solution ID reference */
  solutionId: string;
  /** Last access time */
  lastAccess: Date;
  /** Access count */
  accessCount: number;
}

/**
 * Solutions cache interface
 */
export interface ISolutionsCache {
  /**
   * Get solution from cache
   * @param errorSignature Error signature/hash
   * @returns Solution ID if cached
   */
  get(errorSignature: string): Promise<string | null>;

  /**
   * Set solution in cache
   * @param errorSignature Error signature/hash
   * @param solutionId Solution ID
   */
  set(errorSignature: string, solutionId: string): Promise<void>;

  /**
   * Invalidate cache entry
   * @param errorSignature Error signature/hash
   */
  invalidate(errorSignature: string): Promise<void>;

  /**
   * Clear entire cache
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): Promise<{
    size: number;
    hitRate: number;
    avgAccessCount: number;
  }>;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Confidence level thresholds
 */
export const CONFIDENCE_LEVELS = {
  /** Tentative - suggested but not enforced */
  TENTATIVE: 0.3,
  /** Moderate - applied when relevant */
  MODERATE: 0.5,
  /** Strong - auto-approved for application */
  STRONG: 0.7,
  /** Near-certain - core behavior */
  NEAR_CERTAIN: 0.9,
} as const;

/**
 * Confidence adjustment values
 */
export const CONFIDENCE_ADJUSTMENTS = {
  /** Amount to increase on reinforcement */
  REINFORCE_INCREMENT: 0.05,
  /** Amount to decrease on correction */
  CORRECT_DECREMENT: 0.1,
  /** Decay rate per day of non-use */
  DECAY_RATE: 0.01,
  /** Minimum confidence before deletion */
  MIN_CONFIDENCE: 0.2,
} as const;

/**
 * Default storage paths
 */
export const STORAGE_PATHS = {
  /** Solutions learned file */
  SOLUTIONS_FILE: 'docs/memory/solutions_learned.jsonl',
  /** Personal instincts directory */
  INSTINCTS_PERSONAL: '~/.claude/homunculus/instincts/personal/',
  /** Inherited instincts directory */
  INSTINCTS_INHERITED: '~/.claude/homunculus/instincts/inherited/',
  /** Evolved artifacts directory */
  EVOLVED_DIR: '~/.claude/homunculus/evolved/',
} as const;
