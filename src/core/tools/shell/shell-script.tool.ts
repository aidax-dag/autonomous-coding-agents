/**
 * Shell Script Tool
 *
 * Executes shell scripts with sandbox security.
 *
 * @module core/tools/shell/shell-script
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
 * Input parameters for shell script
 */
export interface ShellScriptInput {
  path: string;
  args?: string[];
  interpreter?: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * Output for shell script
 */
export interface ShellScriptOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timedOut: boolean;
}

/**
 * Shell Script Tool
 *
 * Executes a script file with optional interpreter.
 */
export class ShellScriptTool extends BaseTool<ShellScriptInput, ShellScriptOutput> {
  readonly name = 'shell-script';
  readonly description = 'Execute a shell script file';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.SHELL,
    version: '1.0.0',
    parameters: [
      {
        name: 'path',
        type: 'string',
        description: 'Path to the script file',
        required: true,
      },
      {
        name: 'args',
        type: 'array',
        description: 'Arguments to pass to the script',
        required: false,
      },
      {
        name: 'interpreter',
        type: 'string',
        description: 'Interpreter to use (e.g., /bin/bash, python3)',
        required: false,
      },
      {
        name: 'cwd',
        type: 'string',
        description: 'Working directory for script execution',
        required: false,
      },
      {
        name: 'env',
        type: 'object',
        description: 'Environment variables for the script',
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
      description: 'Script execution result',
    },
    tags: ['shell', 'script', 'execute'],
  };

  private readonly shellClient: IShellClient;

  constructor(shellClient?: IShellClient) {
    super();
    this.shellClient = shellClient ?? new ShellClient();
  }

  async execute(
    params: ShellScriptInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ShellScriptOutput>> {
    const startTime = Date.now();

    if (!params.path || params.path.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Script path is required',
        Date.now() - startTime
      );
    }

    const result = await this.shellClient.execScript(params.path, {
      args: params.args,
      interpreter: params.interpreter,
      cwd: params.cwd,
      env: params.env,
      timeout: params.timeout,
    });

    if (!result.success) {
      return this.failure(
        'SHELL_SCRIPT_FAILED',
        result.error ?? 'Failed to execute script',
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
