/**
 * Static Analysis Types
 *
 * Type definitions for code analysis and auto-fix functionality.
 *
 * Feature: F4.5 - Auto Issue Detection and Fix
 */

/**
 * Analysis result from static analyzer
 */
export interface AnalysisResult {
  file: string;
  line: number;
  column: number;
  severity: AnalysisSeverity;
  rule: string;
  message: string;
  fixable: boolean;
  source?: string; // Code snippet
  fix?: AnalysisFix;
}

/**
 * Severity levels
 */
export enum AnalysisSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * Fix information
 */
export interface AnalysisFix {
  range: [number, number];
  text: string;
}

/**
 * Analysis report
 */
export interface AnalysisReport {
  totalFiles: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  infos: number;
  fixable: number;
  results: AnalysisResult[];
  analyzedAt: number;
  duration: number;
}

/**
 * Fix report
 */
export interface FixReport {
  fixed: AnalysisResult[];
  failed: AnalysisResult[];
  manual: AnalysisResult[];
  filesModified: string[];
  prCreated?: {
    number: number;
    url: string;
  };
  issueCreated?: {
    number: number;
    url: string;
  };
}

/**
 * Analyzer configuration
 */
export interface AnalyzerConfig {
  includePaths?: string[];
  excludePaths?: string[];
  rules?: Record<string, 'error' | 'warn' | 'off'>;
  autoFix?: boolean;
  maxIssues?: number;
}

/**
 * Analyzer type
 */
export enum AnalyzerType {
  ESLINT = 'eslint',
  TYPESCRIPT = 'typescript',
  PRETTIER = 'prettier',
}
