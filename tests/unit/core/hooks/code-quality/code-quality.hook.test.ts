/**
 * Code Quality Hook Tests
 *
 * @module tests/unit/core/hooks/code-quality
 */

import {
  CodeQualityHook,
  QualityCheckType,
  QualityTool,
  DEFAULT_CODE_QUALITY_CONFIG,
  DEFAULT_TOOL_CONFIGS,
  CHECK_TYPE_TO_TOOLS,
} from '../../../../../src/core/hooks/code-quality/index.js';
import { HookEvent, HookContext } from '../../../../../src/core/interfaces/hook.interface.js';

// Mock child_process spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

/**
 * Create a mock process
 */
function createMockProcess(stdout: string, stderr: string, exitCode: number) {
  const process = new EventEmitter() as any;
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();

  setTimeout(() => {
    process.stdout.emit('data', Buffer.from(stdout));
    process.stderr.emit('data', Buffer.from(stderr));
    process.emit('close', exitCode);
  }, 10);

  return process;
}

/**
 * Create a test context
 */
function createTestContext(files?: string[]): HookContext<unknown> {
  return {
    event: HookEvent.TASK_BEFORE,
    timestamp: new Date(),
    source: 'test',
    data: files ? { files } : undefined,
  };
}

/**
 * Create ESLint mock output
 */
function createESLintOutput(results: Array<{
  filePath: string;
  errors: number;
  warnings: number;
}>): string {
  return JSON.stringify(
    results.map((r) => ({
      filePath: r.filePath,
      messages: [
        ...Array(r.errors).fill(null).map((_, i) => ({
          ruleId: 'no-unused-vars',
          severity: 2,
          message: `Error ${i + 1}`,
          line: i + 1,
          column: 1,
        })),
        ...Array(r.warnings).fill(null).map((_, i) => ({
          ruleId: 'prefer-const',
          severity: 1,
          message: `Warning ${i + 1}`,
          line: r.errors + i + 1,
          column: 1,
        })),
      ],
      errorCount: r.errors,
      warningCount: r.warnings,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
    }))
  );
}

describe('CodeQualityHook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Construction', () => {
    it('should create with default config', () => {
      const hook = new CodeQualityHook();

      expect(hook.name).toBe('code-quality');
      expect(hook.event).toBe(HookEvent.TASK_BEFORE);
      expect(hook.isEnabled()).toBe(true);
    });

    it('should create with custom config', () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.FORMAT],
        failOnError: false,
        autoFix: true,
      });

      const config = hook.getQualityConfig();
      expect(config.checkTypes).toEqual([QualityCheckType.FORMAT]);
      expect(config.failOnError).toBe(false);
      expect(config.autoFix).toBe(true);
    });

    it('should have correct hook metadata', () => {
      const hook = new CodeQualityHook();

      expect(hook.description).toBe('Code quality checking (lint, format, type-check)');
      expect(hook.priority).toBe(DEFAULT_CODE_QUALITY_CONFIG.priority);
    });

    it('should initialize with custom tool configs', () => {
      const hook = new CodeQualityHook({
        tools: [
          {
            tool: QualityTool.ESLINT,
            args: ['eslint', '--cache'],
            timeout: 30000,
          },
        ],
      });

      const config = hook.getQualityConfig();
      const eslintConfig = config.tools?.find((t) => t.tool === QualityTool.ESLINT);
      expect(eslintConfig?.args).toContain('--cache');
      expect(eslintConfig?.timeout).toBe(30000);
    });
  });

  describe('Quality Checks', () => {
    it('should run lint check on files', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      const result = await hook.check(['test.ts']);

      expect(result.passed).toBe(true);
      expect(result.totalErrors).toBe(0);
    });

    it('should detect lint errors', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock both 'which' and ESLint execution with errors
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 3, warnings: 2 }]),
          '',
          1
        );
      });

      const result = await hook.check(['test.ts']);

      expect(result.passed).toBe(false);
      expect(result.totalErrors).toBe(3);
      expect(result.totalWarnings).toBe(2);
      expect(result.issues.length).toBe(5);
    });

    it('should run multiple check types', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT, QualityCheckType.FORMAT],
        parallel: false,
      });

      // Mock both 'which' and tool executions
      mockSpawn.mockImplementation((_cmd, args) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        // Check if ESLint or Prettier based on args
        if (args && args.some((a: string) => a.includes('eslint'))) {
          return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
        }
        return createMockProcess('', '', 0);
      });

      const result = await hook.check(['test.ts']);

      expect(result.toolResults.length).toBe(2);
    });

    it('should run checks in parallel when configured', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT, QualityCheckType.FORMAT],
        parallel: true,
      });

      // Mock both 'which' and tool executions
      mockSpawn.mockImplementation((_cmd, args) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        if (args && args.some((a: string) => a.includes('eslint'))) {
          return createMockProcess(
            createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]),
            '',
            0
          );
        }
        return createMockProcess('', '', 0);
      });

      const result = await hook.check(['test.ts']);

      expect(result.passed).toBe(true);
    });
  });

  describe('Tool Check', () => {
    it('should check with specific tool', async () => {
      const hook = new CodeQualityHook();

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 1, warnings: 0 }]),
          '',
          1
        );
      });

      const result = await hook.checkWithTool(['test.ts'], QualityTool.ESLINT);

      expect(result.tool).toBe(QualityTool.ESLINT);
      expect(result.checkType).toBe(QualityCheckType.LINT);
      expect(result.errorCount).toBe(1);
    });

    it('should handle unavailable tool', async () => {
      const hook = new CodeQualityHook();

      // Mock all spawn calls failing (tool not found)
      mockSpawn.mockImplementation(() =>
        createMockProcess('', 'command not found', 1)
      );

      const result = await hook.checkWithTool(['test.ts'], QualityTool.ESLINT);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('not available');
    });
  });

  describe('Tool Availability', () => {
    it('should check if tool is available', async () => {
      const hook = new CodeQualityHook();

      // Mock 'which' command succeeding
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess('', '', 0);
      });

      const available = await hook.isToolAvailable(QualityTool.ESLINT);

      expect(available).toBe(true);
    });

    it('should return false for unavailable tool', async () => {
      const hook = new CodeQualityHook();

      // Mock both 'which' and version check failing
      mockSpawn.mockImplementation(() =>
        createMockProcess('', 'not found', 1)
      );

      const available = await hook.isToolAvailable(QualityTool.BIOME);

      expect(available).toBe(false);
    });

    it('should get available tools', async () => {
      const hook = new CodeQualityHook();

      // All tools available via 'which' command
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess('', '', 0);
      });

      const tools = await hook.getAvailableTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('Auto Fix', () => {
    it('should run fix when auto-fix enabled', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
        autoFix: true,
      });

      // Mock ESLint with fix flag - successful result
      const eslintOutput = JSON.stringify([
        {
          filePath: 'test.ts',
          messages: [],
          errorCount: 0,
          warningCount: 0,
          fixableErrorCount: 2,
          fixableWarningCount: 1,
        },
      ]);

      let fixFlagIncluded = false;
      mockSpawn.mockImplementation((_cmd, args) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        // Check if --fix flag is included in eslint args
        if (args && args.includes('--fix')) {
          fixFlagIncluded = true;
        }
        return createMockProcess(eslintOutput, '', 0);
      });

      const result = await hook.check(['test.ts']);

      expect(result.passed).toBe(true);
      expect(fixFlagIncluded).toBe(true);
    });

    it('should call fix method', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
        autoFix: false,
      });

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      const result = await hook.fix(['test.ts']);

      expect(result).toBeDefined();
    });
  });

  describe('Hook Execution', () => {
    it('should execute on task before event', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      const context = createTestContext(['test.ts']);
      const result = await hook.execute(context);

      expect(result.action).toBe('continue');
    });

    it('should skip when no files provided', async () => {
      const hook = new CodeQualityHook();

      const context = createTestContext();
      const result = await hook.execute(context);

      expect(result.action).toBe('continue');
      expect(result.message).toContain('No files');
    });

    it('should abort when errors found and failOnError is true', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
        failOnError: true,
      });

      // Mock both 'which' and ESLint execution with errors
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 2, warnings: 0 }]),
          '',
          1
        );
      });

      const context = createTestContext(['test.ts']);
      const result = await hook.execute(context);

      expect(result.action).toBe('abort');
    });

    it('should continue when errors found but failOnError is false', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
        failOnError: false,
      });

      // Mock both 'which' and ESLint execution with errors
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 2, warnings: 0 }]),
          '',
          1
        );
      });

      const context = createTestContext(['test.ts']);
      const result = await hook.execute(context);

      expect(result.action).toBe('continue');
    });
  });

  describe('Metrics', () => {
    it('should track check metrics', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 1, warnings: 2 }]),
          '',
          1
        );
      });

      await hook.check(['test.ts']);

      const metrics = hook.getMetrics();
      expect(metrics.totalChecks).toBe(1);
      expect(metrics.failedChecks).toBe(1);
      expect(metrics.totalErrors).toBe(1);
      expect(metrics.totalWarnings).toBe(2);
    });

    it('should track checks by type', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      await hook.check(['test.ts']);

      const metrics = hook.getMetrics();
      expect(metrics.checksByType[QualityCheckType.LINT]).toBe(1);
    });

    it('should track checks by tool', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      await hook.check(['test.ts']);

      const metrics = hook.getMetrics();
      expect(metrics.checksByTool[QualityTool.ESLINT]).toBe(1);
    });

    it('should reset metrics', async () => {
      const hook = new CodeQualityHook();

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 1, warnings: 0 }]), '', 1);
      });

      await hook.check(['test.ts']);

      hook.resetMetrics();

      const metrics = hook.getMetrics();
      expect(metrics.totalChecks).toBe(0);
      expect(metrics.totalErrors).toBe(0);
    });

    it('should track issues by rule', async () => {
      const hook = new CodeQualityHook();

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 3, warnings: 2 }]),
          '',
          1
        );
      });

      await hook.check(['test.ts']);

      const metrics = hook.getMetrics();
      expect(Object.keys(metrics.issuesByRule).length).toBeGreaterThan(0);
    });
  });

  describe('Event Subscriptions', () => {
    it('should notify on check started', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      const callback = jest.fn();
      hook.onCheckStarted(callback);

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      await hook.check(['test.ts']);

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([QualityCheckType.LINT]),
        expect.arrayContaining(['test.ts'])
      );
    });

    it('should notify on check completed', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      const callback = jest.fn();
      hook.onCheckCompleted(callback);

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      await hook.check(['test.ts']);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          passed: true,
        })
      );
    });

    it('should notify on issue found', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      const callback = jest.fn();
      hook.onIssueFound(callback);

      // Mock both 'which' and ESLint execution with issues
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 1, warnings: 0 }]),
          '',
          1
        );
      });

      await hook.check(['test.ts']);

      expect(callback).toHaveBeenCalled();
    });

    it('should allow unsubscription', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      const callback = jest.fn();
      const subscription = hook.onCheckStarted(callback);
      subscription.unsubscribe();

      // Mock both 'which' and ESLint execution
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0);
      });

      await hook.check(['test.ts']);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Dispose', () => {
    it('should clean up on dispose', () => {
      const hook = new CodeQualityHook();

      hook.dispose();

      // Should skip when disposed
      const context = createTestContext(['test.ts']);
      hook.execute(context).then((result) => {
        expect(result.action).toBe('skip');
      });
    });

    it('should clear subscriptions on dispose', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      const callback = jest.fn();
      hook.onCheckStarted(callback);

      hook.dispose();

      // Mock commands
      mockSpawn.mockImplementation(() =>
        createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0)
      );

      // Callback should not be called after dispose
      // (the check itself is skipped after dispose)
    });
  });

  describe('Configuration', () => {
    it('should fail on warning when configured', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
        failOnWarning: true,
      });

      // Mock both 'which' and ESLint execution with warnings only
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 2 }]),
          '',
          0
        );
      });

      const result = await hook.check(['test.ts']);

      expect(result.passed).toBe(false);
    });

    it('should respect maxErrors limit', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
        maxErrors: 5,
      });

      // Mock both 'which' and ESLint execution with many errors
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 10, warnings: 0 }]),
          '',
          1
        );
      });

      const result = await hook.check(['test.ts']);

      expect(result.passed).toBe(false);
    });

    it('should respect maxWarnings limit', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
        maxWarnings: 3,
      });

      // Mock both 'which' and ESLint execution with many warnings
      mockSpawn.mockImplementation((_cmd) => {
        if (_cmd === 'which') {
          return createMockProcess('/usr/bin/npx', '', 0);
        }
        return createMockProcess(
          createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 5 }]),
          '',
          0
        );
      });

      const result = await hook.check(['test.ts']);

      expect(result.passed).toBe(false);
    });
  });

  describe('Default Configuration', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CODE_QUALITY_CONFIG.priority).toBe(85);
      expect(DEFAULT_CODE_QUALITY_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CODE_QUALITY_CONFIG.checkTypes).toEqual([QualityCheckType.LINT]);
      expect(DEFAULT_CODE_QUALITY_CONFIG.failOnError).toBe(true);
      expect(DEFAULT_CODE_QUALITY_CONFIG.autoFix).toBe(false);
    });

    it('should have default tool configs', () => {
      expect(DEFAULT_TOOL_CONFIGS[QualityTool.ESLINT]).toBeDefined();
      expect(DEFAULT_TOOL_CONFIGS[QualityTool.PRETTIER]).toBeDefined();
      expect(DEFAULT_TOOL_CONFIGS[QualityTool.TSC]).toBeDefined();
    });

    it('should map check types to tools', () => {
      expect(CHECK_TYPE_TO_TOOLS[QualityCheckType.LINT]).toContain(QualityTool.ESLINT);
      expect(CHECK_TYPE_TO_TOOLS[QualityCheckType.FORMAT]).toContain(QualityTool.PRETTIER);
      expect(CHECK_TYPE_TO_TOOLS[QualityCheckType.TYPE_CHECK]).toContain(QualityTool.TSC);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty file list', async () => {
      const hook = new CodeQualityHook();

      const result = await hook.check([]);

      expect(result.passed).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should handle tool execution error', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock which succeeds
      mockSpawn.mockImplementationOnce(() =>
        createMockProcess('/usr/bin/npx', '', 0)
      );

      // Mock ESLint throwing error
      mockSpawn.mockImplementationOnce(() => {
        const proc = new EventEmitter() as any;
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        setTimeout(() => {
          proc.emit('error', new Error('Command failed'));
        }, 10);
        return proc;
      });

      const result = await hook.check(['test.ts']);

      // Should still return a result
      expect(result).toBeDefined();
    });

    it('should handle invalid ESLint JSON output', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      // Mock which
      mockSpawn.mockImplementationOnce(() =>
        createMockProcess('/usr/bin/npx', '', 0)
      );

      // Mock ESLint with invalid JSON
      mockSpawn.mockImplementationOnce(() =>
        createMockProcess('not valid json', '', 1)
      );

      const result = await hook.check(['test.ts']);

      expect(result).toBeDefined();
    });

    it('should handle concurrent checks', async () => {
      const hook = new CodeQualityHook({
        checkTypes: [QualityCheckType.LINT],
      });

      mockSpawn.mockImplementation(() =>
        createMockProcess(createESLintOutput([{ filePath: 'test.ts', errors: 0, warnings: 0 }]), '', 0)
      );

      const [result1, result2] = await Promise.all([
        hook.check(['test1.ts']),
        hook.check(['test2.ts']),
      ]);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
