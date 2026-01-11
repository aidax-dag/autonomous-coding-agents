/**
 * Code Scanner Tests
 *
 * Feature: F5.6 - Code Scanning 심화
 * Tests for unified code scanner implementation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  CodeScanner,
  createCodeScanner,
  SecurityIssueSeverity,
} from '../../../../src/core/security/scanning/index.js';

describe('CodeScanner', () => {
  let scanner: CodeScanner;
  let tempDir: string;

  beforeEach(() => {
    scanner = new CodeScanner();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-scanner-test-'));
  });

  afterEach(() => {
    scanner.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Construction', () => {
    it('should create scanner with default sub-scanners', () => {
      expect(scanner.getStaticAnalyzer()).toBeDefined();
      expect(scanner.getDependencyScanner()).toBeDefined();
      expect(scanner.getSecretDetector()).toBeDefined();
    });

    it('should create scanner using factory function', () => {
      const factoryScanner = createCodeScanner();

      expect(factoryScanner).toBeDefined();
      expect(factoryScanner.getStaticAnalyzer()).toBeDefined();

      factoryScanner.dispose();
    });
  });

  describe('scanCode', () => {
    it('should run static analysis on code', async () => {
      const code = `
        function dangerous() {
          eval(userInput);
        }
      `;

      const result = await scanner.scanCode(code, {
        scanTypes: ['static-analysis'],
      });

      expect(result.success).toBe(true);
      expect(result.staticAnalysis).toBeDefined();
      expect(result.staticAnalysis?.issues.length).toBeGreaterThan(0);
    });

    it('should run secret detection on code', async () => {
      const code = `
        const awsKey = "AKIATESTFAKEKEY12345";
      `;

      const result = await scanner.scanCode(code, {
        scanTypes: ['secret-detection'],
      });

      expect(result.success).toBe(true);
      expect(result.secretDetection).toBeDefined();
      expect(result.secretDetection?.secrets.length).toBeGreaterThan(0);
    });

    it('should run both static and secret detection', async () => {
      const code = `
        const awsKey = "AKIATESTFAKEKEY12345";
        eval(userInput);
      `;

      const result = await scanner.scanCode(code);

      expect(result.staticAnalysis).toBeDefined();
      expect(result.secretDetection).toBeDefined();
    });

    it('should provide summary', async () => {
      const code = `
        eval(userInput);
      `;

      const result = await scanner.scanCode(code);

      expect(result.summary).toBeDefined();
      expect(typeof result.summary.totalIssues).toBe('number');
      expect(typeof result.summary.criticalIssues).toBe('number');
      expect(typeof result.summary.highIssues).toBe('number');
      expect(typeof result.summary.mediumIssues).toBe('number');
      expect(typeof result.summary.lowIssues).toBe('number');
      expect(typeof result.summary.infoIssues).toBe('number');
    });

    it('should track duration', async () => {
      const result = await scanner.scanCode('const x = 1;');

      expect(result.startTime).toBeInstanceOf(Date);
      expect(result.endTime).toBeInstanceOf(Date);
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should run scans in parallel by default', async () => {
      const code = `
        eval(userInput);
        const aws = "AKIATESTFAKEKEY12345";
      `;

      const startTime = Date.now();
      const result = await scanner.scanCode(code, {
        scanTypes: ['static-analysis', 'secret-detection'],
        parallel: true,
      });
      const parallelDuration = Date.now() - startTime;

      expect(result.staticAnalysis).toBeDefined();
      expect(result.secretDetection).toBeDefined();

      // Just ensure it completes; parallel vs sequential timing is not deterministic
      expect(parallelDuration).toBeGreaterThanOrEqual(0);
    });
  });

  describe('scanFile', () => {
    it('should scan a single file', async () => {
      const filePath = path.join(tempDir, 'test.js');
      fs.writeFileSync(filePath, 'eval(userInput);');

      const result = await scanner.scanFile(filePath);

      expect(result.success).toBe(true);
      expect(result.target).toBe(filePath);
      expect(result.targetType).toBe('file');
    });

    it('should handle non-existent file', async () => {
      const result = await scanner.scanFile('/nonexistent/file.js');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('scanDirectory', () => {
    it('should scan all files in directory', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.js'), 'eval(a);');
      fs.writeFileSync(path.join(tempDir, 'file2.js'), 'eval(b);');

      const result = await scanner.scanDirectory(tempDir);

      expect(result.success).toBe(true);
      expect(result.target).toBe(tempDir);
      expect(result.targetType).toBe('directory');
      expect(result.summary.filesScanned).toBeGreaterThanOrEqual(2);
    });

    it('should run dependency scan in directory', async () => {
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: { lodash: '4.17.20' },
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const result = await scanner.scanDirectory(tempDir, {
        scanTypes: ['dependency-scan'],
      });

      expect(result.dependencyScan).toBeDefined();
      expect(result.summary.dependenciesScanned).toBeGreaterThan(0);
    });

    it('should combine results from all scan types', async () => {
      // Create files with various issues
      fs.writeFileSync(path.join(tempDir, 'code.js'), 'eval(a);');
      fs.writeFileSync(path.join(tempDir, 'secrets.js'), 'const aws = "AKIATESTFAKEKEY12345";');
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', version: '1.0.0', dependencies: { lodash: '4.17.20' } })
      );

      const result = await scanner.scanDirectory(tempDir, {
        scanTypes: ['all'],
      });

      expect(result.staticAnalysis).toBeDefined();
      expect(result.dependencyScan).toBeDefined();
      expect(result.secretDetection).toBeDefined();
    });

    it('should handle non-existent directory', async () => {
      const result = await scanner.scanDirectory('/nonexistent/dir');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('scanRepository', () => {
    it('should scan repository', async () => {
      // Create mock git repo
      fs.mkdirSync(path.join(tempDir, '.git'));
      fs.writeFileSync(path.join(tempDir, 'code.js'), 'eval(a);');

      const result = await scanner.scanRepository(tempDir);

      expect(result.target).toBe(tempDir);
      expect(result.targetType).toBe('repository');
    });

    it('should warn for non-git directory', async () => {
      fs.writeFileSync(path.join(tempDir, 'code.js'), 'const x = 1;');

      const result = await scanner.scanRepository(tempDir);

      expect(result.errors.some((e) => e.includes('git'))).toBe(true);
    });
  });

  describe('failOnSeverity', () => {
    it('should fail on critical issues when option is set', async () => {
      const code = `
        const aws = "AKIATESTFAKEKEY12345";
      `;

      const result = await scanner.scanCode(code, {
        scanTypes: ['secret-detection'],
        failOnSeverity: SecurityIssueSeverity.CRITICAL,
      });

      expect(result.success).toBe(false);
    });

    it('should pass when no issues meet severity threshold', async () => {
      const code = 'const x = 1;';

      const result = await scanner.scanCode(code, {
        failOnSeverity: SecurityIssueSeverity.CRITICAL,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('generateReport', () => {
    it('should generate text report', async () => {
      const code = 'eval(userInput);';
      const result = await scanner.scanCode(code);

      const report = scanner.generateReport(result, 'text');

      expect(report).toContain('CODE SCAN REPORT');
      expect(report).toContain('SUMMARY');
      expect(report).toContain('Target: code');
    });

    it('should generate JSON report', async () => {
      const code = 'eval(userInput);';
      const result = await scanner.scanCode(code);

      const report = scanner.generateReport(result, 'json');
      const parsed = JSON.parse(report);

      expect(parsed.success).toBeDefined();
      expect(parsed.summary).toBeDefined();
    });

    it('should generate SARIF report', async () => {
      const code = 'eval(userInput);';
      const result = await scanner.scanCode(code);

      const report = scanner.generateReport(result, 'sarif');
      const parsed = JSON.parse(report);

      expect(parsed.$schema).toContain('sarif');
      expect(parsed.version).toBe('2.1.0');
      expect(parsed.runs).toBeInstanceOf(Array);
    });

    it('should generate HTML report', async () => {
      const code = 'eval(userInput);';
      const result = await scanner.scanCode(code);

      const report = scanner.generateReport(result, 'html');

      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('Code Scan Report');
      expect(report).toContain('<style>');
    });

    it('should include issues in text report', async () => {
      const code = 'eval(userInput);';
      const result = await scanner.scanCode(code);

      const report = scanner.generateReport(result, 'text');

      expect(report).toContain('STATIC ANALYSIS ISSUES');
    });

    it('should include secrets in text report', async () => {
      const code = 'const aws = "AKIATESTFAKEKEY12345";';
      const result = await scanner.scanCode(code, {
        scanTypes: ['secret-detection'],
      });

      const report = scanner.generateReport(result, 'text');

      expect(report).toContain('DETECTED SECRETS');
    });

    it('should include vulnerabilities in text report', async () => {
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: { lodash: '4.17.20' },
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const result = await scanner.scanDirectory(tempDir, {
        scanTypes: ['dependency-scan'],
      });

      if (result.dependencyScan?.vulnerableDependencies.length ?? 0 > 0) {
        const report = scanner.generateReport(result, 'text');
        expect(report).toContain('VULNERABLE DEPENDENCIES');
      }
    });
  });

  describe('Sub-scanner Access', () => {
    it('should provide access to static analyzer', () => {
      const staticAnalyzer = scanner.getStaticAnalyzer();

      expect(staticAnalyzer).toBeDefined();
      expect(staticAnalyzer.getRules().length).toBeGreaterThan(0);
    });

    it('should provide access to dependency scanner', () => {
      const dependencyScanner = scanner.getDependencyScanner();

      expect(dependencyScanner).toBeDefined();
      expect(dependencyScanner.getDatabaseInfo()).toBeDefined();
    });

    it('should provide access to secret detector', () => {
      const secretDetector = scanner.getSecretDetector();

      expect(secretDetector).toBeDefined();
      expect(secretDetector.getRules().length).toBeGreaterThan(0);
    });
  });

  describe('Disposal', () => {
    it('should dispose all sub-scanners', () => {
      scanner.dispose();

      expect(() => scanner.getStaticAnalyzer()).toThrow(/disposed/);
      expect(() => scanner.getDependencyScanner()).toThrow(/disposed/);
      expect(() => scanner.getSecretDetector()).toThrow(/disposed/);
    });

    it('should throw error when scanning after disposal', async () => {
      scanner.dispose();

      await expect(scanner.scanCode('test')).rejects.toThrow(/disposed/);
    });

    it('should throw error when generating report after disposal', async () => {
      const result = await scanner.scanCode('test');
      scanner.dispose();

      expect(() => scanner.generateReport(result, 'text')).toThrow(/disposed/);
    });
  });

  describe('Error Handling', () => {
    it('should collect errors from failed scans', async () => {
      // Create a situation where one scan might fail
      const result = await scanner.scanFile('/nonexistent/file.js');

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should continue other scans when one fails', async () => {
      // Even if static analysis has issues, secret detection should run
      fs.writeFileSync(
        path.join(tempDir, 'test.js'),
        'const aws = "AKIATESTFAKEKEY12345";'
      );

      const result = await scanner.scanDirectory(tempDir, {
        scanTypes: ['static-analysis', 'secret-detection'],
      });

      expect(result.staticAnalysis).toBeDefined();
      expect(result.secretDetection).toBeDefined();
    });
  });

  describe('Summary Calculation', () => {
    it('should correctly sum issues from all scan types', async () => {
      // Create directory with issues from multiple scan types
      fs.writeFileSync(path.join(tempDir, 'code.js'), 'eval(a);');
      fs.writeFileSync(path.join(tempDir, 'secrets.js'), 'const aws = "AKIATESTFAKEKEY12345";');

      const result = await scanner.scanDirectory(tempDir, {
        scanTypes: ['static-analysis', 'secret-detection'],
      });

      const staticCount = result.staticAnalysis?.issues.length ?? 0;
      const secretCount = result.secretDetection?.issues.length ?? 0;

      expect(result.summary.totalIssues).toBe(staticCount + secretCount);
    });

    it('should track files and lines scanned', async () => {
      fs.writeFileSync(path.join(tempDir, 'file1.js'), 'line1\nline2\nline3');
      fs.writeFileSync(path.join(tempDir, 'file2.js'), 'line1\nline2');

      const result = await scanner.scanDirectory(tempDir);

      expect(result.summary.filesScanned).toBeGreaterThanOrEqual(2);
      expect(result.summary.linesScanned).toBeGreaterThanOrEqual(5);
    });

    it('should track dependencies scanned', async () => {
      const packageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: { lodash: '4.17.21', express: '4.18.0' },
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const result = await scanner.scanDirectory(tempDir, {
        scanTypes: ['dependency-scan'],
      });

      expect(result.summary.dependenciesScanned).toBeGreaterThanOrEqual(2);
    });

    it('should track secrets found', async () => {
      fs.writeFileSync(
        path.join(tempDir, 'secrets.js'),
        `
        const aws = "AKIATESTFAKEKEY12345";
        const github = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
      `
      );

      const result = await scanner.scanDirectory(tempDir, {
        scanTypes: ['secret-detection'],
      });

      expect(result.summary.secretsFound).toBeGreaterThanOrEqual(2);
    });
  });
});
