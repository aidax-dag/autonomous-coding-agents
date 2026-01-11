/**
 * Shell Exec Tool
 *
 * Executes shell commands with sandbox security.
 *
 * @module core/tools/shell/shell-exec
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
 * Input parameters for shell exec
 */
export interface ShellExecInput {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Output for shell exec
 */
export interface ShellExecOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timedOut: boolean;
}

/**
 * Shell Exec Tool
 *
 * Executes a shell command and returns the output.
 */
export class ShellExecTool extends BaseTool<ShellExecInput, ShellExecOutput> {
  readonly name = 'shell-exec';
  readonly description = 'Execute a shell command';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.SHELL,
    version: '1.0.0',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Shell command to execute',
        required: true,
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
    tags: ['shell', 'exec', 'command'],
  };

  private readonly shellClient: IShellClient;

  constructor(shellClient?: IShellClient) {
    super();
    this.shellClient = shellClient ?? new ShellClient();
  }

  async execute(
    params: ShellExecInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ShellExecOutput>> {
    const startTime = Date.now();

    if (!params.command || params.command.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Command is required',
        Date.now() - startTime
      );
    }

    const result = await this.shellClient.exec(params.command, {
      cwd: params.cwd,
      env: params.env,
      timeout: params.timeout,
    });

    if (!result.success) {
      return this.failure(
        'SHELL_EXEC_FAILED',
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
