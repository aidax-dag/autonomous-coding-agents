import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyzeBundle,
  checkBundleLimits,
  detectRegressions,
  generateBundleReport,
} from '../../../scripts/bundle-analysis';

/**
 * Bundle Analysis Tests
 *
 * Tests bundle size monitoring: size calculation, category grouping,
 * limit enforcement, regression detection, and report generation.
 */

jest.mock('node:fs');

const mockFs = fs as jest.Mocked<typeof fs>;

function createMockDirent(name: string, isDir: boolean): fs.Dirent {
  return {
    name,
    isFile: () => !isDir,
    isDirectory: () => isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    parentPath: '',
    path: '',
  } as fs.Dirent;
}

function setupMockFileSystem(files: { relativePath: string; size: number }[]): void {
  const dirContents = new Map<string, fs.Dirent[]>();

  // Collect all directories and their contents
  for (const file of files) {
    const parts = file.relativePath.split('/');
    let currentDir = '/dist';

    for (let i = 0; i < parts.length - 1; i++) {
      const parentDir = currentDir;
      currentDir = path.join(currentDir, parts[i]);
      const parentEntries = dirContents.get(parentDir) ?? [];
      if (!parentEntries.some((e) => e.name === parts[i])) {
        parentEntries.push(createMockDirent(parts[i], true));
        dirContents.set(parentDir, parentEntries);
      }
    }

    const fileName = parts[parts.length - 1];
    const fileDir = parts.length > 1 ? path.join('/dist', ...parts.slice(0, -1)) : '/dist';
    const entries = dirContents.get(fileDir) ?? [];
    entries.push(createMockDirent(fileName, false));
    dirContents.set(fileDir, entries);
  }

  mockFs.existsSync.mockImplementation((p: fs.PathLike) => {
    const pathStr = p.toString();
    return pathStr === '/dist' || dirContents.has(pathStr) || files.some((f) => path.join('/dist', f.relativePath) === pathStr);
  });

  mockFs.readdirSync.mockImplementation((p: unknown) => {
    const pathStr = (p as fs.PathLike).toString();
    return (dirContents.get(pathStr) ?? []) as unknown as ReturnType<typeof fs.readdirSync>;
  });

  mockFs.statSync.mockImplementation((p: unknown) => {
    const pathStr = (p as fs.PathLike).toString();
    const file = files.find((f) => path.join('/dist', f.relativePath) === pathStr);
    return { size: file?.size ?? 0 } as fs.Stats;
  });
}

describe('Bundle Analysis', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('analyzeBundle', () => {
    it('should calculate total size from all files', () => {
      setupMockFileSystem([
        { relativePath: 'core/index.js', size: 1000 },
        { relativePath: 'core/utils.js', size: 500 },
        { relativePath: 'api/server.js', size: 800 },
      ]);

      const result = analyzeBundle('/dist');

      expect(result.totalSize).toBe(2300);
      expect(result.fileCount).toBe(3);
    });

    it('should return per-file sizes', () => {
      setupMockFileSystem([
        { relativePath: 'core/index.js', size: 1000 },
        { relativePath: 'shared/utils.js', size: 500 },
      ]);

      const result = analyzeBundle('/dist');

      expect(result.files).toHaveLength(2);
      expect(result.files.find((f) => f.relativePath === 'core/index.js')?.size).toBe(1000);
      expect(result.files.find((f) => f.relativePath === 'shared/utils.js')?.size).toBe(500);
    });

    it('should return top 10 largest files sorted by size descending', () => {
      const files = Array.from({ length: 15 }, (_, i) => ({
        relativePath: `core/file${i}.js`,
        size: (i + 1) * 100,
      }));
      setupMockFileSystem(files);

      const result = analyzeBundle('/dist');

      expect(result.largestFiles).toHaveLength(10);
      expect(result.largestFiles[0].size).toBe(1500);
      expect(result.largestFiles[9].size).toBe(600);
    });

    it('should handle empty dist directory', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([] as unknown as ReturnType<typeof fs.readdirSync>);

      const result = analyzeBundle('/dist');

      expect(result.totalSize).toBe(0);
      expect(result.fileCount).toBe(0);
      expect(result.files).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.largestFiles).toEqual([]);
    });

    it('should handle non-existent dist directory', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = analyzeBundle('/dist');

      expect(result.totalSize).toBe(0);
      expect(result.fileCount).toBe(0);
    });
  });

  describe('category grouping', () => {
    it('should group files by category based on path prefix', () => {
      setupMockFileSystem([
        { relativePath: 'core/index.js', size: 1000 },
        { relativePath: 'core/engine.js', size: 2000 },
        { relativePath: 'api/routes.js', size: 800 },
        { relativePath: 'cli/main.js', size: 600 },
        { relativePath: 'shared/utils.js', size: 400 },
        { relativePath: 'platform/node.js', size: 300 },
      ]);

      const result = analyzeBundle('/dist');

      const coreCategory = result.categories.find((c) => c.category === 'core');
      expect(coreCategory?.totalSize).toBe(3000);
      expect(coreCategory?.fileCount).toBe(2);

      const apiCategory = result.categories.find((c) => c.category === 'api');
      expect(apiCategory?.totalSize).toBe(800);
      expect(apiCategory?.fileCount).toBe(1);
    });

    it('should assign uncategorized files to other', () => {
      setupMockFileSystem([
        { relativePath: 'index.js', size: 500 },
      ]);

      mockFs.readdirSync.mockImplementation((p: unknown) => {
        const pathStr = (p as fs.PathLike).toString();
        if (pathStr === '/dist') {
          return [createMockDirent('index.js', false)] as unknown as ReturnType<typeof fs.readdirSync>;
        }
        return [] as unknown as ReturnType<typeof fs.readdirSync>;
      });

      const result = analyzeBundle('/dist');

      expect(result.files[0].category).toBe('other');
    });

    it('should sort categories by total size descending', () => {
      setupMockFileSystem([
        { relativePath: 'shared/big.js', size: 5000 },
        { relativePath: 'core/medium.js', size: 3000 },
        { relativePath: 'api/small.js', size: 1000 },
      ]);

      const result = analyzeBundle('/dist');

      expect(result.categories[0].category).toBe('shared');
      expect(result.categories[1].category).toBe('core');
      expect(result.categories[2].category).toBe('api');
    });
  });

  describe('checkBundleLimits', () => {
    const defaultLimits = {
      total: 20 * 1024 * 1024,
      singleFile: 2 * 1024 * 1024,
      categories: {
        core: 5 * 1024 * 1024,
        api: 3 * 1024 * 1024,
      },
    };

    it('should pass when all sizes are within limits', () => {
      const analysis = {
        totalSize: 1000,
        fileCount: 2,
        files: [
          { filePath: '/dist/core/a.js', relativePath: 'core/a.js', size: 500, category: 'core' },
          { filePath: '/dist/api/b.js', relativePath: 'api/b.js', size: 500, category: 'api' },
        ],
        categories: [
          { category: 'core', totalSize: 500, fileCount: 1 },
          { category: 'api', totalSize: 500, fileCount: 1 },
        ],
        largestFiles: [],
      };

      const result = checkBundleLimits(analysis, defaultLimits);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail when total size exceeds limit', () => {
      const analysis = {
        totalSize: 25 * 1024 * 1024,
        fileCount: 1,
        files: [{ filePath: '/dist/big.js', relativePath: 'big.js', size: 1000, category: 'other' }],
        categories: [],
        largestFiles: [],
      };

      const result = checkBundleLimits(analysis, defaultLimits);

      expect(result.passed).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'total' }),
        ])
      );
    });

    it('should fail when a single file exceeds limit', () => {
      const analysis = {
        totalSize: 3 * 1024 * 1024,
        fileCount: 1,
        files: [{ filePath: '/dist/huge.js', relativePath: 'huge.js', size: 3 * 1024 * 1024, category: 'other' }],
        categories: [],
        largestFiles: [],
      };

      const result = checkBundleLimits(analysis, defaultLimits);

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.type === 'singleFile')).toBe(true);
    });

    it('should fail when category size exceeds limit', () => {
      const analysis = {
        totalSize: 6 * 1024 * 1024,
        fileCount: 1,
        files: [{ filePath: '/dist/core/big.js', relativePath: 'core/big.js', size: 1000, category: 'core' }],
        categories: [{ category: 'core', totalSize: 6 * 1024 * 1024, fileCount: 1 }],
        largestFiles: [],
      };

      const result = checkBundleLimits(analysis, defaultLimits);

      expect(result.passed).toBe(false);
      expect(result.violations.some((v) => v.type === 'category' && v.label.includes('core'))).toBe(true);
    });

    it('should report multiple violations', () => {
      const analysis = {
        totalSize: 25 * 1024 * 1024,
        fileCount: 1,
        files: [{ filePath: '/dist/core/huge.js', relativePath: 'core/huge.js', size: 3 * 1024 * 1024, category: 'core' }],
        categories: [{ category: 'core', totalSize: 6 * 1024 * 1024, fileCount: 1 }],
        largestFiles: [],
      };

      const result = checkBundleLimits(analysis, defaultLimits);

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('detectRegressions', () => {
    it('should detect size regression above threshold', () => {
      const analysis = {
        totalSize: 12000,
        fileCount: 2,
        files: [],
        categories: [{ category: 'core', totalSize: 8000, fileCount: 1 }],
        largestFiles: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ totalSize: 10000, categories: { core: 6000 } })
      );

      const regressions = detectRegressions(analysis, '/baseline.json', 10);

      expect(regressions.length).toBeGreaterThanOrEqual(1);
      expect(regressions.some((r) => r.label === 'Total size')).toBe(true);
    });

    it('should not flag changes within threshold', () => {
      const analysis = {
        totalSize: 10500,
        fileCount: 1,
        files: [],
        categories: [{ category: 'core', totalSize: 6300, fileCount: 1 }],
        largestFiles: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ totalSize: 10000, categories: { core: 6000 } })
      );

      const regressions = detectRegressions(analysis, '/baseline.json', 10);

      expect(regressions).toHaveLength(0);
    });

    it('should return empty array when baseline does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const analysis = {
        totalSize: 10000,
        fileCount: 1,
        files: [],
        categories: [],
        largestFiles: [],
      };

      const regressions = detectRegressions(analysis, '/missing.json');

      expect(regressions).toHaveLength(0);
    });

    it('should detect per-category regressions', () => {
      const analysis = {
        totalSize: 10000,
        fileCount: 2,
        files: [],
        categories: [
          { category: 'core', totalSize: 8000, fileCount: 1 },
          { category: 'api', totalSize: 2000, fileCount: 1 },
        ],
        largestFiles: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ totalSize: 10000, categories: { core: 5000, api: 2000 } })
      );

      const regressions = detectRegressions(analysis, '/baseline.json', 10);

      expect(regressions.some((r) => r.label.includes('core'))).toBe(true);
      expect(regressions.some((r) => r.label.includes('api'))).toBe(false);
    });
  });

  describe('generateBundleReport', () => {
    it('should include total size and file count', () => {
      const analysis = {
        totalSize: 5000,
        fileCount: 3,
        files: [],
        categories: [],
        largestFiles: [],
      };
      const limitResult = { passed: true, violations: [] };

      const report = generateBundleReport(analysis, limitResult, []);

      expect(report).toContain('Bundle Size Analysis');
      expect(report).toContain('File count: 3');
      expect(report).toContain('Result: PASS');
    });

    it('should include largest files section', () => {
      const analysis = {
        totalSize: 2000,
        fileCount: 2,
        files: [],
        categories: [],
        largestFiles: [
          { filePath: '/dist/core/big.js', relativePath: 'core/big.js', size: 1200, category: 'core' },
          { filePath: '/dist/api/small.js', relativePath: 'api/small.js', size: 800, category: 'api' },
        ],
      };
      const limitResult = { passed: true, violations: [] };

      const report = generateBundleReport(analysis, limitResult, []);

      expect(report).toContain('Top 10 Largest Files');
      expect(report).toContain('core/big.js');
      expect(report).toContain('api/small.js');
    });

    it('should include category breakdown', () => {
      const analysis = {
        totalSize: 3000,
        fileCount: 3,
        files: [],
        categories: [
          { category: 'core', totalSize: 2000, fileCount: 2 },
          { category: 'api', totalSize: 1000, fileCount: 1 },
        ],
        largestFiles: [],
      };
      const limitResult = { passed: true, violations: [] };

      const report = generateBundleReport(analysis, limitResult, []);

      expect(report).toContain('Category Breakdown');
      expect(report).toContain('core');
      expect(report).toContain('api');
    });

    it('should include violation details when limits fail', () => {
      const analysis = {
        totalSize: 25 * 1024 * 1024,
        fileCount: 1,
        files: [],
        categories: [],
        largestFiles: [],
      };
      const limitResult = {
        passed: false,
        violations: [
          { type: 'total' as const, label: 'Total bundle size', actual: 25 * 1024 * 1024, limit: 20 * 1024 * 1024 },
        ],
      };

      const report = generateBundleReport(analysis, limitResult, []);

      expect(report).toContain('Limit Violations');
      expect(report).toContain('FAIL');
      expect(report).toContain('Total bundle size');
    });

    it('should include regression warnings', () => {
      const analysis = {
        totalSize: 12000,
        fileCount: 1,
        files: [],
        categories: [],
        largestFiles: [],
      };
      const limitResult = { passed: true, violations: [] };
      const regressions = [
        { label: 'Total size', previous: 10000, current: 12000, delta: 2000, percentChange: 20 },
      ];

      const report = generateBundleReport(analysis, limitResult, regressions);

      expect(report).toContain('Size Regressions');
      expect(report).toContain('REGRESSION');
      expect(report).toContain('Total size');
      expect(report).toContain('20.0%');
      expect(report).toContain('Result: FAIL');
    });

    it('should report PASS when no violations and no regressions', () => {
      const analysis = {
        totalSize: 1000,
        fileCount: 1,
        files: [],
        categories: [],
        largestFiles: [],
      };
      const limitResult = { passed: true, violations: [] };

      const report = generateBundleReport(analysis, limitResult, []);

      expect(report).toContain('Result: PASS');
    });
  });
});
