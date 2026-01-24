/**
 * Code Quality Checker
 *
 * Analyzes code quality by parsing ESLint/TSLint results, calculating
 * cyclomatic complexity, and checking coding standards.
 *
 * @module core/quality/checks/code-quality-checker
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { QualityCheckResult, QualityDimension } from '../completion-detector.js';
import { createLogger, ILogger } from '../../services/logger.js';

const execAsync = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * ESLint message severity
 */
export enum ESLintSeverity {
  OFF = 0,
  WARN = 1,
  ERROR = 2,
}

/**
 * ESLint message
 */
export interface ESLintMessage {
  ruleId: string | null;
  severity: ESLintSeverity;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  fix?: {
    range: [number, number];
    text: string;
  };
}

/**
 * ESLint result for a file
 */
export interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
  fixableErrorCount: number;
  fixableWarningCount: number;
}

/**
 * Complexity metric for a file
 */
export interface FileComplexity {
  path: string;
  cyclomaticComplexity: number;
  cognitiveComplexity?: number;
  maintainabilityIndex?: number;
  linesOfCode: number;
  functions: FunctionComplexity[];
}

/**
 * Complexity metric for a function
 */
export interface FunctionComplexity {
  name: string;
  line: number;
  cyclomaticComplexity: number;
}

/**
 * Code quality summary
 */
export interface CodeQualitySummary {
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  fixableErrors: number;
  fixableWarnings: number;
  averageComplexity: number;
  maxComplexity: number;
  highComplexityFiles: string[];
  topIssues: Map<string, number>;
  files: ESLintResult[];
  complexityData: FileComplexity[];
}

/**
 * Code quality checker configuration
 */
export interface CodeQualityConfig {
  eslintConfig?: string;
  maxCyclomaticComplexity?: number;
  maxCognitiveComplexity?: number;
  maxLinesPerFile?: number;
  maxLinesPerFunction?: number;
  maxErrorsAllowed?: number;
  maxWarningsAllowed?: number;
  ignorePatterns?: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_CODE_QUALITY_CONFIG: CodeQualityConfig = {
  maxCyclomaticComplexity: 10,
  maxCognitiveComplexity: 15,
  maxLinesPerFile: 500,
  maxLinesPerFunction: 50,
  maxErrorsAllowed: 0,
  maxWarningsAllowed: 50,
  ignorePatterns: ['node_modules', 'dist', 'build', 'coverage'],
};

// ============================================================================
// Code Quality Checker Implementation
// ============================================================================

/**
 * Code quality checker for analyzing linting results and complexity
 */
export class CodeQualityChecker {
  private config: CodeQualityConfig;
  private readonly logger: ILogger = createLogger('CodeQualityChecker');

  constructor(config: Partial<CodeQualityConfig> = {}) {
    this.config = { ...DEFAULT_CODE_QUALITY_CONFIG, ...config };
  }

  /**
   * Check code quality for a workspace
   */
  async check(workspacePath: string): Promise<QualityCheckResult> {
    try {
      const summary = await this.getQualitySummary(workspacePath);
      return this.evaluateQuality(summary);
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  /**
   * Get comprehensive quality summary
   */
  async getQualitySummary(workspacePath: string): Promise<CodeQualitySummary> {
    // Try to get ESLint results
    const eslintResults = await this.getESLintResults(workspacePath);

    // Calculate complexity metrics
    const complexityData = await this.calculateComplexity(workspacePath);

    // Aggregate data
    const totalErrors = eslintResults.reduce((sum, r) => sum + r.errorCount, 0);
    const totalWarnings = eslintResults.reduce((sum, r) => sum + r.warningCount, 0);
    const fixableErrors = eslintResults.reduce((sum, r) => sum + r.fixableErrorCount, 0);
    const fixableWarnings = eslintResults.reduce((sum, r) => sum + r.fixableWarningCount, 0);

    // Find top issues
    const topIssues = new Map<string, number>();
    for (const result of eslintResults) {
      for (const message of result.messages) {
        if (message.ruleId) {
          topIssues.set(message.ruleId, (topIssues.get(message.ruleId) || 0) + 1);
        }
      }
    }

    // Calculate complexity stats
    const complexities = complexityData.map(f => f.cyclomaticComplexity);
    const averageComplexity = complexities.length > 0
      ? complexities.reduce((a, b) => a + b, 0) / complexities.length
      : 0;
    const maxComplexity = complexities.length > 0 ? Math.max(...complexities) : 0;
    const highComplexityFiles = complexityData
      .filter(f => f.cyclomaticComplexity > this.config.maxCyclomaticComplexity!)
      .map(f => f.path);

    return {
      totalFiles: eslintResults.length,
      totalErrors,
      totalWarnings,
      fixableErrors,
      fixableWarnings,
      averageComplexity: Math.round(averageComplexity * 10) / 10,
      maxComplexity,
      highComplexityFiles,
      topIssues,
      files: eslintResults,
      complexityData,
    };
  }

  /**
   * Get ESLint results from existing report or run ESLint
   */
  private async getESLintResults(workspacePath: string): Promise<ESLintResult[]> {
    // Try reading existing ESLint JSON report
    const reportPaths = [
      path.join(workspacePath, 'eslint-report.json'),
      path.join(workspacePath, '.eslint-report.json'),
      path.join(workspacePath, 'reports', 'eslint.json'),
    ];

    for (const reportPath of reportPaths) {
      const results = await this.parseESLintReport(reportPath);
      if (results) return results;
    }

    // Try running ESLint
    return this.runESLint(workspacePath);
  }

  /**
   * Parse ESLint JSON report
   */
  private async parseESLintReport(reportPath: string): Promise<ESLintResult[] | null> {
    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content) as ESLintResult[];
    } catch {
      return null;
    }
  }

  /**
   * Run ESLint and capture results
   */
  private async runESLint(workspacePath: string): Promise<ESLintResult[]> {
    try {
      // Check if ESLint is available
      const eslintPath = path.join(workspacePath, 'node_modules', '.bin', 'eslint');

      try {
        await fs.access(eslintPath);
      } catch {
        // ESLint not installed, return empty
        return [];
      }

      // Build ignore patterns
      const ignoreArgs = this.config.ignorePatterns
        ?.map(p => `--ignore-pattern "${p}"`)
        .join(' ') || '';

      const command = `"${eslintPath}" . --format json ${ignoreArgs} --no-error-on-unmatched-pattern 2>/dev/null || true`;

      const { stdout } = await execAsync(command, {
        cwd: workspacePath,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large projects
      });

      if (!stdout.trim()) return [];

      return JSON.parse(stdout) as ESLintResult[];
    } catch (error) {
      // If ESLint fails or isn't available, return empty array
      this.logger.warn('ESLint not available or failed', { error });
      return [];
    }
  }

  /**
   * Calculate cyclomatic complexity for source files
   */
  private async calculateComplexity(workspacePath: string): Promise<FileComplexity[]> {
    const results: FileComplexity[] = [];

    // Find TypeScript/JavaScript files
    const sourceFiles = await this.findSourceFiles(workspacePath);

    for (const filePath of sourceFiles.slice(0, 100)) { // Limit to 100 files for performance
      const complexity = await this.analyzeFileComplexity(filePath);
      if (complexity) {
        results.push(complexity);
      }
    }

    return results;
  }

  /**
   * Find source files in workspace
   */
  private async findSourceFiles(workspacePath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];

    async function walkDir(dir: string, ignorePatterns: string[]): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(workspacePath, fullPath);

          // Check ignore patterns
          if (ignorePatterns.some(p => relativePath.includes(p))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walkDir(fullPath, ignorePatterns);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }

    await walkDir(workspacePath, this.config.ignorePatterns || []);
    return files;
  }

  /**
   * Analyze complexity of a single file
   */
  private async analyzeFileComplexity(filePath: string): Promise<FileComplexity | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;

      // Simple cyclomatic complexity calculation
      // Count decision points: if, else, for, while, case, catch, &&, ||, ?:
      const cyclomaticComplexity = this.calculateCyclomaticComplexity(content);

      // Find function complexities
      const functions = this.analyzeFunctions(content, lines);

      return {
        path: filePath,
        cyclomaticComplexity,
        linesOfCode,
        functions,
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate cyclomatic complexity from source code
   */
  private calculateCyclomaticComplexity(content: string): number {
    // Start with base complexity of 1
    let complexity = 1;

    // Count decision points
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+[^:]+:/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]+\s*:/g, // Ternary operator
      /&&/g,
      /\|\|/g,
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Analyze function-level complexity
   */
  private analyzeFunctions(content: string, _lines: string[]): FunctionComplexity[] {
    const functions: FunctionComplexity[] = [];

    // Simple function detection patterns
    const functionPatterns = [
      /(?:async\s+)?function\s+(\w+)\s*\(/g,
      /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>)/g,
      /(\w+)\s*:\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)/g,
      /(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/g,
    ];

    for (const pattern of functionPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const funcName = match[1];
        const startPos = match.index;
        const lineNumber = content.substring(0, startPos).split('\n').length;

        // Find function body and calculate its complexity
        const funcBody = this.extractFunctionBody(content, startPos);
        const complexity = this.calculateCyclomaticComplexity(funcBody);

        // Avoid duplicates
        if (!functions.some(f => f.name === funcName && f.line === lineNumber)) {
          functions.push({
            name: funcName,
            line: lineNumber,
            cyclomaticComplexity: complexity,
          });
        }
      }
    }

    return functions;
  }

  /**
   * Extract function body from source
   */
  private extractFunctionBody(content: string, startPos: number): string {
    // Find opening brace
    let bracePos = content.indexOf('{', startPos);
    if (bracePos === -1) {
      // Arrow function without braces
      const arrowMatch = content.substring(startPos).match(/=>\s*([^{;]+)/);
      return arrowMatch ? arrowMatch[1] : '';
    }

    // Match braces to find function body
    let depth = 1;
    let pos = bracePos + 1;

    while (pos < content.length && depth > 0) {
      if (content[pos] === '{') depth++;
      else if (content[pos] === '}') depth--;
      pos++;
    }

    return content.substring(bracePos, pos);
  }

  /**
   * Evaluate quality against thresholds
   */
  private evaluateQuality(summary: CodeQualitySummary): QualityCheckResult {
    const issues: string[] = [];
    let score = 100;

    // Check errors
    if (summary.totalErrors > this.config.maxErrorsAllowed!) {
      issues.push(`${summary.totalErrors} ESLint errors (max: ${this.config.maxErrorsAllowed})`);
      score -= Math.min(40, summary.totalErrors * 5);
    }

    // Check warnings (less severe penalty)
    if (summary.totalWarnings > this.config.maxWarningsAllowed!) {
      const excessWarnings = summary.totalWarnings - this.config.maxWarningsAllowed!;
      issues.push(`${summary.totalWarnings} warnings (max: ${this.config.maxWarningsAllowed})`);
      score -= Math.min(20, excessWarnings);
    }

    // Check complexity
    if (summary.maxComplexity > this.config.maxCyclomaticComplexity!) {
      issues.push(`Max complexity ${summary.maxComplexity} exceeds threshold ${this.config.maxCyclomaticComplexity}`);
      score -= Math.min(20, (summary.maxComplexity - this.config.maxCyclomaticComplexity!) * 2);
    }

    // High complexity files penalty
    if (summary.highComplexityFiles.length > 0) {
      score -= Math.min(10, summary.highComplexityFiles.length * 2);
    }

    score = Math.max(0, Math.round(score));
    const passed = summary.totalErrors === 0 && score >= 70;

    const recommendations: string[] = [];

    // Generate recommendations
    if (summary.totalErrors > 0) {
      recommendations.push(`Fix ${summary.totalErrors} linting errors`);
      if (summary.fixableErrors > 0) {
        recommendations.push(`Run ESLint with --fix to auto-fix ${summary.fixableErrors} errors`);
      }
    }

    if (summary.highComplexityFiles.length > 0) {
      recommendations.push(
        `Refactor high-complexity files: ${summary.highComplexityFiles.slice(0, 3).map(f => path.basename(f)).join(', ')}`
      );
    }

    // Top issues
    const topIssuesList = Array.from(summary.topIssues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topIssuesList.length > 0) {
      recommendations.push(
        `Most common issues: ${topIssuesList.map(([rule, count]) => `${rule} (${count})`).join(', ')}`
      );
    }

    const details = summary.totalFiles > 0
      ? `Analyzed ${summary.totalFiles} files: ${summary.totalErrors} errors, ${summary.totalWarnings} warnings, avg complexity ${summary.averageComplexity}`
      : 'No source files analyzed (ESLint may not be configured)';

    return {
      dimension: QualityDimension.CODE_QUALITY,
      passed,
      score,
      threshold: 70,
      details,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Create result for errors
   */
  private createErrorResult(error: unknown): QualityCheckResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      dimension: QualityDimension.CODE_QUALITY,
      passed: false,
      score: 0,
      threshold: 70,
      details: `Error checking code quality: ${message}`,
      recommendations: ['Ensure ESLint is properly configured', 'Check project dependencies'],
    };
  }

  /**
   * Get files with high complexity
   */
  async getHighComplexityFiles(workspacePath: string): Promise<FileComplexity[]> {
    const complexityData = await this.calculateComplexity(workspacePath);
    return complexityData
      .filter(f => f.cyclomaticComplexity > this.config.maxCyclomaticComplexity!)
      .sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);
  }

  /**
   * Get top linting issues by frequency
   */
  async getTopIssues(workspacePath: string, limit = 10): Promise<Array<{ rule: string; count: number }>> {
    const summary = await this.getQualitySummary(workspacePath);
    return Array.from(summary.topIssues.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([rule, count]) => ({ rule, count }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a code quality checker instance
 */
export function createCodeQualityChecker(
  config: Partial<CodeQualityConfig> = {}
): CodeQualityChecker {
  return new CodeQualityChecker(config);
}
