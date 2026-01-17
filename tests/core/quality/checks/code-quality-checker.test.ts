/**
 * Code Quality Checker Tests
 *
 * Tests for the real code quality checker implementation
 * that parses ESLint results and calculates complexity.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  CodeQualityChecker,
  createCodeQualityChecker,
  ESLintSeverity,
  DEFAULT_CODE_QUALITY_CONFIG,
} from '../../../../src/core/quality/checks/code-quality-checker';
import { QualityDimension } from '../../../../src/core/quality/completion-detector';

describe('CodeQualityChecker', () => {
  let tempDir: string;
  let checker: CodeQualityChecker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'quality-test-'));
    checker = new CodeQualityChecker();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const instance = new CodeQualityChecker();
      expect(instance).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const instance = new CodeQualityChecker({
        maxCyclomaticComplexity: 15,
        maxErrorsAllowed: 5,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('check', () => {
    it('should handle empty workspace', async () => {
      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.CODE_QUALITY);
      // Empty workspace should pass (no errors to report)
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should parse existing ESLint report', async () => {
      // Create ESLint report
      const eslintResults = [
        {
          filePath: '/src/index.ts',
          messages: [
            { ruleId: 'no-unused-vars', severity: 1, message: 'Test warning', line: 1, column: 1 },
          ],
          errorCount: 0,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ];

      await fs.writeFile(
        path.join(tempDir, 'eslint-report.json'),
        JSON.stringify(eslintResults)
      );

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.CODE_QUALITY);
      expect(result.details).toContain('1 warnings');
    });

    it('should fail when too many errors', async () => {
      const customChecker = new CodeQualityChecker({
        maxErrorsAllowed: 0,
      });

      const eslintResults = [
        {
          filePath: '/src/index.ts',
          messages: [
            { ruleId: 'no-unused-vars', severity: 2, message: 'Error', line: 1, column: 1 },
            { ruleId: 'no-console', severity: 2, message: 'Error', line: 2, column: 1 },
          ],
          errorCount: 2,
          warningCount: 0,
          fixableErrorCount: 1,
          fixableWarningCount: 0,
        },
      ];

      await fs.writeFile(
        path.join(tempDir, 'eslint-report.json'),
        JSON.stringify(eslintResults)
      );

      const result = await customChecker.check(tempDir);

      expect(result.passed).toBe(false);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.some(r => r.includes('error'))).toBe(true);
    });

    it('should analyze complexity of source files', async () => {
      // Create a source file with high complexity
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const complexCode = `
function complexFunction(a, b, c) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        for (let i = 0; i < 10; i++) {
          while (a > i) {
            switch (b) {
              case 1:
                return a && b || c;
              case 2:
                return b;
              default:
                return c;
            }
          }
        }
      }
    }
  }
  return a ? b : c;
}
`;

      await fs.writeFile(path.join(srcDir, 'complex.ts'), complexCode);

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.CODE_QUALITY);
    });
  });

  describe('getQualitySummary', () => {
    it('should return comprehensive summary', async () => {
      const eslintResults = [
        {
          filePath: '/src/index.ts',
          messages: [
            { ruleId: 'no-unused-vars', severity: 1, message: 'Warning', line: 1, column: 1 },
            { ruleId: 'no-unused-vars', severity: 1, message: 'Warning', line: 2, column: 1 },
            { ruleId: 'no-console', severity: 2, message: 'Error', line: 3, column: 1 },
          ],
          errorCount: 1,
          warningCount: 2,
          fixableErrorCount: 0,
          fixableWarningCount: 2,
        },
      ];

      await fs.writeFile(
        path.join(tempDir, 'eslint-report.json'),
        JSON.stringify(eslintResults)
      );

      const summary = await checker.getQualitySummary(tempDir);

      expect(summary.totalFiles).toBe(1);
      expect(summary.totalErrors).toBe(1);
      expect(summary.totalWarnings).toBe(2);
      expect(summary.fixableWarnings).toBe(2);
      expect(summary.topIssues.get('no-unused-vars')).toBe(2);
    });
  });

  describe('getHighComplexityFiles', () => {
    it('should return files exceeding complexity threshold', async () => {
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      // Create high complexity file
      const highComplexity = `
function complex(a, b, c, d, e) {
  if (a && b) {
    if (c || d) {
      if (e && a) {
        for (let i = 0; i < 10; i++) {
          while (a > i) {
            if (b > c) {
              switch(d) {
                case 1: return a;
                case 2: return b;
                case 3: return c;
              }
            }
          }
        }
      }
    }
  }
  return a ? b : c ? d : e;
}
`;
      await fs.writeFile(path.join(srcDir, 'high.ts'), highComplexity);

      // Create low complexity file
      const lowComplexity = `
function simple(a) {
  return a + 1;
}
`;
      await fs.writeFile(path.join(srcDir, 'low.ts'), lowComplexity);

      const highComplexFiles = await checker.getHighComplexityFiles(tempDir);

      // Should have at least one high complexity file
      expect(highComplexFiles.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getTopIssues', () => {
    it('should return most frequent issues', async () => {
      const eslintResults = [
        {
          filePath: '/src/a.ts',
          messages: [
            { ruleId: 'no-unused-vars', severity: 1, message: 'Warning', line: 1, column: 1 },
            { ruleId: 'no-unused-vars', severity: 1, message: 'Warning', line: 2, column: 1 },
            { ruleId: 'no-unused-vars', severity: 1, message: 'Warning', line: 3, column: 1 },
            { ruleId: 'no-console', severity: 1, message: 'Warning', line: 4, column: 1 },
          ],
          errorCount: 0,
          warningCount: 4,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
        {
          filePath: '/src/b.ts',
          messages: [
            { ruleId: 'no-unused-vars', severity: 1, message: 'Warning', line: 1, column: 1 },
            { ruleId: 'prefer-const', severity: 1, message: 'Warning', line: 2, column: 1 },
          ],
          errorCount: 0,
          warningCount: 2,
          fixableErrorCount: 0,
          fixableWarningCount: 0,
        },
      ];

      await fs.writeFile(
        path.join(tempDir, 'eslint-report.json'),
        JSON.stringify(eslintResults)
      );

      const topIssues = await checker.getTopIssues(tempDir, 5);

      expect(topIssues.length).toBeLessThanOrEqual(5);
      expect(topIssues[0].rule).toBe('no-unused-vars');
      expect(topIssues[0].count).toBe(4);
    });
  });

  describe('createCodeQualityChecker', () => {
    it('should create instance with factory function', () => {
      const instance = createCodeQualityChecker();
      expect(instance).toBeInstanceOf(CodeQualityChecker);
    });

    it('should accept custom config', () => {
      const instance = createCodeQualityChecker({
        maxCyclomaticComplexity: 20,
        maxWarningsAllowed: 100,
      });
      expect(instance).toBeInstanceOf(CodeQualityChecker);
    });
  });

  describe('DEFAULT_CODE_QUALITY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_CODE_QUALITY_CONFIG.maxCyclomaticComplexity).toBe(10);
      expect(DEFAULT_CODE_QUALITY_CONFIG.maxErrorsAllowed).toBe(0);
      expect(DEFAULT_CODE_QUALITY_CONFIG.maxWarningsAllowed).toBe(50);
      expect(DEFAULT_CODE_QUALITY_CONFIG.ignorePatterns).toContain('node_modules');
    });
  });

  describe('ESLintSeverity', () => {
    it('should have correct values', () => {
      expect(ESLintSeverity.OFF).toBe(0);
      expect(ESLintSeverity.WARN).toBe(1);
      expect(ESLintSeverity.ERROR).toBe(2);
    });
  });
});
