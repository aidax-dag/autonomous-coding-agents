/**
 * Plugin Loader
 *
 * Discovers plugin manifests from the filesystem and creates
 * plugin instances from them.
 *
 * @module core/plugins
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  IPlugin,
  IPluginLoader,
  PluginContext,
  PluginManifest,
  PluginStatus,
} from './interfaces/plugin.interface';

// ============================================================================
// Plugin Implementation (in-memory)
// ============================================================================

/**
 * Default in-memory plugin implementation.
 *
 * Stores manifest, tracks status transitions through the lifecycle:
 * loaded -> initialized -> active -> disposed
 */
export class Plugin implements IPlugin {
  readonly manifest: PluginManifest;
  status: PluginStatus;

  constructor(manifest: PluginManifest) {
    this.manifest = manifest;
    this.status = 'loaded';
  }

  async initialize(context: PluginContext): Promise<void> {
    if (this.status !== 'loaded') {
      throw new Error(
        `Cannot initialize plugin '${this.manifest.name}' in status '${this.status}' (expected 'loaded')`,
      );
    }
    // Validate context
    if (!context.workspaceDir || !context.pluginDir) {
      throw new Error('PluginContext must have workspaceDir and pluginDir');
    }
    this.status = 'initialized';
  }

  async activate(): Promise<void> {
    if (this.status !== 'initialized') {
      throw new Error(
        `Cannot activate plugin '${this.manifest.name}' in status '${this.status}' (expected 'initialized')`,
      );
    }
    this.status = 'active';
  }

  async deactivate(): Promise<void> {
    if (this.status !== 'active') {
      throw new Error(
        `Cannot deactivate plugin '${this.manifest.name}' in status '${this.status}' (expected 'active')`,
      );
    }
    this.status = 'initialized';
  }

  async dispose(): Promise<void> {
    this.status = 'disposed';
  }
}

// ============================================================================
// Plugin Loader Implementation
// ============================================================================

/**
 * PluginLoader
 *
 * Scans directories for plugin.json files and creates Plugin instances.
 */
export class PluginLoader implements IPluginLoader {
  /**
   * Discover plugin manifests by scanning subdirectories for plugin.json files.
   *
   * @param directory - Root directory to scan for plugins
   * @returns Array of discovered plugin manifests
   */
  async discover(directory: string): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch {
      return manifests;
    }

    for (const entry of entries) {
      const manifestPath = join(directory, entry, 'plugin.json');
      try {
        const content = await readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(content) as PluginManifest;

        if (this.isValidManifest(manifest)) {
          manifests.push(manifest);
        }
      } catch {
        // Skip entries without valid plugin.json
      }
    }

    return manifests;
  }

  /**
   * Load a plugin from its manifest, creating a Plugin instance.
   *
   * @param manifest - Plugin manifest describing the plugin
   * @param _pluginDir - Directory containing the plugin (unused in in-memory impl)
   * @returns Plugin instance in 'loaded' status
   */
  async load(manifest: PluginManifest, _pluginDir: string): Promise<IPlugin> {
    if (!this.isValidManifest(manifest)) {
      throw new Error('Invalid plugin manifest: name and version are required');
    }
    return new Plugin(manifest);
  }

  /**
   * Validate that a manifest has the minimum required fields.
   */
  private isValidManifest(manifest: unknown): manifest is PluginManifest {
    if (!manifest || typeof manifest !== 'object') {
      return false;
    }
    const m = manifest as Record<string, unknown>;
    return typeof m.name === 'string' && m.name.length > 0
      && typeof m.version === 'string' && m.version.length > 0;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PluginLoader instance
 */
export function createPluginLoader(): PluginLoader {
  return new PluginLoader();
}
