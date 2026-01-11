/**
 * Shell Tools Module
 *
 * Exports all shell-related tools and utilities.
 *
 * @module core/tools/shell
 */

// Interfaces
export * from './shell.interface.js';

// Client
export { ShellClient } from './shell-client.js';

// Tools
export { ShellExecTool, ShellExecInput, ShellExecOutput } from './shell-exec.tool.js';
export {
  ShellCommandTool,
  ShellCommandInput,
  ShellCommandOutput,
} from './shell-command.tool.js';
export {
  ShellScriptTool,
  ShellScriptInput,
  ShellScriptOutput,
} from './shell-script.tool.js';
export {
  ShellEnvTool,
  ShellEnvInput,
  ShellEnvGetOutput,
  ShellEnvSetOutput,
  ShellEnvListOutput,
} from './shell-env.tool.js';
export {
  ShellWhichTool,
  ShellWhichInput,
  ShellWhichOutput,
} from './shell-which.tool.js';
export {
  ShellPipeTool,
  ShellPipeInput,
  ShellPipeOutput,
} from './shell-pipe.tool.js';
export {
  ShellValidateTool,
  ShellValidateInput,
  ShellValidateOutput,
} from './shell-validate.tool.js';

import { IShellClient, ShellClientOptions, ShellSandboxConfig } from './shell.interface.js';
import { ShellClient } from './shell-client.js';
import { ShellExecTool } from './shell-exec.tool.js';
import { ShellCommandTool } from './shell-command.tool.js';
import { ShellScriptTool } from './shell-script.tool.js';
import { ShellEnvTool } from './shell-env.tool.js';
import { ShellWhichTool } from './shell-which.tool.js';
import { ShellPipeTool } from './shell-pipe.tool.js';
import { ShellValidateTool } from './shell-validate.tool.js';
import { ITool } from '../../interfaces/tool.interface.js';

/**
 * Shell tools options
 */
export interface ShellToolsOptions {
  shellClient?: IShellClient;
  clientOptions?: ShellClientOptions;
  sandbox?: ShellSandboxConfig;
}

/**
 * Shell tools collection
 */
export interface ShellTools {
  exec: ShellExecTool;
  command: ShellCommandTool;
  script: ShellScriptTool;
  env: ShellEnvTool;
  which: ShellWhichTool;
  pipe: ShellPipeTool;
  validate: ShellValidateTool;
}

/**
 * Create all shell tools with a shared client
 */
export function createShellTools(options?: ShellToolsOptions): ShellTools {
  const clientOptions = options?.clientOptions ?? {};
  if (options?.sandbox) {
    clientOptions.sandbox = options.sandbox;
  }

  const shellClient = options?.shellClient ?? new ShellClient(clientOptions);

  return {
    exec: new ShellExecTool(shellClient),
    command: new ShellCommandTool(shellClient),
    script: new ShellScriptTool(shellClient),
    env: new ShellEnvTool(shellClient),
    which: new ShellWhichTool(shellClient),
    pipe: new ShellPipeTool(shellClient),
    validate: new ShellValidateTool(shellClient),
  };
}

/**
 * Get all shell tools as an array
 */
export function getAllShellTools(options?: ShellToolsOptions): ITool[] {
  const tools = createShellTools(options);
  return [
    tools.exec,
    tools.command,
    tools.script,
    tools.env,
    tools.which,
    tools.pipe,
    tools.validate,
  ];
}
