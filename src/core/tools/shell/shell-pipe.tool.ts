/**
 * Shell Pipe Tool
 *
 * Executes piped commands with sandbox security.
 *
 * @module core/tools/shell/shell-pipe
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IShellClient, ShellResult, PipeCommand } from './shell.interface.js';
import { ShellClient } from './shell-client.js';

/**
 * Input parameters for shell pipe
 */
export interface ShellPipeInput {
  commands: PipeCommand[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Output for shell pipe
 */
export interface ShellPipeOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timedOut: boolean;
  commandCount: number;
}

/**
 * Shell Pipe Tool
 *
 * Executes multiple commands connected by pipes.
 */
export class ShellPipeTool extends BaseTool<ShellPipeInput, ShellPipeOutput> {
  readonly name = 'shell-pipe';
  readonly description = 'Execute piped commands';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.SHELL,
    version: '1.0.0',
    parameters: [
      {
        name: 'commands',
        type: 'array',
        description: 'Array of commands to pipe together',
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
        description: 'Environment variables for the commands',
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
      description: 'Pipe execution result',
    },
    tags: ['shell', 'pipe', 'chain'],
  };

  private readonly shellClient: IShellClient;

  constructor(shellClient?: IShellClient) {
    super();
    this.shellClient = shellClient ?? new ShellClient();
  }

  async execute(
    params: ShellPipeInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ShellPipeOutput>> {
    const startTime = Date.now();

    if (!params.commands || params.commands.length === 0) {
      return this.failure(
        'INVALID_PARAMS',
        'At least one command is required',
        Date.now() - startTime
      );
    }

    // Validate each command has a command property
    for (let i = 0; i < params.commands.length; i++) {
      const cmd = params.commands[i];
      if (!cmd.command || cmd.command.trim() === '') {
        return this.failure(
          'INVALID_PARAMS',
          `Command at index ${i} is empty`,
          Date.now() - startTime
        );
      }
    }

    const result = await this.shellClient.execPipe(params.commands, {
      cwd: params.cwd,
      env: params.env,
      timeout: params.timeout,
    });

    if (!result.success) {
      return this.failure(
        'SHELL_PIPE_FAILED',
        result.error ?? 'Failed to execute piped commands',
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
        commandCount: params.commands.length,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
