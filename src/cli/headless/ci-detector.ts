/**
 * CI Environment Detector
 *
 * Detects the current CI/CD environment from environment variables.
 * Supports GitHub Actions, GitLab CI, Jenkins, and CircleCI.
 *
 * Feature: F-10 - Headless CI/CD Mode
 */

import { createAgentLogger } from '@/shared/logging/logger';
import type { CIEnvironment } from './types';

const logger = createAgentLogger('Headless', 'ci-detector');

export class CIDetector {
  /**
   * Detect the current CI environment from environment variables.
   * Returns provider-specific metadata when available.
   */
  detect(): CIEnvironment {
    if (this.isGitHubActions()) return this.detectGitHubActions();
    if (this.isGitLabCI()) return this.detectGitLabCI();
    if (this.isJenkins()) return this.detectJenkins();
    if (this.isCircleCI()) return this.detectCircleCI();

    logger.debug('No known CI environment detected');
    return { provider: 'unknown' };
  }

  /**
   * Check whether execution is happening inside any CI environment.
   */
  isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.CONTINUOUS_INTEGRATION ||
      process.env.BUILD_NUMBER
    );
  }

  // ---- Provider detection helpers ----

  private isGitHubActions(): boolean {
    return !!process.env.GITHUB_ACTIONS;
  }

  private isGitLabCI(): boolean {
    return !!process.env.GITLAB_CI;
  }

  private isJenkins(): boolean {
    return !!process.env.JENKINS_URL;
  }

  private isCircleCI(): boolean {
    return !!process.env.CIRCLECI;
  }

  // ---- Provider-specific metadata extraction ----

  private detectGitHubActions(): CIEnvironment {
    logger.info('GitHub Actions environment detected');
    return {
      provider: 'github-actions',
      runId: process.env.GITHUB_RUN_ID,
      branch: process.env.GITHUB_REF_NAME,
      commit: process.env.GITHUB_SHA,
      prNumber:
        process.env.GITHUB_EVENT_NAME === 'pull_request'
          ? parseInt(
              process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)/)?.[1] || '0',
              10,
            ) || undefined
          : undefined,
      repository: process.env.GITHUB_REPOSITORY,
    };
  }

  private detectGitLabCI(): CIEnvironment {
    logger.info('GitLab CI environment detected');
    return {
      provider: 'gitlab-ci',
      runId: process.env.CI_PIPELINE_ID,
      branch: process.env.CI_COMMIT_BRANCH,
      commit: process.env.CI_COMMIT_SHA,
      prNumber: process.env.CI_MERGE_REQUEST_IID
        ? parseInt(process.env.CI_MERGE_REQUEST_IID, 10)
        : undefined,
      repository: process.env.CI_PROJECT_PATH,
    };
  }

  private detectJenkins(): CIEnvironment {
    logger.info('Jenkins environment detected');
    return {
      provider: 'jenkins',
      runId: process.env.BUILD_NUMBER,
      branch: process.env.GIT_BRANCH,
      commit: process.env.GIT_COMMIT,
      repository: process.env.JOB_NAME,
    };
  }

  private detectCircleCI(): CIEnvironment {
    logger.info('CircleCI environment detected');
    return {
      provider: 'circleci',
      runId: process.env.CIRCLE_BUILD_NUM,
      branch: process.env.CIRCLE_BRANCH,
      commit: process.env.CIRCLE_SHA1,
      prNumber: process.env.CIRCLE_PULL_REQUEST
        ? parseInt(
            process.env.CIRCLE_PULL_REQUEST.split('/').pop() || '0',
            10,
          ) || undefined
        : undefined,
      repository: `${process.env.CIRCLE_PROJECT_USERNAME}/${process.env.CIRCLE_PROJECT_REPONAME}`,
    };
  }
}

/**
 * Factory function for CIDetector.
 */
export function createCIDetector(): CIDetector {
  return new CIDetector();
}
