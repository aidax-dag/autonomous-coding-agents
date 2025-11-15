/**
 * Auto-Fix Service
 *
 * Automatically fixes detected code issues and creates PRs/Issues.
 *
 * Feature: F4.5 - Auto Issue Detection and Fix
 */

import { Octokit } from '@octokit/rest';
import simpleGit, { SimpleGit } from 'simple-git';
import {
  AnalysisResult,
  FixReport,
  AnalysisSeverity,
} from './types';
import { StaticAnalyzer } from './static-analyzer';
import { createAgentLogger } from '@/shared/logging/logger';

const logger = createAgentLogger('Analysis', 'auto-fix');

/**
 * Configuration for auto-fix service
 */
export interface AutoFixConfig {
  repoPath: string;
  owner: string;
  repo: string;
  baseBranch?: string;
  autoCreatePR?: boolean;
  autoCreateIssue?: boolean;
  githubToken?: string;
}

/**
 * Auto-fix service
 */
export class AutoFixService {
  private config: AutoFixConfig;
  private analyzer: StaticAnalyzer;
  private git: SimpleGit;
  private octokit?: Octokit;

  constructor(config: AutoFixConfig) {
    this.config = {
      baseBranch: 'main',
      autoCreatePR: true,
      autoCreateIssue: true,
      ...config,
    };

    this.analyzer = new StaticAnalyzer({ autoFix: true });
    this.git = simpleGit(this.config.repoPath);

    if (this.config.githubToken) {
      this.octokit = new Octokit({
        auth: this.config.githubToken,
      });
    }
  }

  /**
   * Scan and fix issues in repository
   */
  async scanAndFix(): Promise<FixReport> {
    logger.info('Starting scan and fix', { repoPath: this.config.repoPath });

    try {
      // Step 1: Run analysis
      const report = await this.analyzer.analyzeAll(this.config.repoPath);

      logger.info('Analysis complete', {
        totalIssues: report.totalIssues,
        fixable: report.fixable,
      });

      // Step 2: Separate fixable and manual issues
      const fixable = report.results.filter((r) => r.fixable);
      const manual = report.results.filter((r) => !r.fixable);

      logger.info('Categorized issues', {
        fixable: fixable.length,
        manual: manual.length,
      });

      // Step 3: Apply fixes
      const { fixed, failed } = await this.applyFixes(fixable);

      logger.info('Fixes applied', {
        fixed: fixed.length,
        failed: failed.length,
      });

      // Step 4: Get modified files
      const filesModified = await this.getModifiedFiles();

      // Step 5: Create PR for auto-fixes (if enabled and there are fixes)
      let prCreated: FixReport['prCreated'];
      if (this.config.autoCreatePR && fixed.length > 0 && filesModified.length > 0) {
        prCreated = await this.createFixPR(fixed, filesModified);
      }

      // Step 6: Create issue for manual fixes (if enabled and there are manual fixes)
      let issueCreated: FixReport['issueCreated'];
      if (this.config.autoCreateIssue && (manual.length > 0 || failed.length > 0)) {
        issueCreated = await this.createManualIssue([...manual, ...failed]);
      }

      const fixReport: FixReport = {
        fixed,
        failed,
        manual,
        filesModified,
        prCreated,
        issueCreated,
      };

      logger.info('Scan and fix complete', {
        fixed: fixed.length,
        failed: failed.length,
        manual: manual.length,
        prCreated: !!prCreated,
        issueCreated: !!issueCreated,
      });

      return fixReport;
    } catch (error) {
      logger.error('Scan and fix failed', { error });
      throw error;
    }
  }

  /**
   * Apply fixes to files
   */
  private async applyFixes(
    fixable: AnalysisResult[]
  ): Promise<{ fixed: AnalysisResult[]; failed: AnalysisResult[] }> {
    const fixed: AnalysisResult[] = [];
    const failed: AnalysisResult[] = [];

    // Group by file
    const byFile = new Map<string, AnalysisResult[]>();
    for (const issue of fixable) {
      if (!byFile.has(issue.file)) {
        byFile.set(issue.file, []);
      }
      byFile.get(issue.file)!.push(issue);
    }

    // Apply fixes file by file
    for (const [file, issues] of byFile.entries()) {
      try {
        await this.applyFileFixesESLint(file, issues);
        fixed.push(...issues);
        logger.debug('Applied fixes to file', { file, count: issues.length });
      } catch (error) {
        logger.error('Failed to apply fixes to file', { file, error });
        failed.push(...issues);
      }
    }

    return { fixed, failed };
  }

  /**
   * Apply ESLint fixes to a file
   * ESLint's autoFix already handles this, but we could add custom logic here
   */
  private async applyFileFixesESLint(
    file: string,
    issues: AnalysisResult[]
  ): Promise<void> {
    // ESLint autoFix already applied in analyzer
    // This method exists for potential custom fix logic
    logger.debug('Fixes applied via ESLint', { file, count: issues.length });
  }

  /**
   * Get list of modified files
   */
  private async getModifiedFiles(): Promise<string[]> {
    const status = await this.git.status();
    return [...status.modified, ...status.created, ...status.renamed.map((r) => r.to)];
  }

  /**
   * Create PR for auto-fixes
   */
  private async createFixPR(
    fixed: AnalysisResult[],
    filesModified: string[]
  ): Promise<{ number: number; url: string }> {
    if (!this.octokit) {
      throw new Error('GitHub token required to create PR');
    }

    try {
      // Create branch
      const branchName = `auto-fix/${Date.now()}`;

      logger.info('Creating fix branch', { branch: branchName });

      await this.git.checkoutLocalBranch(branchName);

      // Commit changes
      await this.git.add(filesModified);

      const commitMessage = this.createFixCommitMessage(fixed);
      await this.git.commit(commitMessage);

      // Push branch
      await this.git.push('origin', branchName, ['--set-upstream']);

      logger.info('Pushed fix branch', { branch: branchName });

      // Create PR
      const prBody = this.createFixPRBody(fixed, filesModified);

      const { data: pr } = await this.octokit.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: `🔧 Auto-fix: ${fixed.length} issue(s)`,
        head: branchName,
        base: this.config.baseBranch!,
        body: prBody,
      });

      logger.info('Created PR', { number: pr.number, url: pr.html_url });

      // Switch back to base branch
      await this.git.checkout(this.config.baseBranch!);

      return {
        number: pr.number,
        url: pr.html_url,
      };
    } catch (error) {
      logger.error('Failed to create PR', { error });

      // Try to switch back to base branch
      try {
        await this.git.checkout(this.config.baseBranch!);
      } catch {
        // Ignore
      }

      throw error;
    }
  }

  /**
   * Create issue for manual fixes
   */
  private async createManualIssue(
    manual: AnalysisResult[]
  ): Promise<{ number: number; url: string }> {
    if (!this.octokit) {
      throw new Error('GitHub token required to create issue');
    }

    try {
      const issueBody = this.createManualIssueBody(manual);

      const { data: issue } = await this.octokit.issues.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: `🔍 Manual fixes required: ${manual.length} issue(s)`,
        body: issueBody,
        labels: ['code-quality', 'auto-detected'],
      });

      logger.info('Created issue', { number: issue.number, url: issue.html_url });

      return {
        number: issue.number,
        url: issue.html_url,
      };
    } catch (error) {
      logger.error('Failed to create issue', { error });
      throw error;
    }
  }

  /**
   * Create commit message for fixes
   */
  private createFixCommitMessage(fixed: AnalysisResult[]): string {
    const lines: string[] = [];

    lines.push('fix: Auto-fix code quality issues');
    lines.push('');
    lines.push(`Fixed ${fixed.length} issue(s):`);
    lines.push('');

    // Group by rule
    const byRule = new Map<string, number>();
    for (const issue of fixed) {
      byRule.set(issue.rule, (byRule.get(issue.rule) || 0) + 1);
    }

    for (const [rule, count] of byRule.entries()) {
      lines.push(`- ${rule}: ${count}`);
    }

    return lines.join('\n');
  }

  /**
   * Create PR body for fixes
   */
  private createFixPRBody(fixed: AnalysisResult[], filesModified: string[]): string {
    const lines: string[] = [];

    lines.push('## Auto-Fix Summary\n');
    lines.push(`This PR automatically fixes **${fixed.length}** code quality issue(s).\n`);
    lines.push('### Issues Fixed\n');

    // Group by severity
    const errors = fixed.filter((f) => f.severity === AnalysisSeverity.ERROR);
    const warnings = fixed.filter((f) => f.severity === AnalysisSeverity.WARNING);

    if (errors.length > 0) {
      lines.push(`- ❌ **Errors**: ${errors.length}`);
    }
    if (warnings.length > 0) {
      lines.push(`- ⚠️ **Warnings**: ${warnings.length}`);
    }

    lines.push('\n### Files Modified\n');
    for (const file of filesModified) {
      lines.push(`- \`${file}\``);
    }

    lines.push('\n### Rules Applied\n');

    // Group by rule
    const byRule = new Map<string, number>();
    for (const issue of fixed) {
      byRule.set(issue.rule, (byRule.get(issue.rule) || 0) + 1);
    }

    for (const [rule, count] of byRule.entries()) {
      lines.push(`- **${rule}**: ${count} fix(es)`);
    }

    lines.push('\n---\n');
    lines.push('🤖 This PR was automatically generated by the auto-fix system.');

    return lines.join('\n');
  }

  /**
   * Create issue body for manual fixes
   */
  private createManualIssueBody(manual: AnalysisResult[]): string {
    const lines: string[] = [];

    lines.push('## Manual Fixes Required\n');
    lines.push(
      `The following **${manual.length}** issue(s) require manual attention:\n`
    );

    // Group by file
    const byFile = new Map<string, AnalysisResult[]>();
    for (const issue of manual) {
      if (!byFile.has(issue.file)) {
        byFile.set(issue.file, []);
      }
      byFile.get(issue.file)!.push(issue);
    }

    for (const [file, issues] of byFile.entries()) {
      lines.push(`### \`${file}\`\n`);

      for (const issue of issues) {
        const icon =
          issue.severity === AnalysisSeverity.ERROR
            ? '❌'
            : issue.severity === AnalysisSeverity.WARNING
            ? '⚠️'
            : 'ℹ️';

        lines.push(
          `${icon} **${issue.rule}**: ${issue.message} (line ${issue.line}:${issue.column})`
        );
      }

      lines.push('');
    }

    lines.push('---\n');
    lines.push('🤖 This issue was automatically generated by the auto-fix system.');

    return lines.join('\n');
  }
}
