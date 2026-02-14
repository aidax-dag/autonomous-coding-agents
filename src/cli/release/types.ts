/**
 * Release Automation Types
 *
 * Type definitions for the release pipeline including configuration,
 * step tracking, results, and artifact metadata.
 *
 * Feature: G-16 - Release Automation
 */

export interface ReleaseConfig {
  version: string;
  tag: string;
  prerelease: boolean;
  dryRun: boolean;
  skipTests: boolean;
  skipBuild: boolean;
  npmPublish: boolean;
  githubRelease: boolean;
  dockerPush: boolean;
  changelogPath: string;
}

export interface ReleaseStep {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
}

export interface ReleaseResult {
  version: string;
  success: boolean;
  steps: ReleaseStep[];
  totalDuration: number;
  artifacts: ReleaseArtifact[];
}

export interface ReleaseArtifact {
  type: 'npm' | 'github' | 'docker';
  name: string;
  url?: string;
  tag?: string;
}

export const RELEASE_STEPS = [
  'validate-version',
  'run-tests',
  'build',
  'generate-changelog',
  'npm-publish',
  'github-release',
  'docker-push',
  'tag-commit',
] as const;

export type ReleaseStepName = (typeof RELEASE_STEPS)[number];
