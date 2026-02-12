/**
 * Plugin Module
 *
 * Extensible plugin system for discovering, loading, and managing
 * first-party and third-party extensions.
 *
 * Core components:
 * - PluginLoader: filesystem discovery and loading
 * - PluginRegistry: registration and lookup
 * - PluginLifecycle: lifecycle management with error isolation
 * - PluginAPI: host API surface for plugins
 *
 * @module core/plugins
 */

// ── Interfaces ─────────────────────────────────────────────
export type {
  IPlugin,
  IPluginAPI,
  IPluginLifecycle,
  IPluginLoader,
  IPluginRegistry,
  PluginContext,
  PluginManifest,
  PluginStatus,
} from './interfaces/plugin.interface';

// ── Loader ─────────────────────────────────────────────────
export {
  Plugin,
  PluginLoader,
  createPluginLoader,
} from './plugin-loader';

// ── Registry ───────────────────────────────────────────────
export {
  PluginRegistry,
  createPluginRegistry,
} from './plugin-registry';

// ── Lifecycle ──────────────────────────────────────────────
export {
  PluginLifecycle,
  createPluginLifecycle,
} from './plugin-lifecycle';

// ── API ────────────────────────────────────────────────────
export {
  PluginAPI,
  createPluginAPI,
} from './plugin-api';
