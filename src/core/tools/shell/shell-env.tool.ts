/**
 * Shell Env Tool
 *
 * Manages environment variables for shell execution.
 *
 * @module core/tools/shell/shell-env
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IShellClient, EnvVarInfo } from './shell.interface.js';
import { ShellClient } from './shell-client.js';

/**
 * Input parameters for shell env
 */
export interface ShellEnvInput {
  action: 'get' | 'set' | 'list';
  name?: string;
  value?: string;
}

/**
 * Output for get action
 */
export interface ShellEnvGetOutput {
  name: string;
  value: string | undefined;
  exists: boolean;
}

/**
 * Output for set action
 */
export interface ShellEnvSetOutput {
  name: string;
  value: string;
  set: boolean;
}

/**
 * Output for list action
 */
export interface ShellEnvListOutput {
  variables: EnvVarInfo[];
  count: number;
}

/**
 * Shell Env Tool
 *
 * Gets, sets, or lists environment variables.
 */
export class ShellEnvTool extends BaseTool<
  ShellEnvInput,
  ShellEnvGetOutput | ShellEnvSetOutput | ShellEnvListOutput
> {
  readonly name = 'shell-env';
  readonly description = 'Manage environment variables';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.SHELL,
    version: '1.0.0',
    parameters: [
      {
        name: 'action',
        type: 'string',
        description: 'Action to perform: get, set, or list',
        required: true,
        enum: ['get', 'set', 'list'],
      },
      {
        name: 'name',
        type: 'string',
        description: 'Environment variable name (required for get/set)',
        required: false,
      },
      {
        name: 'value',
        type: 'string',
        description: 'Environment variable value (required for set)',
        required: false,
      },
    ],
    returns: {
      type: 'object',
      description: 'Environment variable operation result',
    },
    tags: ['shell', 'env', 'environment', 'variable'],
  };

  private readonly shellClient: IShellClient;

  constructor(shellClient?: IShellClient) {
    super();
    this.shellClient = shellClient ?? new ShellClient();
  }

  async execute(
    params: ShellEnvInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ShellEnvGetOutput | ShellEnvSetOutput | ShellEnvListOutput>> {
    const startTime = Date.now();

    if (!params.action) {
      return this.failure(
        'INVALID_PARAMS',
        'Action is required',
        Date.now() - startTime
      );
    }

    switch (params.action) {
      case 'get':
        return this.handleGet(params, startTime);
      case 'set':
        return this.handleSet(params, startTime);
      case 'list':
        return this.handleList(startTime);
      default:
        return this.failure(
          'INVALID_ACTION',
          `Invalid action: ${params.action}`,
          Date.now() - startTime
        );
    }
  }

  private handleGet(
    params: ShellEnvInput,
    startTime: number
  ): ToolResult<ShellEnvGetOutput> {
    if (!params.name) {
      return this.failure(
        'INVALID_PARAMS',
        'Name is required for get action',
        Date.now() - startTime
      );
    }

    const result = this.shellClient.getEnv(params.name);

    if (!result.success) {
      return this.failure(
        'SHELL_ENV_FAILED',
        result.error ?? 'Failed to get environment variable',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        name: params.name,
        value: result.data,
        exists: result.data !== undefined,
      },
      Date.now() - startTime
    );
  }

  private handleSet(
    params: ShellEnvInput,
    startTime: number
  ): ToolResult<ShellEnvSetOutput> {
    if (!params.name) {
      return this.failure(
        'INVALID_PARAMS',
        'Name is required for set action',
        Date.now() - startTime
      );
    }

    if (params.value === undefined) {
      return this.failure(
        'INVALID_PARAMS',
        'Value is required for set action',
        Date.now() - startTime
      );
    }

    const result = this.shellClient.setEnv(params.name, params.value);

    if (!result.success) {
      return this.failure(
        'SHELL_ENV_FAILED',
        result.error ?? 'Failed to set environment variable',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        name: params.name,
        value: params.value,
        set: true,
      },
      Date.now() - startTime
    );
  }

  private handleList(startTime: number): ToolResult<ShellEnvListOutput> {
    const result = this.shellClient.getAllEnv();

    if (!result.success || !result.data) {
      return this.failure(
        'SHELL_ENV_FAILED',
        result.error ?? 'Failed to list environment variables',
        Date.now() - startTime
      );
    }

    return this.success(
      {
        variables: result.data,
        count: result.data.length,
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
