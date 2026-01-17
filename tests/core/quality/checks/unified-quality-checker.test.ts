/**
 * Unified Quality Checker Tests
 *
 * Tests for the unified quality checker that runs all quality checks.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  UnifiedQualityChecker,
  createUnifiedQualityChecker,
} from '../../../../src/core/quality/checks/index';
import { QualityDimension } from '../../../../src/core/quality/completion-detector';

describe('UnifiedQualityChecker', () => {
  let tempDir: string;
  let checker: UnifiedQualityChecker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unified-test-'));
    checker = new UnifiedQualityChecker({
      security: { runAudit: false }, // Disable npm audit for tests
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const instance = new UnifiedQualityChecker();
      expect(instance).toBeDefined();
    });

    it('should accept custom config for each checker', () => {
      const instance = new UnifiedQualityChecker({
        coverage: { minLineCoverage: 90 },
        codeQuality: { maxCyclomaticComplexity: 15 },
        documentation: { minCoverage: 80 },
        security: { runAudit: false },
        performance: { maxBundleSize: 1024 * 1024 },
      });
      expect(instance).toBeDefined();
    });
  });

  describe('checkAll', () => {
    it('should run all quality checks', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} })
      );

      const results = await checker.checkAll(tempDir);

      expect(results.coverage).toBeDefined();
      expect(results.codeQuality).toBeDefined();
      expect(results.documentation).toBeDefined();
      expect(results.security).toBeDefined();
      expect(results.performance).toBeDefined();
      expect(results.overallScore).toBeGreaterThanOrEqual(0);
      expect(results.timestamp).toBeInstanceOf(Date);
    });

    it('should calculate weighted overall score', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} })
      );

      const results = await checker.checkAll(tempDir);

      // Overall score should be between 0 and 100
      expect(results.overallScore).toBeGreaterThanOrEqual(0);
      expect(results.overallScore).toBeLessThanOrEqual(100);
    });

    it('should correctly report dimensions', async () => {
      await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');

      const results = await checker.checkAll(tempDir);

      expect(results.coverage.dimension).toBe(QualityDimension.TEST_COVERAGE);
      expect(results.codeQuality.dimension).toBe(QualityDimension.CODE_QUALITY);
      expect(results.documentation.dimension).toBe(QualityDimension.DOCUMENTATION);
      expect(results.security.dimension).toBe(QualityDimension.SECURITY);
      expect(results.performance.dimension).toBe(QualityDimension.PERFORMANCE);
    });

    it('should fail overall when security fails', async () => {
      // Create file with exposed secret
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);
      await fs.writeFile(
        path.join(srcDir, 'config.ts'),
        'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz123";'
      );

      const results = await checker.checkAll(tempDir);

      expect(results.security.passed).toBe(false);
      expect(results.overallPassed).toBe(false);
    });
  });

  describe('checkDimension', () => {
    it('should run individual coverage check', async () => {
      const result = await checker.checkDimension(tempDir, 'coverage');

      expect(result.dimension).toBe(QualityDimension.TEST_COVERAGE);
    });

    it('should run individual code quality check', async () => {
      const result = await checker.checkDimension(tempDir, 'codeQuality');

      expect(result.dimension).toBe(QualityDimension.CODE_QUALITY);
    });

    it('should run individual documentation check', async () => {
      const result = await checker.checkDimension(tempDir, 'documentation');

      expect(result.dimension).toBe(QualityDimension.DOCUMENTATION);
    });

    it('should run individual security check', async () => {
      const result = await checker.checkDimension(tempDir, 'security');

      expect(result.dimension).toBe(QualityDimension.SECURITY);
    });

    it('should run individual performance check', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', dependencies: {} })
      );

      const result = await checker.checkDimension(tempDir, 'performance');

      expect(result.dimension).toBe(QualityDimension.PERFORMANCE);
    });
  });

  describe('getCheckers', () => {
    it('should return all individual checkers', () => {
      const checkers = checker.getCheckers();

      expect(checkers.coverage).toBeDefined();
      expect(checkers.codeQuality).toBeDefined();
      expect(checkers.documentation).toBeDefined();
      expect(checkers.security).toBeDefined();
      expect(checkers.performance).toBeDefined();
    });

    it('should allow direct access to checker methods', async () => {
      const checkers = checker.getCheckers();

      // Create coverage summary
      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);
      await fs.writeFile(
        path.join(coverageDir, 'coverage-summary.json'),
        JSON.stringify({
          total: {
            lines: { total: 100, covered: 80, pct: 80 },
            statements: { total: 100, covered: 80, pct: 80 },
            functions: { total: 20, covered: 16, pct: 80 },
            branches: { total: 40, covered: 32, pct: 80 },
          },
        })
      );

      const summary = await checkers.coverage.getCoverageSummary(tempDir);

      expect(summary).not.toBeNull();
      expect(summary!.lines.pct).toBe(80);
    });
  });

  describe('createUnifiedQualityChecker', () => {
    it('should create instance with factory function', () => {
      const instance = createUnifiedQualityChecker();
      expect(instance).toBeInstanceOf(UnifiedQualityChecker);
    });

    it('should accept custom config', () => {
      const instance = createUnifiedQualityChecker({
        coverage: { minLineCoverage: 85 },
        security: { runAudit: false },
      });
      expect(instance).toBeInstanceOf(UnifiedQualityChecker);
    });
  });
});
