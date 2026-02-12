/**
 * Tests for Network Isolation
 */

import {
  NetworkIsolation,
  createNetworkIsolation,
} from '@/core/security/network-isolation';

describe('NetworkIsolation', () => {
  let isolation: NetworkIsolation;

  beforeEach(() => {
    isolation = new NetworkIsolation();
  });

  describe('default state', () => {
    it('should not be isolated by default', () => {
      expect(isolation.isIsolated()).toBe(false);
    });

    it('should have no allowed hosts by default', () => {
      expect(isolation.getAllowedHosts()).toEqual([]);
    });
  });

  describe('setIsolated', () => {
    it('should enable isolation', () => {
      isolation.setIsolated(true);
      expect(isolation.isIsolated()).toBe(true);
    });

    it('should disable isolation', () => {
      isolation.setIsolated(true);
      isolation.setIsolated(false);
      expect(isolation.isIsolated()).toBe(false);
    });
  });

  describe('addAllowedHost', () => {
    it('should add a host to the allowed list', () => {
      isolation.addAllowedHost('api.example.com');
      expect(isolation.getAllowedHosts()).toContain('api.example.com');
    });

    it('should normalize host to lowercase', () => {
      isolation.addAllowedHost('API.Example.COM');
      expect(isolation.getAllowedHosts()).toContain('api.example.com');
    });

    it('should throw on empty host', () => {
      expect(() => isolation.addAllowedHost('')).toThrow('cannot be empty');
    });

    it('should not duplicate hosts', () => {
      isolation.addAllowedHost('api.example.com');
      isolation.addAllowedHost('api.example.com');
      expect(isolation.getAllowedHosts()).toHaveLength(1);
    });
  });

  describe('removeAllowedHost', () => {
    it('should remove an existing host', () => {
      isolation.addAllowedHost('api.example.com');
      expect(isolation.removeAllowedHost('api.example.com')).toBe(true);
      expect(isolation.getAllowedHosts()).toEqual([]);
    });

    it('should return false for non-existent host', () => {
      expect(isolation.removeAllowedHost('unknown.com')).toBe(false);
    });

    it('should be case-insensitive', () => {
      isolation.addAllowedHost('api.example.com');
      expect(isolation.removeAllowedHost('API.Example.COM')).toBe(true);
    });
  });

  describe('checkAccess', () => {
    it('should allow all access when not isolated', () => {
      expect(isolation.checkAccess('any-host.com')).toBe(true);
      expect(isolation.checkAccess('another.com')).toBe(true);
    });

    it('should deny non-allowed hosts when isolated', () => {
      isolation.setIsolated(true);
      expect(isolation.checkAccess('blocked.com')).toBe(false);
    });

    it('should allow hosts in the allowed list when isolated', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');
      expect(isolation.checkAccess('api.example.com')).toBe(true);
    });

    it('should be case-insensitive for access checks', () => {
      isolation.setIsolated(true);
      isolation.addAllowedHost('api.example.com');
      expect(isolation.checkAccess('API.Example.COM')).toBe(true);
    });
  });

  describe('constructor with initial isolation', () => {
    it('should accept initial isolated state', () => {
      const isolatedInstance = new NetworkIsolation(true);
      expect(isolatedInstance.isIsolated()).toBe(true);
    });
  });

  describe('factory', () => {
    it('should create a NetworkIsolation via factory with defaults', () => {
      const ni = createNetworkIsolation();
      expect(ni).toBeInstanceOf(NetworkIsolation);
      expect(ni.isIsolated()).toBe(false);
    });

    it('should create an isolated NetworkIsolation via factory', () => {
      const ni = createNetworkIsolation(true);
      expect(ni).toBeInstanceOf(NetworkIsolation);
      expect(ni.isIsolated()).toBe(true);
    });
  });
});
