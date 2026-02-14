/**
 * Tests for AST-Grep Client (with mocked child_process)
 */

import { ASTGrepClient, createASTGrepClient } from '@/core/tools/ast-grep/ast-grep-client';
import { AST_GREP_PRESETS } from '@/core/tools/ast-grep/presets';
import type { SGRule } from '@/core/tools/ast-grep/ast-grep-client';

// ============================================================================
// Mocks
// ============================================================================

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

import { execFile } from 'child_process';
import { writeFile, unlink } from 'fs/promises';

const mockExecFile = execFile as unknown as jest.Mock;
const mockWriteFile = writeFile as unknown as jest.Mock;
const mockUnlink = unlink as unknown as jest.Mock;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Simulate a successful execFile callback.
 */
function mockExecSuccess(stdout: string, stderr = ''): void {
  mockExecFile.mockImplementation(
    (
      _bin: string,
      _args: string[],
      _opts: unknown,
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      callback(null, stdout, stderr);
    },
  );
}

/**
 * Simulate an execFile error callback.
 */
function mockExecError(message: string, code?: number, stderr = ''): void {
  mockExecFile.mockImplementation(
    (
      _bin: string,
      _args: string[],
      _opts: unknown,
      callback: (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
    ) => {
      const error: NodeJS.ErrnoException = new Error(message);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).code = code;
      callback(error, '', stderr);
    },
  );
}

/** Sample JSON output matching sg --json format */
const sampleJsonOutput = JSON.stringify([
  {
    file: 'src/main.ts',
    range: {
      start: { line: 9, column: 0 },
      end: { line: 9, column: 25 },
    },
    text: 'console.log("hello")',
    lines: 'console.log("hello")\n',
  },
  {
    file: 'src/utils.ts',
    range: {
      start: { line: 4, column: 2 },
      end: { line: 4, column: 30 },
    },
    text: 'console.log("debug")',
    lines: '  console.log("debug")\n',
  },
]);

// ============================================================================
// Tests
// ============================================================================

describe('ASTGrepClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Constructor & Config
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('should use default config values', () => {
      const client = new ASTGrepClient();
      expect(client.getBinaryPath()).toBe('sg');
      expect(client.getTimeout()).toBe(30_000);
    });

    it('should accept custom config', () => {
      const client = new ASTGrepClient({
        binaryPath: '/usr/local/bin/sg',
        cwd: '/projects/myapp',
        timeout: 60_000,
      });

      expect(client.getBinaryPath()).toBe('/usr/local/bin/sg');
      expect(client.getCwd()).toBe('/projects/myapp');
      expect(client.getTimeout()).toBe(60_000);
    });
  });

  // --------------------------------------------------------------------------
  // search
  // --------------------------------------------------------------------------

  describe('search', () => {
    it('should return parsed matches from JSON output', async () => {
      mockExecSuccess(sampleJsonOutput);

      const client = new ASTGrepClient({ cwd: '/project' });
      const matches = await client.search('console.log($$$ARGS)');

      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({
        file: 'src/main.ts',
        line: 10,
        column: 0,
        endLine: 10,
        endColumn: 25,
        matchedText: 'console.log("hello")',
        surroundingText: 'console.log("hello")\n',
      });
      expect(matches[1]).toEqual({
        file: 'src/utils.ts',
        line: 5,
        column: 2,
        endLine: 5,
        endColumn: 30,
        matchedText: 'console.log("debug")',
        surroundingText: '  console.log("debug")\n',
      });

      // Verify execFile was called with correct args
      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['run', '-p', 'console.log($$$ARGS)', '--json'],
        expect.objectContaining({ cwd: '/project', timeout: 30_000 }),
        expect.any(Function),
      );
    });

    it('should handle empty results', async () => {
      mockExecSuccess('');

      const client = new ASTGrepClient();
      const matches = await client.search('nonexistent_pattern');

      expect(matches).toHaveLength(0);
    });

    it('should handle exit code 1 with no stderr as no-match', async () => {
      mockExecError('exit code 1', 1, '');

      const client = new ASTGrepClient();
      const matches = await client.search('no_matches_pattern');

      expect(matches).toHaveLength(0);
    });

    it('should pass language option correctly', async () => {
      mockExecSuccess('[]');

      const client = new ASTGrepClient();
      await client.search('$FUNC()', { language: 'python' });

      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['run', '-p', '$FUNC()', '--lang', 'python', '--json'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should pass paths correctly', async () => {
      mockExecSuccess('[]');

      const client = new ASTGrepClient();
      await client.search('$FUNC()', { paths: ['src/', 'lib/'] });

      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['run', '-p', '$FUNC()', 'src/', 'lib/', '--json'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should pass noIgnore option correctly', async () => {
      mockExecSuccess('[]');

      const client = new ASTGrepClient();
      await client.search('$FUNC()', { noIgnore: true });

      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['run', '-p', '$FUNC()', '--no-ignore', '--json'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should handle malformed JSON gracefully', async () => {
      mockExecSuccess('not valid json {{{');

      const client = new ASTGrepClient();
      const matches = await client.search('some_pattern');

      expect(matches).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // searchByRule
  // --------------------------------------------------------------------------

  describe('searchByRule', () => {
    const testRule: SGRule = {
      id: 'test-rule',
      language: 'typescript',
      pattern: 'console.log($$$ARGS)',
      message: 'Remove console.log',
      severity: 'warning',
    };

    it('should create temporary rule file and pass it', async () => {
      mockExecSuccess(sampleJsonOutput);

      const client = new ASTGrepClient();
      const matches = await client.searchByRule(testRule);

      expect(matches).toHaveLength(2);

      // Verify rule file was written
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [filePath, content] = mockWriteFile.mock.calls[0];
      expect(filePath).toContain('sg-rule-test-rule-');
      expect(filePath).toMatch(/\.yml$/);
      expect(content).toContain('id: test-rule');
      expect(content).toContain('language: typescript');
      expect(content).toContain('pattern: "console.log($$$ARGS)"');
      expect(content).toContain('message: "Remove console.log"');
      expect(content).toContain('severity: warning');

      // Verify execFile was called with scan --rule
      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['scan', '--rule', expect.stringContaining('sg-rule-test-rule-'), '--json'],
        expect.any(Object),
        expect.any(Function),
      );

      // Verify cleanup
      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    it('should pass paths to scan command', async () => {
      mockExecSuccess('[]');

      const client = new ASTGrepClient();
      await client.searchByRule(testRule, { paths: ['src/'] });

      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['scan', '--rule', expect.any(String), '--json', 'src/'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should include fix in rule YAML when present', async () => {
      mockExecSuccess('[]');

      const ruleWithFix: SGRule = {
        id: 'fix-rule',
        language: 'typescript',
        pattern: 'debugger',
        fix: '',
        severity: 'error',
      };

      const client = new ASTGrepClient();
      await client.searchByRule(ruleWithFix);

      const [, content] = mockWriteFile.mock.calls[0];
      expect(content).toContain('fix: ""');
    });

    it('should clean up rule file even on exec failure', async () => {
      mockExecError('sg scan failed', 2, 'some error');

      const client = new ASTGrepClient();
      await expect(client.searchByRule(testRule)).rejects.toThrow('sg command failed');

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // rewrite
  // --------------------------------------------------------------------------

  describe('rewrite', () => {
    it('should run with --rewrite flag', async () => {
      mockExecSuccess(sampleJsonOutput);

      const client = new ASTGrepClient();
      const result = await client.rewrite(
        'console.log($$$ARGS)',
        'logger.debug($$$ARGS)',
      );

      expect(result.matchCount).toBe(2);
      expect(result.filesChanged).toEqual(['src/main.ts', 'src/utils.ts']);
      expect(result.dryRun).toBe(true);

      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        [
          'run', '-p', 'console.log($$$ARGS)',
          '--rewrite', 'logger.debug($$$ARGS)',
          '--json',
        ],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should default to dry-run mode', async () => {
      mockExecSuccess('[]');

      const client = new ASTGrepClient();
      const result = await client.rewrite('$A', '$B');

      expect(result.dryRun).toBe(true);

      // Should NOT include --update-all
      const calledArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(calledArgs).not.toContain('--update-all');
    });

    it('should add --update-all when dryRun is false', async () => {
      mockExecSuccess(sampleJsonOutput);

      const client = new ASTGrepClient();
      const result = await client.rewrite(
        'console.log($$$ARGS)',
        'logger.debug($$$ARGS)',
        { dryRun: false },
      );

      expect(result.dryRun).toBe(false);

      const calledArgs = mockExecFile.mock.calls[0][1] as string[];
      expect(calledArgs).toContain('--update-all');
    });

    it('should deduplicate files in result', async () => {
      const duplicateFileOutput = JSON.stringify([
        { file: 'src/main.ts', range: { start: { line: 1, column: 0 }, end: { line: 1, column: 10 } }, text: 'a' },
        { file: 'src/main.ts', range: { start: { line: 5, column: 0 }, end: { line: 5, column: 10 } }, text: 'b' },
      ]);
      mockExecSuccess(duplicateFileOutput);

      const client = new ASTGrepClient();
      const result = await client.rewrite('pattern', 'replacement');

      expect(result.matchCount).toBe(2);
      expect(result.filesChanged).toEqual(['src/main.ts']);
    });
  });

  // --------------------------------------------------------------------------
  // listLanguages
  // --------------------------------------------------------------------------

  describe('listLanguages', () => {
    it('should parse language list output', async () => {
      mockExecSuccess('TypeScript\nJavaScript\nPython\nRust\nGo\n');

      const client = new ASTGrepClient();
      const languages = await client.listLanguages();

      expect(languages).toEqual(['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go']);

      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['list-languages'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should filter out empty lines', async () => {
      mockExecSuccess('TypeScript\n\nPython\n\n');

      const client = new ASTGrepClient();
      const languages = await client.listLanguages();

      expect(languages).toEqual(['TypeScript', 'Python']);
    });
  });

  // --------------------------------------------------------------------------
  // isAvailable
  // --------------------------------------------------------------------------

  describe('isAvailable', () => {
    it('should return true when sg exists', async () => {
      mockExecSuccess('ast-grep 0.25.0');

      const client = new ASTGrepClient();
      const available = await client.isAvailable();

      expect(available).toBe(true);

      expect(mockExecFile).toHaveBeenCalledWith(
        'sg',
        ['--version'],
        expect.any(Object),
        expect.any(Function),
      );
    });

    it('should return false when sg is not found', async () => {
      mockExecError('ENOENT: sg not found', undefined, '');
      // Override to ensure it's treated as a real error (not exit code 1 no-match)
      mockExecFile.mockImplementation(
        (
          _bin: string,
          _args: string[],
          _opts: unknown,
          callback: (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
        ) => {
          const error: NodeJS.ErrnoException = new Error('spawn sg ENOENT');
          error.code = 'ENOENT';
          callback(error, '', '');
        },
      );

      const client = new ASTGrepClient();
      const available = await client.isAvailable();

      expect(available).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Error Handling
  // --------------------------------------------------------------------------

  describe('error handling', () => {
    it('should handle timeout errors', async () => {
      mockExecFile.mockImplementation(
        (
          _bin: string,
          _args: string[],
          _opts: unknown,
          callback: (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
        ) => {
          const error: NodeJS.ErrnoException = new Error('Command timed out');
          error.code = 'ETIMEDOUT';
          callback(error, '', '');
        },
      );

      const client = new ASTGrepClient({ timeout: 100 });
      await expect(client.search('$FUNC()')).rejects.toThrow('sg command failed');
    });

    it('should handle non-zero exit codes with stderr', async () => {
      mockExecError('exit code 2', 2, 'Error: invalid pattern syntax');

      const client = new ASTGrepClient();
      await expect(client.search('invalid[[[')).rejects.toThrow(
        'sg command failed: Error: invalid pattern syntax',
      );
    });

    it('should handle non-zero exit codes without stderr', async () => {
      mockExecFile.mockImplementation(
        (
          _bin: string,
          _args: string[],
          _opts: unknown,
          callback: (error: NodeJS.ErrnoException | null, stdout: string, stderr: string) => void,
        ) => {
          const error: NodeJS.ErrnoException = new Error('sg crashed');
          error.code = 'ERR';
          callback(error, '', '');
        },
      );

      const client = new ASTGrepClient();
      await expect(client.search('crash_pattern')).rejects.toThrow(
        'sg command failed: sg crashed',
      );
    });
  });

  // --------------------------------------------------------------------------
  // Factory Function
  // --------------------------------------------------------------------------

  describe('createASTGrepClient', () => {
    it('should create an ASTGrepClient instance', () => {
      const client = createASTGrepClient();
      expect(client).toBeInstanceOf(ASTGrepClient);
      expect(client.getBinaryPath()).toBe('sg');
    });

    it('should accept config', () => {
      const client = createASTGrepClient({
        binaryPath: '/opt/sg',
        timeout: 5000,
      });
      expect(client).toBeInstanceOf(ASTGrepClient);
      expect(client.getBinaryPath()).toBe('/opt/sg');
      expect(client.getTimeout()).toBe(5000);
    });
  });

  // --------------------------------------------------------------------------
  // Presets
  // --------------------------------------------------------------------------

  describe('AST_GREP_PRESETS', () => {
    it('should contain all expected preset keys', () => {
      expect(Object.keys(AST_GREP_PRESETS)).toEqual(
        expect.arrayContaining([
          'unusedImport',
          'consoleLogRemoval',
          'todoComments',
          'emptyFunction',
          'debuggerStatement',
        ]),
      );
    });

    it('should have valid SGRule objects with required fields', () => {
      for (const [name, rule] of Object.entries(AST_GREP_PRESETS)) {
        expect(rule.id).toBeDefined();
        expect(typeof rule.id).toBe('string');
        expect(rule.language).toBeDefined();
        expect(typeof rule.language).toBe('string');
        expect(rule.pattern).toBeDefined();
        expect(typeof rule.pattern).toBe('string');

        if (rule.severity) {
          expect(['error', 'warning', 'info', 'hint']).toContain(rule.severity);
        }

        // Verify each preset has a non-empty id matching the key convention
        expect(rule.id.length).toBeGreaterThan(0);
        expect(rule.pattern.length).toBeGreaterThan(0);

        // Avoid unused variable warning in strict mode
        expect(name).toBeTruthy();
      }
    });

    it('should have unique rule ids', () => {
      const ids = Object.values(AST_GREP_PRESETS).map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
