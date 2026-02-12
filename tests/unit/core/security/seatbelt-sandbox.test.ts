/**
 * Tests for Seatbelt Sandbox (macOS)
 */

import {
  SeatbeltSandbox,
  createSeatbeltSandbox,
} from '@/core/security/seatbelt-sandbox';
import type { SandboxPolicy } from '@/core/security';

describe('SeatbeltSandbox', () => {
  let sandbox: SeatbeltSandbox;

  const defaultPolicy: SandboxPolicy = {
    allowedReadPaths: ['/tmp'],
    allowedWritePaths: ['/tmp/output'],
    allowNetwork: false,
  };

  beforeEach(() => {
    sandbox = new SeatbeltSandbox();
  });

  describe('getPlatform', () => {
    it('should return macos', () => {
      expect(sandbox.getPlatform()).toBe('macos');
    });
  });

  describe('isAvailable', () => {
    it('should return boolean based on platform', () => {
      const result = sandbox.isAvailable();
      expect(typeof result).toBe('boolean');
      // On macOS it should be true, elsewhere false
      if (process.platform === 'darwin') {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });

  describe('execute', () => {
    it('should return error result when not on macOS', async () => {
      // Mock process.platform to simulate non-macOS
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });

      try {
        const result = await sandbox.execute('echo', ['hello'], defaultPolicy);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('only available on macOS');
        expect(result.timedOut).toBe(false);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      }
    });
  });

  describe('generateProfile', () => {
    it('should generate a profile with read paths', () => {
      const profile = sandbox.generateProfile(defaultPolicy);
      expect(profile).toContain('(version 1)');
      expect(profile).toContain('(deny default)');
      expect(profile).toContain('(allow file-read* (subpath "/tmp"))');
    });

    it('should include write paths', () => {
      const profile = sandbox.generateProfile(defaultPolicy);
      expect(profile).toContain('(allow file-write* (subpath "/tmp/output"))');
    });

    it('should include network access when allowed', () => {
      const netPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowNetwork: true,
      };
      const profile = sandbox.generateProfile(netPolicy);
      expect(profile).toContain('(allow network*)');
    });

    it('should restrict network to specific hosts when specified', () => {
      const hostPolicy: SandboxPolicy = {
        ...defaultPolicy,
        allowNetwork: true,
        allowedNetworkHosts: ['api.example.com'],
      };
      const profile = sandbox.generateProfile(hostPolicy);
      expect(profile).toContain('api.example.com');
      // Should NOT contain unrestricted network
      const lines = profile.split('\n');
      const unrestrictedNetworkLine = lines.find(
        l => l.trim() === '(allow network*)',
      );
      expect(unrestrictedNetworkLine).toBeUndefined();
    });

    it('should not include network rules when network is denied', () => {
      const profile = sandbox.generateProfile(defaultPolicy);
      expect(profile).not.toContain('(allow network');
    });
  });

  describe('factory', () => {
    it('should create a SeatbeltSandbox via factory', () => {
      const sb = createSeatbeltSandbox();
      expect(sb).toBeInstanceOf(SeatbeltSandbox);
      expect(sb.getPlatform()).toBe('macos');
    });
  });
});
