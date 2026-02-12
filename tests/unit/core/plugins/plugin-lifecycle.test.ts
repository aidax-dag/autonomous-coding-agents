/**
 * Tests for Plugin Lifecycle
 */

import {
  Plugin,
  PluginLifecycle,
  createPluginLifecycle,
} from '@/core/plugins';
import type { PluginContext } from '@/core/plugins';

function makePlugin(name: string): Plugin {
  return new Plugin({ name, version: '1.0.0', description: `${name} plugin` });
}

const testContext: PluginContext = {
  workspaceDir: '/tmp/workspace',
  pluginDir: '/tmp/plugins',
};

describe('PluginLifecycle', () => {
  let lifecycle: PluginLifecycle;

  beforeEach(() => {
    lifecycle = new PluginLifecycle();
  });

  describe('initializeAll', () => {
    it('should initialize all plugins successfully', async () => {
      const plugins = [makePlugin('alpha'), makePlugin('beta')];
      const results = await lifecycle.initializeAll(plugins, testContext);

      expect(results.get('alpha')).toBeNull();
      expect(results.get('beta')).toBeNull();
      expect(plugins[0].status).toBe('initialized');
      expect(plugins[1].status).toBe('initialized');
    });

    it('should isolate errors per plugin', async () => {
      const plugins = [makePlugin('good'), makePlugin('bad')];
      // Force 'bad' into a state that prevents initialization
      (plugins[1] as any).status = 'active';

      const results = await lifecycle.initializeAll(plugins, testContext);

      expect(results.get('good')).toBeNull();
      expect(results.get('bad')).toBeInstanceOf(Error);
      expect(plugins[0].status).toBe('initialized');
      expect(plugins[1].status).toBe('error');
    });
  });

  describe('activateAll', () => {
    it('should activate all initialized plugins', async () => {
      const plugins = [makePlugin('alpha'), makePlugin('beta')];
      await lifecycle.initializeAll(plugins, testContext);

      const results = await lifecycle.activateAll(plugins);
      expect(results.get('alpha')).toBeNull();
      expect(results.get('beta')).toBeNull();
      expect(plugins[0].status).toBe('active');
      expect(plugins[1].status).toBe('active');
    });

    it('should report error for plugins not in initialized status', async () => {
      const plugins = [makePlugin('not-initialized')];
      // status is 'loaded', not 'initialized'
      const results = await lifecycle.activateAll(plugins);

      expect(results.get('not-initialized')).toBeInstanceOf(Error);
      expect(plugins[0].status).toBe('error');
    });
  });

  describe('deactivateAll', () => {
    it('should deactivate all active plugins', async () => {
      const plugins = [makePlugin('alpha')];
      await lifecycle.initializeAll(plugins, testContext);
      await lifecycle.activateAll(plugins);

      const results = await lifecycle.deactivateAll(plugins);
      expect(results.get('alpha')).toBeNull();
      expect(plugins[0].status).toBe('initialized');
    });

    it('should report error for plugins not in active status', async () => {
      const plugins = [makePlugin('not-active')];
      const results = await lifecycle.deactivateAll(plugins);

      expect(results.get('not-active')).toBeInstanceOf(Error);
      expect(plugins[0].status).toBe('error');
    });
  });

  describe('disposeAll', () => {
    it('should dispose all plugins regardless of status', async () => {
      const plugins = [makePlugin('alpha'), makePlugin('beta')];
      await lifecycle.initializeAll(plugins, testContext);

      await lifecycle.disposeAll(plugins);
      expect(plugins[0].status).toBe('disposed');
      expect(plugins[1].status).toBe('disposed');
    });

    it('should suppress errors during disposal', async () => {
      const plugin = makePlugin('error-dispose');
      // Override dispose to throw
      plugin.dispose = async () => { throw new Error('disposal failure'); };

      // Should not throw
      await expect(lifecycle.disposeAll([plugin])).resolves.toBeUndefined();
      expect(plugin.status).toBe('error');
    });
  });

  describe('factory', () => {
    it('should create a PluginLifecycle via factory', () => {
      const lc = createPluginLifecycle();
      expect(lc).toBeInstanceOf(PluginLifecycle);
    });
  });
});
