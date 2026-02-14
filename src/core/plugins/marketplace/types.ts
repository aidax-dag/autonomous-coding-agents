/**
 * Plugin Marketplace Types
 *
 * Type definitions for plugin packaging, distribution, and marketplace operations.
 *
 * @module core/plugins/marketplace
 */

// ============================================================================
// Marketplace Plugin
// ============================================================================

/**
 * A plugin listing in the marketplace with metadata and status
 */
export interface MarketplacePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  keywords: string[];
  homepage?: string;
  repository?: string;
  downloads: number;
  rating: number;
  publishedAt: string;
  updatedAt: string;
  compatible: boolean;
  installed: boolean;
}

// ============================================================================
// Plugin Package
// ============================================================================

/**
 * A distributable plugin package containing manifest, files, and integrity data
 */
export interface PluginPackage {
  manifest: PluginManifestData;
  files: PackageFile[];
  checksum: string;
  size: number;
  createdAt: string;
}

/**
 * Extended manifest data for marketplace distribution
 */
export interface PluginManifestData {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  keywords: string[];
  main: string;
  dependencies: Record<string, string>;
  acaVersion: string;
}

/**
 * A file within a plugin package
 */
export interface PackageFile {
  path: string;
  content: string;
  size: number;
}

// ============================================================================
// Search
// ============================================================================

/**
 * Options for searching the marketplace
 */
export interface SearchOptions {
  query?: string;
  keyword?: string;
  author?: string;
  sortBy?: 'downloads' | 'rating' | 'name' | 'updated';
  limit?: number;
  offset?: number;
}

/**
 * Paginated search result
 */
export interface SearchResult {
  plugins: MarketplacePlugin[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Operations
// ============================================================================

/**
 * Result of a plugin install/uninstall operation
 */
export interface InstallResult {
  success: boolean;
  plugin: string;
  version: string;
  message: string;
  installedAt?: string;
}

/**
 * Result of a plugin publish operation
 */
export interface PublishResult {
  success: boolean;
  plugin: string;
  version: string;
  message: string;
  publishedAt?: string;
}

/**
 * Version metadata for a specific plugin release
 */
export interface VersionInfo {
  version: string;
  publishedAt: string;
  downloads: number;
  changelog?: string;
}
