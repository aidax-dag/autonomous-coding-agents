/**
 * Unified Code Scanner
 *
 * Feature: F5.6 - Code Scanning 심화
 * Combines static analysis, dependency scanning, and secret detection
 *
 * @module core/security/scanning
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SecurityIssueSeverity } from '../plugin/plugin-security.interface.js';
import type {
  ICodeScanner,
  IStaticAnalyzer,
  IDependencyScanner,
  ISecretDetector,
  CodeScannerOptions,
  CodeScannerResult,
  ScanTargetType,
  StaticAnalysisResult,
  DependencyScanResult,
  SecretDetectionResult,
} from './scanning.interface.js';
import { SEVERITY_WEIGHTS } from './scanning.interface.js';
import { createStaticAnalyzer } from './static-analyzer.js';
import { createDependencyScanner } from './dependency-scanner.js';
import { createSecretDetector } from './secret-detector.js';

/**
 * Unified Code Scanner implementation
 */
export class CodeScanner implements ICodeScanner {
  private staticAnalyzer: IStaticAnalyzer;
  private dependencyScanner: IDependencyScanner;
  private secretDetector: ISecretDetector;
  private disposed = false;

  constructor(
    staticAnalyzer?: IStaticAnalyzer,
    dependencyScanner?: IDependencyScanner,
    secretDetector?: ISecretDetector
  ) {
    this.staticAnalyzer = staticAnalyzer ?? createStaticAnalyzer();
    this.dependencyScanner = dependencyScanner ?? createDependencyScanner();
    this.secretDetector = secretDetector ?? createSecretDetector();
  }

  async scanCode(
    code: string,
    options: CodeScannerOptions = {}
  ): Promise<CodeScannerResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const errors: string[] = [];

    const scanTypes = options.scanTypes ?? ['static-analysis', 'secret-detection'];
    let staticAnalysisResult: StaticAnalysisResult | undefined;
    let secretDetectionResult: SecretDetectionResult | undefined;

    // Run scans based on types requested
    const scanPromises: Promise<void>[] = [];

    if (scanTypes.includes('static-analysis') || scanTypes.includes('all')) {
      scanPromises.push(
        this.staticAnalyzer
          .analyzeCode(code, options.staticAnalysis)
          .then((result) => {
            staticAnalysisResult = result;
          })
          .catch((error) => {
            errors.push(`Static analysis failed: ${error}`);
          })
      );
    }

    if (scanTypes.includes('secret-detection') || scanTypes.includes('all')) {
      scanPromises.push(
        this.secretDetector
          .detectInCode(code, options.secretDetection)
          .then((result) => {
            secretDetectionResult = result;
          })
          .catch((error) => {
            errors.push(`Secret detection failed: ${error}`);
          })
      );
    }

    // Wait for all scans
    if (options.parallel !== false) {
      await Promise.all(scanPromises);
    } else {
      for (const promise of scanPromises) {
        await promise;
      }
    }

    const endTime = new Date();

    return this.buildResult({
      target: 'code',
      targetType: 'code',
      startTime,
      endTime,
      staticAnalysis: staticAnalysisResult,
      secretDetection: secretDetectionResult,
      errors,
      options,
    });
  }

  async scanFile(
    filePath: string,
    options: CodeScannerOptions = {}
  ): Promise<CodeScannerResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const errors: string[] = [];

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return this.buildErrorResult(filePath, 'file', startTime, [`File not found: ${filePath}`]);
    }

    const scanTypes = options.scanTypes ?? ['static-analysis', 'secret-detection'];
    let staticAnalysisResult: StaticAnalysisResult | undefined;
    let secretDetectionResult: SecretDetectionResult | undefined;

    // Run scans
    const scanPromises: Promise<void>[] = [];

    if (scanTypes.includes('static-analysis') || scanTypes.includes('all')) {
      scanPromises.push(
        this.staticAnalyzer
          .analyzeFile(filePath, options.staticAnalysis)
          .then((result) => {
            staticAnalysisResult = result;
          })
          .catch((error) => {
            errors.push(`Static analysis failed: ${error}`);
          })
      );
    }

    if (scanTypes.includes('secret-detection') || scanTypes.includes('all')) {
      scanPromises.push(
        this.secretDetector
          .detectInFile(filePath, options.secretDetection)
          .then((result) => {
            secretDetectionResult = result;
          })
          .catch((error) => {
            errors.push(`Secret detection failed: ${error}`);
          })
      );
    }

    // Wait for scans
    if (options.parallel !== false) {
      await Promise.all(scanPromises);
    } else {
      for (const promise of scanPromises) {
        await promise;
      }
    }

    const endTime = new Date();

    return this.buildResult({
      target: filePath,
      targetType: 'file',
      startTime,
      endTime,
      staticAnalysis: staticAnalysisResult,
      secretDetection: secretDetectionResult,
      errors,
      options,
    });
  }

  async scanDirectory(
    dirPath: string,
    options: CodeScannerOptions = {}
  ): Promise<CodeScannerResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const errors: string[] = [];

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      return this.buildErrorResult(dirPath, 'directory', startTime, [`Directory not found: ${dirPath}`]);
    }

    const scanTypes = options.scanTypes ?? ['static-analysis', 'dependency-scan', 'secret-detection'];
    let staticAnalysisResult: StaticAnalysisResult | undefined;
    let dependencyScanResult: DependencyScanResult | undefined;
    let secretDetectionResult: SecretDetectionResult | undefined;

    // Run scans
    const scanPromises: Promise<void>[] = [];

    if (scanTypes.includes('static-analysis') || scanTypes.includes('all')) {
      scanPromises.push(
        this.staticAnalyzer
          .analyzeDirectory(dirPath, options.staticAnalysis)
          .then((result) => {
            staticAnalysisResult = result;
          })
          .catch((error) => {
            errors.push(`Static analysis failed: ${error}`);
          })
      );
    }

    if (scanTypes.includes('dependency-scan') || scanTypes.includes('all')) {
      scanPromises.push(
        this.dependencyScanner
          .scan(dirPath, options.dependencyScan)
          .then((result) => {
            dependencyScanResult = result;
          })
          .catch((error) => {
            errors.push(`Dependency scan failed: ${error}`);
          })
      );
    }

    if (scanTypes.includes('secret-detection') || scanTypes.includes('all')) {
      scanPromises.push(
        this.secretDetector
          .detectInDirectory(dirPath, options.secretDetection)
          .then((result) => {
            secretDetectionResult = result;
          })
          .catch((error) => {
            errors.push(`Secret detection failed: ${error}`);
          })
      );
    }

    // Wait for scans
    if (options.parallel !== false) {
      await Promise.all(scanPromises);
    } else {
      for (const promise of scanPromises) {
        await promise;
      }
    }

    const endTime = new Date();

    return this.buildResult({
      target: dirPath,
      targetType: 'directory',
      startTime,
      endTime,
      staticAnalysis: staticAnalysisResult,
      dependencyScan: dependencyScanResult,
      secretDetection: secretDetectionResult,
      errors,
      options,
    });
  }

  async scanRepository(
    repoPath: string,
    options: CodeScannerOptions = {}
  ): Promise<CodeScannerResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const errors: string[] = [];

    // Check if path exists
    if (!fs.existsSync(repoPath)) {
      return this.buildErrorResult(repoPath, 'repository', startTime, [`Repository not found: ${repoPath}`]);
    }

    // Check if it's a git repository
    const gitDir = path.join(repoPath, '.git');
    if (!fs.existsSync(gitDir)) {
      errors.push('Not a git repository, some features may be limited');
    }

    const scanTypes = options.scanTypes ?? ['all'];
    let staticAnalysisResult: StaticAnalysisResult | undefined;
    let dependencyScanResult: DependencyScanResult | undefined;
    let secretDetectionResult: SecretDetectionResult | undefined;

    // Run scans
    const scanPromises: Promise<void>[] = [];

    if (scanTypes.includes('static-analysis') || scanTypes.includes('all')) {
      scanPromises.push(
        this.staticAnalyzer
          .analyzeDirectory(repoPath, options.staticAnalysis)
          .then((result) => {
            staticAnalysisResult = result;
          })
          .catch((error) => {
            errors.push(`Static analysis failed: ${error}`);
          })
      );
    }

    if (scanTypes.includes('dependency-scan') || scanTypes.includes('all')) {
      scanPromises.push(
        this.dependencyScanner
          .scan(repoPath, options.dependencyScan)
          .then((result) => {
            dependencyScanResult = result;
          })
          .catch((error) => {
            errors.push(`Dependency scan failed: ${error}`);
          })
      );
    }

    if (scanTypes.includes('secret-detection') || scanTypes.includes('all')) {
      // For repositories, also check history if git available
      const detectOptions = {
        ...options.secretDetection,
        checkHistory: fs.existsSync(gitDir),
      };

      scanPromises.push(
        this.secretDetector
          .detectInHistory(repoPath, detectOptions)
          .then((result) => {
            secretDetectionResult = result;
          })
          .catch((error) => {
            errors.push(`Secret detection failed: ${error}`);
          })
      );
    }

    // Wait for scans
    if (options.parallel !== false) {
      await Promise.all(scanPromises);
    } else {
      for (const promise of scanPromises) {
        await promise;
      }
    }

    const endTime = new Date();

    return this.buildResult({
      target: repoPath,
      targetType: 'repository',
      startTime,
      endTime,
      staticAnalysis: staticAnalysisResult,
      dependencyScan: dependencyScanResult,
      secretDetection: secretDetectionResult,
      errors,
      options,
    });
  }

  getStaticAnalyzer(): IStaticAnalyzer {
    this.ensureNotDisposed();
    return this.staticAnalyzer;
  }

  getDependencyScanner(): IDependencyScanner {
    this.ensureNotDisposed();
    return this.dependencyScanner;
  }

  getSecretDetector(): ISecretDetector {
    this.ensureNotDisposed();
    return this.secretDetector;
  }

  generateReport(
    result: CodeScannerResult,
    format: CodeScannerOptions['outputFormat'] = 'text'
  ): string {
    this.ensureNotDisposed();

    switch (format) {
      case 'json':
        return this.generateJsonReport(result);
      case 'sarif':
        return this.generateSarifReport(result);
      case 'html':
        return this.generateHtmlReport(result);
      case 'text':
      default:
        return this.generateTextReport(result);
    }
  }

  dispose(): void {
    if (!this.disposed) {
      this.staticAnalyzer.dispose();
      this.dependencyScanner.dispose();
      this.secretDetector.dispose();
      this.disposed = true;
    }
  }

  // ==================== Private Methods ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('CodeScanner has been disposed');
    }
  }

  private buildResult(params: {
    target: string;
    targetType: ScanTargetType;
    startTime: Date;
    endTime: Date;
    staticAnalysis?: StaticAnalysisResult;
    dependencyScan?: DependencyScanResult;
    secretDetection?: SecretDetectionResult;
    errors: string[];
    options: CodeScannerOptions;
  }): CodeScannerResult {
    const {
      target,
      targetType,
      startTime,
      endTime,
      staticAnalysis,
      dependencyScan,
      secretDetection,
      errors,
      options,
    } = params;

    // Calculate summary
    let totalIssues = 0;
    let criticalIssues = 0;
    let highIssues = 0;
    let mediumIssues = 0;
    let lowIssues = 0;
    let infoIssues = 0;
    let filesScanned = 0;
    let linesScanned = 0;
    let dependenciesScanned = 0;
    let secretsFound = 0;

    if (staticAnalysis) {
      totalIssues += staticAnalysis.issues.length;
      criticalIssues += staticAnalysis.issuesBySeverity[SecurityIssueSeverity.CRITICAL] ?? 0;
      highIssues += staticAnalysis.issuesBySeverity[SecurityIssueSeverity.HIGH] ?? 0;
      mediumIssues += staticAnalysis.issuesBySeverity[SecurityIssueSeverity.MEDIUM] ?? 0;
      lowIssues += staticAnalysis.issuesBySeverity[SecurityIssueSeverity.LOW] ?? 0;
      infoIssues += staticAnalysis.issuesBySeverity[SecurityIssueSeverity.INFO] ?? 0;
      filesScanned = Math.max(filesScanned, staticAnalysis.filesScanned);
      linesScanned = Math.max(linesScanned, staticAnalysis.linesScanned);
    }

    if (dependencyScan) {
      totalIssues += dependencyScan.issues.length;
      for (const issue of dependencyScan.issues) {
        switch (issue.severity) {
          case SecurityIssueSeverity.CRITICAL:
            criticalIssues++;
            break;
          case SecurityIssueSeverity.HIGH:
            highIssues++;
            break;
          case SecurityIssueSeverity.MEDIUM:
            mediumIssues++;
            break;
          case SecurityIssueSeverity.LOW:
            lowIssues++;
            break;
          case SecurityIssueSeverity.INFO:
            infoIssues++;
            break;
        }
      }
      dependenciesScanned = dependencyScan.totalDependencies;
    }

    if (secretDetection) {
      totalIssues += secretDetection.issues.length;
      for (const issue of secretDetection.issues) {
        switch (issue.severity) {
          case SecurityIssueSeverity.CRITICAL:
            criticalIssues++;
            break;
          case SecurityIssueSeverity.HIGH:
            highIssues++;
            break;
          case SecurityIssueSeverity.MEDIUM:
            mediumIssues++;
            break;
          case SecurityIssueSeverity.LOW:
            lowIssues++;
            break;
          case SecurityIssueSeverity.INFO:
            infoIssues++;
            break;
        }
      }
      filesScanned = Math.max(filesScanned, secretDetection.filesScanned);
      linesScanned = Math.max(linesScanned, secretDetection.linesScanned);
      secretsFound = secretDetection.secrets.length;
    }

    // Check if should fail based on severity
    let success = errors.length === 0;
    if (options.failOnSeverity) {
      const minWeight = SEVERITY_WEIGHTS[options.failOnSeverity];
      if (
        (criticalIssues > 0 && SEVERITY_WEIGHTS[SecurityIssueSeverity.CRITICAL] >= minWeight) ||
        (highIssues > 0 && SEVERITY_WEIGHTS[SecurityIssueSeverity.HIGH] >= minWeight) ||
        (mediumIssues > 0 && SEVERITY_WEIGHTS[SecurityIssueSeverity.MEDIUM] >= minWeight) ||
        (lowIssues > 0 && SEVERITY_WEIGHTS[SecurityIssueSeverity.LOW] >= minWeight) ||
        (infoIssues > 0 && SEVERITY_WEIGHTS[SecurityIssueSeverity.INFO] >= minWeight)
      ) {
        success = false;
      }
    }

    return {
      success,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      target,
      targetType,
      staticAnalysis,
      dependencyScan,
      secretDetection,
      summary: {
        totalIssues,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
        infoIssues,
        filesScanned,
        linesScanned,
        dependenciesScanned,
        secretsFound,
      },
      errors,
    };
  }

  private buildErrorResult(
    target: string,
    targetType: ScanTargetType,
    startTime: Date,
    errors: string[]
  ): CodeScannerResult {
    const endTime = new Date();
    return {
      success: false,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      target,
      targetType,
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0,
        infoIssues: 0,
        filesScanned: 0,
        linesScanned: 0,
      },
      errors,
    };
  }

  private generateTextReport(result: CodeScannerResult): string {
    const lines: string[] = [];

    lines.push('═'.repeat(60));
    lines.push('CODE SCAN REPORT');
    lines.push('═'.repeat(60));
    lines.push('');
    lines.push(`Target: ${result.target}`);
    lines.push(`Type: ${result.targetType}`);
    lines.push(`Duration: ${result.duration}ms`);
    lines.push(`Status: ${result.success ? '✓ PASSED' : '✗ FAILED'}`);
    lines.push('');

    // Summary
    lines.push('─'.repeat(60));
    lines.push('SUMMARY');
    lines.push('─'.repeat(60));
    lines.push(`Total Issues: ${result.summary.totalIssues}`);
    lines.push(`  Critical: ${result.summary.criticalIssues}`);
    lines.push(`  High: ${result.summary.highIssues}`);
    lines.push(`  Medium: ${result.summary.mediumIssues}`);
    lines.push(`  Low: ${result.summary.lowIssues}`);
    lines.push(`  Info: ${result.summary.infoIssues}`);
    lines.push(`Files Scanned: ${result.summary.filesScanned}`);
    lines.push(`Lines Scanned: ${result.summary.linesScanned}`);

    if (result.summary.dependenciesScanned) {
      lines.push(`Dependencies Scanned: ${result.summary.dependenciesScanned}`);
    }

    if (result.summary.secretsFound) {
      lines.push(`Secrets Found: ${result.summary.secretsFound}`);
    }

    // Static Analysis Issues
    if (result.staticAnalysis && result.staticAnalysis.issues.length > 0) {
      lines.push('');
      lines.push('─'.repeat(60));
      lines.push('STATIC ANALYSIS ISSUES');
      lines.push('─'.repeat(60));

      for (const issue of result.staticAnalysis.issues) {
        lines.push('');
        lines.push(`[${issue.severity.toUpperCase()}] ${issue.title}`);
        if (issue.location) {
          lines.push(`  File: ${issue.location.file}:${issue.location.line}`);
        }
        lines.push(`  ${issue.message}`);
        if (issue.suggestion) {
          lines.push(`  Suggestion: ${issue.suggestion}`);
        }
      }
    }

    // Dependency Vulnerabilities
    if (result.dependencyScan && result.dependencyScan.vulnerableDependencies.length > 0) {
      lines.push('');
      lines.push('─'.repeat(60));
      lines.push('VULNERABLE DEPENDENCIES');
      lines.push('─'.repeat(60));

      for (const vulnDep of result.dependencyScan.vulnerableDependencies) {
        lines.push('');
        lines.push(`${vulnDep.dependency.name}@${vulnDep.dependency.version}`);
        for (const vuln of vulnDep.vulnerabilities) {
          lines.push(`  [${vuln.severity.toUpperCase()}] ${vuln.id}: ${vuln.title}`);
          if (vuln.patchedVersion) {
            lines.push(`    Fix: Upgrade to ${vuln.patchedVersion}`);
          }
        }
      }
    }

    // Detected Secrets
    if (result.secretDetection && result.secretDetection.secrets.length > 0) {
      lines.push('');
      lines.push('─'.repeat(60));
      lines.push('DETECTED SECRETS');
      lines.push('─'.repeat(60));

      for (const secret of result.secretDetection.secrets) {
        lines.push('');
        lines.push(`[${secret.type.toUpperCase()}] ${secret.location.file}:${secret.location.line}`);
        lines.push(`  Value: ${secret.maskedValue}`);
        lines.push(`  Confidence: ${(secret.confidence * 100).toFixed(0)}%`);
        lines.push(`  Action: ${secret.remediation}`);
      }
    }

    // Errors
    if (result.errors.length > 0) {
      lines.push('');
      lines.push('─'.repeat(60));
      lines.push('ERRORS');
      lines.push('─'.repeat(60));
      for (const error of result.errors) {
        lines.push(`  - ${error}`);
      }
    }

    lines.push('');
    lines.push('═'.repeat(60));

    return lines.join('\n');
  }

  private generateJsonReport(result: CodeScannerResult): string {
    return JSON.stringify(result, null, 2);
  }

  private generateSarifReport(result: CodeScannerResult): string {
    // SARIF 2.1.0 format
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'CodeScanner',
              version: '1.0.0',
              informationUri: 'https://github.com/autonomous-coding-agents',
              rules: this.buildSarifRules(result),
            },
          },
          results: this.buildSarifResults(result),
        },
      ],
    };

    return JSON.stringify(sarif, null, 2);
  }

  private buildSarifRules(result: CodeScannerResult): object[] {
    const rules: object[] = [];
    const ruleIds = new Set<string>();

    // Collect unique rules from all issues
    const allIssues = [
      ...(result.staticAnalysis?.issues ?? []),
      ...(result.dependencyScan?.issues ?? []),
      ...(result.secretDetection?.issues ?? []),
    ];

    for (const issue of allIssues) {
      if (!ruleIds.has(issue.ruleId)) {
        ruleIds.add(issue.ruleId);
        rules.push({
          id: issue.ruleId,
          name: issue.title,
          shortDescription: { text: issue.title },
          fullDescription: { text: issue.message },
          defaultConfiguration: {
            level: this.sarifLevel(issue.severity),
          },
          helpUri: issue.references?.[0],
        });
      }
    }

    return rules;
  }

  private buildSarifResults(result: CodeScannerResult): object[] {
    const results: object[] = [];

    const allIssues = [
      ...(result.staticAnalysis?.issues ?? []),
      ...(result.dependencyScan?.issues ?? []),
      ...(result.secretDetection?.issues ?? []),
    ];

    for (const issue of allIssues) {
      results.push({
        ruleId: issue.ruleId,
        level: this.sarifLevel(issue.severity),
        message: { text: issue.message },
        locations: issue.location
          ? [
              {
                physicalLocation: {
                  artifactLocation: { uri: issue.location.file },
                  region: {
                    startLine: issue.location.line,
                    startColumn: issue.location.column,
                  },
                },
              },
            ]
          : [],
      });
    }

    return results;
  }

  private sarifLevel(severity: SecurityIssueSeverity): string {
    switch (severity) {
      case SecurityIssueSeverity.CRITICAL:
      case SecurityIssueSeverity.HIGH:
        return 'error';
      case SecurityIssueSeverity.MEDIUM:
        return 'warning';
      case SecurityIssueSeverity.LOW:
      case SecurityIssueSeverity.INFO:
        return 'note';
      default:
        return 'note';
    }
  }

  private generateHtmlReport(result: CodeScannerResult): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Scan Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .critical { color: #d32f2f; }
    .high { color: #f44336; }
    .medium { color: #ff9800; }
    .low { color: #2196f3; }
    .info { color: #9e9e9e; }
    .issue { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .issue-header { font-weight: bold; margin-bottom: 10px; }
    .issue-location { color: #666; font-family: monospace; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: white; }
    .badge.critical { background: #d32f2f; }
    .badge.high { background: #f44336; }
    .badge.medium { background: #ff9800; }
    .badge.low { background: #2196f3; }
    .badge.info { background: #9e9e9e; }
    .passed { color: #4caf50; }
    .failed { color: #f44336; }
  </style>
</head>
<body>
  <h1>Code Scan Report</h1>

  <div class="summary">
    <p><strong>Target:</strong> ${result.target}</p>
    <p><strong>Status:</strong> <span class="${result.success ? 'passed' : 'failed'}">${result.success ? '✓ PASSED' : '✗ FAILED'}</span></p>
    <p><strong>Duration:</strong> ${result.duration}ms</p>
    <p><strong>Total Issues:</strong> ${result.summary.totalIssues}</p>
    <ul>
      <li class="critical">Critical: ${result.summary.criticalIssues}</li>
      <li class="high">High: ${result.summary.highIssues}</li>
      <li class="medium">Medium: ${result.summary.mediumIssues}</li>
      <li class="low">Low: ${result.summary.lowIssues}</li>
      <li class="info">Info: ${result.summary.infoIssues}</li>
    </ul>
  </div>

  <h2>Issues</h2>
  ${this.generateHtmlIssues(result)}
</body>
</html>`;
  }

  private generateHtmlIssues(result: CodeScannerResult): string {
    const allIssues = [
      ...(result.staticAnalysis?.issues ?? []),
      ...(result.dependencyScan?.issues ?? []),
      ...(result.secretDetection?.issues ?? []),
    ];

    if (allIssues.length === 0) {
      return '<p>No issues found.</p>';
    }

    return allIssues
      .map(
        (issue) => `
      <div class="issue">
        <div class="issue-header">
          <span class="badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
          ${issue.title}
        </div>
        ${issue.location ? `<div class="issue-location">${issue.location.file}:${issue.location.line}</div>` : ''}
        <p>${issue.message}</p>
        ${issue.suggestion ? `<p><strong>Suggestion:</strong> ${issue.suggestion}</p>` : ''}
      </div>
    `
      )
      .join('');
  }
}

/**
 * Create unified code scanner
 */
export function createCodeScanner(
  staticAnalyzer?: IStaticAnalyzer,
  dependencyScanner?: IDependencyScanner,
  secretDetector?: ISecretDetector
): ICodeScanner {
  return new CodeScanner(staticAnalyzer, dependencyScanner, secretDetector);
}
