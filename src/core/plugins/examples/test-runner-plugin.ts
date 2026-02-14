/**
 * Test Runner Plugin
 *
 * Manages Jest test execution, coverage analysis, and uncovered file
 * identification through safe child_process.execFile invocations.
 *
 * @module core/plugins/examples
 */

import { execFile as cpExecFile } from 'node:child_process';

import type {
  PluginContext,
  PluginManifest,
  PluginStatus,
  IPlugin,
} from '../interfaces/plugin.interface';
import type { PluginManifestData } from '../marketplace/types';

// ============================================================================
// Result Types
// ============================================================================

export interface TestResult {
  success: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  suites: TestSuiteResult[];
}

export interface TestSuiteResult {
  name: string;
  file: string;
  passed: number;
  failed: number;
  duration: number;
}

export interface CoverageResult {
  lines: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  statements: CoverageMetric;
}

export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface UncoveredFile {
  file: string;
  lineCoverage: number;
  threshold: number;
}

// ============================================================================
// Manifest
// ============================================================================

export const TEST_RUNNER_PLUGIN_MANIFEST: PluginManifest = {
  name: 'aca-plugin-test-runner',
  version: '1.0.0',
  description: 'Test execution and coverage analysis plugin',
  author: 'aca-team',
  main: 'test-runner-plugin.js',
};

export const TEST_RUNNER_MARKETPLACE_MANIFEST: PluginManifestData = {
  name: 'aca-plugin-test-runner',
  version: '1.0.0',
  description: 'Test execution and coverage analysis plugin',
  author: 'aca-team',
  license: 'MIT',
  keywords: ['testing', 'jest', 'coverage', 'test-runner'],
  main: 'test-runner-plugin.js',
  dependencies: {},
  acaVersion: '0.1.0',
};

// ============================================================================
// Exec Helper
// ============================================================================

function execCommand(
  cmd: string,
  args: string[],
  options: { cwd: string; timeout: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    cpExecFile(cmd, args, options, (error, stdout, stderr) => {
      if (error) {
        const enriched = Object.assign(error, {
          stdout: String(stdout),
          stderr: String(stderr),
        });
        reject(enriched);
      } else {
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      }
    });
  });
}

// ============================================================================
// Implementation
// ============================================================================

export class TestRunnerPlugin implements IPlugin {
  readonly manifest: PluginManifest = TEST_RUNNER_PLUGIN_MANIFEST;
  status: PluginStatus = 'loaded';
  private workspaceDir = '';
  private coverageThreshold = 70;

  async initialize(context: PluginContext): Promise<void> {
    if (this.status !== 'loaded') {
      throw new Error(`Cannot initialize in status '${this.status}'`);
    }
    if (!context.workspaceDir || !context.pluginDir) {
      throw new Error('PluginContext must have workspaceDir and pluginDir');
    }
    this.workspaceDir = context.workspaceDir;
    if (context.config?.coverageThreshold !== undefined) {
      this.coverageThreshold = context.config.coverageThreshold as number;
    }
    this.status = 'initialized';
  }

  async activate(): Promise<void> {
    if (this.status !== 'initialized') {
      throw new Error(`Cannot activate in status '${this.status}'`);
    }
    this.status = 'active';
  }

  async deactivate(): Promise<void> {
    if (this.status !== 'active') {
      throw new Error(`Cannot deactivate in status '${this.status}'`);
    }
    this.status = 'initialized';
  }

  async dispose(): Promise<void> {
    this.workspaceDir = '';
    this.status = 'disposed';
  }

  /**
   * Execute Jest tests with an optional file/name pattern.
   */
  async runTests(pattern?: string): Promise<TestResult> {
    this.assertActive();
    const args = ['jest', '--json', '--no-coverage'];
    if (pattern) {
      args.push('--testPathPattern', pattern);
    }

    try {
      const { stdout } = await execCommand('npx', args, {
        cwd: this.workspaceDir,
        timeout: 120_000,
      });
      return this.parseJestOutput(stdout);
    } catch (err: unknown) {
      // Jest exits with code 1 when tests fail; parse stdout anyway
      if (isExecError(err) && err.stdout) {
        return this.parseJestOutput(err.stdout);
      }
      throw new Error(`Jest execution failed: ${String(err)}`);
    }
  }

  /**
   * Run a single test file by path.
   */
  async runSingleTest(filePath: string): Promise<TestResult> {
    this.assertActive();
    try {
      const { stdout } = await execCommand(
        'npx',
        ['jest', '--json', '--no-coverage', filePath],
        { cwd: this.workspaceDir, timeout: 60_000 },
      );
      return this.parseJestOutput(stdout);
    } catch (err: unknown) {
      if (isExecError(err) && err.stdout) {
        return this.parseJestOutput(err.stdout);
      }
      throw new Error(`Test execution failed for ${filePath}: ${String(err)}`);
    }
  }

  /**
   * Get coverage summary from Jest with --coverage.
   */
  async getCoverage(): Promise<CoverageResult> {
    this.assertActive();
    try {
      const { stdout } = await execCommand(
        'npx',
        ['jest', '--coverage', '--json', '--coverageReporters', 'json-summary'],
        { cwd: this.workspaceDir, timeout: 120_000 },
      );
      return this.parseCoverageOutput(stdout);
    } catch (err: unknown) {
      if (isExecError(err) && err.stdout) {
        return this.parseCoverageOutput(err.stdout);
      }
      throw new Error(`Coverage analysis failed: ${String(err)}`);
    }
  }

  /**
   * Identify source files whose line coverage falls below the threshold.
   */
  async findUncoveredFiles(): Promise<UncoveredFile[]> {
    this.assertActive();
    try {
      const { stdout } = await execCommand(
        'npx',
        ['jest', '--coverage', '--json', '--coverageReporters', 'json'],
        { cwd: this.workspaceDir, timeout: 120_000 },
      );
      return this.parseUncoveredFiles(stdout);
    } catch (err: unknown) {
      if (isExecError(err) && err.stdout) {
        return this.parseUncoveredFiles(err.stdout);
      }
      throw new Error(`Coverage analysis failed: ${String(err)}`);
    }
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  private assertActive(): void {
    if (this.status !== 'active') {
      throw new Error('Plugin must be active to perform operations');
    }
  }

  private parseJestOutput(stdout: string): TestResult {
    try {
      const json = JSON.parse(stdout) as {
        success: boolean;
        numTotalTests: number;
        numPassedTests: number;
        numFailedTests: number;
        numPendingTests: number;
        startTime: number;
        testResults: Array<{
          name: string;
          numPassingTests: number;
          numFailingTests: number;
          perfStats: { runtime: number };
        }>;
      };

      const endTime = Date.now();
      const suites: TestSuiteResult[] = json.testResults.map(s => ({
        name: s.name.split('/').pop() || s.name,
        file: s.name,
        passed: s.numPassingTests,
        failed: s.numFailingTests,
        duration: s.perfStats.runtime,
      }));

      return {
        success: json.success,
        totalTests: json.numTotalTests,
        passed: json.numPassedTests,
        failed: json.numFailedTests,
        skipped: json.numPendingTests,
        duration: endTime - json.startTime,
        suites,
      };
    } catch {
      return {
        success: false,
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0,
        suites: [],
      };
    }
  }

  private parseCoverageOutput(stdout: string): CoverageResult {
    const defaultMetric: CoverageMetric = { total: 0, covered: 0, percentage: 0 };
    try {
      const json = JSON.parse(stdout) as {
        coverageMap?: Record<string, {
          statementMap: Record<string, unknown>;
          s: Record<string, number>;
          branchMap: Record<string, unknown>;
          b: Record<string, number[]>;
          fnMap: Record<string, unknown>;
          f: Record<string, number>;
        }>;
      };

      if (!json.coverageMap) {
        return {
          lines: { ...defaultMetric },
          branches: { ...defaultMetric },
          functions: { ...defaultMetric },
          statements: { ...defaultMetric },
        };
      }

      let totalStatements = 0, coveredStatements = 0;
      let totalBranches = 0, coveredBranches = 0;
      let totalFunctions = 0, coveredFunctions = 0;

      for (const fileCoverage of Object.values(json.coverageMap)) {
        const stmts = Object.values(fileCoverage.s);
        totalStatements += stmts.length;
        coveredStatements += stmts.filter(v => v > 0).length;

        for (const branch of Object.values(fileCoverage.b)) {
          totalBranches += branch.length;
          coveredBranches += branch.filter(v => v > 0).length;
        }

        const fns = Object.values(fileCoverage.f);
        totalFunctions += fns.length;
        coveredFunctions += fns.filter(v => v > 0).length;
      }

      const pct = (covered: number, total: number): number =>
        total === 0 ? 100 : Math.round((covered / total) * 10000) / 100;

      return {
        lines: { total: totalStatements, covered: coveredStatements, percentage: pct(coveredStatements, totalStatements) },
        branches: { total: totalBranches, covered: coveredBranches, percentage: pct(coveredBranches, totalBranches) },
        functions: { total: totalFunctions, covered: coveredFunctions, percentage: pct(coveredFunctions, totalFunctions) },
        statements: { total: totalStatements, covered: coveredStatements, percentage: pct(coveredStatements, totalStatements) },
      };
    } catch {
      return {
        lines: { ...defaultMetric },
        branches: { ...defaultMetric },
        functions: { ...defaultMetric },
        statements: { ...defaultMetric },
      };
    }
  }

  private parseUncoveredFiles(stdout: string): UncoveredFile[] {
    const uncovered: UncoveredFile[] = [];
    try {
      const json = JSON.parse(stdout) as {
        coverageMap?: Record<string, {
          statementMap: Record<string, unknown>;
          s: Record<string, number>;
        }>;
      };

      if (!json.coverageMap) return uncovered;

      for (const [filePath, fileCoverage] of Object.entries(json.coverageMap)) {
        const stmts = Object.values(fileCoverage.s);
        const total = stmts.length;
        if (total === 0) continue;
        const covered = stmts.filter(v => v > 0).length;
        const pct = Math.round((covered / total) * 10000) / 100;
        if (pct < this.coverageThreshold) {
          uncovered.push({
            file: filePath,
            lineCoverage: pct,
            threshold: this.coverageThreshold,
          });
        }
      }
    } catch {
      // Non-parseable output; return empty list
    }

    return uncovered;
  }
}

// ============================================================================
// Utility
// ============================================================================

interface ExecError {
  stdout: string;
  stderr: string;
}

function isExecError(err: unknown): err is ExecError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'stdout' in err &&
    typeof (err as ExecError).stdout === 'string'
  );
}

// ============================================================================
// Factory Function
// ============================================================================

export function createTestRunnerPlugin(): TestRunnerPlugin {
  return new TestRunnerPlugin();
}
