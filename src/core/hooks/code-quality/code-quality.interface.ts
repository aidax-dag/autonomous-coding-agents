/**
 * Code Quality Hook Interfaces
 *
 * Provides code quality checking including linting, formatting, and type checking.
 *
 * @module core/hooks/code-quality
 */

import { HookConfig } from '../../interfaces/hook.interface';

/**
 * Quality check type
 */
export enum QualityCheckType {
  /** Linting (ESLint, etc.) */
  LINT = 'lint',
  /** Formatting (Prettier, etc.) */
  FORMAT = 'format',
  /** Type checking (TypeScript, etc.) */
  TYPE_CHECK = 'type_check',
  /** Unit tests */
  TEST = 'test',
  /** All checks */
  ALL = 'all',
}

/**
 * Quality tool type
 */
export enum QualityTool {
  /** ESLint for JavaScript/TypeScript linting */
  ESLINT = 'eslint',
  /** Prettier for code formatting */
  PRETTIER = 'prettier',
  /** TypeScript compiler for type checking */
  TSC = 'tsc',
  /** Jest for testing */
  JEST = 'jest',
  /** Vitest for testing */
  VITEST = 'vitest',
  /** Biome for linting and formatting */
  BIOME = 'biome',
  /** Custom tool */
  CUSTOM = 'custom',
}

/**
 * Issue severity level
 */
export enum IssueSeverity {
  /** Error - must be fixed */
  ERROR = 'error',
  /** Warning - should be fixed */
  WARNING = 'warning',
  /** Info - informational */
  INFO = 'info',
  /** Hint - suggestion */
  HINT = 'hint',
}

/**
 * Issue location in source file
 */
export interface IssueLocation {
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
 * Code quality issue
 */
export interface QualityIssue {
  /** Issue ID */
  id: string;
  /** Rule ID (e.g., 'no-unused-vars') */
  ruleId: string;
  /** Issue severity */
  severity: IssueSeverity;
  /** Issue message */
  message: string;
  /** Issue location */
  location: IssueLocation;
  /** Source code snippet (optional) */
  source?: string;
  /** Suggested fix (optional) */
  fix?: IssueFix;
  /** Documentation URL (optional) */
  docsUrl?: string;
  /** Tool that found the issue */
  tool: QualityTool;
  /** Check type */
  checkType: QualityCheckType;
}

/**
 * Issue fix suggestion
 */
export interface IssueFix {
  /** Description of the fix */
  description: string;
  /** Text to replace */
  text: string;
  /** Range to replace (start offset, end offset) */
  range: [number, number];
}

/**
 * Tool configuration
 */
export interface ToolConfig {
  /** Tool type */
  tool: QualityTool;
  /** Command to execute (if custom) */
  command?: string;
  /** Command arguments */
  args?: string[];
  /** Config file path (optional) */
  configFile?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable auto-fix */
  autoFix?: boolean;
}

/**
 * File pattern configuration
 */
export interface FilePatternConfig {
  /** Include patterns (glob) */
  include: string[];
  /** Exclude patterns (glob) */
  exclude?: string[];
  /** File extensions to check */
  extensions?: string[];
}

/**
 * Code quality hook configuration
 */
export interface CodeQualityConfig extends Partial<HookConfig> {
  /** Check types to run (default: [LINT]) */
  checkTypes?: QualityCheckType[];
  /** Tool configurations */
  tools?: ToolConfig[];
  /** File patterns to check */
  filePatterns?: FilePatternConfig;
  /** Fail on errors (default: true) */
  failOnError?: boolean;
  /** Fail on warnings (default: false) */
  failOnWarning?: boolean;
  /** Maximum errors allowed before failing (0 = no limit) */
  maxErrors?: number;
  /** Maximum warnings allowed before failing (0 = no limit) */
  maxWarnings?: number;
  /** Enable auto-fix for fixable issues (default: false) */
  autoFix?: boolean;
  /** Cache results for faster subsequent runs (default: true) */
  enableCache?: boolean;
  /** Cache directory */
  cacheDir?: string;
  /** Enable parallel execution of checks (default: true) */
  parallel?: boolean;
  /** Timeout for each check in milliseconds (default: 60000) */
  checkTimeout?: number;
  /** Enable detailed logging */
  verbose?: boolean;
}

/**
 * Check result for a single tool
 */
export interface ToolCheckResult {
  /** Tool used */
  tool: QualityTool;
  /** Check type */
  checkType: QualityCheckType;
  /** Whether check passed */
  passed: boolean;
  /** Issues found */
  issues: QualityIssue[];
  /** Error count */
  errorCount: number;
  /** Warning count */
  warningCount: number;
  /** Info count */
  infoCount: number;
  /** Files checked */
  filesChecked: number;
  /** Files with issues */
  filesWithIssues: number;
  /** Fixes applied (if auto-fix enabled) */
  fixesApplied: number;
  /** Execution time in milliseconds */
  executionTimeMs: number;
  /** Raw output from tool */
  rawOutput?: string;
  /** Error message if check failed to run */
  error?: string;
}

/**
 * Overall quality check result
 */
export interface QualityCheckResult {
  /** Whether all checks passed */
  passed: boolean;
  /** Individual tool results */
  toolResults: ToolCheckResult[];
  /** All issues across all tools */
  issues: QualityIssue[];
  /** Total error count */
  totalErrors: number;
  /** Total warning count */
  totalWarnings: number;
  /** Total files checked */
  totalFilesChecked: number;
  /** Total fixes applied */
  totalFixesApplied: number;
  /** Total execution time in milliseconds */
  totalExecutionTimeMs: number;
  /** Timestamp when check started */
  startedAt: Date;
  /** Timestamp when check completed */
  completedAt: Date;
}

/**
 * Quality check metrics
 */
export interface CodeQualityMetrics {
  /** Total checks performed */
  totalChecks: number;
  /** Passed checks */
  passedChecks: number;
  /** Failed checks */
  failedChecks: number;
  /** Total issues found */
  totalIssues: number;
  /** Total errors found */
  totalErrors: number;
  /** Total warnings found */
  totalWarnings: number;
  /** Total fixes applied */
  totalFixesApplied: number;
  /** Total files checked */
  totalFilesChecked: number;
  /** Checks by type */
  checksByType: Record<QualityCheckType, number>;
  /** Checks by tool */
  checksByTool: Record<QualityTool, number>;
  /** Issues by rule (top 10) */
  issuesByRule: Record<string, number>;
  /** Total execution time in milliseconds */
  totalExecutionTimeMs: number;
  /** Last check timestamp */
  lastCheckAt?: Date;
}

/**
 * Code quality event data
 */
export interface CodeQualityEventData {
  /** Check result */
  result: QualityCheckResult;
  /** Current metrics */
  metrics: CodeQualityMetrics;
  /** Files that were checked */
  files?: string[];
}

/**
 * Quality check callback types
 */
export type CheckStartedCallback = (checkTypes: QualityCheckType[], files: string[]) => void;
export type CheckCompletedCallback = (result: QualityCheckResult) => void;
export type IssueFoundCallback = (issue: QualityIssue) => void;
export type FixAppliedCallback = (issue: QualityIssue, fix: IssueFix) => void;

/**
 * Code quality subscription
 */
export interface CodeQualitySubscription {
  /** Subscription ID */
  id: string;
  /** Unsubscribe function */
  unsubscribe(): void;
}

/**
 * Quality checker interface
 */
export interface IQualityChecker {
  /**
   * Run quality checks on files
   */
  check(files: string[], checkTypes?: QualityCheckType[]): Promise<QualityCheckResult>;

  /**
   * Run quality check with a specific tool
   */
  checkWithTool(files: string[], tool: QualityTool): Promise<ToolCheckResult>;

  /**
   * Fix issues automatically
   */
  fix(files: string[], checkTypes?: QualityCheckType[]): Promise<QualityCheckResult>;

  /**
   * Get available tools
   */
  getAvailableTools(): Promise<QualityTool[]>;

  /**
   * Check if a tool is available
   */
  isToolAvailable(tool: QualityTool): Promise<boolean>;
}

/**
 * Default tool configurations
 */
export const DEFAULT_TOOL_CONFIGS: Record<QualityTool, Partial<ToolConfig>> = {
  [QualityTool.ESLINT]: {
    tool: QualityTool.ESLINT,
    command: 'npx',
    args: ['eslint', '--format', 'json'],
    timeout: 60000,
  },
  [QualityTool.PRETTIER]: {
    tool: QualityTool.PRETTIER,
    command: 'npx',
    args: ['prettier', '--check'],
    timeout: 30000,
  },
  [QualityTool.TSC]: {
    tool: QualityTool.TSC,
    command: 'npx',
    args: ['tsc', '--noEmit'],
    timeout: 120000,
  },
  [QualityTool.JEST]: {
    tool: QualityTool.JEST,
    command: 'npx',
    args: ['jest', '--passWithNoTests', '--json'],
    timeout: 300000,
  },
  [QualityTool.VITEST]: {
    tool: QualityTool.VITEST,
    command: 'npx',
    args: ['vitest', 'run', '--reporter=json'],
    timeout: 300000,
  },
  [QualityTool.BIOME]: {
    tool: QualityTool.BIOME,
    command: 'npx',
    args: ['biome', 'check', '--reporter=json'],
    timeout: 60000,
  },
  [QualityTool.CUSTOM]: {
    tool: QualityTool.CUSTOM,
    timeout: 60000,
  },
};

/**
 * Default file patterns by check type
 */
export const DEFAULT_FILE_PATTERNS: Record<QualityCheckType, FilePatternConfig> = {
  [QualityCheckType.LINT]: {
    include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  [QualityCheckType.FORMAT]: {
    include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json', '**/*.md'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md'],
  },
  [QualityCheckType.TYPE_CHECK]: {
    include: ['**/*.ts', '**/*.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    extensions: ['.ts', '.tsx'],
  },
  [QualityCheckType.TEST]: {
    include: ['**/*.test.ts', '**/*.spec.ts', '**/*.test.tsx', '**/*.spec.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    extensions: ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx'],
  },
  [QualityCheckType.ALL]: {
    include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
};

/**
 * Default configuration values
 */
export const DEFAULT_CODE_QUALITY_CONFIG: Required<
  Omit<CodeQualityConfig, 'tools' | 'filePatterns' | 'cacheDir' | 'name' | 'description' | 'event' | 'conditions'>
> = {
  priority: 85,
  enabled: true,
  timeout: 300000, // 5 minutes total
  retryOnError: false,
  checkTypes: [QualityCheckType.LINT],
  failOnError: true,
  failOnWarning: false,
  maxErrors: 0,
  maxWarnings: 0,
  autoFix: false,
  enableCache: true,
  parallel: true,
  checkTimeout: 60000, // 1 minute per check
  verbose: false,
};

/**
 * Map check types to default tools
 */
export const CHECK_TYPE_TO_TOOLS: Record<QualityCheckType, QualityTool[]> = {
  [QualityCheckType.LINT]: [QualityTool.ESLINT],
  [QualityCheckType.FORMAT]: [QualityTool.PRETTIER],
  [QualityCheckType.TYPE_CHECK]: [QualityTool.TSC],
  [QualityCheckType.TEST]: [QualityTool.JEST],
  [QualityCheckType.ALL]: [QualityTool.ESLINT, QualityTool.PRETTIER, QualityTool.TSC],
};
