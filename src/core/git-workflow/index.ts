/**
 * Git Workflow Module
 *
 * Provides intelligent git workflow automation including branch strategy
 * detection, merge conflict resolution, and automated PR review.
 *
 * @module core/git-workflow
 */

export {
  type BranchStrategy,
  type ConflictResolution,
  type ReviewDecision,
  type BranchRecommendation,
  type ConflictInfo,
  type ConflictResolutionResult,
  type PRReviewResult,
  type PRReviewComment,
  type GitWorkflowConfig,
  DEFAULT_GIT_WORKFLOW_CONFIG,
} from './types';

export { BranchStrategist } from './branch-strategist';

export { ConflictResolver } from './conflict-resolver';

export {
  PRReviewer,
  type PRFile,
} from './pr-reviewer';
