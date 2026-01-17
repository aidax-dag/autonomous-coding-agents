/**
 * Test Coverage Checker
 *
 * Analyzes test coverage by parsing Jest/Vitest coverage reports.
 * Supports multiple coverage formats: lcov, json-summary, and cobertura.
 *
 * @module core/quality/checks/test-coverage-checker
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { QualityCheckResult, QualityDimension } from '../completion-detector.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Coverage data by file
 */
export interface FileCoverage {
  path: string;
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
}

/**
 * Individual coverage metric
 */
export interface CoverageMetric {
  total: number;
  covered: number;
  skipped?: number;
  pct: number;
}

/**
 * Aggregate coverage summary
 */
export interface CoverageSummary {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  files: FileCoverage[];
  timestamp?: Date;
}

/**
 * Coverage checker configuration
 */
export interface TestCoverageConfig {
  coverageDir?: string;
  minLineCoverage?: number;
  minBranchCoverage?: number;
  minFunctionCoverage?: number;
  minStatementCoverage?: number;
  excludePatterns?: string[];
}

/**
 * Jest coverage-summary.json format
 */
interface JestCoverageSummary {
  total: {
    lines: { total: number; covered: number; skipped: number; pct: number };
    statements: { total: number; covered: number; skipped: number; pct: number };
    functions: { total: number; covered: number; skipped: number; pct: number };
    branches: { total: number; covered: number; skipped: number; pct: number };
  };
  [filePath: string]: {
    lines: { total: number; covered: number; skipped: number; pct: number };
    statements: { total: number; covered: number; skipped: number; pct: number };
    functions: { total: number; covered: number; skipped: number; pct: number };
    branches: { total: number; covered: number; skipped: number; pct: number };
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_COVERAGE_CONFIG: TestCoverageConfig = {
  coverageDir: 'coverage',
  minLineCoverage: 80,
  minBranchCoverage: 70,
  minFunctionCoverage: 80,
  minStatementCoverage: 80,
  excludePatterns: ['node_modules', 'test', 'tests', '__tests__', '*.test.*', '*.spec.*'],
};

// ============================================================================
// Test Coverage Checker Implementation
// ============================================================================

/**
 * Test coverage checker for analyzing code coverage reports
 */
export class TestCoverageChecker {
  private config: TestCoverageConfig;

  constructor(config: Partial<TestCoverageConfig> = {}) {
    this.config = { ...DEFAULT_COVERAGE_CONFIG, ...config };
  }

  /**
   * Check test coverage for a workspace
   */
  async check(workspacePath: string): Promise<QualityCheckResult> {
    try {
      const summary = await this.getCoverageSummary(workspacePath);

      if (!summary) {
        return this.createNoCoverageResult();
      }

      return this.evaluateCoverage(summary);
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  /**
   * Get coverage summary from available reports
   */
  async getCoverageSummary(workspacePath: string): Promise<CoverageSummary | null> {
    const coverageDir = path.join(workspacePath, this.config.coverageDir || 'coverage');

    // Try JSON summary first (most complete)
    const jsonSummary = await this.parseJsonSummary(coverageDir);
    if (jsonSummary) return jsonSummary;

    // Try lcov format
    const lcovSummary = await this.parseLcov(coverageDir);
    if (lcovSummary) return lcovSummary;

    // Try cobertura format
    const coberturaSummary = await this.parseCobertura(coverageDir);
    if (coberturaSummary) return coberturaSummary;

    return null;
  }

  /**
   * Parse Jest/Vitest coverage-summary.json
   */
  private async parseJsonSummary(coverageDir: string): Promise<CoverageSummary | null> {
    const summaryPath = path.join(coverageDir, 'coverage-summary.json');

    try {
      const content = await fs.readFile(summaryPath, 'utf-8');
      const data = JSON.parse(content) as JestCoverageSummary;

      const files: FileCoverage[] = [];
      for (const [filePath, coverage] of Object.entries(data)) {
        if (filePath === 'total') continue;

        files.push({
          path: filePath,
          lines: coverage.lines,
          statements: coverage.statements,
          functions: coverage.functions,
          branches: coverage.branches,
        });
      }

      return {
        lines: data.total.lines,
        statements: data.total.statements,
        functions: data.total.functions,
        branches: data.total.branches,
        files,
        timestamp: new Date(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse lcov.info format
   */
  private async parseLcov(coverageDir: string): Promise<CoverageSummary | null> {
    const lcovPath = path.join(coverageDir, 'lcov.info');

    try {
      const content = await fs.readFile(lcovPath, 'utf-8');
      return this.parseLcovContent(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse lcov content into coverage summary
   */
  private parseLcovContent(content: string): CoverageSummary {
    const files: FileCoverage[] = [];
    let currentFile: Partial<FileCoverage> | null = null;

    const lines = content.split('\n');

    let totalLinesFound = 0;
    let totalLinesHit = 0;
    let totalFunctionsFound = 0;
    let totalFunctionsHit = 0;
    let totalBranchesFound = 0;
    let totalBranchesHit = 0;

    for (const line of lines) {
      if (line.startsWith('SF:')) {
        // Start of new file
        currentFile = {
          path: line.substring(3),
          lines: { total: 0, covered: 0, pct: 0 },
          statements: { total: 0, covered: 0, pct: 0 },
          functions: { total: 0, covered: 0, pct: 0 },
          branches: { total: 0, covered: 0, pct: 0 },
        };
      } else if (line.startsWith('LF:') && currentFile) {
        currentFile.lines!.total = parseInt(line.substring(3), 10);
        currentFile.statements!.total = currentFile.lines!.total;
      } else if (line.startsWith('LH:') && currentFile) {
        currentFile.lines!.covered = parseInt(line.substring(3), 10);
        currentFile.statements!.covered = currentFile.lines!.covered;
      } else if (line.startsWith('FNF:') && currentFile) {
        currentFile.functions!.total = parseInt(line.substring(4), 10);
      } else if (line.startsWith('FNH:') && currentFile) {
        currentFile.functions!.covered = parseInt(line.substring(4), 10);
      } else if (line.startsWith('BRF:') && currentFile) {
        currentFile.branches!.total = parseInt(line.substring(4), 10);
      } else if (line.startsWith('BRH:') && currentFile) {
        currentFile.branches!.covered = parseInt(line.substring(4), 10);
      } else if (line === 'end_of_record' && currentFile) {
        // Calculate percentages
        currentFile.lines!.pct = this.calculatePct(currentFile.lines!.covered, currentFile.lines!.total);
        currentFile.statements!.pct = currentFile.lines!.pct;
        currentFile.functions!.pct = this.calculatePct(currentFile.functions!.covered, currentFile.functions!.total);
        currentFile.branches!.pct = this.calculatePct(currentFile.branches!.covered, currentFile.branches!.total);

        // Accumulate totals
        totalLinesFound += currentFile.lines!.total;
        totalLinesHit += currentFile.lines!.covered;
        totalFunctionsFound += currentFile.functions!.total;
        totalFunctionsHit += currentFile.functions!.covered;
        totalBranchesFound += currentFile.branches!.total;
        totalBranchesHit += currentFile.branches!.covered;

        files.push(currentFile as FileCoverage);
        currentFile = null;
      }
    }

    return {
      lines: {
        total: totalLinesFound,
        covered: totalLinesHit,
        pct: this.calculatePct(totalLinesHit, totalLinesFound),
      },
      statements: {
        total: totalLinesFound,
        covered: totalLinesHit,
        pct: this.calculatePct(totalLinesHit, totalLinesFound),
      },
      functions: {
        total: totalFunctionsFound,
        covered: totalFunctionsHit,
        pct: this.calculatePct(totalFunctionsHit, totalFunctionsFound),
      },
      branches: {
        total: totalBranchesFound,
        covered: totalBranchesHit,
        pct: this.calculatePct(totalBranchesHit, totalBranchesFound),
      },
      files,
      timestamp: new Date(),
    };
  }

  /**
   * Parse cobertura XML format
   */
  private async parseCobertura(coverageDir: string): Promise<CoverageSummary | null> {
    const coberturaPath = path.join(coverageDir, 'cobertura-coverage.xml');

    try {
      const content = await fs.readFile(coberturaPath, 'utf-8');
      return this.parseCoberturaContent(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse cobertura XML content
   */
  private parseCoberturaContent(content: string): CoverageSummary {
    // Simple XML parsing for cobertura format
    const lineRateMatch = content.match(/line-rate="([0-9.]+)"/);
    const branchRateMatch = content.match(/branch-rate="([0-9.]+)"/);
    const linesValidMatch = content.match(/lines-valid="(\d+)"/);
    const linesCoveredMatch = content.match(/lines-covered="(\d+)"/);
    const branchesValidMatch = content.match(/branches-valid="(\d+)"/);
    const branchesCoveredMatch = content.match(/branches-covered="(\d+)"/);

    const lineRate = lineRateMatch ? parseFloat(lineRateMatch[1]) * 100 : 0;
    const branchRate = branchRateMatch ? parseFloat(branchRateMatch[1]) * 100 : 0;
    const linesValid = linesValidMatch ? parseInt(linesValidMatch[1], 10) : 0;
    const linesCovered = linesCoveredMatch ? parseInt(linesCoveredMatch[1], 10) : 0;
    const branchesValid = branchesValidMatch ? parseInt(branchesValidMatch[1], 10) : 0;
    const branchesCovered = branchesCoveredMatch ? parseInt(branchesCoveredMatch[1], 10) : 0;

    return {
      lines: { total: linesValid, covered: linesCovered, pct: lineRate },
      statements: { total: linesValid, covered: linesCovered, pct: lineRate },
      functions: { total: 0, covered: 0, pct: 0 }, // Cobertura doesn't track functions separately
      branches: { total: branchesValid, covered: branchesCovered, pct: branchRate },
      files: [],
      timestamp: new Date(),
    };
  }

  /**
   * Calculate percentage safely
   */
  private calculatePct(covered: number, total: number): number {
    if (total === 0) return 100;
    return Math.round((covered / total) * 10000) / 100;
  }

  /**
   * Evaluate coverage against thresholds
   */
  private evaluateCoverage(summary: CoverageSummary): QualityCheckResult {
    const checks = [
      { name: 'Line', value: summary.lines.pct, threshold: this.config.minLineCoverage! },
      { name: 'Branch', value: summary.branches.pct, threshold: this.config.minBranchCoverage! },
      { name: 'Function', value: summary.functions.pct, threshold: this.config.minFunctionCoverage! },
      { name: 'Statement', value: summary.statements.pct, threshold: this.config.minStatementCoverage! },
    ];

    const failedChecks = checks.filter(c => c.value < c.threshold);
    const passed = failedChecks.length === 0;

    // Calculate weighted score (lines and branches weighted higher)
    const score = Math.round(
      (summary.lines.pct * 0.3 +
        summary.branches.pct * 0.25 +
        summary.functions.pct * 0.25 +
        summary.statements.pct * 0.2)
    );

    const recommendations: string[] = [];
    for (const check of failedChecks) {
      recommendations.push(
        `Increase ${check.name.toLowerCase()} coverage from ${check.value.toFixed(1)}% to ${check.threshold}%`
      );
    }

    // Find files with lowest coverage
    const lowCoverageFiles = summary.files
      .filter(f => f.lines.pct < this.config.minLineCoverage!)
      .sort((a, b) => a.lines.pct - b.lines.pct)
      .slice(0, 5);

    if (lowCoverageFiles.length > 0) {
      recommendations.push(
        `Focus on low-coverage files: ${lowCoverageFiles.map(f => path.basename(f.path)).join(', ')}`
      );
    }

    return {
      dimension: QualityDimension.TEST_COVERAGE,
      passed,
      score,
      threshold: this.config.minLineCoverage!,
      details: `Coverage: Lines ${summary.lines.pct.toFixed(1)}%, Branches ${summary.branches.pct.toFixed(1)}%, Functions ${summary.functions.pct.toFixed(1)}%`,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Create result when no coverage data is found
   */
  private createNoCoverageResult(): QualityCheckResult {
    return {
      dimension: QualityDimension.TEST_COVERAGE,
      passed: false,
      score: 0,
      threshold: this.config.minLineCoverage!,
      details: 'No coverage report found',
      recommendations: [
        'Run tests with coverage enabled (e.g., npm test -- --coverage)',
        'Ensure coverage reports are generated in the coverage/ directory',
        'Supported formats: coverage-summary.json, lcov.info, cobertura-coverage.xml',
      ],
    };
  }

  /**
   * Create result for errors
   */
  private createErrorResult(error: unknown): QualityCheckResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      dimension: QualityDimension.TEST_COVERAGE,
      passed: false,
      score: 0,
      threshold: this.config.minLineCoverage!,
      details: `Error checking coverage: ${message}`,
      recommendations: ['Verify coverage report format', 'Check file permissions'],
    };
  }

  /**
   * Get detailed file-by-file coverage
   */
  async getDetailedCoverage(workspacePath: string): Promise<FileCoverage[]> {
    const summary = await this.getCoverageSummary(workspacePath);
    return summary?.files || [];
  }

  /**
   * Get uncovered files list
   */
  async getUncoveredFiles(workspacePath: string, threshold = 50): Promise<string[]> {
    const summary = await this.getCoverageSummary(workspacePath);
    if (!summary) return [];

    return summary.files
      .filter(f => f.lines.pct < threshold)
      .map(f => f.path);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a test coverage checker instance
 */
export function createTestCoverageChecker(
  config: Partial<TestCoverageConfig> = {}
): TestCoverageChecker {
  return new TestCoverageChecker(config);
}
