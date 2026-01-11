/**
 * Code Scanning Interfaces
 *
 * Feature: F5.6 - Code Scanning 심화
 * Provides advanced code scanning with static analysis, dependency vulnerability
 * detection, and secret leak detection
 *
 * @module core/security/scanning
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';
import { SecurityIssueSeverity } from '../plugin/plugin-security.interface.js';

// Re-export for convenience
export { SecurityIssueSeverity };

// ==================== Common Types ====================

/**
 * Scan target type
 */
export type ScanTargetType = 'file' | 'directory' | 'code' | 'dependency' | 'repository';

/**
 * Programming language
 */
export type ProgrammingLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'csharp'
  | 'cpp'
  | 'shell'
  | 'yaml'
  | 'json'
  | 'unknown';

/**
 * Scan category
 */
export type ScanCategory =
  | 'code-injection'
  | 'command-injection'
  | 'sql-injection'
  | 'xss'
  | 'path-traversal'
  | 'prototype-pollution'
  | 'deserialization'
  | 'crypto'
  | 'transport'
  | 'secrets'
  | 'dependency'
  | 'configuration'
  | 'authentication'
  | 'authorization'
  | 'logging'
  | 'redos'
  | 'information-disclosure'
  | 'denial-of-service'
  | 'other';

/**
 * Location in source code
 */
export interface SourceLocation {
  /** File path (relative or absolute) */
  file: string;
  /** Line number (1-based) */
  line: number;
  /** Column number (1-based) */
  column?: number;
  /** End line (for multi-line issues) */
  endLine?: number;
  /** End column */
  endColumn?: number;
  /** Code snippet */
  snippet?: string;
}

/**
 * Base scan issue
 */
export interface ScanIssue {
  /** Unique issue ID */
  id: string;
  /** Rule ID that triggered this issue */
  ruleId: string;
  /** Issue severity */
  severity: SecurityIssueSeverity;
  /** Issue category */
  category: ScanCategory;
  /** Short title */
  title: string;
  /** Detailed message */
  message: string;
  /** Source location */
  location?: SourceLocation;
  /** Suggested fix */
  suggestion?: string;
  /** Reference links */
  references?: string[];
  /** Confidence level (0-1) */
  confidence: number;
  /** Whether this might be a false positive */
  potentialFalsePositive?: boolean;
  /** CWE ID if applicable */
  cweId?: string;
  /** CVE ID if applicable */
  cveId?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Base scan result
 */
export interface BaseScanResult {
  /** Whether scan completed successfully */
  success: boolean;
  /** Scan start time */
  startTime: Date;
  /** Scan end time */
  endTime: Date;
  /** Scan duration in ms */
  duration: number;
  /** Issues found */
  issues: ScanIssue[];
  /** Files scanned */
  filesScanned: number;
  /** Lines scanned */
  linesScanned: number;
  /** Errors encountered during scan */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

// ==================== Static Analysis Types ====================

/**
 * Static analysis rule
 */
export interface StaticAnalysisRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Rule description */
  description: string;
  /** Rule severity */
  severity: SecurityIssueSeverity;
  /** Rule category */
  category: ScanCategory;
  /** Pattern (regex or function) */
  pattern: RegExp | ((code: string, language: ProgrammingLanguage) => ScanIssue[]);
  /** Languages this rule applies to */
  languages?: ProgrammingLanguage[];
  /** Whether rule is enabled by default */
  enabled: boolean;
  /** CWE ID */
  cweId?: string;
  /** References */
  references?: string[];
  /** Suggested fix template */
  fixTemplate?: string;
}

/**
 * Static analysis options
 */
export interface StaticAnalysisOptions {
  /** Rules to include (by ID or category) */
  includeRules?: string[];
  /** Rules to exclude */
  excludeRules?: string[];
  /** Languages to analyze */
  languages?: ProgrammingLanguage[];
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Maximum file size to analyze (bytes) */
  maxFileSize?: number;
  /** Analysis timeout (ms) */
  timeout?: number;
  /** Minimum severity to report */
  minSeverity?: SecurityIssueSeverity;
  /** Include potential false positives */
  includeFalsePositives?: boolean;
  /** Enable AST-based analysis */
  enableAstAnalysis?: boolean;
  /** Custom rules */
  customRules?: StaticAnalysisRule[];
}

/**
 * Static analysis result
 */
export interface StaticAnalysisResult extends BaseScanResult {
  /** Type of scan */
  type: 'static-analysis';
  /** Rules applied */
  rulesApplied: number;
  /** Issues by severity */
  issuesBySeverity: Record<SecurityIssueSeverity, number>;
  /** Issues by category */
  issuesByCategory: Record<string, number>;
  /** Language breakdown */
  languageBreakdown: Record<ProgrammingLanguage, { files: number; lines: number }>;
}

/**
 * Static Analyzer interface
 */
export interface IStaticAnalyzer extends IDisposable {
  /**
   * Analyze code string
   */
  analyzeCode(code: string, options?: StaticAnalysisOptions): Promise<StaticAnalysisResult>;

  /**
   * Analyze a file
   */
  analyzeFile(filePath: string, options?: StaticAnalysisOptions): Promise<StaticAnalysisResult>;

  /**
   * Analyze a directory
   */
  analyzeDirectory(dirPath: string, options?: StaticAnalysisOptions): Promise<StaticAnalysisResult>;

  /**
   * Get available rules
   */
  getRules(): StaticAnalysisRule[];

  /**
   * Add custom rule
   */
  addRule(rule: StaticAnalysisRule): void;

  /**
   * Remove rule
   */
  removeRule(ruleId: string): boolean;

  /**
   * Enable/disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void;
}

// ==================== Dependency Scanning Types ====================

/**
 * Dependency information
 */
export interface DependencyInfo {
  /** Package name */
  name: string;
  /** Current version */
  version: string;
  /** Latest available version */
  latestVersion?: string;
  /** Package manager */
  packageManager: 'npm' | 'pip' | 'maven' | 'go' | 'cargo' | 'gem' | 'nuget' | 'composer';
  /** Is dev dependency */
  isDev: boolean;
  /** Is transitive (indirect) dependency */
  isTransitive: boolean;
  /** Parent dependency (for transitive deps) */
  parent?: string;
  /** License */
  license?: string;
  /** Repository URL */
  repository?: string;
}

/**
 * Vulnerability information
 */
export interface VulnerabilityInfo {
  /** Vulnerability ID (CVE, GHSA, etc.) */
  id: string;
  /** Vulnerability source */
  source: 'cve' | 'ghsa' | 'snyk' | 'npm' | 'osv' | 'nvd' | 'other';
  /** Severity */
  severity: SecurityIssueSeverity;
  /** CVSS score (0-10) */
  cvssScore?: number;
  /** CVSS vector */
  cvssVector?: string;
  /** Title */
  title: string;
  /** Description */
  description: string;
  /** Affected versions */
  affectedVersions: string;
  /** Patched version */
  patchedVersion?: string;
  /** Vulnerable functions/paths */
  vulnerablePaths?: string[];
  /** Exploit available */
  exploitAvailable?: boolean;
  /** Publish date */
  publishedAt?: Date;
  /** Last modified */
  modifiedAt?: Date;
  /** References */
  references: string[];
  /** CWE IDs */
  cweIds?: string[];
}

/**
 * Vulnerable dependency
 */
export interface VulnerableDependency {
  /** Dependency info */
  dependency: DependencyInfo;
  /** Vulnerabilities */
  vulnerabilities: VulnerabilityInfo[];
  /** Remediation advice */
  remediation?: {
    /** Action to take */
    action: 'upgrade' | 'patch' | 'remove' | 'mitigate';
    /** Target version */
    targetVersion?: string;
    /** Breaking changes warning */
    breakingChanges?: boolean;
    /** Manual steps required */
    manualSteps?: string[];
  };
}

/**
 * Dependency scan options
 */
export interface DependencyScanOptions {
  /** Include dev dependencies */
  includeDevDependencies?: boolean;
  /** Include transitive dependencies */
  includeTransitive?: boolean;
  /** Package managers to scan */
  packageManagers?: DependencyInfo['packageManager'][];
  /** Minimum severity to report */
  minSeverity?: SecurityIssueSeverity;
  /** Vulnerability sources to check */
  sources?: VulnerabilityInfo['source'][];
  /** Offline mode (use local cache only) */
  offline?: boolean;
  /** Cache directory */
  cacheDir?: string;
  /** Cache TTL in seconds */
  cacheTtl?: number;
  /** Scan timeout (ms) */
  timeout?: number;
  /** Fail on severity level */
  failOnSeverity?: SecurityIssueSeverity;
  /** Ignore specific vulnerabilities */
  ignoreVulnerabilities?: string[];
}

/**
 * Dependency scan result
 */
export interface DependencyScanResult extends BaseScanResult {
  /** Type of scan */
  type: 'dependency-scan';
  /** Total dependencies */
  totalDependencies: number;
  /** Direct dependencies */
  directDependencies: number;
  /** Transitive dependencies */
  transitiveDependencies: number;
  /** Vulnerable dependencies */
  vulnerableDependencies: VulnerableDependency[];
  /** Outdated dependencies */
  outdatedDependencies: DependencyInfo[];
  /** Dependencies by package manager */
  byPackageManager: Record<string, number>;
  /** License summary */
  licenseSummary: Record<string, number>;
}

/**
 * Dependency Scanner interface
 */
export interface IDependencyScanner extends IDisposable {
  /**
   * Scan dependencies in a directory
   */
  scan(dirPath: string, options?: DependencyScanOptions): Promise<DependencyScanResult>;

  /**
   * Scan a specific package file
   */
  scanPackageFile(filePath: string, options?: DependencyScanOptions): Promise<DependencyScanResult>;

  /**
   * Check a specific package
   */
  checkPackage(
    name: string,
    version: string,
    packageManager: DependencyInfo['packageManager']
  ): Promise<VulnerabilityInfo[]>;

  /**
   * Update vulnerability database
   */
  updateDatabase(): Promise<{ updated: boolean; lastUpdate: Date }>;

  /**
   * Get database info
   */
  getDatabaseInfo(): { lastUpdate: Date; totalVulnerabilities: number; sources: string[] };

  /**
   * Add vulnerability to ignore list
   */
  ignoreVulnerability(id: string, reason: string, expiresAt?: Date): void;

  /**
   * Get ignored vulnerabilities
   */
  getIgnoredVulnerabilities(): Array<{ id: string; reason: string; expiresAt?: Date }>;
}

// ==================== Secret Detection Types ====================

/**
 * Secret type
 */
export type DetectedSecretType =
  | 'api_key'
  | 'aws_key'
  | 'aws_secret'
  | 'azure_key'
  | 'gcp_key'
  | 'github_token'
  | 'gitlab_token'
  | 'npm_token'
  | 'pypi_token'
  | 'slack_token'
  | 'slack_webhook'
  | 'stripe_key'
  | 'twilio_key'
  | 'sendgrid_key'
  | 'database_url'
  | 'connection_string'
  | 'private_key'
  | 'ssh_key'
  | 'password'
  | 'jwt'
  | 'oauth_token'
  | 'bearer_token'
  | 'basic_auth'
  | 'generic_secret'
  | 'unknown';

/**
 * Secret detection rule
 */
export interface SecretDetectionRule {
  /** Rule ID */
  id: string;
  /** Rule name */
  name: string;
  /** Secret type */
  secretType: DetectedSecretType;
  /** Detection pattern */
  pattern: RegExp;
  /** Severity */
  severity: SecurityIssueSeverity;
  /** Keywords that may indicate secrets */
  keywords?: string[];
  /** Entropy threshold (0-1) for additional validation */
  entropyThreshold?: number;
  /** Validation function */
  validate?: (match: string) => boolean;
  /** Whether to check for common false positives */
  checkFalsePositives?: boolean;
  /** False positive patterns */
  falsePositivePatterns?: RegExp[];
  /** Whether rule is enabled */
  enabled: boolean;
}

/**
 * Detected secret
 */
export interface DetectedSecret {
  /** Secret type */
  type: DetectedSecretType;
  /** Rule ID that detected this */
  ruleId: string;
  /** Location in source */
  location: SourceLocation;
  /** Masked value (showing only first/last few chars) */
  maskedValue: string;
  /** Full value (only for validation, should not be logged) */
  rawValue?: string;
  /** Entropy score */
  entropy: number;
  /** Confidence level */
  confidence: number;
  /** Whether verified as valid (e.g., API key format is correct) */
  verified: boolean;
  /** Whether this appears to be committed to version control */
  inVersionControl: boolean;
  /** Commit info if in version control */
  commitInfo?: {
    hash: string;
    author: string;
    date: Date;
    message: string;
  };
  /** Suggested remediation */
  remediation: string;
}

/**
 * Secret detection options
 */
export interface SecretDetectionOptions {
  /** Secret types to detect */
  secretTypes?: DetectedSecretType[];
  /** Rules to include */
  includeRules?: string[];
  /** Rules to exclude */
  excludeRules?: string[];
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Check version control history */
  checkHistory?: boolean;
  /** Maximum commits to check in history */
  maxHistoryCommits?: number;
  /** Entropy threshold for generic secrets */
  entropyThreshold?: number;
  /** Include potential false positives */
  includeFalsePositives?: boolean;
  /** Scan timeout (ms) */
  timeout?: number;
  /** Custom rules */
  customRules?: SecretDetectionRule[];
  /** Verify secrets (attempt to validate format/checksum) */
  verifySecrets?: boolean;
  /** Redact secrets in output */
  redactSecrets?: boolean;
}

/**
 * Secret detection result
 */
export interface SecretDetectionResult extends BaseScanResult {
  /** Type of scan */
  type: 'secret-detection';
  /** Secrets found */
  secrets: DetectedSecret[];
  /** Secrets by type */
  secretsByType: Record<DetectedSecretType, number>;
  /** Rules applied */
  rulesApplied: number;
  /** Files with secrets */
  filesWithSecrets: number;
  /** History scanned */
  historyScanned?: {
    commits: number;
    secretsInHistory: number;
  };
}

/**
 * Secret Detector interface
 */
export interface ISecretDetector extends IDisposable {
  /**
   * Detect secrets in code string
   */
  detectInCode(code: string, options?: SecretDetectionOptions): Promise<SecretDetectionResult>;

  /**
   * Detect secrets in file
   */
  detectInFile(filePath: string, options?: SecretDetectionOptions): Promise<SecretDetectionResult>;

  /**
   * Detect secrets in directory
   */
  detectInDirectory(dirPath: string, options?: SecretDetectionOptions): Promise<SecretDetectionResult>;

  /**
   * Detect secrets in git history
   */
  detectInHistory(
    repoPath: string,
    options?: SecretDetectionOptions
  ): Promise<SecretDetectionResult>;

  /**
   * Get available rules
   */
  getRules(): SecretDetectionRule[];

  /**
   * Add custom rule
   */
  addRule(rule: SecretDetectionRule): void;

  /**
   * Remove rule
   */
  removeRule(ruleId: string): boolean;

  /**
   * Calculate entropy of a string
   */
  calculateEntropy(str: string): number;

  /**
   * Mask a secret value
   */
  maskSecret(value: string, showChars?: number): string;
}

// ==================== Unified Scanner Types ====================

/**
 * Scan type
 */
export type ScanType = 'static-analysis' | 'dependency-scan' | 'secret-detection' | 'all';

/**
 * Unified scan options
 */
export interface CodeScannerOptions {
  /** Types of scans to run */
  scanTypes?: ScanType[];
  /** Static analysis options */
  staticAnalysis?: StaticAnalysisOptions;
  /** Dependency scan options */
  dependencyScan?: DependencyScanOptions;
  /** Secret detection options */
  secretDetection?: SecretDetectionOptions;
  /** Parallel scanning */
  parallel?: boolean;
  /** Overall timeout (ms) */
  timeout?: number;
  /** Fail on severity level */
  failOnSeverity?: SecurityIssueSeverity;
  /** Output format */
  outputFormat?: 'json' | 'sarif' | 'html' | 'text';
}

/**
 * Unified scan result
 */
export interface CodeScannerResult {
  /** Overall success */
  success: boolean;
  /** Scan start time */
  startTime: Date;
  /** Scan end time */
  endTime: Date;
  /** Total duration */
  duration: number;
  /** Target scanned */
  target: string;
  /** Target type */
  targetType: ScanTargetType;
  /** Static analysis result */
  staticAnalysis?: StaticAnalysisResult;
  /** Dependency scan result */
  dependencyScan?: DependencyScanResult;
  /** Secret detection result */
  secretDetection?: SecretDetectionResult;
  /** Summary */
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    infoIssues: number;
    filesScanned: number;
    linesScanned: number;
    dependenciesScanned?: number;
    secretsFound?: number;
  };
  /** Errors */
  errors: string[];
}

/**
 * Unified Code Scanner interface
 */
export interface ICodeScanner extends IDisposable {
  /**
   * Scan code string
   */
  scanCode(code: string, options?: CodeScannerOptions): Promise<CodeScannerResult>;

  /**
   * Scan a file
   */
  scanFile(filePath: string, options?: CodeScannerOptions): Promise<CodeScannerResult>;

  /**
   * Scan a directory
   */
  scanDirectory(dirPath: string, options?: CodeScannerOptions): Promise<CodeScannerResult>;

  /**
   * Scan a repository
   */
  scanRepository(repoPath: string, options?: CodeScannerOptions): Promise<CodeScannerResult>;

  /**
   * Get static analyzer
   */
  getStaticAnalyzer(): IStaticAnalyzer;

  /**
   * Get dependency scanner
   */
  getDependencyScanner(): IDependencyScanner;

  /**
   * Get secret detector
   */
  getSecretDetector(): ISecretDetector;

  /**
   * Generate report
   */
  generateReport(result: CodeScannerResult, format: CodeScannerOptions['outputFormat']): string;
}

// ==================== Constants ====================

/**
 * Default file patterns to exclude from scanning
 */
export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/vendor/**',
  '**/third_party/**',
  '**/__pycache__/**',
  '**/*.pyc',
  '**/target/**',
  '**/bin/**',
  '**/obj/**',
  '**/.venv/**',
  '**/venv/**',
];

/**
 * File extension to language mapping
 */
export const EXTENSION_TO_LANGUAGE: Record<string, ProgrammingLanguage> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  '.py': 'python',
  '.pyw': 'python',
  '.java': 'java',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'cpp',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
};

/**
 * Severity weights for scoring
 */
export const SEVERITY_WEIGHTS: Record<SecurityIssueSeverity, number> = {
  [SecurityIssueSeverity.CRITICAL]: 10,
  [SecurityIssueSeverity.HIGH]: 7,
  [SecurityIssueSeverity.MEDIUM]: 4,
  [SecurityIssueSeverity.LOW]: 2,
  [SecurityIssueSeverity.INFO]: 1,
};
