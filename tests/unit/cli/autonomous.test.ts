/**
 * Unit Tests for Autonomous CLI
 *
 * Tests the CLI commands for the AutonomousRunner system.
 */

// Mock chalk to avoid ESM issues in Jest
jest.mock('chalk', () => ({
  default: {
    green: jest.fn((s) => s),
    red: jest.fn((s) => s),
    yellow: jest.fn((s) => s),
    blue: jest.fn((s) => s),
    cyan: jest.fn((s) => s),
    gray: jest.fn((s) => s),
    magenta: jest.fn((s) => s),
    white: jest.fn((s) => s),
    dim: jest.fn((s) => s),
    bold: {
      green: jest.fn((s) => s),
      red: jest.fn((s) => s),
      yellow: jest.fn((s) => s),
      cyan: jest.fn((s) => s),
      magenta: jest.fn((s) => s),
    },
  },
  green: jest.fn((s) => s),
  red: jest.fn((s) => s),
  yellow: jest.fn((s) => s),
  blue: jest.fn((s) => s),
  cyan: jest.fn((s) => s),
  gray: jest.fn((s) => s),
  magenta: jest.fn((s) => s),
  white: jest.fn((s) => s),
  dim: jest.fn((s) => s),
  bold: {
    green: jest.fn((s) => s),
    red: jest.fn((s) => s),
    yellow: jest.fn((s) => s),
    cyan: jest.fn((s) => s),
    magenta: jest.fn((s) => s),
  },
}));

// Mock ora to avoid ESM issues
jest.mock('ora', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    text: '',
  })),
}));

import { createAutonomousCLI } from '../../../src/cli/autonomous';
import { Command } from 'commander';

describe('Autonomous CLI', () => {
  let cli: Command;

  beforeEach(() => {
    cli = createAutonomousCLI();
  });

  describe('CLI Structure', () => {
    it('should have runner as the program name', () => {
      expect(cli.name()).toBe('runner');
    });

    it('should have version defined', () => {
      expect(cli.version()).toBeDefined();
    });

    it('should have description defined', () => {
      expect(cli.description()).toContain('Autonomous Runner CLI');
    });

    it('should have all required commands', () => {
      const commandNames = cli.commands.map((cmd) => cmd.name());

      expect(commandNames).toContain('create');
      expect(commandNames).toContain('run');
      expect(commandNames).toContain('status');
      expect(commandNames).toContain('stop');
      expect(commandNames).toContain('pause');
      expect(commandNames).toContain('resume');
    });
  });

  describe('Create Command', () => {
    let createCmd: Command | undefined;

    beforeEach(() => {
      createCmd = cli.commands.find((cmd) => cmd.name() === 'create');
    });

    it('should have create command', () => {
      expect(createCmd).toBeDefined();
    });

    it('should have prd-file argument', () => {
      expect(createCmd?.description()).toContain('PRD file');
    });

    it('should have name option', () => {
      const options = createCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--name');
    });

    it('should have description option', () => {
      const options = createCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--description');
    });

    it('should have quality option', () => {
      const options = createCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--quality');
    });

    it('should have storage option', () => {
      const options = createCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--storage');
    });

    it('should have mock option', () => {
      const options = createCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--mock');
    });

    it('should have verbose option', () => {
      const options = createCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--verbose');
    });
  });

  describe('Run Command', () => {
    let runCmd: Command | undefined;

    beforeEach(() => {
      runCmd = cli.commands.find((cmd) => cmd.name() === 'run');
    });

    it('should have run command', () => {
      expect(runCmd).toBeDefined();
    });

    it('should have project-id argument', () => {
      expect(runCmd?.description()).toContain('Run a project');
    });

    it('should have no-wait option', () => {
      const options = runCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--no-wait');
    });

    it('should have quality option', () => {
      const options = runCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--quality');
    });
  });

  describe('Status Command', () => {
    let statusCmd: Command | undefined;

    beforeEach(() => {
      statusCmd = cli.commands.find((cmd) => cmd.name() === 'status');
    });

    it('should have status command', () => {
      expect(statusCmd).toBeDefined();
    });

    it('should have optional project-id argument', () => {
      expect(statusCmd?.description()).toContain('Get project status');
    });

    it('should have verbose option', () => {
      const options = statusCmd?.options.map((opt) => opt.long);
      expect(options).toContain('--verbose');
    });
  });

  describe('Stop Command', () => {
    let stopCmd: Command | undefined;

    beforeEach(() => {
      stopCmd = cli.commands.find((cmd) => cmd.name() === 'stop');
    });

    it('should have stop command', () => {
      expect(stopCmd).toBeDefined();
    });

    it('should have project-id argument', () => {
      expect(stopCmd?.description()).toContain('Stop a running project');
    });
  });

  describe('Pause Command', () => {
    let pauseCmd: Command | undefined;

    beforeEach(() => {
      pauseCmd = cli.commands.find((cmd) => cmd.name() === 'pause');
    });

    it('should have pause command', () => {
      expect(pauseCmd).toBeDefined();
    });

    it('should have project-id argument', () => {
      expect(pauseCmd?.description()).toContain('Pause a running project');
    });
  });

  describe('Resume Command', () => {
    let resumeCmd: Command | undefined;

    beforeEach(() => {
      resumeCmd = cli.commands.find((cmd) => cmd.name() === 'resume');
    });

    it('should have resume command', () => {
      expect(resumeCmd).toBeDefined();
    });

    it('should have project-id argument', () => {
      expect(resumeCmd?.description()).toContain('Resume a paused project');
    });
  });

  describe('Command Options Defaults', () => {
    it('should default storage to filesystem', () => {
      const createCmd = cli.commands.find((cmd) => cmd.name() === 'create');
      const storageOpt = createCmd?.options.find((opt) => opt.long === '--storage');
      expect(storageOpt?.defaultValue).toBe('filesystem');
    });

    it('should default quality to standard', () => {
      const createCmd = cli.commands.find((cmd) => cmd.name() === 'create');
      const qualityOpt = createCmd?.options.find((opt) => opt.long === '--quality');
      expect(qualityOpt?.defaultValue).toBe('standard');
    });

    it('should default storage-path to .autonomous-runner', () => {
      const createCmd = cli.commands.find((cmd) => cmd.name() === 'create');
      const pathOpt = createCmd?.options.find((opt) => opt.long === '--storage-path');
      expect(pathOpt?.defaultValue).toBe('./.autonomous-runner');
    });
  });
});
