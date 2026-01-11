/**
 * Comment Checker Hook Interfaces
 *
 * Provides detection and management of excessive/problematic comments in code.
 *
 * Feature: F3.15 - Comment Checker
 * @module core/hooks/comment-checker
 */

import { HookConfig } from '../../interfaces/hook.interface.js';

/**
 * Comment type classification
 */
export enum CommentType {
  /** Single-line comment (// or #) */
  SINGLE_LINE = 'single_line',
  /** Multi-line comment (/* *\/) */
  MULTI_LINE = 'multi_line',
  /** Documentation comment (/** *\/ or """) */
  DOC_COMMENT = 'doc_comment',
  /** TODO/FIXME comment */
  TODO = 'todo',
  /** License/Copyright header */
  LICENSE = 'license',
  /** Inline comment (at end of code line) */
  INLINE = 'inline',
}

/**
 * Comment issue type
 */
export enum CommentIssueType {
  /** Comment duplicates what code already says */
  REDUNDANT = 'redundant',
  /** Comment is too verbose for the code it describes */
  VERBOSE = 'verbose',
  /** Comment appears to be outdated */
  OUTDATED = 'outdated',
  /** Too many consecutive comment lines */
  EXCESSIVE_BLOCK = 'excessive_block',
  /** Comment density is too high in file */
  HIGH_DENSITY = 'high_density',
  /** Empty or trivial comment */
  TRIVIAL = 'trivial',
  /** Commented-out code */
  COMMENTED_CODE = 'commented_code',
  /** Non-standard comment format */
  NONSTANDARD_FORMAT = 'nonstandard_format',
  /** Missing required documentation */
  MISSING_DOC = 'missing_doc',
  /** TODO/FIXME without ticket reference */
  UNTRACKED_TODO = 'untracked_todo',
}

/**
 * Comment issue severity
 */
export enum CommentIssueSeverity {
  /** Error - must be fixed */
  ERROR = 'error',
  /** Warning - should be fixed */
  WARNING = 'warning',
  /** Info - informational */
  INFO = 'info',
  /** Suggestion - optional improvement */
  SUGGESTION = 'suggestion',
}

/**
 * Supported programming languages
 */
export enum SupportedLanguage {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java',
  GO = 'go',
  RUST = 'rust',
  C = 'c',
  CPP = 'cpp',
  CSHARP = 'csharp',
  RUBY = 'ruby',
  PHP = 'php',
  SHELL = 'shell',
  YAML = 'yaml',
  UNKNOWN = 'unknown',
}

/**
 * Language comment patterns
 */
export interface LanguageCommentPattern {
  /** Single-line comment prefix (e.g., '//', '#') */
  singleLine: string[];
  /** Multi-line comment start (e.g., '/*') */
  multiLineStart?: string;
  /** Multi-line comment end (e.g., '*\/') */
  multiLineEnd?: string;
  /** Doc comment start (e.g., '/**') */
  docStart?: string;
  /** Doc comment end (e.g., '*\/') */
  docEnd?: string;
  /** Alternative doc formats (e.g., Python docstrings) */
  altDocFormats?: string[];
}

/**
 * Comment location in source file
 */
export interface CommentLocation {
  /** File path */
  file: string;
  /** Start line (1-based) */
  startLine: number;
  /** End line (1-based) */
  endLine: number;
  /** Start column (1-based) */
  startColumn: number;
  /** End column (1-based) */
  endColumn: number;
}

/**
 * Parsed comment information
 */
export interface ParsedComment {
  /** Comment ID (unique within analysis) */
  id: string;
  /** Comment type */
  type: CommentType;
  /** Raw comment text including delimiters */
  raw: string;
  /** Comment content without delimiters */
  content: string;
  /** Location in source file */
  location: CommentLocation;
  /** Associated code (if inline or immediately following) */
  associatedCode?: string;
  /** Language detected */
  language: SupportedLanguage;
}

/**
 * Comment issue found during analysis
 */
export interface CommentIssue {
  /** Issue ID */
  id: string;
  /** Issue type */
  type: CommentIssueType;
  /** Issue severity */
  severity: CommentIssueSeverity;
  /** Issue message */
  message: string;
  /** Affected comment */
  comment: ParsedComment;
  /** Suggested fix (optional) */
  suggestion?: string;
  /** Suggested replacement text (optional) */
  replacementText?: string;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Comment statistics for a file
 */
export interface CommentStatistics {
  /** Total number of comments */
  totalComments: number;
  /** Comments by type */
  byType: Record<CommentType, number>;
  /** Total comment lines */
  totalCommentLines: number;
  /** Total code lines (non-empty, non-comment) */
  totalCodeLines: number;
  /** Comment density (comment lines / total lines) */
  commentDensity: number;
  /** Comment-to-code ratio */
  commentToCodeRatio: number;
  /** Average comment length (characters) */
  averageCommentLength: number;
  /** Longest comment block (lines) */
  longestCommentBlock: number;
}

/**
 * File analysis result
 */
export interface FileAnalysisResult {
  /** File path */
  file: string;
  /** Detected language */
  language: SupportedLanguage;
  /** All parsed comments */
  comments: ParsedComment[];
  /** Issues found */
  issues: CommentIssue[];
  /** Comment statistics */
  statistics: CommentStatistics;
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Analysis duration in milliseconds */
  analysisTimeMs: number;
}

/**
 * Overall check result
 */
export interface CommentCheckResult {
  /** Whether check passed */
  passed: boolean;
  /** Files analyzed */
  filesAnalyzed: number;
  /** Files with issues */
  filesWithIssues: number;
  /** Total issues found */
  totalIssues: number;
  /** Issues by severity */
  issuesBySeverity: Record<CommentIssueSeverity, number>;
  /** Issues by type */
  issuesByType: Record<CommentIssueType, number>;
  /** Per-file results */
  fileResults: FileAnalysisResult[];
  /** Files that were auto-fixed */
  fixedFiles: string[];
  /** Total issues fixed */
  totalFixed: number;
  /** Check started timestamp */
  startedAt: Date;
  /** Check completed timestamp */
  completedAt: Date;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Auto-fix options
 */
export interface AutoFixOptions {
  /** Remove redundant comments */
  removeRedundant?: boolean;
  /** Remove trivial/empty comments */
  removeTrivial?: boolean;
  /** Remove commented-out code */
  removeCommentedCode?: boolean;
  /** Trim verbose comments */
  trimVerbose?: boolean;
  /** Create backup before fixing */
  createBackup?: boolean;
  /** Dry run (report changes without applying) */
  dryRun?: boolean;
}

/**
 * Comment checker configuration
 */
export interface CommentCheckerConfig extends Partial<HookConfig> {
  /** Maximum comment-to-code ratio (0-1, default: 0.5) */
  maxCommentRatio?: number;
  /** Maximum consecutive comment lines (default: 20) */
  maxConsecutiveCommentLines?: number;
  /** Maximum comment density (0-1, default: 0.3) */
  maxCommentDensity?: number;
  /** Minimum comment length to consider verbose (default: 200) */
  verboseCommentThreshold?: number;
  /** Check for redundant comments (default: true) */
  checkRedundant?: boolean;
  /** Check for verbose comments (default: true) */
  checkVerbose?: boolean;
  /** Check for commented-out code (default: true) */
  checkCommentedCode?: boolean;
  /** Check for missing documentation (default: false) */
  checkMissingDocs?: boolean;
  /** Require ticket reference for TODOs (default: false) */
  requireTicketForTodo?: boolean;
  /** Ticket patterns to recognize (e.g., ['JIRA-\\d+', '#\\d+']) */
  ticketPatterns?: string[];
  /** File patterns to include (glob) */
  includePatterns?: string[];
  /** File patterns to exclude (glob) */
  excludePatterns?: string[];
  /** Severity overrides by issue type */
  severityOverrides?: Partial<Record<CommentIssueType, CommentIssueSeverity>>;
  /** Auto-fix options */
  autoFix?: AutoFixOptions;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Comment checker metrics
 */
export interface CommentCheckerMetrics {
  /** Total checks performed */
  totalChecks: number;
  /** Total files analyzed */
  totalFilesAnalyzed: number;
  /** Total comments analyzed */
  totalCommentsAnalyzed: number;
  /** Total issues found */
  totalIssuesFound: number;
  /** Total issues fixed */
  totalIssuesFixed: number;
  /** Issues by type (cumulative) */
  issuesByType: Record<CommentIssueType, number>;
  /** Average comment density across all files */
  averageCommentDensity: number;
  /** Average comment-to-code ratio */
  averageCommentRatio: number;
  /** Total analysis time in milliseconds */
  totalAnalysisTimeMs: number;
  /** Last check timestamp */
  lastCheckAt?: Date;
}

/**
 * Comment checker event data
 */
export interface CommentCheckerEventData {
  /** Check result */
  result: CommentCheckResult;
  /** Current metrics */
  metrics: CommentCheckerMetrics;
  /** Files checked */
  files?: string[];
}

/**
 * Callback types
 */
export type CommentCheckStartedCallback = (files: string[]) => void;
export type CommentCheckCompletedCallback = (result: CommentCheckResult) => void;
export type CommentIssueFoundCallback = (issue: CommentIssue) => void;
export type CommentFileAnalyzedCallback = (result: FileAnalysisResult) => void;
export type CommentFixAppliedCallback = (file: string, issuesFixed: number) => void;

/**
 * Comment checker subscription
 */
export interface CommentCheckerSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Comment checker interface
 */
export interface ICommentChecker {
  /**
   * Analyze files for comment issues
   */
  analyze(files: string[]): Promise<CommentCheckResult>;

  /**
   * Analyze a single file
   */
  analyzeFile(file: string): Promise<FileAnalysisResult>;

  /**
   * Auto-fix comment issues
   */
  fix(files: string[], options?: AutoFixOptions): Promise<CommentCheckResult>;

  /**
   * Get comment statistics for a file
   */
  getStatistics(file: string): Promise<CommentStatistics>;

  /**
   * Parse comments from content
   */
  parseComments(content: string, language: SupportedLanguage): ParsedComment[];

  /**
   * Detect language from file extension
   */
  detectLanguage(file: string): SupportedLanguage;

  /**
   * Get current metrics
   */
  getMetrics(): CommentCheckerMetrics;

  /**
   * Reset metrics
   */
  resetMetrics(): void;

  /**
   * Subscribe to check started events
   */
  onCheckStarted(callback: CommentCheckStartedCallback): CommentCheckerSubscription;

  /**
   * Subscribe to check completed events
   */
  onCheckCompleted(callback: CommentCheckCompletedCallback): CommentCheckerSubscription;

  /**
   * Subscribe to issue found events
   */
  onIssueFound(callback: CommentIssueFoundCallback): CommentCheckerSubscription;

  /**
   * Subscribe to file analyzed events
   */
  onFileAnalyzed(callback: CommentFileAnalyzedCallback): CommentCheckerSubscription;
}

/**
 * Default severity mappings
 */
export const DEFAULT_SEVERITY_MAP: Record<CommentIssueType, CommentIssueSeverity> = {
  [CommentIssueType.REDUNDANT]: CommentIssueSeverity.WARNING,
  [CommentIssueType.VERBOSE]: CommentIssueSeverity.INFO,
  [CommentIssueType.OUTDATED]: CommentIssueSeverity.WARNING,
  [CommentIssueType.EXCESSIVE_BLOCK]: CommentIssueSeverity.INFO,
  [CommentIssueType.HIGH_DENSITY]: CommentIssueSeverity.INFO,
  [CommentIssueType.TRIVIAL]: CommentIssueSeverity.SUGGESTION,
  [CommentIssueType.COMMENTED_CODE]: CommentIssueSeverity.WARNING,
  [CommentIssueType.NONSTANDARD_FORMAT]: CommentIssueSeverity.SUGGESTION,
  [CommentIssueType.MISSING_DOC]: CommentIssueSeverity.INFO,
  [CommentIssueType.UNTRACKED_TODO]: CommentIssueSeverity.SUGGESTION,
};

/**
 * Language comment patterns
 */
export const LANGUAGE_PATTERNS: Record<SupportedLanguage, LanguageCommentPattern> = {
  [SupportedLanguage.TYPESCRIPT]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
    docStart: '/**',
    docEnd: '*/',
  },
  [SupportedLanguage.JAVASCRIPT]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
    docStart: '/**',
    docEnd: '*/',
  },
  [SupportedLanguage.PYTHON]: {
    singleLine: ['#'],
    altDocFormats: ['"""', "'''"],
  },
  [SupportedLanguage.JAVA]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
    docStart: '/**',
    docEnd: '*/',
  },
  [SupportedLanguage.GO]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
  },
  [SupportedLanguage.RUST]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
    docStart: '///',
  },
  [SupportedLanguage.C]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
  },
  [SupportedLanguage.CPP]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
  },
  [SupportedLanguage.CSHARP]: {
    singleLine: ['//'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
    docStart: '///',
  },
  [SupportedLanguage.RUBY]: {
    singleLine: ['#'],
    multiLineStart: '=begin',
    multiLineEnd: '=end',
  },
  [SupportedLanguage.PHP]: {
    singleLine: ['//', '#'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
    docStart: '/**',
    docEnd: '*/',
  },
  [SupportedLanguage.SHELL]: {
    singleLine: ['#'],
  },
  [SupportedLanguage.YAML]: {
    singleLine: ['#'],
  },
  [SupportedLanguage.UNKNOWN]: {
    singleLine: ['//', '#'],
    multiLineStart: '/*',
    multiLineEnd: '*/',
  },
};

/**
 * File extension to language mapping
 */
export const EXTENSION_TO_LANGUAGE: Record<string, SupportedLanguage> = {
  '.ts': SupportedLanguage.TYPESCRIPT,
  '.tsx': SupportedLanguage.TYPESCRIPT,
  '.js': SupportedLanguage.JAVASCRIPT,
  '.jsx': SupportedLanguage.JAVASCRIPT,
  '.mjs': SupportedLanguage.JAVASCRIPT,
  '.cjs': SupportedLanguage.JAVASCRIPT,
  '.py': SupportedLanguage.PYTHON,
  '.pyw': SupportedLanguage.PYTHON,
  '.java': SupportedLanguage.JAVA,
  '.go': SupportedLanguage.GO,
  '.rs': SupportedLanguage.RUST,
  '.c': SupportedLanguage.C,
  '.h': SupportedLanguage.C,
  '.cpp': SupportedLanguage.CPP,
  '.cc': SupportedLanguage.CPP,
  '.cxx': SupportedLanguage.CPP,
  '.hpp': SupportedLanguage.CPP,
  '.cs': SupportedLanguage.CSHARP,
  '.rb': SupportedLanguage.RUBY,
  '.php': SupportedLanguage.PHP,
  '.sh': SupportedLanguage.SHELL,
  '.bash': SupportedLanguage.SHELL,
  '.zsh': SupportedLanguage.SHELL,
  '.yaml': SupportedLanguage.YAML,
  '.yml': SupportedLanguage.YAML,
};

/**
 * Default configuration values
 */
export const DEFAULT_COMMENT_CHECKER_CONFIG: Required<
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
> = {
  priority: 80,
  enabled: true,
  timeout: 60000,
  retryOnError: false,
  maxCommentRatio: 0.5,
  maxConsecutiveCommentLines: 20,
  maxCommentDensity: 0.3,
  verboseCommentThreshold: 200,
  checkRedundant: true,
  checkVerbose: true,
  checkCommentedCode: true,
  checkMissingDocs: false,
  requireTicketForTodo: false,
  verbose: false,
};

/**
 * Default file patterns
 */
export const DEFAULT_INCLUDE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.py',
  '**/*.java',
  '**/*.go',
  '**/*.rs',
  '**/*.c',
  '**/*.cpp',
  '**/*.cs',
  '**/*.rb',
  '**/*.php',
];

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/target/**',
];

/**
 * Patterns that indicate commented-out code
 */
export const COMMENTED_CODE_PATTERNS = [
  // Variable declarations
  /^\s*(const|let|var|int|string|float|double|bool|void)\s+\w+/,
  // Function declarations
  /^\s*(function|def|func|fn|public|private|protected|static)\s+\w+/,
  // Control flow
  /^\s*(if|else|for|while|switch|case|try|catch|return|break|continue)\s*[\(\{]/,
  // Import/export
  /^\s*(import|export|from|require|include|using)\s+/,
  // Class/interface
  /^\s*(class|interface|struct|enum|type)\s+\w+/,
  // Assignments
  /^\s*\w+\s*[+\-*\/]?=\s*.+;?\s*$/,
  // Method calls ending with semicolon
  /^\s*\w+\.\w+\([^)]*\);?\s*$/,
  // Closing braces
  /^\s*[\}\]];?\s*$/,
];

/**
 * Patterns that indicate redundant comments
 */
export const REDUNDANT_COMMENT_PATTERNS = [
  // Increment/decrement
  { pattern: /^\s*(increment|increase|add one to|add 1 to)\s+\w+/i, codePattern: /\+\+|\+= ?1/ },
  { pattern: /^\s*(decrement|decrease|subtract one from)\s+\w+/i, codePattern: /--|-= ?1/ },
  // Variable naming
  { pattern: /^\s*(set|assign|store)\s+(\w+)\s+to\s+/i, codePattern: null },
  // Return value
  { pattern: /^\s*return(s|ing)?\s+(the\s+)?(value|result)/i, codePattern: /return\s+/ },
  // Loop descriptions
  { pattern: /^\s*(loop|iterate)\s+(through|over)/i, codePattern: /(for|while|forEach)/ },
  // Getter/setter
  { pattern: /^\s*get(s|ter)?\s+(the\s+)?(\w+)/i, codePattern: /get\w+|return\s+this\./ },
  { pattern: /^\s*set(s|ter)?\s+(the\s+)?(\w+)/i, codePattern: /set\w+|this\.\w+\s*=/ },
];

/**
 * Trivial comment patterns (should be removed)
 */
export const TRIVIAL_COMMENT_PATTERNS = [
  /^\s*\/\/\s*$/,           // Empty comment
  /^\s*\/\*\s*\*\/\s*$/,    // Empty block comment
  /^\s*#\s*$/,              // Empty Python comment
  /^\s*\/\/\s*\.{3,}\s*$/,  // Just dots
  /^\s*\/\/\s*-{3,}\s*$/,   // Just dashes
  /^\s*\/\/\s*={3,}\s*$/,   // Just equals
];
