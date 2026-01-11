/**
 * Static Code Analyzer
 *
 * Feature: F5.6 - Code Scanning 심화
 * Provides static analysis with pattern matching and AST-based analysis
 *
 * @module core/security/scanning
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { SecurityIssueSeverity } from '../plugin/plugin-security.interface.js';
import type {
  IStaticAnalyzer,
  StaticAnalysisRule,
  StaticAnalysisOptions,
  StaticAnalysisResult,
  ScanIssue,
  ProgrammingLanguage,
} from './scanning.interface.js';
import {
  DEFAULT_EXCLUDE_PATTERNS,
  EXTENSION_TO_LANGUAGE,
  SEVERITY_WEIGHTS,
} from './scanning.interface.js';

/**
 * Default static analysis rules
 */
const DEFAULT_RULES: StaticAnalysisRule[] = [
  // Code Injection
  {
    id: 'SA001',
    name: 'eval-usage',
    description: 'Use of eval() is dangerous and can lead to code injection',
    severity: SecurityIssueSeverity.HIGH,
    category: 'code-injection',
    pattern: /\beval\s*\(/g,
    languages: ['javascript', 'typescript', 'python'],
    enabled: true,
    cweId: 'CWE-94',
    references: ['https://cwe.mitre.org/data/definitions/94.html'],
    fixTemplate: 'Replace eval() with JSON.parse() or a safer alternative',
  },
  {
    id: 'SA002',
    name: 'function-constructor',
    description: 'Function constructor can be used for code injection',
    severity: SecurityIssueSeverity.HIGH,
    category: 'code-injection',
    pattern: /new\s+Function\s*\(/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-94',
    references: ['https://cwe.mitre.org/data/definitions/94.html'],
  },
  {
    id: 'SA003',
    name: 'setTimeout-string',
    description: 'setTimeout with string argument can lead to code injection',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'code-injection',
    pattern: /setTimeout\s*\(\s*['"`]/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-94',
  },
  {
    id: 'SA004',
    name: 'setInterval-string',
    description: 'setInterval with string argument can lead to code injection',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'code-injection',
    pattern: /setInterval\s*\(\s*['"`]/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-94',
  },

  // Command Injection
  {
    id: 'SA010',
    name: 'child-process-exec',
    description: 'exec() can be vulnerable to command injection, prefer execFile()',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'command-injection',
    pattern: /(?:child_process|require\s*\(\s*['"]child_process['"]\s*\)).*\.exec\s*\(/gs,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-78',
    references: ['https://cwe.mitre.org/data/definitions/78.html'],
    fixTemplate: 'Use execFile() or spawn() instead of exec()',
  },
  {
    id: 'SA011',
    name: 'shell-true',
    description: 'Using shell: true can lead to command injection',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'command-injection',
    pattern: /shell\s*:\s*true/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-78',
    fixTemplate: 'Remove shell: true and use array arguments',
  },
  {
    id: 'SA012',
    name: 'os-system',
    description: 'os.system() can be vulnerable to command injection',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'command-injection',
    pattern: /os\.system\s*\(/g,
    languages: ['python'],
    enabled: true,
    cweId: 'CWE-78',
    fixTemplate: 'Use subprocess.run() with shell=False',
  },
  {
    id: 'SA013',
    name: 'subprocess-shell',
    description: 'subprocess with shell=True can be vulnerable',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'command-injection',
    pattern: /subprocess\.\w+\s*\([^)]*shell\s*=\s*True/g,
    languages: ['python'],
    enabled: true,
    cweId: 'CWE-78',
  },

  // SQL Injection
  {
    id: 'SA020',
    name: 'sql-string-concat',
    description: 'String concatenation in SQL query may lead to SQL injection',
    severity: SecurityIssueSeverity.HIGH,
    category: 'sql-injection',
    pattern: /(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE).*(?:\+\s*\w+|\$\{[^}]+\}|%s)/gi,
    enabled: true,
    cweId: 'CWE-89',
    references: ['https://cwe.mitre.org/data/definitions/89.html'],
    fixTemplate: 'Use parameterized queries or prepared statements',
  },
  {
    id: 'SA021',
    name: 'query-raw',
    description: 'Raw SQL query detected, ensure proper escaping',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'sql-injection',
    pattern: /\.(?:query|execute)\s*\(\s*['"`](?:SELECT|INSERT|UPDATE|DELETE)/gi,
    languages: ['javascript', 'typescript', 'python'],
    enabled: true,
    cweId: 'CWE-89',
  },

  // XSS
  {
    id: 'SA030',
    name: 'innerhtml-assignment',
    description: 'Direct innerHTML assignment can lead to XSS',
    severity: SecurityIssueSeverity.HIGH,
    category: 'xss',
    pattern: /\.innerHTML\s*=/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-79',
    references: ['https://cwe.mitre.org/data/definitions/79.html'],
    fixTemplate: 'Use textContent or sanitize HTML before assignment',
  },
  {
    id: 'SA031',
    name: 'document-write',
    description: 'document.write() can lead to XSS',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'xss',
    pattern: /document\.write\s*\(/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-79',
    fixTemplate: 'Use DOM manipulation methods instead',
  },
  {
    id: 'SA032',
    name: 'dangerouslysetinnerhtml',
    description: 'dangerouslySetInnerHTML can lead to XSS if not sanitized',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'xss',
    pattern: /dangerouslySetInnerHTML/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-79',
    fixTemplate: 'Sanitize content before using dangerouslySetInnerHTML',
  },

  // Path Traversal
  {
    id: 'SA040',
    name: 'path-traversal-pattern',
    description: 'Path traversal pattern detected',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'path-traversal',
    pattern: /\.\.(?:\/|\\)/g,
    enabled: true,
    cweId: 'CWE-22',
    references: ['https://cwe.mitre.org/data/definitions/22.html'],
    fixTemplate: 'Use path.resolve() and validate against base path',
  },
  {
    id: 'SA041',
    name: 'path-join-user-input',
    description: 'path.join with potential user input',
    severity: SecurityIssueSeverity.LOW,
    category: 'path-traversal',
    pattern: /path\.join\s*\([^)]*(?:req\.|params\.|query\.|body\.)/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-22',
    fixTemplate: 'Validate and sanitize user input before path operations',
  },

  // Prototype Pollution
  {
    id: 'SA050',
    name: 'prototype-access',
    description: 'Direct prototype access can lead to prototype pollution',
    severity: SecurityIssueSeverity.HIGH,
    category: 'prototype-pollution',
    pattern: /\[['"](?:__proto__|constructor|prototype)['"]\]/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-1321',
    references: ['https://cwe.mitre.org/data/definitions/1321.html'],
    fixTemplate: 'Use Object.hasOwnProperty() or Map instead',
  },
  {
    id: 'SA051',
    name: 'object-assign-spread',
    description: 'Object spread with user input may lead to prototype pollution',
    severity: SecurityIssueSeverity.LOW,
    category: 'prototype-pollution',
    pattern: /Object\.assign\s*\(\s*\{\s*\}/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-1321',
    fixTemplate: 'Sanitize user input before object merge operations',
  },

  // Cryptography
  {
    id: 'SA060',
    name: 'weak-hash-md5',
    description: 'MD5 is considered cryptographically weak',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'crypto',
    pattern: /createHash\s*\(\s*['"]md5['"]\)/gi,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-328',
    references: ['https://cwe.mitre.org/data/definitions/328.html'],
    fixTemplate: 'Use SHA-256 or stronger hash algorithm',
  },
  {
    id: 'SA061',
    name: 'weak-hash-sha1',
    description: 'SHA1 is considered weak for security purposes',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'crypto',
    pattern: /createHash\s*\(\s*['"]sha1['"]\)/gi,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-328',
    fixTemplate: 'Use SHA-256 or stronger hash algorithm',
  },
  {
    id: 'SA062',
    name: 'weak-random',
    description: 'Math.random() is not cryptographically secure',
    severity: SecurityIssueSeverity.LOW,
    category: 'crypto',
    pattern: /Math\.random\s*\(\s*\)/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-338',
    fixTemplate: 'Use crypto.randomBytes() for security-sensitive operations',
  },
  {
    id: 'SA063',
    name: 'hardcoded-iv',
    description: 'Hardcoded initialization vector detected',
    severity: SecurityIssueSeverity.HIGH,
    category: 'crypto',
    pattern: /(?:iv|IV|nonce)\s*[:=]\s*(?:Buffer\.from\s*\(\s*)?['"][a-fA-F0-9]+['"]/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-329',
    fixTemplate: 'Generate random IV for each encryption operation',
  },

  // Transport Security
  {
    id: 'SA070',
    name: 'http-no-tls',
    description: 'HTTP without TLS for external connection',
    severity: SecurityIssueSeverity.LOW,
    category: 'transport',
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/g,
    enabled: true,
    cweId: 'CWE-319',
    references: ['https://cwe.mitre.org/data/definitions/319.html'],
    fixTemplate: 'Use HTTPS for external connections',
  },
  {
    id: 'SA071',
    name: 'tls-reject-unauthorized',
    description: 'Disabling TLS certificate verification is dangerous',
    severity: SecurityIssueSeverity.HIGH,
    category: 'transport',
    pattern: /rejectUnauthorized\s*:\s*false/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-295',
    fixTemplate: 'Enable certificate verification in production',
  },
  {
    id: 'SA072',
    name: 'insecure-ssl-version',
    description: 'Use of insecure SSL/TLS version',
    severity: SecurityIssueSeverity.HIGH,
    category: 'transport',
    pattern: /(?:SSLv2|SSLv3|TLSv1(?:\.[01])?)['"]/g,
    enabled: true,
    cweId: 'CWE-326',
    fixTemplate: 'Use TLS 1.2 or higher',
  },

  // Authentication & Authorization
  {
    id: 'SA080',
    name: 'hardcoded-credentials',
    description: 'Potential hardcoded credentials detected',
    severity: SecurityIssueSeverity.HIGH,
    category: 'authentication',
    pattern: /(?:password|passwd|pwd|secret|apikey|api_key)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    enabled: true,
    cweId: 'CWE-798',
    references: ['https://cwe.mitre.org/data/definitions/798.html'],
    fixTemplate: 'Use environment variables or secret management',
  },
  {
    id: 'SA081',
    name: 'jwt-none-algorithm',
    description: 'JWT with none algorithm is insecure',
    severity: SecurityIssueSeverity.CRITICAL,
    category: 'authentication',
    pattern: /algorithm\s*[:=]\s*['"]none['"]/gi,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-347',
    fixTemplate: 'Use a secure algorithm like HS256 or RS256',
  },
  {
    id: 'SA082',
    name: 'weak-password-requirements',
    description: 'Weak password validation detected',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'authentication',
    pattern: /password\.length\s*(?:>=|>)\s*[1-6](?:\D|$)/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-521',
    fixTemplate: 'Require minimum 8 characters with complexity',
  },

  // Deserialization
  {
    id: 'SA090',
    name: 'unsafe-yaml-load',
    description: 'yaml.load() can execute arbitrary code',
    severity: SecurityIssueSeverity.HIGH,
    category: 'deserialization',
    pattern: /yaml\.load\s*\(/g,
    languages: ['python'],
    enabled: true,
    cweId: 'CWE-502',
    references: ['https://cwe.mitre.org/data/definitions/502.html'],
    fixTemplate: 'Use yaml.safe_load() instead',
  },
  {
    id: 'SA091',
    name: 'pickle-load',
    description: 'pickle.load() can execute arbitrary code',
    severity: SecurityIssueSeverity.HIGH,
    category: 'deserialization',
    pattern: /pickle\.(?:load|loads)\s*\(/g,
    languages: ['python'],
    enabled: true,
    cweId: 'CWE-502',
    fixTemplate: 'Avoid pickle with untrusted data, use JSON',
  },

  // ReDoS
  {
    id: 'SA100',
    name: 'redos-potential',
    description: 'Potentially vulnerable regex pattern (ReDoS)',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'redos',
    pattern: /new\s+RegExp\s*\(\s*[^)]*\+/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-1333',
    references: ['https://cwe.mitre.org/data/definitions/1333.html'],
    fixTemplate: 'Validate regex patterns or use re2 for user input',
  },

  // Information Disclosure
  {
    id: 'SA110',
    name: 'stack-trace-exposure',
    description: 'Stack trace may be exposed to users',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'information-disclosure',
    pattern: /(?:res|response)\.(?:send|json|write)\s*\([^)]*(?:err|error)(?:\.stack|\.message)?/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-209',
    fixTemplate: 'Return generic error messages to users',
  },
  {
    id: 'SA111',
    name: 'debug-logging',
    description: 'Debug logging may expose sensitive information',
    severity: SecurityIssueSeverity.LOW,
    category: 'information-disclosure',
    pattern: /console\.(?:log|debug|trace)\s*\([^)]*(?:password|secret|token|key|auth)/gi,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-532',
    fixTemplate: 'Remove or mask sensitive data in logs',
  },

  // Configuration Issues
  {
    id: 'SA120',
    name: 'cors-allow-all',
    description: 'CORS allows all origins',
    severity: SecurityIssueSeverity.MEDIUM,
    category: 'configuration',
    pattern: /(?:Access-Control-Allow-Origin|origin)\s*[:=]\s*['"]\*['"]/g,
    languages: ['javascript', 'typescript'],
    enabled: true,
    cweId: 'CWE-942',
    fixTemplate: 'Restrict CORS to specific trusted origins',
  },
  {
    id: 'SA121',
    name: 'debug-mode-enabled',
    description: 'Debug mode enabled in configuration',
    severity: SecurityIssueSeverity.LOW,
    category: 'configuration',
    pattern: /(?:DEBUG|debug)\s*[:=]\s*(?:true|1|['"]true['"])/g,
    enabled: true,
    cweId: 'CWE-489',
    fixTemplate: 'Disable debug mode in production',
  },
];

/**
 * Static Analyzer implementation
 */
export class StaticAnalyzer implements IStaticAnalyzer {
  private rules: Map<string, StaticAnalysisRule> = new Map();
  private disposed = false;

  constructor(rules?: StaticAnalysisRule[]) {
    // Load default rules
    for (const rule of DEFAULT_RULES) {
      this.rules.set(rule.id, rule);
    }

    // Load custom rules
    if (rules) {
      for (const rule of rules) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  async analyzeCode(
    code: string,
    options: StaticAnalysisOptions = {}
  ): Promise<StaticAnalysisResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const issues: ScanIssue[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const language = options.languages?.[0] ?? 'unknown';
      const applicableRules = this.getApplicableRules(options, language);

      for (const rule of applicableRules) {
        try {
          const ruleIssues = this.applyRule(rule, code, 'code', language);
          issues.push(...ruleIssues);
        } catch (error) {
          errors.push(`Error applying rule ${rule.id}: ${error}`);
        }
      }

      // Filter by minimum severity if specified
      const filteredIssues = this.filterBySeverity(issues, options.minSeverity);

      // Remove potential false positives if not included
      const finalIssues = options.includeFalsePositives
        ? filteredIssues
        : filteredIssues.filter((i) => !i.potentialFalsePositive);

      const endTime = new Date();
      const lines = code.split('\n').length;

      return {
        type: 'static-analysis',
        success: errors.length === 0,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: finalIssues,
        filesScanned: 1,
        linesScanned: lines,
        errors,
        warnings,
        rulesApplied: applicableRules.length,
        issuesBySeverity: this.countBySeverity(finalIssues),
        issuesByCategory: this.countByCategory(finalIssues),
        languageBreakdown: {
          [language]: { files: 1, lines },
        } as Record<ProgrammingLanguage, { files: number; lines: number }>,
      };
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'static-analysis',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Analysis failed: ${error}`],
        warnings,
        rulesApplied: 0,
        issuesBySeverity: this.countBySeverity([]),
        issuesByCategory: {},
        languageBreakdown: {} as Record<ProgrammingLanguage, { files: number; lines: number }>,
      };
    }
  }

  async analyzeFile(
    filePath: string,
    options: StaticAnalysisOptions = {}
  ): Promise<StaticAnalysisResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check file size
      const stats = fs.statSync(filePath);
      const maxSize = options.maxFileSize ?? 1024 * 1024; // 1MB default

      if (stats.size > maxSize) {
        warnings.push(`File ${filePath} exceeds max size (${stats.size} > ${maxSize})`);
        return this.createEmptyResult(startTime, errors, warnings);
      }

      // Read file content
      const code = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      const language = EXTENSION_TO_LANGUAGE[ext] ?? 'unknown';

      // Run analysis
      const result = await this.analyzeCode(code, {
        ...options,
        languages: [language],
      });

      // Update file path in issues
      for (const issue of result.issues) {
        if (issue.location) {
          issue.location.file = filePath;
        }
      }

      return result;
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'static-analysis',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Failed to analyze file ${filePath}: ${error}`],
        warnings,
        rulesApplied: 0,
        issuesBySeverity: this.countBySeverity([]),
        issuesByCategory: {},
        languageBreakdown: {} as Record<ProgrammingLanguage, { files: number; lines: number }>,
      };
    }
  }

  async analyzeDirectory(
    dirPath: string,
    options: StaticAnalysisOptions = {}
  ): Promise<StaticAnalysisResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const allIssues: ScanIssue[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const languageBreakdown: Record<ProgrammingLanguage, { files: number; lines: number }> =
      {} as Record<ProgrammingLanguage, { files: number; lines: number }>;
    let filesScanned = 0;
    let linesScanned = 0;

    try {
      // Build include patterns
      const includePatterns = options.includePatterns ?? ['**/*.{js,ts,jsx,tsx,py,java,go,rs,rb,php}'];
      const excludePatterns = options.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;

      // Find files
      const files: string[] = [];
      for (const pattern of includePatterns) {
        const matches = await glob(pattern, {
          cwd: dirPath,
          ignore: excludePatterns,
          absolute: true,
          nodir: true,
        });
        files.push(...matches);
      }

      // Remove duplicates
      const uniqueFiles = [...new Set(files)];

      // Analyze each file
      for (const file of uniqueFiles) {
        try {
          const result = await this.analyzeFile(file, options);

          allIssues.push(...result.issues);
          filesScanned++;
          linesScanned += result.linesScanned;
          errors.push(...result.errors);
          warnings.push(...result.warnings);

          // Update language breakdown
          for (const [lang, stats] of Object.entries(result.languageBreakdown)) {
            const key = lang as ProgrammingLanguage;
            if (!languageBreakdown[key]) {
              languageBreakdown[key] = { files: 0, lines: 0 };
            }
            languageBreakdown[key].files += stats.files;
            languageBreakdown[key].lines += stats.lines;
          }
        } catch (error) {
          errors.push(`Error analyzing ${file}: ${error}`);
        }
      }

      const endTime = new Date();
      const applicableRules = this.getApplicableRules(options);

      return {
        type: 'static-analysis',
        success: errors.length === 0,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: allIssues,
        filesScanned,
        linesScanned,
        errors,
        warnings,
        rulesApplied: applicableRules.length,
        issuesBySeverity: this.countBySeverity(allIssues),
        issuesByCategory: this.countByCategory(allIssues),
        languageBreakdown,
      };
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'static-analysis',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Failed to analyze directory ${dirPath}: ${error}`],
        warnings,
        rulesApplied: 0,
        issuesBySeverity: this.countBySeverity([]),
        issuesByCategory: {},
        languageBreakdown: {} as Record<ProgrammingLanguage, { files: number; lines: number }>,
      };
    }
  }

  getRules(): StaticAnalysisRule[] {
    this.ensureNotDisposed();
    return Array.from(this.rules.values());
  }

  addRule(rule: StaticAnalysisRule): void {
    this.ensureNotDisposed();
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    this.ensureNotDisposed();
    return this.rules.delete(ruleId);
  }

  setRuleEnabled(ruleId: string, enabled: boolean): void {
    this.ensureNotDisposed();
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  dispose(): void {
    if (!this.disposed) {
      this.rules.clear();
      this.disposed = true;
    }
  }

  // ==================== Private Methods ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('StaticAnalyzer has been disposed');
    }
  }

  private getApplicableRules(
    options: StaticAnalysisOptions,
    language?: ProgrammingLanguage
  ): StaticAnalysisRule[] {
    let rules = Array.from(this.rules.values()).filter((r) => r.enabled);

    // Add custom rules
    if (options.customRules) {
      rules = [...rules, ...options.customRules];
    }

    // Filter by include/exclude
    if (options.includeRules?.length) {
      rules = rules.filter(
        (r) =>
          options.includeRules!.includes(r.id) || options.includeRules!.includes(r.category)
      );
    }

    if (options.excludeRules?.length) {
      rules = rules.filter(
        (r) =>
          !options.excludeRules!.includes(r.id) && !options.excludeRules!.includes(r.category)
      );
    }

    // Filter by language
    if (language && language !== 'unknown') {
      rules = rules.filter((r) => !r.languages || r.languages.includes(language));
    }

    return rules;
  }

  private applyRule(
    rule: StaticAnalysisRule,
    code: string,
    file: string,
    language: ProgrammingLanguage
  ): ScanIssue[] {
    const issues: ScanIssue[] = [];

    if (typeof rule.pattern === 'function') {
      // Custom function pattern
      return rule.pattern(code, language);
    }

    // Regex pattern
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    const lines = code.split('\n');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const location = this.getLocationFromOffset(code, match.index, lines);

      issues.push({
        id: `${rule.id}-${match.index}`,
        ruleId: rule.id,
        severity: rule.severity,
        category: rule.category,
        title: rule.name,
        message: rule.description,
        location: {
          file,
          line: location.line,
          column: location.column,
          snippet: this.getSnippet(lines, location.line),
        },
        suggestion: rule.fixTemplate,
        references: rule.references,
        confidence: 0.8, // Default confidence for pattern matches
        cweId: rule.cweId,
      });
    }

    return issues;
  }

  private getLocationFromOffset(
    _code: string,
    offset: number,
    lines: string[]
  ): { line: number; column: number } {
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline

      if (currentOffset + lineLength > offset) {
        return {
          line: i + 1,
          column: offset - currentOffset + 1,
        };
      }

      currentOffset += lineLength;
    }

    return { line: lines.length, column: 1 };
  }

  private getSnippet(lines: string[], lineNum: number): string {
    const index = lineNum - 1;
    if (index >= 0 && index < lines.length) {
      return lines[index].trim();
    }
    return '';
  }

  private filterBySeverity(issues: ScanIssue[], minSeverity?: SecurityIssueSeverity): ScanIssue[] {
    if (!minSeverity) return issues;

    const minWeight = SEVERITY_WEIGHTS[minSeverity];
    return issues.filter((i) => SEVERITY_WEIGHTS[i.severity] >= minWeight);
  }

  private countBySeverity(issues: ScanIssue[]): Record<SecurityIssueSeverity, number> {
    const counts: Record<SecurityIssueSeverity, number> = {
      [SecurityIssueSeverity.CRITICAL]: 0,
      [SecurityIssueSeverity.HIGH]: 0,
      [SecurityIssueSeverity.MEDIUM]: 0,
      [SecurityIssueSeverity.LOW]: 0,
      [SecurityIssueSeverity.INFO]: 0,
    };

    for (const issue of issues) {
      counts[issue.severity]++;
    }

    return counts;
  }

  private countByCategory(issues: ScanIssue[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const issue of issues) {
      counts[issue.category] = (counts[issue.category] ?? 0) + 1;
    }

    return counts;
  }

  private createEmptyResult(
    startTime: Date,
    errors: string[],
    warnings: string[]
  ): StaticAnalysisResult {
    const endTime = new Date();
    return {
      type: 'static-analysis',
      success: errors.length === 0,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      issues: [],
      filesScanned: 0,
      linesScanned: 0,
      errors,
      warnings,
      rulesApplied: 0,
      issuesBySeverity: this.countBySeverity([]),
      issuesByCategory: {},
      languageBreakdown: {} as Record<ProgrammingLanguage, { files: number; lines: number }>,
    };
  }
}

/**
 * Get default static analyzer
 */
export function createStaticAnalyzer(rules?: StaticAnalysisRule[]): IStaticAnalyzer {
  return new StaticAnalyzer(rules);
}
