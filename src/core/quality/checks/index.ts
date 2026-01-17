/**
 * Quality Checks Module
 *
 * Real implementations for quality measurement including test coverage,
 * code quality, documentation, security, and performance checks.
 *
 * @module core/quality/checks
 */

// Test Coverage Checker
export {
  TestCoverageChecker,
  createTestCoverageChecker,
  type FileCoverage,
  type CoverageMetric,
  type CoverageSummary,
  type TestCoverageConfig,
  DEFAULT_COVERAGE_CONFIG,
} from './test-coverage-checker.js';

// Code Quality Checker
export {
  CodeQualityChecker,
  createCodeQualityChecker,
  ESLintSeverity,
  type ESLintMessage,
  type ESLintResult,
  type FileComplexity,
  type FunctionComplexity,
  type CodeQualitySummary,
  type CodeQualityConfig,
  DEFAULT_CODE_QUALITY_CONFIG,
} from './code-quality-checker.js';

// Documentation Checker
export {
  DocumentationChecker,
  createDocumentationChecker,
  type SymbolDocumentation,
  type FileDocumentation,
  type DocumentationSummary,
  type DocumentationConfig,
  DEFAULT_DOCUMENTATION_CONFIG,
} from './documentation-checker.js';

// Security Checker
export {
  SecurityChecker,
  createSecurityChecker,
  VulnerabilitySeverity,
  type AuditVulnerability,
  type AuditResult,
  type SecretFinding,
  type SecurityIssue,
  type SecuritySummary,
  type SecurityConfig,
  DEFAULT_SECRET_PATTERNS,
  DEFAULT_SECURITY_CONFIG,
} from './security-checker.js';

// Performance Checker
export {
  PerformanceChecker,
  createPerformanceChecker,
  type BundleInfo,
  type BuildMetrics,
  type DependencyMetrics,
  type PerformanceSummary,
  type SourceStats,
  type PerformanceConfig,
  DEFAULT_PERFORMANCE_CONFIG,
} from './performance-checker.js';

// ============================================================================
// Unified Quality Checker
// ============================================================================

import { TestCoverageChecker, TestCoverageConfig } from './test-coverage-checker.js';
import { CodeQualityChecker, CodeQualityConfig } from './code-quality-checker.js';
import { DocumentationChecker, DocumentationConfig } from './documentation-checker.js';
import { SecurityChecker, SecurityConfig } from './security-checker.js';
import { PerformanceChecker, PerformanceConfig } from './performance-checker.js';
import { QualityCheckResult } from '../completion-detector.js';

/**
 * Unified quality checker configuration
 */
export interface UnifiedQualityConfig {
  coverage?: Partial<TestCoverageConfig>;
  codeQuality?: Partial<CodeQualityConfig>;
  documentation?: Partial<DocumentationConfig>;
  security?: Partial<SecurityConfig>;
  performance?: Partial<PerformanceConfig>;
  workspacePath?: string;
}

/**
 * Unified quality check results
 */
export interface UnifiedQualityResults {
  coverage: QualityCheckResult;
  codeQuality: QualityCheckResult;
  documentation: QualityCheckResult;
  security: QualityCheckResult;
  performance: QualityCheckResult;
  overallScore: number;
  overallPassed: boolean;
  timestamp: Date;
}

/**
 * Unified quality checker that runs all checks
 */
export class UnifiedQualityChecker {
  private coverageChecker: TestCoverageChecker;
  private codeQualityChecker: CodeQualityChecker;
  private documentationChecker: DocumentationChecker;
  private securityChecker: SecurityChecker;
  private performanceChecker: PerformanceChecker;

  constructor(config: UnifiedQualityConfig = {}) {
    this.coverageChecker = new TestCoverageChecker(config.coverage);
    this.codeQualityChecker = new CodeQualityChecker(config.codeQuality);
    this.documentationChecker = new DocumentationChecker(config.documentation);
    this.securityChecker = new SecurityChecker(config.security);
    this.performanceChecker = new PerformanceChecker(config.performance);
  }

  /**
   * Run all quality checks
   */
  async checkAll(workspacePath: string): Promise<UnifiedQualityResults> {
    // Run all checks in parallel for performance
    const [coverage, codeQuality, documentation, security, performance] = await Promise.all([
      this.coverageChecker.check(workspacePath),
      this.codeQualityChecker.check(workspacePath),
      this.documentationChecker.check(workspacePath),
      this.securityChecker.check(workspacePath),
      this.performanceChecker.check(workspacePath),
    ]);

    // Calculate overall score (weighted average)
    const weights = {
      coverage: 0.25,
      codeQuality: 0.25,
      documentation: 0.15,
      security: 0.20,
      performance: 0.15,
    };

    const overallScore = Math.round(
      coverage.score * weights.coverage +
      codeQuality.score * weights.codeQuality +
      documentation.score * weights.documentation +
      security.score * weights.security +
      performance.score * weights.performance
    );

    // Overall passes if security passes and overall score >= 70
    const overallPassed = security.passed && overallScore >= 70;

    return {
      coverage,
      codeQuality,
      documentation,
      security,
      performance,
      overallScore,
      overallPassed,
      timestamp: new Date(),
    };
  }

  /**
   * Run a specific check
   */
  async checkDimension(
    workspacePath: string,
    dimension: 'coverage' | 'codeQuality' | 'documentation' | 'security' | 'performance'
  ): Promise<QualityCheckResult> {
    switch (dimension) {
      case 'coverage':
        return this.coverageChecker.check(workspacePath);
      case 'codeQuality':
        return this.codeQualityChecker.check(workspacePath);
      case 'documentation':
        return this.documentationChecker.check(workspacePath);
      case 'security':
        return this.securityChecker.check(workspacePath);
      case 'performance':
        return this.performanceChecker.check(workspacePath);
    }
  }

  /**
   * Get individual checkers for advanced use
   */
  getCheckers() {
    return {
      coverage: this.coverageChecker,
      codeQuality: this.codeQualityChecker,
      documentation: this.documentationChecker,
      security: this.securityChecker,
      performance: this.performanceChecker,
    };
  }
}

/**
 * Create a unified quality checker instance
 */
export function createUnifiedQualityChecker(
  config: UnifiedQualityConfig = {}
): UnifiedQualityChecker {
  return new UnifiedQualityChecker(config);
}
