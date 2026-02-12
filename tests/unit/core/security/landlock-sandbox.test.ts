/**
 * Tests for Landlock Sandbox (Linux)
 */

import {
  LandlockSandbox,
  createLandlockSandbox,
} from '@/core/security/landlock-sandbox';
import type { SandboxPolicy } from '@/core/security';

describe('LandlockSandbox', () => {
  let sandbox: LandlockSandbox;

  const defaultPolicy: SandboxPolicy = {
    allowedReadPaths: ['/home/user/project'],
    allowedWritePaths: ['/home/user/project/output'],
    allowNetwork: false,
  };

  beforeEach(() => {
    sandbox = new LandlockSandbox();
  });

  describe('getPlatform', () => {
    it('should return linux', () => {
      expect(sandbox.getPlatform()).toBe('linux');
    });
  });

  describe('isAvailable', () => {
    it('should return boolean based on platform', () => {
      const result = sandbox.isAvailable();
      expect(typeof result).toBe('boolean');
      if (process.platform === 'linux') {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });

  describe('execute', () => {
    it('should return error result when not on Linux', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });

      try {
        const result = await sandbox.execute('echo', ['hello'], defaultPolicy);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('only available on Linux');
        expect(result.timedOut).toBe(false);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });
  });

  describe('buildEnvironment', () => {
    it('should encode read paths into environment', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['LANDLOCK_READ_PATHS']).toBe('/home/user/project');
    });

    it('should encode write paths into environment', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['LANDLOCK_WRITE_PATHS']).toBe('/home/user/project/output');
    });

    it('should encode network flag', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['LANDLOCK_NETWORK']).toBe('0');

      const netPolicy: SandboxPolicy = { ...defaultPolicy, allowNetwork: true };
      const envNet = sandbox.buildEnvironment(netPolicy);
      expect(envNet['LANDLOCK_NETWORK']).toBe('1');
    });

    it('should encode allowed hosts when specified', () => {
      const hostPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowNetwork: true,
        allowedNetworkHosts: ['api.example.com', 'db.internal'],
      };
      const env = sandbox.buildEnvironment(hostPolicy);
      expect(env['LANDLOCK_ALLOWED_HOSTS']).toBe('api.example.com,db.internal');
    });

    it('should encode resource limits when set', () => {
      const limitPolicy: SandboxPolicy = {
        ...defaultPolicy,
        maxMemoryMB: 512,
        maxCpuPercent: 80,
      };
      const env = sandbox.buildEnvironment(limitPolicy);
      expect(env['LANDLOCK_MAX_MEMORY_MB']).toBe('512');
      expect(env['LANDLOCK_MAX_CPU_PERCENT']).toBe('80');
    });

    it('should omit resource limits when not set', () => {
      const env = sandbox.buildEnvironment(defaultPolicy);
      expect(env['LANDLOCK_MAX_MEMORY_MB']).toBeUndefined();
      expect(env['LANDLOCK_MAX_CPU_PERCENT']).toBeUndefined();
    });

    it('should join multiple read paths with colon', () => {
      const multiPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowedReadPaths: ['/usr/lib', '/home/user/project'],
      };
      const env = sandbox.buildEnvironment(multiPolicy);
      expect(env['LANDLOCK_READ_PATHS']).toBe('/usr/lib:/home/user/project');
    });
  });

  describe('factory', () => {
    it('should create a LandlockSandbox via factory', () => {
      const sb = createLandlockSandbox();
      expect(sb).toBeInstanceOf(LandlockSandbox);
      expect(sb.getPlatform()).toBe('linux');
    });
  });
});
