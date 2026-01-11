/**
 * Dependency Vulnerability Scanner
 *
 * Feature: F5.6 - Code Scanning 심화
 * Provides dependency vulnerability detection with CVE database integration
 *
 * @module core/security/scanning
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { SecurityIssueSeverity } from '../plugin/plugin-security.interface.js';
import type {
  IDependencyScanner,
  DependencyInfo,
  VulnerabilityInfo,
  VulnerableDependency,
  DependencyScanOptions,
  DependencyScanResult,
  ScanIssue,
} from './scanning.interface.js';
import { SEVERITY_WEIGHTS } from './scanning.interface.js';

/**
 * Known vulnerability database entry
 */
interface VulnerabilityEntry {
  id: string;
  package: string;
  packageManager: DependencyInfo['packageManager'];
  affectedVersions: string;
  patchedVersion?: string;
  severity: SecurityIssueSeverity;
  cvssScore?: number;
  title: string;
  description: string;
  cweIds?: string[];
  references: string[];
  publishedAt: Date;
}

/**
 * Built-in vulnerability database (simplified for demonstration)
 * In production, this would be fetched from NVD, GitHub Advisory Database, etc.
 */
const BUILT_IN_VULNERABILITIES: VulnerabilityEntry[] = [
  // npm vulnerabilities
  {
    id: 'GHSA-93q8-gq69-wvmw',
    package: 'lodash',
    packageManager: 'npm',
    affectedVersions: '<4.17.21',
    patchedVersion: '4.17.21',
    severity: SecurityIssueSeverity.HIGH,
    cvssScore: 7.5,
    title: 'Prototype Pollution in lodash',
    description: 'Lodash versions prior to 4.17.21 are vulnerable to Prototype Pollution.',
    cweIds: ['CWE-1321'],
    references: [
      'https://github.com/advisories/GHSA-93q8-gq69-wvmw',
      'https://nvd.nist.gov/vuln/detail/CVE-2021-23337',
    ],
    publishedAt: new Date('2021-02-15'),
  },
  {
    id: 'CVE-2022-0155',
    package: 'follow-redirects',
    packageManager: 'npm',
    affectedVersions: '<1.14.8',
    patchedVersion: '1.14.8',
    severity: SecurityIssueSeverity.MEDIUM,
    cvssScore: 6.5,
    title: 'Exposure of Sensitive Information',
    description:
      'follow-redirects exposes sensitive information to unauthorized actors via headers.',
    cweIds: ['CWE-200'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-0155'],
    publishedAt: new Date('2022-01-10'),
  },
  {
    id: 'CVE-2021-3807',
    package: 'ansi-regex',
    packageManager: 'npm',
    affectedVersions: '>=3.0.0 <3.0.1 || >=4.0.0 <4.1.1 || >=5.0.0 <5.0.1 || >=6.0.0 <6.0.1',
    patchedVersion: '6.0.1',
    severity: SecurityIssueSeverity.HIGH,
    cvssScore: 7.5,
    title: 'Inefficient Regular Expression Complexity (ReDoS)',
    description: 'ansi-regex is vulnerable to ReDoS attacks.',
    cweIds: ['CWE-1333'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2021-3807'],
    publishedAt: new Date('2021-09-17'),
  },
  {
    id: 'CVE-2022-0778',
    package: 'node',
    packageManager: 'npm',
    affectedVersions: '<16.14.2 || >=17.0.0 <17.7.1',
    patchedVersion: '16.14.2',
    severity: SecurityIssueSeverity.HIGH,
    cvssScore: 7.5,
    title: 'OpenSSL Infinite Loop',
    description: 'Node.js is vulnerable to infinite loop in BN_mod_sqrt().',
    cweIds: ['CWE-835'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-0778'],
    publishedAt: new Date('2022-03-15'),
  },
  {
    id: 'CVE-2023-42282',
    package: 'ip',
    packageManager: 'npm',
    affectedVersions: '<1.1.9 || >=2.0.0 <2.0.1',
    patchedVersion: '2.0.1',
    severity: SecurityIssueSeverity.CRITICAL,
    cvssScore: 9.8,
    title: 'SSRF in ip package',
    description: 'The ip package is vulnerable to SSRF and bypass of IP address validation.',
    cweIds: ['CWE-918'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-42282'],
    publishedAt: new Date('2024-02-08'),
  },
  {
    id: 'CVE-2022-25883',
    package: 'semver',
    packageManager: 'npm',
    affectedVersions: '>=6.0.0 <6.3.1 || >=7.0.0 <7.5.2',
    patchedVersion: '7.5.2',
    severity: SecurityIssueSeverity.MEDIUM,
    cvssScore: 5.3,
    title: 'ReDoS in semver',
    description: 'semver is vulnerable to ReDoS in the clean() function.',
    cweIds: ['CWE-1333'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-25883'],
    publishedAt: new Date('2022-06-21'),
  },

  // Python vulnerabilities
  {
    id: 'CVE-2022-42969',
    package: 'py',
    packageManager: 'pip',
    affectedVersions: '<1.11.0',
    patchedVersion: '1.11.0',
    severity: SecurityIssueSeverity.HIGH,
    cvssScore: 7.5,
    title: 'ReDoS in py',
    description: 'py library is vulnerable to ReDoS when parsing SVN log messages.',
    cweIds: ['CWE-1333'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-42969'],
    publishedAt: new Date('2022-10-16'),
  },
  {
    id: 'CVE-2022-40897',
    package: 'setuptools',
    packageManager: 'pip',
    affectedVersions: '<65.5.1',
    patchedVersion: '65.5.1',
    severity: SecurityIssueSeverity.HIGH,
    cvssScore: 7.5,
    title: 'ReDoS in setuptools',
    description: 'setuptools is vulnerable to ReDoS via HTML package_index.',
    cweIds: ['CWE-1333'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2022-40897'],
    publishedAt: new Date('2022-12-23'),
  },
  {
    id: 'CVE-2023-32681',
    package: 'requests',
    packageManager: 'pip',
    affectedVersions: '>=2.3.0 <2.31.0',
    patchedVersion: '2.31.0',
    severity: SecurityIssueSeverity.MEDIUM,
    cvssScore: 6.1,
    title: 'Unintended leak of Proxy-Authorization header',
    description:
      'requests may unintentionally leak proxy credentials in the URL.',
    cweIds: ['CWE-200'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-32681'],
    publishedAt: new Date('2023-05-26'),
  },
  {
    id: 'CVE-2023-37920',
    package: 'certifi',
    packageManager: 'pip',
    affectedVersions: '<2023.07.22',
    patchedVersion: '2023.07.22',
    severity: SecurityIssueSeverity.CRITICAL,
    cvssScore: 9.8,
    title: 'Removal of e-Tugra root certificate',
    description:
      'certifi includes a root CA certificate that should be removed.',
    cweIds: ['CWE-295'],
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2023-37920'],
    publishedAt: new Date('2023-07-25'),
  },
];

/**
 * Ignored vulnerabilities storage
 */
interface IgnoredVulnerability {
  id: string;
  reason: string;
  expiresAt?: Date;
  addedAt: Date;
}

/**
 * Dependency Scanner implementation
 */
export class DependencyScanner implements IDependencyScanner {
  private vulnerabilityDb: Map<string, VulnerabilityEntry[]> = new Map();
  private ignoredVulnerabilities: Map<string, IgnoredVulnerability> = new Map();
  private lastUpdate: Date;
  private disposed = false;

  constructor() {
    this.lastUpdate = new Date();
    this.loadBuiltInDatabase();
  }

  async scan(
    dirPath: string,
    options: DependencyScanOptions = {}
  ): Promise<DependencyScanResult> {
    this.ensureNotDisposed();
    const startTime = new Date();
    const errors: string[] = [];
    const warnings: string[] = [];
    const allDependencies: DependencyInfo[] = [];
    const vulnerableDeps: VulnerableDependency[] = [];
    const outdatedDeps: DependencyInfo[] = [];
    const byPackageManager: Record<string, number> = {};
    const licenseSummary: Record<string, number> = {};

    try {
      // Find and parse dependency files
      const packageManagers = options.packageManagers ?? ['npm', 'pip'];

      for (const pm of packageManagers) {
        try {
          const deps = await this.parseDependencyFile(dirPath, pm, options);
          allDependencies.push(...deps);
          byPackageManager[pm] = (byPackageManager[pm] ?? 0) + deps.length;

          // Track licenses
          for (const dep of deps) {
            if (dep.license) {
              licenseSummary[dep.license] = (licenseSummary[dep.license] ?? 0) + 1;
            }
          }
        } catch (error) {
          errors.push(`Failed to parse ${pm} dependencies: ${error}`);
        }
      }

      // Check for vulnerabilities
      for (const dep of allDependencies) {
        const vulns = await this.checkPackage(dep.name, dep.version, dep.packageManager);

        // Filter by severity
        const filteredVulns = this.filterBySeverity(vulns, options.minSeverity);

        // Filter ignored vulnerabilities
        const activeVulns = this.filterIgnored(filteredVulns, options.ignoreVulnerabilities);

        if (activeVulns.length > 0) {
          vulnerableDeps.push({
            dependency: dep,
            vulnerabilities: activeVulns,
            remediation: this.getRemediation(dep, activeVulns),
          });
        }
      }

      // Build scan issues from vulnerabilities
      const issues = this.buildIssuesFromVulnerabilities(vulnerableDeps);

      const endTime = new Date();
      const directDeps = allDependencies.filter((d) => !d.isTransitive);
      const transitiveDeps = allDependencies.filter((d) => d.isTransitive);

      return {
        type: 'dependency-scan',
        success: errors.length === 0,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues,
        filesScanned: packageManagers.length,
        linesScanned: 0,
        errors,
        warnings,
        totalDependencies: allDependencies.length,
        directDependencies: directDeps.length,
        transitiveDependencies: transitiveDeps.length,
        vulnerableDependencies: vulnerableDeps,
        outdatedDependencies: outdatedDeps,
        byPackageManager,
        licenseSummary,
      };
    } catch (error) {
      const endTime = new Date();
      return {
        type: 'dependency-scan',
        success: false,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        issues: [],
        filesScanned: 0,
        linesScanned: 0,
        errors: [`Dependency scan failed: ${error}`],
        warnings,
        totalDependencies: 0,
        directDependencies: 0,
        transitiveDependencies: 0,
        vulnerableDependencies: [],
        outdatedDependencies: [],
        byPackageManager: {},
        licenseSummary: {},
      };
    }
  }

  async scanPackageFile(
    filePath: string,
    options: DependencyScanOptions = {}
  ): Promise<DependencyScanResult> {
    this.ensureNotDisposed();
    const dirPath = path.dirname(filePath);
    const fileName = path.basename(filePath);

    // Determine package manager from file name
    const pmMap: Record<string, DependencyInfo['packageManager']> = {
      'package.json': 'npm',
      'package-lock.json': 'npm',
      'requirements.txt': 'pip',
      'Pipfile': 'pip',
      'Pipfile.lock': 'pip',
      'pyproject.toml': 'pip',
      'go.mod': 'go',
      'Cargo.toml': 'cargo',
      'Gemfile': 'gem',
      'Gemfile.lock': 'gem',
      'pom.xml': 'maven',
      'build.gradle': 'maven',
      'composer.json': 'composer',
      '*.csproj': 'nuget',
    };

    const pm = pmMap[fileName];
    if (!pm) {
      throw new Error(`Unknown package file type: ${fileName}`);
    }

    return this.scan(dirPath, {
      ...options,
      packageManagers: [pm],
    });
  }

  async checkPackage(
    name: string,
    version: string,
    packageManager: DependencyInfo['packageManager']
  ): Promise<VulnerabilityInfo[]> {
    this.ensureNotDisposed();
    const key = `${packageManager}:${name}`;
    const entries = this.vulnerabilityDb.get(key) ?? [];
    const vulnerabilities: VulnerabilityInfo[] = [];

    for (const entry of entries) {
      if (this.isVersionAffected(version, entry.affectedVersions)) {
        vulnerabilities.push({
          id: entry.id,
          source: entry.id.startsWith('CVE')
            ? 'cve'
            : entry.id.startsWith('GHSA')
              ? 'ghsa'
              : 'other',
          severity: entry.severity,
          cvssScore: entry.cvssScore,
          title: entry.title,
          description: entry.description,
          affectedVersions: entry.affectedVersions,
          patchedVersion: entry.patchedVersion,
          cweIds: entry.cweIds,
          references: entry.references,
          publishedAt: entry.publishedAt,
        });
      }
    }

    return vulnerabilities;
  }

  async updateDatabase(): Promise<{ updated: boolean; lastUpdate: Date }> {
    this.ensureNotDisposed();
    // In production, this would fetch from vulnerability APIs
    // For now, we just reload the built-in database
    this.loadBuiltInDatabase();
    this.lastUpdate = new Date();
    return { updated: true, lastUpdate: this.lastUpdate };
  }

  getDatabaseInfo(): { lastUpdate: Date; totalVulnerabilities: number; sources: string[] } {
    this.ensureNotDisposed();
    let total = 0;
    for (const entries of this.vulnerabilityDb.values()) {
      total += entries.length;
    }

    return {
      lastUpdate: this.lastUpdate,
      totalVulnerabilities: total,
      sources: ['built-in', 'nvd', 'ghsa'],
    };
  }

  ignoreVulnerability(id: string, reason: string, expiresAt?: Date): void {
    this.ensureNotDisposed();
    this.ignoredVulnerabilities.set(id, {
      id,
      reason,
      expiresAt,
      addedAt: new Date(),
    });
  }

  getIgnoredVulnerabilities(): Array<{ id: string; reason: string; expiresAt?: Date }> {
    this.ensureNotDisposed();
    const result: Array<{ id: string; reason: string; expiresAt?: Date }> = [];

    for (const ignored of this.ignoredVulnerabilities.values()) {
      // Check if expired
      if (ignored.expiresAt && ignored.expiresAt < new Date()) {
        this.ignoredVulnerabilities.delete(ignored.id);
        continue;
      }

      result.push({
        id: ignored.id,
        reason: ignored.reason,
        expiresAt: ignored.expiresAt,
      });
    }

    return result;
  }

  dispose(): void {
    if (!this.disposed) {
      this.vulnerabilityDb.clear();
      this.ignoredVulnerabilities.clear();
      this.disposed = true;
    }
  }

  // ==================== Private Methods ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('DependencyScanner has been disposed');
    }
  }

  private loadBuiltInDatabase(): void {
    this.vulnerabilityDb.clear();

    for (const entry of BUILT_IN_VULNERABILITIES) {
      const key = `${entry.packageManager}:${entry.package}`;
      const existing = this.vulnerabilityDb.get(key) ?? [];
      existing.push(entry);
      this.vulnerabilityDb.set(key, existing);
    }
  }

  private async parseDependencyFile(
    dirPath: string,
    packageManager: DependencyInfo['packageManager'],
    options: DependencyScanOptions
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];

    switch (packageManager) {
      case 'npm':
        return this.parseNpmDependencies(dirPath, options);
      case 'pip':
        return this.parsePipDependencies(dirPath, options);
      case 'go':
        return this.parseGoDependencies(dirPath, options);
      default:
        return dependencies;
    }
  }

  private async parseNpmDependencies(
    dirPath: string,
    options: DependencyScanOptions
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const packageJsonPath = path.join(dirPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      return dependencies;
    }

    try {
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      // Parse dependencies
      if (pkg.dependencies) {
        for (const [name, versionSpec] of Object.entries(pkg.dependencies)) {
          dependencies.push({
            name,
            version: this.cleanVersion(versionSpec as string),
            packageManager: 'npm',
            isDev: false,
            isTransitive: false,
            license: pkg.license,
          });
        }
      }

      // Parse dev dependencies
      if (options.includeDevDependencies !== false && pkg.devDependencies) {
        for (const [name, versionSpec] of Object.entries(pkg.devDependencies)) {
          dependencies.push({
            name,
            version: this.cleanVersion(versionSpec as string),
            packageManager: 'npm',
            isDev: true,
            isTransitive: false,
          });
        }
      }

      // Parse lock file for transitive dependencies
      if (options.includeTransitive !== false) {
        const lockPath = path.join(dirPath, 'package-lock.json');
        if (fs.existsSync(lockPath)) {
          try {
            const lockContent = fs.readFileSync(lockPath, 'utf-8');
            const lock = JSON.parse(lockContent);

            // package-lock.json v2/v3 format
            if (lock.packages) {
              for (const [pkgPath, pkgInfo] of Object.entries(
                lock.packages as Record<string, { version?: string }>
              )) {
                if (pkgPath === '' || !pkgPath.startsWith('node_modules/')) continue;

                const name = pkgPath.replace(/^node_modules\//, '').replace(/\/node_modules\/.*/, '');
                const existingDep = dependencies.find((d) => d.name === name);

                if (!existingDep && pkgInfo.version) {
                  dependencies.push({
                    name,
                    version: pkgInfo.version,
                    packageManager: 'npm',
                    isDev: false,
                    isTransitive: true,
                  });
                }
              }
            }
          } catch {
            // Ignore lock file parsing errors
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse package.json: ${error}`);
    }

    return dependencies;
  }

  private async parsePipDependencies(
    dirPath: string,
    _options: DependencyScanOptions
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const requirementsPath = path.join(dirPath, 'requirements.txt');

    if (!fs.existsSync(requirementsPath)) {
      return dependencies;
    }

    try {
      const content = fs.readFileSync(requirementsPath, 'utf-8');
      const lines = content.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Skip options like -r, -e, etc.
        if (trimmed.startsWith('-')) continue;

        // Parse package==version or package>=version, etc.
        const match = trimmed.match(/^([a-zA-Z0-9_-]+)(?:[=<>~!]+(.+))?$/);
        if (match) {
          const [, name, version] = match;
          dependencies.push({
            name: name.toLowerCase(),
            version: version ?? 'latest',
            packageManager: 'pip',
            isDev: false,
            isTransitive: false,
          });
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse requirements.txt: ${error}`);
    }

    return dependencies;
  }

  private async parseGoDependencies(
    dirPath: string,
    _options: DependencyScanOptions
  ): Promise<DependencyInfo[]> {
    const dependencies: DependencyInfo[] = [];
    const goModPath = path.join(dirPath, 'go.mod');

    if (!fs.existsSync(goModPath)) {
      return dependencies;
    }

    try {
      const content = fs.readFileSync(goModPath, 'utf-8');
      const lines = content.split('\n');
      let inRequireBlock = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === 'require (') {
          inRequireBlock = true;
          continue;
        }

        if (trimmed === ')') {
          inRequireBlock = false;
          continue;
        }

        if (inRequireBlock || trimmed.startsWith('require ')) {
          const requireLine = trimmed.replace(/^require\s+/, '');
          const match = requireLine.match(/^([^\s]+)\s+v?([^\s]+)/);
          if (match) {
            const [, name, version] = match;
            dependencies.push({
              name,
              version,
              packageManager: 'go',
              isDev: false,
              isTransitive: false,
            });
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse go.mod: ${error}`);
    }

    return dependencies;
  }

  private cleanVersion(version: string): string {
    // Remove semver prefixes like ^, ~, >=, etc.
    return version.replace(/^[\^~>=<]+/, '').trim();
  }

  private isVersionAffected(version: string, affectedVersions: string): boolean {
    // Simplified version check
    // In production, use a proper semver library

    const cleanVersion = this.cleanVersion(version);

    // Handle simple patterns
    if (affectedVersions.startsWith('<')) {
      const targetVersion = affectedVersions.slice(1);
      return this.compareVersions(cleanVersion, targetVersion) < 0;
    }

    if (affectedVersions.startsWith('<=')) {
      const targetVersion = affectedVersions.slice(2);
      return this.compareVersions(cleanVersion, targetVersion) <= 0;
    }

    if (affectedVersions.includes(' || ')) {
      // Handle multiple ranges
      const ranges = affectedVersions.split(' || ');
      return ranges.some((range) => this.isVersionAffected(cleanVersion, range.trim()));
    }

    if (affectedVersions.includes(' ')) {
      // Handle range like ">=1.0.0 <2.0.0"
      const [minPart, maxPart] = affectedVersions.split(' ');
      const minMatch = this.isVersionAffected(cleanVersion, minPart);
      const maxMatch = this.isVersionAffected(cleanVersion, maxPart);
      return minMatch && maxMatch;
    }

    if (affectedVersions.startsWith('>=')) {
      const targetVersion = affectedVersions.slice(2);
      return this.compareVersions(cleanVersion, targetVersion) >= 0;
    }

    if (affectedVersions.startsWith('>')) {
      const targetVersion = affectedVersions.slice(1);
      return this.compareVersions(cleanVersion, targetVersion) > 0;
    }

    // Exact match
    return cleanVersion === affectedVersions;
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);

    const maxLen = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLen; i++) {
      const p1 = parts1[i] ?? 0;
      const p2 = parts2[i] ?? 0;

      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }

    return 0;
  }

  private filterBySeverity(
    vulnerabilities: VulnerabilityInfo[],
    minSeverity?: SecurityIssueSeverity
  ): VulnerabilityInfo[] {
    if (!minSeverity) return vulnerabilities;

    const minWeight = SEVERITY_WEIGHTS[minSeverity];
    return vulnerabilities.filter((v) => SEVERITY_WEIGHTS[v.severity] >= minWeight);
  }

  private filterIgnored(
    vulnerabilities: VulnerabilityInfo[],
    ignoreList?: string[]
  ): VulnerabilityInfo[] {
    // Get active ignored vulnerabilities
    const ignored = new Set<string>();

    for (const [id, entry] of this.ignoredVulnerabilities.entries()) {
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        this.ignoredVulnerabilities.delete(id);
        continue;
      }
      ignored.add(id);
    }

    // Add explicit ignore list
    if (ignoreList) {
      for (const id of ignoreList) {
        ignored.add(id);
      }
    }

    return vulnerabilities.filter((v) => !ignored.has(v.id));
  }

  private getRemediation(
    dep: DependencyInfo,
    vulnerabilities: VulnerabilityInfo[]
  ): VulnerableDependency['remediation'] {
    // Find the best patched version
    const patchedVersions = vulnerabilities
      .filter((v) => v.patchedVersion)
      .map((v) => v.patchedVersion!)
      .sort((a, b) => this.compareVersions(b, a));

    if (patchedVersions.length > 0) {
      return {
        action: 'upgrade',
        targetVersion: patchedVersions[0],
        breakingChanges: this.isPotentiallyBreaking(dep.version, patchedVersions[0]),
      };
    }

    // No patched version available
    return {
      action: 'mitigate',
      manualSteps: ['Review and assess risk', 'Consider alternative packages', 'Implement workarounds if available'],
    };
  }

  private isPotentiallyBreaking(currentVersion: string, targetVersion: string): boolean {
    const current = this.cleanVersion(currentVersion).split('.').map((p) => parseInt(p, 10) || 0);
    const target = this.cleanVersion(targetVersion).split('.').map((p) => parseInt(p, 10) || 0);

    // Major version change is potentially breaking
    return target[0] > current[0];
  }

  private buildIssuesFromVulnerabilities(vulnerableDeps: VulnerableDependency[]): ScanIssue[] {
    const issues: ScanIssue[] = [];

    for (const vulnDep of vulnerableDeps) {
      for (const vuln of vulnDep.vulnerabilities) {
        issues.push({
          id: vuln.id,
          ruleId: 'DEP001',
          severity: vuln.severity,
          category: 'dependency',
          title: `${vulnDep.dependency.name}@${vulnDep.dependency.version}: ${vuln.title}`,
          message: vuln.description,
          suggestion: vulnDep.remediation?.targetVersion
            ? `Upgrade to version ${vulnDep.remediation.targetVersion}`
            : 'Review and mitigate vulnerability',
          references: vuln.references,
          confidence: 1.0,
          cveId: vuln.id.startsWith('CVE') ? vuln.id : undefined,
          metadata: {
            package: vulnDep.dependency.name,
            version: vulnDep.dependency.version,
            cvssScore: vuln.cvssScore,
            patchedVersion: vuln.patchedVersion,
          },
        });
      }
    }

    return issues;
  }
}

/**
 * Create dependency scanner instance
 */
export function createDependencyScanner(): IDependencyScanner {
  return new DependencyScanner();
}
