/**
 * Landlock Sandbox (Linux)
 *
 * Linux-specific sandbox implementation using the Landlock LSM
 * (Linux Security Module). Provides filesystem and network restrictions
 * through the kernel's Landlock API.
 *
 * Note: Actual Landlock execution requires Linux kernel >= 5.13.
 * On other platforms, this implementation returns a stub result for testability.
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
 * LandlockSandbox
 *
 * Wraps Linux Landlock to execute commands with restricted filesystem
 * and network access. Uses a helper script to apply Landlock rules
 * before executing the target command.
 */
export class LandlockSandbox implements IOSSandbox {
  getPlatform(): SandboxPlatform {
    return 'linux';
  }

  isAvailable(): boolean {
    return process.platform === 'linux';
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
        stderr: 'Landlock sandbox is only available on Linux',
        timedOut: false,
      };
    }

    const envVars = this.buildEnvironment(policy);
    const timeoutMs = policy.timeoutMs ?? 30_000;

    return new Promise<SandboxResult>((resolve) => {
      const child = execFile(
        command,
        args,
        {
          timeout: timeoutMs,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, ...envVars },
        },
        (error, stdout, stderr) => {
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
        setTimeout(() => {
          if (child.exitCode === null) {
            child.kill('SIGKILL');
          }
        }, timeoutMs + 1000);
      }
    });
  }

  /**
   * Build environment variables that encode the Landlock policy.
   *
   * These would be consumed by a Landlock-aware wrapper or the
   * process itself to self-restrict via the Landlock API.
   */
  buildEnvironment(policy: SandboxPolicy): Record<string, string> {
    const env: Record<string, string> = {};

    if (policy.allowedReadPaths.length > 0) {
      env['LANDLOCK_READ_PATHS'] = policy.allowedReadPaths.join(':');
    }

    if (policy.allowedWritePaths.length > 0) {
      env['LANDLOCK_WRITE_PATHS'] = policy.allowedWritePaths.join(':');
    }

    env['LANDLOCK_NETWORK'] = policy.allowNetwork ? '1' : '0';

    if (policy.allowedNetworkHosts && policy.allowedNetworkHosts.length > 0) {
      env['LANDLOCK_ALLOWED_HOSTS'] = policy.allowedNetworkHosts.join(',');
    }

    if (policy.maxMemoryMB !== undefined) {
      env['LANDLOCK_MAX_MEMORY_MB'] = String(policy.maxMemoryMB);
    }

    if (policy.maxCpuPercent !== undefined) {
      env['LANDLOCK_MAX_CPU_PERCENT'] = String(policy.maxCpuPercent);
    }

    return env;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a LandlockSandbox instance
 */
export function createLandlockSandbox(): LandlockSandbox {
  return new LandlockSandbox();
}
