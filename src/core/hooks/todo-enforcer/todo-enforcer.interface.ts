/**
 * Todo Enforcer Hook Interfaces
 *
 * Provides TODO comment detection, tracking, and enforcement for code quality.
 *
 * Feature: F3.17 - Todo Enforcer
 * @module core/hooks/todo-enforcer
 */

import { HookConfig } from '../../interfaces/hook.interface.js';

// ============================================================================
// Enums
// ============================================================================

/**
 * TODO priority levels
 */
export enum TodoPriority {
  /** Critical - must be done immediately */
  CRITICAL = 'critical',
  /** High - should be done soon */
  HIGH = 'high',
  /** Medium - normal priority */
  MEDIUM = 'medium',
  /** Low - nice to have */
  LOW = 'low',
  /** None - no priority specified */
  NONE = 'none',
}

/**
 * TODO status
 */
export enum TodoStatus {
  /** Open - needs to be done */
  OPEN = 'open',
  /** In progress - being worked on */
  IN_PROGRESS = 'in_progress',
  /** Blocked - waiting on something */
  BLOCKED = 'blocked',
  /** Done - completed but not removed */
  DONE = 'done',
}

/**
 * TODO type categorization
 */
export enum TodoType {
  /** Generic TODO */
  TODO = 'todo',
  /** Bug fix needed */
  FIXME = 'fixme',
  /** Potential issue or hack */
  HACK = 'hack',
  /** Optimization needed */
  OPTIMIZE = 'optimize',
  /** Review needed */
  REVIEW = 'review',
  /** Security concern */
  SECURITY = 'security',
  /** Deprecation notice */
  DEPRECATED = 'deprecated',
  /** Note for future reference */
  NOTE = 'note',
  /** Custom type */
  CUSTOM = 'custom',
}

/**
 * Enforcement level
 */
export enum EnforcementLevel {
  /** Off - no enforcement */
  OFF = 'off',
  /** Warn - log warnings but don't block */
  WARN = 'warn',
  /** Error - treat as errors */
  ERROR = 'error',
  /** Strict - block operations with TODOs */
  STRICT = 'strict',
}

/**
 * Supported programming languages for TODO detection
 */
export enum TodoSupportedLanguage {
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
  MARKDOWN = 'markdown',
  HTML = 'html',
  CSS = 'css',
  UNKNOWN = 'unknown',
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * TODO location in source file
 */
export interface TodoLocation {
  /** File path */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column: number;
  /** End line (optional) */
  endLine?: number;
  /** End column (optional) */
  endColumn?: number;
}

/**
 * Parsed TODO item
 */
export interface ParsedTodo {
  /** Unique ID */
  id: string;
  /** TODO type */
  type: TodoType;
  /** Priority level */
  priority: TodoPriority;
  /** Status */
  status: TodoStatus;
  /** TODO message/description */
  message: string;
  /** Location in source */
  location: TodoLocation;
  /** Original raw text */
  rawText: string;
  /** Assigned person (if specified) */
  assignee?: string;
  /** Due date (if specified) */
  dueDate?: Date;
  /** Tags/labels */
  tags: string[];
  /** Issue tracker reference (e.g., JIRA-123) */
  issueRef?: string;
  /** Creation date (from git blame if available) */
  createdAt?: Date;
  /** Age in days */
  ageInDays?: number;
  /** Language of source file */
  language: TodoSupportedLanguage;
}

/**
 * TODO enforcement rule
 */
export interface TodoEnforcementRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Types to enforce */
  types?: TodoType[];
  /** Minimum priority to enforce */
  minPriority?: TodoPriority;
  /** Maximum age in days before enforcement */
  maxAgeDays?: number;
  /** Enforcement level */
  level: EnforcementLevel;
  /** File patterns to apply rule (glob) */
  filePatterns?: string[];
  /** Exclude patterns */
  excludePatterns?: string[];
  /** Custom matcher function (serialized) */
  customMatcher?: string;
}

/**
 * Enforcement violation
 */
export interface EnforcementViolation {
  /** Violation ID */
  id: string;
  /** TODO that caused violation */
  todo: ParsedTodo;
  /** Rule that was violated */
  rule: TodoEnforcementRule;
  /** Violation message */
  message: string;
  /** Enforcement level */
  level: EnforcementLevel;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * File analysis result
 */
export interface TodoFileAnalysis {
  /** File path */
  file: string;
  /** Language detected */
  language: TodoSupportedLanguage;
  /** TODOs found in file */
  todos: ParsedTodo[];
  /** Total lines in file */
  totalLines: number;
  /** Lines with TODOs */
  todoLines: number;
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Error if analysis failed */
  error?: string;
}

/**
 * Overall analysis result
 */
export interface TodoAnalysisResult {
  /** All files analyzed */
  files: TodoFileAnalysis[];
  /** All TODOs found */
  todos: ParsedTodo[];
  /** Enforcement violations */
  violations: EnforcementViolation[];
  /** Whether enforcement passed */
  passed: boolean;
  /** Summary statistics */
  statistics: TodoStatistics;
  /** Analysis timestamp */
  analyzedAt: Date;
  /** Analysis duration in milliseconds */
  durationMs: number;
}

/**
 * TODO statistics
 */
export interface TodoStatistics {
  /** Total files analyzed */
  totalFiles: number;
  /** Total TODOs found */
  totalTodos: number;
  /** TODOs by type */
  byType: Record<TodoType, number>;
  /** TODOs by priority */
  byPriority: Record<TodoPriority, number>;
  /** TODOs by status */
  byStatus: Record<TodoStatus, number>;
  /** TODOs by language */
  byLanguage: Record<TodoSupportedLanguage, number>;
  /** Average age in days */
  averageAgeDays: number;
  /** Oldest TODO age in days */
  oldestAgeDays: number;
  /** TODOs older than 30 days */
  stale30Days: number;
  /** TODOs older than 90 days */
  stale90Days: number;
  /** TODOs with assignees */
  withAssignee: number;
  /** TODOs with due dates */
  withDueDate: number;
  /** TODOs with issue refs */
  withIssueRef: number;
  /** Overdue TODOs */
  overdue: number;
}

/**
 * Todo Enforcer configuration
 */
export interface TodoEnforcerConfig extends Partial<HookConfig> {
  /** File patterns to include (glob) */
  includePatterns?: string[];
  /** File patterns to exclude (glob) */
  excludePatterns?: string[];
  /** TODO types to track */
  todoTypes?: TodoType[];
  /** Enforcement rules */
  rules?: TodoEnforcementRule[];
  /** Default enforcement level */
  defaultLevel?: EnforcementLevel;
  /** Block git commits with violations */
  blockCommits?: boolean;
  /** Block deployments with violations */
  blockDeployments?: boolean;
  /** Maximum allowed TODOs (0 = unlimited) */
  maxTodos?: number;
  /** Maximum age in days for any TODO (0 = unlimited) */
  maxAgeDays?: number;
  /** Require assignee on TODOs */
  requireAssignee?: boolean;
  /** Require issue reference on TODOs */
  requireIssueRef?: boolean;
  /** Enable git blame for age tracking */
  enableGitBlame?: boolean;
  /** Custom TODO patterns (regex strings) */
  customPatterns?: string[];
  /** Report output format */
  reportFormat?: 'text' | 'json' | 'markdown';
  /** Output file for reports */
  reportOutputFile?: string;
  /** Enable caching */
  enableCache?: boolean;
  /** Cache TTL in seconds */
  cacheTtlSeconds?: number;
}

/**
 * Todo Enforcer metrics
 */
export interface TodoEnforcerMetrics {
  /** Total analyses performed */
  totalAnalyses: number;
  /** Passed analyses */
  passedAnalyses: number;
  /** Failed analyses */
  failedAnalyses: number;
  /** Total TODOs tracked */
  totalTodosTracked: number;
  /** Total violations found */
  totalViolations: number;
  /** Blocked commits */
  blockedCommits: number;
  /** Blocked deployments */
  blockedDeployments: number;
  /** Average TODOs per file */
  averageTodosPerFile: number;
  /** Average analysis duration in ms */
  averageDurationMs: number;
  /** Last analysis timestamp */
  lastAnalysisAt?: Date;
}

/**
 * Event data for todo enforcer events
 */
export interface TodoEnforcerEventData {
  /** Analysis result */
  result?: TodoAnalysisResult;
  /** Current metrics */
  metrics?: TodoEnforcerMetrics;
  /** TODO that was found */
  todo?: ParsedTodo;
  /** Violation that occurred */
  violation?: EnforcementViolation;
  /** Files analyzed */
  files?: string[];
  /** Operation blocked */
  blockedOperation?: 'commit' | 'deployment';
}

/**
 * Callback types
 */
export type AnalysisStartedCallback = (files: string[]) => void;
export type AnalysisCompletedCallback = (result: TodoAnalysisResult) => void;
export type TodoFoundCallback = (todo: ParsedTodo) => void;
export type ViolationFoundCallback = (violation: EnforcementViolation) => void;
export type OperationBlockedCallback = (operation: 'commit' | 'deployment', violations: EnforcementViolation[]) => void;

/**
 * Subscription interface
 */
export interface TodoEnforcerSubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Todo Enforcer interface
 */
export interface ITodoEnforcer {
  /**
   * Analyze files for TODOs
   */
  analyze(files: string[]): Promise<TodoAnalysisResult>;

  /**
   * Analyze a single file
   */
  analyzeFile(file: string): Promise<TodoFileAnalysis>;

  /**
   * Check enforcement rules
   */
  checkEnforcement(todos: ParsedTodo[]): EnforcementViolation[];

  /**
   * Get all tracked TODOs
   */
  getTodos(): ParsedTodo[];

  /**
   * Get statistics
   */
  getStatistics(): TodoStatistics;

  /**
   * Get metrics
   */
  getMetrics(): TodoEnforcerMetrics;

  /**
   * Generate report
   */
  generateReport(format?: 'text' | 'json' | 'markdown'): string;

  /**
   * Add enforcement rule
   */
  addRule(rule: TodoEnforcementRule): void;

  /**
   * Remove enforcement rule
   */
  removeRule(ruleId: string): boolean;

  /**
   * Get enforcement rules
   */
  getRules(): TodoEnforcementRule[];

  /**
   * Clear cached data
   */
  clearCache(): void;

  // Event subscriptions
  onAnalysisStarted(callback: AnalysisStartedCallback): TodoEnforcerSubscription;
  onAnalysisCompleted(callback: AnalysisCompletedCallback): TodoEnforcerSubscription;
  onTodoFound(callback: TodoFoundCallback): TodoEnforcerSubscription;
  onViolationFound(callback: ViolationFoundCallback): TodoEnforcerSubscription;
  onOperationBlocked(callback: OperationBlockedCallback): TodoEnforcerSubscription;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default TODO patterns by type
 */
export const TODO_TYPE_PATTERNS: Record<TodoType, RegExp> = {
  [TodoType.TODO]: /\bTODO\b/i,
  [TodoType.FIXME]: /\bFIXME\b/i,
  [TodoType.HACK]: /\bHACK\b/i,
  [TodoType.OPTIMIZE]: /\b(?:OPTIMIZE|OPTIM|PERF)\b/i,
  [TodoType.REVIEW]: /\bREVIEW\b/i,
  [TodoType.SECURITY]: /\b(?:SECURITY|SEC)\b/i,
  [TodoType.DEPRECATED]: /\bDEPRECATED?\b/i,
  [TodoType.NOTE]: /\bNOTE\b/i,
  [TodoType.CUSTOM]: /$.^/, // Never matches by default
};

/**
 * Priority patterns in TODO comments
 */
export const PRIORITY_PATTERNS: Record<TodoPriority, RegExp> = {
  [TodoPriority.CRITICAL]: /\b(?:CRITICAL|URGENT|ASAP|P0)\b/i,
  [TodoPriority.HIGH]: /\b(?:HIGH|IMPORTANT|P1)\b/i,
  [TodoPriority.MEDIUM]: /\b(?:MEDIUM|P2)\b/i,
  [TodoPriority.LOW]: /\b(?:LOW|MINOR|P3)\b/i,
  [TodoPriority.NONE]: /$.^/, // Never matches
};

/**
 * Assignee pattern: @username or (username)
 */
export const ASSIGNEE_PATTERN = /(?:@(\w+)|(?:\((\w+)\)))/;

/**
 * Issue reference patterns
 */
export const ISSUE_REF_PATTERNS = [
  /\b([A-Z]+-\d+)\b/, // JIRA: PROJ-123
  /#(\d+)\b/, // GitHub: #123 (no leading \b since # is not a word char)
  /\bGH-(\d+)\b/i, // GitHub: GH-123
  /\bBUG-(\d+)\b/i, // Bug tracker: BUG-123
  /\bissue[:\s]+(\d+)\b/i, // Generic: issue: 123
];

/**
 * Due date patterns
 */
export const DUE_DATE_PATTERNS = [
  /due[:\s]+(\d{4}-\d{2}-\d{2})/i, // due: 2024-01-15
  /by[:\s]+(\d{4}-\d{2}-\d{2})/i, // by: 2024-01-15
  /deadline[:\s]+(\d{4}-\d{2}-\d{2})/i, // deadline: 2024-01-15
];

/**
 * Tag pattern: [tag] or #tag
 */
export const TAG_PATTERNS = [
  /\[([^\]]+)\]/g, // [tag]
  /#([a-zA-Z][a-zA-Z0-9_-]*)/g, // #tag (not issue numbers)
];

/**
 * File extension to language mapping
 */
export const EXTENSION_TO_TODO_LANGUAGE: Record<string, TodoSupportedLanguage> = {
  '.ts': TodoSupportedLanguage.TYPESCRIPT,
  '.tsx': TodoSupportedLanguage.TYPESCRIPT,
  '.mts': TodoSupportedLanguage.TYPESCRIPT,
  '.cts': TodoSupportedLanguage.TYPESCRIPT,
  '.js': TodoSupportedLanguage.JAVASCRIPT,
  '.jsx': TodoSupportedLanguage.JAVASCRIPT,
  '.mjs': TodoSupportedLanguage.JAVASCRIPT,
  '.cjs': TodoSupportedLanguage.JAVASCRIPT,
  '.py': TodoSupportedLanguage.PYTHON,
  '.pyw': TodoSupportedLanguage.PYTHON,
  '.java': TodoSupportedLanguage.JAVA,
  '.go': TodoSupportedLanguage.GO,
  '.rs': TodoSupportedLanguage.RUST,
  '.c': TodoSupportedLanguage.C,
  '.h': TodoSupportedLanguage.C,
  '.cpp': TodoSupportedLanguage.CPP,
  '.hpp': TodoSupportedLanguage.CPP,
  '.cc': TodoSupportedLanguage.CPP,
  '.cxx': TodoSupportedLanguage.CPP,
  '.cs': TodoSupportedLanguage.CSHARP,
  '.rb': TodoSupportedLanguage.RUBY,
  '.php': TodoSupportedLanguage.PHP,
  '.sh': TodoSupportedLanguage.SHELL,
  '.bash': TodoSupportedLanguage.SHELL,
  '.zsh': TodoSupportedLanguage.SHELL,
  '.yaml': TodoSupportedLanguage.YAML,
  '.yml': TodoSupportedLanguage.YAML,
  '.md': TodoSupportedLanguage.MARKDOWN,
  '.markdown': TodoSupportedLanguage.MARKDOWN,
  '.html': TodoSupportedLanguage.HTML,
  '.htm': TodoSupportedLanguage.HTML,
  '.css': TodoSupportedLanguage.CSS,
  '.scss': TodoSupportedLanguage.CSS,
  '.less': TodoSupportedLanguage.CSS,
};

/**
 * Comment patterns by language for extracting TODO comments
 */
export const LANGUAGE_COMMENT_PATTERNS: Record<TodoSupportedLanguage, { single: RegExp; multiStart?: RegExp; multiEnd?: RegExp }> = {
  [TodoSupportedLanguage.TYPESCRIPT]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.JAVASCRIPT]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.PYTHON]: {
    single: /#(.*)$/gm,
    multiStart: /"""/,
    multiEnd: /"""/,
  },
  [TodoSupportedLanguage.JAVA]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.GO]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.RUST]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.C]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.CPP]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.CSHARP]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.RUBY]: {
    single: /#(.*)$/gm,
    multiStart: /=begin/,
    multiEnd: /=end/,
  },
  [TodoSupportedLanguage.PHP]: {
    single: /(?:\/\/|#)(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.SHELL]: {
    single: /#(.*)$/gm,
  },
  [TodoSupportedLanguage.YAML]: {
    single: /#(.*)$/gm,
  },
  [TodoSupportedLanguage.MARKDOWN]: {
    single: /<!--(.*)-->/gm,
    multiStart: /<!--/,
    multiEnd: /-->/,
  },
  [TodoSupportedLanguage.HTML]: {
    single: /<!--(.*)-->/gm,
    multiStart: /<!--/,
    multiEnd: /-->/,
  },
  [TodoSupportedLanguage.CSS]: {
    single: /\/\/(.*)$/gm,
    multiStart: /\/\*+/,
    multiEnd: /\*+\//,
  },
  [TodoSupportedLanguage.UNKNOWN]: {
    single: /(?:\/\/|#|<!--)(.*)(?:-->)?$/gm,
  },
};

/**
 * Default include patterns
 */
export const DEFAULT_TODO_INCLUDE_PATTERNS = [
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
  '**/*.sh',
];

/**
 * Default exclude patterns
 */
export const DEFAULT_TODO_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/vendor/**',
  '**/__pycache__/**',
  '**/target/**',
  '**/bin/**',
  '**/obj/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/coverage/**',
];

/**
 * Default enforcement rules
 */
export const DEFAULT_ENFORCEMENT_RULES: TodoEnforcementRule[] = [
  {
    id: 'no-fixme-commit',
    name: 'No FIXME on Commit',
    description: 'Block commits containing FIXME comments',
    types: [TodoType.FIXME],
    level: EnforcementLevel.ERROR,
  },
  {
    id: 'stale-todos',
    name: 'Stale TODOs',
    description: 'Warn about TODOs older than 90 days',
    maxAgeDays: 90,
    level: EnforcementLevel.WARN,
  },
  {
    id: 'security-critical',
    name: 'Security TODOs',
    description: 'Treat security-related TODOs as critical',
    types: [TodoType.SECURITY],
    level: EnforcementLevel.STRICT,
  },
];

/**
 * Default configuration values
 */
export const DEFAULT_TODO_ENFORCER_CONFIG: Required<
  Omit<TodoEnforcerConfig, 'rules' | 'customPatterns' | 'reportOutputFile' | 'name' | 'description' | 'event' | 'conditions'>
> = {
  priority: 90,
  enabled: true,
  timeout: 60000,
  retryOnError: false,
  includePatterns: DEFAULT_TODO_INCLUDE_PATTERNS,
  excludePatterns: DEFAULT_TODO_EXCLUDE_PATTERNS,
  todoTypes: Object.values(TodoType).filter((t) => t !== TodoType.CUSTOM),
  defaultLevel: EnforcementLevel.WARN,
  blockCommits: false,
  blockDeployments: false,
  maxTodos: 0,
  maxAgeDays: 0,
  requireAssignee: false,
  requireIssueRef: false,
  enableGitBlame: false,
  reportFormat: 'text',
  enableCache: true,
  cacheTtlSeconds: 300,
};

/**
 * Priority order for sorting
 */
export const PRIORITY_ORDER: Record<TodoPriority, number> = {
  [TodoPriority.CRITICAL]: 0,
  [TodoPriority.HIGH]: 1,
  [TodoPriority.MEDIUM]: 2,
  [TodoPriority.LOW]: 3,
  [TodoPriority.NONE]: 4,
};
