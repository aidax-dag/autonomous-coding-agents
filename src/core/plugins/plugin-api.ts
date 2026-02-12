/**
 * Plugin API
 *
 * Defines the API surface that the host application exposes to plugins.
 * Plugins can query the API version and available capabilities.
 *
 * @module core/plugins
 */

import type { IPluginAPI } from './interfaces/plugin.interface';

// ============================================================================
// Constants
// ============================================================================

const PLUGIN_API_VERSION = '1.0.0';

const PLUGIN_CAPABILITIES = [
  'register-agent',
  'register-skill',
  'register-hook',
  'register-command',
] as const;

// ============================================================================
// Implementation
// ============================================================================

/**
 * PluginAPI
 *
 * Provides version information and capability listing for plugins
 * to discover what integrations are available.
 */
export class PluginAPI implements IPluginAPI {
  /**
   * Get the plugin API version.
   */
  getVersion(): string {
    return PLUGIN_API_VERSION;
  }

  /**
   * Get the list of capabilities plugins can integrate with.
   */
  getCapabilities(): string[] {
    return [...PLUGIN_CAPABILITIES];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PluginAPI instance
 */
export function createPluginAPI(): PluginAPI {
  return new PluginAPI();
}
