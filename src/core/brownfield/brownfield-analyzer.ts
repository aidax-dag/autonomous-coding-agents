/**
 * Brownfield Analyzer
 *
 * Analyzes existing codebases to understand structure, patterns,
 * technical debt, and improvement opportunities.
 *
 * @module core/brownfield
 */

import type {
  IBrownfieldAnalyzer,
  BrownfieldAnalysis,
  BrownfieldOptions,
  CodebaseMetrics,
  TechDebtItem,
  CodePattern,
} from './interfaces/brownfield.interface';

/**
 * Analysis executor — pluggable function for actual codebase analysis
 */
export type AnalysisExecutor = (
  rootPath: string,
  options?: BrownfieldOptions,
) => Promise<BrownfieldAnalysis>;

/**
 * BrownfieldAnalyzer config
 */
export interface BrownfieldAnalyzerConfig {
  /** Custom analysis executor (for LLM-backed analysis) */
  executor?: AnalysisExecutor;
  /** Default options */
  defaults?: BrownfieldOptions;
}

/**
 * Brownfield Analyzer implementation
 */
export class BrownfieldAnalyzer implements IBrownfieldAnalyzer {
  private readonly executor?: AnalysisExecutor;
  private readonly defaults: BrownfieldOptions;

  constructor(config: BrownfieldAnalyzerConfig = {}) {
    this.executor = config.executor;
    this.defaults = config.defaults ?? {
      analyzeDeps: true,
      detectPatterns: true,
      scanTechDebt: true,
      maxFiles: 1000,
    };
  }

  async analyze(
    rootPath: string,
    options?: BrownfieldOptions,
  ): Promise<BrownfieldAnalysis> {
    const opts = { ...this.defaults, ...options };

    if (this.executor) {
      return this.executor(rootPath, opts);
    }

    // Default stub analysis
    const metrics = await this.getMetrics(rootPath);
    const techDebt = opts.scanTechDebt ? await this.scanTechDebt(rootPath) : [];
    const patterns = opts.detectPatterns ? await this.detectPatterns(rootPath) : [];

    return {
      projectName: rootPath.split('/').pop() ?? 'unknown',
      analyzedAt: new Date().toISOString(),
      metrics,
      patterns,
      techDebt,
      dependencies: {
        directDeps: 0,
        devDeps: 0,
        outdated: [],
        unused: [],
        duplicates: [],
      },
      recommendations: [],
      healthScore: this.calculateHealthScore(metrics, techDebt),
    };
  }

  async getMetrics(_rootPath: string): Promise<CodebaseMetrics> {
    // Default stub — would be replaced by actual file system analysis
    return {
      totalLoc: 0,
      totalFiles: 0,
      languages: {},
      avgFileSize: 0,
      largestFiles: [],
      testCoverageEstimate: 0,
    };
  }

  async scanTechDebt(_rootPath: string): Promise<TechDebtItem[]> {
    // Default stub — would be replaced by actual analysis
    return [];
  }

  async detectPatterns(_rootPath: string): Promise<CodePattern[]> {
    // Default stub — would be replaced by actual pattern detection
    return [];
  }

  private calculateHealthScore(
    metrics: CodebaseMetrics,
    techDebt: TechDebtItem[],
  ): number {
    let score = 100;

    // Deduct for tech debt
    const criticalCount = techDebt.filter((d) => d.severity === 'critical').length;
    const highCount = techDebt.filter((d) => d.severity === 'high').length;
    const mediumCount = techDebt.filter((d) => d.severity === 'medium').length;

    score -= criticalCount * 15;
    score -= highCount * 8;
    score -= mediumCount * 3;

    // Deduct for low test coverage
    if (metrics.testCoverageEstimate < 50) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Factory function
 */
export function createBrownfieldAnalyzer(
  config?: BrownfieldAnalyzerConfig,
): BrownfieldAnalyzer {
  return new BrownfieldAnalyzer(config);
}
