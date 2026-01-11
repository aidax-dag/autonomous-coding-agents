/**
 * Shell Client Implementation
 *
 * Provides shell command execution with sandbox security.
 *
 * @module core/tools/shell/shell-client
 */

import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';
import { access, constants } from 'node:fs/promises';
import * as path from 'node:path';
import {
  IShellClient,
  ShellClientOptions,
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
} from './shell.interface.js';

const execAsync = promisify(exec);

/**
 * Default timeout for shell operations (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Default max output buffer (10MB)
 */
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

/**
 * Shell Client Implementation
 *
 * Executes shell commands with sandbox security features.
 */
export class ShellClient implements IShellClient {
  private readonly defaultCwd: string;
  private readonly defaultEnv: Record<string, string>;
  private readonly defaultShell: string;
  private readonly defaultTimeout: number;
  private sandboxConfig: ShellSandboxConfig;
  private customEnv: Map<string, string> = new Map();

  constructor(options?: ShellClientOptions) {
    this.defaultCwd = options?.cwd ?? process.cwd();
    this.defaultEnv = options?.env ?? {};
    this.defaultShell = options?.shell ?? this.detectDefaultShell();
    this.defaultTimeout = options?.timeout ?? DEFAULT_TIMEOUT;
    this.sandboxConfig = this.initSandboxConfig(options?.sandbox);
  }

  /**
   * Detect the default shell
   */
  private detectDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC ?? 'cmd.exe';
    }
    return process.env.SHELL ?? '/bin/sh';
  }

  /**
   * Initialize sandbox configuration with defaults
   */
  private initSandboxConfig(config?: ShellSandboxConfig): ShellSandboxConfig {
    return {
      blockedCommands: config?.blockedCommands ?? DEFAULT_BLOCKED_COMMANDS,
      blockedPatterns: config?.blockedPatterns ?? DEFAULT_BLOCKED_PATTERNS,
      maxTimeout: config?.maxTimeout ?? 60000,
      maxOutputSize: config?.maxOutputSize ?? DEFAULT_MAX_BUFFER,
      allowNetwork: config?.allowNetwork ?? true,
      allowFileModification: config?.allowFileModification ?? false,
      allowProcessManagement: config?.allowProcessManagement ?? false,
      strictMode: config?.strictMode ?? false,
      ...config,
    };
  }

  /**
   * Execute a shell command
   */
  async exec(
    command: string,
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    // Validate command against sandbox rules
    const validation = this.validateCommand(command);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const startTime = Date.now();
    const timeout = Math.min(
      options?.timeout ?? this.defaultTimeout,
      this.sandboxConfig.maxTimeout ?? DEFAULT_TIMEOUT
    );
    const maxBuffer = Math.min(
      options?.maxBuffer ?? DEFAULT_MAX_BUFFER,
      this.sandboxConfig.maxOutputSize ?? DEFAULT_MAX_BUFFER
    );

    try {
      const cwd = this.validateCwd(options?.cwd ?? this.defaultCwd);
      if (!cwd.success) {
        return { success: false, error: cwd.error };
      }

      const env = this.buildEnvironment(options?.env);

      const result = await new Promise<ShellResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let killed = false;
        let timedOut = false;

        const proc = spawn(command, [], {
          cwd: cwd.data,
          env,
          shell: options?.shell ?? this.defaultShell,
          uid: options?.uid,
          gid: options?.gid,
        });

        const timer = setTimeout(() => {
          timedOut = true;
          killed = true;
          proc.kill('SIGTERM');
        }, timeout);

        proc.stdout?.on('data', (data) => {
          stdout += data.toString(options?.encoding ?? 'utf8');
          if (stdout.length > maxBuffer) {
            killed = true;
            proc.kill('SIGTERM');
          }
        });

        proc.stderr?.on('data', (data) => {
          stderr += data.toString(options?.encoding ?? 'utf8');
        });

        proc.on('error', (error) => {
          clearTimeout(timer);
          resolve({
            stdout: '',
            stderr: error.message,
            exitCode: -1,
            killed: false,
            timedOut: false,
            duration: Date.now() - startTime,
          });
        });

        proc.on('close', (exitCode, signal) => {
          clearTimeout(timer);
          resolve({
            stdout,
            stderr,
            exitCode: exitCode ?? 0,
            signal: signal ?? undefined,
            killed,
            timedOut,
            duration: Date.now() - startTime,
          });
        });
      });

      return { success: result.exitCode === 0, data: result };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        data: {
          stdout: '',
          stderr: (error as Error).message,
          exitCode: -1,
          killed: false,
          timedOut: false,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute a command with arguments
   */
  async execCommand(
    command: string,
    args: string[] = [],
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    // Validate base command
    const validation = this.validateCommand(command);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const startTime = Date.now();
    const timeout = Math.min(
      options?.timeout ?? this.defaultTimeout,
      this.sandboxConfig.maxTimeout ?? DEFAULT_TIMEOUT
    );
    const maxBuffer = Math.min(
      options?.maxBuffer ?? DEFAULT_MAX_BUFFER,
      this.sandboxConfig.maxOutputSize ?? DEFAULT_MAX_BUFFER
    );

    try {
      const cwd = this.validateCwd(options?.cwd ?? this.defaultCwd);
      if (!cwd.success) {
        return { success: false, error: cwd.error };
      }

      const env = this.buildEnvironment(options?.env);

      const result = await new Promise<ShellResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let killed = false;
        let timedOut = false;

        const proc = spawn(command, args, {
          cwd: cwd.data,
          env,
          shell: false, // Direct execution without shell
          uid: options?.uid,
          gid: options?.gid,
        });

        const timer = setTimeout(() => {
          timedOut = true;
          killed = true;
          proc.kill('SIGTERM');
        }, timeout);

        proc.stdout?.on('data', (data) => {
          stdout += data.toString(options?.encoding ?? 'utf8');
          if (stdout.length > maxBuffer) {
            killed = true;
            proc.kill('SIGTERM');
          }
        });

        proc.stderr?.on('data', (data) => {
          stderr += data.toString(options?.encoding ?? 'utf8');
        });

        proc.on('error', (error) => {
          clearTimeout(timer);
          resolve({
            stdout: '',
            stderr: error.message,
            exitCode: -1,
            killed: false,
            timedOut: false,
            duration: Date.now() - startTime,
          });
        });

        proc.on('close', (exitCode, signal) => {
          clearTimeout(timer);
          resolve({
            stdout,
            stderr,
            exitCode: exitCode ?? 0,
            signal: signal ?? undefined,
            killed,
            timedOut,
            duration: Date.now() - startTime,
          });
        });
      });

      return { success: result.exitCode === 0, data: result };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        data: {
          stdout: '',
          stderr: (error as Error).message,
          exitCode: -1,
          killed: false,
          timedOut: false,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Execute a script file
   */
  async execScript(
    scriptPath: string,
    options?: ScriptExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    // Check if script exists and is readable
    try {
      await access(scriptPath, constants.R_OK);
    } catch {
      return { success: false, error: `Script not found or not readable: ${scriptPath}` };
    }

    const interpreter = options?.interpreter ?? this.detectInterpreter(scriptPath);
    const args = [scriptPath, ...(options?.args ?? [])];

    return this.execCommand(interpreter, args, options);
  }

  /**
   * Detect script interpreter from file extension
   */
  private detectInterpreter(scriptPath: string): string {
    const ext = path.extname(scriptPath).toLowerCase();
    const interpreters: Record<string, string> = {
      '.sh': '/bin/sh',
      '.bash': '/bin/bash',
      '.zsh': '/bin/zsh',
      '.py': 'python3',
      '.js': 'node',
      '.ts': 'npx ts-node',
      '.rb': 'ruby',
      '.pl': 'perl',
      '.ps1': 'powershell',
      '.bat': 'cmd.exe /c',
      '.cmd': 'cmd.exe /c',
    };
    return interpreters[ext] ?? '/bin/sh';
  }

  /**
   * Execute piped commands
   */
  async execPipe(
    commands: PipeCommand[],
    options?: ShellExecOptions
  ): Promise<ShellOperationResult<ShellResult>> {
    if (commands.length === 0) {
      return { success: false, error: 'No commands provided for pipe' };
    }

    // Validate all commands
    for (const cmd of commands) {
      const validation = this.validateCommand(cmd.command);
      if (!validation.success) {
        return { success: false, error: validation.error };
      }
    }

    // Build pipe command string
    const pipeString = commands
      .map((cmd) => {
        if (cmd.args?.length) {
          return `${cmd.command} ${cmd.args.map((a) => this.escapeArg(a)).join(' ')}`;
        }
        return cmd.command;
      })
      .join(' | ');

    return this.exec(pipeString, options);
  }

  /**
   * Escape shell argument
   */
  private escapeArg(arg: string): string {
    if (!/[\s'"\\]/.test(arg)) {
      return arg;
    }
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Get environment variable
   */
  getEnv(name: string): ShellOperationResult<string | undefined> {
    // Check custom env first
    if (this.customEnv.has(name)) {
      return { success: true, data: this.customEnv.get(name) };
    }

    // Check default env
    if (name in this.defaultEnv) {
      return { success: true, data: this.defaultEnv[name] };
    }

    // Check process env
    return { success: true, data: process.env[name] };
  }

  /**
   * Set environment variable
   */
  setEnv(name: string, value: string): ShellOperationResult {
    // Check if env var is blocked
    if (this.sandboxConfig.blockedEnvVars?.includes(name)) {
      return { success: false, error: `Environment variable '${name}' is blocked` };
    }

    this.customEnv.set(name, value);
    return { success: true };
  }

  /**
   * Get all environment variables
   */
  getAllEnv(): ShellOperationResult<EnvVarInfo[]> {
    const envVars: EnvVarInfo[] = [];

    // Add process env
    for (const [name, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        envVars.push({ name, value, source: 'process' });
      }
    }

    // Add/override with default env
    for (const [name, value] of Object.entries(this.defaultEnv)) {
      const idx = envVars.findIndex((e) => e.name === name);
      if (idx >= 0) {
        envVars[idx] = { name, value, source: 'inherited' };
      } else {
        envVars.push({ name, value, source: 'inherited' });
      }
    }

    // Add/override with custom env
    for (const [name, value] of this.customEnv) {
      const idx = envVars.findIndex((e) => e.name === name);
      if (idx >= 0) {
        envVars[idx] = { name, value, source: 'custom' };
      } else {
        envVars.push({ name, value, source: 'custom' });
      }
    }

    // Filter if allowedEnvVars is set
    let filtered = envVars;
    if (this.sandboxConfig.allowedEnvVars?.length) {
      filtered = envVars.filter((e) =>
        this.sandboxConfig.allowedEnvVars!.includes(e.name)
      );
    }

    // Remove blocked env vars
    if (this.sandboxConfig.blockedEnvVars?.length) {
      filtered = filtered.filter(
        (e) => !this.sandboxConfig.blockedEnvVars!.includes(e.name)
      );
    }

    return { success: true, data: filtered };
  }

  /**
   * Find command location
   */
  async which(command: string): Promise<ShellOperationResult<CommandLocation>> {
    const isWindows = process.platform === 'win32';
    const whichCmd = isWindows ? 'where' : 'which';

    try {
      const { stdout, stderr } = await execAsync(`${whichCmd} ${command}`, {
        timeout: 5000,
      });

      if (stderr && !stdout) {
        return {
          success: true,
          data: {
            command,
            path: '',
            exists: false,
            isExecutable: false,
            isBuiltin: false,
          },
        };
      }

      const cmdPath = stdout.trim().split('\n')[0];
      let isExecutable = false;

      try {
        await access(cmdPath, constants.X_OK);
        isExecutable = true;
      } catch {
        isExecutable = false;
      }

      return {
        success: true,
        data: {
          command,
          path: cmdPath,
          exists: true,
          isExecutable,
          isBuiltin: false,
        },
      };
    } catch {
      // Check if it's a shell builtin
      const builtins = ['cd', 'echo', 'exit', 'export', 'source', 'alias', 'type'];
      const isBuiltin = builtins.includes(command);

      return {
        success: true,
        data: {
          command,
          path: '',
          exists: isBuiltin,
          isExecutable: isBuiltin,
          isBuiltin,
        },
      };
    }
  }

  /**
   * Check if command exists
   */
  async commandExists(command: string): Promise<boolean> {
    const result = await this.which(command);
    return result.success && result.data?.exists === true;
  }

  /**
   * Get current working directory
   */
  getCwd(): string {
    return this.defaultCwd;
  }

  /**
   * Get shell name
   */
  getShell(): string {
    return this.defaultShell;
  }

  /**
   * Validate command against sandbox rules
   */
  validateCommand(command: string): ShellOperationResult {
    const baseCommand = this.extractBaseCommand(command);

    // Check blocked commands
    if (this.sandboxConfig.blockedCommands?.includes(baseCommand)) {
      return {
        success: false,
        error: `Command '${baseCommand}' is blocked by sandbox rules`,
      };
    }

    // Check allowed commands (if whitelist is specified)
    if (
      this.sandboxConfig.allowedCommands?.length &&
      !this.sandboxConfig.allowedCommands.includes(baseCommand)
    ) {
      return {
        success: false,
        error: `Command '${baseCommand}' is not in the allowed commands list`,
      };
    }

    // Check blocked patterns
    for (const pattern of this.sandboxConfig.blockedPatterns ?? []) {
      if (pattern.test(command)) {
        return {
          success: false,
          error: `Command matches blocked pattern: ${pattern.toString()}`,
        };
      }
    }

    // Network restriction
    if (!this.sandboxConfig.allowNetwork) {
      const networkCommands = ['curl', 'wget', 'nc', 'netcat', 'telnet', 'ssh', 'scp', 'sftp', 'ftp'];
      if (networkCommands.includes(baseCommand)) {
        return {
          success: false,
          error: `Network command '${baseCommand}' is not allowed in sandbox`,
        };
      }
    }

    // File modification restriction
    if (!this.sandboxConfig.allowFileModification) {
      const fileModCommands = ['touch', 'mkdir', 'mv', 'cp', 'rm', 'rmdir', 'ln'];
      if (fileModCommands.includes(baseCommand)) {
        return {
          success: false,
          error: `File modification command '${baseCommand}' is not allowed in sandbox`,
        };
      }
    }

    // Process management restriction
    if (!this.sandboxConfig.allowProcessManagement) {
      const processCommands = ['kill', 'killall', 'pkill', 'ps', 'top', 'htop', 'bg', 'fg', 'jobs', 'nohup'];
      if (processCommands.includes(baseCommand)) {
        return {
          success: false,
          error: `Process management command '${baseCommand}' is not allowed in sandbox`,
        };
      }
    }

    // Strict mode additional checks
    if (this.sandboxConfig.strictMode) {
      // Disallow command chaining
      if (/[;&|]/.test(command)) {
        return {
          success: false,
          error: 'Command chaining is not allowed in strict mode',
        };
      }

      // Disallow redirections
      if (/[<>]/.test(command)) {
        return {
          success: false,
          error: 'Redirections are not allowed in strict mode',
        };
      }

      // Disallow subshells
      if (/\$\(|`/.test(command)) {
        return {
          success: false,
          error: 'Subshells are not allowed in strict mode',
        };
      }
    }

    return { success: true };
  }

  /**
   * Extract base command from command string
   */
  private extractBaseCommand(command: string): string {
    const trimmed = command.trim();
    const parts = trimmed.split(/\s+/);
    const firstPart = parts[0];

    // Handle env prefix
    if (firstPart === 'env') {
      // Find the actual command after env variables
      for (let i = 1; i < parts.length; i++) {
        if (!parts[i].includes('=')) {
          return path.basename(parts[i]);
        }
      }
    }

    // Handle sudo prefix
    if (firstPart === 'sudo') {
      return parts[1] ? path.basename(parts[1]) : 'sudo';
    }

    return path.basename(firstPart);
  }

  /**
   * Validate working directory
   */
  private validateCwd(cwd: string): ShellOperationResult<string> {
    const resolvedPath = path.resolve(cwd);

    // Check blocked paths
    if (this.sandboxConfig.blockedPaths?.length) {
      for (const blockedPath of this.sandboxConfig.blockedPaths) {
        const resolvedBlocked = path.resolve(blockedPath);
        if (resolvedPath.startsWith(resolvedBlocked)) {
          return {
            success: false,
            error: `Working directory '${cwd}' is in a blocked path`,
          };
        }
      }
    }

    // Check allowed paths (if whitelist is specified)
    if (this.sandboxConfig.allowedPaths?.length) {
      const isAllowed = this.sandboxConfig.allowedPaths.some((allowedPath) => {
        const resolvedAllowed = path.resolve(allowedPath);
        return resolvedPath.startsWith(resolvedAllowed);
      });

      if (!isAllowed) {
        return {
          success: false,
          error: `Working directory '${cwd}' is not in allowed paths`,
        };
      }
    }

    return { success: true, data: resolvedPath };
  }

  /**
   * Build environment for child process
   */
  private buildEnvironment(additionalEnv?: Record<string, string>): Record<string, string> {
    let env: Record<string, string> = {};

    // Start with process.env
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }

    // Add default env
    env = { ...env, ...this.defaultEnv };

    // Add custom env
    for (const [key, value] of this.customEnv) {
      env[key] = value;
    }

    // Add additional env
    if (additionalEnv) {
      env = { ...env, ...additionalEnv };
    }

    // Filter by allowed env vars
    if (this.sandboxConfig.allowedEnvVars?.length) {
      const filtered: Record<string, string> = {};
      for (const key of this.sandboxConfig.allowedEnvVars) {
        if (key in env) {
          filtered[key] = env[key];
        }
      }
      // Always include PATH and HOME
      if (env.PATH) filtered.PATH = env.PATH;
      if (env.HOME) filtered.HOME = env.HOME;
      if (env.USER) filtered.USER = env.USER;
      if (env.SHELL) filtered.SHELL = env.SHELL;
      env = filtered;
    }

    // Remove blocked env vars
    if (this.sandboxConfig.blockedEnvVars?.length) {
      for (const key of this.sandboxConfig.blockedEnvVars) {
        delete env[key];
      }
    }

    return env;
  }

  /**
   * Get sandbox configuration
   */
  getSandboxConfig(): ShellSandboxConfig {
    return { ...this.sandboxConfig };
  }

  /**
   * Update sandbox configuration
   */
  setSandboxConfig(config: ShellSandboxConfig): void {
    this.sandboxConfig = this.initSandboxConfig(config);
  }
}
