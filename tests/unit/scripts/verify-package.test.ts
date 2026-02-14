/**
 * Tests for verify-package script
 *
 * Validates the verification logic without running actual npm pack.
 */

import {
  checkRequiredFiles,
  checkExcludedFiles,
  checkPackageSize,
  printReport,
} from '../../../scripts/verify-package';

describe('verify-package', () => {
  describe('checkRequiredFiles', () => {
    it('should pass when all required files are present', () => {
      const packed = ['dist/index.js', 'dist/index.d.ts', 'README.md', 'package.json'];
      const results = checkRequiredFiles(packed);
      expect(results.every((r) => r.passed)).toBe(true);
      expect(results).toHaveLength(3);
    });

    it('should fail when a required file is missing', () => {
      const packed = ['dist/index.js', 'package.json'];
      const results = checkRequiredFiles(packed);
      const failing = results.filter((r) => !r.passed);
      expect(failing.length).toBeGreaterThan(0);
      expect(failing.some((r) => r.label.includes('dist/index.d.ts'))).toBe(true);
    });

    it('should fail when packed list is empty', () => {
      const results = checkRequiredFiles([]);
      expect(results.every((r) => !r.passed)).toBe(true);
    });
  });

  describe('checkExcludedFiles', () => {
    it('should pass when no excluded patterns appear', () => {
      const packed = ['dist/index.js', 'dist/index.d.ts', 'README.md'];
      const results = checkExcludedFiles(packed);
      expect(results.every((r) => r.passed)).toBe(true);
    });

    it('should fail when src/ files leak into package', () => {
      const packed = ['dist/index.js', 'src/index.ts'];
      const results = checkExcludedFiles(packed);
      const srcResult = results.find((r) => r.label.includes('src/'));
      expect(srcResult?.passed).toBe(false);
    });

    it('should fail when .env leaks into package', () => {
      const packed = ['dist/index.js', '.env'];
      const results = checkExcludedFiles(packed);
      const envResult = results.find((r) => r.label.includes('.env'));
      expect(envResult?.passed).toBe(false);
    });

    it('should fail when tests/ leak into package', () => {
      const packed = ['dist/index.js', 'tests/unit/foo.test.ts'];
      const results = checkExcludedFiles(packed);
      const testsResult = results.find((r) => r.label.includes('tests/'));
      expect(testsResult?.passed).toBe(false);
    });
  });

  describe('checkPackageSize', () => {
    it('should pass for a package under 10MB', () => {
      const result = checkPackageSize(5 * 1024 * 1024); // 5 MB
      expect(result.passed).toBe(true);
    });

    it('should fail for a package over 10MB', () => {
      const result = checkPackageSize(15 * 1024 * 1024); // 15 MB
      expect(result.passed).toBe(false);
    });

    it('should pass for a tiny package', () => {
      const result = checkPackageSize(1024); // 1 KB
      expect(result.passed).toBe(true);
    });
  });

  describe('printReport', () => {
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    it('should return true when all checks pass', () => {
      const results = [
        { passed: true, label: 'check 1', detail: 'ok' },
        { passed: true, label: 'check 2', detail: 'ok' },
      ];
      expect(printReport(results)).toBe(true);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('ALL CHECKS PASSED'));
    });

    it('should return false when any check fails', () => {
      const results = [
        { passed: true, label: 'check 1', detail: 'ok' },
        { passed: false, label: 'check 2', detail: 'bad' },
      ];
      expect(printReport(results)).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SOME CHECKS FAILED'));
    });
  });
});
