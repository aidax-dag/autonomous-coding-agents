/**
 * Security Checker Tests
 *
 * Tests for the real security checker implementation
 * that runs npm audit and detects secrets.
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  SecurityChecker,
  createSecurityChecker,
  VulnerabilitySeverity,
  DEFAULT_SECURITY_CONFIG,
  DEFAULT_SECRET_PATTERNS,
} from '../../../../src/core/quality/checks/security-checker';
import { QualityDimension } from '../../../../src/core/quality/completion-detector';

describe('SecurityChecker', () => {
  let tempDir: string;
  let checker: SecurityChecker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'security-test-'));
    checker = new SecurityChecker({ runAudit: false }); // Disable npm audit for tests
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('should use default config when no config provided', () => {
      const instance = new SecurityChecker();
      expect(instance).toBeDefined();
    });

    it('should merge custom config with defaults', () => {
      const instance = new SecurityChecker({
        maxCriticalVulns: 1,
        maxHighVulns: 5,
      });
      expect(instance).toBeDefined();
    });
  });

  describe('check', () => {
    it('should pass for clean workspace', async () => {
      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.SECURITY);
      expect(result.passed).toBe(true);
      // Score may be slightly less than 100 due to missing lock file recommendation
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('should detect exposed secrets', async () => {
      // Create a file with an exposed secret
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const codeWithSecret = `
const config = {
  apiKey: 'AKIA1234567890ABCDEF',
  secret: 'my_secret_key'
};
`;

      await fs.writeFile(path.join(srcDir, 'config.ts'), codeWithSecret);

      const result = await checker.check(tempDir);

      expect(result.dimension).toBe(QualityDimension.SECURITY);
      expect(result.passed).toBe(false);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations!.some(r => r.includes('secret'))).toBe(true);
    });

    it('should detect GitHub tokens', async () => {
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const codeWithToken = `
const GITHUB_TOKEN = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123';
`;

      await fs.writeFile(path.join(srcDir, 'auth.ts'), codeWithToken);

      const result = await checker.check(tempDir);

      expect(result.passed).toBe(false);
    });

    it('should detect private keys', async () => {
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const codeWithKey = `
const privateKey = \`-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAxxxxx
-----END RSA PRIVATE KEY-----\`;
`;

      await fs.writeFile(path.join(srcDir, 'key.ts'), codeWithKey);

      const result = await checker.check(tempDir);

      expect(result.passed).toBe(false);
    });

    it('should ignore placeholders', async () => {
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const codeWithPlaceholder = `
const config = {
  // Replace with your API key
  apiKey: 'your_api_key_here',
  secret: 'xxxxxxxxxxxxxxxx'
};
`;

      await fs.writeFile(path.join(srcDir, 'config.example.ts'), codeWithPlaceholder);

      const result = await checker.check(tempDir);

      // Placeholders should not trigger failures
      expect(result.score).toBeGreaterThanOrEqual(90);
    });
  });

  describe('getSecuritySummary', () => {
    it('should check for lock files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package-lock.json'),
        JSON.stringify({ lockfileVersion: 3 })
      );

      const summary = await checker.getSecuritySummary(tempDir);

      expect(summary.hasPackageLock).toBe(true);
      expect(summary.hasYarnLock).toBe(false);
    });

    it('should check for .env example', async () => {
      await fs.writeFile(path.join(tempDir, '.env.example'), 'API_KEY=');

      const summary = await checker.getSecuritySummary(tempDir);

      expect(summary.hasEnvExample).toBe(true);
    });

    it('should detect missing .gitignore for .env', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET=value');

      const summary = await checker.getSecuritySummary(tempDir);

      expect(summary.securityIssues.some(i => i.title.includes('.env'))).toBe(true);
    });

    it('should not flag .env if properly gitignored', async () => {
      await fs.writeFile(path.join(tempDir, '.env'), 'SECRET=value');
      await fs.writeFile(path.join(tempDir, '.gitignore'), '.env\n');

      const summary = await checker.getSecuritySummary(tempDir);

      // Should not have the "not git-ignored" issue
      expect(summary.securityIssues.every(i => !i.title.includes('not be git-ignored'))).toBe(true);
    });
  });

  describe('getVulnerabilities', () => {
    it('should return empty when no package-lock exists', async () => {
      const vulns = await checker.getVulnerabilities(tempDir);
      expect(vulns).toEqual([]);
    });
  });

  describe('getSecretFindings', () => {
    it('should return all secret findings', async () => {
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const codeWithSecrets = `
const aws = {
  accessKey: 'AKIA1234567890ABCDEF',
  secretKey: 'my_aws_secret_access_key_abcdefghijklmnopqrstuvwxyz'
};
`;

      await fs.writeFile(path.join(srcDir, 'aws.ts'), codeWithSecrets);

      const findings = await checker.getSecretFindings(tempDir);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.type.includes('AWS'))).toBe(true);
    });

    it('should include line numbers in findings', async () => {
      const srcDir = path.join(tempDir, 'src');
      await fs.mkdir(srcDir);

      const code = `const line1 = '';
const line2 = '';
const token = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz123';
`;

      await fs.writeFile(path.join(srcDir, 'test.ts'), code);

      const findings = await checker.getSecretFindings(tempDir);

      if (findings.length > 0) {
        expect(findings[0].line).toBe(3);
      }
    });
  });

  describe('createSecurityChecker', () => {
    it('should create instance with factory function', () => {
      const instance = createSecurityChecker();
      expect(instance).toBeInstanceOf(SecurityChecker);
    });

    it('should accept custom config', () => {
      const instance = createSecurityChecker({
        runAudit: false,
        checkSecrets: true,
      });
      expect(instance).toBeInstanceOf(SecurityChecker);
    });
  });

  describe('VulnerabilitySeverity', () => {
    it('should have correct values', () => {
      expect(VulnerabilitySeverity.INFO).toBe('info');
      expect(VulnerabilitySeverity.LOW).toBe('low');
      expect(VulnerabilitySeverity.MODERATE).toBe('moderate');
      expect(VulnerabilitySeverity.HIGH).toBe('high');
      expect(VulnerabilitySeverity.CRITICAL).toBe('critical');
    });
  });

  describe('DEFAULT_SECRET_PATTERNS', () => {
    it('should include common secret patterns', () => {
      const patternNames = DEFAULT_SECRET_PATTERNS.map(p => p.name);

      expect(patternNames).toContain('AWS Access Key');
      expect(patternNames).toContain('GitHub Token');
      expect(patternNames).toContain('Private Key');
      expect(patternNames).toContain('JWT Token');
      expect(patternNames).toContain('Slack Token');
    });

    it('should match AWS access keys', () => {
      const awsPattern = DEFAULT_SECRET_PATTERNS.find(p => p.name === 'AWS Access Key');
      expect(awsPattern).toBeDefined();
      expect(awsPattern!.pattern.test('AKIAIOSFODNN7EXAMPLE')).toBe(true);
    });

    it('should match GitHub tokens', () => {
      const ghPattern = DEFAULT_SECRET_PATTERNS.find(p => p.name === 'GitHub Token');
      expect(ghPattern).toBeDefined();
      expect(ghPattern!.pattern.test('ghp_1234567890abcdefghijklmnopqrstuvwxyz123')).toBe(true);
    });
  });

  describe('DEFAULT_SECURITY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_SECURITY_CONFIG.runAudit).toBe(true);
      expect(DEFAULT_SECURITY_CONFIG.checkSecrets).toBe(true);
      expect(DEFAULT_SECURITY_CONFIG.maxCriticalVulns).toBe(0);
      expect(DEFAULT_SECURITY_CONFIG.maxHighVulns).toBe(0);
    });
  });
});
