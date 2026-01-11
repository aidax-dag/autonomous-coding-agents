/**
 * Comment Checker Hook Module
 *
 * Provides detection and management of excessive/problematic comments in code.
 *
 * Feature: F3.15 - Comment Checker
 * @module core/hooks/comment-checker
 */

// Export all interfaces
export {
  // Enums
  CommentType,
  CommentIssueType,
  CommentIssueSeverity,
  SupportedLanguage,
  // Interfaces
  type LanguageCommentPattern,
  type CommentLocation,
  type ParsedComment,
  type CommentIssue,
  type CommentStatistics,
  type FileAnalysisResult,
  type CommentCheckResult,
  type AutoFixOptions,
  type CommentCheckerConfig,
  type CommentCheckerMetrics,
  type CommentCheckerEventData,
  type CommentCheckerSubscription,
  type ICommentChecker,
  // Callback types
  type CommentCheckStartedCallback,
  type CommentCheckCompletedCallback,
  type CommentIssueFoundCallback,
  type CommentFileAnalyzedCallback,
  type CommentFixAppliedCallback,
  // Constants
  DEFAULT_SEVERITY_MAP,
  LANGUAGE_PATTERNS,
  EXTENSION_TO_LANGUAGE,
  DEFAULT_COMMENT_CHECKER_CONFIG,
  DEFAULT_INCLUDE_PATTERNS,
  DEFAULT_EXCLUDE_PATTERNS,
  COMMENTED_CODE_PATTERNS,
  REDUNDANT_COMMENT_PATTERNS,
  TRIVIAL_COMMENT_PATTERNS,
} from './comment-checker.interface.js';

// Export implementation
export { CommentCheckerHook, createCommentChecker } from './comment-checker.hook.js';
