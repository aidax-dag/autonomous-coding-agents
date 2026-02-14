/**
 * Tests for Windows Sandbox
 *
 * Since tests run on macOS/Linux, we mock process.platform and child_process
 * to simulate a Windows environment.
 */

import {
  WindowsSandbox,
  createWindowsSandbox,
} from '@/core/security/windows-sandbox';
import type { SandboxPolicy } from '@/core/security';

// Mock child_process.execFile
jest.mock('node:child_process', () => ({
  execFile: jest.fn(),
}));

import { execFile } from 'node:child_process';

const mockedExecFile = execFile as jest.MockedFunction<typeof execFile>;

describe('WindowsSandbox', () => {
  let sandbox: WindowsSandbox;

  const defaultPolicy: SandboxPolicy = {
    allowedReadPaths: ['C:\\Users\\dev\\project'],
    allowedWritePaths: ['C:\\Users\\dev\\project\\output'],
    allowNetwork: false,
  };

  beforeEach(() => {
    sandbox = new WindowsSandbox();
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Platform detection
  // ==========================================================================

  describe('getPlatform', () => {
    it('should return windows', () => {
      expect(sandbox.getPlatform()).toBe('windows');
    });
  });

  describe('isAvailable', () => {
    it('should return true when process.platform is win32', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      try {
        expect(sandbox.isAvailable()).toBe(true);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should return false on non-Windows platforms', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

      try {
        expect(sandbox.isAvailable()).toBe(false);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should return boolean based on current platform', () => {
      const result = sandbox.isAvailable();
      expect(typeof result).toBe('boolean');
      if (process.platform === 'win32') {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });

  // ==========================================================================
  // buildEnvironment
  // ==========================================================================

  describe('buildEnvironment', () => {
    it('should set SANDBOX_READ_PATHS from allowedReadPaths', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['SANDBOX_READ_PATHS']).toBe('C:\\Users\\dev\\project');
    });

    it('should set SANDBOX_WRITE_PATHS from allowedWritePaths', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['SANDBOX_WRITE_PATHS']).toBe('C:\\Users\\dev\\project\\output');
    });

    it('should set SANDBOX_NETWORK to 0 when allowNetwork is false', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['SANDBOX_NETWORK']).toBe('0');
    });

    it('should set SANDBOX_NETWORK to 1 when allowNetwork is true', () => {
      const netPolicy: SandboxPolicy = { ...defaultPolicy, allowNetwork: true };
      const env = sandbox.buildEnvironment(netPolicy);
      expect(env['SANDBOX_NETWORK']).toBe('1');
    });

    it('should set SANDBOX_ALLOWED_HOSTS from allowedNetworkHosts', () => {
      const hostPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowNetwork: true,
        allowedNetworkHosts: ['api.example.com', 'db.internal'],
      };
      const env = sandbox.buildEnvironment(hostPolicy);
      expect(env['SANDBOX_ALLOWED_HOSTS']).toBe('api.example.com,db.internal');
    });

    it('should set SANDBOX_MAX_MEMORY_MB and SANDBOX_MAX_CPU_PERCENT', () => {
      const limitPolicy: SandboxPolicy = {
        ...defaultPolicy,
        maxMemoryMB: 1024,
        maxCpuPercent: 50,
      };
      const env = sandbox.buildEnvironment(limitPolicy);
      expect(env['SANDBOX_MAX_MEMORY_MB']).toBe('1024');
      expect(env['SANDBOX_MAX_CPU_PERCENT']).toBe('50');
    });

    it('should omit resource limits when not set', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['SANDBOX_MAX_MEMORY_MB']).toBeUndefined();
      expect(env['SANDBOX_MAX_CPU_PERCENT']).toBeUndefined();
    });

    it('should omit SANDBOX_ALLOWED_HOSTS when not set', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['SANDBOX_ALLOWED_HOSTS']).toBeUndefined();
    });

    it('should join multiple read paths with semicolon', () => {
      const multiPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowedReadPaths: ['C:\\Windows\\System32', 'C:\\Users\\dev\\project'],
      };
      const env = sandbox.buildEnvironment(multiPolicy);
      expect(env['SANDBOX_READ_PATHS']).toBe('C:\\Windows\\System32;C:\\Users\\dev\\project');
    });

    it('should omit SANDBOX_READ_PATHS when empty', () => {
      const emptyPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowedReadPaths: [],
      };
      const env = sandbox.buildEnvironment(emptyPolicy);
      expect(env['SANDBOX_READ_PATHS']).toBeUndefined();
    });

    it('should omit SANDBOX_WRITE_PATHS when empty', () => {
      const emptyPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowedWritePaths: [],
      };
      const env = sandbox.buildEnvironment(emptyPolicy);
      expect(env['SANDBOX_WRITE_PATHS']).toBeUndefined();
    });
  });

  // ==========================================================================
  // buildSandboxScript
  // ==========================================================================

  describe('buildSandboxScript', () => {
    it('should generate a valid PowerShell script', () => {
      const script = sandbox.buildSandboxScript('node', ['app.js'], defaultPolicy);
      expect(script).toContain('$ErrorActionPreference = "Stop"');
      expect(script).toContain('& "node" app.js');
    });

    it('should include command and args in the script', () => {
      const script = sandbox.buildSandboxScript('cmd.exe', ['/c', 'dir'], defaultPolicy);
      expect(script).toContain('& "cmd.exe" /c dir');
    });

    it('should include environment variables from policy', () => {
      const fullPolicy: SandboxPolicy = {
        allowedReadPaths: ['C:\\data'],
        allowedWritePaths: ['C:\\output'],
        allowNetwork: true,
        allowedNetworkHosts: ['api.example.com'],
        maxMemoryMB: 256,
        maxCpuPercent: 75,
      };
      const script = sandbox.buildSandboxScript('test.exe', [], fullPolicy);
      expect(script).toContain('$env:SANDBOX_READ_PATHS = "C:\\data"');
      expect(script).toContain('$env:SANDBOX_WRITE_PATHS = "C:\\output"');
      expect(script).toContain('$env:SANDBOX_NETWORK = "1"');
      expect(script).toContain('$env:SANDBOX_ALLOWED_HOSTS = "api.example.com"');
      expect(script).toContain('$env:SANDBOX_MAX_MEMORY_MB = "256"');
      expect(script).toContain('$env:SANDBOX_MAX_CPU_PERCENT = "75"');
    });

    it('should handle empty paths gracefully', () => {
      const emptyPolicy: SandboxPolicy = {
        allowedReadPaths: [],
        allowedWritePaths: [],
        allowNetwork: false,
      };
      const script = sandbox.buildSandboxScript('test.exe', [], emptyPolicy);
      expect(script).not.toContain('SANDBOX_READ_PATHS');
      expect(script).not.toContain('SANDBOX_WRITE_PATHS');
      expect(script).toContain('$env:SANDBOX_NETWORK = "0"');
    });

    it('should handle command without args', () => {
      const script = sandbox.buildSandboxScript('whoami.exe', [], defaultPolicy);
      expect(script).toContain('& "whoami.exe"');
    });

    it('should handle special characters in paths', () => {
      const specialPolicy: SandboxPolicy = {
        allowedReadPaths: ['C:\\Program Files (x86)\\App'],
        allowedWritePaths: ['C:\\Users\\dev user\\output'],
        allowNetwork: false,
      };
      const script = sandbox.buildSandboxScript('test.exe', [], specialPolicy);
      expect(script).toContain('C:\\Program Files (x86)\\App');
      expect(script).toContain('C:\\Users\\dev user\\output');
    });
  });

  // ==========================================================================
  // execute
  // ==========================================================================

  describe('execute', () => {
    it('should return error result when not on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

      try {
        const result = await sandbox.execute('echo', ['hello'], defaultPolicy);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('only available on Windows');
        expect(result.timedOut).toBe(false);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should call powershell.exe with correct arguments on Windows', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          callback(null, 'output', '');
          return { exitCode: 0, kill: jest.fn() } as any;
        },
      );

      try {
        const result = await sandbox.execute('node', ['app.js'], defaultPolicy);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('output');
        expect(result.stderr).toBe('');
        expect(result.timedOut).toBe(false);

        expect(mockedExecFile).toHaveBeenCalledTimes(1);
        const callArgs = mockedExecFile.mock.calls[0];
        expect(callArgs[0]).toBe('powershell.exe');
        expect(callArgs[1]).toContain('-NoProfile');
        expect(callArgs[1]).toContain('-ExecutionPolicy');
        expect(callArgs[1]).toContain('Bypass');
        expect(callArgs[1]).toContain('-Command');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should capture stdout correctly', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          callback(null, 'hello world\nline two', '');
          return { exitCode: 0, kill: jest.fn() } as any;
        },
      );

      try {
        const result = await sandbox.execute('echo', ['hello'], defaultPolicy);
        expect(result.stdout).toBe('hello world\nline two');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should capture stderr correctly', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          callback(null, '', 'error output');
          return { exitCode: 0, kill: jest.fn() } as any;
        },
      );

      try {
        const result = await sandbox.execute('failing', [], defaultPolicy);
        expect(result.stderr).toBe('error output');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should return non-zero exit code on failure', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          const error = Object.assign(new Error('Process failed'), { code: 42 });
          callback(error, '', 'command not found');
          return { exitCode: 42, kill: jest.fn() } as any;
        },
      );

      try {
        const result = await sandbox.execute('bad-cmd', [], defaultPolicy);
        expect(result.exitCode).toBe(42);
        expect(result.stderr).toBe('command not found');
        expect(result.timedOut).toBe(false);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should handle timeout with timedOut=true', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          const error = Object.assign(new Error('Timed out'), { killed: true });
          callback(error, '', '');
          return { exitCode: null, kill: jest.fn() } as any;
        },
      );

      try {
        const policy: SandboxPolicy = { ...defaultPolicy, timeoutMs: 5000 };
        const result = await sandbox.execute('slow-cmd', [], policy);
        expect(result.timedOut).toBe(true);
        expect(result.exitCode).toBe(1);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should use default timeout when policy.timeoutMs is not set', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          callback(null, 'ok', '');
          return { exitCode: 0, kill: jest.fn() } as any;
        },
      );

      try {
        const noTimeoutPolicy: SandboxPolicy = {
          allowedReadPaths: [],
          allowedWritePaths: [],
          allowNetwork: false,
        };
        await sandbox.execute('cmd', [], noTimeoutPolicy);

        const callArgs = mockedExecFile.mock.calls[0];
        const options = callArgs[2] as { timeout: number };
        expect(options.timeout).toBe(30_000);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should work with empty policy defaults', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          callback(null, 'done', '');
          return { exitCode: 0, kill: jest.fn() } as any;
        },
      );

      try {
        const minimalPolicy: SandboxPolicy = {
          allowedReadPaths: [],
          allowedWritePaths: [],
          allowNetwork: false,
        };
        const result = await sandbox.execute('test', [], minimalPolicy);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('done');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should handle spawn error gracefully', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          const error = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
          callback(error, '', '');
          return { exitCode: null, kill: jest.fn() } as any;
        },
      );

      try {
        const result = await sandbox.execute('nonexistent', [], defaultPolicy);
        expect(result.exitCode).toBe(1);
        expect(result.timedOut).toBe(false);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should handle large output captured correctly', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      const largeOutput = 'x'.repeat(100_000);
      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          callback(null, largeOutput, '');
          return { exitCode: 0, kill: jest.fn() } as any;
        },
      );

      try {
        const result = await sandbox.execute('gen', [], defaultPolicy);
        expect(result.stdout).toBe(largeOutput);
        expect(result.stdout.length).toBe(100_000);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should pass environment variables to the child process', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      mockedExecFile.mockImplementation(
        (_cmd: any, _args: any, _opts: any, callback: any) => {
          callback(null, '', '');
          return { exitCode: 0, kill: jest.fn() } as any;
        },
      );

      try {
        const policy: SandboxPolicy = {
          allowedReadPaths: ['C:\\data'],
          allowedWritePaths: ['C:\\output'],
          allowNetwork: true,
          allowedNetworkHosts: ['example.com'],
          maxMemoryMB: 512,
          maxCpuPercent: 80,
        };
        await sandbox.execute('cmd', [], policy);

        const callArgs = mockedExecFile.mock.calls[0];
        const options = callArgs[2] as { env: Record<string, string> };
        expect(options.env['SANDBOX_READ_PATHS']).toBe('C:\\data');
        expect(options.env['SANDBOX_WRITE_PATHS']).toBe('C:\\output');
        expect(options.env['SANDBOX_NETWORK']).toBe('1');
        expect(options.env['SANDBOX_ALLOWED_HOSTS']).toBe('example.com');
        expect(options.env['SANDBOX_MAX_MEMORY_MB']).toBe('512');
        expect(options.env['SANDBOX_MAX_CPU_PERCENT']).toBe('80');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });
  });

  // ==========================================================================
  // Integration with platform factory
  // ==========================================================================

  describe('integration with platform factory', () => {
    it('should be detected as windows platform on win32', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      try {
        const { detectPlatform } = require('@/core/security/platform-sandbox');
        expect(detectPlatform()).toBe('windows');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should create WindowsSandbox from platform factory on win32', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

      try {
        const { createPlatformSandbox } = require('@/core/security/platform-sandbox');
        const sb = createPlatformSandbox();
        expect(sb).not.toBeNull();
        expect(sb!.getPlatform()).toBe('windows');
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });

    it('should return appropriate sandbox for current platform', () => {
      const { createPlatformSandbox } = require('@/core/security/platform-sandbox');
      const sb = createPlatformSandbox();
      if (process.platform === 'darwin') {
        expect(sb).not.toBeNull();
        expect(sb!.getPlatform()).toBe('macos');
      } else if (process.platform === 'linux') {
        expect(sb).not.toBeNull();
        expect(sb!.getPlatform()).toBe('linux');
      } else if (process.platform === 'win32') {
        expect(sb).not.toBeNull();
        expect(sb!.getPlatform()).toBe('windows');
      }
    });
  });

  // ==========================================================================
  // Factory function
  // ==========================================================================

  describe('factory', () => {
    it('should create a WindowsSandbox via factory', () => {
      const sb = createWindowsSandbox();
      expect(sb).toBeInstanceOf(WindowsSandbox);
      expect(sb.getPlatform()).toBe('windows');
    });
  });
});
