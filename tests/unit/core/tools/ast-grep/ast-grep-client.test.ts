/**
 * AST-Grep Client Tests
 *
 * Comprehensive tests for AST-based code search, transformation, and linting.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  ASTGrepClient,
  ASTLanguage,
  ASTRule,
  ASTRuleCategory,
  ASTRuleSeverity,
  ASTRewriteRule,
  DEFAULT_AST_GREP_CONFIG,
  FILE_EXTENSION_LANGUAGE_MAP,
  AST_PATTERN_TEMPLATES,
  detectLanguageFromPath,
  isLanguageSupported,
  getSupportedExtensions,
  metavar,
  multiMetavar,
} from '../../../../../src/core/tools/ast-grep/index.js';

describe('ASTGrepClient', () => {
  let client: ASTGrepClient;
  let tempDir: string;

  beforeEach(async () => {
    client = new ASTGrepClient();
    await client.initialize();

    // Create temp directory for file tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ast-grep-test-'));
  });

  afterEach(async () => {
    await client.dispose();

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ---------------------------------------------------------------------------
  // Lifecycle Tests
  // ---------------------------------------------------------------------------

  describe('lifecycle', () => {
    it('should initialize with default config', async () => {
      const newClient = new ASTGrepClient();
      const result = await newClient.initialize();
      expect(result.success).toBe(true);
      await newClient.dispose();
    });

    it('should initialize with custom config', async () => {
      const newClient = new ASTGrepClient({
        enableCache: false,
        defaultTimeout: 10000,
      });
      const result = await newClient.initialize();
      expect(result.success).toBe(true);
      await newClient.dispose();
    });

    it('should dispose successfully', async () => {
      const result = await client.dispose();
      expect(result.success).toBe(true);
    });

    it('should return version', async () => {
      const result = await client.getVersion();
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should check availability', async () => {
      const available = await client.isAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  // ---------------------------------------------------------------------------
  // Search Tests
  // ---------------------------------------------------------------------------

  describe('searchCode', () => {
    it('should find simple pattern in code', async () => {
      const code = `
        function hello() {
          console.log("Hello");
        }
      `;
      const result = await client.searchCode(code, 'console.log', ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.matchCount).toBeGreaterThan(0);
    });

    it('should find pattern with metavariable', async () => {
      const code = `
        console.log("test1");
        console.log("test2");
        console.warn("warning");
      `;
      const result = await client.searchCode(code, 'console.log($ARGS)', ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.matchCount).toBe(2);
    });

    it('should return empty result when pattern not found', async () => {
      const code = 'const x = 1;';
      const result = await client.searchCode(code, 'console.log', ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBe(0);
    });

    it('should respect maxMatches option', async () => {
      const code = `
        console.log("1");
        console.log("2");
        console.log("3");
        console.log("4");
        console.log("5");
      `;
      const result = await client.searchCode(code, 'console.log', ASTLanguage.JAVASCRIPT, {
        maxMatches: 2,
      });

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBe(2);
    });

    it('should include context lines when requested', async () => {
      const code = `line1
line2
console.log("test")
line4
line5`;
      const result = await client.searchCode(code, 'console.log', ASTLanguage.JAVASCRIPT, {
        contextLines: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data!.matches[0].context).toBeDefined();
    });
  });

  describe('searchFile', () => {
    it('should search in a file', async () => {
      const filePath = path.join(tempDir, 'test.js');
      await fs.writeFile(filePath, 'const x = 1;\nconst y = 2;');

      const result = await client.searchFile(filePath, 'const');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBe(2);
    });

    it('should auto-detect language from extension', async () => {
      const filePath = path.join(tempDir, 'test.ts');
      await fs.writeFile(filePath, 'const x: number = 1;');

      const result = await client.searchFile(filePath, 'const');

      expect(result.success).toBe(true);
      expect(result.data!.language).toBe(ASTLanguage.TYPESCRIPT);
    });

    it('should fail for unsupported file type', async () => {
      const filePath = path.join(tempDir, 'test.unknown');
      await fs.writeFile(filePath, 'content');

      const result = await client.searchFile(filePath, 'pattern');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not detect language');
    });

    it('should fail for non-existent file', async () => {
      const result = await client.searchFile('/non/existent/file.js', 'pattern');

      expect(result.success).toBe(false);
    });
  });

  describe('searchDirectory', () => {
    it('should search in multiple files', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'console.log("1");');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'console.log("2");');

      const result = await client.searchDirectory(tempDir, 'console.log');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBe(2);
      expect(result.data!.fileCount).toBe(2);
    });

    it('should respect language filter', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), 'console.log("js");');
      await fs.writeFile(path.join(tempDir, 'file.ts'), 'console.log("ts");');

      const result = await client.searchDirectory(tempDir, 'console.log', {
        languages: [ASTLanguage.TYPESCRIPT],
      });

      expect(result.success).toBe(true);
      expect(result.data!.fileCount).toBe(1);
    });

    it('should skip hidden directories', async () => {
      await fs.mkdir(path.join(tempDir, '.hidden'));
      await fs.writeFile(path.join(tempDir, '.hidden', 'file.js'), 'console.log("hidden");');
      await fs.writeFile(path.join(tempDir, 'file.js'), 'console.log("visible");');

      const result = await client.searchDirectory(tempDir, 'console.log');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBe(1);
    });

    it('should skip node_modules', async () => {
      await fs.mkdir(path.join(tempDir, 'node_modules'));
      await fs.writeFile(path.join(tempDir, 'node_modules', 'file.js'), 'console.log("nm");');
      await fs.writeFile(path.join(tempDir, 'file.js'), 'console.log("src");');

      const result = await client.searchDirectory(tempDir, 'console.log');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBe(1);
    });

    it('should handle empty directory', async () => {
      const result = await client.searchDirectory(tempDir, 'pattern');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBe(0);
    });
  });

  describe('findSymbol', () => {
    it('should find function declarations', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), 'function myFunction() {}');

      const result = await client.findSymbol(tempDir, 'myFunction');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBeGreaterThan(0);
    });

    it('should find const declarations', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), 'const myConst = 1;');

      const result = await client.findSymbol(tempDir, 'myConst');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBeGreaterThan(0);
    });

    it('should find class declarations', async () => {
      await fs.writeFile(path.join(tempDir, 'file.ts'), 'class MyClass {}');

      const result = await client.findSymbol(tempDir, 'MyClass');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBeGreaterThan(0);
    });
  });

  describe('findCalls', () => {
    it('should find function calls', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), 'myFunc(); myFunc(1, 2);');

      const result = await client.findCalls(tempDir, 'myFunc');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBeGreaterThan(0);
    });
  });

  describe('findImports', () => {
    it('should find ES6 imports', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), "import { x } from 'my-module';");

      const result = await client.findImports(tempDir, 'my-module');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBeGreaterThan(0);
    });

    it('should find require calls', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), "const x = require('my-module');");

      const result = await client.findImports(tempDir, 'my-module');

      expect(result.success).toBe(true);
      expect(result.data!.matchCount).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule Management Tests
  // ---------------------------------------------------------------------------

  describe('rule management', () => {
    const testRule: ASTRule = {
      id: 'test-rule-1',
      name: 'Test Rule',
      description: 'A test rule',
      language: ASTLanguage.JAVASCRIPT,
      pattern: 'console.log($ARGS)',
      severity: ASTRuleSeverity.WARNING,
      category: ASTRuleCategory.BEST_PRACTICE,
      enabled: true,
    };

    it('should register a rule', () => {
      const result = client.registerRule(testRule);
      expect(result.success).toBe(true);
      expect(client.getRule('test-rule-1')).toEqual(testRule);
    });

    it('should fail to register duplicate rule', () => {
      client.registerRule(testRule);
      const result = client.registerRule(testRule);
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should unregister a rule', () => {
      client.registerRule(testRule);
      const result = client.unregisterRule('test-rule-1');
      expect(result.success).toBe(true);
      expect(client.getRule('test-rule-1')).toBeUndefined();
    });

    it('should fail to unregister non-existent rule', () => {
      const result = client.unregisterRule('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should get all rules', () => {
      client.registerRule(testRule);
      client.registerRule({ ...testRule, id: 'test-rule-2' });

      const rules = client.getAllRules();
      expect(rules.length).toBe(2);
    });

    it('should get rules by category', () => {
      client.registerRule(testRule);
      client.registerRule({
        ...testRule,
        id: 'test-rule-2',
        category: ASTRuleCategory.SECURITY,
      });

      const rules = client.getRulesByCategory(ASTRuleCategory.BEST_PRACTICE);
      expect(rules.length).toBe(1);
      expect(rules[0].id).toBe('test-rule-1');
    });

    it('should get rules by language', () => {
      client.registerRule(testRule);
      client.registerRule({
        ...testRule,
        id: 'test-rule-2',
        language: ASTLanguage.PYTHON,
      });

      const rules = client.getRulesByLanguage(ASTLanguage.JAVASCRIPT);
      expect(rules.length).toBe(1);
    });

    it('should enable/disable rule', () => {
      client.registerRule(testRule);

      client.setRuleEnabled('test-rule-1', false);
      expect(client.getRule('test-rule-1')!.enabled).toBe(false);

      client.setRuleEnabled('test-rule-1', true);
      expect(client.getRule('test-rule-1')!.enabled).toBe(true);
    });

    it('should fail to enable non-existent rule', () => {
      const result = client.setRuleEnabled('non-existent', true);
      expect(result.success).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Lint Tests
  // ---------------------------------------------------------------------------

  describe('linting', () => {
    beforeEach(() => {
      client.registerRule({
        id: 'no-console-log',
        name: 'No console.log',
        description: 'Avoid using console.log',
        language: ASTLanguage.JAVASCRIPT,
        pattern: 'console.log($ARGS)',
        severity: ASTRuleSeverity.WARNING,
        category: ASTRuleCategory.BEST_PRACTICE,
        enabled: true,
        fix: {
          replacement: '// console.log removed',
        },
      });
    });

    it('should lint code and find violations', async () => {
      const code = 'console.log("test");';
      const result = await client.lintCode(code, ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data!.totalViolations).toBeGreaterThan(0);
    });

    it('should lint file', async () => {
      const filePath = path.join(tempDir, 'file.js');
      await fs.writeFile(filePath, 'console.log("test");');

      const result = await client.lintFile(filePath);

      expect(result.success).toBe(true);
      expect(result.data!.totalViolations).toBeGreaterThan(0);
    });

    it('should lint directory', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'console.log("1");');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'console.log("2");');

      const result = await client.lintDirectory(tempDir);

      expect(result.success).toBe(true);
      expect(result.data!.totalViolations).toBe(2);
    });

    it('should filter by rule IDs', async () => {
      client.registerRule({
        id: 'other-rule',
        name: 'Other',
        language: ASTLanguage.JAVASCRIPT,
        pattern: 'alert($ARGS)',
        severity: ASTRuleSeverity.ERROR,
        category: ASTRuleCategory.SECURITY,
        enabled: true,
      });

      const code = 'console.log("test"); alert("test");';
      const result = await client.lintCode(code, ASTLanguage.JAVASCRIPT, {
        ruleIds: ['other-rule'],
      });

      expect(result.success).toBe(true);
      expect(result.data!.totalViolations).toBe(1);
    });

    it('should filter by minimum severity', async () => {
      client.registerRule({
        id: 'hint-rule',
        name: 'Hint',
        language: ASTLanguage.JAVASCRIPT,
        pattern: 'var $NAME',
        severity: ASTRuleSeverity.HINT,
        category: ASTRuleCategory.STYLE,
        enabled: true,
      });

      const code = 'console.log("test"); var x = 1;';
      const result = await client.lintCode(code, ASTLanguage.JAVASCRIPT, {
        minSeverity: ASTRuleSeverity.WARNING,
      });

      expect(result.success).toBe(true);
      // Should only include warning from console.log, not hint from var
      const hasHintViolation = result.data!.violations.some(
        (v) => v.rule.severity === ASTRuleSeverity.HINT
      );
      expect(hasHintViolation).toBe(false);
    });

    it('should respect maxViolations', async () => {
      const code = `
        console.log("1");
        console.log("2");
        console.log("3");
      `;
      const result = await client.lintCode(code, ASTLanguage.JAVASCRIPT, {
        maxViolations: 1,
      });

      expect(result.success).toBe(true);
      expect(result.data!.totalViolations).toBe(1);
    });

    it('should group violations by file', async () => {
      await fs.writeFile(path.join(tempDir, 'a.js'), 'console.log("a");');
      await fs.writeFile(path.join(tempDir, 'b.js'), 'console.log("b");');

      const result = await client.lintDirectory(tempDir);

      expect(result.success).toBe(true);
      expect(Object.keys(result.data!.violationsByFile).length).toBe(2);
    });

    it('should group violations by severity', async () => {
      client.registerRule({
        id: 'error-rule',
        name: 'Error',
        language: ASTLanguage.JAVASCRIPT,
        pattern: 'eval($ARGS)',
        severity: ASTRuleSeverity.ERROR,
        category: ASTRuleCategory.SECURITY,
        enabled: true,
      });

      const code = 'console.log("test"); eval("code");';
      const result = await client.lintCode(code, ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data!.violationsBySeverity[ASTRuleSeverity.WARNING].length).toBe(1);
      expect(result.data!.violationsBySeverity[ASTRuleSeverity.ERROR].length).toBe(1);
    });

    it('should provide suggested fix', async () => {
      const code = 'console.log("test");';
      const result = await client.lintCode(code, ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data!.violations[0].suggestedFix).toBeDefined();
    });

    it('should skip disabled rules', async () => {
      client.setRuleEnabled('no-console-log', false);

      const code = 'console.log("test");';
      const result = await client.lintCode(code, ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data!.totalViolations).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Rewrite Tests
  // ---------------------------------------------------------------------------

  describe('rewriting', () => {
    it('should transform code', async () => {
      const code = 'console.log("test");';
      const result = await client.transformCode(
        code,
        'console.log($ARGS)',
        'logger.info($ARGS)',
        ASTLanguage.JAVASCRIPT
      );

      expect(result.success).toBe(true);
      expect(result.data).toContain('logger.info');
    });

    it('should rewrite file in dry run mode', async () => {
      const filePath = path.join(tempDir, 'file.js');
      await fs.writeFile(filePath, 'console.log("test");');

      const result = await client.rewriteFile(
        filePath,
        'console.log($ARGS)',
        'logger.info($ARGS)',
        undefined,
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.data!.applied).toBe(false);

      // Original file should be unchanged
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('console.log');
    });

    it('should rewrite file and apply changes', async () => {
      const filePath = path.join(tempDir, 'file.js');
      await fs.writeFile(filePath, 'console.log("test");');

      const result = await client.rewriteFile(
        filePath,
        'console.log($ARGS)',
        'logger.info($ARGS)',
        undefined,
        { dryRun: false }
      );

      expect(result.success).toBe(true);
      expect(result.data!.applied).toBe(true);

      // File should be modified
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('logger.info');
    });

    it('should create backup when requested', async () => {
      const filePath = path.join(tempDir, 'file.js');
      await fs.writeFile(filePath, 'console.log("test");');

      await client.rewriteFile(
        filePath,
        'console.log($ARGS)',
        'logger.info($ARGS)',
        undefined,
        { dryRun: false, backup: true }
      );

      // Backup should exist
      const backupPath = filePath + '.bak';
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);

      const backupContent = await fs.readFile(backupPath, 'utf-8');
      expect(backupContent).toContain('console.log');
    });

    it('should rewrite directory', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'console.log("1");');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'console.log("2");');

      const result = await client.rewriteDirectory(
        tempDir,
        'console.log($ARGS)',
        'logger.info($ARGS)',
        { dryRun: true }
      );

      expect(result.success).toBe(true);
      expect(result.data!.modifiedFiles.length).toBe(2);
      expect(result.data!.replacementCount).toBe(2);
    });

    it('should apply rewrite rule', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), 'console.log("test");');

      const rule: ASTRewriteRule = {
        pattern: 'console.log($ARGS)',
        replacement: 'logger.info($ARGS)',
        language: ASTLanguage.JAVASCRIPT,
        description: 'Replace console.log with logger.info',
      };

      const result = await client.applyRewriteRule(tempDir, rule, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.data!.replacementCount).toBeGreaterThan(0);
    });

    it('should respect maxFiles limit', async () => {
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'console.log("1");');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'console.log("2");');
      await fs.writeFile(path.join(tempDir, 'file3.js'), 'console.log("3");');

      const result = await client.rewriteDirectory(
        tempDir,
        'console.log($ARGS)',
        'logger.info($ARGS)',
        { dryRun: true, maxFiles: 1 }
      );

      expect(result.success).toBe(true);
      expect(result.data!.modifiedFiles.length).toBe(1);
    });

    it('should apply fixes from violations', async () => {
      client.registerRule({
        id: 'fix-console',
        name: 'Fix Console',
        language: ASTLanguage.JAVASCRIPT,
        pattern: 'console.log($ARGS)',
        severity: ASTRuleSeverity.WARNING,
        category: ASTRuleCategory.BEST_PRACTICE,
        enabled: true,
        fix: { replacement: 'logger.info($ARGS)' },
      });

      const filePath = path.join(tempDir, 'file.js');
      await fs.writeFile(filePath, 'console.log("test");');

      const lintResult = await client.lintFile(filePath);
      expect(lintResult.success).toBe(true);

      const fixResult = await client.applyFixes(lintResult.data!.violations, { dryRun: true });

      expect(fixResult.success).toBe(true);
      expect(fixResult.data!.transformations.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Analysis Tests
  // ---------------------------------------------------------------------------

  describe('analysis', () => {
    it('should parse code to AST', async () => {
      const code = 'const x = 1;';
      const result = await client.parseCode(code, ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.kind).toBe('program');
    });

    it('should parse file to AST', async () => {
      const filePath = path.join(tempDir, 'file.js');
      await fs.writeFile(filePath, 'const x = 1;');

      const result = await client.parseFile(filePath);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should get node kind at position', async () => {
      const code = 'const x = 1;';
      const result = await client.getNodeKindAt(
        code,
        { line: 0, column: 0, offset: 0 },
        ASTLanguage.JAVASCRIPT
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should get all node kinds', async () => {
      const code = 'const x = 1;';
      const result = await client.getNodeKinds(code, ASTLanguage.JAVASCRIPT);

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Utility Tests
  // ---------------------------------------------------------------------------

  describe('utilities', () => {
    it('should validate valid pattern', async () => {
      const result = await client.validatePattern('function $NAME() {}', ASTLanguage.JAVASCRIPT);
      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it('should detect invalid pattern with unbalanced brackets', async () => {
      const result = await client.validatePattern('function $NAME() {', ASTLanguage.JAVASCRIPT);
      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it('should detect language from file path', () => {
      expect(client.detectLanguage('file.ts')).toBe(ASTLanguage.TYPESCRIPT);
      expect(client.detectLanguage('file.py')).toBe(ASTLanguage.PYTHON);
      expect(client.detectLanguage('file.unknown')).toBeUndefined();
    });

    it('should get supported languages', () => {
      const languages = client.getSupportedLanguages();
      expect(languages).toContain(ASTLanguage.TYPESCRIPT);
      expect(languages).toContain(ASTLanguage.JAVASCRIPT);
      expect(languages).toContain(ASTLanguage.PYTHON);
    });

    it('should clear cache', () => {
      client.clearCache();
      // No error should be thrown
      expect(true).toBe(true);
    });

    it('should get statistics', () => {
      const stats = client.getStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.totalSearches).toBe('number');
      expect(typeof stats.totalMatches).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // Statistics Tests
  // ---------------------------------------------------------------------------

  describe('statistics', () => {
    it('should track search statistics', async () => {
      const code = 'console.log("test");';
      await client.searchCode(code, 'console.log', ASTLanguage.JAVASCRIPT);
      await client.searchCode(code, 'console.log', ASTLanguage.JAVASCRIPT);

      const stats = client.getStatistics();
      expect(stats.totalSearches).toBe(2);
      expect(stats.totalMatches).toBeGreaterThan(0);
    });

    it('should track lint statistics', async () => {
      client.registerRule({
        id: 'stat-test',
        name: 'Stat Test',
        language: ASTLanguage.JAVASCRIPT,
        pattern: 'console.log($ARGS)',
        severity: ASTRuleSeverity.WARNING,
        category: ASTRuleCategory.CUSTOM,
        enabled: true,
      });

      const code = 'console.log("test");';
      await client.lintCode(code, ASTLanguage.JAVASCRIPT);

      const stats = client.getStatistics();
      expect(stats.totalLints).toBe(1);
      expect(stats.totalViolations).toBeGreaterThan(0);
    });

    it('should track rewrite statistics', async () => {
      const code = 'console.log("test");';
      await client.transformCode(
        code,
        'console.log($ARGS)',
        'logger.info($ARGS)',
        ASTLanguage.JAVASCRIPT
      );

      const stats = client.getStatistics();
      expect(stats.totalRewrites).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Interface and Helper Tests
// ---------------------------------------------------------------------------

describe('AST-Grep Interface', () => {
  describe('ASTLanguage enum', () => {
    it('should have all expected languages', () => {
      expect(ASTLanguage.TYPESCRIPT).toBe('typescript');
      expect(ASTLanguage.JAVASCRIPT).toBe('javascript');
      expect(ASTLanguage.PYTHON).toBe('python');
      expect(ASTLanguage.RUST).toBe('rust');
      expect(ASTLanguage.GO).toBe('go');
      expect(ASTLanguage.JAVA).toBe('java');
    });
  });

  describe('ASTRuleSeverity enum', () => {
    it('should have all expected severities', () => {
      expect(ASTRuleSeverity.ERROR).toBe('error');
      expect(ASTRuleSeverity.WARNING).toBe('warning');
      expect(ASTRuleSeverity.INFO).toBe('info');
      expect(ASTRuleSeverity.HINT).toBe('hint');
      expect(ASTRuleSeverity.OFF).toBe('off');
    });
  });

  describe('ASTRuleCategory enum', () => {
    it('should have all expected categories', () => {
      expect(ASTRuleCategory.STYLE).toBe('style');
      expect(ASTRuleCategory.CORRECTNESS).toBe('correctness');
      expect(ASTRuleCategory.PERFORMANCE).toBe('performance');
      expect(ASTRuleCategory.SECURITY).toBe('security');
      expect(ASTRuleCategory.BEST_PRACTICE).toBe('best-practice');
      expect(ASTRuleCategory.DEPRECATED).toBe('deprecated');
      expect(ASTRuleCategory.CUSTOM).toBe('custom');
    });
  });

  describe('DEFAULT_AST_GREP_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_AST_GREP_CONFIG.enableCache).toBe(true);
      expect(DEFAULT_AST_GREP_CONFIG.cacheTtl).toBe(60000);
      expect(DEFAULT_AST_GREP_CONFIG.maxConcurrency).toBe(4);
      expect(DEFAULT_AST_GREP_CONFIG.defaultTimeout).toBe(30000);
    });

    it('should have default search options', () => {
      expect(DEFAULT_AST_GREP_CONFIG.defaultSearchOptions).toBeDefined();
      expect(DEFAULT_AST_GREP_CONFIG.defaultSearchOptions!.contextLines).toBe(2);
    });
  });

  describe('FILE_EXTENSION_LANGUAGE_MAP', () => {
    it('should map common extensions', () => {
      expect(FILE_EXTENSION_LANGUAGE_MAP['.ts']).toBe(ASTLanguage.TYPESCRIPT);
      expect(FILE_EXTENSION_LANGUAGE_MAP['.tsx']).toBe(ASTLanguage.TSX);
      expect(FILE_EXTENSION_LANGUAGE_MAP['.js']).toBe(ASTLanguage.JAVASCRIPT);
      expect(FILE_EXTENSION_LANGUAGE_MAP['.jsx']).toBe(ASTLanguage.JSX);
      expect(FILE_EXTENSION_LANGUAGE_MAP['.py']).toBe(ASTLanguage.PYTHON);
      expect(FILE_EXTENSION_LANGUAGE_MAP['.rs']).toBe(ASTLanguage.RUST);
      expect(FILE_EXTENSION_LANGUAGE_MAP['.go']).toBe(ASTLanguage.GO);
    });
  });

  describe('AST_PATTERN_TEMPLATES', () => {
    it('should have JavaScript patterns', () => {
      expect(AST_PATTERN_TEMPLATES.js).toBeDefined();
      expect(AST_PATTERN_TEMPLATES.js.functionDeclaration).toBeDefined();
      expect(AST_PATTERN_TEMPLATES.js.arrowFunction).toBeDefined();
      expect(AST_PATTERN_TEMPLATES.js.classDeclaration).toBeDefined();
    });

    it('should have Python patterns', () => {
      expect(AST_PATTERN_TEMPLATES.python).toBeDefined();
      expect(AST_PATTERN_TEMPLATES.python.functionDef).toBeDefined();
      expect(AST_PATTERN_TEMPLATES.python.classDef).toBeDefined();
    });

    it('should have Go patterns', () => {
      expect(AST_PATTERN_TEMPLATES.go).toBeDefined();
      expect(AST_PATTERN_TEMPLATES.go.funcDeclaration).toBeDefined();
    });

    it('should have Rust patterns', () => {
      expect(AST_PATTERN_TEMPLATES.rust).toBeDefined();
      expect(AST_PATTERN_TEMPLATES.rust.fnDeclaration).toBeDefined();
    });
  });

  describe('helper functions', () => {
    it('detectLanguageFromPath should detect language', () => {
      expect(detectLanguageFromPath('file.ts')).toBe(ASTLanguage.TYPESCRIPT);
      expect(detectLanguageFromPath('path/to/file.py')).toBe(ASTLanguage.PYTHON);
      expect(detectLanguageFromPath('file.unknown')).toBeUndefined();
    });

    it('isLanguageSupported should check language support', () => {
      expect(isLanguageSupported('typescript')).toBe(true);
      expect(isLanguageSupported('python')).toBe(true);
      expect(isLanguageSupported('unknown')).toBe(false);
    });

    it('getSupportedExtensions should return extensions', () => {
      const extensions = getSupportedExtensions();
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.js');
      expect(extensions).toContain('.py');
    });

    it('metavar should create metavariable', () => {
      expect(metavar('name')).toBe('$NAME');
      expect(metavar('myVar')).toBe('$MYVAR');
    });

    it('multiMetavar should create multi-match metavariable', () => {
      expect(multiMetavar('args')).toBe('$$$ARGS');
      expect(multiMetavar('items')).toBe('$$$ITEMS');
    });
  });
});
