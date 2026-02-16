/**
 * Verification Pipeline
 *
 * Wraps existing GoalBackwardVerifier with pre/post hooks and structured reporting.
 *
 * @module core/validation/verification-pipeline
 */

import type { GoalDefinition, IGoalBackwardVerifier } from './interfaces/validation.interface';
import type {
  IVerificationPipeline,
  VerificationReport,
  VerificationHook,
  FileVerificationReport,
} from './interfaces/verification-report.interface';
import { VerificationStage } from './interfaces/validation.interface';
import { VerificationReportBuilder } from './verification-report';
import { StubDetector } from './stub-detector';
import { readFile } from 'fs/promises';

/**
 * Verification Pipeline
 *
 * Extends GoalBackwardVerifier with structured reporting and hookable pipeline.
 */
export class VerificationPipeline implements IVerificationPipeline {
  private verifier: IGoalBackwardVerifier;
  private stubDetector: StubDetector;
  private preHooks: VerificationHook[] = [];
  private postHooks: VerificationHook[] = [];

  constructor(verifier: IGoalBackwardVerifier, stubDetector?: StubDetector) {
    this.verifier = verifier;
    this.stubDetector = stubDetector ?? new StubDetector();
  }

  async verify(goal: GoalDefinition): Promise<VerificationReport> {
    const builder = new VerificationReportBuilder();

    // Run existing verifier
    const result = await this.verifier.verify(goal);

    // Map stages to structured reports
    for (const stage of result.stages) {
      builder.addStageReport({
        stage: stage.stage,
        passed: stage.passed,
        details: stage.details,
        filesChecked: stage.checkedPaths?.length ?? goal.expectedPaths.length,
        filesPassed: stage.passed ? (stage.checkedPaths?.length ?? goal.expectedPaths.length) : 0,
      });
    }

    // Enhanced stub detection per file
    for (const filePath of goal.expectedPaths) {
      const fileReport = await this.analyzeFile(filePath, result);
      builder.addFileReport(fileReport);
    }

    const report = builder.build();

    // Execute pre-hooks (before returning)
    for (const hook of this.preHooks) {
      await hook(report);
    }

    // Execute post-hooks
    for (const hook of this.postHooks) {
      await hook(report);
    }

    return report;
  }

  addPreHook(hook: VerificationHook): void {
    this.preHooks.push(hook);
  }

  addPostHook(hook: VerificationHook): void {
    this.postHooks.push(hook);
  }

  private async analyzeFile(
    filePath: string,
    _result: { passed: boolean; stages: { stage: VerificationStage; passed: boolean }[] },
  ): Promise<FileVerificationReport> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const stubs = this.stubDetector.detect(filePath, content);

      const existsStage = _result.stages.find((s) => s.stage === VerificationStage.EXISTS);
      const substStage = _result.stages.find((s) => s.stage === VerificationStage.SUBSTANTIVE);
      const wiredStage = _result.stages.find((s) => s.stage === VerificationStage.WIRED);

      return {
        filePath,
        exists: existsStage?.passed ?? true,
        substantive: substStage?.passed ?? true,
        wired: wiredStage?.passed ?? true,
        stubs,
        issues: stubs
          .filter((s) => s.severity === 'error' || s.severity === 'critical')
          .map((s) => `${s.pattern} at line ${s.line}`),
      };
    } catch {
      return {
        filePath,
        exists: false,
        substantive: false,
        wired: false,
        stubs: [],
        issues: ['File not found'],
      };
    }
  }
}

/**
 * Create a verification pipeline
 */
export function createVerificationPipeline(
  verifier: IGoalBackwardVerifier,
  stubDetector?: StubDetector,
): VerificationPipeline {
  return new VerificationPipeline(verifier, stubDetector);
}
