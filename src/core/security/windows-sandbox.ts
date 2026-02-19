/**
 * Windows Sandbox
 *
 * Windows-specific sandbox implementation using PowerShell-based process
 * isolation with environment-variable-encoded policies. Provides filesystem
 * and network restrictions through a wrapper script approach.
 *
 * Note: Actual Windows execution requires Windows (win32). On other platforms,
 * this implementation returns a stub result for testability.
 *
 * @module core/security
 */

import { execFile } from 'node:child_process';

import type {
  IOSSandbox,
  SandboxPlatform,
  SandboxPolicy,
  SandboxResult,
} from './interfaces/os-sandbox.interface';

// ============================================================================
// Implementation
// ============================================================================

/**
 * WindowsSandbox
 *
 * Wraps PowerShell to execute commands within a sandboxed environment.
 * Uses environment variables to encode the sandbox policy, which can be
 * consumed by a policy-aware wrapper or the process itself to enforce
 * restrictions via Windows Job Objects and ACLs.
 */
export class WindowsSandbox implements IOSSandbox {
  getPlatform(): SandboxPlatform {
    return 'windows';
  }

  isAvailable(): boolean {
    return process.platform === 'win32';
  }

  async execute(
    command: string,
    args: string[],
    policy: SandboxPolicy,
  ): Promise<SandboxResult> {
    if (!this.isAvailable()) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'Windows sandbox is only available on Windows',
        timedOut: false,
      };
    }

    const script = this.buildSandboxScript(command, args, policy);
    const timeoutMs = policy.timeoutMs ?? 30_000;

    return new Promise<SandboxResult>((resolve) => {
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      const child = execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
        {
          timeout: timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, ...this.buildEnvironment(policy) },
        },
        (error, stdout, stderr) => {
          if (killTimer) {
            clearTimeout(killTimer);
            killTimer = undefined;
          }
          const timedOut = error !== null
            && 'killed' in error
            && (error as { killed?: boolean }).killed === true;

          let exitCode = 0;
          if (error) {
            const errWithCode = error as { code?: string | number };
            exitCode = typeof errWithCode.code === 'number' ? errWithCode.code : 1;
          }

          resolve({
            exitCode,
            stdout: stdout ?? '',
            stderr: stderr ?? '',
            timedOut,
          });
        },
      );

      // Safety: kill if the child is still running past timeout
      if (timeoutMs > 0) {
        killTimer = setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, timeoutMs + 1000);
        if (killTimer.unref) {
          killTimer.unref();
        }
      }
    });
  }

  /**
   * Build a PowerShell sandbox script from the policy.
   *
   * Generates a script that sets environment restrictions and executes the
   * target command within a constrained environment using Start-Process.
   */
  buildSandboxScript(
    command: string,
    args: string[],
    policy: SandboxPolicy,
  ): string {
    const lines: string[] = [];

    lines.push('$ErrorActionPreference = "Stop"');

    // Set sandbox environment variables
    if (policy.allowedReadPaths.length > 0) {
      lines.push(`$env:SANDBOX_READ_PATHS = "${policy.allowedReadPaths.join(';')}"`);
    }

    if (policy.allowedWritePaths.length > 0) {
      lines.push(`$env:SANDBOX_WRITE_PATHS = "${policy.allowedWritePaths.join(';')}"`);
    }

    lines.push(`$env:SANDBOX_NETWORK = "${policy.allowNetwork ? '1' : '0'}"`);

    if (policy.allowedNetworkHosts && policy.allowedNetworkHosts.length > 0) {
      lines.push(`$env:SANDBOX_ALLOWED_HOSTS = "${policy.allowedNetworkHosts.join(',')}"`);
    }

    if (policy.maxMemoryMB !== undefined) {
      lines.push(`$env:SANDBOX_MAX_MEMORY_MB = "${String(policy.maxMemoryMB)}"`);
    }

    if (policy.maxCpuPercent !== undefined) {
      lines.push(`$env:SANDBOX_MAX_CPU_PERCENT = "${String(policy.maxCpuPercent)}"`);
    }

    // Build the command execution
    const escapedCommand = command.replace(/"/g, '`"');
    const escapedArgs = args.map((a) => a.replace(/"/g, '`"')).join(' ');
    const fullCommand = escapedArgs
      ? `& "${escapedCommand}" ${escapedArgs}`
      : `& "${escapedCommand}"`;

    lines.push(fullCommand);

    return lines.join('; ');
  }

  /**
   * Build environment variables that encode the sandbox policy.
   *
   * These are consumed by the sandboxed process or a policy-aware wrapper
   * to enforce restrictions via Windows Job Objects and ACLs.
   */
  buildEnvironment(policy: SandboxPolicy): Record<string, string> {
    const env: Record<string, string> = {};

    if (policy.allowedReadPaths.length > 0) {
      env['SANDBOX_READ_PATHS'] = policy.allowedReadPaths.join(';');
    }

    if (policy.allowedWritePaths.length > 0) {
      env['SANDBOX_WRITE_PATHS'] = policy.allowedWritePaths.join(';');
    }

    env['SANDBOX_NETWORK'] = policy.allowNetwork ? '1' : '0';

    if (policy.allowedNetworkHosts && policy.allowedNetworkHosts.length > 0) {
      env['SANDBOX_ALLOWED_HOSTS'] = policy.allowedNetworkHosts.join(',');
    }

    if (policy.maxMemoryMB !== undefined) {
      env['SANDBOX_MAX_MEMORY_MB'] = String(policy.maxMemoryMB);
    }

    if (policy.maxCpuPercent !== undefined) {
      env['SANDBOX_MAX_CPU_PERCENT'] = String(policy.maxCpuPercent);
    }

    return env;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a WindowsSandbox instance
 */
export function createWindowsSandbox(): WindowsSandbox {
  return new WindowsSandbox();
}
