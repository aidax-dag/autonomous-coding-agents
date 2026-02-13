/**
 * Eval Reporter
 *
 * Generates human-readable and machine-readable reports
 * from eval suite results.
 *
 * @module core/evals
 */

import type {
  IEvalReporter,
  EvalSuiteResult,
  EvalResult,
} from './interfaces/eval.interface';

/**
 * Format a single eval result as a text line with check details on failure
 */
function formatEvalResult(result: EvalResult): string {
  const status = result.passed ? '[PASS]' : '[FAIL]';
  const line = `  ${status} ${result.evalName} (score: ${result.score.toFixed(2)}, ${result.duration}ms)`;

  if (result.passed) {
    return line;
  }

  // Append failed check details
  const failedChecks = result.checks
    .filter((c) => !c.passed)
    .map((c) => `    - Check failed: ${c.message}`)
    .join('\n');

  return `${line}\n${failedChecks}`;
}

/**
 * Eval reporter implementation
 */
export class EvalReporter implements IEvalReporter {
  report(result: EvalSuiteResult): string {
    const lines: string[] = [];

    lines.push(`Suite: ${result.suiteName}`);
    lines.push(`Timestamp: ${result.timestamp}`);
    lines.push(`Total: ${result.totalEvals} | Passed: ${result.passed} | Failed: ${result.failed} | Skipped: ${result.skipped}`);
    lines.push(`ALWAYS_PASSES: ${(result.alwaysPassRate * 100).toFixed(1)}% (target: 100%)`);
    lines.push(`USUALLY_PASSES: ${(result.usuallyPassRate * 100).toFixed(1)}% (target: 80%)`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push('');

    if (result.results.length > 0) {
      lines.push('Results:');
      for (const evalResult of result.results) {
        lines.push(formatEvalResult(evalResult));
      }
    }

    if (result.regressions.length > 0) {
      lines.push('');
      lines.push('Regressions:');
      for (const regression of result.regressions) {
        lines.push(formatEvalResult(regression));
      }
    }

    return lines.join('\n');
  }

  reportJSON(result: EvalSuiteResult): string {
    return JSON.stringify(result, null, 2);
  }
}

/**
 * Factory function
 */
export function createEvalReporter(): EvalReporter {
  return new EvalReporter();
}
