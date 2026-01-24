/**
 * Comment Checker Hook Implementation
 *
 * Detects and manages excessive/problematic comments in code.
 *
 * Feature: F3.15 - Comment Checker
 * @module core/hooks/comment-checker
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { BaseHook } from '../base-hook.js';
import { HookEvent, HookContext, HookResult } from '../../interfaces/hook.interface.js';
import { IDisposable } from '../../di/interfaces/container.interface.js';
import { createLogger, ILogger } from '../../services/logger.js';
import {
  CommentCheckerConfig,
  CommentType,
  CommentIssueType,
  CommentIssueSeverity,
  SupportedLanguage,
  ParsedComment,
  CommentIssue,
  CommentStatistics,
  FileAnalysisResult,
  CommentCheckResult,
  CommentCheckerMetrics,
  CommentCheckerEventData,
  AutoFixOptions,
  ICommentChecker,
  CommentCheckerSubscription,
  CommentCheckStartedCallback,
  CommentCheckCompletedCallback,
  CommentIssueFoundCallback,
  CommentFileAnalyzedCallback,
  DEFAULT_COMMENT_CHECKER_CONFIG,
  DEFAULT_SEVERITY_MAP,
  LANGUAGE_PATTERNS,
  EXTENSION_TO_LANGUAGE,
  COMMENTED_CODE_PATTERNS,
  REDUNDANT_COMMENT_PATTERNS,
  TRIVIAL_COMMENT_PATTERNS,
} from './comment-checker.interface.js';

/**
 * Comment Checker Hook
 *
 * Analyzes code files for comment quality issues.
 */
export class CommentCheckerHook
  extends BaseHook<unknown, CommentCheckerEventData>
  implements ICommentChecker, IDisposable
{
  readonly name = 'comment-checker';
  readonly description = 'Detects excessive and problematic comments';
  readonly event = HookEvent.TASK_BEFORE;

  private readonly config: Required<
    Omit<
      CommentCheckerConfig,
      | 'name'
      | 'description'
      | 'event'
      | 'conditions'
      | 'severityOverrides'
      | 'autoFix'
      | 'ticketPatterns'
      | 'includePatterns'
      | 'excludePatterns'
    >
  >;
  private readonly severityMap: Record<CommentIssueType, CommentIssueSeverity>;
  private readonly autoFixOptions?: AutoFixOptions;
  private readonly ticketPatterns: RegExp[];

  private metrics: CommentCheckerMetrics;
  private disposed = false;
  private readonly logger: ILogger;

  // Event subscriptions
  private checkStartedCallbacks: Map<string, CommentCheckStartedCallback> = new Map();
  private checkCompletedCallbacks: Map<string, CommentCheckCompletedCallback> = new Map();
  private issueFoundCallbacks: Map<string, CommentIssueFoundCallback> = new Map();
  private fileAnalyzedCallbacks: Map<string, CommentFileAnalyzedCallback> = new Map();

  constructor(userConfig?: CommentCheckerConfig) {
    const mergedConfig = {
      ...DEFAULT_COMMENT_CHECKER_CONFIG,
      ...userConfig,
    };
    super(mergedConfig);

    this.config = mergedConfig;
    this.severityMap = {
      ...DEFAULT_SEVERITY_MAP,
      ...userConfig?.severityOverrides,
    };
    this.autoFixOptions = userConfig?.autoFix;
    this.ticketPatterns = (userConfig?.ticketPatterns || []).map((p) => new RegExp(p, 'i'));

    this.metrics = this.createEmptyMetrics();
    this.logger = createLogger('CommentChecker');
  }

  /**
   * Execute the hook
   */
  async execute(context: HookContext<unknown>): Promise<HookResult<CommentCheckerEventData>> {
    if (this.disposed) {
      return this.abort('Comment checker has been disposed');
    }

    // Extract files from context
    const files = this.extractFilesFromContext(context);

    if (files.length === 0) {
      return this.continue(undefined, 'No files to check');
    }

    try {
      const result = await this.analyze(files);

      const eventData: CommentCheckerEventData = {
        result,
        metrics: this.getMetrics(),
        files,
      };

      // Check if we should abort based on issues
      if (!result.passed && result.issuesBySeverity[CommentIssueSeverity.ERROR] > 0) {
        return this.abort('Comment check failed with errors');
      }

      return this.continue(eventData, `Analyzed ${result.filesAnalyzed} files`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return this.abort(`Comment check failed: ${message}`);
    }
  }

  /**
   * Analyze files for comment issues
   */
  async analyze(files: string[]): Promise<CommentCheckResult> {
    const startedAt = new Date();

    // Notify subscribers
    this.emitCheckStarted(files);

    const fileResults: FileAnalysisResult[] = [];
    const fixedFiles: string[] = [];
    let totalFixed = 0;

    for (const file of files) {
      try {
        const result = await this.analyzeFile(file);
        fileResults.push(result);

        // Emit file analyzed event
        this.emitFileAnalyzed(result);

        // Auto-fix if enabled
        if (this.autoFixOptions && !this.autoFixOptions.dryRun) {
          const fixed = await this.fixFile(file, result.issues);
          if (fixed > 0) {
            fixedFiles.push(file);
            totalFixed += fixed;
          }
        }
      } catch (error) {
        // Log error but continue with other files
        if (this.config.verbose) {
          this.logger.error(`Error analyzing ${file}`, { error });
        }
      }
    }

    const completedAt = new Date();

    // Calculate totals
    const issuesBySeverity: Record<CommentIssueSeverity, number> = {
      [CommentIssueSeverity.ERROR]: 0,
      [CommentIssueSeverity.WARNING]: 0,
      [CommentIssueSeverity.INFO]: 0,
      [CommentIssueSeverity.SUGGESTION]: 0,
    };

    const issuesByType: Record<CommentIssueType, number> = {
      [CommentIssueType.REDUNDANT]: 0,
      [CommentIssueType.VERBOSE]: 0,
      [CommentIssueType.OUTDATED]: 0,
      [CommentIssueType.EXCESSIVE_BLOCK]: 0,
      [CommentIssueType.HIGH_DENSITY]: 0,
      [CommentIssueType.TRIVIAL]: 0,
      [CommentIssueType.COMMENTED_CODE]: 0,
      [CommentIssueType.NONSTANDARD_FORMAT]: 0,
      [CommentIssueType.MISSING_DOC]: 0,
      [CommentIssueType.UNTRACKED_TODO]: 0,
    };

    let totalIssues = 0;
    for (const result of fileResults) {
      for (const issue of result.issues) {
        issuesBySeverity[issue.severity]++;
        issuesByType[issue.type]++;
        totalIssues++;

        // Emit issue found event
        this.emitIssueFound(issue);
      }
    }

    const passed =
      issuesBySeverity[CommentIssueSeverity.ERROR] === 0 &&
      issuesBySeverity[CommentIssueSeverity.WARNING] === 0;

    const checkResult: CommentCheckResult = {
      passed,
      filesAnalyzed: fileResults.length,
      filesWithIssues: fileResults.filter((r) => r.issues.length > 0).length,
      totalIssues,
      issuesBySeverity,
      issuesByType,
      fileResults,
      fixedFiles,
      totalFixed,
      startedAt,
      completedAt,
      durationMs: completedAt.getTime() - startedAt.getTime(),
    };

    // Update metrics
    this.updateMetrics(checkResult);

    // Notify subscribers
    this.emitCheckCompleted(checkResult);

    return checkResult;
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(file: string): Promise<FileAnalysisResult> {
    const startTime = Date.now();
    const language = this.detectLanguage(file);

    let content: string;
    try {
      content = await fs.promises.readFile(file, 'utf-8');
    } catch {
      return {
        file,
        language,
        comments: [],
        issues: [],
        statistics: this.createEmptyStatistics(),
        analyzedAt: new Date(),
        analysisTimeMs: Date.now() - startTime,
      };
    }

    const comments = this.parseComments(content, language);
    const statistics = this.calculateStatistics(content, comments);
    const issues = this.detectIssues(file, content, comments, statistics);

    return {
      file,
      language,
      comments,
      issues,
      statistics,
      analyzedAt: new Date(),
      analysisTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Auto-fix comment issues
   */
  async fix(files: string[], options?: AutoFixOptions): Promise<CommentCheckResult> {
    const mergedOptions: AutoFixOptions = {
      ...this.autoFixOptions,
      ...options,
    };

    // Temporarily set auto-fix options
    const originalOptions = this.autoFixOptions;
    (this as unknown as { autoFixOptions: AutoFixOptions }).autoFixOptions = mergedOptions;

    const result = await this.analyze(files);

    // Restore original options
    (this as unknown as { autoFixOptions: AutoFixOptions | undefined }).autoFixOptions = originalOptions;

    return result;
  }

  /**
   * Get comment statistics for a file
   */
  async getStatistics(file: string): Promise<CommentStatistics> {
    const result = await this.analyzeFile(file);
    return result.statistics;
  }

  /**
   * Parse comments from content
   */
  parseComments(content: string, language: SupportedLanguage): ParsedComment[] {
    const comments: ParsedComment[] = [];
    const lines = content.split('\n');
    const patterns = LANGUAGE_PATTERNS[language];

    let inMultiLineComment = false;
    let multiLineStart = -1;
    let multiLineContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Handle multi-line comments
      if (patterns.multiLineStart && patterns.multiLineEnd) {
        if (inMultiLineComment) {
          multiLineContent += (multiLineContent ? '\n' : '') + line;
          const endIndex = line.indexOf(patterns.multiLineEnd);
          if (endIndex !== -1) {
            // End of multi-line comment
            const commentType = this.isDocComment(multiLineContent, patterns)
              ? CommentType.DOC_COMMENT
              : CommentType.MULTI_LINE;

            comments.push({
              id: randomUUID(),
              type: commentType,
              raw: multiLineContent,
              content: this.extractCommentContent(multiLineContent, patterns),
              location: {
                file: '',
                startLine: multiLineStart,
                endLine: lineNum,
                startColumn: 1,
                endColumn: endIndex + patterns.multiLineEnd.length + 1,
              },
              language,
            });

            inMultiLineComment = false;
            multiLineContent = '';
          }
          continue;
        }

        const multiStartIndex = line.indexOf(patterns.multiLineStart);
        if (multiStartIndex !== -1) {
          const multiEndIndex = line.indexOf(patterns.multiLineEnd, multiStartIndex + patterns.multiLineStart.length);
          if (multiEndIndex !== -1) {
            // Single-line multi-line comment (e.g., /* comment */)
            const raw = line.substring(multiStartIndex, multiEndIndex + patterns.multiLineEnd.length);
            const commentType = this.isDocComment(raw, patterns)
              ? CommentType.DOC_COMMENT
              : CommentType.MULTI_LINE;

            comments.push({
              id: randomUUID(),
              type: commentType,
              raw,
              content: this.extractCommentContent(raw, patterns),
              location: {
                file: '',
                startLine: lineNum,
                endLine: lineNum,
                startColumn: multiStartIndex + 1,
                endColumn: multiEndIndex + patterns.multiLineEnd.length + 1,
              },
              language,
            });
          } else {
            // Start of multi-line comment
            inMultiLineComment = true;
            multiLineStart = lineNum;
            multiLineContent = line.substring(multiStartIndex);
          }
          continue;
        }
      }

      // Handle single-line comments
      for (const prefix of patterns.singleLine) {
        const commentIndex = this.findCommentStart(line, prefix);
        if (commentIndex !== -1) {
          const raw = line.substring(commentIndex);
          const codeBeforeComment = line.substring(0, commentIndex).trim();
          const isInline = codeBeforeComment.length > 0;

          // Check for doc comments (e.g., /// in Rust/C#)
          let commentType: CommentType;
          if (patterns.docStart && raw.startsWith(patterns.docStart)) {
            commentType = CommentType.DOC_COMMENT;
          } else if (this.isTodoComment(raw)) {
            commentType = CommentType.TODO;
          } else if (this.isLicenseComment(raw, lineNum)) {
            commentType = CommentType.LICENSE;
          } else if (isInline) {
            commentType = CommentType.INLINE;
          } else {
            commentType = CommentType.SINGLE_LINE;
          }

          comments.push({
            id: randomUUID(),
            type: commentType,
            raw,
            content: raw.substring(prefix.length).trim(),
            location: {
              file: '',
              startLine: lineNum,
              endLine: lineNum,
              startColumn: commentIndex + 1,
              endColumn: line.length + 1,
            },
            associatedCode: isInline ? codeBeforeComment : this.getNextCodeLine(lines, i),
            language,
          });
          break;
        }
      }
    }

    // Handle Python docstrings
    if (language === SupportedLanguage.PYTHON && patterns.altDocFormats) {
      const docstrings = this.parsePythonDocstrings(content, language);
      comments.push(...docstrings);
    }

    return comments;
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(file: string): SupportedLanguage {
    const ext = path.extname(file).toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] || SupportedLanguage.UNKNOWN;
  }

  /**
   * Get current metrics
   */
  getMetrics(): CommentCheckerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.createEmptyMetrics();
  }

  /**
   * Subscribe to check started events
   */
  onCheckStarted(callback: CommentCheckStartedCallback): CommentCheckerSubscription {
    const id = randomUUID();
    this.checkStartedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => this.checkStartedCallbacks.delete(id),
    };
  }

  /**
   * Subscribe to check completed events
   */
  onCheckCompleted(callback: CommentCheckCompletedCallback): CommentCheckerSubscription {
    const id = randomUUID();
    this.checkCompletedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => this.checkCompletedCallbacks.delete(id),
    };
  }

  /**
   * Subscribe to issue found events
   */
  onIssueFound(callback: CommentIssueFoundCallback): CommentCheckerSubscription {
    const id = randomUUID();
    this.issueFoundCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => this.issueFoundCallbacks.delete(id),
    };
  }

  /**
   * Subscribe to file analyzed events
   */
  onFileAnalyzed(callback: CommentFileAnalyzedCallback): CommentCheckerSubscription {
    const id = randomUUID();
    this.fileAnalyzedCallbacks.set(id, callback);
    return {
      id,
      unsubscribe: () => this.fileAnalyzedCallbacks.delete(id),
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.disposed = true;
    this.checkStartedCallbacks.clear();
    this.checkCompletedCallbacks.clear();
    this.issueFoundCallbacks.clear();
    this.fileAnalyzedCallbacks.clear();
  }

  // === Private Methods ===

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): CommentCheckerMetrics {
    return {
      totalChecks: 0,
      totalFilesAnalyzed: 0,
      totalCommentsAnalyzed: 0,
      totalIssuesFound: 0,
      totalIssuesFixed: 0,
      issuesByType: {
        [CommentIssueType.REDUNDANT]: 0,
        [CommentIssueType.VERBOSE]: 0,
        [CommentIssueType.OUTDATED]: 0,
        [CommentIssueType.EXCESSIVE_BLOCK]: 0,
        [CommentIssueType.HIGH_DENSITY]: 0,
        [CommentIssueType.TRIVIAL]: 0,
        [CommentIssueType.COMMENTED_CODE]: 0,
        [CommentIssueType.NONSTANDARD_FORMAT]: 0,
        [CommentIssueType.MISSING_DOC]: 0,
        [CommentIssueType.UNTRACKED_TODO]: 0,
      },
      averageCommentDensity: 0,
      averageCommentRatio: 0,
      totalAnalysisTimeMs: 0,
    };
  }

  /**
   * Create empty statistics
   */
  private createEmptyStatistics(): CommentStatistics {
    return {
      totalComments: 0,
      byType: {
        [CommentType.SINGLE_LINE]: 0,
        [CommentType.MULTI_LINE]: 0,
        [CommentType.DOC_COMMENT]: 0,
        [CommentType.TODO]: 0,
        [CommentType.LICENSE]: 0,
        [CommentType.INLINE]: 0,
      },
      totalCommentLines: 0,
      totalCodeLines: 0,
      commentDensity: 0,
      commentToCodeRatio: 0,
      averageCommentLength: 0,
      longestCommentBlock: 0,
    };
  }

  /**
   * Calculate comment statistics
   */
  private calculateStatistics(content: string, comments: ParsedComment[]): CommentStatistics {
    const lines = content.split('\n');
    const byType: Record<CommentType, number> = {
      [CommentType.SINGLE_LINE]: 0,
      [CommentType.MULTI_LINE]: 0,
      [CommentType.DOC_COMMENT]: 0,
      [CommentType.TODO]: 0,
      [CommentType.LICENSE]: 0,
      [CommentType.INLINE]: 0,
    };

    let totalCommentLines = 0;
    let totalCommentLength = 0;
    let longestCommentBlock = 0;

    for (const comment of comments) {
      byType[comment.type]++;
      const commentLines = comment.location.endLine - comment.location.startLine + 1;
      totalCommentLines += commentLines;
      totalCommentLength += comment.content.length;
      longestCommentBlock = Math.max(longestCommentBlock, commentLines);
    }

    // Calculate code lines (non-empty, non-comment lines)
    const commentLineNumbers = new Set<number>();
    for (const comment of comments) {
      for (let i = comment.location.startLine; i <= comment.location.endLine; i++) {
        commentLineNumbers.add(i);
      }
    }

    let totalCodeLines = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0 && !commentLineNumbers.has(i + 1)) {
        totalCodeLines++;
      }
    }

    const totalLines = lines.filter((l) => l.trim().length > 0).length;
    const commentDensity = totalLines > 0 ? totalCommentLines / totalLines : 0;
    const commentToCodeRatio = totalCodeLines > 0 ? totalCommentLines / totalCodeLines : 0;
    const averageCommentLength = comments.length > 0 ? totalCommentLength / comments.length : 0;

    return {
      totalComments: comments.length,
      byType,
      totalCommentLines,
      totalCodeLines,
      commentDensity,
      commentToCodeRatio,
      averageCommentLength,
      longestCommentBlock,
    };
  }

  /**
   * Detect issues in comments
   */
  private detectIssues(
    file: string,
    _content: string,
    comments: ParsedComment[],
    statistics: CommentStatistics
  ): CommentIssue[] {
    const issues: CommentIssue[] = [];

    // Check high density
    if (statistics.commentDensity > this.config.maxCommentDensity) {
      issues.push(this.createIssue(
        CommentIssueType.HIGH_DENSITY,
        `Comment density ${(statistics.commentDensity * 100).toFixed(1)}% exceeds maximum ${(this.config.maxCommentDensity * 100).toFixed(1)}%`,
        comments[0] || this.createPlaceholderComment(file),
        0.9
      ));
    }

    // Check comment-to-code ratio
    if (statistics.commentToCodeRatio > this.config.maxCommentRatio) {
      issues.push(this.createIssue(
        CommentIssueType.HIGH_DENSITY,
        `Comment-to-code ratio ${statistics.commentToCodeRatio.toFixed(2)} exceeds maximum ${this.config.maxCommentRatio}`,
        comments[0] || this.createPlaceholderComment(file),
        0.85
      ));
    }

    // Check individual comments
    for (const comment of comments) {
      // Update file in location
      comment.location.file = file;

      // Check for trivial comments
      if (this.isTrivialComment(comment)) {
        issues.push(this.createIssue(
          CommentIssueType.TRIVIAL,
          'Empty or trivial comment',
          comment,
          0.95,
          'Remove this trivial comment'
        ));
        continue;
      }

      // Check for commented-out code
      if (this.config.checkCommentedCode && this.isCommentedCode(comment)) {
        issues.push(this.createIssue(
          CommentIssueType.COMMENTED_CODE,
          'Appears to be commented-out code',
          comment,
          0.7,
          'Remove commented-out code or convert to proper comment'
        ));
      }

      // Check for redundant comments
      if (this.config.checkRedundant && comment.associatedCode) {
        const redundancy = this.checkRedundancy(comment);
        if (redundancy) {
          issues.push(this.createIssue(
            CommentIssueType.REDUNDANT,
            redundancy,
            comment,
            0.75,
            'Remove redundant comment'
          ));
        }
      }

      // Check for verbose comments
      if (this.config.checkVerbose && comment.content.length > this.config.verboseCommentThreshold) {
        issues.push(this.createIssue(
          CommentIssueType.VERBOSE,
          `Comment is ${comment.content.length} characters (threshold: ${this.config.verboseCommentThreshold})`,
          comment,
          0.6,
          'Consider shortening this comment'
        ));
      }

      // Check for untracked TODOs
      if (this.config.requireTicketForTodo && comment.type === CommentType.TODO) {
        if (!this.hasTicketReference(comment)) {
          issues.push(this.createIssue(
            CommentIssueType.UNTRACKED_TODO,
            'TODO comment without ticket reference',
            comment,
            0.8,
            'Add a ticket reference (e.g., JIRA-123)'
          ));
        }
      }
    }

    // Check for excessive consecutive comment blocks
    const consecutiveBlocks = this.findConsecutiveCommentBlocks(comments);
    for (const block of consecutiveBlocks) {
      if (block.length > this.config.maxConsecutiveCommentLines) {
        issues.push(this.createIssue(
          CommentIssueType.EXCESSIVE_BLOCK,
          `${block.length} consecutive comment lines (max: ${this.config.maxConsecutiveCommentLines})`,
          block[0],
          0.7,
          'Consider restructuring or summarizing this comment block'
        ));
      }
    }

    return issues;
  }

  /**
   * Create an issue
   */
  private createIssue(
    type: CommentIssueType,
    message: string,
    comment: ParsedComment,
    confidence: number,
    suggestion?: string
  ): CommentIssue {
    return {
      id: randomUUID(),
      type,
      severity: this.severityMap[type],
      message,
      comment,
      suggestion,
      confidence,
    };
  }

  /**
   * Create placeholder comment for file-level issues
   */
  private createPlaceholderComment(file: string): ParsedComment {
    return {
      id: randomUUID(),
      type: CommentType.SINGLE_LINE,
      raw: '',
      content: '',
      location: {
        file,
        startLine: 1,
        endLine: 1,
        startColumn: 1,
        endColumn: 1,
      },
      language: this.detectLanguage(file),
    };
  }

  /**
   * Check if comment is trivial
   */
  private isTrivialComment(comment: ParsedComment): boolean {
    const content = comment.content.trim();

    // Check against trivial patterns
    for (const pattern of TRIVIAL_COMMENT_PATTERNS) {
      if (pattern.test(comment.raw)) {
        return true;
      }
    }

    // Empty content
    if (content.length === 0) {
      return true;
    }

    // Very short meaningless content
    if (content.length <= 2 && !/\w/.test(content)) {
      return true;
    }

    return false;
  }

  /**
   * Check if comment is commented-out code
   */
  private isCommentedCode(comment: ParsedComment): boolean {
    const content = comment.content.trim();

    // Skip TODO comments
    if (comment.type === CommentType.TODO) {
      return false;
    }

    // Skip doc comments
    if (comment.type === CommentType.DOC_COMMENT) {
      return false;
    }

    // Check against code patterns
    for (const pattern of COMMENTED_CODE_PATTERNS) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check for redundant comment
   */
  private checkRedundancy(comment: ParsedComment): string | null {
    if (!comment.associatedCode) {
      return null;
    }

    const content = comment.content.toLowerCase();
    const code = comment.associatedCode.toLowerCase();

    for (const { pattern, codePattern } of REDUNDANT_COMMENT_PATTERNS) {
      if (pattern.test(content)) {
        if (!codePattern || codePattern.test(code)) {
          return 'Comment duplicates what the code already expresses';
        }
      }
    }

    // Check if comment just repeats variable/function names
    const words = content.split(/\s+/).filter((w) => w.length > 3);
    const codeWords = code.split(/[^a-zA-Z0-9]+/).filter((w) => w.length > 3);
    const overlap = words.filter((w) => codeWords.includes(w.toLowerCase()));

    if (words.length > 0 && overlap.length / words.length > 0.8) {
      return 'Comment mostly repeats identifiers from code';
    }

    return null;
  }

  /**
   * Check if comment has ticket reference
   */
  private hasTicketReference(comment: ParsedComment): boolean {
    const content = comment.content;

    for (const pattern of this.ticketPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    // Default patterns if none specified
    if (this.ticketPatterns.length === 0) {
      const defaultPatterns = [
        /[A-Z]+-\d+/,        // JIRA-123
        /#\d+/,             // GitHub #123
        /GH-\d+/,           // GH-123
        /BUG-\d+/,          // BUG-123
        /TICKET-\d+/,       // TICKET-123
      ];

      for (const pattern of defaultPatterns) {
        if (pattern.test(content)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Find consecutive comment blocks
   */
  private findConsecutiveCommentBlocks(comments: ParsedComment[]): ParsedComment[][] {
    const blocks: ParsedComment[][] = [];
    const sortedComments = [...comments].sort(
      (a, b) => a.location.startLine - b.location.startLine
    );

    let currentBlock: ParsedComment[] = [];

    for (const comment of sortedComments) {
      // Skip multi-line and doc comments (they're intentionally long)
      if (comment.type === CommentType.MULTI_LINE || comment.type === CommentType.DOC_COMMENT) {
        if (currentBlock.length > 0) {
          blocks.push(currentBlock);
          currentBlock = [];
        }
        continue;
      }

      if (currentBlock.length === 0) {
        currentBlock.push(comment);
      } else {
        const lastComment = currentBlock[currentBlock.length - 1];
        if (comment.location.startLine <= lastComment.location.endLine + 1) {
          currentBlock.push(comment);
        } else {
          if (currentBlock.length > 1) {
            blocks.push(currentBlock);
          }
          currentBlock = [comment];
        }
      }
    }

    if (currentBlock.length > 1) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  /**
   * Fix issues in a file
   */
  private async fixFile(file: string, issues: CommentIssue[]): Promise<number> {
    if (!this.autoFixOptions) {
      return 0;
    }

    const content = await fs.promises.readFile(file, 'utf-8');
    let modified = content;
    let fixedCount = 0;

    // Sort issues by line number (descending) to fix from bottom up
    const sortedIssues = [...issues].sort(
      (a, b) => b.comment.location.startLine - a.comment.location.startLine
    );

    for (const issue of sortedIssues) {
      let shouldFix = false;

      switch (issue.type) {
        case CommentIssueType.REDUNDANT:
          shouldFix = this.autoFixOptions.removeRedundant ?? false;
          break;
        case CommentIssueType.TRIVIAL:
          shouldFix = this.autoFixOptions.removeTrivial ?? false;
          break;
        case CommentIssueType.COMMENTED_CODE:
          shouldFix = this.autoFixOptions.removeCommentedCode ?? false;
          break;
      }

      if (shouldFix) {
        modified = this.removeComment(modified, issue.comment);
        fixedCount++;
      }
    }

    if (fixedCount > 0) {
      if (this.autoFixOptions.createBackup) {
        await fs.promises.writeFile(`${file}.bak`, content);
      }
      await fs.promises.writeFile(file, modified);
    }

    return fixedCount;
  }

  /**
   * Remove a comment from content
   */
  private removeComment(content: string, comment: ParsedComment): string {
    const lines = content.split('\n');
    const startLine = comment.location.startLine - 1;
    const endLine = comment.location.endLine - 1;

    // Handle inline comments (just remove the comment part)
    if (comment.type === CommentType.INLINE) {
      const line = lines[startLine];
      const commentStart = comment.location.startColumn - 1;
      lines[startLine] = line.substring(0, commentStart).trimEnd();
    } else {
      // Remove entire lines for standalone comments
      const newLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (i < startLine || i > endLine) {
          newLines.push(lines[i]);
        } else if (i === startLine) {
          // Check if there's code before the comment
          const beforeComment = lines[i].substring(0, comment.location.startColumn - 1).trim();
          if (beforeComment.length > 0) {
            newLines.push(beforeComment);
          }
        }
      }
      return newLines.join('\n');
    }

    return lines.join('\n');
  }

  /**
   * Extract files from hook context
   */
  private extractFilesFromContext(context: HookContext<unknown>): string[] {
    const data = context.data as Record<string, unknown>;

    // Check various possible fields
    if (Array.isArray(data?.files)) {
      return data.files as string[];
    }
    if (typeof data?.file === 'string') {
      return [data.file];
    }
    if (Array.isArray(data?.changedFiles)) {
      return data.changedFiles as string[];
    }

    return [];
  }

  /**
   * Check if content starts a doc comment
   */
  private isDocComment(content: string, patterns: typeof LANGUAGE_PATTERNS[SupportedLanguage]): boolean {
    if (patterns.docStart && content.trimStart().startsWith(patterns.docStart)) {
      return true;
    }
    return false;
  }

  /**
   * Extract comment content without delimiters
   */
  private extractCommentContent(raw: string, patterns: typeof LANGUAGE_PATTERNS[SupportedLanguage]): string {
    let content = raw.trim();

    // Remove multi-line delimiters
    if (patterns.multiLineStart && content.startsWith(patterns.multiLineStart)) {
      content = content.substring(patterns.multiLineStart.length);
    }
    if (patterns.multiLineEnd && content.endsWith(patterns.multiLineEnd)) {
      content = content.substring(0, content.length - patterns.multiLineEnd.length);
    }

    // Remove leading asterisks from JSDoc-style comments
    content = content
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();

    return content;
  }

  /**
   * Check if comment is a TODO/FIXME
   */
  private isTodoComment(raw: string): boolean {
    const upper = raw.toUpperCase();
    return (
      upper.includes('TODO') ||
      upper.includes('FIXME') ||
      upper.includes('HACK') ||
      upper.includes('XXX') ||
      upper.includes('BUG')
    );
  }

  /**
   * Check if comment is a license header
   */
  private isLicenseComment(raw: string, lineNum: number): boolean {
    if (lineNum > 10) {
      return false; // License comments should be at the top
    }

    const upper = raw.toUpperCase();
    return (
      upper.includes('LICENSE') ||
      upper.includes('COPYRIGHT') ||
      upper.includes('SPDX-LICENSE') ||
      upper.includes('MIT') ||
      upper.includes('APACHE') ||
      upper.includes('BSD')
    );
  }

  /**
   * Find comment start position (avoiding strings)
   */
  private findCommentStart(line: string, prefix: string): number {
    let inString = false;
    let stringChar = '';
    let escaped = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        continue;
      }

      if (inString && char === stringChar) {
        inString = false;
        continue;
      }

      if (!inString && line.substring(i, i + prefix.length) === prefix) {
        return i;
      }
    }

    return -1;
  }

  /**
   * Get next code line after a comment
   */
  private getNextCodeLine(lines: string[], currentIndex: number): string | undefined {
    for (let i = currentIndex + 1; i < lines.length && i < currentIndex + 3; i++) {
      const line = lines[i].trim();
      if (line.length > 0 && !line.startsWith('//') && !line.startsWith('#') && !line.startsWith('/*')) {
        return line;
      }
    }
    return undefined;
  }

  /**
   * Parse Python docstrings
   */
  private parsePythonDocstrings(content: string, language: SupportedLanguage): ParsedComment[] {
    const comments: ParsedComment[] = [];
    const patterns = ['"""', "'''"];

    for (const pattern of patterns) {
      let searchStart = 0;
      while (true) {
        const start = content.indexOf(pattern, searchStart);
        if (start === -1) break;

        const end = content.indexOf(pattern, start + pattern.length);
        if (end === -1) break;

        const raw = content.substring(start, end + pattern.length);
        const contentText = content.substring(start + pattern.length, end).trim();

        // Calculate line numbers
        const beforeStart = content.substring(0, start);
        const startLine = beforeStart.split('\n').length;
        const endLine = startLine + raw.split('\n').length - 1;

        comments.push({
          id: randomUUID(),
          type: CommentType.DOC_COMMENT,
          raw,
          content: contentText,
          location: {
            file: '',
            startLine,
            endLine,
            startColumn: 1,
            endColumn: raw.split('\n').pop()?.length ?? 1,
          },
          language,
        });

        searchStart = end + pattern.length;
      }
    }

    return comments;
  }

  /**
   * Update metrics after check
   */
  private updateMetrics(result: CommentCheckResult): void {
    this.metrics.totalChecks++;
    this.metrics.totalFilesAnalyzed += result.filesAnalyzed;
    this.metrics.totalIssuesFound += result.totalIssues;
    this.metrics.totalIssuesFixed += result.totalFixed;
    this.metrics.totalAnalysisTimeMs += result.durationMs;
    this.metrics.lastCheckAt = result.completedAt;

    // Update issue counts by type
    for (const [type, count] of Object.entries(result.issuesByType)) {
      this.metrics.issuesByType[type as CommentIssueType] += count;
    }

    // Update comment counts
    let totalComments = 0;
    let totalDensity = 0;
    let totalRatio = 0;

    for (const fileResult of result.fileResults) {
      totalComments += fileResult.statistics.totalComments;
      totalDensity += fileResult.statistics.commentDensity;
      totalRatio += fileResult.statistics.commentToCodeRatio;
    }

    this.metrics.totalCommentsAnalyzed += totalComments;

    if (result.filesAnalyzed > 0) {
      // Running average
      const n = this.metrics.totalChecks;
      this.metrics.averageCommentDensity =
        ((n - 1) * this.metrics.averageCommentDensity + totalDensity / result.filesAnalyzed) / n;
      this.metrics.averageCommentRatio =
        ((n - 1) * this.metrics.averageCommentRatio + totalRatio / result.filesAnalyzed) / n;
    }
  }

  /**
   * Emit check started event
   */
  private emitCheckStarted(files: string[]): void {
    for (const callback of this.checkStartedCallbacks.values()) {
      try {
        callback(files);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Emit check completed event
   */
  private emitCheckCompleted(result: CommentCheckResult): void {
    for (const callback of this.checkCompletedCallbacks.values()) {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Emit issue found event
   */
  private emitIssueFound(issue: CommentIssue): void {
    for (const callback of this.issueFoundCallbacks.values()) {
      try {
        callback(issue);
      } catch {
        // Ignore callback errors
      }
    }
  }

  /**
   * Emit file analyzed event
   */
  private emitFileAnalyzed(result: FileAnalysisResult): void {
    for (const callback of this.fileAnalyzedCallbacks.values()) {
      try {
        callback(result);
      } catch {
        // Ignore callback errors
      }
    }
  }
}

/**
 * Create a comment checker hook instance
 */
export function createCommentChecker(config?: CommentCheckerConfig): CommentCheckerHook {
  return new CommentCheckerHook(config);
}
