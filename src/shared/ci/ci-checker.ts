/**
 * CI Status Checker
 *
 * Checks CI/CD status for GitHub pull requests using GitHub API.
 *
 * Feature: F4.1 - CI/CD Integration
 */

import { Octokit } from 'octokit';
import {
  CIStatus,
  CheckRun,
  CheckStatus,
  CheckConclusion,
  CICheckConfig,
} from './types.js';
import { createAgentLogger } from '../logging/logger.js';

const logger = createAgentLogger('CI', 'ci-checker');

/**
 * CI Status Checker
 */
export class CIChecker {
  private octokit: Octokit;
  private config: CICheckConfig;

  constructor(token: string, config?: Partial<CICheckConfig>) {
    this.octokit = new Octokit({ auth: token });
    this.config = {
      provider: 'github-actions',
      timeout: 600000, // 10 minutes
      pollInterval: 10000, // 10 seconds
      minCoverage: 80,
      ...config,
    };
  }

  /**
   * Get CI status for a commit
   */
  async getStatus(owner: string, repo: string, ref: string): Promise<CIStatus> {
    logger.info('Getting CI status', { owner, repo, ref });

    try {
      // Get check runs for the commit
      const response = await this.octokit.rest.checks.listForRef({
        owner,
        repo,
        ref,
      });

      const checkRuns: CheckRun[] = response.data.check_runs.map((run: any) => ({
        id: run.id,
        name: run.name,
        status: run.status as CheckStatus,
        conclusion: run.conclusion as CheckConclusion | undefined,
        startedAt: run.started_at || new Date().toISOString(),
        completedAt: run.completed_at || undefined,
        detailsUrl: run.details_url || undefined,
        output: run.output
          ? {
              title: run.output.title || '',
              summary: run.output.summary || '',
            }
          : undefined,
      }));

      // Filter by required checks if specified
      const relevantChecks = this.config.requiredChecks
        ? checkRuns.filter((run) => this.config.requiredChecks!.includes(run.name))
        : checkRuns;

      // Calculate overall status
      const completedCount = relevantChecks.filter((run) => run.status === 'completed').length;
      const totalCount = relevantChecks.length;

      let overallStatus: CheckStatus = 'completed';
      let overallConclusion: CheckConclusion | undefined;

      if (completedCount < totalCount) {
        const hasInProgress = relevantChecks.some((run) => run.status === 'in_progress');
        overallStatus = hasInProgress ? 'in_progress' : 'queued';
      } else {
        // All completed - determine overall conclusion
        const hasFailure = relevantChecks.some(
          (run) => run.conclusion === 'failure' || run.conclusion === 'timed_out'
        );
        const hasCancelled = relevantChecks.some((run) => run.conclusion === 'cancelled');
        const hasActionRequired = relevantChecks.some(
          (run) => run.conclusion === 'action_required'
        );

        if (hasFailure) {
          overallConclusion = 'failure';
        } else if (hasCancelled) {
          overallConclusion = 'cancelled';
        } else if (hasActionRequired) {
          overallConclusion = 'action_required';
        } else {
          overallConclusion = 'success';
        }
      }

      const status: CIStatus = {
        provider: this.config.provider,
        sha: ref,
        status: overallStatus,
        conclusion: overallConclusion,
        checkRuns: relevantChecks,
        totalCount,
        completedCount,
      };

      logger.info('CI status retrieved', {
        status: overallStatus,
        conclusion: overallConclusion,
        completed: completedCount,
        total: totalCount,
      });

      return status;
    } catch (error) {
      logger.error('Failed to get CI status', { error });
      throw error;
    }
  }

  /**
   * Wait for CI checks to complete
   */
  async waitForCompletion(
    owner: string,
    repo: string,
    ref: string,
    timeout?: number
  ): Promise<CIStatus> {
    const maxWait = timeout || this.config.timeout!;
    const startTime = Date.now();

    logger.info('Waiting for CI completion', { owner, repo, ref, timeout: maxWait });

    while (Date.now() - startTime < maxWait) {
      const status = await this.getStatus(owner, repo, ref);

      if (status.status === 'completed') {
        logger.info('CI checks completed', {
          conclusion: status.conclusion,
          duration: Date.now() - startTime,
        });
        return status;
      }

      logger.debug('CI checks still running', {
        completed: status.completedCount,
        total: status.totalCount,
        elapsed: Date.now() - startTime,
      });

      // Wait before polling again
      await this.sleep(this.config.pollInterval!);
    }

    // Timeout reached
    logger.warn('CI check timeout reached', {
      timeout: maxWait,
      owner,
      repo,
      ref,
    });

    const finalStatus = await this.getStatus(owner, repo, ref);
    return finalStatus;
  }

  /**
   * Check if CI passed
   */
  isPassed(status: CIStatus): boolean {
    return status.status === 'completed' && status.conclusion === 'success';
  }

  /**
   * Check if CI failed
   */
  isFailed(status: CIStatus): boolean {
    return (
      status.status === 'completed' &&
      (status.conclusion === 'failure' || status.conclusion === 'timed_out')
    );
  }

  /**
   * Get failed check runs
   */
  getFailedChecks(status: CIStatus): CheckRun[] {
    return status.checkRuns.filter(
      (run) =>
        run.status === 'completed' &&
        (run.conclusion === 'failure' || run.conclusion === 'timed_out')
    );
  }

  /**
   * Format CI status for display
   */
  formatStatus(status: CIStatus): string {
    const lines: string[] = [];

    lines.push(`Overall Status: ${status.status}`);
    if (status.conclusion) {
      lines.push(`Conclusion: ${status.conclusion}`);
    }
    lines.push(`Completed: ${status.completedCount}/${status.totalCount}`);

    if (status.checkRuns.length > 0) {
      lines.push('\nCheck Runs:');
      for (const run of status.checkRuns) {
        const icon = this.getStatusIcon(run);
        const conclusionStr = run.conclusion ? ` (${run.conclusion})` : '';
        lines.push(`  ${icon} ${run.name}${conclusionStr}`);
      }
    }

    if (status.coverage !== undefined) {
      lines.push(`\nCoverage: ${status.coverage}%`);
    }

    return lines.join('\n');
  }

  /**
   * Get status icon for check run
   */
  private getStatusIcon(run: CheckRun): string {
    if (run.status !== 'completed') {
      return '⏳';
    }

    switch (run.conclusion) {
      case 'success':
        return '✅';
      case 'failure':
      case 'timed_out':
        return '❌';
      case 'cancelled':
        return '🚫';
      case 'skipped':
        return '⏭️';
      case 'neutral':
        return '⚪';
      case 'action_required':
        return '⚠️';
      default:
        return '❓';
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CICheckConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('CI checker configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): CICheckConfig {
    return { ...this.config };
  }
}
