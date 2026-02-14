/**
 * Release Runner
 *
 * Orchestrates the release pipeline: version validation, testing, building,
 * changelog generation, npm publish, GitHub release, Docker push, and git tagging.
 * Supports dry-run mode and selective step skipping.
 *
 * Feature: G-16 - Release Automation
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import type { ReleaseConfig, ReleaseStep, ReleaseResult, ReleaseArtifact } from './types';
import { VersionManager } from './version-manager';
import { ChangelogGenerator } from './changelog-generator';

export class ReleaseRunner {
  private logs: string[] = [];
  private artifacts: ReleaseArtifact[] = [];
  private versionManager: VersionManager;
  private changelogGenerator: ChangelogGenerator;

  constructor(private config: ReleaseConfig) {
    this.versionManager = new VersionManager('package.json');
    this.changelogGenerator = new ChangelogGenerator();
  }

  async execute(): Promise<ReleaseResult> {
    const startTime = Date.now();
    const steps: ReleaseStep[] = [];

    const stepExecutors: Array<{ name: string; fn: () => Promise<ReleaseStep> }> = [
      { name: 'validate-version', fn: () => this.validateVersion() },
      { name: 'run-tests', fn: () => this.runTests() },
      { name: 'build', fn: () => this.build() },
      { name: 'generate-changelog', fn: () => this.generateChangelog() },
      { name: 'npm-publish', fn: () => this.npmPublish() },
      { name: 'github-release', fn: () => this.githubRelease() },
      { name: 'docker-push', fn: () => this.dockerPush() },
      { name: 'tag-commit', fn: () => this.tagCommit() },
    ];

    let failed = false;
    for (const executor of stepExecutors) {
      if (failed) {
        steps.push({ name: executor.name, status: 'skipped' });
        continue;
      }

      const step = await executor.fn();
      steps.push(step);

      if (step.status === 'failed') {
        failed = true;
      }
    }

    const totalDuration = Date.now() - startTime;

    return {
      version: this.config.version,
      success: !failed,
      steps,
      totalDuration,
      artifacts: [...this.artifacts],
    };
  }

  private async validateVersion(): Promise<ReleaseStep> {
    return this.runStep('validate-version', () => {
      if (!this.versionManager.validateVersion(this.config.version)) {
        throw new Error(`Invalid semver version: ${this.config.version}`);
      }
      this.log(`Version ${this.config.version} is valid`);
    });
  }

  private async runTests(): Promise<ReleaseStep> {
    if (this.config.skipTests) {
      this.log('Skipping tests (--skip-tests)');
      return { name: 'run-tests', status: 'skipped' };
    }

    return this.runStep('run-tests', () => {
      if (!this.config.dryRun) {
        this.exec('npm test');
      }
      this.log('Tests passed');
    });
  }

  private async build(): Promise<ReleaseStep> {
    if (this.config.skipBuild) {
      this.log('Skipping build (--skip-build)');
      return { name: 'build', status: 'skipped' };
    }

    return this.runStep('build', () => {
      if (!this.config.dryRun) {
        this.exec('npm run build');
      }
      this.log('Build completed');
    });
  }

  private async generateChangelog(): Promise<ReleaseStep> {
    return this.runStep('generate-changelog', () => {
      const date = new Date().toISOString().split('T')[0];
      let commits: string[] = [];

      if (!this.config.dryRun) {
        try {
          const output = this.exec('git log --oneline --no-merges HEAD...$(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~10)');
          commits = output.split('\n').filter(Boolean);
        } catch {
          commits = [];
        }
      }

      const changes = this.changelogGenerator.categorizeChanges(commits);
      const entry = this.changelogGenerator.generateEntry(this.config.version, date, changes);

      if (!this.config.dryRun && existsSync(this.config.changelogPath)) {
        const existing = readFileSync(this.config.changelogPath, 'utf-8');
        const updated = this.changelogGenerator.prependEntry(existing, entry);
        writeFileSync(this.config.changelogPath, updated);
      }

      this.log(`Changelog generated for ${this.config.version}`);
    });
  }

  private async npmPublish(): Promise<ReleaseStep> {
    if (!this.config.npmPublish) {
      this.log('Skipping npm publish (disabled)');
      return { name: 'npm-publish', status: 'skipped' };
    }

    return this.runStep('npm-publish', () => {
      const tag = this.config.prerelease ? 'next' : 'latest';
      if (!this.config.dryRun) {
        this.exec(`npm publish --tag ${tag}`);
      }
      this.artifacts.push({
        type: 'npm',
        name: `autonomous-coding-agents@${this.config.version}`,
        tag,
      });
      this.log(`Published to npm with tag: ${tag}`);
    });
  }

  private async githubRelease(): Promise<ReleaseStep> {
    if (!this.config.githubRelease) {
      this.log('Skipping GitHub release (disabled)');
      return { name: 'github-release', status: 'skipped' };
    }

    return this.runStep('github-release', () => {
      const prereleaseFlag = this.config.prerelease ? '--prerelease' : '';
      if (!this.config.dryRun) {
        this.exec(
          `gh release create ${this.config.tag} --title "Release ${this.config.version}" --notes "Release ${this.config.version}" ${prereleaseFlag}`.trim()
        );
      }
      this.artifacts.push({
        type: 'github',
        name: `Release ${this.config.version}`,
        tag: this.config.tag,
      });
      this.log(`GitHub release created: ${this.config.tag}`);
    });
  }

  private async dockerPush(): Promise<ReleaseStep> {
    if (!this.config.dockerPush) {
      this.log('Skipping Docker push (disabled)');
      return { name: 'docker-push', status: 'skipped' };
    }

    return this.runStep('docker-push', () => {
      const imageName = `autonomous-coding-agents:${this.config.version}`;
      if (!this.config.dryRun) {
        this.exec(`docker build -t ${imageName} .`);
        this.exec(`docker push ${imageName}`);
      }
      this.artifacts.push({
        type: 'docker',
        name: imageName,
        tag: this.config.version,
      });
      this.log(`Docker image pushed: ${imageName}`);
    });
  }

  private async tagCommit(): Promise<ReleaseStep> {
    return this.runStep('tag-commit', () => {
      if (!this.config.dryRun) {
        this.exec(`git tag -a ${this.config.tag} -m "Release ${this.config.version}"`);
        this.exec(`git push origin ${this.config.tag}`);
      }
      this.log(`Tagged commit: ${this.config.tag}`);
    });
  }

  private async runStep(name: string, fn: () => void): Promise<ReleaseStep> {
    const start = Date.now();
    try {
      fn();
      return {
        name,
        status: 'success',
        duration: Date.now() - start,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.log(`Step "${name}" failed: ${message}`);
      return {
        name,
        status: 'failed',
        duration: Date.now() - start,
        error: message,
      };
    }
  }

  private exec(command: string): string {
    if (this.config.dryRun) {
      this.log(`[dry-run] Would execute: ${command}`);
      return '';
    }
    return execSync(command, { encoding: 'utf-8' });
  }

  private log(message: string): void {
    this.logs.push(message);
  }
}
