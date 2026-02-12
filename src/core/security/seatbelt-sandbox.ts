/**
 * Seatbelt Sandbox (macOS)
 *
 * macOS-specific sandbox implementation using the Seatbelt (sandbox-exec)
 * framework. Provides filesystem and network restrictions through
 * Apple's sandbox profiles.
 *
 * Note: Actual Seatbelt execution requires macOS. On other platforms,
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
 * SeatbeltSandbox
 *
 * Wraps macOS sandbox-exec to execute commands within a Seatbelt sandbox
 * profile generated from the provided policy.
 */
export class SeatbeltSandbox implements IOSSandbox {
  getPlatform(): SandboxPlatform {
    return 'macos';
  }

  isAvailable(): boolean {
    return process.platform === 'darwin';
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
        stderr: 'Seatbelt sandbox is only available on macOS',
        timedOut: false,
      };
    }

    const profile = this.generateProfile(policy);
    const timeoutMs = policy.timeoutMs ?? 30_000;

    return new Promise<SandboxResult>((resolve) => {
      const sandboxArgs = ['-p', profile, command, ...args];

      const child = execFile(
        '/usr/bin/sandbox-exec',
        sandboxArgs,
        { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
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
   * Generate a Seatbelt profile string from a SandboxPolicy.
   *
   * Produces a Scheme-like profile consumed by sandbox-exec.
   */
  generateProfile(policy: SandboxPolicy): string {
    const rules: string[] = ['(version 1)', '(deny default)'];

    // Allow reading specified paths
    for (const readPath of policy.allowedReadPaths) {
      rules.push(`(allow file-read* (subpath "${readPath}"))`);
    }

    // Allow writing specified paths
    for (const writePath of policy.allowedWritePaths) {
      rules.push(`(allow file-write* (subpath "${writePath}"))`);
    }

    // Network access
    if (policy.allowNetwork) {
      if (policy.allowedNetworkHosts && policy.allowedNetworkHosts.length > 0) {
        for (const host of policy.allowedNetworkHosts) {
          rules.push(`(allow network* (remote tcp "${host}:*"))`);
        }
      } else {
        rules.push('(allow network*)');
      }
    }

    // Allow process execution
    rules.push('(allow process-exec*)');
    rules.push('(allow process-fork)');

    return rules.join('\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a SeatbeltSandbox instance
 */
export function createSeatbeltSandbox(): SeatbeltSandbox {
  return new SeatbeltSandbox();
}
