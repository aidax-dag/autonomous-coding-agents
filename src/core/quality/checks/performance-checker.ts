/**
 * Performance Checker
 *
 * Analyzes performance metrics including bundle size, build time,
 * startup time, and runtime benchmarks.
 *
 * @module core/quality/checks/performance-checker
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { QualityCheckResult, QualityDimension } from '../completion-detector.js';

const execAsync = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Bundle size info
 */
export interface BundleInfo {
  name: string;
  path: string;
  size: number;
  gzipSize?: number;
  isOverLimit: boolean;
}

/**
 * Build metrics
 */
export interface BuildMetrics {
  duration: number;
  success: boolean;
  outputSize: number;
  fileCount: number;
  timestamp: Date;
}

/**
 * Dependency metrics
 */
export interface DependencyMetrics {
  totalDependencies: number;
  directDependencies: number;
  devDependencies: number;
  outdatedCount: number;
  duplicates: string[];
}

/**
 * Performance summary
 */
export interface PerformanceSummary {
  bundles: BundleInfo[];
  totalBundleSize: number;
  buildMetrics: BuildMetrics | null;
  dependencyMetrics: DependencyMetrics;
  sourceStats: SourceStats;
  hasLargeBundle: boolean;
  recommendations: string[];
}

/**
 * Source code statistics
 */
export interface SourceStats {
  totalFiles: number;
  totalLines: number;
  avgLinesPerFile: number;
  largestFiles: Array<{ path: string; lines: number }>;
}

/**
 * Performance checker configuration
 */
export interface PerformanceConfig {
  maxBundleSize?: number; // bytes
  maxGzipSize?: number;
  maxBuildTime?: number; // ms
  maxDependencies?: number;
  distDir?: string;
  buildDir?: string;
  checkBuildTime?: boolean;
  checkBundles?: boolean;
  ignorePatterns?: string[];
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_PERFORMANCE_CONFIG: PerformanceConfig = {
  maxBundleSize: 500 * 1024, // 500KB
  maxGzipSize: 150 * 1024, // 150KB gzipped
  maxBuildTime: 120000, // 2 minutes
  maxDependencies: 100,
  distDir: 'dist',
  buildDir: 'build',
  checkBuildTime: true,
  checkBundles: true,
  ignorePatterns: ['node_modules', '.git', 'coverage'],
};

// ============================================================================
// Performance Checker Implementation
// ============================================================================

/**
 * Performance checker for analyzing build and runtime performance
 */
export class PerformanceChecker {
  private config: PerformanceConfig;

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  }

  /**
   * Check performance for a workspace
   */
  async check(workspacePath: string): Promise<QualityCheckResult> {
    try {
      const summary = await this.getPerformanceSummary(workspacePath);
      return this.evaluatePerformance(summary);
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  /**
   * Get comprehensive performance summary
   */
  async getPerformanceSummary(workspacePath: string): Promise<PerformanceSummary> {
    // Analyze bundles
    const bundles = await this.analyzeBundles(workspacePath);
    const totalBundleSize = bundles.reduce((sum, b) => sum + b.size, 0);

    // Get build metrics from existing artifacts
    const buildMetrics = await this.getBuildMetrics(workspacePath);

    // Analyze dependencies
    const dependencyMetrics = await this.analyzeDependencies(workspacePath);

    // Analyze source code
    const sourceStats = await this.analyzeSource(workspacePath);

    // Generate recommendations
    const recommendations: string[] = [];
    const hasLargeBundle = bundles.some(b => b.isOverLimit);

    if (hasLargeBundle) {
      const largestBundle = bundles.sort((a, b) => b.size - a.size)[0];
      recommendations.push(
        `Bundle ${largestBundle.name} (${this.formatSize(largestBundle.size)}) exceeds limit. Consider code splitting.`
      );
    }

    if (dependencyMetrics.totalDependencies > this.config.maxDependencies!) {
      recommendations.push(
        `${dependencyMetrics.totalDependencies} dependencies is high. Review for unused packages.`
      );
    }

    if (dependencyMetrics.duplicates.length > 0) {
      recommendations.push(
        `Found duplicate packages: ${dependencyMetrics.duplicates.slice(0, 3).join(', ')}. Consider deduping.`
      );
    }

    if (buildMetrics && buildMetrics.duration > this.config.maxBuildTime!) {
      recommendations.push(
        `Build time (${Math.round(buildMetrics.duration / 1000)}s) exceeds limit. Consider build optimization.`
      );
    }

    return {
      bundles,
      totalBundleSize,
      buildMetrics,
      dependencyMetrics,
      sourceStats,
      hasLargeBundle,
      recommendations,
    };
  }

  /**
   * Analyze output bundles
   */
  private async analyzeBundles(workspacePath: string): Promise<BundleInfo[]> {
    const bundles: BundleInfo[] = [];
    const distDirs = [this.config.distDir!, this.config.buildDir!, 'out', '.next', '.output'];

    for (const dirName of distDirs) {
      const dirPath = path.join(workspacePath, dirName);

      if (!await this.directoryExists(dirPath)) continue;

      const bundleFiles = await this.findBundleFiles(dirPath);

      for (const filePath of bundleFiles) {
        const stats = await fs.stat(filePath);
        const relativePath = path.relative(workspacePath, filePath);
        const gzipSize = await this.estimateGzipSize(filePath, stats.size);

        bundles.push({
          name: path.basename(filePath),
          path: relativePath,
          size: stats.size,
          gzipSize,
          isOverLimit: stats.size > this.config.maxBundleSize! ||
            (gzipSize !== undefined && gzipSize > this.config.maxGzipSize!),
        });
      }
    }

    return bundles.sort((a, b) => b.size - a.size);
  }

  /**
   * Find bundle files in directory
   */
  private async findBundleFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const bundleExtensions = ['.js', '.mjs', '.cjs', '.css'];
    const bundlePatterns = ['bundle', 'chunk', 'main', 'app', 'index', 'vendor'];

    async function walkDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            const baseName = path.basename(entry.name, ext).toLowerCase();

            // Include bundle-like files
            if (bundleExtensions.includes(ext)) {
              if (bundlePatterns.some(p => baseName.includes(p)) ||
                /\.[a-f0-9]{8,}\./.test(entry.name)) { // Hash in filename
                files.push(fullPath);
              }
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }

    await walkDir(dirPath);
    return files;
  }

  /**
   * Estimate gzip size (rough estimation without actually compressing)
   */
  private async estimateGzipSize(filePath: string, originalSize: number): Promise<number | undefined> {
    try {
      // Read a sample to estimate compression ratio
      const content = await fs.readFile(filePath, 'utf-8');

      // Estimate compression ratio based on content type
      const ext = path.extname(filePath);
      let compressionRatio = 0.3; // Default 70% compression for text

      if (ext === '.js' || ext === '.mjs') {
        // JavaScript typically compresses well
        compressionRatio = 0.25; // 75% compression
      } else if (ext === '.css') {
        compressionRatio = 0.2; // 80% compression
      }

      // Adjust based on apparent minification
      if (!content.includes('\n') || content.length / content.split('\n').length > 500) {
        // Appears minified, less compressible
        compressionRatio *= 1.3;
      }

      return Math.round(originalSize * compressionRatio);
    } catch {
      return undefined;
    }
  }

  /**
   * Get build metrics from existing build artifacts or logs
   */
  private async getBuildMetrics(workspacePath: string): Promise<BuildMetrics | null> {
    // Try to read build stats from various build tools
    const statsFiles = [
      path.join(workspacePath, 'build-stats.json'),
      path.join(workspacePath, '.next', 'build-manifest.json'),
      path.join(workspacePath, 'dist', '.vite', 'manifest.json'),
      path.join(workspacePath, 'stats.json'),
    ];

    for (const statsFile of statsFiles) {
      const metrics = await this.parseBuildStats(statsFile);
      if (metrics) return metrics;
    }

    // If no stats file, calculate from dist directory
    const distPath = path.join(workspacePath, this.config.distDir!);
    if (await this.directoryExists(distPath)) {
      const stats = await this.calculateDistStats(distPath);
      return {
        duration: 0, // Unknown
        success: true,
        outputSize: stats.totalSize,
        fileCount: stats.fileCount,
        timestamp: new Date(),
      };
    }

    return null;
  }

  /**
   * Parse build stats from stats file
   */
  private async parseBuildStats(statsPath: string): Promise<BuildMetrics | null> {
    try {
      const content = await fs.readFile(statsPath, 'utf-8');
      const stats = JSON.parse(content);

      // Try different formats
      if (stats.time !== undefined) {
        // Webpack stats format
        return {
          duration: stats.time,
          success: !stats.errors?.length,
          outputSize: stats.assets?.reduce((sum: number, a: { size: number }) => sum + (a.size || 0), 0) || 0,
          fileCount: stats.assets?.length || 0,
          timestamp: new Date(stats.builtAt || Date.now()),
        };
      }

      if (stats.buildId) {
        // Next.js format
        const distPath = path.dirname(statsPath);
        const distStats = await this.calculateDistStats(distPath);
        return {
          duration: 0,
          success: true,
          outputSize: distStats.totalSize,
          fileCount: distStats.fileCount,
          timestamp: new Date(),
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Calculate stats for dist directory
   */
  private async calculateDistStats(distPath: string): Promise<{ totalSize: number; fileCount: number }> {
    let totalSize = 0;
    let fileCount = 0;

    async function walkDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            const stats = await fs.stat(fullPath);
            totalSize += stats.size;
            fileCount++;
          }
        }
      } catch {
        // Ignore errors
      }
    }

    await walkDir(distPath);
    return { totalSize, fileCount };
  }

  /**
   * Analyze dependencies
   */
  private async analyzeDependencies(workspacePath: string): Promise<DependencyMetrics> {
    const pkgPath = path.join(workspacePath, 'package.json');

    try {
      const content = await fs.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);

      const directDeps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});

      // Check for duplicates in lock file
      const duplicates = await this.findDuplicateDependencies(workspacePath);

      // Check for outdated (requires npm outdated which we skip for performance)
      const outdatedCount = 0;

      return {
        totalDependencies: directDeps.length + devDeps.length,
        directDependencies: directDeps.length,
        devDependencies: devDeps.length,
        outdatedCount,
        duplicates,
      };
    } catch {
      return {
        totalDependencies: 0,
        directDependencies: 0,
        devDependencies: 0,
        outdatedCount: 0,
        duplicates: [],
      };
    }
  }

  /**
   * Find duplicate dependencies in package-lock.json
   */
  private async findDuplicateDependencies(workspacePath: string): Promise<string[]> {
    const lockPath = path.join(workspacePath, 'package-lock.json');
    const duplicates: string[] = [];

    try {
      const content = await fs.readFile(lockPath, 'utf-8');
      const lock = JSON.parse(content);

      // Count occurrences of each package
      const packageCounts = new Map<string, number>();

      function countPackages(deps: Record<string, unknown> | undefined): void {
        if (!deps) return;

        for (const [name, info] of Object.entries(deps)) {
          // Handle scoped packages
          const cleanName = name.startsWith('node_modules/')
            ? name.replace('node_modules/', '')
            : name;

          packageCounts.set(cleanName, (packageCounts.get(cleanName) || 0) + 1);

          // Recurse into nested dependencies
          if (info && typeof info === 'object' && 'dependencies' in info) {
            countPackages(info.dependencies as Record<string, unknown>);
          }
        }
      }

      // npm v7+ format
      if (lock.packages) {
        countPackages(lock.packages);
      }
      // npm v6 format
      if (lock.dependencies) {
        countPackages(lock.dependencies);
      }

      // Find packages with multiple versions
      for (const [name, count] of packageCounts) {
        if (count > 1 && !name.includes('/node_modules/')) {
          duplicates.push(name);
        }
      }
    } catch {
      // Ignore errors
    }

    return duplicates.slice(0, 10); // Limit to top 10
  }

  /**
   * Analyze source code stats
   */
  private async analyzeSource(workspacePath: string): Promise<SourceStats> {
    const files: Array<{ path: string; lines: number }> = [];
    let totalLines = 0;
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    const ignorePatterns = this.config.ignorePatterns || [];

    async function walkDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(workspacePath, fullPath);

          if (ignorePatterns.some(p => relativePath.includes(p))) {
            continue;
          }

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              try {
                const content = await fs.readFile(fullPath, 'utf-8');
                const lineCount = content.split('\n').length;
                files.push({ path: relativePath, lines: lineCount });
                totalLines += lineCount;
              } catch {
                // Ignore read errors
              }
            }
          }
        }
      } catch {
        // Ignore errors
      }
    }

    await walkDir(workspacePath);

    const largestFiles = files
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 5);

    return {
      totalFiles: files.length,
      totalLines,
      avgLinesPerFile: files.length > 0 ? Math.round(totalLines / files.length) : 0,
      largestFiles,
    };
  }

  /**
   * Check if directory exists
   */
  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Format size in human-readable format
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Evaluate performance against thresholds
   */
  private evaluatePerformance(summary: PerformanceSummary): QualityCheckResult {
    let score = 100;
    const recommendations = [...summary.recommendations];

    // Bundle size penalty
    if (summary.hasLargeBundle) {
      score -= 20;
    }

    // Total bundle size check
    if (summary.totalBundleSize > this.config.maxBundleSize! * 2) {
      score -= 15;
      recommendations.push(`Total bundle size ${this.formatSize(summary.totalBundleSize)} is too large`);
    }

    // Build time penalty
    if (summary.buildMetrics && summary.buildMetrics.duration > this.config.maxBuildTime!) {
      const overBy = summary.buildMetrics.duration - this.config.maxBuildTime!;
      score -= Math.min(20, Math.floor(overBy / 30000) * 5);
    }

    // Dependency count penalty
    if (summary.dependencyMetrics.totalDependencies > this.config.maxDependencies!) {
      const excess = summary.dependencyMetrics.totalDependencies - this.config.maxDependencies!;
      score -= Math.min(10, excess);
    }

    // Duplicate dependencies penalty
    if (summary.dependencyMetrics.duplicates.length > 5) {
      score -= 5;
    }

    // Large source files penalty
    if (summary.sourceStats.largestFiles.some(f => f.lines > 1000)) {
      score -= 5;
      const largeFiles = summary.sourceStats.largestFiles.filter(f => f.lines > 1000);
      recommendations.push(
        `Consider splitting large files: ${largeFiles.map(f => path.basename(f.path)).join(', ')}`
      );
    }

    score = Math.max(0, Math.round(score));
    const passed = !summary.hasLargeBundle && score >= 70;

    const details = summary.bundles.length > 0
      ? `Bundle: ${this.formatSize(summary.totalBundleSize)}, ${summary.bundles.length} files. ` +
      `Dependencies: ${summary.dependencyMetrics.totalDependencies}. ` +
      `Source: ${summary.sourceStats.totalFiles} files, ${summary.sourceStats.totalLines} lines`
      : `No build output found. Dependencies: ${summary.dependencyMetrics.totalDependencies}. ` +
      `Source: ${summary.sourceStats.totalFiles} files, ${summary.sourceStats.totalLines} lines`;

    return {
      dimension: QualityDimension.PERFORMANCE,
      passed,
      score,
      threshold: 70,
      details,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Create result for errors
   */
  private createErrorResult(error: unknown): QualityCheckResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      dimension: QualityDimension.PERFORMANCE,
      passed: false,
      score: 0,
      threshold: 70,
      details: `Error checking performance: ${message}`,
      recommendations: ['Check build output directory', 'Verify project structure'],
    };
  }

  /**
   * Run build and measure time
   */
  async measureBuildTime(workspacePath: string, buildCommand = 'npm run build'): Promise<BuildMetrics> {
    const startTime = Date.now();

    try {
      await execAsync(buildCommand, {
        cwd: workspacePath,
        timeout: this.config.maxBuildTime! * 2,
      });

      const duration = Date.now() - startTime;
      const distPath = path.join(workspacePath, this.config.distDir!);
      const stats = await this.calculateDistStats(distPath);

      return {
        duration,
        success: true,
        outputSize: stats.totalSize,
        fileCount: stats.fileCount,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        duration: Date.now() - startTime,
        success: false,
        outputSize: 0,
        fileCount: 0,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get bundle details
   */
  async getBundleDetails(workspacePath: string): Promise<BundleInfo[]> {
    return this.analyzeBundles(workspacePath);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a performance checker instance
 */
export function createPerformanceChecker(
  config: Partial<PerformanceConfig> = {}
): PerformanceChecker {
  return new PerformanceChecker(config);
}
