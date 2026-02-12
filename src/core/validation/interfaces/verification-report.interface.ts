/**
 * Verification Report Interfaces
 *
 * Structured reporting for goal-backward verification.
 *
 * @module core/validation/interfaces/verification-report
 */

import type { VerificationStage } from './validation.interface';

/**
 * Stub detection result
 */
export interface StubDetection {
  filePath: string;
  line: number;
  pattern: string;
  content: string;
  severity: 'warning' | 'error';
}

/**
 * Per-file verification report
 */
export interface FileVerificationReport {
  filePath: string;
  exists: boolean;
  substantive: boolean;
  wired: boolean;
  stubs: StubDetection[];
  issues: string[];
}

/**
 * Per-stage report
 */
export interface StageReport {
  stage: VerificationStage;
  passed: boolean;
  details: string;
  filesChecked: number;
  filesPassed: number;
}

/**
 * Full verification report
 */
export interface VerificationReport {
  passed: boolean;
  timestamp: number;
  duration: number;
  stages: StageReport[];
  files: FileVerificationReport[];
  summary: string;
}

/**
 * Verification pipeline hook
 */
export type VerificationHook = (report: VerificationReport) => Promise<void> | void;

/**
 * Verification pipeline interface
 */
export interface IVerificationPipeline {
  verify(goal: { description: string; expectedPaths: string[] }): Promise<VerificationReport>;
  addPreHook(hook: VerificationHook): void;
  addPostHook(hook: VerificationHook): void;
}
