/**
 * Tests for Plugin Marketplace
 *
 * Covers PluginPackager and MarketplaceRegistry with comprehensive
 * validation, packaging, publishing, search, install, and lifecycle tests.
 */

import {
  PluginPackager,
  createPluginPackager,
  MarketplaceRegistry,
  createMarketplaceRegistry,
} from '@/core/plugins/marketplace';
import type {
  PluginManifestData,
  PackageFile,
  PluginPackage,
} from '@/core/plugins/marketplace';

jest.mock('../../../../../src/shared/logging/logger', () => ({
  createAgentLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ============================================================================
// Helpers
// ============================================================================

function validManifest(overrides: Partial<PluginManifestData> = {}): PluginManifestData {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'tester',
    license: 'MIT',
    keywords: ['test', 'example'],
    main: 'index.js',
    dependencies: {},
    acaVersion: '0.1.0',
    ...overrides,
  };
}

function validFiles(mainPath = 'index.js'): PackageFile[] {
  return [
    { path: mainPath, content: 'module.exports = {}', size: 20 },
    { path: 'README.md', content: '# Plugin', size: 10 },
  ];
}

function publishTestPlugin(
  registry: MarketplaceRegistry,
  packager: PluginPackager,
  overrides: Partial<PluginManifestData> = {},
): PluginPackage {
  const manifest = validManifest(overrides);
  const pkg = packager.pack(manifest, validFiles(manifest.main));
  registry.publish(pkg);
  return pkg;
}

// ============================================================================
// PluginPackager
// ============================================================================

describe('PluginPackager', () => {
  let packager: PluginPackager;

  beforeEach(() => {
    packager = new PluginPackager();
  });

  // --------------------------------------------------------------------------
  // validateManifest
  // --------------------------------------------------------------------------

  describe('validateManifest', () => {
    it('should return no errors for a valid manifest', () => {
      const errors = packager.validateManifest(validManifest());
      expect(errors).toEqual([]);
    });

    it('should detect missing name', () => {
      const errors = packager.validateManifest(validManifest({ name: '' }));
      expect(errors).toContain('Missing required field: name');
    });

    it('should detect missing version', () => {
      const errors = packager.validateManifest(validManifest({ version: '' }));
      expect(errors).toContain('Missing required field: version');
    });

    it('should detect missing description', () => {
      const errors = packager.validateManifest(validManifest({ description: '' }));
      expect(errors).toContain('Missing required field: description');
    });

    it('should detect missing author', () => {
      const errors = packager.validateManifest(validManifest({ author: '' }));
      expect(errors).toContain('Missing required field: author');
    });

    it('should detect missing main', () => {
      const errors = packager.validateManifest(validManifest({ main: '' }));
      expect(errors).toContain('Missing required field: main');
    });

    it('should detect missing acaVersion', () => {
      const errors = packager.validateManifest(validManifest({ acaVersion: '' }));
      expect(errors).toContain('Missing required field: acaVersion');
    });

    it('should detect invalid version format', () => {
      const errors = packager.validateManifest(validManifest({ version: 'not-semver' }));
      expect(errors).toContain('Invalid version format (expected semver)');
    });

    it('should accept valid semver versions', () => {
      const errors = packager.validateManifest(validManifest({ version: '2.3.4' }));
      expect(errors).toEqual([]);
    });

    it('should accept semver with prerelease suffix', () => {
      const errors = packager.validateManifest(validManifest({ version: '1.0.0-beta.1' }));
      expect(errors).toEqual([]);
    });

    it('should detect invalid plugin name format', () => {
      const errors = packager.validateManifest(validManifest({ name: 'Invalid-Name' }));
      expect(errors).toContain('Invalid plugin name (lowercase alphanumeric with hyphens)');
    });

    it('should detect name starting with number', () => {
      const errors = packager.validateManifest(validManifest({ name: '1bad' }));
      expect(errors).toContain('Invalid plugin name (lowercase alphanumeric with hyphens)');
    });

    it('should accept valid hyphenated name', () => {
      const errors = packager.validateManifest(validManifest({ name: 'my-cool-plugin' }));
      expect(errors).toEqual([]);
    });

    it('should accumulate multiple errors', () => {
      const errors = packager.validateManifest(
        validManifest({ name: '', version: '', author: '' }),
      );
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // --------------------------------------------------------------------------
  // pack
  // --------------------------------------------------------------------------

  describe('pack', () => {
    it('should create a valid package from manifest and files', () => {
      const manifest = validManifest();
      const files = validFiles();
      const pkg = packager.pack(manifest, files);

      expect(pkg.manifest).toBe(manifest);
      expect(pkg.files).toBe(files);
      expect(pkg.size).toBe(30); // 20 + 10
      expect(pkg.checksum).toBeDefined();
      expect(typeof pkg.checksum).toBe('string');
      expect(pkg.createdAt).toBeDefined();
    });

    it('should throw when manifest is invalid', () => {
      const manifest = validManifest({ name: '' });
      expect(() => packager.pack(manifest, validFiles())).toThrow('Invalid manifest');
    });

    it('should throw when main entry file is missing from files', () => {
      const manifest = validManifest({ main: 'missing.js' });
      const files = validFiles('index.js'); // does not include missing.js
      expect(() => packager.pack(manifest, files)).toThrow(
        "Main entry file 'missing.js' not found in package files",
      );
    });

    it('should compute correct total size', () => {
      const manifest = validManifest();
      const files: PackageFile[] = [
        { path: 'index.js', content: 'a', size: 100 },
        { path: 'lib.js', content: 'b', size: 200 },
        { path: 'util.js', content: 'c', size: 300 },
      ];
      const pkg = packager.pack(manifest, files);
      expect(pkg.size).toBe(600);
    });

    it('should emit packed event', () => {
      const handler = jest.fn();
      packager.on('packed', handler);

      const manifest = validManifest();
      packager.pack(manifest, validFiles());

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        name: 'test-plugin',
        version: '1.0.0',
        size: 30,
      });
    });

    it('should produce deterministic checksums for identical inputs', () => {
      const manifest = validManifest();
      const files = validFiles();

      const pkg1 = packager.pack(manifest, files);
      const pkg2 = packager.pack(manifest, files);

      expect(pkg1.checksum).toBe(pkg2.checksum);
    });
  });

  // --------------------------------------------------------------------------
  // verifyPackage
  // --------------------------------------------------------------------------

  describe('verifyPackage', () => {
    it('should return true for an unmodified package', () => {
      const pkg = packager.pack(validManifest(), validFiles());
      expect(packager.verifyPackage(pkg)).toBe(true);
    });

    it('should return false when package files are tampered with', () => {
      const pkg = packager.pack(validManifest(), validFiles());

      // Tamper with file content
      const tampered: PluginPackage = {
        ...pkg,
        files: [
          { path: 'index.js', content: 'TAMPERED', size: 999 },
          ...pkg.files.slice(1),
        ],
      };

      expect(packager.verifyPackage(tampered)).toBe(false);
    });

    it('should return false when manifest is tampered with', () => {
      const pkg = packager.pack(validManifest(), validFiles());

      const tampered: PluginPackage = {
        ...pkg,
        manifest: { ...pkg.manifest, version: '9.9.9' },
      };

      expect(packager.verifyPackage(tampered)).toBe(false);
    });

    it('should return false when checksum is corrupted', () => {
      const pkg = packager.pack(validManifest(), validFiles());

      const tampered: PluginPackage = {
        ...pkg,
        checksum: 'deadbeef',
      };

      expect(packager.verifyPackage(tampered)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Factory
  // --------------------------------------------------------------------------

  describe('factory', () => {
    it('should create a PluginPackager via createPluginPackager', () => {
      const p = createPluginPackager();
      expect(p).toBeInstanceOf(PluginPackager);
    });
  });
});

// ============================================================================
// MarketplaceRegistry
// ============================================================================

describe('MarketplaceRegistry', () => {
  let registry: MarketplaceRegistry;
  let packager: PluginPackager;

  beforeEach(() => {
    registry = new MarketplaceRegistry();
    packager = new PluginPackager();
  });

  afterEach(() => {
    registry.dispose();
  });

  // --------------------------------------------------------------------------
  // publish
  // --------------------------------------------------------------------------

  describe('publish', () => {
    it('should publish a plugin successfully', () => {
      const pkg = packager.pack(validManifest(), validFiles());
      const result = registry.publish(pkg);

      expect(result.success).toBe(true);
      expect(result.plugin).toBe('test-plugin');
      expect(result.version).toBe('1.0.0');
      expect(result.message).toBe('Published successfully');
      expect(result.publishedAt).toBeDefined();
    });

    it('should reject duplicate versions', () => {
      const pkg = packager.pack(validManifest(), validFiles());
      registry.publish(pkg);

      const duplicate = packager.pack(validManifest(), validFiles());
      const result = registry.publish(duplicate);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });

    it('should allow publishing different versions of the same plugin', () => {
      const v1 = packager.pack(validManifest({ version: '1.0.0' }), validFiles());
      const v2 = packager.pack(validManifest({ version: '2.0.0' }), validFiles());

      expect(registry.publish(v1).success).toBe(true);
      expect(registry.publish(v2).success).toBe(true);
      expect(registry.getPluginCount()).toBe(1); // same plugin, one entry
    });

    it('should update the marketplace entry version on new publish', () => {
      const v1 = packager.pack(validManifest({ version: '1.0.0' }), validFiles());
      registry.publish(v1);

      const v2 = packager.pack(validManifest({ version: '2.0.0' }), validFiles());
      registry.publish(v2);

      const plugin = registry.getPlugin('test-plugin');
      expect(plugin?.version).toBe('2.0.0');
    });

    it('should emit published event', () => {
      const handler = jest.fn();
      registry.on('published', handler);

      const pkg = packager.pack(validManifest(), validFiles());
      registry.publish(pkg);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ name: 'test-plugin', version: '1.0.0' });
    });

    it('should preserve download count across version publishes', () => {
      publishTestPlugin(registry, packager, { version: '1.0.0' });
      registry.install('test-plugin', '1.0.0');

      publishTestPlugin(registry, packager, { version: '2.0.0' });
      const plugin = registry.getPlugin('test-plugin');
      expect(plugin?.downloads).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // search
  // --------------------------------------------------------------------------

  describe('search', () => {
    beforeEach(() => {
      publishTestPlugin(registry, packager, {
        name: 'alpha-logger',
        description: 'Logging utility',
        author: 'alice',
        keywords: ['logging', 'utility'],
      });
      publishTestPlugin(registry, packager, {
        name: 'beta-formatter',
        description: 'Code formatting tool',
        author: 'bob',
        keywords: ['formatting', 'utility'],
      });
      publishTestPlugin(registry, packager, {
        name: 'gamma-security',
        description: 'Security scanner',
        author: 'alice',
        keywords: ['security'],
      });
    });

    it('should return all plugins with empty options', () => {
      const result = registry.search();
      expect(result.total).toBe(3);
      expect(result.plugins).toHaveLength(3);
    });

    it('should filter by query matching name', () => {
      const result = registry.search({ query: 'alpha' });
      expect(result.total).toBe(1);
      expect(result.plugins[0].name).toBe('alpha-logger');
    });

    it('should filter by query matching description', () => {
      const result = registry.search({ query: 'scanner' });
      expect(result.total).toBe(1);
      expect(result.plugins[0].name).toBe('gamma-security');
    });

    it('should filter by keyword', () => {
      const result = registry.search({ keyword: 'utility' });
      expect(result.total).toBe(2);
    });

    it('should filter by author', () => {
      const result = registry.search({ author: 'alice' });
      expect(result.total).toBe(2);
    });

    it('should sort by name (default)', () => {
      const result = registry.search({ sortBy: 'name' });
      const names = result.plugins.map(p => p.name);
      expect(names).toEqual(['alpha-logger', 'beta-formatter', 'gamma-security']);
    });

    it('should sort by downloads descending', () => {
      // Install alpha twice, beta once
      registry.install('alpha-logger');
      registry.install('alpha-logger');
      registry.install('beta-formatter');

      const result = registry.search({ sortBy: 'downloads' });
      expect(result.plugins[0].name).toBe('alpha-logger');
      expect(result.plugins[0].downloads).toBe(2);
    });

    it('should paginate results with limit and offset', () => {
      const page1 = registry.search({ limit: 2, offset: 0 });
      expect(page1.plugins).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(2);

      const page2 = registry.search({ limit: 2, offset: 2 });
      expect(page2.plugins).toHaveLength(1);
      expect(page2.page).toBe(2);
    });

    it('should return empty results for no matches', () => {
      const result = registry.search({ query: 'nonexistent' });
      expect(result.total).toBe(0);
      expect(result.plugins).toHaveLength(0);
    });

    it('should combine multiple filters', () => {
      const result = registry.search({ author: 'alice', keyword: 'logging' });
      expect(result.total).toBe(1);
      expect(result.plugins[0].name).toBe('alpha-logger');
    });

    it('should be case-insensitive for query', () => {
      const result = registry.search({ query: 'ALPHA' });
      expect(result.total).toBe(1);
    });

    it('should be case-insensitive for author', () => {
      const result = registry.search({ author: 'Alice' });
      expect(result.total).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // install
  // --------------------------------------------------------------------------

  describe('install', () => {
    beforeEach(() => {
      publishTestPlugin(registry, packager);
    });

    it('should install a plugin successfully', () => {
      const result = registry.install('test-plugin', '1.0.0');

      expect(result.success).toBe(true);
      expect(result.plugin).toBe('test-plugin');
      expect(result.version).toBe('1.0.0');
      expect(result.message).toBe('Installed successfully');
      expect(result.installedAt).toBeDefined();
    });

    it('should install latest version when no version specified', () => {
      const result = registry.install('test-plugin');
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('should increment download count on install', () => {
      registry.install('test-plugin');
      registry.install('test-plugin');

      const plugin = registry.getPlugin('test-plugin');
      expect(plugin?.downloads).toBe(2);
    });

    it('should mark plugin as installed', () => {
      registry.install('test-plugin');

      const plugin = registry.getPlugin('test-plugin');
      expect(plugin?.installed).toBe(true);
    });

    it('should fail for unknown plugin', () => {
      const result = registry.install('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should fail for unknown version', () => {
      const result = registry.install('test-plugin', '9.9.9');

      expect(result.success).toBe(false);
      expect(result.message).toContain("Version '9.9.9' not found");
    });

    it('should emit installed event', () => {
      const handler = jest.fn();
      registry.on('installed', handler);

      registry.install('test-plugin', '1.0.0');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ name: 'test-plugin', version: '1.0.0' });
    });
  });

  // --------------------------------------------------------------------------
  // uninstall
  // --------------------------------------------------------------------------

  describe('uninstall', () => {
    beforeEach(() => {
      publishTestPlugin(registry, packager);
      registry.install('test-plugin', '1.0.0');
    });

    it('should uninstall a plugin successfully', () => {
      const result = registry.uninstall('test-plugin', '1.0.0');

      expect(result.success).toBe(true);
      expect(result.plugin).toBe('test-plugin');
      expect(result.version).toBe('1.0.0');
      expect(result.message).toBe('Uninstalled successfully');
    });

    it('should mark plugin as not installed after uninstall', () => {
      registry.uninstall('test-plugin', '1.0.0');

      const plugin = registry.getPlugin('test-plugin');
      expect(plugin?.installed).toBe(false);
    });

    it('should fail for unknown plugin', () => {
      const result = registry.uninstall('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should fail when plugin is not installed', () => {
      registry.uninstall('test-plugin', '1.0.0');
      const result = registry.uninstall('test-plugin', '1.0.0');

      expect(result.success).toBe(false);
      expect(result.message).toContain('is not installed');
    });

    it('should default to latest version when no version specified', () => {
      const result = registry.uninstall('test-plugin');
      expect(result.success).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('should emit uninstalled event', () => {
      const handler = jest.fn();
      registry.on('uninstalled', handler);

      registry.uninstall('test-plugin', '1.0.0');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ name: 'test-plugin', version: '1.0.0' });
    });

    it('should keep installed flag true when other versions remain installed', () => {
      // Publish and install version 2
      publishTestPlugin(registry, packager, { version: '2.0.0' });
      registry.install('test-plugin', '2.0.0');

      // Uninstall only version 1
      registry.uninstall('test-plugin', '1.0.0');

      const plugin = registry.getPlugin('test-plugin');
      expect(plugin?.installed).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // getPlugin
  // --------------------------------------------------------------------------

  describe('getPlugin', () => {
    it('should return a published plugin', () => {
      publishTestPlugin(registry, packager);

      const plugin = registry.getPlugin('test-plugin');
      expect(plugin).not.toBeNull();
      expect(plugin?.name).toBe('test-plugin');
      expect(plugin?.author).toBe('tester');
      expect(plugin?.description).toBe('A test plugin');
    });

    it('should return null for unknown plugin', () => {
      expect(registry.getPlugin('nonexistent')).toBeNull();
    });
  });

  // --------------------------------------------------------------------------
  // getVersions
  // --------------------------------------------------------------------------

  describe('getVersions', () => {
    it('should return all published versions', () => {
      publishTestPlugin(registry, packager, { version: '1.0.0' });
      publishTestPlugin(registry, packager, { version: '1.1.0' });
      publishTestPlugin(registry, packager, { version: '2.0.0' });

      const versions = registry.getVersions('test-plugin');
      expect(versions).toHaveLength(3);
      expect(versions.map(v => v.version)).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    it('should return empty array for unknown plugin', () => {
      const versions = registry.getVersions('nonexistent');
      expect(versions).toEqual([]);
    });

    it('should include publishedAt in version info', () => {
      publishTestPlugin(registry, packager);

      const versions = registry.getVersions('test-plugin');
      expect(versions[0].publishedAt).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // getInstalledPlugins
  // --------------------------------------------------------------------------

  describe('getInstalledPlugins', () => {
    it('should return only installed plugins', () => {
      publishTestPlugin(registry, packager, { name: 'alpha-plugin' });
      publishTestPlugin(registry, packager, { name: 'beta-plugin' });

      registry.install('alpha-plugin');

      const installed = registry.getInstalledPlugins();
      expect(installed).toHaveLength(1);
      expect(installed[0].name).toBe('alpha-plugin');
    });

    it('should return empty array when nothing is installed', () => {
      publishTestPlugin(registry, packager);
      expect(registry.getInstalledPlugins()).toEqual([]);
    });
  });

  // --------------------------------------------------------------------------
  // getPluginCount
  // --------------------------------------------------------------------------

  describe('getPluginCount', () => {
    it('should return zero for empty registry', () => {
      expect(registry.getPluginCount()).toBe(0);
    });

    it('should return correct count after publishes', () => {
      publishTestPlugin(registry, packager, { name: 'plugin-a' });
      publishTestPlugin(registry, packager, { name: 'plugin-b' });

      expect(registry.getPluginCount()).toBe(2);
    });

    it('should not double-count multiple versions', () => {
      publishTestPlugin(registry, packager, { version: '1.0.0' });
      publishTestPlugin(registry, packager, { version: '2.0.0' });

      expect(registry.getPluginCount()).toBe(1);
    });
  });

  // --------------------------------------------------------------------------
  // dispose
  // --------------------------------------------------------------------------

  describe('dispose', () => {
    it('should clear all data', () => {
      publishTestPlugin(registry, packager);
      registry.install('test-plugin');

      registry.dispose();

      expect(registry.getPluginCount()).toBe(0);
      expect(registry.getPlugin('test-plugin')).toBeNull();
      expect(registry.getInstalledPlugins()).toEqual([]);
    });

    it('should remove all listeners', () => {
      registry.on('published', jest.fn());
      registry.on('installed', jest.fn());

      registry.dispose();

      expect(registry.listenerCount('published')).toBe(0);
      expect(registry.listenerCount('installed')).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Factory
  // --------------------------------------------------------------------------

  describe('factory', () => {
    it('should create a MarketplaceRegistry via createMarketplaceRegistry', () => {
      const reg = createMarketplaceRegistry();
      expect(reg).toBeInstanceOf(MarketplaceRegistry);
    });
  });
});
