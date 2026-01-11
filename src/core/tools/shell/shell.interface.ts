/**
 * Shell Tool Interfaces
 *
 * Defines types and interfaces for shell command execution with sandbox support.
 *
 * @module core/tools/shell/shell.interface
 */

/**
 * Shell execution result
 */
export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  signal?: string;
  killed: boolean;
  timedOut: boolean;
  duration: number;
}

/**
 * Shell operation result
 */
export interface ShellOperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  stderr?: string;
}

/**
 * Shell execution options
 */
export interface ShellExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  maxBuffer?: number;
  shell?: string | boolean;
  encoding?: BufferEncoding;
  uid?: number;
  gid?: number;
}

/**
 * Sandbox configuration for secure shell execution
 */
export interface ShellSandboxConfig {
  /**
   * Allowed commands (whitelist) - if empty, all commands allowed
   */
  allowedCommands?: string[];

  /**
   * Blocked commands (blacklist) - takes precedence over allowedCommands
   */
  blockedCommands?: string[];

  /**
   * Blocked command patterns (regex)
   */
  blockedPatterns?: RegExp[];

  /**
   * Allowed working directories
   */
  allowedPaths?: string[];

  /**
   * Blocked paths (takes precedence over allowedPaths)
   */
  blockedPaths?: string[];

  /**
   * Environment variables to pass through
   */
  allowedEnvVars?: string[];

  /**
   * Environment variables to block
   */
  blockedEnvVars?: string[];

  /**
   * Maximum execution time in milliseconds
   */
  maxTimeout?: number;

  /**
   * Maximum output buffer size in bytes
   */
  maxOutputSize?: number;

  /**
   * Allow network access commands
   */
  allowNetwork?: boolean;

  /**
   * Allow file modification commands
   */
  allowFileModification?: boolean;

  /**
   * Allow process management commands
   */
  allowProcessManagement?: boolean;

  /**
   * Enable strict mode (extra security checks)
   */
  strictMode?: boolean;
}

/**
 * Default dangerous commands to block
 */
export const DEFAULT_BLOCKED_COMMANDS = [
  'rm',
  'rmdir',
  'del',
  'format',
  'fdisk',
  'mkfs',
  'dd',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'init',
  'systemctl',
  'service',
  'kill',
  'killall',
  'pkill',
  'chmod',
  'chown',
  'chgrp',
  'sudo',
  'su',
  'passwd',
  'useradd',
  'userdel',
  'usermod',
  'groupadd',
  'groupdel',
  'mount',
  'umount',
  'iptables',
  'ufw',
  'firewall-cmd',
];

/**
 * Default dangerous patterns to block
 */
export const DEFAULT_BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)/, // rm -rf, rm -r
  />\s*\/dev\//, // Redirect to devices
  />\s*\/etc\//, // Redirect to /etc
  /\|\s*sh/, // Pipe to shell
  /\|\s*bash/, // Pipe to bash
  /`.*`/, // Command substitution
  /\$\(.*\)/, // Command substitution
  /;\s*(rm|del|format)/, // Command chaining with dangerous commands
  /&&\s*(rm|del|format)/, // Command chaining with dangerous commands
  /\|\|\s*(rm|del|format)/, // Command chaining with dangerous commands
  /curl\s+.*\|\s*sh/, // curl | sh pattern
  /wget\s+.*\|\s*sh/, // wget | sh pattern
  /eval\s+/, // eval command
  /exec\s+/, // exec command
];

/**
 * Environment variable info
 */
export interface EnvVarInfo {
  name: string;
  value: string;
  source?: 'process' | 'custom' | 'inherited';
}

/**
 * Command location info
 */
export interface CommandLocation {
  command: string;
  path: string;
  exists: boolean;
  isExecutable: boolean;
  isBuiltin: boolean;
}

/**
 * Script execution options
 */
export interface ScriptExecOptions extends ShellExecOptions {
  interpreter?: string;
  args?: string[];
}

/**
 * Pipe command definition
 */
export interface PipeCommand {
  command: string;
  args?: string[];
}

/**
 * Pipe execution options
 */
export interface PipeExecOptions extends ShellExecOptions {
  commands: PipeCommand[];
}

/**
 * Shell client interface for executing shell commands
 */
export interface IShellClient {
  /**
   * Execute a shell command
   */
  exec(
    command: string,
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>>;

  /**
   * Execute a shell command with arguments
   */
  execCommand(
    command: string,
    args?: string[],
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>>;

  /**
   * Execute a script file
   */
  execScript(
    scriptPath: string,
    options?: ScriptExecOptions
  ): Promise<ShellOperationResult<ShellResult>>;

  /**
   * Execute piped commands
   */
  execPipe(
    commands: PipeCommand[],
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>>;

  /**
   * Get environment variable
   */
  getEnv(name: string): ShellOperationResult<string | undefined>;

  /**
   * Set environment variable (for child processes)
   */
  setEnv(name: string, value: string): ShellOperationResult;

  /**
   * Get all environment variables
   */
  getAllEnv(): ShellOperationResult<EnvVarInfo[]>;

  /**
   * Find command location
   */
  which(command: string): Promise<ShellOperationResult<CommandLocation>>;

  /**
   * Check if command exists
   */
  commandExists(command: string): Promise<boolean>;

  /**
   * Get current working directory
   */
  getCwd(): string;

  /**
   * Get shell name
   */
  getShell(): string;

  /**
   * Validate command against sandbox rules
   */
  validateCommand(command: string): ShellOperationResult;

  /**
   * Get sandbox configuration
   */
  getSandboxConfig(): ShellSandboxConfig;

  /**
   * Update sandbox configuration
   */
  setSandboxConfig(config: ShellSandboxConfig): void;
}

/**
 * Shell client options
 */
export interface ShellClientOptions {
  cwd?: string;
  env?: Record<string, string>;
  shell?: string;
  timeout?: number;
  sandbox?: ShellSandboxConfig;
}
