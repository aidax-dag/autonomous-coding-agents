/**
 * Autonomous CLI Unit Tests
 *
 * Tests CLI command structure, argument parsing, and config command.
 */

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

import { createAutonomousCLI } from '@/cli/autonomous';
import { Command } from 'commander';

import { loadRunnerConfig } from '@/core/orchestrator/runner-config';

const mockLoadRunnerConfig = loadRunnerConfig as jest.MockedFunction<typeof loadRunnerConfig>;

describe('createAutonomousCLI', () => {
  let cli: Command;

  beforeEach(() => {
    cli = createAutonomousCLI();
    jest.clearAllMocks();
  });

  describe('command structure', () => {
    it('should return a Command instance', () => {
      expect(cli).toBeInstanceOf(Command);
    });

    it('should have name "runner"', () => {
      expect(cli.name()).toBe('runner');
    });

    it('should have 3 subcommands: run, submit, config', () => {
      const commands = cli.commands.map((c) => c.name());
      expect(commands).toContain('run');
      expect(commands).toContain('submit');
      expect(commands).toContain('config');
      expect(commands).toHaveLength(3);
    });
  });

  describe('run command', () => {
    it('should accept a goal argument', () => {
      const run = cli.commands.find((c) => c.name() === 'run')!;
      const args = run.registeredArguments;
      expect(args.length).toBe(1);
      expect(args[0].name()).toBe('goal');
      expect(args[0].required).toBe(true);
    });

    it('should have priority, project, tags, workspace, validation, learning options', () => {
      const run = cli.commands.find((c) => c.name() === 'run')!;
      const optionNames = run.options.map((o) => o.long);
      expect(optionNames).toContain('--priority');
      expect(optionNames).toContain('--project');
      expect(optionNames).toContain('--tags');
      expect(optionNames).toContain('--workspace');
      expect(optionNames).toContain('--validation');
      expect(optionNames).toContain('--learning');
    });

    it('should default priority to medium', () => {
      const run = cli.commands.find((c) => c.name() === 'run')!;
      const priorityOpt = run.options.find((o) => o.long === '--priority');
      expect(priorityOpt?.defaultValue).toBe('medium');
    });
  });

  describe('submit command', () => {
    it('should accept team and description arguments', () => {
      const submit = cli.commands.find((c) => c.name() === 'submit')!;
      const args = submit.registeredArguments;
      expect(args.length).toBe(2);
      expect(args[0].name()).toBe('team');
      expect(args[1].name()).toBe('description');
    });

    it('should have priority, project, workspace options', () => {
      const submit = cli.commands.find((c) => c.name() === 'submit')!;
      const optionNames = submit.options.map((o) => o.long);
      expect(optionNames).toContain('--priority');
      expect(optionNames).toContain('--project');
      expect(optionNames).toContain('--workspace');
    });
  });

  describe('config command', () => {
    let consoleSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      process.exitCode = undefined;
    });

    it('should print config as JSON on success', async () => {
      const fakeConfig = {
        workspaceDir: '/tmp/test',
        maxTurnsPerFeature: 50,
        enableValidation: false,
      };
      mockLoadRunnerConfig.mockReturnValue(fakeConfig as any);

      // Parse with exitOverride to prevent process.exit
      cli.exitOverride();
      try {
        await cli.parseAsync(['config'], { from: 'user' });
      } catch {
        // Commander may throw on exit
      }

      expect(mockLoadRunnerConfig).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(fakeConfig, null, 2))
      );
    });

    it('should print error and set exitCode 1 on config load failure', async () => {
      mockLoadRunnerConfig.mockImplementation(() => {
        throw new Error('GITHUB_TOKEN is required');
      });

      cli.exitOverride();
      try {
        await cli.parseAsync(['config'], { from: 'user' });
      } catch {
        // Commander may throw on exit
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('GITHUB_TOKEN is required')
      );
      expect(process.exitCode).toBe(1);
    });
  });
});
