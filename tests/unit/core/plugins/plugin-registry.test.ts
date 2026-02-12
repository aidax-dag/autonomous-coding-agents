/**
 * Tests for Plugin Registry
 */

import {
  Plugin,
  PluginRegistry,
  createPluginRegistry,
} from '@/core/plugins';
import type { IPlugin } from '@/core/plugins';

function makePlugin(name: string, status?: string): IPlugin {
  const plugin = new Plugin({ name, version: '1.0.0', description: `${name} plugin` });
  if (status) {
    (plugin as any).status = status;
  }
  return plugin;
}

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe('register', () => {
    it('should register a plugin', () => {
      const plugin = makePlugin('alpha');
      registry.register(plugin);
      expect(registry.count()).toBe(1);
    });

    it('should throw on duplicate registration', () => {
      registry.register(makePlugin('alpha'));
      expect(() => registry.register(makePlugin('alpha'))).toThrow("already registered");
    });

    it('should throw when manifest has no name', () => {
      const plugin = new Plugin({ name: '', version: '1.0.0', description: '' });
      (plugin as any).manifest = { name: '', version: '1.0.0' };
      expect(() => registry.register(plugin)).toThrow('must have a manifest with a name');
    });
  });

  describe('unregister', () => {
    it('should remove a registered plugin', () => {
      registry.register(makePlugin('alpha'));
      expect(registry.unregister('alpha')).toBe(true);
      expect(registry.count()).toBe(0);
    });

    it('should return false for unknown plugin', () => {
      expect(registry.unregister('unknown')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return a registered plugin by name', () => {
      const plugin = makePlugin('alpha');
      registry.register(plugin);
      expect(registry.get('alpha')).toBe(plugin);
    });

    it('should return undefined for unknown name', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return all registered plugins', () => {
      registry.register(makePlugin('alpha'));
      registry.register(makePlugin('beta'));
      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(p => p.manifest.name).sort()).toEqual(['alpha', 'beta']);
    });
  });

  describe('getByStatus', () => {
    it('should filter plugins by status', () => {
      registry.register(makePlugin('loaded-1'));
      registry.register(makePlugin('active-1', 'active'));
      registry.register(makePlugin('active-2', 'active'));

      expect(registry.getByStatus('loaded')).toHaveLength(1);
      expect(registry.getByStatus('active')).toHaveLength(2);
      expect(registry.getByStatus('error')).toHaveLength(0);
    });
  });

  describe('count', () => {
    it('should return the number of registered plugins', () => {
      expect(registry.count()).toBe(0);
      registry.register(makePlugin('alpha'));
      expect(registry.count()).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all plugins', () => {
      registry.register(makePlugin('alpha'));
      registry.register(makePlugin('beta'));
      registry.clear();
      expect(registry.count()).toBe(0);
      expect(registry.getAll()).toEqual([]);
    });
  });

  describe('factory', () => {
    it('should create a PluginRegistry via factory', () => {
      const reg = createPluginRegistry();
      expect(reg).toBeInstanceOf(PluginRegistry);
    });
  });
});
