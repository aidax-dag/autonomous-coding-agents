/**
 * Eval Reporter
 *
 * Formats and outputs eval results in console, JSON, or markdown format.
 *
 * @module core/evals
 */

import type {
  IEvalReporter,
  EvalResult,
  EvalSuiteResult,
  ReportFormat,
} from './interfaces/eval.interface.js';

/**
 * Eval result reporter with multiple output formats
 */
export class EvalReporter implements IEvalReporter {
  private format: ReportFormat;

  constructor(format: ReportFormat = 'console') {
    this.format = format;
  }

  setFormat(format: ReportFormat): void {
    this.format = format;
  }

  reportResult(result: EvalResult): string {
    switch (this.format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'markdown':
        return this.formatResultMarkdown(result);
      default:
        return this.formatResultConsole(result);
    }
  }

  reportSuite(result: EvalSuiteResult): string {
    switch (this.format) {
      case 'json':
        return JSON.stringify(result, null, 2);
      case 'markdown':
        return this.formatSuiteMarkdown(result);
      default:
        return this.formatSuiteConsole(result);
    }
  }

  // =========================================================================
  // Console Format
  // =========================================================================

  private formatResultConsole(result: EvalResult): string {
    const icon = result.passed ? 'PASS' : 'FAIL';
    const severity = result.severity === 'ALWAYS_PASSES' ? '!!' : '  ';
    return `[${icon}] ${severity} ${result.evalId} (score: ${(result.score * 100).toFixed(0)}%, ${result.duration}ms)`;
  }

  private formatSuiteConsole(result: EvalSuiteResult): string {
    const lines: string[] = [];

    lines.push(`\n=== Eval Suite: ${result.suiteName} ===`);
    lines.push(`Total: ${result.totalEvals} | Passed: ${result.passed} | Failed: ${result.failed}`);
    lines.push(
      `ALWAYS_PASSES rate: ${(result.alwaysPassRate * 100).toFixed(0)}% (target: 100%)`,
    );
    lines.push(
      `USUALLY_PASSES rate: ${(result.usuallyPassRate * 100).toFixed(0)}% (target: 80%)`,
    );
    lines.push(`Duration: ${result.duration}ms`);

    if (result.regressions.length > 0) {
      lines.push(`\nRegressions (${result.regressions.length}):`);
      for (const r of result.regressions) {
        lines.push(`  ${this.formatResultConsole(r)}`);
        lines.push(`    ${r.details}`);
      }
    }

    lines.push('\nResults:');
    for (const r of result.results) {
      lines.push(`  ${this.formatResultConsole(r)}`);
    }

    const overallPass =
      result.alwaysPassRate === 1 && result.usuallyPassRate >= 0.8;
    lines.push(`\nOverall: ${overallPass ? 'PASSED' : 'FAILED'}`);

    return lines.join('\n');
  }

  // =========================================================================
  // Markdown Format
  // =========================================================================

  private formatResultMarkdown(result: EvalResult): string {
    const icon = result.passed ? '✅' : '❌';
    return `${icon} **${result.evalId}** — score: ${(result.score * 100).toFixed(0)}% (${result.duration}ms)`;
  }

  private formatSuiteMarkdown(result: EvalSuiteResult): string {
    const lines: string[] = [];

    lines.push(`# Eval Report: ${result.suiteName}`);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total | ${result.totalEvals} |`);
    lines.push(`| Passed | ${result.passed} |`);
    lines.push(`| Failed | ${result.failed} |`);
    lines.push(
      `| ALWAYS_PASSES rate | ${(result.alwaysPassRate * 100).toFixed(0)}% |`,
    );
    lines.push(
      `| USUALLY_PASSES rate | ${(result.usuallyPassRate * 100).toFixed(0)}% |`,
    );
    lines.push(`| Duration | ${result.duration}ms |`);

    if (result.regressions.length > 0) {
      lines.push('');
      lines.push('## Regressions');
      for (const r of result.regressions) {
        lines.push(`- ${this.formatResultMarkdown(r)}: ${r.details}`);
      }
    }

    lines.push('');
    lines.push('## Results');
    lines.push('');
    lines.push('| Eval | Severity | Score | Status |');
    lines.push('|------|----------|-------|--------|');
    for (const r of result.results) {
      const icon = r.passed ? '✅' : '❌';
      lines.push(
        `| ${r.evalId} | ${r.severity} | ${(r.score * 100).toFixed(0)}% | ${icon} |`,
      );
    }

    return lines.join('\n');
  }
}

// ============================================================================
// Factory
// ============================================================================

export function createEvalReporter(format?: ReportFormat): EvalReporter {
  return new EvalReporter(format);
}
