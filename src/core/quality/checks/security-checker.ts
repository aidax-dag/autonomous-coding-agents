/**
 * Security Checker
 *
 * Analyzes security by running npm audit, detecting secrets and credentials,
 * and checking for common security vulnerabilities.
 *
 * @module core/quality/checks/security-checker
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { QualityCheckResult, QualityDimension } from '../completion-detector.js';
import { createLogger, ILogger } from '../../services/logger.js';

const execAsync = promisify(exec);

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Vulnerability severity levels
 */
export enum VulnerabilitySeverity {
  INFO = 'info',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * NPM audit vulnerability
 */
export interface AuditVulnerability {
  name: string;
  severity: VulnerabilitySeverity;
  via: string[];
  effects: string[];
  range: string;
  fixAvailable: boolean;
}

/**
 * NPM audit result
 */
export interface AuditResult {
  vulnerabilities: Map<string, AuditVulnerability>;
  metadata: {
    totalDependencies: number;
    vulnerableCount: number;
    severityCounts: Record<VulnerabilitySeverity, number>;
  };
}

/**
 * Secret finding
 */
export interface SecretFinding {
  file: string;
  line: number;
  type: string;
  pattern: string;
  severity: VulnerabilitySeverity;
}

/**
 * Security issue
 */
export interface SecurityIssue {
  category: 'dependency' | 'secret' | 'code' | 'config';
  severity: VulnerabilitySeverity;
  title: string;
  description: string;
  location?: string;
  recommendation: string;
}

/**
 * Security summary
 */
export interface SecuritySummary {
  auditResult: AuditResult | null;
  secretFindings: SecretFinding[];
  securityIssues: SecurityIssue[];
  criticalCount: number;
  highCount: number;
  moderateCount: number;
  lowCount: number;
  hasPackageLock: boolean;
  hasYarnLock: boolean;
  hasNpmrc: boolean;
  hasEnvExample: boolean;
}

/**
 * Security checker configuration
 */
export interface SecurityConfig {
  runAudit?: boolean;
  checkSecrets?: boolean;
  checkConfigs?: boolean;
  allowedSeverity?: VulnerabilitySeverity[];
  maxCriticalVulns?: number;
  maxHighVulns?: number;
  ignorePatterns?: string[];
  secretPatterns?: Array<{ name: string; pattern: RegExp }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', pattern: /(?:aws)?(?:_|-)?(?:secret)?(?:_|-)?(?:access)?(?:_|-)?(?:key)?[\s]*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi },
  { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
  { name: 'GitHub Personal Access Token', pattern: /github_pat_[A-Za-z0-9_]{22,}/g },
  { name: 'GitLab Token', pattern: /glpat-[A-Za-z0-9_-]{20,}/g },
  { name: 'Slack Token', pattern: /xox[baprs]-([0-9a-zA-Z]{10,48})/g },
  { name: 'Slack Webhook', pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g },
  { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'API Key Generic', pattern: /(?:api[_-]?key|apikey|api[_-]?secret)[\s]*[=:]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/gi },
  { name: 'Password in URL', pattern: /:\/\/[^:\s]+:([^@\s]+)@/g },
  { name: 'Bearer Token', pattern: /[Bb]earer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g },
  { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'Stripe Publishable Key', pattern: /pk_live_[0-9a-zA-Z]{24}/g },
  { name: 'Heroku API Key', pattern: /[hH]eroku.*[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/g },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z\-_]{35}/g },
  { name: 'npm Token', pattern: /npm_[A-Za-z0-9]{36}/g },
  { name: 'Database URL', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^:\s]+:([^@\s]+)@/gi },
];

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  runAudit: true,
  checkSecrets: true,
  checkConfigs: true,
  allowedSeverity: [VulnerabilitySeverity.INFO, VulnerabilitySeverity.LOW],
  maxCriticalVulns: 0,
  maxHighVulns: 0,
  ignorePatterns: ['node_modules', 'dist', 'build', '.git', '*.min.js', '*.bundle.js'],
  secretPatterns: DEFAULT_SECRET_PATTERNS,
};

// ============================================================================
// Security Checker Implementation
// ============================================================================

/**
 * Security checker for analyzing security vulnerabilities
 */
export class SecurityChecker {
  private config: SecurityConfig;
  private readonly logger: ILogger = createLogger('SecurityChecker');

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
  }

  /**
   * Check security for a workspace
   */
  async check(workspacePath: string): Promise<QualityCheckResult> {
    try {
      const summary = await this.getSecuritySummary(workspacePath);
      return this.evaluateSecurity(summary);
    } catch (error) {
      return this.createErrorResult(error);
    }
  }

  /**
   * Get comprehensive security summary
   */
  async getSecuritySummary(workspacePath: string): Promise<SecuritySummary> {
    // Check for lock files and configs
    const hasPackageLock = await this.fileExists(path.join(workspacePath, 'package-lock.json'));
    const hasYarnLock = await this.fileExists(path.join(workspacePath, 'yarn.lock'));
    const hasNpmrc = await this.fileExists(path.join(workspacePath, '.npmrc'));
    const hasEnvExample = await this.fileExists(path.join(workspacePath, '.env.example')) ||
      await this.fileExists(path.join(workspacePath, '.env.sample'));

    // Run npm audit
    let auditResult: AuditResult | null = null;
    if (this.config.runAudit) {
      auditResult = await this.runNpmAudit(workspacePath);
    }

    // Check for secrets
    let secretFindings: SecretFinding[] = [];
    if (this.config.checkSecrets) {
      secretFindings = await this.scanForSecrets(workspacePath);
    }

    // Collect all security issues
    const securityIssues: SecurityIssue[] = [];

    // Add vulnerability issues
    if (auditResult) {
      for (const [name, vuln] of auditResult.vulnerabilities) {
        securityIssues.push({
          category: 'dependency',
          severity: vuln.severity,
          title: `Vulnerable dependency: ${name}`,
          description: `Package ${name} has a ${vuln.severity} severity vulnerability`,
          location: `package.json → ${name}`,
          recommendation: vuln.fixAvailable ? 'Run npm audit fix' : 'Update or replace the package',
        });
      }
    }

    // Add secret issues
    for (const finding of secretFindings) {
      securityIssues.push({
        category: 'secret',
        severity: finding.severity,
        title: `Exposed ${finding.type}`,
        description: `Potential secret or credential found in source code`,
        location: `${finding.file}:${finding.line}`,
        recommendation: 'Remove the secret and rotate credentials immediately',
      });
    }

    // Add config issues
    if (this.config.checkConfigs) {
      const configIssues = await this.checkSecurityConfigs(workspacePath, hasEnvExample);
      securityIssues.push(...configIssues);
    }

    // Count severities
    const criticalCount = securityIssues.filter(i => i.severity === VulnerabilitySeverity.CRITICAL).length;
    const highCount = securityIssues.filter(i => i.severity === VulnerabilitySeverity.HIGH).length;
    const moderateCount = securityIssues.filter(i => i.severity === VulnerabilitySeverity.MODERATE).length;
    const lowCount = securityIssues.filter(i => i.severity === VulnerabilitySeverity.LOW).length;

    return {
      auditResult,
      secretFindings,
      securityIssues,
      criticalCount,
      highCount,
      moderateCount,
      lowCount,
      hasPackageLock,
      hasYarnLock,
      hasNpmrc,
      hasEnvExample,
    };
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Run npm audit and parse results
   */
  private async runNpmAudit(workspacePath: string): Promise<AuditResult | null> {
    try {
      // Check if package-lock.json exists
      if (!await this.fileExists(path.join(workspacePath, 'package-lock.json'))) {
        return null;
      }

      const { stdout } = await execAsync('npm audit --json 2>/dev/null || true', {
        cwd: workspacePath,
        maxBuffer: 10 * 1024 * 1024,
      });

      if (!stdout.trim()) return null;

      return this.parseAuditOutput(stdout);
    } catch (error) {
      this.logger.warn('npm audit failed', { error });
      return null;
    }
  }

  /**
   * Parse npm audit JSON output
   */
  private parseAuditOutput(output: string): AuditResult | null {
    try {
      const data = JSON.parse(output);
      const vulnerabilities = new Map<string, AuditVulnerability>();

      // npm 7+ format
      if (data.vulnerabilities) {
        for (const [name, info] of Object.entries(data.vulnerabilities)) {
          const vulnInfo = info as {
            severity: string;
            via: Array<string | { name: string }>;
            effects: string[];
            range: string;
            fixAvailable: boolean | { name: string };
          };

          vulnerabilities.set(name, {
            name,
            severity: this.parseSeverity(vulnInfo.severity),
            via: vulnInfo.via.map(v => typeof v === 'string' ? v : v.name),
            effects: vulnInfo.effects || [],
            range: vulnInfo.range || '*',
            fixAvailable: !!vulnInfo.fixAvailable,
          });
        }
      }

      const metadata = data.metadata || {};
      const severityCounts: Record<VulnerabilitySeverity, number> = {
        [VulnerabilitySeverity.INFO]: metadata.vulnerabilities?.info || 0,
        [VulnerabilitySeverity.LOW]: metadata.vulnerabilities?.low || 0,
        [VulnerabilitySeverity.MODERATE]: metadata.vulnerabilities?.moderate || 0,
        [VulnerabilitySeverity.HIGH]: metadata.vulnerabilities?.high || 0,
        [VulnerabilitySeverity.CRITICAL]: metadata.vulnerabilities?.critical || 0,
      };

      return {
        vulnerabilities,
        metadata: {
          totalDependencies: metadata.dependencies?.total || 0,
          vulnerableCount: vulnerabilities.size,
          severityCounts,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse severity string to enum
   */
  private parseSeverity(severity: string): VulnerabilitySeverity {
    const normalizedSeverity = severity.toLowerCase();
    if (normalizedSeverity === 'critical') return VulnerabilitySeverity.CRITICAL;
    if (normalizedSeverity === 'high') return VulnerabilitySeverity.HIGH;
    if (normalizedSeverity === 'moderate') return VulnerabilitySeverity.MODERATE;
    if (normalizedSeverity === 'low') return VulnerabilitySeverity.LOW;
    return VulnerabilitySeverity.INFO;
  }

  /**
   * Scan files for secrets
   */
  private async scanForSecrets(workspacePath: string): Promise<SecretFinding[]> {
    const findings: SecretFinding[] = [];
    const sourceFiles = await this.findSourceFiles(workspacePath);

    for (const filePath of sourceFiles) {
      const fileFindings = await this.scanFile(filePath);
      findings.push(...fileFindings);
    }

    return findings;
  }

  /**
   * Find source files to scan
   */
  private async findSourceFiles(workspacePath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.env', '.conf', '.config'];
    const ignorePatterns = this.config.ignorePatterns || [];

    async function walkDir(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(workspacePath, fullPath);

          // Check ignore patterns
          if (ignorePatterns.some(p =>
            relativePath.includes(p) ||
            entry.name.includes(p) ||
            (p.startsWith('*.') && entry.name.endsWith(p.substring(1)))
          )) {
            continue;
          }

          if (entry.isDirectory()) {
            await walkDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            // Include files with matching extensions or common config files
            if (extensions.includes(ext) ||
              entry.name.startsWith('.env') ||
              entry.name.endsWith('.env')) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // Ignore permission errors
      }
    }

    await walkDir(workspacePath);
    return files;
  }

  /**
   * Scan a single file for secrets
   */
  private async scanFile(filePath: string): Promise<SecretFinding[]> {
    const findings: SecretFinding[] = [];

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const patterns = this.config.secretPatterns || DEFAULT_SECRET_PATTERNS;

      for (const { name, pattern } of patterns) {
        // Reset regex state
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(content)) !== null) {
          // Find line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;

          // Skip if it looks like a placeholder or example
          const line = lines[lineNumber - 1] || '';
          if (this.isPlaceholder(line, match[0])) {
            continue;
          }

          findings.push({
            file: filePath,
            line: lineNumber,
            type: name,
            pattern: match[0].substring(0, 20) + '...',
            severity: this.getSecretSeverity(name),
          });
        }
      }
    } catch {
      // Ignore file read errors
    }

    return findings;
  }

  /**
   * Check if a match is a placeholder or example
   */
  private isPlaceholder(line: string, match: string): boolean {
    const lowerLine = line.toLowerCase();
    const lowerMatch = match.toLowerCase();

    // Check for common placeholder patterns
    const placeholderPatterns = [
      /your[_-]?api[_-]?key/i,
      /insert[_-]?here/i,
      /replace[_-]?this/i,
      /xxx+/i,
      /\*{3,}/,
      /example/i,
      /sample/i,
      /dummy/i,
      /test/i,
      /fake/i,
      /placeholder/i,
    ];

    return placeholderPatterns.some(p => p.test(lowerLine) || p.test(lowerMatch));
  }

  /**
   * Get severity for secret type
   */
  private getSecretSeverity(type: string): VulnerabilitySeverity {
    const criticalTypes = ['Private Key', 'AWS Secret Key', 'Database URL'];
    const highTypes = ['AWS Access Key', 'GitHub Token', 'Stripe Key', 'JWT Token'];

    if (criticalTypes.some(t => type.includes(t))) return VulnerabilitySeverity.CRITICAL;
    if (highTypes.some(t => type.includes(t))) return VulnerabilitySeverity.HIGH;
    return VulnerabilitySeverity.MODERATE;
  }

  /**
   * Check security configurations
   */
  private async checkSecurityConfigs(
    workspacePath: string,
    hasEnvExample: boolean
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check for .env file committed
    const envPath = path.join(workspacePath, '.env');
    const gitIgnorePath = path.join(workspacePath, '.gitignore');

    if (await this.fileExists(envPath)) {
      let isGitIgnored = false;

      try {
        const gitIgnore = await fs.readFile(gitIgnorePath, 'utf-8');
        isGitIgnored = gitIgnore.includes('.env');
      } catch {
        // No .gitignore
      }

      if (!isGitIgnored) {
        issues.push({
          category: 'config',
          severity: VulnerabilitySeverity.HIGH,
          title: '.env file may not be git-ignored',
          description: 'The .env file exists but may not be properly excluded from version control',
          location: '.env',
          recommendation: 'Add .env to .gitignore',
        });
      }
    }

    // Check for .env.example
    if (!hasEnvExample && await this.fileExists(envPath)) {
      issues.push({
        category: 'config',
        severity: VulnerabilitySeverity.LOW,
        title: 'Missing .env.example',
        description: 'Project has .env but no .env.example for documentation',
        recommendation: 'Create .env.example with placeholder values for documentation',
      });
    }

    // Check package.json for outdated engines
    try {
      const pkgPath = path.join(workspacePath, 'package.json');
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));

      if (pkg.engines?.node) {
        const nodeVersion = pkg.engines.node.match(/(\d+)/);
        if (nodeVersion && parseInt(nodeVersion[1], 10) < 18) {
          issues.push({
            category: 'config',
            severity: VulnerabilitySeverity.MODERATE,
            title: 'Outdated Node.js version requirement',
            description: `Project requires Node.js ${pkg.engines.node}, consider updating to 18+`,
            location: 'package.json → engines.node',
            recommendation: 'Update to a supported Node.js version (18+)',
          });
        }
      }
    } catch {
      // No package.json or parse error
    }

    return issues;
  }

  /**
   * Evaluate security against thresholds
   */
  private evaluateSecurity(summary: SecuritySummary): QualityCheckResult {
    let score = 100;
    const recommendations: string[] = [];

    // Critical vulnerabilities are severe
    if (summary.criticalCount > this.config.maxCriticalVulns!) {
      score -= 40;
      recommendations.push(`Fix ${summary.criticalCount} critical security issues immediately`);
    }

    // High vulnerabilities
    if (summary.highCount > this.config.maxHighVulns!) {
      score -= 30;
      recommendations.push(`Address ${summary.highCount} high severity issues`);
    }

    // Moderate vulnerabilities
    if (summary.moderateCount > 5) {
      score -= Math.min(15, summary.moderateCount * 2);
      recommendations.push(`Review ${summary.moderateCount} moderate severity issues`);
    }

    // Low vulnerabilities (minor penalty)
    if (summary.lowCount > 10) {
      score -= Math.min(10, summary.lowCount);
    }

    // Secret findings are serious
    if (summary.secretFindings.length > 0) {
      score -= Math.min(30, summary.secretFindings.length * 10);
      recommendations.push(
        `Remove ${summary.secretFindings.length} exposed secrets and rotate credentials`
      );
    }

    // Lock file check
    if (!summary.hasPackageLock && !summary.hasYarnLock) {
      score -= 5;
      recommendations.push('Add package-lock.json or yarn.lock for reproducible builds');
    }

    score = Math.max(0, Math.round(score));
    const passed = summary.criticalCount === 0 &&
      summary.highCount === 0 &&
      summary.secretFindings.length === 0;

    const totalIssues = summary.securityIssues.length;
    const details = totalIssues === 0
      ? 'No security issues found'
      : `Found ${totalIssues} security issues: ${summary.criticalCount} critical, ${summary.highCount} high, ${summary.moderateCount} moderate, ${summary.lowCount} low`;

    return {
      dimension: QualityDimension.SECURITY,
      passed,
      score,
      threshold: 90,
      details,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
    };
  }

  /**
   * Create result for errors
   */
  private createErrorResult(error: unknown): QualityCheckResult {
    const message = error instanceof Error ? error.message : String(error);
    return {
      dimension: QualityDimension.SECURITY,
      passed: false,
      score: 0,
      threshold: 90,
      details: `Error checking security: ${message}`,
      recommendations: ['Verify npm is installed', 'Check project dependencies'],
    };
  }

  /**
   * Get all vulnerabilities
   */
  async getVulnerabilities(workspacePath: string): Promise<AuditVulnerability[]> {
    const auditResult = await this.runNpmAudit(workspacePath);
    if (!auditResult) return [];
    return Array.from(auditResult.vulnerabilities.values());
  }

  /**
   * Get secret findings
   */
  async getSecretFindings(workspacePath: string): Promise<SecretFinding[]> {
    return this.scanForSecrets(workspacePath);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a security checker instance
 */
export function createSecurityChecker(
  config: Partial<SecurityConfig> = {}
): SecurityChecker {
  return new SecurityChecker(config);
}
