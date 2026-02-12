/**
 * Plugin Module Interfaces
 *
 * Defines the contract for plugin discovery, loading, lifecycle management,
 * and the API surface exposed to plugins.
 *
 * @module core/plugins/interfaces
 */

// ============================================================================
// Plugin Manifest
// ============================================================================

/**
 * Metadata describing a plugin, typically from plugin.json
 */
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  dependencies?: Record<string, string>;
  main?: string;
}

// ============================================================================
// Plugin Context
// ============================================================================

/**
 * Runtime context provided to plugins during initialization
 */
export interface PluginContext {
  workspaceDir: string;
  pluginDir: string;
  config?: Record<string, unknown>;
}

// ============================================================================
// Plugin Status
// ============================================================================

/**
 * Lifecycle states a plugin can be in
 */
export type PluginStatus = 'discovered' | 'loaded' | 'initialized' | 'active' | 'error' | 'disposed';

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * A plugin instance with lifecycle methods
 */
export interface IPlugin {
  readonly manifest: PluginManifest;
  status: PluginStatus;
  initialize(context: PluginContext): Promise<void>;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  dispose(): Promise<void>;
}

/**
 * Discovers and loads plugins from the filesystem
 */
export interface IPluginLoader {
  discover(directory: string): Promise<PluginManifest[]>;
  load(manifest: PluginManifest, pluginDir: string): Promise<IPlugin>;
}

/**
 * Manages registered plugin instances
 */
export interface IPluginRegistry {
  register(plugin: IPlugin): void;
  unregister(name: string): boolean;
  get(name: string): IPlugin | undefined;
  getAll(): IPlugin[];
  getByStatus(status: PluginStatus): IPlugin[];
  count(): number;
  clear(): void;
}

/**
 * Manages plugin lifecycle transitions across multiple plugins
 */
export interface IPluginLifecycle {
  initializeAll(plugins: IPlugin[], context: PluginContext): Promise<Map<string, Error | null>>;
  activateAll(plugins: IPlugin[]): Promise<Map<string, Error | null>>;
  deactivateAll(plugins: IPlugin[]): Promise<Map<string, Error | null>>;
  disposeAll(plugins: IPlugin[]): Promise<void>;
}

/**
 * API surface exposed to plugins for capability registration
 */
export interface IPluginAPI {
  getVersion(): string;
  getCapabilities(): string[];
}
