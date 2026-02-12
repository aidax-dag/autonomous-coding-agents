/**
 * Verification Report Builder
 *
 * Constructs structured verification reports with markdown rendering.
 *
 * @module core/validation/verification-report
 */

import type {
  VerificationReport,
  FileVerificationReport,
  StageReport,
} from './interfaces/verification-report.interface';

/**
 * Verification Report Builder
 *
 * Incrementally builds verification reports.
 */
export class VerificationReportBuilder {
  private files: FileVerificationReport[] = [];
  private stages: StageReport[] = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  addFileReport(report: FileVerificationReport): this {
    this.files.push(report);
    return this;
  }

  addStageReport(report: StageReport): this {
    this.stages.push(report);
    return this;
  }

  build(): VerificationReport {
    const passed = this.stages.every((s) => s.passed);
    const totalStubs = this.files.reduce((sum, f) => sum + f.stubs.length, 0);

    return {
      passed,
      timestamp: Date.now(),
      duration: Date.now() - this.startTime,
      stages: this.stages,
      files: this.files,
      summary: this.generateSummary(passed, totalStubs),
    };
  }

  private generateSummary(passed: boolean, totalStubs: number): string {
    const stageResults = this.stages
      .map((s) => `${s.stage}: ${s.passed ? 'PASS' : 'FAIL'}`)
      .join(', ');
    return `${passed ? 'PASSED' : 'FAILED'} | ${this.files.length} files | ${totalStubs} stubs | ${stageResults}`;
  }

  static toMarkdown(report: VerificationReport): string {
    const lines: string[] = [
      `# Verification Report`,
      '',
      `**Status**: ${report.passed ? '✅ PASSED' : '❌ FAILED'}`,
      `**Duration**: ${report.duration}ms`,
      `**Files**: ${report.files.length}`,
      '',
      '## Stage Results',
      '',
    ];

    for (const stage of report.stages) {
      lines.push(
        `### ${stage.stage} — ${stage.passed ? '✅' : '❌'}`,
        `- Files checked: ${stage.filesChecked}`,
        `- Files passed: ${stage.filesPassed}`,
        `- Details: ${stage.details}`,
        '',
      );
    }

    const stubs = report.files.flatMap((f) => f.stubs);
    if (stubs.length > 0) {
      lines.push('## Stubs Detected', '');
      for (const stub of stubs) {
        lines.push(
          `- **${stub.filePath}:${stub.line}** [${stub.severity}] ${stub.pattern}: \`${stub.content}\``,
        );
      }
    }

    lines.push('', `---`, `Summary: ${report.summary}`);
    return lines.join('\n');
  }

  static toJSON(report: VerificationReport): string {
    return JSON.stringify(report, null, 2);
  }
}

/**
 * Create a verification report builder
 */
export function createVerificationReportBuilder(): VerificationReportBuilder {
  return new VerificationReportBuilder();
}
