/**
 * Test Coverage Checker Tests
 *
 * Tests for the real test coverage checker implementation
 * that parses Jest/Vitest coverage reports.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  TestCoverageChecker,
  createTestCoverageChecker,
  DEFAULT_COVERAGE_CONFIG,
} from '../../../../src/core/quality/checks/test-coverage-checker';
import { QualityDimension } from '../../../../src/core/quality/completion-detector';

describe('TestCoverageChecker', () => {
  let tempDir: string;
  let checker: TestCoverageChecker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coverage-test-'));
    checker = new TestCoverageChecker();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const instance = new TestCoverageChecker();
      expect(instance).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const instance = new TestCoverageChecker({
        minLineCoverage: 90,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('check', () => {
    it('should return no coverage result when no coverage directory exists', async () => {
      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.TEST_COVERAGE);
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(result.details).toContain('No coverage report found');
      expect(result.recommendations).toBeDefined();
    });

    it('should parse JSON coverage summary correctly', async () => {
      // Create coverage directory and summary
      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);

      const coverageSummary = {
        total: {
          lines: { total: 100, covered: 85, skipped: 0, pct: 85 },
          statements: { total: 100, covered: 85, skipped: 0, pct: 85 },
          functions: { total: 20, covered: 18, skipped: 0, pct: 90 },
          branches: { total: 50, covered: 40, skipped: 0, pct: 80 },
        },
        '/path/to/file.ts': {
          lines: { total: 100, covered: 85, skipped: 0, pct: 85 },
          statements: { total: 100, covered: 85, skipped: 0, pct: 85 },
          functions: { total: 20, covered: 18, skipped: 0, pct: 90 },
          branches: { total: 50, covered: 40, skipped: 0, pct: 80 },
        },
      };

      await fs.writeFile(
        path.join(coverageDir, 'coverage-summary.json'),
        JSON.stringify(coverageSummary)
      );

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.TEST_COVERAGE);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThan(80);
      expect(result.details).toContain('85');
    });

    it('should parse lcov format correctly', async () => {
      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);

      const lcovContent = `
SF:/path/to/file.ts
FNF:10
FNH:8
LF:50
LH:40
BRF:20
BRH:15
end_of_record
SF:/path/to/another.ts
FNF:5
FNH:5
LF:30
LH:25
BRF:10
BRH:8
end_of_record
`;

      await fs.writeFile(
        path.join(coverageDir, 'lcov.info'),
        lcovContent
      );

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.TEST_COVERAGE);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should parse cobertura XML format correctly', async () => {
      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);

      const coberturaContent = `<?xml version="1.0"?>
<coverage line-rate="0.85" branch-rate="0.75" lines-valid="100" lines-covered="85" branches-valid="20" branches-covered="15">
  <packages>
    <package name="src" line-rate="0.85" branch-rate="0.75">
      <classes/>
    </package>
  </packages>
</coverage>`;

      await fs.writeFile(
        path.join(coverageDir, 'cobertura-coverage.xml'),
        coberturaContent
      );

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.TEST_COVERAGE);
      expect(result.score).toBeGreaterThan(0);
    });

    it('should fail when coverage is below threshold', async () => {
      const customChecker = new TestCoverageChecker({
        minLineCoverage: 90,
        minBranchCoverage: 85,
      });

      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);

      const coverageSummary = {
        total: {
          lines: { total: 100, covered: 50, skipped: 0, pct: 50 },
          statements: { total: 100, covered: 50, skipped: 0, pct: 50 },
          functions: { total: 20, covered: 10, skipped: 0, pct: 50 },
          branches: { total: 50, covered: 25, skipped: 0, pct: 50 },
        },
      };

      await fs.writeFile(
        path.join(coverageDir, 'coverage-summary.json'),
        JSON.stringify(coverageSummary)
      );

      const result = await customChecker.check(tempDir);

      expect(result.passed).toBe(false);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.length).toBeGreaterThan(0);
    });
  });

  describe('getCoverageSummary', () => {
    it('should return null when no coverage exists', async () => {
      const summary = await checker.getCoverageSummary(tempDir);
      expect(summary).toBeNull();
    });

    it('should prefer JSON summary over lcov', async () => {
      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);

      const coverageSummary = {
        total: {
          lines: { total: 100, covered: 95, skipped: 0, pct: 95 },
          statements: { total: 100, covered: 95, skipped: 0, pct: 95 },
          functions: { total: 20, covered: 19, skipped: 0, pct: 95 },
          branches: { total: 50, covered: 48, skipped: 0, pct: 96 },
        },
      };

      await fs.writeFile(
        path.join(coverageDir, 'coverage-summary.json'),
        JSON.stringify(coverageSummary)
      );

      // Also create lcov with different values
      await fs.writeFile(
        path.join(coverageDir, 'lcov.info'),
        'SF:/test\nLF:10\nLH:5\nend_of_record'
      );

      const summary = await checker.getCoverageSummary(tempDir);

      expect(summary).not.toBeNull();
      expect(summary!.lines.pct).toBe(95);
    });
  });

  describe('getDetailedCoverage', () => {
    it('should return empty array when no coverage', async () => {
      const files = await checker.getDetailedCoverage(tempDir);
      expect(files).toEqual([]);
    });

    it('should return file details from coverage summary', async () => {
      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);

      const coverageSummary = {
        total: {
          lines: { total: 100, covered: 85, skipped: 0, pct: 85 },
          statements: { total: 100, covered: 85, skipped: 0, pct: 85 },
          functions: { total: 20, covered: 18, skipped: 0, pct: 90 },
          branches: { total: 50, covered: 40, skipped: 0, pct: 80 },
        },
        '/path/to/file1.ts': {
          lines: { total: 60, covered: 50, skipped: 0, pct: 83.33 },
          statements: { total: 60, covered: 50, skipped: 0, pct: 83.33 },
          functions: { total: 10, covered: 9, skipped: 0, pct: 90 },
          branches: { total: 30, covered: 24, skipped: 0, pct: 80 },
        },
        '/path/to/file2.ts': {
          lines: { total: 40, covered: 35, skipped: 0, pct: 87.5 },
          statements: { total: 40, covered: 35, skipped: 0, pct: 87.5 },
          functions: { total: 10, covered: 9, skipped: 0, pct: 90 },
          branches: { total: 20, covered: 16, skipped: 0, pct: 80 },
        },
      };

      await fs.writeFile(
        path.join(coverageDir, 'coverage-summary.json'),
        JSON.stringify(coverageSummary)
      );

      const files = await checker.getDetailedCoverage(tempDir);

      expect(files.length).toBe(2);
      expect(files[0].path).toContain('file');
    });
  });

  describe('getUncoveredFiles', () => {
    it('should return files below threshold', async () => {
      const coverageDir = path.join(tempDir, 'coverage');
      await fs.mkdir(coverageDir);

      const coverageSummary = {
        total: {
          lines: { total: 100, covered: 70, skipped: 0, pct: 70 },
          statements: { total: 100, covered: 70, skipped: 0, pct: 70 },
          functions: { total: 20, covered: 14, skipped: 0, pct: 70 },
          branches: { total: 50, covered: 35, skipped: 0, pct: 70 },
        },
        '/path/to/low.ts': {
          lines: { total: 50, covered: 10, skipped: 0, pct: 20 },
          statements: { total: 50, covered: 10, skipped: 0, pct: 20 },
          functions: { total: 10, covered: 2, skipped: 0, pct: 20 },
          branches: { total: 20, covered: 4, skipped: 0, pct: 20 },
        },
        '/path/to/high.ts': {
          lines: { total: 50, covered: 45, skipped: 0, pct: 90 },
          statements: { total: 50, covered: 45, skipped: 0, pct: 90 },
          functions: { total: 10, covered: 9, skipped: 0, pct: 90 },
          branches: { total: 20, covered: 18, skipped: 0, pct: 90 },
        },
      };

      await fs.writeFile(
        path.join(coverageDir, 'coverage-summary.json'),
        JSON.stringify(coverageSummary)
      );

      const uncovered = await checker.getUncoveredFiles(tempDir, 50);

      expect(uncovered.length).toBe(1);
      expect(uncovered[0]).toContain('low');
    });
  });

  describe('createTestCoverageChecker', () => {
    it('should create instance with factory function', () => {
      const instance = createTestCoverageChecker();
      expect(instance).toBeInstanceOf(TestCoverageChecker);
    });

    it('should accept custom config', () => {
      const instance = createTestCoverageChecker({
        minLineCoverage: 95,
        coverageDir: 'custom-coverage',
      });
      expect(instance).toBeInstanceOf(TestCoverageChecker);
    });
  });

  describe('DEFAULT_COVERAGE_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_COVERAGE_CONFIG.minLineCoverage).toBe(80);
      expect(DEFAULT_COVERAGE_CONFIG.minBranchCoverage).toBe(70);
      expect(DEFAULT_COVERAGE_CONFIG.minFunctionCoverage).toBe(80);
      expect(DEFAULT_COVERAGE_CONFIG.coverageDir).toBe('coverage');
    });
  });
});
