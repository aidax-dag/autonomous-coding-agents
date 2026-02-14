/**
 * CLI Headless Integration — Unit Tests
 *
 * Tests the headless subcommand registration in the autonomous CLI,
 * the createHeadlessConfigFromCLI helper, and the action handler's
 * integration with HeadlessRunner and OutputFormatter.
 *
 * Feature: G-8 - CLI Complete Integration
 */

import * as fs from 'fs';

// Mock chalk (ESM-only module) before any imports
const passthrough = (s: string) => s;
const chalkMock: any = Object.assign(passthrough, {
  cyan: passthrough,
  green: passthrough,
  red: passthrough,
  yellow: passthrough,
  bold: passthrough,
  dim: passthrough,
});
jest.mock('chalk', () => ({ default: chalkMock, __esModule: true }));

// Mock the orchestrator modules to avoid real initialization
jest.mock('@/core/orchestrator/runner-config', () => ({
  createRunnerFromEnv: jest.fn(),
  loadRunnerConfig: jest.fn(),
}));

// Mock the headless modules
const mockExecute = jest.fn();
const mockDispose = jest.fn();
jest.mock('@/cli/headless/headless-runner', () => ({
  createHeadlessRunner: jest.fn(() => ({
    execute: mockExecute,
    dispose: mockDispose,
  })),
  HeadlessRunner: jest.fn(),
}));

const mockFormatResult = jest.fn().mockReturnValue('{"formatted":true}');
jest.mock('@/cli/headless/output-formatter', () => ({
  createOutputFormatter: jest.fn(() => ({
    formatResult: mockFormatResult,
  })),
  OutputFormatter: jest.fn(),
}));

jest.mock('@/cli/headless/ci-detector', () => {
  const mockIsCI = jest.fn().mockReturnValue(false);
  const mockDetect = jest.fn().mockReturnValue({ provider: 'unknown' });
  return {
    CIDetector: jest.fn(() => ({
      isCI: mockIsCI,
      detect: mockDetect,
    })),
    createCIDetector: jest.fn(),
    __mockIsCI: mockIsCI,
    __mockDetect: mockDetect,
  };
});

// Mock the logger
jest.mock('@/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  createAgentLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// Mock the API server
jest.mock('@/api/server', () => ({
  startAPIServer: jest.fn(),
}));

// Mock fs.writeFileSync
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
}));

import { createAutonomousCLI, createHeadlessConfigFromCLI } from '@/cli/autonomous';
import { createHeadlessRunner } from '@/cli/headless/headless-runner';
import { createOutputFormatter } from '@/cli/headless/output-formatter';
import { EXIT_CODES } from '@/cli/headless/types';
import type { HeadlessResult } from '@/cli/headless/types';
import { Command } from 'commander';

// Access internal mocks
const ciDetectorModule = jest.requireMock('@/cli/headless/ci-detector') as any;

// ---- Helpers ----

function makeSuccessResult(): HeadlessResult {
  return {
    success: true,
    exitCode: 0,
    goal: 'Run tests',
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:01.000Z',
    duration: 1000,
    output: {
      tasks: [
        {
          id: 'goal-1',
          team: 'orchestrator',
          status: 'completed',
          description: 'Run tests',
          duration: 1000,
        },
      ],
      summary: 'Goal completed: 1/1 tasks succeeded',
      metrics: {
        totalTasks: 1,
        completedTasks: 1,
        failedTasks: 0,
        skippedTasks: 0,
        totalDuration: 1000,
      },
    },
    errors: [],
  };
}

function makeFailedResult(errorCode = 'GOAL_FAILED'): HeadlessResult {
  return {
    ...makeSuccessResult(),
    success: false,
    exitCode: 1,
    errors: [
      {
        code: errorCode,
        message: 'Goal execution failed',
        fatal: true,
        timestamp: '2026-01-01T00:00:01.000Z',
      },
    ],
  };
}

// =========================================================================
// createHeadlessConfigFromCLI
// =========================================================================

describe('createHeadlessConfigFromCLI', () => {
  it('should create correct config from default options', () => {
    const config = createHeadlessConfigFromCLI('deploy app', {});

    expect(config.goal).toBe('deploy app');
    expect(config.projectPath).toBe(process.cwd());
    expect(config.outputFormat).toBe('json');
    expect(config.timeout).toBe(300000);
    expect(config.exitOnError).toBe(true);
    expect(config.enabledFeatures).toEqual([]);
    expect(config.environment).toEqual({});
  });

  it('should use default timeout of 300000', () => {
    const config = createHeadlessConfigFromCLI('test', {});
    expect(config.timeout).toBe(300000);
  });

  it('should parse custom timeout from string', () => {
    const config = createHeadlessConfigFromCLI('test', { timeout: '60000' });
    expect(config.timeout).toBe(60000);
  });

  it('should map format option to outputFormat', () => {
    const jsonConfig = createHeadlessConfigFromCLI('test', { format: 'json' });
    expect(jsonConfig.outputFormat).toBe('json');

    const jsonlConfig = createHeadlessConfigFromCLI('test', { format: 'jsonl' });
    expect(jsonlConfig.outputFormat).toBe('jsonl');

    const minimalConfig = createHeadlessConfigFromCLI('test', { format: 'minimal' });
    expect(minimalConfig.outputFormat).toBe('minimal');
  });

  it('should default exitOnError to true', () => {
    const config = createHeadlessConfigFromCLI('test', {});
    expect(config.exitOnError).toBe(true);
  });

  it('should set exitOnError to false when explicitly disabled', () => {
    const config = createHeadlessConfigFromCLI('test', { exitOnError: false });
    expect(config.exitOnError).toBe(false);
  });

  it('should set goal from the first argument', () => {
    const config = createHeadlessConfigFromCLI('run all unit tests', {});
    expect(config.goal).toBe('run all unit tests');
  });
});

// =========================================================================
// CLI headless subcommand registration
// =========================================================================

describe('headless subcommand', () => {
  let cli: Command;

  beforeEach(() => {
    cli = createAutonomousCLI();
    jest.clearAllMocks();
    mockExecute.mockResolvedValue(makeSuccessResult());
    mockFormatResult.mockReturnValue('{"formatted":true}');
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it('should be registered as a subcommand', () => {
    const commands = cli.commands.map((c) => c.name());
    expect(commands).toContain('headless');
  });

  it('should not affect existing subcommand count (adds one more)', () => {
    const commands = cli.commands.map((c) => c.name());
    expect(commands).toContain('run');
    expect(commands).toContain('submit');
    expect(commands).toContain('config');
    expect(commands).toContain('serve');
    expect(commands).toContain('headless');
    expect(commands).toHaveLength(5);
  });

  it('should accept a goal argument', () => {
    const headless = cli.commands.find((c) => c.name() === 'headless')!;
    const args = headless.registeredArguments;
    expect(args.length).toBe(1);
    expect(args[0].name()).toBe('goal');
    expect(args[0].required).toBe(true);
  });

  it('should have timeout, exit-on-error, format, output, ci options', () => {
    const headless = cli.commands.find((c) => c.name() === 'headless')!;
    const optionNames = headless.options.map((o) => o.long);
    expect(optionNames).toContain('--timeout');
    expect(optionNames).toContain('--exit-on-error');
    expect(optionNames).toContain('--format');
    expect(optionNames).toContain('--output');
    expect(optionNames).toContain('--ci');
  });

  it('should default timeout to 300000', () => {
    const headless = cli.commands.find((c) => c.name() === 'headless')!;
    const timeoutOpt = headless.options.find((o) => o.long === '--timeout');
    expect(timeoutOpt?.defaultValue).toBe('300000');
  });

  it('should default format to json', () => {
    const headless = cli.commands.find((c) => c.name() === 'headless')!;
    const formatOpt = headless.options.find((o) => o.long === '--format');
    expect(formatOpt?.defaultValue).toBe('json');
  });
});

// =========================================================================
// Headless action handler integration
// =========================================================================

describe('headless action handler', () => {
  let cli: Command;
  let consoleSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    cli = createAutonomousCLI();
    cli.exitOverride();
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockExecute.mockResolvedValue(makeSuccessResult());
    mockFormatResult.mockReturnValue('{"formatted":true}');
    process.exitCode = undefined;
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.exitCode = undefined;
  });

  it('should set exit code 0 on success', async () => {
    try {
      await cli.parseAsync(['headless', 'run tests'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(process.exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it('should set exit code 1 on goal failure', async () => {
    mockExecute.mockResolvedValue(makeFailedResult('GOAL_FAILED'));

    try {
      await cli.parseAsync(['headless', 'run tests'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(process.exitCode).toBe(EXIT_CODES.GOAL_FAILED);
  });

  it('should set exit code 2 on timeout', async () => {
    mockExecute.mockResolvedValue(makeFailedResult('TIMEOUT'));

    try {
      await cli.parseAsync(['headless', 'run tests'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(process.exitCode).toBe(EXIT_CODES.TIMEOUT);
  });

  it('should set exit code 4 on runtime error', async () => {
    mockExecute.mockResolvedValue(makeFailedResult('RUNTIME_ERROR'));

    try {
      await cli.parseAsync(['headless', 'run tests'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(process.exitCode).toBe(EXIT_CODES.RUNTIME_ERROR);
  });

  it('should set exit code 4 when action handler throws', async () => {
    mockExecute.mockRejectedValue(new Error('Unexpected crash'));

    try {
      await cli.parseAsync(['headless', 'run tests'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(process.exitCode).toBe(EXIT_CODES.RUNTIME_ERROR);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unexpected crash'),
    );
  });

  it('should call createHeadlessRunner with config', async () => {
    try {
      await cli.parseAsync(['headless', 'deploy app'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(createHeadlessRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'deploy app',
        outputFormat: 'json',
        timeout: 300000,
      }),
    );
  });

  it('should call createOutputFormatter with configured format', async () => {
    try {
      await cli.parseAsync(['headless', 'test', '--format', 'minimal'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(createOutputFormatter).toHaveBeenCalledWith('minimal');
  });

  it('should print formatted output to stdout when no --output', async () => {
    mockFormatResult.mockReturnValue('{"result":"ok"}');

    try {
      await cli.parseAsync(['headless', 'run tests'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(consoleSpy).toHaveBeenCalledWith('{"result":"ok"}');
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it('should write formatted output to file when --output specified', async () => {
    mockFormatResult.mockReturnValue('{"result":"ok"}');

    try {
      await cli.parseAsync(['headless', 'run tests', '--output', '/tmp/result.json'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/tmp/result.json',
      '{"result":"ok"}',
      'utf-8',
    );
  });

  it('should dispose the runner after execution', async () => {
    try {
      await cli.parseAsync(['headless', 'run tests'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(mockDispose).toHaveBeenCalled();
  });

  it('should pass custom timeout to config', async () => {
    try {
      await cli.parseAsync(['headless', 'test', '--timeout', '60000'], { from: 'user' });
    } catch {
      // Commander may throw on exit
    }

    expect(createHeadlessRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: 60000,
      }),
    );
  });
});
