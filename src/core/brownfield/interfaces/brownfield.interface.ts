/**
 * Brownfield Analyzer Interfaces
 *
 * Defines abstractions for analyzing existing codebases to understand
 * structure, patterns, technical debt, and improvement opportunities.
 *
 * @module core/brownfield/interfaces
 */

/**
 * Code pattern identified in analysis
 */
export interface CodePattern {
  /** Pattern name */
  name: string;
  /** Pattern category */
  category: 'architectural' | 'design' | 'implementation' | 'testing';
  /** Number of occurrences */
  occurrences: number;
  /** File paths where pattern is found */
  locations: string[];
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Technical debt item
 */
export interface TechDebtItem {
  /** Debt type */
  type: 'code-smell' | 'outdated-dep' | 'missing-tests' | 'poor-naming' | 'dead-code' | 'complexity';
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Description */
  description: string;
  /** Affected file(s) */
  files: string[];
  /** Estimated effort to fix */
  effort: 'trivial' | 'small' | 'medium' | 'large';
}

/**
 * Dependency analysis
 */
export interface DependencyAnalysis {
  /** Total direct dependencies */
  directDeps: number;
  /** Total dev dependencies */
  devDeps: number;
  /** Outdated dependencies */
  outdated: string[];
  /** Unused dependencies */
  unused: string[];
  /** Duplicate/overlapping dependencies */
  duplicates: string[];
}

/**
 * Codebase metrics
 */
export interface CodebaseMetrics {
  /** Total lines of code */
  totalLoc: number;
  /** Total files */
  totalFiles: number;
  /** Languages detected */
  languages: Record<string, number>;
  /** Average file size in LOC */
  avgFileSize: number;
  /** Largest files */
  largestFiles: Array<{ path: string; loc: number }>;
  /** Test coverage estimate (0-100) */
  testCoverageEstimate: number;
}

/**
 * Brownfield analysis result
 */
export interface BrownfieldAnalysis {
  /** Project name */
  projectName: string;
  /** Analysis timestamp */
  analyzedAt: string;
  /** Codebase metrics */
  metrics: CodebaseMetrics;
  /** Identified patterns */
  patterns: CodePattern[];
  /** Technical debt items */
  techDebt: TechDebtItem[];
  /** Dependency analysis */
  dependencies: DependencyAnalysis;
  /** Improvement recommendations */
  recommendations: string[];
  /** Overall health score (0-100) */
  healthScore: number;
}

/**
 * Analyzer options
 */
export interface BrownfieldOptions {
  /** Include dependency analysis */
  analyzeDeps?: boolean;
  /** Include pattern detection */
  detectPatterns?: boolean;
  /** Include tech debt scan */
  scanTechDebt?: boolean;
  /** File patterns to include */
  includePatterns?: string[];
  /** File patterns to exclude */
  excludePatterns?: string[];
  /** Maximum files to analyze */
  maxFiles?: number;
}

/**
 * Brownfield analyzer interface
 */
export interface IBrownfieldAnalyzer {
  /** Run full brownfield analysis */
  analyze(rootPath: string, options?: BrownfieldOptions): Promise<BrownfieldAnalysis>;

  /** Get only codebase metrics */
  getMetrics(rootPath: string): Promise<CodebaseMetrics>;

  /** Scan for technical debt */
  scanTechDebt(rootPath: string): Promise<TechDebtItem[]>;

  /** Detect code patterns */
  detectPatterns(rootPath: string): Promise<CodePattern[]>;
}
