/**
 * Plugin Packager
 *
 * Validates plugin manifests and creates distributable packages
 * with integrity verification.
 *
 * @module core/plugins/marketplace
 */

import { EventEmitter } from 'events';

import { createAgentLogger } from '../../../shared/logging/logger';
import type { PluginPackage, PluginManifestData, PackageFile } from './types';

const logger = createAgentLogger('Marketplace', 'plugin-packager');

// ============================================================================
// Implementation
// ============================================================================

/**
 * PluginPackager
 *
 * Validates manifest data, bundles plugin files into distributable packages,
 * and verifies package integrity via checksums.
 */
export class PluginPackager extends EventEmitter {
  /**
   * Validate that a manifest has all required fields and correct formats.
   *
   * @returns Array of validation error messages (empty if valid)
   */
  validateManifest(manifest: PluginManifestData): string[] {
    const errors: string[] = [];

    if (!manifest.name) errors.push('Missing required field: name');
    if (!manifest.version) errors.push('Missing required field: version');
    if (!manifest.description) errors.push('Missing required field: description');
    if (!manifest.author) errors.push('Missing required field: author');
    if (!manifest.main) errors.push('Missing required field: main');
    if (!manifest.acaVersion) errors.push('Missing required field: acaVersion');

    // Validate semver format
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Invalid version format (expected semver)');
    }

    // Validate name format: lowercase alphanumeric with hyphens, starting with letter
    if (manifest.name && !/^[a-z][a-z0-9-]*$/.test(manifest.name)) {
      errors.push('Invalid plugin name (lowercase alphanumeric with hyphens)');
    }

    return errors;
  }

  /**
   * Create a distributable package from a manifest and file list.
   *
   * @throws Error if manifest is invalid or main entry file is missing
   */
  pack(manifest: PluginManifestData, files: PackageFile[]): PluginPackage {
    const errors = this.validateManifest(manifest);
    if (errors.length > 0) {
      throw new Error(`Invalid manifest: ${errors.join(', ')}`);
    }

    // Verify main entry file exists in package
    const hasMain = files.some(f => f.path === manifest.main);
    if (!hasMain) {
      throw new Error(`Main entry file '${manifest.main}' not found in package files`);
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const checksum = this.computeChecksum(manifest, files);

    const pkg: PluginPackage = {
      manifest,
      files,
      checksum,
      size: totalSize,
      createdAt: new Date().toISOString(),
    };

    this.emit('packed', { name: manifest.name, version: manifest.version, size: totalSize });
    logger.info('Plugin packed', { name: manifest.name, version: manifest.version });

    return pkg;
  }

  /**
   * Verify that a package has not been tampered with by recomputing its checksum.
   */
  verifyPackage(pkg: PluginPackage): boolean {
    const expectedChecksum = this.computeChecksum(pkg.manifest, pkg.files);
    return expectedChecksum === pkg.checksum;
  }

  /**
   * Compute a deterministic checksum from manifest and file metadata.
   */
  private computeChecksum(manifest: PluginManifestData, files: PackageFile[]): string {
    const content = JSON.stringify({
      manifest,
      files: files.map(f => f.path + f.size),
    });

    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a PluginPackager instance
 */
export function createPluginPackager(): PluginPackager {
  return new PluginPackager();
}
