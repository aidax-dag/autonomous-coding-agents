/**
 * Tests for Plugin API
 */

import { PluginAPI, createPluginAPI } from '@/core/plugins';

describe('PluginAPI', () => {
  let api: PluginAPI;

  beforeEach(() => {
    api = new PluginAPI();
  });

  describe('getVersion', () => {
    it('should return version 1.0.0', () => {
      expect(api.getVersion()).toBe('1.0.0');
    });
  });

  describe('getCapabilities', () => {
    it('should return the expected capabilities', () => {
      const caps = api.getCapabilities();
      expect(caps).toContain('register-agent');
      expect(caps).toContain('register-skill');
      expect(caps).toContain('register-hook');
      expect(caps).toContain('register-command');
      expect(caps).toHaveLength(4);
    });

    it('should return a new array each time (no mutation risk)', () => {
      const caps1 = api.getCapabilities();
      const caps2 = api.getCapabilities();
      expect(caps1).not.toBe(caps2);
      expect(caps1).toEqual(caps2);
    });
  });

  describe('factory', () => {
    it('should create a PluginAPI via factory', () => {
      const pluginApi = createPluginAPI();
      expect(pluginApi).toBeInstanceOf(PluginAPI);
      expect(pluginApi.getVersion()).toBe('1.0.0');
    });
  });
});
