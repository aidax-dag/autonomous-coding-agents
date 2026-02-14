/**
 * Marketplace Registry
 *
 * In-memory registry for plugin discovery, publishing, installation,
 * and search within the marketplace.
 *
 * @module core/plugins/marketplace
 */

import { EventEmitter } from 'events';

import { createAgentLogger } from '../../../shared/logging/logger';
import type {
  MarketplacePlugin,
  PluginPackage,
  SearchOptions,
  SearchResult,
  InstallResult,
  PublishResult,
  VersionInfo,
} from './types';

const logger = createAgentLogger('Marketplace', 'registry');

// ============================================================================
// Implementation
// ============================================================================

/**
 * MarketplaceRegistry
 *
 * Provides an in-memory marketplace for publishing, discovering, installing,
 * and uninstalling plugin packages. Emits events for all state-changing operations.
 */
export class MarketplaceRegistry extends EventEmitter {
  private plugins: Map<string, MarketplacePlugin> = new Map();
  private packages: Map<string, PluginPackage[]> = new Map();
  private installed: Set<string> = new Set();

  // --------------------------------------------------------------------------
  // Publish
  // --------------------------------------------------------------------------

  /**
   * Publish a plugin package to the registry.
   * Rejects duplicate versions for the same plugin name.
   */
  publish(pkg: PluginPackage): PublishResult {
    const { name, version } = pkg.manifest;

    // Check for duplicate version
    const versions = this.packages.get(name) || [];
    if (versions.some(v => v.manifest.version === version)) {
      return {
        success: false,
        plugin: name,
        version,
        message: `Version ${version} already exists for plugin '${name}'`,
      };
    }

    versions.push(pkg);
    this.packages.set(name, versions);

    // Update or create marketplace entry
    const existing = this.plugins.get(name);
    const now = new Date().toISOString();
    const key = `${name}@${version}`;

    const entry: MarketplacePlugin = {
      name,
      version,
      description: pkg.manifest.description,
      author: pkg.manifest.author,
      license: pkg.manifest.license || 'MIT',
      keywords: pkg.manifest.keywords || [],
      downloads: existing?.downloads || 0,
      rating: existing?.rating || 0,
      publishedAt: existing?.publishedAt || now,
      updatedAt: now,
      compatible: true,
      installed: this.installed.has(key),
    };

    this.plugins.set(name, entry);

    this.emit('published', { name, version });
    logger.info('Plugin published', { name, version });

    return {
      success: true,
      plugin: name,
      version,
      message: 'Published successfully',
      publishedAt: entry.updatedAt,
    };
  }

  // --------------------------------------------------------------------------
  // Search
  // --------------------------------------------------------------------------

  /**
   * Search plugins by query, keyword, author with sorting and pagination.
   */
  search(options: SearchOptions = {}): SearchResult {
    let results = Array.from(this.plugins.values());

    // Filter by query (matches name or description)
    if (options.query) {
      const q = options.query.toLowerCase();
      results = results.filter(
        p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }

    // Filter by keyword
    if (options.keyword) {
      const kw = options.keyword.toLowerCase();
      results = results.filter(p => p.keywords.some(k => k.toLowerCase() === kw));
    }

    // Filter by author
    if (options.author) {
      const author = options.author.toLowerCase();
      results = results.filter(p => p.author.toLowerCase() === author);
    }

    // Sort
    const sortBy = options.sortBy || 'name';
    results.sort((a, b) => {
      switch (sortBy) {
        case 'downloads':
          return b.downloads - a.downloads;
        case 'rating':
          return b.rating - a.rating;
        case 'updated':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    const total = results.length;
    const offset = options.offset || 0;
    const limit = options.limit || 20;
    const paged = results.slice(offset, offset + limit);

    return {
      plugins: paged,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  // --------------------------------------------------------------------------
  // Install / Uninstall
  // --------------------------------------------------------------------------

  /**
   * Install a plugin by name and optional version.
   * Defaults to the latest published version if no version is specified.
   */
  install(name: string, version?: string): InstallResult {
    const entry = this.plugins.get(name);
    if (!entry) {
      return {
        success: false,
        plugin: name,
        version: version || 'latest',
        message: `Plugin '${name}' not found`,
      };
    }

    const targetVersion = version || entry.version;
    const versions = this.packages.get(name) || [];
    const pkg = versions.find(v => v.manifest.version === targetVersion);

    if (!pkg) {
      return {
        success: false,
        plugin: name,
        version: targetVersion,
        message: `Version '${targetVersion}' not found`,
      };
    }

    const key = `${name}@${targetVersion}`;
    this.installed.add(key);
    entry.downloads += 1;
    entry.installed = true;

    this.emit('installed', { name, version: targetVersion });
    logger.info('Plugin installed', { name, version: targetVersion });

    return {
      success: true,
      plugin: name,
      version: targetVersion,
      message: 'Installed successfully',
      installedAt: new Date().toISOString(),
    };
  }

  /**
   * Uninstall a plugin by name and optional version.
   */
  uninstall(name: string, version?: string): InstallResult {
    const entry = this.plugins.get(name);
    if (!entry) {
      return {
        success: false,
        plugin: name,
        version: version || 'unknown',
        message: `Plugin '${name}' not found`,
      };
    }

    const targetVersion = version || entry.version;
    const key = `${name}@${targetVersion}`;

    if (!this.installed.has(key)) {
      return {
        success: false,
        plugin: name,
        version: targetVersion,
        message: `Plugin '${name}@${targetVersion}' is not installed`,
      };
    }

    this.installed.delete(key);

    // Check if any version of this plugin is still installed
    const anyInstalled = Array.from(this.installed).some(k => k.startsWith(`${name}@`));
    entry.installed = anyInstalled;

    this.emit('uninstalled', { name, version: targetVersion });
    logger.info('Plugin uninstalled', { name, version: targetVersion });

    return {
      success: true,
      plugin: name,
      version: targetVersion,
      message: 'Uninstalled successfully',
    };
  }

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  /**
   * Get a single plugin listing by name.
   */
  getPlugin(name: string): MarketplacePlugin | null {
    return this.plugins.get(name) || null;
  }

  /**
   * Get all published versions for a plugin.
   */
  getVersions(name: string): VersionInfo[] {
    const versions = this.packages.get(name) || [];
    return versions.map(pkg => ({
      version: pkg.manifest.version,
      publishedAt: pkg.createdAt,
      downloads: 0,
      changelog: undefined,
    }));
  }

  /**
   * Get all currently installed plugins.
   */
  getInstalledPlugins(): MarketplacePlugin[] {
    return Array.from(this.plugins.values()).filter(p => p.installed);
  }

  /**
   * Get the total number of plugins in the registry.
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /**
   * Clear all registry state and remove listeners.
   */
  dispose(): void {
    this.plugins.clear();
    this.packages.clear();
    this.installed.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a MarketplaceRegistry instance
 */
export function createMarketplaceRegistry(): MarketplaceRegistry {
  return new MarketplaceRegistry();
}
