/**
 * Security Audit: Network Isolation
 *
 * Validates security properties of the network isolation system.
 * Tests focus on isolation enforcement, bypass prevention, and
 * defense-in-depth for network access control.
 *
 * @module tests/unit/core/security/security-audit-network
 */

import {
  NetworkIsolation,
  createNetworkIsolation,
} from '../../../../src/core/security/network-isolation';

describe('Security Audit: Network Isolation', () => {
  let isolation: NetworkIsolation;

  beforeEach(() => {
    isolation = new NetworkIsolation();
  });

  // ==========================================================================
  // Isolation Mode Enforcement
  // ==========================================================================

  describe('isolation mode blocks all non-whitelisted access', () => {
    it('should block all hosts when isolated with empty allowlist', () => {
      isolation.setIsolated(true);
      expect(isolation.checkAccess('api.example.com')).toBe(false);
      expect(isolation.checkAccess('google.com')).toBe(false);
      expect(isolation.checkAccess('internal.corp.net')).toBe(false);
    });

    it('should only allow explicitly whitelisted hosts when isolated', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');

      expect(isolation.checkAccess('api.example.com')).toBe(true);
      expect(isolation.checkAccess('evil.example.com')).toBe(false);
      expect(isolation.checkAccess('example.com')).toBe(false);
    });

    it('should not allow subdomain bypass of whitelisted hosts', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');

      // Subdomains should NOT match the parent
      expect(isolation.checkAccess('evil.api.example.com')).toBe(false);
      // Parent domain should NOT match subdomain
      expect(isolation.checkAccess('example.com')).toBe(false);
    });
  });

  // ==========================================================================
  // Non-Isolated Mode
  // ==========================================================================

  describe('non-isolated mode allows all traffic', () => {
    it('should allow all hosts when not isolated', () => {
      expect(isolation.isIsolated()).toBe(false);
      expect(isolation.checkAccess('any-host.com')).toBe(true);
      expect(isolation.checkAccess('malicious-site.evil')).toBe(true);
    });

    it('should allow all hosts even with allowlist configured but isolation disabled', () => {
      isolation.addAllowedHost('api.example.com');
      // Still not isolated, so all should pass
      expect(isolation.checkAccess('other-host.com')).toBe(true);
    });
  });

  // ==========================================================================
  // localhost / Loopback Handling
  // ==========================================================================

  describe('localhost and loopback address handling', () => {
    it('should block localhost when isolated and not in allowlist', () => {
      isolation.setIsolated(true);
      expect(isolation.checkAccess('localhost')).toBe(false);
    });

    it('should block 127.0.0.1 when isolated and not in allowlist', () => {
      isolation.setIsolated(true);
      expect(isolation.checkAccess('127.0.0.1')).toBe(false);
    });

    it('should allow localhost when explicitly whitelisted', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('localhost');
      expect(isolation.checkAccess('localhost')).toBe(true);
    });

    it('should allow 127.0.0.1 when explicitly whitelisted', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('127.0.0.1');
      expect(isolation.checkAccess('127.0.0.1')).toBe(true);
    });

    it('should treat localhost and 127.0.0.1 as separate hosts', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('localhost');
      // Adding localhost should not automatically allow 127.0.0.1
      expect(isolation.checkAccess('127.0.0.1')).toBe(false);
    });
  });

  // ==========================================================================
  // Case Sensitivity Bypass Prevention
  // ==========================================================================

  describe('case normalization prevents bypass', () => {
    it('should normalize host to lowercase on add', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('API.EXAMPLE.COM');
      expect(isolation.checkAccess('api.example.com')).toBe(true);
    });

    it('should normalize host to lowercase on check', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');
      expect(isolation.checkAccess('API.EXAMPLE.COM')).toBe(true);
      expect(isolation.checkAccess('Api.Example.Com')).toBe(true);
    });

    it('should normalize host to lowercase on remove', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');
      expect(isolation.removeAllowedHost('API.EXAMPLE.COM')).toBe(true);
      expect(isolation.checkAccess('api.example.com')).toBe(false);
    });
  });

  // ==========================================================================
  // Input Validation
  // ==========================================================================

  describe('input validation prevents bad state', () => {
    it('should reject empty string host addition', () => {
      expect(() => isolation.addAllowedHost('')).toThrow();
    });

    it('should not allow duplicate hosts in allowlist', () => {
      isolation.addAllowedHost('api.example.com');
      isolation.addAllowedHost('api.example.com');
      expect(isolation.getAllowedHosts()).toHaveLength(1);
    });

    it('should not allow case-variant duplicates in allowlist', () => {
      isolation.addAllowedHost('api.example.com');
      isolation.addAllowedHost('API.EXAMPLE.COM');
      expect(isolation.getAllowedHosts()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // State Transitions
  // ==========================================================================

  describe('isolation state transitions', () => {
    it('should immediately enforce isolation when toggled on', () => {
      isolation.addAllowedHost('api.example.com');
      expect(isolation.checkAccess('other.com')).toBe(true); // not isolated

      isolation.setIsolated(true);
      expect(isolation.checkAccess('other.com')).toBe(false); // now isolated
      expect(isolation.checkAccess('api.example.com')).toBe(true); // whitelisted
    });

    it('should immediately stop enforcement when toggled off', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');
      expect(isolation.checkAccess('blocked.com')).toBe(false); // isolated

      isolation.setIsolated(false);
      expect(isolation.checkAccess('blocked.com')).toBe(true); // no longer isolated
    });

    it('should preserve allowlist when toggling isolation on and off', () => {
      isolation.addAllowedHost('api.example.com');
      isolation.setIsolated(true);
      isolation.setIsolated(false);
      isolation.setIsolated(true);

      // Allowlist should still contain the host
      expect(isolation.getAllowedHosts()).toContain('api.example.com');
      expect(isolation.checkAccess('api.example.com')).toBe(true);
    });
  });

  // ==========================================================================
  // Host Removal Security
  // ==========================================================================

  describe('host removal enforces access control immediately', () => {
    it('should deny access after host is removed from allowlist', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');
      expect(isolation.checkAccess('api.example.com')).toBe(true);

      isolation.removeAllowedHost('api.example.com');
      expect(isolation.checkAccess('api.example.com')).toBe(false);
    });

    it('should return false when removing a host that was never added', () => {
      expect(isolation.removeAllowedHost('never-added.com')).toBe(false);
    });
  });

  // ==========================================================================
  // Factory Function Security
  // ==========================================================================

  describe('factory creates properly configured instances', () => {
    it('should create a non-isolated instance by default', () => {
      const ni = createNetworkIsolation();
      expect(ni.isIsolated()).toBe(false);
    });

    it('should create an isolated instance when requested', () => {
      const ni = createNetworkIsolation(true);
      expect(ni.isIsolated()).toBe(true);
      // Should block all by default
      expect(ni.checkAccess('any.host.com')).toBe(false);
    });
  });
});
