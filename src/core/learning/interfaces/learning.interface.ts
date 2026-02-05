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
  domain: string;
  /** How this instinct was learned */
  source: 'session-observation' | 'repo-analysis' | 'user-correction' | 'imported';
  /** Evidence/observations that created this */
  evidence: string[];
  /** When created */
  createdAt: Date;
  /** When last updated */
  updatedAt: Date;
  /** Number of times applied */
  usageCount: number;
  /** Source repository (if from repo-analysis) */
  sourceRepo?: string;
}

/**
 * Result of instinct evolution (clustering)
 */
export interface InstinctEvolution {
  /** IDs of clustered instincts */
  clusteredInstincts: string[];
  /** What they evolved into */
  evolvedTo: 'skill' | 'command' | 'agent';
  /** ID of evolved artifact */
  evolvedId: string;
  /** Evolution timestamp */
  evolvedAt: Date;
}

/**
 * Filter for instinct queries
 */
export interface InstinctFilter {
  /** Filter by domain */
  domain?: string;
  /** Minimum confidence */
  minConfidence?: number;
  /** Filter by source */
  source?: Instinct['source'];
  /** Filter by usage count */
  minUsageCount?: number;
}

/**
 * Instinct store interface
 */
export interface IInstinctStore {
  /**
   * Create new instinct from observation
   * @param instinct Instinct data (without id, timestamps)
   * @returns Created instinct
   */
  create(instinct: Omit<Instinct, 'id' | 'createdAt' | 'updatedAt'>): Promise<Instinct>;

  /**
   * Find instincts matching context
   * @param context Current context description
   * @param domain Optional domain filter
   * @returns Matching instincts sorted by confidence
   */
  findMatching(context: string, domain?: string): Promise<Instinct[]>;

  /**
   * Reinforce instinct (increase confidence)
   * Called when instinct was applied and not corrected
   * @param id Instinct ID
   */
  reinforce(id: string): Promise<void>;

  /**
   * Correct instinct (decrease confidence)
   * Called when user explicitly corrects the behavior
   * @param id Instinct ID
   */
  correct(id: string): Promise<void>;

  /**
   * Cluster related instincts and evolve into higher-level artifact
   * @param threshold Minimum number of related instincts to cluster
   * @returns Evolution results
   */
  evolve(threshold: number): Promise<InstinctEvolution[]>;

  /**
   * Export instincts for sharing
   * @param filter Optional filter
   * @returns Filtered instincts
   */
  export(filter?: InstinctFilter): Promise<Instinct[]>;

  /**
   * Import instincts from external source
   * @param instincts Instincts to import
   */
  import(instincts: Instinct[]): Promise<void>;

  /**
   * Get instinct by ID
   */
  get(id: string): Promise<Instinct | null>;

  /**
   * List all instincts
   */
  list(filter?: InstinctFilter): Promise<Instinct[]>;

  /**
   * Delete instinct
   */
  delete(id: string): Promise<void>;
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
