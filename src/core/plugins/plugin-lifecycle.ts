/**
 * Plugin Lifecycle Manager
 *
 * Manages lifecycle transitions (initialize, activate, deactivate, dispose)
 * across multiple plugins with error isolation.
 *
 * @module core/plugins
 */

import type {
  IPlugin,
  IPluginLifecycle,
  PluginContext,
} from './interfaces/plugin.interface';

// ============================================================================
// Implementation
// ============================================================================

/**
 * PluginLifecycle
 *
 * Executes lifecycle operations across multiple plugins. Each plugin is
 * processed independently -- an error in one plugin does not block others.
 */
export class PluginLifecycle implements IPluginLifecycle {
  /**
   * Initialize all plugins with the given context.
   * Returns a map of plugin name -> Error (null if successful).
   */
  async initializeAll(
    plugins: IPlugin[],
    context: PluginContext,
  ): Promise<Map<string, Error | null>> {
    const results = new Map<string, Error | null>();

    for (const plugin of plugins) {
      try {
        await plugin.initialize(context);
        results.set(plugin.manifest.name, null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        plugin.status = 'error';
        results.set(plugin.manifest.name, error);
      }
    }

    return results;
  }

  /**
   * Activate all plugins.
   * Returns a map of plugin name -> Error (null if successful).
   */
  async activateAll(plugins: IPlugin[]): Promise<Map<string, Error | null>> {
    const results = new Map<string, Error | null>();

    for (const plugin of plugins) {
      try {
        await plugin.activate();
        results.set(plugin.manifest.name, null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        plugin.status = 'error';
        results.set(plugin.manifest.name, error);
      }
    }

    return results;
  }

  /**
   * Deactivate all plugins.
   * Returns a map of plugin name -> Error (null if successful).
   */
  async deactivateAll(plugins: IPlugin[]): Promise<Map<string, Error | null>> {
    const results = new Map<string, Error | null>();

    for (const plugin of plugins) {
      try {
        await plugin.deactivate();
        results.set(plugin.manifest.name, null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        plugin.status = 'error';
        results.set(plugin.manifest.name, error);
      }
    }

    return results;
  }

  /**
   * Dispose all plugins. Errors are suppressed to ensure all plugins
   * get a chance to clean up.
   */
  async disposeAll(plugins: IPlugin[]): Promise<void> {
    for (const plugin of plugins) {
      try {
        await plugin.dispose();
      } catch {
        // Best-effort disposal: suppress errors so all plugins get cleaned up
        plugin.status = 'error';
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PluginLifecycle instance
 */
export function createPluginLifecycle(): PluginLifecycle {
  return new PluginLifecycle();
}
