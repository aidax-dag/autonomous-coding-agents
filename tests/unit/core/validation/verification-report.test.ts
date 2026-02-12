/**
 * Verification Report Tests
 */

import { VerificationReportBuilder } from '@/core/validation/verification-report';
import { VerificationStage } from '@/core/validation/interfaces/validation.interface';

describe('VerificationReportBuilder', () => {
  it('should build a passing report', () => {
    const builder = new VerificationReportBuilder();
    builder.addStageReport({
      stage: VerificationStage.EXISTS,
      passed: true,
      details: 'All files exist',
      filesChecked: 2,
      filesPassed: 2,
    });
    builder.addFileReport({
      filePath: 'src/test.ts',
      exists: true,
      substantive: true,
      wired: true,
      stubs: [],
      issues: [],
    });

    const report = builder.build();
    expect(report.passed).toBe(true);
    expect(report.files).toHaveLength(1);
    expect(report.stages).toHaveLength(1);
  });

  it('should build a failing report', () => {
    const builder = new VerificationReportBuilder();
    builder.addStageReport({
      stage: VerificationStage.SUBSTANTIVE,
      passed: false,
      details: 'Stubs detected',
      filesChecked: 1,
      filesPassed: 0,
    });

    const report = builder.build();
    expect(report.passed).toBe(false);
    expect(report.summary).toContain('FAILED');
  });

  it('should render markdown', () => {
    const builder = new VerificationReportBuilder();
    builder.addStageReport({
      stage: VerificationStage.EXISTS,
      passed: true,
      details: 'OK',
      filesChecked: 1,
      filesPassed: 1,
    });
    const report = builder.build();
    const md = VerificationReportBuilder.toMarkdown(report);
    expect(md).toContain('# Verification Report');
    expect(md).toContain('PASSED');
  });

  it('should render JSON', () => {
    const builder = new VerificationReportBuilder();
    const report = builder.build();
    const json = VerificationReportBuilder.toJSON(report);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('should include stub count in summary', () => {
    const builder = new VerificationReportBuilder();
    builder.addFileReport({
      filePath: 'src/test.ts',
      exists: true,
      substantive: false,
      wired: true,
      stubs: [
        { filePath: 'src/test.ts', line: 5, pattern: 'TODO', content: '// TODO', severity: 'warning' },
      ],
      issues: [],
    });
    const report = builder.build();
    expect(report.summary).toContain('1 stubs');
  });
});
