/**
 * Output Formatter
 *
 * Formats HeadlessResult into different output representations
 * for consumption by CI pipelines. Supports JSON, JSONL (streaming),
 * minimal human-readable, and GitHub Actions-specific annotations.
 *
 * Feature: F-10 - Headless CI/CD Mode
 */

import type { HeadlessResult } from './types';

export type OutputFormat = 'json' | 'jsonl' | 'minimal';

export class OutputFormatter {
  private format: OutputFormat;

  constructor(format: OutputFormat = 'json') {
    this.format = format;
  }

  /**
   * Format a HeadlessResult according to the configured output format.
   */
  formatResult(result: HeadlessResult): string {
    switch (this.format) {
      case 'json':
        return this.formatJSON(result);
      case 'jsonl':
        return this.formatJSONL(result);
      case 'minimal':
        return this.formatMinimal(result);
      default:
        return this.formatJSON(result);
    }
  }

  // ---- Format implementations ----

  private formatJSON(result: HeadlessResult): string {
    return JSON.stringify(result, null, 2);
  }

  private formatJSONL(result: HeadlessResult): string {
    const lines: string[] = [];

    // Header line
    lines.push(
      JSON.stringify({
        type: 'header',
        goal: result.goal,
        startedAt: result.startedAt,
      }),
    );

    // Task lines
    for (const task of result.output.tasks) {
      lines.push(
        JSON.stringify({
          type: 'task',
          ...task,
        }),
      );
    }

    // Error lines
    for (const error of result.errors) {
      lines.push(
        JSON.stringify({
          type: 'error',
          ...error,
        }),
      );
    }

    // Summary line
    lines.push(
      JSON.stringify({
        type: 'summary',
        success: result.success,
        exitCode: result.exitCode,
        duration: result.duration,
        metrics: result.output.metrics,
      }),
    );

    return lines.join('\n');
  }

  private formatMinimal(result: HeadlessResult): string {
    const lines: string[] = [];
    const status = result.success ? 'PASS' : 'FAIL';

    lines.push(`[${status}] ${result.goal}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push(
      `Tasks: ${result.output.metrics.completedTasks}/${result.output.metrics.totalTasks} passed`,
    );

    if (result.errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      for (const error of result.errors) {
        lines.push(`  - [${error.code}] ${error.message}`);
      }
    }

    return lines.join('\n');
  }

  // ---- GitHub Actions helpers ----

  /**
   * Format result as GitHub Actions workflow annotations.
   */
  formatGitHubAnnotations(result: HeadlessResult): string {
    const lines: string[] = [];

    if (result.success) {
      lines.push(`::notice::Goal completed successfully: ${result.goal}`);
    } else {
      lines.push(`::error::Goal failed: ${result.goal}`);
    }

    for (const error of result.errors) {
      if (error.fatal) {
        lines.push(`::error::${error.message}`);
      } else {
        lines.push(`::warning::${error.message}`);
      }
    }

    // Step summary group
    lines.push('');
    lines.push('::group::Execution Summary');
    lines.push(
      `Tasks: ${result.output.metrics.completedTasks}/${result.output.metrics.totalTasks}`,
    );
    lines.push(`Duration: ${result.duration}ms`);
    lines.push('::endgroup::');

    return lines.join('\n');
  }

  /**
   * Emit GitHub Actions output variables (legacy set-output format).
   */
  formatGitHubOutputs(result: HeadlessResult): string {
    const lines: string[] = [];
    lines.push(`::set-output name=success::${result.success}`);
    lines.push(`::set-output name=exit-code::${result.exitCode}`);
    lines.push(`::set-output name=duration::${result.duration}`);
    lines.push(
      `::set-output name=tasks-total::${result.output.metrics.totalTasks}`,
    );
    lines.push(
      `::set-output name=tasks-passed::${result.output.metrics.completedTasks}`,
    );
    lines.push(
      `::set-output name=tasks-failed::${result.output.metrics.failedTasks}`,
    );
    return lines.join('\n');
  }
}

/**
 * Factory function for OutputFormatter.
 */
export function createOutputFormatter(
  format: OutputFormat = 'json',
): OutputFormatter {
  return new OutputFormatter(format);
}
