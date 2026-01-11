/**
 * Shell Validate Tool
 *
 * Validates commands against sandbox security rules.
 *
 * @module core/tools/shell/shell-validate
 */

import { BaseTool } from '../base-tool.js';
import {
  ToolSchema,
  ToolCategory,
  ToolResult,
  ToolExecutionOptions,
} from '../../interfaces/tool.interface.js';
import { IShellClient } from './shell.interface.js';
import { ShellClient } from './shell-client.js';

/**
 * Input parameters for shell validate
 */
export interface ShellValidateInput {
  command: string;
}

/**
 * Output for shell validate
 */
export interface ShellValidateOutput {
  command: string;
  valid: boolean;
  reason?: string;
  sandboxConfig: {
    allowNetwork: boolean;
    allowFileModification: boolean;
    allowProcessManagement: boolean;
    strictMode: boolean;
    blockedCommandsCount: number;
  };
}

/**
 * Shell Validate Tool
 *
 * Validates a command against sandbox security rules without executing it.
 */
export class ShellValidateTool extends BaseTool<ShellValidateInput, ShellValidateOutput> {
  readonly name = 'shell-validate';
  readonly description = 'Validate command against sandbox security rules';
  readonly schema: ToolSchema = {
    name: this.name,
    description: this.description,
    category: ToolCategory.SHELL,
    version: '1.0.0',
    parameters: [
      {
        name: 'command',
        type: 'string',
        description: 'Command to validate',
        required: true,
      },
    ],
    returns: {
      type: 'object',
      description: 'Validation result',
    },
    tags: ['shell', 'validate', 'security', 'sandbox'],
  };

  private readonly shellClient: IShellClient;

  constructor(shellClient?: IShellClient) {
    super();
    this.shellClient = shellClient ?? new ShellClient();
  }

  async execute(
    params: ShellValidateInput,
    _options?: ToolExecutionOptions
  ): Promise<ToolResult<ShellValidateOutput>> {
    const startTime = Date.now();

    if (!params.command || params.command.trim() === '') {
      return this.failure(
        'INVALID_PARAMS',
        'Command is required',
        Date.now() - startTime
      );
    }

    const validationResult = this.shellClient.validateCommand(params.command);
    const sandboxConfig = this.shellClient.getSandboxConfig();

    return this.success(
      {
        command: params.command,
        valid: validationResult.success,
        reason: validationResult.error,
        sandboxConfig: {
          allowNetwork: sandboxConfig.allowNetwork ?? true,
          allowFileModification: sandboxConfig.allowFileModification ?? false,
          allowProcessManagement: sandboxConfig.allowProcessManagement ?? false,
          strictMode: sandboxConfig.strictMode ?? false,
          blockedCommandsCount: sandboxConfig.blockedCommands?.length ?? 0,
        },
      },
      Date.now() - startTime
    );
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
