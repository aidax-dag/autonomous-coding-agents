/**
 * Tests for Plugin Loader
 */

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  Plugin,
  PluginLoader,
  createPluginLoader,
} from '@/core/plugins';

describe('PluginLoader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'plugin-loader-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('discover', () => {
    it('should find plugin manifests in subdirectories', async () => {
      const pluginDir = join(tempDir, 'my-plugin');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, 'plugin.json'),
        JSON.stringify({ name: 'my-plugin', version: '1.0.0', description: 'Test plugin' }),
      );

      const loader = new PluginLoader();
      const manifests = await loader.discover(tempDir);

      expect(manifests).toHaveLength(1);
      expect(manifests[0].name).toBe('my-plugin');
      expect(manifests[0].version).toBe('1.0.0');
    });

    it('should return empty array for non-existent directory', async () => {
      const loader = new PluginLoader();
      const manifests = await loader.discover('/non/existent/path');
      expect(manifests).toEqual([]);
    });

    it('should skip directories without valid plugin.json', async () => {
      const noManifest = join(tempDir, 'no-manifest');
      const invalidManifest = join(tempDir, 'invalid');
      await mkdir(noManifest, { recursive: true });
      await mkdir(invalidManifest, { recursive: true });
      await writeFile(join(invalidManifest, 'plugin.json'), '{ broken json');

      const loader = new PluginLoader();
      const manifests = await loader.discover(tempDir);
      expect(manifests).toEqual([]);
    });

    it('should skip manifests missing required fields', async () => {
      const pluginDir = join(tempDir, 'bad-manifest');
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        join(pluginDir, 'plugin.json'),
        JSON.stringify({ name: 'only-name' }), // missing version
      );

      const loader = new PluginLoader();
      const manifests = await loader.discover(tempDir);
      expect(manifests).toEqual([]);
    });
  });

  describe('load', () => {
    it('should create a plugin instance from manifest', async () => {
      const loader = new PluginLoader();
      const manifest = { name: 'test', version: '1.0.0', description: 'A test plugin' };
      const plugin = await loader.load(manifest, tempDir);

      expect(plugin.manifest.name).toBe('test');
      expect(plugin.manifest.version).toBe('1.0.0');
      expect(plugin.status).toBe('loaded');
    });

    it('should throw on invalid manifest', async () => {
      const loader = new PluginLoader();
      const invalid = { name: '', version: '' } as any;
      await expect(loader.load(invalid, tempDir)).rejects.toThrow('Invalid plugin manifest');
    });
  });

  describe('Plugin status transitions', () => {
    it('should transition through the full lifecycle', async () => {
      const plugin = new Plugin({ name: 'lifecycle', version: '1.0.0', description: 'lifecycle test' });
      expect(plugin.status).toBe('loaded');

      await plugin.initialize({ workspaceDir: tempDir, pluginDir: tempDir });
      expect(plugin.status).toBe('initialized');

      await plugin.activate();
      expect(plugin.status).toBe('active');

      await plugin.deactivate();
      expect(plugin.status).toBe('initialized');

      await plugin.dispose();
      expect(plugin.status).toBe('disposed');
    });

    it('should throw when initializing from wrong status', async () => {
      const plugin = new Plugin({ name: 'bad', version: '1.0.0', description: 'test' });
      await plugin.initialize({ workspaceDir: tempDir, pluginDir: tempDir });
      // Already initialized, cannot initialize again
      await expect(
        plugin.initialize({ workspaceDir: tempDir, pluginDir: tempDir }),
      ).rejects.toThrow("expected 'loaded'");
    });

    it('should throw when activating from wrong status', async () => {
      const plugin = new Plugin({ name: 'bad', version: '1.0.0', description: 'test' });
      // Not initialized yet
      await expect(plugin.activate()).rejects.toThrow("expected 'initialized'");
    });

    it('should throw when deactivating from wrong status', async () => {
      const plugin = new Plugin({ name: 'bad', version: '1.0.0', description: 'test' });
      // Not active
      await expect(plugin.deactivate()).rejects.toThrow("expected 'active'");
    });
  });

  describe('factory', () => {
    it('should create a PluginLoader via factory', () => {
      const loader = createPluginLoader();
      expect(loader).toBeInstanceOf(PluginLoader);
    });
  });
});
