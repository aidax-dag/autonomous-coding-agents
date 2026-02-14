/**
 * Release Automation
 *
 * Barrel export for the release pipeline modules.
 *
 * Feature: G-16 - Release Automation
 */

export { VersionManager } from './version-manager';
export { ChangelogGenerator } from './changelog-generator';
export { ReleaseRunner } from './release-runner';
export type {
  ReleaseConfig,
  ReleaseStep,
  ReleaseResult,
  ReleaseArtifact,
  ReleaseStepName,
} from './types';
export { RELEASE_STEPS } from './types';
export type { ChangelogEntry, ParsedChangelog } from './changelog-generator';
export type { ParsedVersion } from './version-manager';
