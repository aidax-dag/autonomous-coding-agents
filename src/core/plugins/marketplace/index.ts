/**
 * Plugin Marketplace Module
 *
 * Packaging, versioning, distribution, and installation of plugins.
 *
 * @module core/plugins/marketplace
 */

export type {
  MarketplacePlugin,
  PluginPackage,
  PluginManifestData,
  PackageFile,
  SearchOptions,
  SearchResult,
  InstallResult,
  PublishResult,
  VersionInfo,
} from './types';

export { PluginPackager, createPluginPackager } from './plugin-packager';
export { MarketplaceRegistry, createMarketplaceRegistry } from './marketplace-registry';
