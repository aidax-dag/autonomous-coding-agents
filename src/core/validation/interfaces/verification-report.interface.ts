/**
 * Verification Report Interfaces
 *
 * Structured reporting for goal-backward verification.
 *
 * @module core/validation/interfaces/verification-report
 */

import type { VerificationStage } from './validation.interface';

/**
 * Severity level for stub detections
 *
 * - critical: Production code returning "Not implemented" or "placeholder" — must fix before deploy
 * - error: Stubs that indicate incomplete implementation (legacy alias for critical-adjacent)
 * - warning: Stub fallback in non-critical paths (TODOs, empty blocks)
 * - info: Template-only output that could be enhanced
 */
export type StubSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Stub detection result (per-line match within a file)
 */
export interface StubDetection {
  filePath: string;
  line: number;
  pattern: string;
  content: string;
  severity: StubSeverity;
}

/**
 * CI-friendly stub detection result (maps to the spec interface)
 */
export interface StubDetectionResult {
  file: string;
  line: number;
  pattern: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

/**
 * CI-friendly stub detection report
 */
export interface StubDetectionReport {
  results: StubDetectionResult[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  passed: boolean;
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
