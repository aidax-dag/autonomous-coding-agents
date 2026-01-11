/**
 * Shell Which Tool
 *
 * Finds command locations in the system PATH.
 *
 * @module core/tools/shell/shell-which
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IShellClient, CommandLocation } from './shell.interface.js';
import { ShellClient } from './shell-client.js';

/**
 * Input parameters for shell which
 */
export interface ShellWhichInput {
  command: string;
}

/**
 * Output for shell which
 */
export interface ShellWhichOutput {
  command: string;
  path: string;
  exists: boolean;
  isExecutable: boolean;
  isBuiltin: boolean;
}

/**
 * Shell Which Tool
 *
 * Finds the location of a command in the system PATH.
 */
export class ShellWhichTool extends BaseTool<ShellWhichInput, ShellWhichOutput> {
  readonly name = 'shell-which';
  readonly description = 'Find command location in PATH';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.SHELL,
    version: '1.0.0',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Command to find',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'Command location information',
    },
    tags: ['shell', 'which', 'path', 'find'],
  };

  private readonly shellClient: IShellClient;

  constructor(shellClient?: IShellClient) {
    super();
    this.shellClient = shellClient ?? new ShellClient();
  }

  async execute(
    params: ShellWhichInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ShellWhichOutput>> {
    const startTime = Date.now();

    if (!params.command || params.command.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Command is required',
        Date.now() - startTime
      );
    }

    const result = await this.shellClient.which(params.command);

    if (!result.success || !result.data) {
      return this.failure(
        'SHELL_WHICH_FAILED',
        result.error ?? 'Failed to find command',
        Date.now() - startTime
      );
    }

    const location = result.data as CommandLocation;

    return this.success(
      {
        command: location.command,
        path: location.path,
        exists: location.exists,
        isExecutable: location.isExecutable,
        isBuiltin: location.isBuiltin,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
