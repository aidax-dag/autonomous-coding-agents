/**
 * Performance Checker Tests
 *
 * Tests for the real performance checker implementation
 * that analyzes bundle size and build metrics.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  PerformanceChecker,
  createPerformanceChecker,
  DEFAULT_PERFORMANCE_CONFIG,
} from '../../../../src/core/quality/checks/performance-checker';
import { QualityDimension } from '../../../../src/core/quality/completion-detector';

describe('PerformanceChecker', () => {
  let tempDir: string;
  let checker: PerformanceChecker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'perf-test-'));
    checker = new PerformanceChecker();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const instance = new PerformanceChecker();
      expect(instance).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const instance = new PerformanceChecker({
        maxBundleSize: 1024 * 1024, // 1MB
        maxBuildTime: 60000,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('check', () => {
    it('should handle workspace without build output', async () => {
      // Create minimal package.json
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} })
      );

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.PERFORMANCE);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should analyze dist directory', async () => {
      const distDir = path.join(tempDir, 'dist');
      await fs.mkdir(distDir);

      // Create a bundle file
      await fs.writeFile(
        path.join(distDir, 'bundle.js'),
        'const x = 1;'.repeat(1000)
      );

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: { lodash: '^4.0.0' } })
      );

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.PERFORMANCE);
      expect(result.details).toContain('Bundle');
    });

    it('should detect large bundles', async () => {
      const distDir = path.join(tempDir, 'dist');
      await fs.mkdir(distDir);

      // Create a large bundle file (> 500KB)
      await fs.writeFile(
        path.join(distDir, 'bundle.js'),
        'x'.repeat(600 * 1024)
      );

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} })
      );

      const result = await checker.check(tempDir);

      expect(result.passed).toBe(false);
      expect(result.recommendations).toBeDefined();
    });

    it('should check dependency count', async () => {
      // Create package.json with many dependencies
      const manyDeps: Record<string, string> = {};
      for (let i = 0; i < 150; i++) {
        manyDeps[`package-${i}`] = '1.0.0';
      }

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: manyDeps })
      );

      const result = await checker.check(tempDir);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.some(r => r.includes('dependencies'))).toBe(true);
    });
  });

  describe('getPerformanceSummary', () => {
    it('should analyze bundles', async () => {
      const distDir = path.join(tempDir, 'dist');
      await fs.mkdir(distDir);

      await fs.writeFile(path.join(distDir, 'main.bundle.js'), 'const main = 1;');
      await fs.writeFile(path.join(distDir, 'vendor.chunk.js'), 'const vendor = 1;');

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} })
      );

      const summary = await checker.getPerformanceSummary(tempDir);

      expect(summary.bundles.length).toBeGreaterThan(0);
    });

    it('should count dependencies', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          dependencies: { a: '1.0.0', b: '1.0.0' },
          devDependencies: { c: '1.0.0' },
        })
      );

      const summary = await checker.getPerformanceSummary(tempDir);

      expect(summary.dependencyMetrics.directDependencies).toBe(2);
      expect(summary.dependencyMetrics.devDependencies).toBe(1);
      expect(summary.dependencyMetrics.totalDependencies).toBe(3);
    });

    it('should analyze source stats', async () => {
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      await fs.writeFile(path.join(srcDir, 'index.ts'), 'export const x = 1;\n'.repeat(50));
      await fs.writeFile(path.join(srcDir, 'utils.ts'), 'export const y = 2;\n'.repeat(100));

      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} })
      );

      const summary = await checker.getPerformanceSummary(tempDir);

      expect(summary.sourceStats.totalFiles).toBe(2);
      expect(summary.sourceStats.totalLines).toBeGreaterThan(0);
    });
  });

  describe('getBundleDetails', () => {
    it('should return bundle information', async () => {
      const distDir = path.join(tempDir, 'dist');
      await fs.mkdir(distDir);

      await fs.writeFile(path.join(distDir, 'app.bundle.js'), 'const app = 1;'.repeat(100));

      const bundles = await checker.getBundleDetails(tempDir);

      expect(bundles.length).toBe(1);
      expect(bundles[0].name).toBe('app.bundle.js');
      expect(bundles[0].size).toBeGreaterThan(0);
    });

    it('should detect hashed bundles', async () => {
      const distDir = path.join(tempDir, 'dist');
      await fs.mkdir(distDir);

      await fs.writeFile(path.join(distDir, 'main.abc12345.js'), 'const main = 1;');

      const bundles = await checker.getBundleDetails(tempDir);

      expect(bundles.length).toBe(1);
    });

    it('should check multiple dist directories', async () => {
      // Create .next directory (Next.js)
      const nextDir = path.join(tempDir, '.next', 'static', 'chunks');
      await fs.mkdir(nextDir, { recursive: true });
      await fs.writeFile(path.join(nextDir, 'main.bundle.js'), 'const next = 1;');

      const bundles = await checker.getBundleDetails(tempDir);

      expect(bundles.length).toBeGreaterThan(0);
    });
  });

  describe('measureBuildTime', () => {
    it('should handle missing build command', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          scripts: {},
        })
      );

      const metrics = await checker.measureBuildTime(tempDir, 'npm run nonexistent');

      expect(metrics.success).toBe(false);
    });
  });

  describe('createPerformanceChecker', () => {
    it('should create instance with factory function', () => {
      const instance = createPerformanceChecker();
      expect(instance).toBeInstanceOf(PerformanceChecker);
    });

    it('should accept custom config', () => {
      const instance = createPerformanceChecker({
        maxBundleSize: 1024 * 1024,
        distDir: 'output',
      });
      expect(instance).toBeInstanceOf(PerformanceChecker);
    });
  });

  describe('DEFAULT_PERFORMANCE_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_PERFORMANCE_CONFIG.maxBundleSize).toBe(500 * 1024);
      expect(DEFAULT_PERFORMANCE_CONFIG.maxGzipSize).toBe(150 * 1024);
      expect(DEFAULT_PERFORMANCE_CONFIG.maxBuildTime).toBe(120000);
      expect(DEFAULT_PERFORMANCE_CONFIG.maxDependencies).toBe(100);
      expect(DEFAULT_PERFORMANCE_CONFIG.distDir).toBe('dist');
    });
  });
});
