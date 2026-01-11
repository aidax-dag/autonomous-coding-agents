/**
 * Shell Command Tool
 *
 * Executes a command with arguments (safer than shell-exec).
 *
 * @module core/tools/shell/shell-command
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IShellClient, ShellResult } from './shell.interface.js';
import { ShellClient } from './shell-client.js';

/**
 * Input parameters for shell command
 */
export interface ShellCommandInput {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Output for shell command
 */
export interface ShellCommandOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timedOut: boolean;
}

/**
 * Shell Command Tool
 *
 * Executes a command with arguments directly (no shell interpretation).
 * This is safer than shell-exec as it avoids shell injection vulnerabilities.
 */
export class ShellCommandTool extends BaseTool<ShellCommandInput, ShellCommandOutput> {
  readonly name = 'shell-command';
  readonly description = 'Execute a command with arguments (safer execution)';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.SHELL,
    version: '1.0.0',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Command to execute',
        required: true,
      },
      {
        name: 'args',
        type: 'array',
        description: 'Command arguments',
        required: false,
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory for command execution',
        required: false,
      },
      {
        name: 'env',
        type: 'object',
        description: 'Environment variables for the command',
        required: false,
      },
      {
        name: 'timeout',
        type: 'number',
        description: 'Timeout in milliseconds',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Command execution result',
    },
    tags: ['shell', 'command', 'safe'],
  };

  private readonly shellClient: IShellClient;

  constructor(shellClient?: IShellClient) {
    super();
    this.shellClient = shellClient ?? new ShellClient();
  }

  async execute(
    params: ShellCommandInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ShellCommandOutput>> {
    const startTime = Date.now();

    if (!params.command || params.command.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Command is required',
        Date.now() - startTime
      );
    }

    const result = await this.shellClient.execCommand(
      params.command,
      params.args ?? [],
      {
        cwd: params.cwd,
        env: params.env,
        timeout: params.timeout,
      }
    );

    if (!result.success) {
      return this.failure(
        'SHELL_COMMAND_FAILED',
        result.error ?? 'Failed to execute command',
        Date.now() - startTime,
        { stderr: result.data?.stderr }
      );
    }

    const data = result.data as ShellResult;

    return this.success(
      {
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exitCode,
        duration: data.duration,
        timedOut: data.timedOut,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
