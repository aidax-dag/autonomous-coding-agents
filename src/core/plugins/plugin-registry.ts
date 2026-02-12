/**
 * Plugin Registry
 *
 * Manages registration, lookup, and lifecycle tracking of plugin instances.
 *
 * @module core/plugins
 */

import type {
  IPlugin,
  IPluginRegistry,
  PluginStatus,
} from './interfaces/plugin.interface';

// ============================================================================
// Implementation
// ============================================================================

/**
 * PluginRegistry
 *
 * In-memory registry for managing plugin instances by name.
 * Supports filtering by status and bulk operations.
 */
export class PluginRegistry implements IPluginRegistry {
  private readonly plugins = new Map<string, IPlugin>();

  /**
   * Register a plugin instance. Throws if a plugin with the same name
   * is already registered.
   */
  register(plugin: IPlugin): void {
    const name = plugin.manifest.name;
    if (!name) {
      throw new Error('Plugin must have a manifest with a name');
    }
    if (this.plugins.has(name)) {
      throw new Error(`Plugin '${name}' is already registered`);
    }
    this.plugins.set(name, plugin);
  }

  /**
   * Unregister a plugin by name.
   * @returns true if the plugin was found and removed
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Get a plugin by name.
   */
  get(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Get all registered plugins.
   */
  getAll(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all plugins with the given status.
   */
  getByStatus(status: PluginStatus): IPlugin[] {
    return this.getAll().filter(p => p.status === status);
  }

  /**
   * Get the number of registered plugins.
   */
  count(): number {
    return this.plugins.size;
  }

  /**
   * Remove all registered plugins.
   */
  clear(): void {
    this.plugins.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PluginRegistry instance
 */
export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}
