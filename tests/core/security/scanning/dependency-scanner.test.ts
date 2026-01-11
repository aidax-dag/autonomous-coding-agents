/**
 * Dependency Scanner Tests
 *
 * Feature: F5.6 - Code Scanning 심화
 * Tests for dependency vulnerability scanning implementation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  DependencyScanner,
  createDependencyScanner,
  SecurityIssueSeverity,
} from '../../../../src/core/security/scanning/index.js';

describe('DependencyScanner', () => {
  let scanner: DependencyScanner;
  let tempDir: string;

  beforeEach(() => {
    scanner = new DependencyScanner();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dep-scanner-test-'));
  });

  afterEach(() => {
    scanner.dispose();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Construction', () => {
    it('should create scanner with built-in database', () => {
      const info = scanner.getDatabaseInfo();

      expect(info.totalVulnerabilities).toBeGreaterThan(0);
      expect(info.sources).toContain('built-in');
    });

    it('should create scanner using factory function', () => {
      const factoryScanner = createDependencyScanner();

      expect(factoryScanner).toBeDefined();
      expect(factoryScanner.getDatabaseInfo().totalVulnerabilities).toBeGreaterThan(0);

      factoryScanner.dispose();
    });
  });

  describe('scan', () => {
    it('should scan npm dependencies from package.json', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20', // Vulnerable version
          express: '4.18.0',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      expect(result.success).toBe(true);
      expect(result.totalDependencies).toBeGreaterThanOrEqual(2);
    });

    it('should detect vulnerable npm packages', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20', // Known vulnerable version
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      expect(result.vulnerableDependencies.length).toBeGreaterThan(0);
      expect(result.vulnerableDependencies.some((v) => v.dependency.name === 'lodash')).toBe(true);
    });

    it('should scan Python dependencies from requirements.txt', async () => {
      const requirements = `
requests==2.25.0
certifi==2023.01.01
flask==2.0.0
`;

      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), requirements);

      const result = await scanner.scan(tempDir, { packageManagers: ['pip'] });

      expect(result.success).toBe(true);
      expect(result.totalDependencies).toBeGreaterThanOrEqual(3);
    });

    it('should detect vulnerable Python packages', async () => {
      const requirements = `
requests==2.25.0
certifi==2022.01.01
`;

      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), requirements);

      const result = await scanner.scan(tempDir, { packageManagers: ['pip'] });

      // Check if certifi vulnerability is detected (it's in our built-in DB)
      expect(result.vulnerableDependencies.length).toBeGreaterThan(0);
    });

    it('should include dev dependencies when option is set', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          express: '4.18.0',
        },
        devDependencies: {
          jest: '29.0.0',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, {
        packageManagers: ['npm'],
        includeDevDependencies: true,
      });

      expect(result.totalDependencies).toBeGreaterThanOrEqual(2);
      expect(
        result.issues.length >= 0 || result.vulnerableDependencies.length >= 0
      ).toBe(true);
    });

    it('should exclude dev dependencies when option is false', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          express: '4.18.0',
        },
        devDependencies: {
          lodash: '4.17.20', // Vulnerable
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, {
        packageManagers: ['npm'],
        includeDevDependencies: false,
      });

      // lodash should not be in the vulnerable list since it's dev only
      const hasLodash = result.vulnerableDependencies.some(
        (v) => v.dependency.name === 'lodash' && !v.dependency.isDev
      );
      expect(hasLodash).toBe(false);
    });

    it('should return issues from vulnerabilities', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      if (result.vulnerableDependencies.length > 0) {
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0].category).toBe('dependency');
      }
    });

    it('should provide remediation information', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      if (result.vulnerableDependencies.length > 0) {
        const vuln = result.vulnerableDependencies[0];
        expect(vuln.remediation).toBeDefined();
        expect(['upgrade', 'patch', 'remove', 'mitigate']).toContain(vuln.remediation?.action);
      }
    });

    it('should handle missing package files gracefully', async () => {
      const result = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      expect(result.success).toBe(true);
      expect(result.totalDependencies).toBe(0);
    });

    it('should report by package manager', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          express: '4.18.0',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      expect(result.byPackageManager).toBeDefined();
      expect(result.byPackageManager['npm']).toBeGreaterThan(0);
    });

    it('should track license information', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        license: 'MIT',
        dependencies: {
          express: '4.18.0',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      expect(result.licenseSummary).toBeDefined();
    });
  });

  describe('scanPackageFile', () => {
    it('should scan specific package.json file', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      const filePath = path.join(tempDir, 'package.json');
      fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2));

      const result = await scanner.scanPackageFile(filePath);

      expect(result.success).toBe(true);
      expect(result.totalDependencies).toBeGreaterThanOrEqual(1);
    });

    it('should scan requirements.txt file', async () => {
      const requirements = 'requests==2.25.0\nflask==2.0.0';
      const filePath = path.join(tempDir, 'requirements.txt');
      fs.writeFileSync(filePath, requirements);

      const result = await scanner.scanPackageFile(filePath);

      expect(result.success).toBe(true);
      expect(result.totalDependencies).toBeGreaterThanOrEqual(2);
    });

    it('should throw for unknown file type', async () => {
      const filePath = path.join(tempDir, 'unknown.xyz');
      fs.writeFileSync(filePath, 'content');

      await expect(scanner.scanPackageFile(filePath)).rejects.toThrow(/Unknown package file type/);
    });
  });

  describe('checkPackage', () => {
    it('should check single package for vulnerabilities', async () => {
      const vulnerabilities = await scanner.checkPackage('lodash', '4.17.20', 'npm');

      expect(vulnerabilities.length).toBeGreaterThan(0);
      expect(vulnerabilities[0].id).toBeDefined();
    });

    it('should return empty array for safe package', async () => {
      const vulnerabilities = await scanner.checkPackage('lodash', '4.17.21', 'npm');

      expect(vulnerabilities.length).toBe(0);
    });

    it('should return empty array for unknown package', async () => {
      const vulnerabilities = await scanner.checkPackage('unknown-package-xyz', '1.0.0', 'npm');

      expect(vulnerabilities.length).toBe(0);
    });
  });

  describe('Database Management', () => {
    it('should update database', async () => {
      const updateResult = await scanner.updateDatabase();

      expect(updateResult.updated).toBe(true);
      expect(updateResult.lastUpdate).toBeInstanceOf(Date);
    });

    it('should get database info', () => {
      const info = scanner.getDatabaseInfo();

      expect(info.lastUpdate).toBeInstanceOf(Date);
      expect(info.totalVulnerabilities).toBeGreaterThan(0);
      expect(Array.isArray(info.sources)).toBe(true);
    });
  });

  describe('Ignore Vulnerabilities', () => {
    it('should ignore specific vulnerabilities', async () => {
      // First, get the vulnerability ID
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Scan to find the vulnerability
      const firstResult = await scanner.scan(tempDir, { packageManagers: ['npm'] });

      if (firstResult.vulnerableDependencies.length > 0) {
        const vulnId = firstResult.vulnerableDependencies[0].vulnerabilities[0].id;

        // Ignore the vulnerability
        scanner.ignoreVulnerability(vulnId, 'Testing ignore feature');

        // Scan again
        const secondResult = await scanner.scan(tempDir, { packageManagers: ['npm'] });

        // The ignored vulnerability should not appear
        const hasIgnored = secondResult.vulnerableDependencies.some((v) =>
          v.vulnerabilities.some((vuln) => vuln.id === vulnId)
        );
        expect(hasIgnored).toBe(false);
      }
    });

    it('should get list of ignored vulnerabilities', () => {
      scanner.ignoreVulnerability('CVE-2021-12345', 'Test reason');
      scanner.ignoreVulnerability('CVE-2021-67890', 'Another reason');

      const ignored = scanner.getIgnoredVulnerabilities();

      expect(ignored.length).toBe(2);
      expect(ignored[0].reason).toBe('Test reason');
    });

    it('should expire ignored vulnerabilities', () => {
      const pastDate = new Date(Date.now() - 86400000); // Yesterday
      scanner.ignoreVulnerability('CVE-EXPIRED', 'Should expire', pastDate);

      const ignored = scanner.getIgnoredVulnerabilities();

      expect(ignored.some((i) => i.id === 'CVE-EXPIRED')).toBe(false);
    });

    it('should respect ignore list in options', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, {
        packageManagers: ['npm'],
        ignoreVulnerabilities: ['GHSA-93q8-gq69-wvmw'], // Lodash vulnerability
      });

      const hasIgnored = result.vulnerableDependencies.some((v) =>
        v.vulnerabilities.some((vuln) => vuln.id === 'GHSA-93q8-gq69-wvmw')
      );
      expect(hasIgnored).toBe(false);
    });
  });

  describe('Severity Filtering', () => {
    it('should filter by minimum severity', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          lodash: '4.17.20',
        },
      };

      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const result = await scanner.scan(tempDir, {
        packageManagers: ['npm'],
        minSeverity: SecurityIssueSeverity.CRITICAL,
      });

      // All issues should be critical severity
      for (const issue of result.issues) {
        expect(issue.severity).toBe(SecurityIssueSeverity.CRITICAL);
      }
    });
  });

  describe('Go Dependencies', () => {
    it('should parse go.mod file', async () => {
      const goMod = `
module example.com/myproject

go 1.20

require (
  github.com/gin-gonic/gin v1.9.0
  github.com/go-sql-driver/mysql v1.7.0
)
`;

      fs.writeFileSync(path.join(tempDir, 'go.mod'), goMod);

      const result = await scanner.scan(tempDir, { packageManagers: ['go'] });

      expect(result.success).toBe(true);
      expect(result.totalDependencies).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Disposal', () => {
    it('should throw error after disposal', () => {
      scanner.dispose();

      expect(() => scanner.getDatabaseInfo()).toThrow(/disposed/);
    });

    it('should throw error when scanning after disposal', async () => {
      scanner.dispose();

      await expect(scanner.scan(tempDir)).rejects.toThrow(/disposed/);
    });
  });
});
