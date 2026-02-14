/**
 * Git Workflow Types
 *
 * Defines the core types for intelligent git workflow automation
 * including branch strategy detection, conflict resolution, and
 * automated PR review.
 *
 * @module core/git-workflow
 */

// ============================================================================
// Branch Strategy
// ============================================================================

/**
 * Type of branch based on the purpose of the change
 */
export type BranchStrategy =
  | 'feature'
  | 'bugfix'
  | 'hotfix'
  | 'release'
  | 'refactor'
  | 'docs'
  | 'test';

/**
 * How a merge conflict was resolved
 */
export type ConflictResolution = 'ours' | 'theirs' | 'manual' | 'merged';

/**
 * PR review verdict
 */
export type ReviewDecision = 'approve' | 'request-changes' | 'comment';

// ============================================================================
// Branch Recommendation
// ============================================================================

/**
 * Result of branch strategy analysis with confidence scoring
 */
export interface BranchRecommendation {
  /** Detected branch strategy */
  strategy: BranchStrategy;
  /** Suggested branch name (e.g. "feature/add-user-auth") */
  branchName: string;
  /** Base branch to create from */
  baseBranch: string;
  /** Confidence in strategy detection (0-1) */
  confidence: number;
  /** Explanation for the chosen strategy */
  reasoning: string;
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/**
 * Parsed git merge conflict from a file
 */
export interface ConflictInfo {
  /** Path of the file containing the conflict */
  filePath: string;
  /** Type of conflict detected */
  conflictType: 'content' | 'rename' | 'delete' | 'binary';
  /** Content from the current branch (ours) */
  oursContent: string;
  /** Content from the incoming branch (theirs) */
  theirsContent: string;
  /** Content from the common ancestor (if available) */
  baseContent?: string;
  /** Line positions of conflict markers */
  markers: { start: number; separator: number; end: number };
}

/**
 * Result of resolving a single conflict
 */
export interface ConflictResolutionResult {
  /** Path of the resolved file */
  filePath: string;
  /** Strategy used to resolve */
  resolution: ConflictResolution;
  /** The resolved content */
  resolvedContent: string;
  /** Confidence in the resolution (0-1) */
  confidence: number;
  /** Explanation of how the conflict was resolved */
  reasoning: string;
}

// ============================================================================
// PR Review
// ============================================================================

/**
 * Complete result of an automated PR review
 */
export interface PRReviewResult {
  /** Overall review decision */
  decision: ReviewDecision;
  /** Human-readable summary of the review */
  summary: string;
  /** Individual file/line comments */
  comments: PRReviewComment[];
  /** Overall quality score (0-100) */
  score: number;
  /** Risk assessment of the changes */
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * A single review comment on a specific file/line
 */
export interface PRReviewComment {
  /** File path the comment relates to */
  filePath: string;
  /** Line number the comment targets */
  line: number;
  /** Comment body text */
  body: string;
  /** Severity of the finding */
  severity: 'info' | 'warning' | 'error';
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the git workflow system
 */
export interface GitWorkflowConfig {
  /** Default base branch for new branches (default: 'main') */
  defaultBaseBranch: string;
  /** Whether to use strategy as branch name prefix (default: true) */
  branchPrefix: boolean;
  /** Allow automatic conflict resolution (default: false) */
  autoResolveConflicts: boolean;
  /** Minimum confidence to auto-resolve a conflict (default: 0.8) */
  conflictConfidenceThreshold: number;
  /** How strict the PR reviewer should be (default: 'standard') */
  reviewStrictness: 'lenient' | 'standard' | 'strict';
}

/**
 * Default configuration values
 */
export const DEFAULT_GIT_WORKFLOW_CONFIG: GitWorkflowConfig = {
  defaultBaseBranch: 'main',
  branchPrefix: true,
  autoResolveConflicts: false,
  conflictConfidenceThreshold: 0.8,
  reviewStrictness: 'standard',
};
