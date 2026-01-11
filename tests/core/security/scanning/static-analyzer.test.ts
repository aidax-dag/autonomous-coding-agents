/**
 * Static Analyzer Tests
 *
 * Feature: F5.6 - Code Scanning 심화
 * Tests for static code analysis implementation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  StaticAnalyzer,
  createStaticAnalyzer,
  SecurityIssueSeverity,
  type StaticAnalysisRule,
} from '../../../../src/core/security/scanning/index.js';

describe('StaticAnalyzer', () => {
  let analyzer: StaticAnalyzer;
  let tempDir: string;

  beforeEach(() => {
    analyzer = new StaticAnalyzer();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-analyzer-test-'));
  });

  afterEach(() => {
    analyzer.dispose();
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Construction', () => {
    it('should create analyzer with default rules', () => {
      const rules = analyzer.getRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should create analyzer with custom rules', () => {
      const customRule: StaticAnalysisRule = {
        id: 'CUSTOM001',
        name: 'custom-rule',
        description: 'Custom test rule',
        severity: SecurityIssueSeverity.HIGH,
        category: 'other',
        pattern: /custompattern/g,
        enabled: true,
      };

      const customAnalyzer = new StaticAnalyzer([customRule]);
      const rules = customAnalyzer.getRules();

      expect(rules.some((r) => r.id === 'CUSTOM001')).toBe(true);
      customAnalyzer.dispose();
    });

    it('should create analyzer using factory function', () => {
      const factoryAnalyzer = createStaticAnalyzer();
      expect(factoryAnalyzer).toBeDefined();
      expect(factoryAnalyzer.getRules().length).toBeGreaterThan(0);
      factoryAnalyzer.dispose();
    });
  });

  describe('analyzeCode', () => {
    it('should detect eval usage', async () => {
      const code = `
        function dangerous() {
          eval(userInput);
        }
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.ruleId === 'SA001')).toBe(true);
    });

    it('should detect Function constructor', async () => {
      const code = `
        const fn = new Function('return 42');
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.issues.some((i) => i.ruleId === 'SA002')).toBe(true);
    });

    it('should detect SQL injection patterns', async () => {
      const code = `
        const query = "SELECT * FROM users WHERE id = " + userId;
      `;

      const result = await analyzer.analyzeCode(code);

      expect(result.issues.some((i) => i.category === 'sql-injection')).toBe(true);
    });

    it('should detect innerHTML assignment', async () => {
      const code = `
        document.getElementById('output').innerHTML = userContent;
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.issues.some((i) => i.ruleId === 'SA030')).toBe(true);
    });

    it('should detect path traversal patterns', async () => {
      const code = `
        const file = fs.readFileSync('../../../etc/passwd');
      `;

      const result = await analyzer.analyzeCode(code);

      expect(result.issues.some((i) => i.category === 'path-traversal')).toBe(true);
    });

    it('should detect prototype pollution', async () => {
      const code = `
        obj["__proto__"] = malicious;
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.issues.some((i) => i.ruleId === 'SA050')).toBe(true);
    });

    it('should detect weak cryptography', async () => {
      const code = `
        const hash = crypto.createHash('md5').update(data).digest('hex');
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.issues.some((i) => i.ruleId === 'SA060')).toBe(true);
    });

    it('should detect hardcoded credentials', async () => {
      const code = `
        const password = "secretPassword123";
      `;

      const result = await analyzer.analyzeCode(code);

      expect(result.issues.some((i) => i.category === 'authentication')).toBe(true);
    });

    it('should detect TLS certificate rejection disabled', async () => {
      const code = `
        const options = { rejectUnauthorized: false };
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.issues.some((i) => i.ruleId === 'SA071')).toBe(true);
    });

    it('should return issue count by severity', async () => {
      const code = `
        eval(input);
        document.write(html);
        console.log(debug);
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.issuesBySeverity).toBeDefined();
      expect(typeof result.issuesBySeverity[SecurityIssueSeverity.HIGH]).toBe('number');
    });

    it('should return issue count by category', async () => {
      const code = `
        eval(input);
        const query = "SELECT * FROM users WHERE id = " + id;
      `;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      expect(result.issuesByCategory).toBeDefined();
    });

    it('should include location information in issues', async () => {
      const code = `line1
eval(input);
line3`;

      const result = await analyzer.analyzeCode(code, { languages: ['javascript'] });

      const evalIssue = result.issues.find((i) => i.ruleId === 'SA001');
      expect(evalIssue?.location).toBeDefined();
      expect(evalIssue?.location?.line).toBe(2);
    });

    it('should filter by minimum severity', async () => {
      const code = `
        eval(input);
        console.log(debug);
        const x = http://example.com;
      `;

      const result = await analyzer.analyzeCode(code, {
        languages: ['javascript'],
        minSeverity: SecurityIssueSeverity.HIGH,
      });

      for (const issue of result.issues) {
        expect(
          issue.severity === SecurityIssueSeverity.HIGH ||
            issue.severity === SecurityIssueSeverity.CRITICAL
        ).toBe(true);
      }
    });

    it('should use custom rules', async () => {
      const code = 'myCustomPattern here';

      const customRule: StaticAnalysisRule = {
        id: 'CUSTOM002',
        name: 'my-custom',
        description: 'Detects myCustomPattern',
        severity: SecurityIssueSeverity.MEDIUM,
        category: 'other',
        pattern: /myCustomPattern/g,
        enabled: true,
      };

      const result = await analyzer.analyzeCode(code, {
        customRules: [customRule],
      });

      expect(result.issues.some((i) => i.ruleId === 'CUSTOM002')).toBe(true);
    });

    it('should handle empty code', async () => {
      const result = await analyzer.analyzeCode('');

      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.linesScanned).toBe(1);
    });
  });

  describe('analyzeFile', () => {
    it('should analyze a JavaScript file', async () => {
      const filePath = path.join(tempDir, 'test.js');
      fs.writeFileSync(filePath, 'eval(userInput);');

      const result = await analyzer.analyzeFile(filePath);

      expect(result.success).toBe(true);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].location?.file).toBe(filePath);
    });

    it('should analyze a TypeScript file', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      fs.writeFileSync(
        filePath,
        `
        function test(): void {
          eval(input);
        }
      `
      );

      const result = await analyzer.analyzeFile(filePath);

      expect(result.success).toBe(true);
      expect(result.issues.some((i) => i.ruleId === 'SA001')).toBe(true);
    });

    it('should handle non-existent file', async () => {
      const result = await analyzer.analyzeFile('/nonexistent/file.js');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip files exceeding max size', async () => {
      const filePath = path.join(tempDir, 'large.js');
      fs.writeFileSync(filePath, 'a'.repeat(100));

      const result = await analyzer.analyzeFile(filePath, { maxFileSize: 10 });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.filesScanned).toBe(0);
    });
  });

  describe('analyzeDirectory', () => {
    it('should analyze all files in directory', async () => {
      // Create test files
      fs.writeFileSync(path.join(tempDir, 'file1.js'), 'eval(a);');
      fs.writeFileSync(path.join(tempDir, 'file2.ts'), 'eval(b);');

      const result = await analyzer.analyzeDirectory(tempDir);

      expect(result.success).toBe(true);
      expect(result.filesScanned).toBeGreaterThanOrEqual(2);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('should respect include patterns', async () => {
      fs.writeFileSync(path.join(tempDir, 'include.js'), 'eval(a);');
      fs.writeFileSync(path.join(tempDir, 'exclude.ts'), 'eval(b);');

      const result = await analyzer.analyzeDirectory(tempDir, {
        includePatterns: ['**/*.js'],
      });

      expect(result.filesScanned).toBe(1);
    });

    it('should respect exclude patterns', async () => {
      const subDir = path.join(tempDir, 'node_modules');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'eval(a);');
      fs.writeFileSync(path.join(subDir, 'lib.js'), 'eval(b);');

      const result = await analyzer.analyzeDirectory(tempDir, {
        excludePatterns: ['**/node_modules/**'],
      });

      // Should only scan app.js, not node_modules/lib.js
      const nodeModulesIssues = result.issues.filter(
        (i) => i.location?.file?.includes('node_modules')
      );
      expect(nodeModulesIssues.length).toBe(0);
    });

    it('should report language breakdown', async () => {
      fs.writeFileSync(path.join(tempDir, 'app.js'), 'const x = 1;');
      fs.writeFileSync(path.join(tempDir, 'app.ts'), 'const y: number = 2;');
      fs.writeFileSync(path.join(tempDir, 'app.py'), 'x = 1');

      const result = await analyzer.analyzeDirectory(tempDir);

      expect(result.languageBreakdown).toBeDefined();
    });
  });

  describe('Rule Management', () => {
    it('should add a new rule', () => {
      const newRule: StaticAnalysisRule = {
        id: 'NEW001',
        name: 'new-rule',
        description: 'New rule',
        severity: SecurityIssueSeverity.MEDIUM,
        category: 'other',
        pattern: /newpattern/g,
        enabled: true,
      };

      analyzer.addRule(newRule);
      const rules = analyzer.getRules();

      expect(rules.some((r) => r.id === 'NEW001')).toBe(true);
    });

    it('should remove a rule', () => {
      const initialRules = analyzer.getRules();
      const ruleToRemove = initialRules[0].id;

      const removed = analyzer.removeRule(ruleToRemove);

      expect(removed).toBe(true);
      expect(analyzer.getRules().some((r) => r.id === ruleToRemove)).toBe(false);
    });

    it('should return false when removing non-existent rule', () => {
      const removed = analyzer.removeRule('NONEXISTENT');
      expect(removed).toBe(false);
    });

    it('should enable/disable rules', () => {
      const rules = analyzer.getRules();
      const ruleId = rules[0].id;

      analyzer.setRuleEnabled(ruleId, false);

      const updatedRules = analyzer.getRules();
      const rule = updatedRules.find((r) => r.id === ruleId);
      expect(rule?.enabled).toBe(false);
    });
  });

  describe('Options', () => {
    it('should include rules by ID', async () => {
      const code = `
        eval(a);
        new Function(b);
      `;

      const result = await analyzer.analyzeCode(code, {
        languages: ['javascript'],
        includeRules: ['SA001'],
      });

      expect(result.issues.every((i) => i.ruleId === 'SA001')).toBe(true);
    });

    it('should exclude rules by ID', async () => {
      const code = 'eval(a);';

      const result = await analyzer.analyzeCode(code, {
        languages: ['javascript'],
        excludeRules: ['SA001'],
      });

      expect(result.issues.every((i) => i.ruleId !== 'SA001')).toBe(true);
    });

    it('should include rules by category', async () => {
      const code = `
        eval(a);
        document.innerHTML = b;
      `;

      const result = await analyzer.analyzeCode(code, {
        languages: ['javascript'],
        includeRules: ['code-injection'],
      });

      expect(result.issues.every((i) => i.category === 'code-injection')).toBe(true);
    });
  });

  describe('Disposal', () => {
    it('should throw error after disposal', () => {
      analyzer.dispose();

      expect(() => analyzer.getRules()).toThrow(/disposed/);
    });

    it('should throw error when analyzing after disposal', async () => {
      analyzer.dispose();

      await expect(analyzer.analyzeCode('test')).rejects.toThrow(/disposed/);
    });
  });
});
