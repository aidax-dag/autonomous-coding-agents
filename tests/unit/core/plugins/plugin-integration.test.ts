/**
 * Integration tests for the Plugin Module
 *
 * Tests the full plugin lifecycle: discover -> load -> register ->
 * initialize -> activate -> deactivate -> dispose
 */

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  PluginLoader,
  PluginRegistry,
  PluginLifecycle,
  PluginAPI,
} from '@/core/plugins';
import type { PluginContext } from '@/core/plugins';

describe('Plugin System Integration', () => {
  let tempDir: string;
  let pluginDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'plugin-int-test-'));
    pluginDir = join(tempDir, 'plugins');
    await mkdir(pluginDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should run the full discover -> load -> register -> lifecycle flow', async () => {
    // Setup: create plugin manifests on disk
    const pluginADir = join(pluginDir, 'plugin-a');
    const pluginBDir = join(pluginDir, 'plugin-b');
    await mkdir(pluginADir);
    await mkdir(pluginBDir);
    await writeFile(
      join(pluginADir, 'plugin.json'),
      JSON.stringify({ name: 'plugin-a', version: '1.0.0', description: 'Plugin A' }),
    );
    await writeFile(
      join(pluginBDir, 'plugin.json'),
      JSON.stringify({ name: 'plugin-b', version: '2.0.0', description: 'Plugin B' }),
    );

    const loader = new PluginLoader();
    const registry = new PluginRegistry();
    const lifecycle = new PluginLifecycle();
    const api = new PluginAPI();

    // 1. Discover
    const manifests = await loader.discover(pluginDir);
    expect(manifests).toHaveLength(2);

    // 2. Load
    const plugins = await Promise.all(
      manifests.map(m => loader.load(m, join(pluginDir, m.name))),
    );
    expect(plugins).toHaveLength(2);
    expect(plugins.every(p => p.status === 'loaded')).toBe(true);

    // 3. Register
    for (const plugin of plugins) {
      registry.register(plugin);
    }
    expect(registry.count()).toBe(2);

    // 4. Initialize
    const context: PluginContext = { workspaceDir: tempDir, pluginDir };
    const initResults = await lifecycle.initializeAll(plugins, context);
    expect(initResults.get('plugin-a')).toBeNull();
    expect(initResults.get('plugin-b')).toBeNull();
    expect(registry.getByStatus('initialized')).toHaveLength(2);

    // 5. Activate
    const activateResults = await lifecycle.activateAll(plugins);
    expect(activateResults.get('plugin-a')).toBeNull();
    expect(activateResults.get('plugin-b')).toBeNull();
    expect(registry.getByStatus('active')).toHaveLength(2);

    // Verify API is accessible
    expect(api.getVersion()).toBe('1.0.0');
    expect(api.getCapabilities().length).toBeGreaterThan(0);

    // 6. Deactivate
    const deactivateResults = await lifecycle.deactivateAll(plugins);
    expect(deactivateResults.get('plugin-a')).toBeNull();
    expect(deactivateResults.get('plugin-b')).toBeNull();

    // 7. Dispose
    await lifecycle.disposeAll(plugins);
    expect(plugins.every(p => p.status === 'disposed')).toBe(true);
  });

  it('should handle partial failures during lifecycle', async () => {
    const pluginADir = join(pluginDir, 'plugin-good');
    await mkdir(pluginADir);
    await writeFile(
      join(pluginADir, 'plugin.json'),
      JSON.stringify({ name: 'plugin-good', version: '1.0.0', description: 'Good plugin' }),
    );

    const loader = new PluginLoader();
    const lifecycle = new PluginLifecycle();

    const manifests = await loader.discover(pluginDir);
    const plugins = await Promise.all(
      manifests.map(m => loader.load(m, join(pluginDir, m.name))),
    );

    // Create a second plugin that will fail initialization
    const badManifest = { name: 'plugin-bad', version: '1.0.0', description: 'Bad plugin' };
    const badPlugin = await loader.load(badManifest, pluginDir);
    // Break it by setting wrong status
    (badPlugin as any).status = 'active';
    plugins.push(badPlugin);

    const context: PluginContext = { workspaceDir: tempDir, pluginDir };
    const results = await lifecycle.initializeAll(plugins, context);

    // Good plugin succeeds, bad plugin fails
    expect(results.get('plugin-good')).toBeNull();
    expect(results.get('plugin-bad')).toBeInstanceOf(Error);
    expect(plugins[0].status).toBe('initialized');
    expect(plugins[1].status).toBe('error');
  });

  it('should discover zero plugins in an empty directory', async () => {
    const loader = new PluginLoader();
    const manifests = await loader.discover(pluginDir);
    expect(manifests).toEqual([]);
  });

  it('should support register then unregister workflow', async () => {
    const loader = new PluginLoader();
    const registry = new PluginRegistry();

    const manifest = { name: 'temp-plugin', version: '1.0.0', description: 'Temporary' };
    const plugin = await loader.load(manifest, pluginDir);

    registry.register(plugin);
    expect(registry.count()).toBe(1);
    expect(registry.get('temp-plugin')).toBe(plugin);

    registry.unregister('temp-plugin');
    expect(registry.count()).toBe(0);
    expect(registry.get('temp-plugin')).toBeUndefined();
  });

  it('should query plugins by status throughout lifecycle', async () => {
    const loader = new PluginLoader();
    const registry = new PluginRegistry();
    const lifecycle = new PluginLifecycle();

    const plugin = await loader.load(
      { name: 'status-track', version: '1.0.0', description: 'Status tracking' },
      pluginDir,
    );
    registry.register(plugin);

    expect(registry.getByStatus('loaded')).toHaveLength(1);
    expect(registry.getByStatus('active')).toHaveLength(0);

    const context: PluginContext = { workspaceDir: tempDir, pluginDir };
    await lifecycle.initializeAll([plugin], context);
    expect(registry.getByStatus('initialized')).toHaveLength(1);

    await lifecycle.activateAll([plugin]);
    expect(registry.getByStatus('active')).toHaveLength(1);
    expect(registry.getByStatus('loaded')).toHaveLength(0);
  });
});
