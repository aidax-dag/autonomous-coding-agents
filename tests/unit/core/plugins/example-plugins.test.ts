/**
 * Tests for Example Plugins
 *
 * Covers LintingPlugin, TestRunnerPlugin, and DocumentationPlugin
 * with mocked child_process.execFile, fs operations, and lifecycle validation.
 */

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';

import {
  LintingPlugin,
  createLintingPlugin,
  LINTING_PLUGIN_MANIFEST,
  LINTING_MARKETPLACE_MANIFEST,
} from '@/core/plugins/examples/linting-plugin';

import {
  TestRunnerPlugin,
  createTestRunnerPlugin,
  TEST_RUNNER_PLUGIN_MANIFEST,
  TEST_RUNNER_MARKETPLACE_MANIFEST,
} from '@/core/plugins/examples/test-runner-plugin';

import {
  DocumentationPlugin,
  createDocumentationPlugin,
  DOCS_PLUGIN_MANIFEST,
  DOCS_MARKETPLACE_MANIFEST,
} from '@/core/plugins/examples/documentation-plugin';

import type { PluginContext } from '@/core/plugins/interfaces/plugin.interface';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
}));

const mockedExecFile = execFile as unknown as jest.Mock;
const mockedReaddir = readdir as unknown as jest.Mock;
const mockedReadFile = readFile as unknown as jest.Mock;

/**
 * Mock execFile to call its callback with successful stdout.
 */
function mockExecSuccess(stdout: string, stderr = ''): void {
  mockedExecFile.mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
      callback(null, stdout, stderr);
    },
  );
}

/**
 * Mock execFile to call its callback with an error that has stdout attached.
 * This simulates tools like ESLint/Jest that exit non-zero but produce output.
 */
function mockExecFailWithStdout(stdout: string, stderr = ''): void {
  mockedExecFile.mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
      const error = Object.assign(new Error('Command failed'), {
        stdout,
        stderr,
        code: 1,
      });
      callback(error, stdout, stderr);
    },
  );
}

/**
 * Mock execFile to call its callback with an error without stdout.
 * This simulates command-not-found or similar fatal failures.
 */
function mockExecError(message: string): void {
  mockedExecFile.mockImplementation(
    (_cmd: string, _args: string[], _opts: unknown, callback: Function) => {
      callback(new Error(message), '', '');
    },
  );
}

// ============================================================================
// Helpers
// ============================================================================

function validContext(overrides: Partial<PluginContext> = {}): PluginContext {
  return {
    workspaceDir: '/workspace',
    pluginDir: '/plugins',
    ...overrides,
  };
}

async function activatePlugin<T extends LintingPlugin | TestRunnerPlugin | DocumentationPlugin>(
  plugin: T,
  context?: PluginContext,
): Promise<T> {
  await plugin.initialize(context || validContext());
  await plugin.activate();
  return plugin;
}

// ============================================================================
// Shared Lifecycle Tests
// ============================================================================

function describeLifecycle(
  name: string,
  factory: () => LintingPlugin | TestRunnerPlugin | DocumentationPlugin,
): void {
  describe(`${name} lifecycle`, () => {
    it('should start in loaded status', () => {
      const plugin = factory();
      expect(plugin.status).toBe('loaded');
    });

    it('should transition loaded -> initialized -> active', async () => {
      const plugin = factory();
      await plugin.initialize(validContext());
      expect(plugin.status).toBe('initialized');
      await plugin.activate();
      expect(plugin.status).toBe('active');
    });

    it('should transition active -> initialized on deactivate', async () => {
      const plugin = await activatePlugin(factory());
      await plugin.deactivate();
      expect(plugin.status).toBe('initialized');
    });

    it('should transition to disposed on dispose', async () => {
      const plugin = await activatePlugin(factory());
      await plugin.dispose();
      expect(plugin.status).toBe('disposed');
    });

    it('should reject initialize when not in loaded status', async () => {
      const plugin = factory();
      await plugin.initialize(validContext());
      await expect(plugin.initialize(validContext())).rejects.toThrow('Cannot initialize');
    });

    it('should reject activate when not initialized', async () => {
      const plugin = factory();
      await expect(plugin.activate()).rejects.toThrow('Cannot activate');
    });

    it('should reject deactivate when not active', async () => {
      const plugin = factory();
      await plugin.initialize(validContext());
      await expect(plugin.deactivate()).rejects.toThrow('Cannot deactivate');
    });

    it('should reject initialize with invalid context', async () => {
      const plugin = factory();
      await expect(
        plugin.initialize({ workspaceDir: '', pluginDir: '' }),
      ).rejects.toThrow('PluginContext must have workspaceDir and pluginDir');
    });
  });
}

// ============================================================================
// LintingPlugin Tests
// ============================================================================

describe('LintingPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describeLifecycle('LintingPlugin', () => new LintingPlugin());

  describe('manifest', () => {
    it('should have correct plugin manifest', () => {
      const plugin = new LintingPlugin();
      expect(plugin.manifest.name).toBe('aca-plugin-linting');
      expect(plugin.manifest.version).toBe('1.0.0');
      expect(plugin.manifest.description).toBeTruthy();
      expect(plugin.manifest.author).toBe('aca-team');
    });

    it('should have valid marketplace manifest', () => {
      expect(LINTING_MARKETPLACE_MANIFEST.name).toBe('aca-plugin-linting');
      expect(LINTING_MARKETPLACE_MANIFEST.license).toBe('MIT');
      expect(LINTING_MARKETPLACE_MANIFEST.keywords).toContain('eslint');
      expect(LINTING_MARKETPLACE_MANIFEST.keywords).toContain('linting');
      expect(LINTING_MARKETPLACE_MANIFEST.acaVersion).toBe('0.1.0');
      expect(LINTING_MARKETPLACE_MANIFEST.main).toBe('linting-plugin.js');
    });

    it('should match plugin and marketplace manifest names', () => {
      expect(LINTING_PLUGIN_MANIFEST.name).toBe(LINTING_MARKETPLACE_MANIFEST.name);
      expect(LINTING_PLUGIN_MANIFEST.version).toBe(LINTING_MARKETPLACE_MANIFEST.version);
    });
  });

  describe('lint', () => {
    it('should return empty result for empty file list', async () => {
      const plugin = await activatePlugin(new LintingPlugin());
      const result = await plugin.lint([]);
      expect(result.issues).toEqual([]);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });

    it('should parse ESLint JSON output into structured issues', async () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/workspace/src/app.ts',
          messages: [
            { line: 10, column: 5, severity: 2, message: 'Unexpected var', ruleId: 'no-var' },
            { line: 15, column: 1, severity: 1, message: 'Missing semicolon', ruleId: 'semi', fix: {} },
          ],
        },
      ]);
      mockExecSuccess(eslintOutput);

      const plugin = await activatePlugin(new LintingPlugin());
      const result = await plugin.lint(['src/app.ts']);

      expect(result.issues).toHaveLength(2);
      expect(result.errorCount).toBe(1);
      expect(result.warningCount).toBe(1);
      expect(result.fixableCount).toBe(1);
      expect(result.issues[0]).toEqual({
        file: '/workspace/src/app.ts',
        line: 10,
        column: 5,
        severity: 'error',
        message: 'Unexpected var',
        ruleId: 'no-var',
      });
    });

    it('should handle ESLint exit code 1 with parseable stdout', async () => {
      const eslintOutput = JSON.stringify([
        {
          filePath: '/workspace/src/index.ts',
          messages: [
            { line: 1, column: 1, severity: 2, message: 'Parse error', ruleId: null },
          ],
        },
      ]);
      mockExecFailWithStdout(eslintOutput);

      const plugin = await activatePlugin(new LintingPlugin());
      const result = await plugin.lint(['src/index.ts']);

      expect(result.errorCount).toBe(1);
      expect(result.issues[0].severity).toBe('error');
    });

    it('should throw when plugin is not active', async () => {
      const plugin = new LintingPlugin();
      await expect(plugin.lint(['file.ts'])).rejects.toThrow('Plugin must be active');
    });

    it('should throw on execution failure without stdout', async () => {
      mockExecError('ENOENT: npx not found');
      const plugin = await activatePlugin(new LintingPlugin());
      await expect(plugin.lint(['file.ts'])).rejects.toThrow('ESLint execution failed');
    });
  });

  describe('typeCheck', () => {
    it('should return success when tsc passes', async () => {
      mockExecSuccess('');

      const plugin = await activatePlugin(new LintingPlugin());
      const result = await plugin.typeCheck();

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.errorCount).toBe(0);
    });

    it('should parse tsc error output', async () => {
      const tscOutput = 'src/app.ts(10,5): error TS2304: Cannot find name \'foo\'\nsrc/app.ts(20,3): error TS2345: Argument type mismatch';
      mockExecFailWithStdout(tscOutput);

      const plugin = await activatePlugin(new LintingPlugin());
      const result = await plugin.typeCheck();

      expect(result.success).toBe(false);
      expect(result.errorCount).toBe(2);
      expect(result.errors[0]).toEqual({
        file: 'src/app.ts',
        line: 10,
        column: 5,
        code: 2304,
        message: 'Cannot find name \'foo\'',
      });
    });

    it('should pass custom tsconfig path', async () => {
      mockExecSuccess('');

      const plugin = await activatePlugin(new LintingPlugin());
      await plugin.typeCheck('tsconfig.test.json');

      const callArgs = mockedExecFile.mock.calls[0];
      expect(callArgs[1]).toContain('--project');
      expect(callArgs[1]).toContain('tsconfig.test.json');
    });
  });

  describe('autoFix', () => {
    it('should return empty result for empty file list', async () => {
      const plugin = await activatePlugin(new LintingPlugin());
      const result = await plugin.autoFix([]);
      expect(result.issues).toEqual([]);
    });

    it('should invoke eslint with --fix flag', async () => {
      mockExecSuccess(JSON.stringify([]));

      const plugin = await activatePlugin(new LintingPlugin());
      await plugin.autoFix(['src/app.ts']);

      const callArgs = mockedExecFile.mock.calls[0];
      expect(callArgs[1]).toContain('--fix');
    });
  });

  describe('factory', () => {
    it('should create via factory function', () => {
      const plugin = createLintingPlugin();
      expect(plugin).toBeInstanceOf(LintingPlugin);
      expect(plugin.manifest.name).toBe('aca-plugin-linting');
    });
  });
});

// ============================================================================
// TestRunnerPlugin Tests
// ============================================================================

describe('TestRunnerPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describeLifecycle('TestRunnerPlugin', () => new TestRunnerPlugin());

  describe('manifest', () => {
    it('should have correct plugin manifest', () => {
      const plugin = new TestRunnerPlugin();
      expect(plugin.manifest.name).toBe('aca-plugin-test-runner');
      expect(plugin.manifest.version).toBe('1.0.0');
      expect(plugin.manifest.description).toBeTruthy();
      expect(plugin.manifest.author).toBe('aca-team');
    });

    it('should have valid marketplace manifest', () => {
      expect(TEST_RUNNER_MARKETPLACE_MANIFEST.name).toBe('aca-plugin-test-runner');
      expect(TEST_RUNNER_MARKETPLACE_MANIFEST.license).toBe('MIT');
      expect(TEST_RUNNER_MARKETPLACE_MANIFEST.keywords).toContain('jest');
      expect(TEST_RUNNER_MARKETPLACE_MANIFEST.keywords).toContain('testing');
      expect(TEST_RUNNER_MARKETPLACE_MANIFEST.acaVersion).toBe('0.1.0');
    });

    it('should match plugin and marketplace manifest names', () => {
      expect(TEST_RUNNER_PLUGIN_MANIFEST.name).toBe(TEST_RUNNER_MARKETPLACE_MANIFEST.name);
      expect(TEST_RUNNER_PLUGIN_MANIFEST.version).toBe(TEST_RUNNER_MARKETPLACE_MANIFEST.version);
    });
  });

  describe('runTests', () => {
    it('should parse successful Jest JSON output', async () => {
      const jestOutput = JSON.stringify({
        success: true,
        numTotalTests: 10,
        numPassedTests: 9,
        numFailedTests: 0,
        numPendingTests: 1,
        startTime: Date.now() - 5000,
        testResults: [
          { name: '/workspace/tests/auth.test.ts', numPassingTests: 5, numFailingTests: 0, perfStats: { runtime: 1200 } },
          { name: '/workspace/tests/api.test.ts', numPassingTests: 4, numFailingTests: 0, perfStats: { runtime: 800 } },
        ],
      });
      mockExecSuccess(jestOutput);

      const plugin = await activatePlugin(new TestRunnerPlugin());
      const result = await plugin.runTests();

      expect(result.success).toBe(true);
      expect(result.totalTests).toBe(10);
      expect(result.passed).toBe(9);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.suites).toHaveLength(2);
      expect(result.suites[0].name).toBe('auth.test.ts');
    });

    it('should handle test failures via exit code 1', async () => {
      const jestOutput = JSON.stringify({
        success: false,
        numTotalTests: 5,
        numPassedTests: 3,
        numFailedTests: 2,
        numPendingTests: 0,
        startTime: Date.now() - 2000,
        testResults: [
          { name: '/workspace/tests/broken.test.ts', numPassingTests: 3, numFailingTests: 2, perfStats: { runtime: 500 } },
        ],
      });
      mockExecFailWithStdout(jestOutput);

      const plugin = await activatePlugin(new TestRunnerPlugin());
      const result = await plugin.runTests();

      expect(result.success).toBe(false);
      expect(result.failed).toBe(2);
    });

    it('should pass test pattern as --testPathPattern', async () => {
      mockExecSuccess(JSON.stringify({
        success: true, numTotalTests: 0, numPassedTests: 0,
        numFailedTests: 0, numPendingTests: 0, startTime: Date.now(),
        testResults: [],
      }));

      const plugin = await activatePlugin(new TestRunnerPlugin());
      await plugin.runTests('auth');

      const callArgs = mockedExecFile.mock.calls[0];
      expect(callArgs[1]).toContain('--testPathPattern');
      expect(callArgs[1]).toContain('auth');
    });

    it('should throw when plugin is not active', async () => {
      const plugin = new TestRunnerPlugin();
      await expect(plugin.runTests()).rejects.toThrow('Plugin must be active');
    });

    it('should throw on execution failure without stdout', async () => {
      mockExecError('ENOENT: npx not found');
      const plugin = await activatePlugin(new TestRunnerPlugin());
      await expect(plugin.runTests()).rejects.toThrow('Jest execution failed');
    });
  });

  describe('runSingleTest', () => {
    it('should run a specific test file', async () => {
      mockExecSuccess(JSON.stringify({
        success: true, numTotalTests: 3, numPassedTests: 3,
        numFailedTests: 0, numPendingTests: 0, startTime: Date.now(),
        testResults: [
          { name: '/workspace/tests/single.test.ts', numPassingTests: 3, numFailingTests: 0, perfStats: { runtime: 300 } },
        ],
      }));

      const plugin = await activatePlugin(new TestRunnerPlugin());
      const result = await plugin.runSingleTest('tests/single.test.ts');

      expect(result.totalTests).toBe(3);
      expect(result.passed).toBe(3);
      const callArgs = mockedExecFile.mock.calls[0];
      expect(callArgs[1]).toContain('tests/single.test.ts');
    });
  });

  describe('getCoverage', () => {
    it('should parse coverage summary', async () => {
      const coverageOutput = JSON.stringify({
        coverageMap: {
          '/workspace/src/app.ts': {
            statementMap: { '0': {}, '1': {}, '2': {} },
            s: { '0': 1, '1': 1, '2': 0 },
            branchMap: { '0': { locations: [{}, {}] } },
            b: { '0': [1, 0] },
            fnMap: { '0': {} },
            f: { '0': 1 },
          },
        },
      });
      mockExecSuccess(coverageOutput);

      const plugin = await activatePlugin(new TestRunnerPlugin());
      const result = await plugin.getCoverage();

      expect(result.statements.total).toBe(3);
      expect(result.statements.covered).toBe(2);
      expect(result.statements.percentage).toBeCloseTo(66.67, 1);
      expect(result.branches.total).toBe(2);
      expect(result.branches.covered).toBe(1);
      expect(result.functions.total).toBe(1);
      expect(result.functions.covered).toBe(1);
    });

    it('should return zero metrics when no coverage map exists', async () => {
      mockExecSuccess(JSON.stringify({}));

      const plugin = await activatePlugin(new TestRunnerPlugin());
      const result = await plugin.getCoverage();

      expect(result.statements.percentage).toBe(0);
      expect(result.branches.percentage).toBe(0);
    });
  });

  describe('findUncoveredFiles', () => {
    it('should identify files below the coverage threshold', async () => {
      const coverageOutput = JSON.stringify({
        coverageMap: {
          '/workspace/src/well-covered.ts': {
            statementMap: { '0': {}, '1': {} },
            s: { '0': 1, '1': 1 },
          },
          '/workspace/src/poorly-covered.ts': {
            statementMap: { '0': {}, '1': {}, '2': {}, '3': {} },
            s: { '0': 1, '1': 0, '2': 0, '3': 0 },
          },
        },
      });
      mockExecSuccess(coverageOutput);

      const plugin = await activatePlugin(new TestRunnerPlugin());
      const result = await plugin.findUncoveredFiles();

      expect(result).toHaveLength(1);
      expect(result[0].file).toBe('/workspace/src/poorly-covered.ts');
      expect(result[0].lineCoverage).toBe(25);
      expect(result[0].threshold).toBe(70);
    });

    it('should respect custom coverage threshold from config', async () => {
      const coverageOutput = JSON.stringify({
        coverageMap: {
          '/workspace/src/half.ts': {
            statementMap: { '0': {}, '1': {} },
            s: { '0': 1, '1': 0 },
          },
        },
      });
      mockExecSuccess(coverageOutput);

      const plugin = new TestRunnerPlugin();
      await plugin.initialize(validContext({ config: { coverageThreshold: 60 } }));
      await plugin.activate();
      const result = await plugin.findUncoveredFiles();

      // 50% coverage is below the 60% threshold
      expect(result).toHaveLength(1);
      expect(result[0].lineCoverage).toBe(50);
      expect(result[0].threshold).toBe(60);
    });
  });

  describe('factory', () => {
    it('should create via factory function', () => {
      const plugin = createTestRunnerPlugin();
      expect(plugin).toBeInstanceOf(TestRunnerPlugin);
      expect(plugin.manifest.name).toBe('aca-plugin-test-runner');
    });
  });
});

// ============================================================================
// DocumentationPlugin Tests
// ============================================================================

describe('DocumentationPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describeLifecycle('DocumentationPlugin', () => new DocumentationPlugin());

  describe('manifest', () => {
    it('should have correct plugin manifest', () => {
      const plugin = new DocumentationPlugin();
      expect(plugin.manifest.name).toBe('aca-plugin-docs');
      expect(plugin.manifest.version).toBe('1.0.0');
      expect(plugin.manifest.description).toBeTruthy();
      expect(plugin.manifest.author).toBe('aca-team');
    });

    it('should have valid marketplace manifest', () => {
      expect(DOCS_MARKETPLACE_MANIFEST.name).toBe('aca-plugin-docs');
      expect(DOCS_MARKETPLACE_MANIFEST.license).toBe('MIT');
      expect(DOCS_MARKETPLACE_MANIFEST.keywords).toContain('documentation');
      expect(DOCS_MARKETPLACE_MANIFEST.keywords).toContain('changelog');
      expect(DOCS_MARKETPLACE_MANIFEST.acaVersion).toBe('0.1.0');
    });

    it('should match plugin and marketplace manifest names', () => {
      expect(DOCS_PLUGIN_MANIFEST.name).toBe(DOCS_MARKETPLACE_MANIFEST.name);
      expect(DOCS_PLUGIN_MANIFEST.version).toBe(DOCS_MARKETPLACE_MANIFEST.version);
    });
  });

  describe('generateApiDocs', () => {
    it('should parse typedoc JSON output', async () => {
      const typedocOutput = JSON.stringify({
        children: [
          { name: 'UserService', kindString: 'Class' },
          { name: 'AuthModule', kindString: 'Module' },
        ],
      });
      mockExecSuccess(typedocOutput);

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.generateApiDocs('src');

      expect(result.entryCount).toBe(2);
      expect(result.generatedFiles).toContain('UserService');
      expect(result.generatedFiles).toContain('AuthModule');
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle typedoc failure with error output', async () => {
      mockExecFailWithStdout('not-json');

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.generateApiDocs('src');

      expect(result.entryCount).toBe(0);
      expect(result.warnings).toContain('Failed to parse typedoc output');
    });

    it('should throw when plugin is not active', async () => {
      const plugin = new DocumentationPlugin();
      await expect(plugin.generateApiDocs('src')).rejects.toThrow('Plugin must be active');
    });

    it('should throw on execution failure without stdout', async () => {
      mockExecError('ENOENT: npx not found');
      const plugin = await activatePlugin(new DocumentationPlugin());
      await expect(plugin.generateApiDocs('src')).rejects.toThrow('API doc generation failed');
    });
  });

  describe('checkLinks', () => {
    it('should identify broken internal links', async () => {
      mockedReaddir.mockResolvedValueOnce([
        { name: 'readme.md', isDirectory: () => false },
        { name: 'guide.md', isDirectory: () => false },
      ]);
      // readFile is called once per .md file found
      mockedReadFile
        .mockResolvedValueOnce('# Readme\n[Guide](guide.md)\n[Missing](nonexistent.md)\n[External](https://example.com)')
        .mockResolvedValueOnce('# Guide\n\nSome content.');

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.checkLinks('/workspace/docs');

      expect(result.totalLinks).toBe(3);
      expect(result.brokenLinks).toHaveLength(1);
      expect(result.brokenLinks[0].link).toBe('nonexistent.md');
      expect(result.brokenLinks[0].reason).toBe('Target file not found');
      expect(result.brokenLinks[0].line).toBe(3);
    });

    it('should skip external URLs and anchors', async () => {
      mockedReaddir.mockResolvedValueOnce([
        { name: 'index.md', isDirectory: () => false },
      ]);
      mockedReadFile.mockResolvedValueOnce(
        '[HTTP](http://example.com)\n[HTTPS](https://example.com)\n[Anchor](#top)',
      );

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.checkLinks('/workspace/docs');

      expect(result.totalLinks).toBe(3);
      expect(result.brokenLinks).toHaveLength(0);
    });

    it('should handle empty directory', async () => {
      mockedReaddir.mockResolvedValueOnce([]);

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.checkLinks('/workspace/docs');

      expect(result.totalLinks).toBe(0);
      expect(result.brokenLinks).toHaveLength(0);
    });
  });

  describe('generateChangelog', () => {
    it('should parse git log output into changelog entries', async () => {
      const gitOutput = [
        'abc1234|2025-01-15T10:30:00Z|Alice|feat: add authentication',
        'def5678|2025-01-14T09:00:00Z|Bob|fix: resolve login issue',
      ].join('\n');
      mockExecSuccess(gitOutput);

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.generateChangelog('v1.0.0', 'v1.1.0');

      expect(result.fromTag).toBe('v1.0.0');
      expect(result.toTag).toBe('v1.1.0');
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({
        hash: 'abc1234',
        date: '2025-01-15T10:30:00Z',
        author: 'Alice',
        message: 'feat: add authentication',
      });
    });

    it('should handle empty git log (no commits between tags)', async () => {
      mockExecSuccess('');

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.generateChangelog('v1.0.0', 'v1.0.0');

      expect(result.entries).toHaveLength(0);
    });

    it('should handle pipe characters in commit messages', async () => {
      const gitOutput = 'abc1234|2025-01-15T10:30:00Z|Alice|fix: handle a|b edge case';
      mockExecSuccess(gitOutput);

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.generateChangelog('v1.0.0', 'v1.1.0');

      expect(result.entries[0].message).toBe('fix: handle a|b edge case');
    });

    it('should throw on git failure without stdout', async () => {
      mockExecError('fatal: not a git repository');
      const plugin = await activatePlugin(new DocumentationPlugin());
      await expect(plugin.generateChangelog('v1.0.0', 'v1.1.0')).rejects.toThrow(
        'Changelog generation failed',
      );
    });
  });

  describe('validateReadme', () => {
    it('should identify missing sections in a README', async () => {
      mockedReadFile.mockResolvedValueOnce(
        '# My Project\n\nA project description.\n\n## Installation\n\nnpm install my-project\n',
      );

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.validateReadme('/workspace/README.md');

      expect(result.valid).toBe(false);
      expect(result.missingSections).toContain('Usage');
      expect(result.missingSections).toContain('API');
      expect(result.missingSections).toContain('License');
      expect(result.missingSections).not.toContain('Installation');
    });

    it('should validate a complete README as valid', async () => {
      const completeReadme = [
        '# My Project',
        '',
        'Description here.',
        '',
        '## Installation',
        '',
        'npm install my-project',
        '',
        '## Usage',
        '',
        'Import and use.',
        '',
        '## API',
        '',
        'See the docs.',
        '',
        '## License',
        '',
        'MIT',
        '',
      ].join('\n');
      mockedReadFile.mockResolvedValueOnce(completeReadme);

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.validateReadme('/workspace/README.md');

      expect(result.valid).toBe(true);
      expect(result.missingSections).toHaveLength(0);
    });

    it('should warn about very short README', async () => {
      mockedReadFile.mockResolvedValueOnce('# Project\nShort.');

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.validateReadme('/workspace/README.md');

      expect(result.warnings).toContain('README is very short (fewer than 10 lines)');
    });

    it('should handle missing README file', async () => {
      mockedReadFile.mockRejectedValueOnce(new Error('ENOENT: no such file'));

      const plugin = await activatePlugin(new DocumentationPlugin());
      const result = await plugin.validateReadme('/workspace/README.md');

      expect(result.valid).toBe(false);
      expect(result.warnings[0]).toContain('README file not found');
      expect(result.missingSections).toHaveLength(4);
    });
  });

  describe('factory', () => {
    it('should create via factory function', () => {
      const plugin = createDocumentationPlugin();
      expect(plugin).toBeInstanceOf(DocumentationPlugin);
      expect(plugin.manifest.name).toBe('aca-plugin-docs');
    });
  });
});

// ============================================================================
// Marketplace Integration Tests
// ============================================================================

describe('Example Plugins Marketplace Conformance', () => {
  const manifests = [
    { name: 'Linting', manifest: LINTING_MARKETPLACE_MANIFEST },
    { name: 'TestRunner', manifest: TEST_RUNNER_MARKETPLACE_MANIFEST },
    { name: 'Documentation', manifest: DOCS_MARKETPLACE_MANIFEST },
  ];

  it.each(manifests)('$name should have all required marketplace fields', ({ manifest }) => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.description).toBeTruthy();
    expect(manifest.author).toBeTruthy();
    expect(manifest.license).toBeTruthy();
    expect(manifest.main).toBeTruthy();
    expect(manifest.acaVersion).toBeTruthy();
    expect(Array.isArray(manifest.keywords)).toBe(true);
    expect(manifest.keywords.length).toBeGreaterThan(0);
  });

  it.each(manifests)('$name should have valid plugin name format', ({ manifest }) => {
    expect(manifest.name).toMatch(/^[a-z][a-z0-9-]*$/);
  });

  it.each(manifests)('$name should have a non-empty dependencies object', ({ manifest }) => {
    expect(typeof manifest.dependencies).toBe('object');
  });
});
