/**
 * Mock Shell Client for Testing
 */

import {
  IShellClient,
  ShellExecOptions,
  ShellOperationResult,
  ShellResult,
  ShellSandboxConfig,
  ScriptExecOptions,
  PipeCommand,
  EnvVarInfo,
  CommandLocation,
  DEFAULT_BLOCKED_COMMANDS,
  DEFAULT_BLOCKED_PATTERNS,
} from '../../../../../src/core/tools/shell/shell.interface.js';

/**
 * Mock Shell Client
 */
export class MockShellClient implements IShellClient {
  // Track method calls
  calls: { method: string; args: unknown[] }[] = [];

  // Custom environment variables
  private customEnv: Map<string, string> = new Map();

  // Configurable responses
  execResponse: ShellOperationResult<ShellResult> = {
    success: true,
    data: createMockShellResult(),
  };

  execCommandResponse: ShellOperationResult<ShellResult> = {
    success: true,
    data: createMockShellResult(),
  };

  execScriptResponse: ShellOperationResult<ShellResult> = {
    success: true,
    data: createMockShellResult(),
  };

  execPipeResponse: ShellOperationResult<ShellResult> = {
    success: true,
    data: createMockShellResult(),
  };

  whichResponse: ShellOperationResult<CommandLocation> = {
    success: true,
    data: createMockCommandLocation(),
  };

  commandExistsResponse = true;

  sandboxConfig: ShellSandboxConfig = {
    blockedCommands: DEFAULT_BLOCKED_COMMANDS,
    blockedPatterns: DEFAULT_BLOCKED_PATTERNS,
    maxTimeout: 60000,
    maxOutputSize: 10 * 1024 * 1024,
    allowNetwork: true,
    allowFileModification: false,
    allowProcessManagement: false,
    strictMode: false,
  };

  validateCommandResponse: ShellOperationResult = { success: true };

  async exec(
    command: string,
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    this.calls.push({ method: 'exec', args: [command, options] });
    return this.execResponse;
  }

  async execCommand(
    command: string,
    args: string[] = [],
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    this.calls.push({ method: 'execCommand', args: [command, args, options] });
    return this.execCommandResponse;
  }

  async execScript(
    scriptPath: string,
    options?: ScriptExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    this.calls.push({ method: 'execScript', args: [scriptPath, options] });
    return this.execScriptResponse;
  }

  async execPipe(
    commands: PipeCommand[],
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    this.calls.push({ method: 'execPipe', args: [commands, options] });
    return this.execPipeResponse;
  }

  getEnv(name: string): ShellOperationResult<string | undefined> {
    this.calls.push({ method: 'getEnv', args: [name] });

    if (this.customEnv.has(name)) {
      return { success: true, data: this.customEnv.get(name) };
    }

    // Return some default env vars
    const defaults: Record<string, string> = {
      PATH: '/usr/bin:/bin',
      HOME: '/home/user',
      USER: 'testuser',
      SHELL: '/bin/bash',
    };

    return { success: true, data: defaults[name] };
  }

  setEnv(name: string, value: string): ShellOperationResult {
    this.calls.push({ method: 'setEnv', args: [name, value] });

    if (this.sandboxConfig.blockedEnvVars?.includes(name)) {
      return { success: false, error: `Environment variable '${name}' is blocked` };
    }

    this.customEnv.set(name, value);
    return { success: true };
  }

  getAllEnv(): ShellOperationResult<EnvVarInfo[]> {
    this.calls.push({ method: 'getAllEnv', args: [] });

    const envVars: EnvVarInfo[] = [
      { name: 'PATH', value: '/usr/bin:/bin', source: 'process' },
      { name: 'HOME', value: '/home/user', source: 'process' },
      { name: 'USER', value: 'testuser', source: 'process' },
      { name: 'SHELL', value: '/bin/bash', source: 'process' },
    ];

    // Add custom env vars
    for (const [name, value] of this.customEnv) {
      envVars.push({ name, value, source: 'custom' });
    }

    return { success: true, data: envVars };
  }

  async which(command: string): Promise<ShellOperationResult<CommandLocation>> {
    this.calls.push({ method: 'which', args: [command] });
    return this.whichResponse;
  }

  async commandExists(command: string): Promise<boolean> {
    this.calls.push({ method: 'commandExists', args: [command] });
    return this.commandExistsResponse;
  }

  getCwd(): string {
    return '/test/cwd';
  }

  getShell(): string {
    return '/bin/bash';
  }

  validateCommand(command: string): ShellOperationResult {
    this.calls.push({ method: 'validateCommand', args: [command] });
    return this.validateCommandResponse;
  }

  getSandboxConfig(): ShellSandboxConfig {
    return { ...this.sandboxConfig };
  }

  setSandboxConfig(config: ShellSandboxConfig): void {
    this.sandboxConfig = { ...this.sandboxConfig, ...config };
  }
}

/**
 * Create a mock shell result
 */
export function createMockShellResult(overrides?: Partial<ShellResult>): ShellResult {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    killed: false,
    timedOut: false,
    duration: 10,
    ...overrides,
  };
}

/**
 * Create a mock command location
 */
export function createMockCommandLocation(
  overrides?: Partial<CommandLocation>
): CommandLocation {
  return {
    command: 'node',
    path: '/usr/bin/node',
    exists: true,
    isExecutable: true,
    isBuiltin: false,
    ...overrides,
  };
}

/**
 * Create a mock env var info
 */
export function createMockEnvVarInfo(overrides?: Partial<EnvVarInfo>): EnvVarInfo {
  return {
    name: 'TEST_VAR',
    value: 'test_value',
    source: 'custom',
    ...overrides,
  };
}
