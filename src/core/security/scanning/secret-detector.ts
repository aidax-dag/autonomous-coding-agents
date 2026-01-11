/**
 * Secret Leak Detector
 *
 * Feature: F5.6 - Code Scanning 심화
 * Provides detection of secrets, credentials, and sensitive data in code
 *
 * @module core/security/scanning
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { SecurityIssueSeverity } from '../plugin/plugin-security.interface.js';
import type {
  ISecretDetector,
  SecretDetectionRule,
  SecretDetectionOptions,
  SecretDetectionResult,
  DetectedSecret,
  DetectedSecretType,
  ScanIssue,
} from './scanning.interface.js';
import { DEFAULT_EXCLUDE_PATTERNS } from './scanning.interface.js';

/**
 * Default secret detection rules
 */
const DEFAULT_SECRET_RULES: SecretDetectionRule[] = [
  // AWS
  {
    id: 'SEC001',
    name: 'AWS Access Key ID',
    secretType: 'aws_key',
    pattern: /(?:^|[^A-Z0-9])((A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16})(?![A-Z0-9])/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['aws', 'amazon', 'access_key'],
    entropyThreshold: 3.0,
    enabled: true,
  },
  {
    id: 'SEC002',
    name: 'AWS Secret Access Key',
    secretType: 'aws_secret',
    pattern: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['aws', 'secret'],
    entropyThreshold: 4.0,
    enabled: true,
  },

  // GitHub
  {
    id: 'SEC010',
    name: 'GitHub Personal Access Token',
    secretType: 'github_token',
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['github', 'token', 'pat'],
    enabled: true,
  },
  {
    id: 'SEC011',
    name: 'GitHub OAuth Token',
    secretType: 'github_token',
    pattern: /gho_[A-Za-z0-9]{36}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['github', 'oauth'],
    enabled: true,
  },
  {
    id: 'SEC012',
    name: 'GitHub App Token',
    secretType: 'github_token',
    pattern: /(?:ghu|ghs)_[A-Za-z0-9]{36}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['github', 'app'],
    enabled: true,
  },
  {
    id: 'SEC013',
    name: 'GitHub Fine-grained Token',
    secretType: 'github_token',
    pattern: /github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['github', 'token'],
    enabled: true,
  },

  // GitLab
  {
    id: 'SEC020',
    name: 'GitLab Personal Access Token',
    secretType: 'gitlab_token',
    pattern: /glpat-[A-Za-z0-9_-]{20}/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['gitlab', 'token'],
    enabled: true,
  },
  {
    id: 'SEC021',
    name: 'GitLab Pipeline Token',
    secretType: 'gitlab_token',
    pattern: /glcbt-[A-Za-z0-9]{1,5}_[A-Za-z0-9_-]{20}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['gitlab', 'pipeline'],
    enabled: true,
  },

  // NPM
  {
    id: 'SEC030',
    name: 'NPM Access Token',
    secretType: 'npm_token',
    pattern: /npm_[A-Za-z0-9]{36}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['npm', 'token'],
    enabled: true,
  },

  // PyPI
  {
    id: 'SEC031',
    name: 'PyPI API Token',
    secretType: 'pypi_token',
    pattern: /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['pypi', 'token'],
    enabled: true,
  },

  // Slack
  {
    id: 'SEC040',
    name: 'Slack Bot Token',
    secretType: 'slack_token',
    pattern: /xoxb-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['slack', 'bot', 'token'],
    enabled: true,
  },
  {
    id: 'SEC041',
    name: 'Slack User Token',
    secretType: 'slack_token',
    pattern: /xoxp-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-f0-9]{32}/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['slack', 'user', 'token'],
    enabled: true,
  },
  {
    id: 'SEC042',
    name: 'Slack Webhook URL',
    secretType: 'slack_webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{24}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['slack', 'webhook'],
    enabled: true,
  },

  // Stripe
  {
    id: 'SEC050',
    name: 'Stripe API Key',
    secretType: 'stripe_key',
    pattern: /sk_(?:live|test)_[A-Za-z0-9]{24,}/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['stripe', 'api', 'key'],
    enabled: true,
  },
  {
    id: 'SEC051',
    name: 'Stripe Restricted API Key',
    secretType: 'stripe_key',
    pattern: /rk_(?:live|test)_[A-Za-z0-9]{24,}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['stripe', 'restricted'],
    enabled: true,
  },

  // Twilio
  {
    id: 'SEC060',
    name: 'Twilio Account SID',
    secretType: 'twilio_key',
    pattern: /AC[a-f0-9]{32}/g,
    severity: SecurityIssueSeverity.MEDIUM,
    keywords: ['twilio', 'account'],
    enabled: true,
  },
  {
    id: 'SEC061',
    name: 'Twilio Auth Token',
    secretType: 'twilio_key',
    pattern: /(?:twilio_auth_token|TWILIO_AUTH_TOKEN)\s*[=:]\s*['"]?([a-f0-9]{32})['"]?/gi,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['twilio', 'auth'],
    enabled: true,
  },

  // SendGrid
  {
    id: 'SEC070',
    name: 'SendGrid API Key',
    secretType: 'sendgrid_key',
    pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['sendgrid', 'api'],
    enabled: true,
  },

  // Azure
  {
    id: 'SEC080',
    name: 'Azure Storage Account Key',
    secretType: 'azure_key',
    pattern: /(?:AccountKey|account_key|storage_key)\s*[=:]\s*['"]?([A-Za-z0-9+/]{86}==)['"]?/gi,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['azure', 'storage', 'account'],
    enabled: true,
  },
  {
    id: 'SEC081',
    name: 'Azure Connection String',
    secretType: 'connection_string',
    pattern: /DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/]{86}==/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['azure', 'connection'],
    enabled: true,
  },

  // GCP
  {
    id: 'SEC090',
    name: 'Google API Key',
    secretType: 'gcp_key',
    pattern: /AIza[A-Za-z0-9_-]{35}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['google', 'api', 'gcp'],
    enabled: true,
  },
  {
    id: 'SEC091',
    name: 'Google OAuth Client ID',
    secretType: 'gcp_key',
    pattern: /[0-9]+-[a-z0-9]{32}\.apps\.googleusercontent\.com/g,
    severity: SecurityIssueSeverity.MEDIUM,
    keywords: ['google', 'oauth', 'client'],
    enabled: true,
  },

  // Database
  {
    id: 'SEC100',
    name: 'Database Connection String',
    secretType: 'database_url',
    pattern: /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|mssql|redis):\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['database', 'connection', 'url'],
    enabled: true,
  },

  // Private Keys
  {
    id: 'SEC110',
    name: 'Private Key',
    secretType: 'private_key',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY(?:\s+BLOCK)?-----/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['private', 'key', 'rsa', 'ssh'],
    enabled: true,
  },
  {
    id: 'SEC111',
    name: 'SSH Private Key',
    secretType: 'ssh_key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: SecurityIssueSeverity.CRITICAL,
    keywords: ['ssh', 'private', 'key'],
    enabled: true,
  },

  // JWT
  {
    id: 'SEC120',
    name: 'JSON Web Token',
    secretType: 'jwt',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['jwt', 'token', 'bearer'],
    entropyThreshold: 4.0,
    enabled: true,
  },

  // Generic Secrets
  {
    id: 'SEC130',
    name: 'Generic API Key',
    secretType: 'api_key',
    pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]?([A-Za-z0-9_-]{20,})['"]?/gi,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['api', 'key'],
    entropyThreshold: 3.5,
    checkFalsePositives: true,
    falsePositivePatterns: [/^[a-f0-9]{32}$/, /^test/, /^example/, /^placeholder/i],
    enabled: true,
  },
  {
    id: 'SEC131',
    name: 'Generic Secret',
    secretType: 'generic_secret',
    pattern: /(?:secret|password|passwd|pwd|auth_token|access_token|refresh_token)\s*[=:]\s*['"]([^'"]{8,})['"](?!\s*(?:process\.env|\$\{|getenv))/gi,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['secret', 'password', 'token'],
    entropyThreshold: 3.0,
    checkFalsePositives: true,
    falsePositivePatterns: [
      /^[\*x]+$/i,
      /^test/i,
      /^example/i,
      /^placeholder/i,
      /^your[_-]?/i,
      /^\${/,
      /^process\.env/,
    ],
    enabled: true,
  },
  {
    id: 'SEC132',
    name: 'Hardcoded Password',
    secretType: 'password',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]{4,})['"](?!\s*(?:process\.env|\$\{))/gi,
    severity: SecurityIssueSeverity.MEDIUM,
    keywords: ['password'],
    entropyThreshold: 2.5,
    checkFalsePositives: true,
    falsePositivePatterns: [
      /^[\*x]+$/i,
      /^test/i,
      /^example/i,
      /^placeholder/i,
      /^your[_-]?/i,
      /^password$/i,
      /^\${/,
      /^process\.env/,
    ],
    enabled: true,
  },

  // Basic Auth
  {
    id: 'SEC140',
    name: 'Basic Auth Header',
    secretType: 'basic_auth',
    pattern: /(?:Authorization|auth)\s*[:=]\s*['"]Basic\s+([A-Za-z0-9+/=]{10,})['"]?/gi,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['authorization', 'basic'],
    enabled: true,
  },
  {
    id: 'SEC141',
    name: 'Bearer Token',
    secretType: 'bearer_token',
    pattern: /(?:Authorization|auth)\s*[:=]\s*['"]Bearer\s+([A-Za-z0-9._-]{20,})['"]?/gi,
    severity: SecurityIssueSeverity.HIGH,
    keywords: ['authorization', 'bearer'],
    enabled: true,
  },
];

/**
 * Files to always exclude from secret detection
 */
const SECRET_EXCLUDE_PATTERNS = [
  ...DEFAULT_EXCLUDE_PATTERNS,
  '**/*.test.*',
  '**/*.spec.*',
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/fixtures/**',
  '**/mocks/**',
  '**/*.md',
  '**/*.txt',
  '**/CHANGELOG*',
  '**/LICENSE*',
  '**/README*',
];

/**
 * Secret Detector implementation
 */
export class SecretDetector implements ISecretDetector {
  private rules: Map<string, SecretDetectionRule> = new Map();
  private disposed = false;

  constructor(rules?: SecretDetectionRule[]) {
    // Load default rules
    for (const rule of DEFAULT_SECRET_RULES) {
      this.rules.set(rule.id, rule);
    }

    // Load custom rules
    if (rules) {
      for (const rule of rules) {
        this.rules.set(rule.id, rule);
      }
    }
  }

  async detectInCode(
    code: string,
    options: SecretDetectionOptions = {}
  ): Promise<SecretDetectionResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const secrets: DetectedSecret[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const applicableRules = this.getApplicableRules(options);

      for (const rule of applicableRules) {
        try {
          const detected = this.applyRule(rule, code, 'code', options);
          secrets.push(...detected);
        } catch (error) {
          errors.push(`Error applying rule ${rule.id}: ${error}`);
        }
      }

      // Filter false positives unless included
      const filteredSecrets = options.includeFalsePositives
        ? secrets
        : secrets.filter((s) => s.confidence >= 0.7);

      const endTime = new Date();

      return {
        type: 'secret-detection',
        success: errors.length === 0,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: this.buildIssuesFromSecrets(filteredSecrets),
        filesScanned: 1,
        linesScanned: code.split('\n').length,
        errors,
        warnings,
        secrets: filteredSecrets,
        secretsByType: this.countByType(filteredSecrets),
        rulesApplied: applicableRules.length,
        filesWithSecrets: filteredSecrets.length > 0 ? 1 : 0,
      };
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'secret-detection',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Secret detection failed: ${error}`],
        warnings,
        secrets: [],
        secretsByType: {} as Record<DetectedSecretType, number>,
        rulesApplied: 0,
        filesWithSecrets: 0,
      };
    }
  }

  async detectInFile(
    filePath: string,
    options: SecretDetectionOptions = {}
  ): Promise<SecretDetectionResult> {
    this.ensureNotDisposed();
    const startTime = new Date();

    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const result = await this.detectInCode(code, options);

      // Update file path in secrets
      for (const secret of result.secrets) {
        secret.location.file = filePath;
      }

      // Update issues
      for (const issue of result.issues) {
        if (issue.location) {
          issue.location.file = filePath;
        }
      }

      return result;
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'secret-detection',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Failed to detect secrets in file ${filePath}: ${error}`],
        warnings: [],
        secrets: [],
        secretsByType: {} as Record<DetectedSecretType, number>,
        rulesApplied: 0,
        filesWithSecrets: 0,
      };
    }
  }

  async detectInDirectory(
    dirPath: string,
    options: SecretDetectionOptions = {}
  ): Promise<SecretDetectionResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const allSecrets: DetectedSecret[] = [];
    const allIssues: ScanIssue[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let filesScanned = 0;
    let linesScanned = 0;
    const filesWithSecrets = new Set<string>();

    try {
      // Build include patterns
      const includePatterns = options.includePatterns ?? ['**/*'];
      const excludePatterns = options.excludePatterns ?? SECRET_EXCLUDE_PATTERNS;

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

      // Filter binary files
      const textFiles = uniqueFiles.filter((f) => this.isTextFile(f));

      // Detect in each file
      for (const file of textFiles) {
        try {
          const result = await this.detectInFile(file, options);

          allSecrets.push(...result.secrets);
          allIssues.push(...result.issues);
          filesScanned++;
          linesScanned += result.linesScanned;
          errors.push(...result.errors);
          warnings.push(...result.warnings);

          if (result.secrets.length > 0) {
            filesWithSecrets.add(file);
          }
        } catch (error) {
          errors.push(`Error scanning ${file}: ${error}`);
        }
      }

      const endTime = new Date();
      const applicableRules = this.getApplicableRules(options);

      return {
        type: 'secret-detection',
        success: errors.length === 0,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: allIssues,
        filesScanned,
        linesScanned,
        errors,
        warnings,
        secrets: allSecrets,
        secretsByType: this.countByType(allSecrets),
        rulesApplied: applicableRules.length,
        filesWithSecrets: filesWithSecrets.size,
      };
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'secret-detection',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Failed to scan directory ${dirPath}: ${error}`],
        warnings,
        secrets: [],
        secretsByType: {} as Record<DetectedSecretType, number>,
        rulesApplied: 0,
        filesWithSecrets: 0,
      };
    }
  }

  async detectInHistory(
    repoPath: string,
    options: SecretDetectionOptions = {}
  ): Promise<SecretDetectionResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const warnings: string[] = [];

    // Git history scanning would require git integration
    // For now, just scan current state
    warnings.push('Git history scanning not yet implemented, scanning current state only');

    try {
      const result = await this.detectInDirectory(repoPath, options);

      return {
        ...result,
        warnings: [...warnings, ...result.warnings],
        historyScanned: {
          commits: 0,
          secretsInHistory: 0,
        },
      };
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'secret-detection',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Failed to scan repository ${repoPath}: ${error}`],
        warnings,
        secrets: [],
        secretsByType: {} as Record<DetectedSecretType, number>,
        rulesApplied: 0,
        filesWithSecrets: 0,
        historyScanned: {
          commits: 0,
          secretsInHistory: 0,
        },
      };
    }
  }

  getRules(): SecretDetectionRule[] {
    this.ensureNotDisposed();
    return Array.from(this.rules.values());
  }

  addRule(rule: SecretDetectionRule): void {
    this.ensureNotDisposed();
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): boolean {
    this.ensureNotDisposed();
    return this.rules.delete(ruleId);
  }

  calculateEntropy(str: string): number {
    if (!str || str.length === 0) return 0;

    const frequencies = new Map<string, number>();

    for (const char of str) {
      frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
    }

    let entropy = 0;
    const len = str.length;

    for (const count of frequencies.values()) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  maskSecret(value: string, showChars: number = 4): string {
    if (value.length <= showChars * 2) {
      return '*'.repeat(value.length);
    }

    const start = value.substring(0, showChars);
    const end = value.substring(value.length - showChars);
    const middle = '*'.repeat(Math.min(value.length - showChars * 2, 10));

    return `${start}${middle}${end}`;
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
      throw new Error('SecretDetector has been disposed');
    }
  }

  private getApplicableRules(options: SecretDetectionOptions): SecretDetectionRule[] {
    let rules = Array.from(this.rules.values()).filter((r) => r.enabled);

    // Add custom rules
    if (options.customRules) {
      rules = [...rules, ...options.customRules];
    }

    // Filter by secret types
    if (options.secretTypes?.length) {
      rules = rules.filter((r) => options.secretTypes!.includes(r.secretType));
    }

    // Filter by include/exclude
    if (options.includeRules?.length) {
      rules = rules.filter((r) => options.includeRules!.includes(r.id));
    }

    if (options.excludeRules?.length) {
      rules = rules.filter((r) => !options.excludeRules!.includes(r.id));
    }

    return rules;
  }

  private applyRule(
    rule: SecretDetectionRule,
    code: string,
    file: string,
    options: SecretDetectionOptions
  ): DetectedSecret[] {
    const secrets: DetectedSecret[] = [];
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    const lines = code.split('\n');
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      const matchedValue = match[1] ?? match[0];
      const location = this.getLocationFromOffset(code, match.index, lines);

      // Calculate entropy
      const entropy = this.calculateEntropy(matchedValue);

      // Check entropy threshold
      if (rule.entropyThreshold && entropy < rule.entropyThreshold) {
        continue;
      }

      // Check for false positives
      let confidence = 0.8;
      let isFalsePositive = false;

      if (rule.checkFalsePositives && rule.falsePositivePatterns) {
        for (const fpPattern of rule.falsePositivePatterns) {
          if (fpPattern.test(matchedValue)) {
            isFalsePositive = true;
            confidence = 0.3;
            break;
          }
        }
      }

      // Skip if likely false positive and not including them
      if (isFalsePositive && !options.includeFalsePositives) {
        continue;
      }

      // Validate if requested
      const verified = options.verifySecrets ? this.verifySecret(matchedValue, rule) : false;

      // Adjust confidence based on entropy and verification
      if (entropy > 4.5) confidence = Math.min(confidence + 0.1, 1.0);
      if (verified) confidence = Math.min(confidence + 0.15, 1.0);

      secrets.push({
        type: rule.secretType,
        ruleId: rule.id,
        location: {
          file,
          line: location.line,
          column: location.column,
          snippet: this.getSnippetWithMasking(lines, location.line, matchedValue),
        },
        maskedValue: this.maskSecret(matchedValue),
        rawValue: options.redactSecrets === false ? matchedValue : undefined,
        entropy,
        confidence,
        verified,
        inVersionControl: false, // Would require git integration
        remediation: this.getRemediation(rule.secretType),
      });
    }

    return secrets;
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

  private getSnippetWithMasking(lines: string[], lineNum: number, secret: string): string {
    const index = lineNum - 1;
    if (index >= 0 && index < lines.length) {
      const line = lines[index];
      // Mask the secret in the snippet
      return line.replace(secret, this.maskSecret(secret));
    }
    return '';
  }

  private verifySecret(value: string, rule: SecretDetectionRule): boolean {
    // Validate function provided
    if (rule.validate) {
      return rule.validate(value);
    }

    // Basic validation based on type
    switch (rule.secretType) {
      case 'aws_key':
        return /^A[A-Z]{3}[A-Z0-9]{16}$/.test(value);
      case 'github_token':
        return /^gh[pso]_[A-Za-z0-9]{36}$/.test(value) || /^github_pat_/.test(value);
      case 'jwt':
        // Validate JWT structure
        const parts = value.split('.');
        if (parts.length !== 3) return false;
        try {
          // Try to decode header
          const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
          return 'alg' in header;
        } catch {
          return false;
        }
      default:
        // Generic validation - check length and character set
        return value.length >= 16 && this.calculateEntropy(value) > 3.0;
    }
  }

  private getRemediation(type: DetectedSecretType): string {
    const remediations: Record<DetectedSecretType, string> = {
      api_key: 'Rotate the API key immediately and use environment variables',
      aws_key: 'Rotate AWS credentials and use IAM roles or AWS Secrets Manager',
      aws_secret: 'Rotate AWS credentials and use IAM roles or AWS Secrets Manager',
      azure_key: 'Rotate Azure credentials and use Azure Key Vault',
      gcp_key: 'Rotate GCP credentials and use Secret Manager',
      github_token: 'Revoke the GitHub token and create a new one with minimal scopes',
      gitlab_token: 'Revoke the GitLab token and create a new one',
      npm_token: 'Revoke the npm token and create a new one',
      pypi_token: 'Revoke the PyPI token and create a new one',
      slack_token: 'Revoke the Slack token and generate a new one',
      slack_webhook: 'Regenerate the Slack webhook URL',
      stripe_key: 'Roll the Stripe API key in the dashboard',
      twilio_key: 'Rotate Twilio credentials in the console',
      sendgrid_key: 'Revoke the SendGrid API key and create a new one',
      database_url: 'Change database password and update connection strings',
      connection_string: 'Rotate credentials in the connection string',
      private_key: 'Generate new key pair and revoke the compromised one',
      ssh_key: 'Remove public key from authorized_keys and generate new pair',
      password: 'Change the password immediately',
      jwt: 'Invalidate the JWT and rotate signing keys if necessary',
      oauth_token: 'Revoke the OAuth token and re-authenticate',
      bearer_token: 'Invalidate the bearer token and generate new one',
      basic_auth: 'Change credentials used in basic auth',
      generic_secret: 'Rotate the secret and use a secret manager',
      unknown: 'Investigate and rotate the credential if confirmed',
    };

    return remediations[type] ?? 'Review and rotate the credential if confirmed';
  }

  private countByType(secrets: DetectedSecret[]): Record<DetectedSecretType, number> {
    const counts: Record<DetectedSecretType, number> = {} as Record<DetectedSecretType, number>;

    for (const secret of secrets) {
      counts[secret.type] = (counts[secret.type] ?? 0) + 1;
    }

    return counts;
  }

  private buildIssuesFromSecrets(secrets: DetectedSecret[]): ScanIssue[] {
    return secrets.map((secret) => ({
      id: `${secret.ruleId}-${secret.location.line}-${secret.location.column}`,
      ruleId: secret.ruleId,
      severity: this.getSeverityForType(secret.type),
      category: 'secrets' as const,
      title: `Detected ${secret.type.replace(/_/g, ' ')}`,
      message: `Potential ${secret.type.replace(/_/g, ' ')} detected. ${secret.remediation}`,
      location: secret.location,
      suggestion: secret.remediation,
      confidence: secret.confidence,
      metadata: {
        secretType: secret.type,
        entropy: secret.entropy,
        verified: secret.verified,
        maskedValue: secret.maskedValue,
      },
    }));
  }

  private getSeverityForType(type: DetectedSecretType): SecurityIssueSeverity {
    const criticalTypes: DetectedSecretType[] = [
      'aws_key',
      'aws_secret',
      'azure_key',
      'gcp_key',
      'private_key',
      'ssh_key',
      'database_url',
      'connection_string',
      'stripe_key',
      'github_token',
    ];

    const highTypes: DetectedSecretType[] = [
      'slack_token',
      'npm_token',
      'pypi_token',
      'gitlab_token',
      'sendgrid_key',
      'twilio_key',
      'jwt',
      'oauth_token',
      'bearer_token',
      'basic_auth',
      'api_key',
      'generic_secret',
    ];

    if (criticalTypes.includes(type)) return SecurityIssueSeverity.CRITICAL;
    if (highTypes.includes(type)) return SecurityIssueSeverity.HIGH;
    return SecurityIssueSeverity.MEDIUM;
  }

  private isTextFile(filePath: string): boolean {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.woff', '.woff2', '.ttf', '.eot',
      '.mp3', '.mp4', '.avi', '.mov', '.wmv',
      '.sqlite', '.db',
    ];

    const ext = path.extname(filePath).toLowerCase();
    return !binaryExtensions.includes(ext);
  }
}

/**
 * Create secret detector instance
 */
export function createSecretDetector(rules?: SecretDetectionRule[]): ISecretDetector {
  return new SecretDetector(rules);
}
