/**
 * AST-Grep Tool Interfaces
 *
 * Defines types and interfaces for AST-based code search and transformation.
 * Provides pattern matching, refactoring, and linting capabilities using
 * Abstract Syntax Tree analysis.
 *
 * @module core/tools/ast-grep/ast-grep.interface
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Supported programming languages for AST analysis
 */
export enum ASTLanguage {
  TYPESCRIPT = 'typescript',
  JAVASCRIPT = 'javascript',
  TSX = 'tsx',
  JSX = 'jsx',
  PYTHON = 'python',
  RUST = 'rust',
  GO = 'go',
  JAVA = 'java',
  C = 'c',
  CPP = 'cpp',
  CSHARP = 'csharp',
  KOTLIN = 'kotlin',
  SWIFT = 'swift',
  RUBY = 'ruby',
  LUA = 'lua',
  HTML = 'html',
  CSS = 'css',
  JSON = 'json',
  YAML = 'yaml',
  TOML = 'toml',
}

/**
 * Position in source code
 */
export interface ASTPosition {
  line: number;
  column: number;
  offset: number;
}

/**
 * Range in source code
 */
export interface ASTRange {
  start: ASTPosition;
  end: ASTPosition;
}

/**
 * Location of a match in a file
 */
export interface ASTLocation {
  file: string;
  range: ASTRange;
}

// ============================================================================
// Match Types
// ============================================================================

/**
 * Captured metavariable in a pattern match
 */
export interface ASTMetaVariable {
  name: string;
  text: string;
  range: ASTRange;
}

/**
 * Single match result from AST pattern search
 */
export interface ASTMatch {
  /** The matched source text */
  text: string;

  /** Location of the match */
  location: ASTLocation;

  /** Captured metavariables (e.g., $VAR, $EXPR) */
  metaVariables: Record<string, ASTMetaVariable>;

  /** The AST node kind/type */
  nodeKind: string;

  /** Surrounding context lines */
  context?: ASTMatchContext;
}

/**
 * Context around a match for display purposes
 */
export interface ASTMatchContext {
  before: string[];
  after: string[];
  lineNumbers: {
    start: number;
    end: number;
  };
}

/**
 * Collection of matches from a search operation
 */
export interface ASTSearchResult {
  /** Total number of matches */
  matchCount: number;

  /** Number of files with matches */
  fileCount: number;

  /** Matches grouped by file */
  matchesByFile: Record<string, ASTMatch[]>;

  /** All matches in order */
  matches: ASTMatch[];

  /** Search duration in milliseconds */
  duration: number;

  /** Pattern used for search */
  pattern: string;

  /** Language used */
  language: ASTLanguage;
}

// ============================================================================
// Rule Types
// ============================================================================

/**
 * Severity level for rule violations
 */
export enum ASTRuleSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  HINT = 'hint',
  OFF = 'off',
}

/**
 * Rule category for organization
 */
export enum ASTRuleCategory {
  STYLE = 'style',
  CORRECTNESS = 'correctness',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  BEST_PRACTICE = 'best-practice',
  DEPRECATED = 'deprecated',
  CUSTOM = 'custom',
}

/**
 * Constraint for pattern matching
 */
export interface ASTPatternConstraint {
  /** Metavariable to constrain */
  metaVariable: string;

  /** Regular expression pattern */
  regex?: string;

  /** Must match one of these patterns */
  patterns?: string[];

  /** Must NOT match any of these patterns */
  notPatterns?: string[];

  /** Node kind constraint */
  kind?: string;

  /** Must contain this substring */
  contains?: string;

  /** Must NOT contain this substring */
  notContains?: string;
}

/**
 * Fix/transformation for a rule
 */
export interface ASTRuleFix {
  /** Replacement template using metavariables */
  replacement: string;

  /** Optional message describing the fix */
  message?: string;
}

/**
 * AST-Grep rule definition
 */
export interface ASTRule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable rule name */
  name: string;

  /** Detailed description */
  description?: string;

  /** Target language(s) */
  language: ASTLanguage | ASTLanguage[];

  /** Pattern to match */
  pattern: string;

  /** Alternative patterns (OR relationship) */
  patterns?: string[];

  /** Additional constraints */
  constraints?: ASTPatternConstraint[];

  /** Pattern that must also match (AND relationship) */
  inside?: string;

  /** Pattern that must NOT match */
  notInside?: string;

  /** Pattern that must contain */
  has?: string;

  /** Pattern that must NOT contain */
  notHas?: string;

  /** Follows another pattern */
  follows?: string;

  /** Precedes another pattern */
  precedes?: string;

  /** Severity level */
  severity: ASTRuleSeverity;

  /** Category */
  category: ASTRuleCategory;

  /** Suggested fix */
  fix?: ASTRuleFix;

  /** Optional tags for filtering */
  tags?: string[];

  /** Whether rule is enabled */
  enabled: boolean;

  /** Rule metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Violation found by a rule
 */
export interface ASTRuleViolation {
  /** Rule that was violated */
  rule: ASTRule;

  /** Match that triggered the violation */
  match: ASTMatch;

  /** Human-readable message */
  message: string;

  /** Suggested fix if available */
  suggestedFix?: string;
}

/**
 * Result of running rules on code
 */
export interface ASTLintResult {
  /** All violations found */
  violations: ASTRuleViolation[];

  /** Violations grouped by file */
  violationsByFile: Record<string, ASTRuleViolation[]>;

  /** Violations grouped by severity */
  violationsBySeverity: Record<ASTRuleSeverity, ASTRuleViolation[]>;

  /** Number of files analyzed */
  filesAnalyzed: number;

  /** Total violations */
  totalViolations: number;

  /** Duration in milliseconds */
  duration: number;

  /** Rules that were run */
  rulesRun: string[];
}

// ============================================================================
// Transformation Types
// ============================================================================

/**
 * Single code transformation
 */
export interface ASTTransformation {
  /** Location to transform */
  location: ASTLocation;

  /** Original text */
  originalText: string;

  /** Replacement text */
  replacementText: string;

  /** Rule that triggered this (if applicable) */
  ruleId?: string;

  /** Description of the transformation */
  description?: string;
}

/**
 * Rewrite rule for transformations
 */
export interface ASTRewriteRule {
  /** Pattern to match */
  pattern: string;

  /** Replacement template */
  replacement: string;

  /** Target language */
  language: ASTLanguage;

  /** Optional constraints */
  constraints?: ASTPatternConstraint[];

  /** Description */
  description?: string;
}

/**
 * Result of applying transformations
 */
export interface ASTRewriteResult {
  /** Transformations that were applied */
  transformations: ASTTransformation[];

  /** Files that were modified */
  modifiedFiles: string[];

  /** New content by file (before writing) */
  newContent: Record<string, string>;

  /** Number of replacements made */
  replacementCount: number;

  /** Duration in milliseconds */
  duration: number;

  /** Whether changes were actually written */
  applied: boolean;

  /** Errors encountered */
  errors: ASTError[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error type enumeration
 */
export enum ASTErrorType {
  PARSE_ERROR = 'parse_error',
  PATTERN_ERROR = 'pattern_error',
  FILE_ERROR = 'file_error',
  LANGUAGE_ERROR = 'language_error',
  CONSTRAINT_ERROR = 'constraint_error',
  TRANSFORMATION_ERROR = 'transformation_error',
  CONFIGURATION_ERROR = 'configuration_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * AST operation error
 */
export interface ASTError {
  type: ASTErrorType;
  message: string;
  file?: string;
  position?: ASTPosition;
  details?: unknown;
}

// ============================================================================
// Operation Result Types
// ============================================================================

/**
 * Generic operation result
 */
export interface ASTOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: ASTError[];
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Search options
 */
export interface ASTSearchOptions {
  /** Languages to search in (auto-detect if not specified) */
  languages?: ASTLanguage[];

  /** File patterns to include (glob) */
  include?: string[];

  /** File patterns to exclude (glob) */
  exclude?: string[];

  /** Maximum number of matches to return */
  maxMatches?: number;

  /** Include context lines around matches */
  contextLines?: number;

  /** Case-sensitive matching */
  caseSensitive?: boolean;

  /** Search in hidden files/directories */
  includeHidden?: boolean;

  /** Respect .gitignore */
  respectGitignore?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Lint options
 */
export interface ASTLintOptions {
  /** Rules to run (all if not specified) */
  ruleIds?: string[];

  /** Minimum severity to report */
  minSeverity?: ASTRuleSeverity;

  /** Categories to include */
  categories?: ASTRuleCategory[];

  /** File patterns to include */
  include?: string[];

  /** File patterns to exclude */
  exclude?: string[];

  /** Maximum violations before stopping */
  maxViolations?: number;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Rewrite options
 */
export interface ASTRewriteOptions {
  /** Dry run (don't actually write changes) */
  dryRun?: boolean;

  /** File patterns to include */
  include?: string[];

  /** File patterns to exclude */
  exclude?: string[];

  /** Create backup files */
  backup?: boolean;

  /** Backup file extension */
  backupExtension?: string;

  /** Interactive mode (confirm each change) */
  interactive?: boolean;

  /** Maximum files to modify */
  maxFiles?: number;

  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * AST-Grep client configuration
 */
export interface ASTGrepClientConfig {
  /** Path to ast-grep binary (uses system PATH if not specified) */
  binaryPath?: string;

  /** Default working directory */
  cwd?: string;

  /** Default search options */
  defaultSearchOptions?: Partial<ASTSearchOptions>;

  /** Default lint options */
  defaultLintOptions?: Partial<ASTLintOptions>;

  /** Default rewrite options */
  defaultRewriteOptions?: Partial<ASTRewriteOptions>;

  /** Custom rules directory */
  rulesDirectory?: string;

  /** Enable caching */
  enableCache?: boolean;

  /** Cache TTL in milliseconds */
  cacheTtl?: number;

  /** Maximum concurrent operations */
  maxConcurrency?: number;

  /** Default timeout in milliseconds */
  defaultTimeout?: number;
}

// ============================================================================
// Client Interface
// ============================================================================

/**
 * AST-Grep client interface
 *
 * Provides methods for AST-based code search, transformation, and linting.
 */
export interface IASTGrepClient {
  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /**
   * Initialize the client
   */
  initialize(config?: ASTGrepClientConfig): Promise<ASTOperationResult>;

  /**
   * Dispose resources
   */
  dispose(): Promise<ASTOperationResult>;

  /**
   * Check if AST-Grep is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get AST-Grep version
   */
  getVersion(): Promise<ASTOperationResult<string>>;

  // -------------------------------------------------------------------------
  // Search Operations
  // -------------------------------------------------------------------------

  /**
   * Search for a pattern in a file
   */
  searchFile(
    file: string,
    pattern: string,
    language?: ASTLanguage,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>>;

  /**
   * Search for a pattern in a directory
   */
  searchDirectory(
    directory: string,
    pattern: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>>;

  /**
   * Search for a pattern in source code string
   */
  searchCode(
    code: string,
    pattern: string,
    language: ASTLanguage,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>>;

  /**
   * Find all occurrences of a symbol
   */
  findSymbol(
    directory: string,
    symbolName: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>>;

  /**
   * Find function/method calls
   */
  findCalls(
    directory: string,
    functionName: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>>;

  /**
   * Find imports/requires
   */
  findImports(
    directory: string,
    moduleName: string,
    options?: ASTSearchOptions
  ): Promise<ASTOperationResult<ASTSearchResult>>;

  // -------------------------------------------------------------------------
  // Rule Management
  // -------------------------------------------------------------------------

  /**
   * Register a custom rule
   */
  registerRule(rule: ASTRule): ASTOperationResult;

  /**
   * Unregister a rule
   */
  unregisterRule(ruleId: string): ASTOperationResult;

  /**
   * Get a registered rule
   */
  getRule(ruleId: string): ASTRule | undefined;

  /**
   * Get all registered rules
   */
  getAllRules(): ASTRule[];

  /**
   * Get rules by category
   */
  getRulesByCategory(category: ASTRuleCategory): ASTRule[];

  /**
   * Get rules by language
   */
  getRulesByLanguage(language: ASTLanguage): ASTRule[];

  /**
   * Load rules from a YAML file
   */
  loadRulesFromFile(filePath: string): Promise<ASTOperationResult<ASTRule[]>>;

  /**
   * Load rules from a directory
   */
  loadRulesFromDirectory(
    directory: string
  ): Promise<ASTOperationResult<ASTRule[]>>;

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): ASTOperationResult;

  // -------------------------------------------------------------------------
  // Lint Operations
  // -------------------------------------------------------------------------

  /**
   * Lint a single file
   */
  lintFile(
    file: string,
    options?: ASTLintOptions
  ): Promise<ASTOperationResult<ASTLintResult>>;

  /**
   * Lint a directory
   */
  lintDirectory(
    directory: string,
    options?: ASTLintOptions
  ): Promise<ASTOperationResult<ASTLintResult>>;

  /**
   * Lint source code string
   */
  lintCode(
    code: string,
    language: ASTLanguage,
    options?: ASTLintOptions
  ): Promise<ASTOperationResult<ASTLintResult>>;

  // -------------------------------------------------------------------------
  // Rewrite/Transform Operations
  // -------------------------------------------------------------------------

  /**
   * Rewrite code in a file using a pattern and replacement
   */
  rewriteFile(
    file: string,
    pattern: string,
    replacement: string,
    language?: ASTLanguage,
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>>;

  /**
   * Rewrite code in a directory
   */
  rewriteDirectory(
    directory: string,
    pattern: string,
    replacement: string,
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>>;

  /**
   * Apply a rewrite rule
   */
  applyRewriteRule(
    directory: string,
    rule: ASTRewriteRule,
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>>;

  /**
   * Apply fixes from lint violations
   */
  applyFixes(
    violations: ASTRuleViolation[],
    options?: ASTRewriteOptions
  ): Promise<ASTOperationResult<ASTRewriteResult>>;

  /**
   * Transform code string
   */
  transformCode(
    code: string,
    pattern: string,
    replacement: string,
    language: ASTLanguage
  ): Promise<ASTOperationResult<string>>;

  // -------------------------------------------------------------------------
  // Analysis Operations
  // -------------------------------------------------------------------------

  /**
   * Parse source code and get AST structure
   */
  parseCode(
    code: string,
    language: ASTLanguage
  ): Promise<ASTOperationResult<ASTNode>>;

  /**
   * Parse a file and get AST structure
   */
  parseFile(file: string): Promise<ASTOperationResult<ASTNode>>;

  /**
   * Get the node kind at a position
   */
  getNodeKindAt(
    code: string,
    position: ASTPosition,
    language: ASTLanguage
  ): Promise<ASTOperationResult<string>>;

  /**
   * Get all node kinds in the code
   */
  getNodeKinds(
    code: string,
    language: ASTLanguage
  ): Promise<ASTOperationResult<string[]>>;

  // -------------------------------------------------------------------------
  // Utility Operations
  // -------------------------------------------------------------------------

  /**
   * Validate a pattern syntax
   */
  validatePattern(
    pattern: string,
    language: ASTLanguage
  ): Promise<ASTOperationResult<boolean>>;

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath: string): ASTLanguage | undefined;

  /**
   * Get supported languages
   */
  getSupportedLanguages(): ASTLanguage[];

  /**
   * Clear cache
   */
  clearCache(): void;

  /**
   * Get statistics
   */
  getStatistics(): ASTGrepStatistics;
}

// ============================================================================
// AST Node Types (for parsing)
// ============================================================================

/**
 * AST node representation
 */
export interface ASTNode {
  /** Node kind/type */
  kind: string;

  /** Node text content */
  text: string;

  /** Node range in source */
  range: ASTRange;

  /** Child nodes */
  children: ASTNode[];

  /** Named children (by field name) */
  namedChildren: Record<string, ASTNode | ASTNode[]>;

  /** Whether this is a named node */
  isNamed: boolean;

  /** Whether this node has errors */
  hasError: boolean;
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Client statistics
 */
export interface ASTGrepStatistics {
  /** Total searches performed */
  totalSearches: number;

  /** Total matches found */
  totalMatches: number;

  /** Total lints performed */
  totalLints: number;

  /** Total violations found */
  totalViolations: number;

  /** Total rewrites performed */
  totalRewrites: number;

  /** Total replacements made */
  totalReplacements: number;

  /** Average search duration */
  avgSearchDuration: number;

  /** Average lint duration */
  avgLintDuration: number;

  /** Cache hit rate */
  cacheHitRate: number;

  /** Files processed */
  filesProcessed: number;

  /** Errors encountered */
  errorsEncountered: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default client configuration
 */
export const DEFAULT_AST_GREP_CONFIG: ASTGrepClientConfig = {
  enableCache: true,
  cacheTtl: 60000, // 1 minute
  maxConcurrency: 4,
  defaultTimeout: 30000, // 30 seconds
  defaultSearchOptions: {
    contextLines: 2,
    caseSensitive: true,
    respectGitignore: true,
    includeHidden: false,
  },
  defaultLintOptions: {
    minSeverity: ASTRuleSeverity.WARNING,
  },
  defaultRewriteOptions: {
    dryRun: false,
    backup: false,
  },
};

// ============================================================================
// Language Mapping
// ============================================================================

/**
 * File extension to language mapping
 */
export const FILE_EXTENSION_LANGUAGE_MAP: Record<string, ASTLanguage> = {
  '.ts': ASTLanguage.TYPESCRIPT,
  '.tsx': ASTLanguage.TSX,
  '.js': ASTLanguage.JAVASCRIPT,
  '.jsx': ASTLanguage.JSX,
  '.mjs': ASTLanguage.JAVASCRIPT,
  '.cjs': ASTLanguage.JAVASCRIPT,
  '.py': ASTLanguage.PYTHON,
  '.pyi': ASTLanguage.PYTHON,
  '.rs': ASTLanguage.RUST,
  '.go': ASTLanguage.GO,
  '.java': ASTLanguage.JAVA,
  '.c': ASTLanguage.C,
  '.h': ASTLanguage.C,
  '.cpp': ASTLanguage.CPP,
  '.cc': ASTLanguage.CPP,
  '.cxx': ASTLanguage.CPP,
  '.hpp': ASTLanguage.CPP,
  '.hxx': ASTLanguage.CPP,
  '.cs': ASTLanguage.CSHARP,
  '.kt': ASTLanguage.KOTLIN,
  '.kts': ASTLanguage.KOTLIN,
  '.swift': ASTLanguage.SWIFT,
  '.rb': ASTLanguage.RUBY,
  '.lua': ASTLanguage.LUA,
  '.html': ASTLanguage.HTML,
  '.htm': ASTLanguage.HTML,
  '.css': ASTLanguage.CSS,
  '.scss': ASTLanguage.CSS,
  '.less': ASTLanguage.CSS,
  '.json': ASTLanguage.JSON,
  '.yaml': ASTLanguage.YAML,
  '.yml': ASTLanguage.YAML,
  '.toml': ASTLanguage.TOML,
};

// ============================================================================
// Pattern Templates
// ============================================================================

/**
 * Common pattern templates for quick access
 */
export const AST_PATTERN_TEMPLATES = {
  // JavaScript/TypeScript patterns
  js: {
    functionDeclaration: 'function $NAME($PARAMS) { $BODY }',
    arrowFunction: 'const $NAME = ($PARAMS) => $BODY',
    asyncFunction: 'async function $NAME($PARAMS) { $BODY }',
    classDeclaration: 'class $NAME { $BODY }',
    methodCall: '$OBJECT.$METHOD($ARGS)',
    import: "import $SPECIFIERS from '$MODULE'",
    require: "const $NAME = require('$MODULE')",
    consolelog: 'console.log($ARGS)',
    ifStatement: 'if ($CONDITION) { $BODY }',
    tryStatement: 'try { $TRY } catch ($ERROR) { $CATCH }',
    forLoop: 'for ($INIT; $CONDITION; $UPDATE) { $BODY }',
    forOfLoop: 'for (const $VAR of $ITERABLE) { $BODY }',
    awaitExpression: 'await $EXPR',
    objectProperty: '{ $KEY: $VALUE }',
    destructuring: 'const { $PROPS } = $OBJECT',
    templateLiteral: '`$CONTENT`',
    ternary: '$CONDITION ? $TRUE : $FALSE',
  },

  // Python patterns
  python: {
    functionDef: 'def $NAME($PARAMS):\n    $BODY',
    classDef: 'class $NAME:\n    $BODY',
    importStatement: 'import $MODULE',
    fromImport: 'from $MODULE import $NAMES',
    decorator: '@$DECORATOR\ndef $NAME($PARAMS):\n    $BODY',
    withStatement: 'with $CONTEXT as $VAR:\n    $BODY',
    listComprehension: '[$EXPR for $VAR in $ITERABLE]',
    dictComprehension: '{$KEY: $VALUE for $VAR in $ITERABLE}',
    asyncDef: 'async def $NAME($PARAMS):\n    $BODY',
  },

  // Go patterns
  go: {
    funcDeclaration: 'func $NAME($PARAMS) $RETURN { $BODY }',
    methodDeclaration: 'func ($RECEIVER $TYPE) $NAME($PARAMS) $RETURN { $BODY }',
    structDef: 'type $NAME struct { $FIELDS }',
    interfaceDef: 'type $NAME interface { $METHODS }',
    goRoutine: 'go $FUNC($ARGS)',
    deferStatement: 'defer $FUNC($ARGS)',
    errorCheck: 'if err != nil { $BODY }',
  },

  // Rust patterns
  rust: {
    fnDeclaration: 'fn $NAME($PARAMS) -> $RETURN { $BODY }',
    implBlock: 'impl $TRAIT for $TYPE { $BODY }',
    structDef: 'struct $NAME { $FIELDS }',
    enumDef: 'enum $NAME { $VARIANTS }',
    matchExpression: 'match $EXPR { $ARMS }',
    unwrap: '$EXPR.unwrap()',
    expect: '$EXPR.expect($MSG)',
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect language from file path
 */
export function detectLanguageFromPath(filePath: string): ASTLanguage | undefined {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return FILE_EXTENSION_LANGUAGE_MAP[ext];
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): language is ASTLanguage {
  return Object.values(ASTLanguage).includes(language as ASTLanguage);
}

/**
 * Get all supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(FILE_EXTENSION_LANGUAGE_MAP);
}

/**
 * Create a simple search pattern from a string
 */
export function createSearchPattern(
  text: string,
  options: { exactMatch?: boolean; captureAs?: string } = {}
): string {
  if (options.captureAs) {
    return `$${options.captureAs}`;
  }
  if (options.exactMatch) {
    return text;
  }
  return text;
}

/**
 * Create a metavariable reference
 */
export function metavar(name: string): string {
  return `$${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`;
}

/**
 * Create a multi-match metavariable (matches zero or more)
 */
export function multiMetavar(name: string): string {
  return `$$$${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`;
}
