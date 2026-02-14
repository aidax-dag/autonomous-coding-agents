/**
 * PR Reviewer
 *
 * Automated pull request review engine that analyzes changed files
 * for size, sensitivity, test coverage, and overall risk. Produces
 * structured review results with file-level comments.
 *
 * @module core/git-workflow
 */

import type {
  PRReviewResult,
  PRReviewComment,
  ReviewDecision,
  GitWorkflowConfig,
} from './types';

// ============================================================================
// PR File Type (Input)
// ============================================================================

/**
 * Represents a single file in a pull request
 */
export interface PRFile {
  /** File path relative to repo root */
  path: string;
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** File status in the PR */
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  /** Unified diff patch (optional) */
  patch?: string;
}

// ============================================================================
// Sensitive File Patterns
// ============================================================================

const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /\.env$/i,
  /\.env\./i,
  /secrets?\./i,
  /credentials?\./i,
  /\.pem$/i,
  /\.key$/i,
  /password/i,
  /token/i,
  /private/i,
];

const TEST_FILE_PATTERNS: RegExp[] = [
  /\.test\.[jt]sx?$/i,
  /\.spec\.[jt]sx?$/i,
  /tests?\//i,
  /__tests__\//i,
];

// ============================================================================
// Strictness Thresholds
// ============================================================================

interface StrictnessThresholds {
  maxFileSize: number;
  approveMinScore: number;
  requestChangesMaxScore: number;
  requireTests: boolean;
}

const STRICTNESS_MAP: Record<string, StrictnessThresholds> = {
  lenient: {
    maxFileSize: 1000,
    approveMinScore: 50,
    requestChangesMaxScore: 20,
    requireTests: false,
  },
  standard: {
    maxFileSize: 500,
    approveMinScore: 70,
    requestChangesMaxScore: 40,
    requireTests: true,
  },
  strict: {
    maxFileSize: 300,
    approveMinScore: 85,
    requestChangesMaxScore: 60,
    requireTests: true,
  },
};

// ============================================================================
// PR Reviewer
// ============================================================================

export class PRReviewer {
  private thresholds: StrictnessThresholds;

  constructor(config: GitWorkflowConfig) {
    this.thresholds = STRICTNESS_MAP[config.reviewStrictness] ?? STRICTNESS_MAP['standard'];
  }

  /**
   * Perform an automated review of a pull request.
   */
  review(pr: { title: string; body: string; files: PRFile[] }): PRReviewResult {
    const comments = this.analyzeFiles(pr.files);
    const score = this.calculateScore(comments);
    const decision = this.determineDecision(score, comments);
    const riskLevel = this.assessRisk(pr.files);
    const summary = this.generateSummary(decision, comments, score, riskLevel);

    return {
      decision,
      summary,
      comments,
      score,
      riskLevel,
    };
  }

  // ==========================================================================
  // Analysis
  // ==========================================================================

  private analyzeFiles(files: PRFile[]): PRReviewComment[] {
    const comments: PRReviewComment[] = [];

    for (const file of files) {
      comments.push(...this.checkFileSize(file));
      comments.push(...this.checkSensitiveFiles(file));
    }

    comments.push(...this.checkTestCoverage(files));

    return comments;
  }

  /**
   * Calculate an overall score (0-100) based on review comments.
   * Starts at 100 and deducts based on severity.
   */
  private calculateScore(comments: PRReviewComment[]): number {
    let score = 100;

    for (const comment of comments) {
      switch (comment.severity) {
        case 'error':
          score -= 20;
          break;
        case 'warning':
          score -= 10;
          break;
        case 'info':
          score -= 2;
          break;
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Map the score to a review decision based on strictness thresholds.
   */
  private determineDecision(score: number, comments: PRReviewComment[]): ReviewDecision {
    const hasErrors = comments.some((c) => c.severity === 'error');

    if (hasErrors || score <= this.thresholds.requestChangesMaxScore) {
      return 'request-changes';
    }

    if (score >= this.thresholds.approveMinScore) {
      return 'approve';
    }

    return 'comment';
  }

  /**
   * Assess overall risk level based on changed files.
   */
  private assessRisk(files: PRFile[]): 'low' | 'medium' | 'high' {
    const totalChanges = files.reduce((sum, f) => sum + f.additions + f.deletions, 0);
    const hasSensitive = files.some((f) =>
      SENSITIVE_FILE_PATTERNS.some((p) => p.test(f.path)),
    );

    if (hasSensitive) return 'high';
    if (totalChanges > 1000 || files.length > 20) return 'high';
    if (totalChanges > 300 || files.length > 10) return 'medium';
    return 'low';
  }

  // ==========================================================================
  // Individual Checks
  // ==========================================================================

  /**
   * Check if a file exceeds the size threshold.
   */
  private checkFileSize(file: PRFile): PRReviewComment[] {
    const comments: PRReviewComment[] = [];
    const totalChanges = file.additions + file.deletions;

    if (totalChanges > this.thresholds.maxFileSize) {
      comments.push({
        filePath: file.path,
        line: 1,
        body: `Large file change: ${totalChanges} lines modified (threshold: ${this.thresholds.maxFileSize}). Consider breaking into smaller changes.`,
        severity: 'warning',
      });
    }

    return comments;
  }

  /**
   * Check if a file matches sensitive file patterns.
   */
  private checkSensitiveFiles(file: PRFile): PRReviewComment[] {
    const comments: PRReviewComment[] = [];

    for (const pattern of SENSITIVE_FILE_PATTERNS) {
      if (pattern.test(file.path)) {
        comments.push({
          filePath: file.path,
          line: 1,
          body: `Sensitive file detected: '${file.path}' matches pattern ${pattern}. Ensure no secrets are committed.`,
          severity: 'error',
        });
        break; // One comment per file is sufficient
      }
    }

    return comments;
  }

  /**
   * Check if source file changes are accompanied by test changes.
   */
  private checkTestCoverage(files: PRFile[]): PRReviewComment[] {
    if (!this.thresholds.requireTests) return [];

    const comments: PRReviewComment[] = [];
    const hasTestFiles = files.some((f) =>
      TEST_FILE_PATTERNS.some((p) => p.test(f.path)),
    );

    const hasSourceFiles = files.some(
      (f) =>
        !TEST_FILE_PATTERNS.some((p) => p.test(f.path)) &&
        (f.path.endsWith('.ts') ||
          f.path.endsWith('.js') ||
          f.path.endsWith('.tsx') ||
          f.path.endsWith('.jsx')),
    );

    if (hasSourceFiles && !hasTestFiles) {
      comments.push({
        filePath: 'general',
        line: 0,
        body: 'Source files were modified but no test files were included. Consider adding tests for the changes.',
        severity: 'warning',
      });
    }

    return comments;
  }

  // ==========================================================================
  // Summary
  // ==========================================================================

  /**
   * Generate a human-readable summary of the review.
   */
  private generateSummary(
    decision: ReviewDecision,
    comments: PRReviewComment[],
    score: number,
    riskLevel: 'low' | 'medium' | 'high',
  ): string {
    const errorCount = comments.filter((c) => c.severity === 'error').length;
    const warningCount = comments.filter((c) => c.severity === 'warning').length;
    const infoCount = comments.filter((c) => c.severity === 'info').length;

    const parts: string[] = [];

    switch (decision) {
      case 'approve':
        parts.push('Changes look good.');
        break;
      case 'request-changes':
        parts.push('Changes require attention before merging.');
        break;
      case 'comment':
        parts.push('Changes are acceptable with some suggestions.');
        break;
    }

    parts.push(`Score: ${score}/100. Risk: ${riskLevel}.`);

    const counts: string[] = [];
    if (errorCount > 0) counts.push(`${errorCount} error(s)`);
    if (warningCount > 0) counts.push(`${warningCount} warning(s)`);
    if (infoCount > 0) counts.push(`${infoCount} info`);
    if (counts.length > 0) {
      parts.push(`Found: ${counts.join(', ')}.`);
    }

    return parts.join(' ');
  }
}
