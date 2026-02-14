/**
 * Release Automation — Unit Tests
 *
 * Tests VersionManager, ChangelogGenerator, and ReleaseRunner
 * for the complete release pipeline.
 *
 * Feature: G-16 - Release Automation
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(''),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
}));

import { VersionManager } from '@/cli/release/version-manager';
import { ChangelogGenerator } from '@/cli/release/changelog-generator';
import type { ChangelogEntry } from '@/cli/release/changelog-generator';
import { ReleaseRunner } from '@/cli/release/release-runner';
import type { ReleaseConfig } from '@/cli/release/types';

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>;
const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>;

// ---- Helpers ----

function makePackageJson(version: string): string {
  return JSON.stringify({ name: 'test-pkg', version });
}

function makeReleaseConfig(overrides: Partial<ReleaseConfig> = {}): ReleaseConfig {
  return {
    version: '1.0.0',
    tag: 'v1.0.0',
    prerelease: false,
    dryRun: false,
    skipTests: false,
    skipBuild: false,
    npmPublish: false,
    githubRelease: false,
    dockerPush: false,
    changelogPath: 'CHANGELOG.md',
    ...overrides,
  };
}

// =============================================================================
// VersionManager
// =============================================================================

describe('VersionManager', () => {
  let vm: VersionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue(makePackageJson('1.2.3'));
    vm = new VersionManager('package.json');
  });

  describe('getCurrentVersion', () => {
    it('should read version from package.json', () => {
      expect(vm.getCurrentVersion()).toBe('1.2.3');
      expect(mockReadFileSync).toHaveBeenCalledWith('package.json', 'utf-8');
    });
  });

  describe('validateVersion', () => {
    it('should accept valid semver versions', () => {
      expect(vm.validateVersion('1.0.0')).toBe(true);
      expect(vm.validateVersion('0.0.1')).toBe(true);
      expect(vm.validateVersion('10.20.30')).toBe(true);
    });

    it('should accept valid prerelease versions', () => {
      expect(vm.validateVersion('1.0.0-alpha.1')).toBe(true);
      expect(vm.validateVersion('1.0.0-beta.0')).toBe(true);
      expect(vm.validateVersion('2.0.0-rc.1')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(vm.validateVersion('not-a-version')).toBe(false);
      expect(vm.validateVersion('1.0')).toBe(false);
      expect(vm.validateVersion('v1.0.0')).toBe(false);
      expect(vm.validateVersion('')).toBe(false);
      expect(vm.validateVersion('1.0.0.0')).toBe(false);
    });
  });

  describe('bumpVersion', () => {
    it('should bump major version', () => {
      expect(vm.bumpVersion('major')).toBe('2.0.0');
    });

    it('should bump minor version', () => {
      expect(vm.bumpVersion('minor')).toBe('1.3.0');
    });

    it('should bump patch version', () => {
      expect(vm.bumpVersion('patch')).toBe('1.2.4');
    });

    it('should bump prerelease version from stable', () => {
      const result = vm.bumpVersion('prerelease');
      expect(result).toBe('1.2.4-beta.0');
    });

    it('should bump prerelease version from existing prerelease', () => {
      mockReadFileSync.mockReturnValue(makePackageJson('1.2.3-beta.0'));
      vm = new VersionManager('package.json');
      expect(vm.bumpVersion('prerelease')).toBe('1.2.3-beta.1');
    });
  });

  describe('isPrerelease', () => {
    it('should detect prerelease versions', () => {
      expect(vm.isPrerelease('1.0.0-alpha.1')).toBe(true);
      expect(vm.isPrerelease('1.0.0-beta.0')).toBe(true);
      expect(vm.isPrerelease('2.0.0-rc.1')).toBe(true);
    });

    it('should return false for stable versions', () => {
      expect(vm.isPrerelease('1.0.0')).toBe(false);
      expect(vm.isPrerelease('2.3.4')).toBe(false);
    });
  });

  describe('compareVersions', () => {
    it('should compare major versions', () => {
      expect(vm.compareVersions('2.0.0', '1.0.0')).toBe(1);
      expect(vm.compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('should compare minor versions', () => {
      expect(vm.compareVersions('1.2.0', '1.1.0')).toBe(1);
      expect(vm.compareVersions('1.1.0', '1.2.0')).toBe(-1);
    });

    it('should compare patch versions', () => {
      expect(vm.compareVersions('1.0.2', '1.0.1')).toBe(1);
      expect(vm.compareVersions('1.0.1', '1.0.2')).toBe(-1);
    });

    it('should return 0 for equal versions', () => {
      expect(vm.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should rank stable higher than prerelease', () => {
      expect(vm.compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
      expect(vm.compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1);
    });

    it('should compare prerelease identifiers numerically', () => {
      expect(vm.compareVersions('1.0.0-beta.2', '1.0.0-beta.1')).toBe(1);
      expect(vm.compareVersions('1.0.0-beta.1', '1.0.0-beta.2')).toBe(-1);
    });
  });

  describe('getTag', () => {
    it('should prefix version with v', () => {
      expect(vm.getTag('1.0.0')).toBe('v1.0.0');
      expect(vm.getTag('2.3.4-beta.1')).toBe('v2.3.4-beta.1');
    });
  });

  describe('parseVersion', () => {
    it('should parse stable version', () => {
      expect(vm.parseVersion('1.2.3')).toEqual({
        major: 1,
        minor: 2,
        patch: 3,
        prerelease: undefined,
      });
    });

    it('should parse prerelease version', () => {
      expect(vm.parseVersion('1.0.0-alpha.1')).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'alpha.1',
      });
    });

    it('should throw on invalid version', () => {
      expect(() => vm.parseVersion('invalid')).toThrow('Invalid semver version');
    });
  });
});

// =============================================================================
// ChangelogGenerator
// =============================================================================

describe('ChangelogGenerator', () => {
  let generator: ChangelogGenerator;

  beforeEach(() => {
    generator = new ChangelogGenerator();
  });

  describe('generateEntry', () => {
    it('should generate entry with categorized changes', () => {
      const changes: ChangelogEntry[] = [
        { category: 'feature', description: 'Add user authentication' },
        { category: 'fix', description: 'Fix login timeout' },
      ];
      const result = generator.generateEntry('1.0.0', '2026-02-14', changes);

      expect(result).toContain('## 1.0.0 - 2026-02-14');
      expect(result).toContain('### Features');
      expect(result).toContain('- Add user authentication');
      expect(result).toContain('### Bug Fixes');
      expect(result).toContain('- Fix login timeout');
    });

    it('should include scope as bold prefix when present', () => {
      const changes: ChangelogEntry[] = [
        { category: 'feature', description: 'Add dark mode', scope: 'ui' },
      ];
      const result = generator.generateEntry('1.0.0', '2026-02-14', changes);
      expect(result).toContain('- **ui**: Add dark mode');
    });

    it('should handle empty changes', () => {
      const result = generator.generateEntry('1.0.0', '2026-02-14', []);
      expect(result).toContain('## 1.0.0 - 2026-02-14');
      expect(result).toContain('No notable changes');
    });

    it('should order breaking changes first', () => {
      const changes: ChangelogEntry[] = [
        { category: 'feature', description: 'New API' },
        { category: 'breaking', description: 'Remove deprecated endpoint' },
        { category: 'fix', description: 'Fix crash' },
      ];
      const result = generator.generateEntry('2.0.0', '2026-02-14', changes);
      const breakingIndex = result.indexOf('### Breaking Changes');
      const featureIndex = result.indexOf('### Features');
      const fixIndex = result.indexOf('### Bug Fixes');

      expect(breakingIndex).toBeLessThan(featureIndex);
      expect(featureIndex).toBeLessThan(fixIndex);
    });

    it('should format dates correctly in the header', () => {
      const result = generator.generateEntry('1.0.0', '2026-12-31', []);
      expect(result).toContain('## 1.0.0 - 2026-12-31');
    });

    it('should generate multiple entries per category', () => {
      const changes: ChangelogEntry[] = [
        { category: 'fix', description: 'Fix A' },
        { category: 'fix', description: 'Fix B' },
        { category: 'fix', description: 'Fix C' },
      ];
      const result = generator.generateEntry('1.0.1', '2026-02-14', changes);
      expect(result).toContain('- Fix A');
      expect(result).toContain('- Fix B');
      expect(result).toContain('- Fix C');
    });
  });

  describe('parseExistingChangelog', () => {
    it('should parse changelog with version headers', () => {
      const content = [
        '# Changelog',
        '',
        '## 2.0.0 - 2026-02-14',
        '',
        '- Major update',
        '',
        '## 1.0.0 - 2026-01-01',
        '',
        '- Initial release',
      ].join('\n');

      const result = generator.parseExistingChangelog(content);
      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].version).toBe('2.0.0');
      expect(result.versions[0].date).toBe('2026-02-14');
      expect(result.versions[1].version).toBe('1.0.0');
      expect(result.versions[1].date).toBe('2026-01-01');
    });

    it('should parse entries within each version', () => {
      const content = [
        '## 1.0.0 - 2026-01-01',
        '',
        '- Feature one',
        '- Feature two',
      ].join('\n');

      const result = generator.parseExistingChangelog(content);
      expect(result.versions[0].entries).toHaveLength(2);
      expect(result.versions[0].entries[0].description).toBe('Feature one');
    });

    it('should handle empty changelog', () => {
      const result = generator.parseExistingChangelog('');
      expect(result.versions).toHaveLength(0);
    });

    it('should handle changelog with no version headers', () => {
      const content = '# Changelog\n\nSome introductory text.';
      const result = generator.parseExistingChangelog(content);
      expect(result.versions).toHaveLength(0);
    });
  });

  describe('prependEntry', () => {
    it('should prepend new entry after existing header', () => {
      const existing = '# Changelog\n\n## 1.0.0 - 2026-01-01\n\n- Old entry\n';
      const newEntry = '## 2.0.0 - 2026-02-14\n\n- New entry\n';
      const result = generator.prependEntry(existing, newEntry);

      expect(result).toMatch(/^# Changelog\n\n/);
      expect(result.indexOf('2.0.0')).toBeLessThan(result.indexOf('1.0.0'));
    });

    it('should handle content without header', () => {
      const existing = '## 1.0.0 - 2026-01-01\n\n- Old entry\n';
      const newEntry = '## 2.0.0 - 2026-02-14\n\n- New entry\n';
      const result = generator.prependEntry(existing, newEntry);

      expect(result.indexOf('2.0.0')).toBeLessThan(result.indexOf('1.0.0'));
    });
  });

  describe('categorizeChanges', () => {
    it('should categorize conventional commit messages', () => {
      const commits = [
        'feat: add user authentication',
        'fix: resolve login timeout',
        'docs: update README',
      ];
      const entries = generator.categorizeChanges(commits);

      expect(entries).toHaveLength(3);
      expect(entries[0]).toEqual({
        category: 'feature',
        description: 'add user authentication',
        scope: undefined,
      });
      expect(entries[1]).toEqual({
        category: 'fix',
        description: 'resolve login timeout',
        scope: undefined,
      });
      expect(entries[2]).toEqual({
        category: 'docs',
        description: 'update README',
        scope: undefined,
      });
    });

    it('should extract scope from commits', () => {
      const commits = ['feat(auth): add OAuth support'];
      const entries = generator.categorizeChanges(commits);

      expect(entries[0].scope).toBe('auth');
      expect(entries[0].category).toBe('feature');
      expect(entries[0].description).toBe('add OAuth support');
    });

    it('should detect breaking changes via exclamation mark', () => {
      const commits = ['feat!: remove deprecated API'];
      const entries = generator.categorizeChanges(commits);

      expect(entries[0].category).toBe('breaking');
    });

    it('should skip non-conventional commit messages', () => {
      const commits = [
        'feat: valid commit',
        'random message without type',
        'another arbitrary line',
      ];
      const entries = generator.categorizeChanges(commits);

      expect(entries).toHaveLength(1);
      expect(entries[0].description).toBe('valid commit');
    });

    it('should handle empty commit list', () => {
      expect(generator.categorizeChanges([])).toEqual([]);
    });

    it('should categorize test and refactor types', () => {
      const commits = [
        'test: add unit tests for auth',
        'refactor: simplify error handling',
      ];
      const entries = generator.categorizeChanges(commits);

      expect(entries[0].category).toBe('test');
      expect(entries[1].category).toBe('refactor');
    });

    it('should categorize chore type', () => {
      const commits = ['chore: update dependencies'];
      const entries = generator.categorizeChanges(commits);

      expect(entries[0].category).toBe('chore');
    });

    it('should map unknown types to chore', () => {
      const commits = ['ci: update workflow'];
      const entries = generator.categorizeChanges(commits);

      expect(entries[0].category).toBe('chore');
    });
  });
});

// =============================================================================
// ReleaseRunner
// =============================================================================

describe('ReleaseRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFileSync.mockReturnValue(makePackageJson('1.0.0'));
    mockExistsSync.mockReturnValue(false);
    mockExecSync.mockReturnValue('' as any);
  });

  describe('execute', () => {
    it('should execute all steps in order', async () => {
      const config = makeReleaseConfig({ dryRun: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const stepNames = result.steps.map((s) => s.name);
      expect(stepNames).toEqual([
        'validate-version',
        'run-tests',
        'build',
        'generate-changelog',
        'npm-publish',
        'github-release',
        'docker-push',
        'tag-commit',
      ]);
    });

    it('should report success when all steps pass', async () => {
      const config = makeReleaseConfig({ dryRun: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      expect(result.success).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('should calculate total duration', async () => {
      const config = makeReleaseConfig({ dryRun: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should include duration for each successful step', async () => {
      const config = makeReleaseConfig({ dryRun: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const successSteps = result.steps.filter((s) => s.status === 'success');
      for (const step of successSteps) {
        expect(step.duration).toBeDefined();
        expect(step.duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('dry run mode', () => {
    it('should not execute shell commands in dry run', async () => {
      const config = makeReleaseConfig({
        dryRun: true,
        npmPublish: true,
        githubRelease: true,
        dockerPush: true,
      });
      const runner = new ReleaseRunner(config);
      await runner.execute();

      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should still validate version in dry run', async () => {
      const config = makeReleaseConfig({ dryRun: true, version: 'invalid' });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const validateStep = result.steps.find((s) => s.name === 'validate-version');
      expect(validateStep?.status).toBe('failed');
    });
  });

  describe('skip flags', () => {
    it('should skip tests when skipTests is true', async () => {
      const config = makeReleaseConfig({ dryRun: true, skipTests: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const testStep = result.steps.find((s) => s.name === 'run-tests');
      expect(testStep?.status).toBe('skipped');
    });

    it('should skip build when skipBuild is true', async () => {
      const config = makeReleaseConfig({ dryRun: true, skipBuild: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const buildStep = result.steps.find((s) => s.name === 'build');
      expect(buildStep?.status).toBe('skipped');
    });
  });

  describe('publish flags', () => {
    it('should skip npm publish when disabled', async () => {
      const config = makeReleaseConfig({ dryRun: true, npmPublish: false });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const npmStep = result.steps.find((s) => s.name === 'npm-publish');
      expect(npmStep?.status).toBe('skipped');
    });

    it('should skip GitHub release when disabled', async () => {
      const config = makeReleaseConfig({ dryRun: true, githubRelease: false });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const ghStep = result.steps.find((s) => s.name === 'github-release');
      expect(ghStep?.status).toBe('skipped');
    });

    it('should skip Docker push when disabled', async () => {
      const config = makeReleaseConfig({ dryRun: true, dockerPush: false });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const dockerStep = result.steps.find((s) => s.name === 'docker-push');
      expect(dockerStep?.status).toBe('skipped');
    });

    it('should collect npm artifact when enabled', async () => {
      const config = makeReleaseConfig({ dryRun: true, npmPublish: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const npmArtifact = result.artifacts.find((a) => a.type === 'npm');
      expect(npmArtifact).toBeDefined();
      expect(npmArtifact?.name).toContain('1.0.0');
    });

    it('should collect GitHub artifact when enabled', async () => {
      const config = makeReleaseConfig({ dryRun: true, githubRelease: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const ghArtifact = result.artifacts.find((a) => a.type === 'github');
      expect(ghArtifact).toBeDefined();
      expect(ghArtifact?.tag).toBe('v1.0.0');
    });

    it('should collect Docker artifact when enabled', async () => {
      const config = makeReleaseConfig({ dryRun: true, dockerPush: true });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const dockerArtifact = result.artifacts.find((a) => a.type === 'docker');
      expect(dockerArtifact).toBeDefined();
      expect(dockerArtifact?.tag).toBe('1.0.0');
    });
  });

  describe('failure handling', () => {
    it('should stop execution after a failed step', async () => {
      const config = makeReleaseConfig({ version: 'invalid' });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      expect(result.success).toBe(false);

      const validateStep = result.steps.find((s) => s.name === 'validate-version');
      expect(validateStep?.status).toBe('failed');

      // All steps after the failed one should be skipped
      const remainingSteps = result.steps.slice(1);
      for (const step of remainingSteps) {
        expect(step.status).toBe('skipped');
      }
    });

    it('should record error message in failed step', async () => {
      const config = makeReleaseConfig({ version: 'invalid' });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const validateStep = result.steps.find((s) => s.name === 'validate-version');
      expect(validateStep?.error).toContain('Invalid semver version');
    });

    it('should record duration for failed steps', async () => {
      const config = makeReleaseConfig({ version: 'invalid' });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const validateStep = result.steps.find((s) => s.name === 'validate-version');
      expect(validateStep?.duration).toBeDefined();
      expect(validateStep?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should set success to false when any step fails', async () => {
      const config = makeReleaseConfig({ version: 'invalid' });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      expect(result.success).toBe(false);
    });

    it('should handle exec failure gracefully', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('npm test failed');
      });

      const config = makeReleaseConfig({ skipTests: false });
      const runner = new ReleaseRunner(config);
      const result = await runner.execute();

      const testStep = result.steps.find((s) => s.name === 'run-tests');
      expect(testStep?.status).toBe('failed');
      expect(testStep?.error).toContain('npm test failed');
    });
  });

  describe('actual execution (non-dry-run)', () => {
    it('should call npm test when tests are not skipped', async () => {
      const config = makeReleaseConfig({ skipTests: false, skipBuild: true });
      const runner = new ReleaseRunner(config);
      await runner.execute();

      expect(mockExecSync).toHaveBeenCalledWith('npm test', { encoding: 'utf-8' });
    });

    it('should call npm run build when build is not skipped', async () => {
      const config = makeReleaseConfig({ skipTests: true, skipBuild: false });
      const runner = new ReleaseRunner(config);
      await runner.execute();

      expect(mockExecSync).toHaveBeenCalledWith('npm run build', { encoding: 'utf-8' });
    });

    it('should call npm publish with correct tag', async () => {
      const config = makeReleaseConfig({
        skipTests: true,
        skipBuild: true,
        npmPublish: true,
      });
      const runner = new ReleaseRunner(config);
      await runner.execute();

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm publish --tag latest',
        { encoding: 'utf-8' }
      );
    });

    it('should use "next" tag for prerelease npm publish', async () => {
      const config = makeReleaseConfig({
        skipTests: true,
        skipBuild: true,
        npmPublish: true,
        prerelease: true,
        version: '1.0.0-beta.1',
        tag: 'v1.0.0-beta.1',
      });
      const runner = new ReleaseRunner(config);
      await runner.execute();

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm publish --tag next',
        { encoding: 'utf-8' }
      );
    });

    it('should create git tag and push it', async () => {
      const config = makeReleaseConfig({
        skipTests: true,
        skipBuild: true,
        tag: 'v1.0.0',
      });
      const runner = new ReleaseRunner(config);
      await runner.execute();

      expect(mockExecSync).toHaveBeenCalledWith(
        'git tag -a v1.0.0 -m "Release 1.0.0"',
        { encoding: 'utf-8' }
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'git push origin v1.0.0',
        { encoding: 'utf-8' }
      );
    });
  });
});
